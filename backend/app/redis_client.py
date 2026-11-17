"""Shared Redis client, JSON caching, and grading worker wakeup helpers."""
import json
import logging
import threading
import time
from typing import Any

import redis
from redis.exceptions import RedisError

from app.config import get_settings

logger = logging.getLogger(__name__)

_CLIENT_LOCK = threading.Lock()
_CACHED_URL: str | None = None
_CACHED_CLIENT: redis.Redis | None = None
_WORKER_BLOCKING_LOCAL = threading.local()

_WAKEUP_QUEUE_KEY = "veripie:grading:wakeup"


def reset_redis_client() -> None:
    """Clear cached Redis connections (used by test fixtures)."""
    global _CACHED_URL, _CACHED_CLIENT
    with _CLIENT_LOCK:
        if _CACHED_CLIENT is not None:
            try:
                _CACHED_CLIENT.close()
            except Exception:
                pass
        _CACHED_URL = None
        _CACHED_CLIENT = None


def get_redis_client() -> redis.Redis | None:
    """Return a cached Redis client if REDIS_URL is configured, else None."""
    global _CACHED_URL, _CACHED_CLIENT
    url = get_settings().redis_url.strip()
    if not url:
        return None

    with _CLIENT_LOCK:
        if _CACHED_CLIENT is not None and _CACHED_URL == url:
            return _CACHED_CLIENT
        try:
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                health_check_interval=30,
            )
            _CACHED_URL = url
            _CACHED_CLIENT = client
            return _CACHED_CLIENT
        except Exception as exc:
            logger.warning("Failed to initialize Redis client: %s", exc)
            return None


def redis_status() -> str:
    """Return Redis health state: 'disabled', 'connected', or 'unavailable'."""
    url = get_settings().redis_url.strip()
    if not url:
        return "disabled"
    client = get_redis_client()
    if client is None:
        return "unavailable"
    try:
        client.ping()
        return "connected"
    except RedisError:
        return "unavailable"


def get_cache_version(namespace: str) -> str:
    """Read an O(1) cache invalidation counter for a namespace."""
    client = get_redis_client()
    if client is None:
        return "0"
    try:
        val = client.get(f"veripie:ver:{namespace}")
        return str(val) if val is not None else "0"
    except RedisError:
        return "0"


def bump_cache_version(namespace: str) -> None:
    """Invalidate all cached entries in a namespace in O(1)."""
    client = get_redis_client()
    if client is None:
        return
    try:
        client.incr(f"veripie:ver:{namespace}")
    except RedisError as exc:
        logger.debug("Redis version bump skipped (%s): %s", namespace, exc)


def cache_get_json(key: str) -> Any | None:
    """Read and decode a JSON value from Redis, returning None on miss or error."""
    client = get_redis_client()
    if client is None:
        return None
    try:
        raw = client.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except (RedisError, ValueError):
        return None


def cache_set_json(key: str, value: Any, ttl_seconds: int) -> None:
    """Serialize and store a JSON value in Redis with TTL."""
    client = get_redis_client()
    if client is None or ttl_seconds <= 0:
        return
    try:
        client.setex(key, ttl_seconds, json.dumps(value))
    except (RedisError, TypeError, ValueError) as exc:
        logger.debug("Redis cache write skipped (%s): %s", key, exc)


def notify_grading_worker(count: int = 1) -> None:
    """Signal idle grading workers via Redis so queued jobs start immediately."""
    client = get_redis_client()
    if client is None or count <= 0:
        return
    tokens = ["1"] * min(count, 16)
    try:
        pipe = client.pipeline()
        pipe.rpush(_WAKEUP_QUEUE_KEY, *tokens)
        pipe.ltrim(_WAKEUP_QUEUE_KEY, -64, -1)
        pipe.execute()
    except RedisError as exc:
        logger.debug("Redis worker notify skipped: %s", exc)


def wait_for_grading_job(timeout_seconds: float = 2.0) -> bool:
    """Wait on Redis wakeup queue if available, falling back to time.sleep."""
    url = get_settings().redis_url.strip()
    if not url:
        time.sleep(timeout_seconds)
        return False

    block_seconds = max(1, int(round(timeout_seconds)))
    try:
        client: redis.Redis | None = getattr(_WORKER_BLOCKING_LOCAL, "client", None)
        client_url: str | None = getattr(_WORKER_BLOCKING_LOCAL, "url", None)
        if client is None or client_url != url:
            client = redis.from_url(
                url,
                decode_responses=True,
                socket_connect_timeout=0.5,
                socket_timeout=block_seconds + 2.0,
            )
            _WORKER_BLOCKING_LOCAL.client = client
            _WORKER_BLOCKING_LOCAL.url = url

        popped = client.blpop([_WAKEUP_QUEUE_KEY], timeout=block_seconds)
        return popped is not None
    except RedisError:
        time.sleep(timeout_seconds)
        return False
