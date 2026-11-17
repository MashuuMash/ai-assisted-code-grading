"""Distributed sliding-window rate limiter (Redis-backed with in-memory fallback)."""
import logging
import time
from collections import defaultdict, deque
from threading import Lock
from typing import Callable
from uuid import uuid4

from fastapi import HTTPException, Request, status
from redis.exceptions import RedisError

from app.config import get_settings
from app.redis_client import get_redis_client

logger = logging.getLogger(__name__)

_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_LOCK = Lock()

_LUA_SLIDING_WINDOW = """
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local max_req = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
local count = redis.call('ZCARD', key)
if count >= max_req then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_s = math.ceil(window_ms / 1000)
  if oldest[2] then
    retry_s = math.max(1, math.ceil((tonumber(oldest[2]) + window_ms - now_ms) / 1000))
  end
  return {0, retry_s}
end
redis.call('ZADD', key, now_ms, member)
redis.call('PEXPIRE', key, window_ms + 1000)
return {1, 0}
"""


def reset_rate_limiter() -> None:
    """Clear in-memory rate-limit counters (intended for test isolation)."""
    with _LOCK:
        _BUCKETS.clear()


def _extract_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_ip = forwarded.split(",")[0].strip()
        if first_ip:
            return first_ip
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _check_memory_limit(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int]:
    now = time.monotonic()
    cutoff = now - window_seconds
    with _LOCK:
        bucket = _BUCKETS[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= max_requests:
            retry_after = max(1, int(window_seconds - (now - bucket[0])) + 1)
            return False, retry_after
        bucket.append(now)
        return True, 0


def _check_redis_limit(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int] | None:
    client = get_redis_client()
    if client is None:
        return None
    now_ms = int(time.time() * 1000)
    window_ms = max(1, window_seconds) * 1000
    member = f"{now_ms}:{uuid4().hex[:8]}"
    try:
        res = client.eval(_LUA_SLIDING_WINDOW, 1, f"veripie:rl:{key}", now_ms, window_ms, max_requests, member)
        allowed = int(res[0]) == 1
        retry_after = int(res[1])
        return allowed, retry_after
    except (RedisError, IndexError, TypeError, ValueError) as exc:
        logger.warning("Redis rate limiter unavailable (%s); falling back to memory", exc)
        return None


def rate_limit(scope: str, max_requests: int, window_seconds: int = 60) -> Callable[[Request], None]:
    """Build a FastAPI dependency enforcing a per-IP sliding-window request cap."""

    def _dependency(request: Request) -> None:
        if not get_settings().rate_limit_enabled:
            return

        key = f"{scope}:{_extract_client_ip(request)}"
        redis_result = _check_redis_limit(key, max_requests, window_seconds)
        if redis_result is not None:
            allowed, retry_after = redis_result
        else:
            allowed, retry_after = _check_memory_limit(key, max_requests, window_seconds)

        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait and try again.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

    return _dependency
