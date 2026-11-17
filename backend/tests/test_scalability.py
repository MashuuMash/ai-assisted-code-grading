"""Tests for scalability components: Redis rate limiting, caching, batch concurrency, and worker wakeup."""
import json
import threading
import time

from fastapi.testclient import TestClient
from redis.exceptions import RedisError
from sqlalchemy.orm import Session

from app import ai_feedback_engine, codebert_detector, rate_limit, redis_client
from app.models import Assignment, AssignmentStatus, Cohort, Course, Submission, User
from app.submission_storage import SubmissionStorage
from tests.conftest import auth_headers


class _FakeRedisPipeline:
    def __init__(self, store: "_FakeRedis") -> None:
        self._store = store
        self._ops: list[tuple] = []

    def rpush(self, key: str, *values: str) -> "_FakeRedisPipeline":
        self._ops.append(("rpush", key, values))
        return self

    def ltrim(self, key: str, start: int, stop: int) -> "_FakeRedisPipeline":
        self._ops.append(("ltrim", key, start, stop))
        return self

    def execute(self) -> list[int]:
        for op in self._ops:
            if op[0] == "rpush":
                _, key, values = op
                self._store.lists.setdefault(key, []).extend(values)
            elif op[0] == "ltrim":
                _, key, start, stop = op
                lst = self._store.lists.get(key, [])
                if start < 0 and stop == -1:
                    self._store.lists[key] = lst[start:]
        return [1]


class _FakeRedis:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.kv: dict[str, str] = {}
        self.lists: dict[str, list[str]] = {}
        self.zsets: dict[str, list[tuple[float, str]]] = {}

    def _guard(self) -> None:
        if self.fail:
            raise RedisError("Simulated Redis failure")

    def ping(self) -> bool:
        self._guard()
        return True

    def get(self, key: str) -> str | None:
        self._guard()
        return self.kv.get(key)

    def setex(self, key: str, ttl: int, value: str) -> bool:
        self._guard()
        _ = ttl
        self.kv[key] = value
        return True

    def incr(self, key: str) -> int:
        self._guard()
        val = int(self.kv.get(key, "0")) + 1
        self.kv[key] = str(val)
        return val

    def pipeline(self) -> _FakeRedisPipeline:
        self._guard()
        return _FakeRedisPipeline(self)

    def blpop(self, keys: list[str], timeout: int = 1) -> tuple[str, str] | None:
        self._guard()
        _ = timeout
        for key in keys:
            lst = self.lists.get(key)
            if lst:
                return key, lst.pop(0)
        return None

    def eval(self, script: str, numkeys: int, key: str, now_ms: int, window_ms: int, max_req: int, member: str):
        self._guard()
        _ = (script, numkeys)
        cutoff = float(now_ms) - float(window_ms)
        bucket = [(s, m) for s, m in self.zsets.get(key, []) if s > cutoff]
        if len(bucket) >= int(max_req):
            self.zsets[key] = bucket
            return [0, 1]
        bucket.append((float(now_ms), member))
        self.zsets[key] = bucket
        return [1, 0]

    def close(self) -> None:
        pass


def test_redis_rate_limit_and_fallback(client: TestClient, monkeypatch) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr(rate_limit, "get_redis_client", lambda: fake)

    for idx in range(20):
        resp = client.post(
            "/api/v1/auth/login/json",
            json={"username_or_email": f"nobody{idx}@example.edu", "password": "Password123!"},
        )
        assert resp.status_code == 401

    blocked = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": "nobody21@example.edu", "password": "Password123!"},
    )
    assert blocked.status_code == 429
    assert int(blocked.headers.get("Retry-After", "0")) >= 1

    # Simulate Redis outage -> falls back gracefully to clean in-memory limiter (no 500 error)
    fake.fail = True
    fallback_resp = client.post(
        "/api/v1/auth/login/json",
        json={"username_or_email": "fallback@example.edu", "password": "Password123!"},
    )
    assert fallback_resp.status_code == 401


def test_courses_read_through_cache_and_invalidation(
    client: TestClient,
    lecturer_token: str,
    monkeypatch,
) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr(redis_client, "get_redis_client", lambda: fake)

    headers = auth_headers(lecturer_token)
    res_empty = client.get("/api/v1/courses", headers=headers)
    assert res_empty.status_code == 200
    assert res_empty.json() == []
    assert any(k.startswith("veripie:courses:v0:") for k in fake.kv)

    # Create course -> bumps version so next GET sees it immediately
    res_create = client.post(
        "/api/v1/courses",
        json={"code": "SCALE101", "name": "Scalable Systems", "description": "Test"},
        headers=headers,
    )
    assert res_create.status_code == 201
    assert fake.kv.get("veripie:ver:courses") == "1"

    res_list = client.get("/api/v1/courses", headers=headers)
    assert res_list.status_code == 200
    items = res_list.json()
    assert len(items) == 1
    assert items[0]["code"] == "SCALE101"
    cached_v1 = json.loads(next(v for k, v in fake.kv.items() if k.startswith("veripie:courses:v1:")))
    assert len(cached_v1) == 1


def test_worker_wakeup_helper_signals_redis(monkeypatch) -> None:
    fake = _FakeRedis()
    monkeypatch.setattr(redis_client, "get_redis_client", lambda: fake)
    redis_client.notify_grading_worker(count=3)
    assert len(fake.lists[redis_client._WAKEUP_QUEUE_KEY]) == 3


def test_batch_feedback_concurrent_synthesis_is_thread_safe(
    db: Session,
    lecturer_user: User,
    monkeypatch,
) -> None:
    course = Course(code="CONC101", name="Concurrency Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()
    cohort = Cohort(code="C1", name="Cohort 1", semester="Fall", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()
    assignment = Assignment(class_id=cohort.id, title="Parallel AI Feedback", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.flush()

    storage = SubmissionStorage()
    subs: list[Submission] = []
    for i in range(4):
        stored = storage.store_bytes(f"print({i})\n".encode("utf-8"), f"s{i}.py")
        sub = Submission(
            assignment_id=assignment.id,
            original_filename=f"s{i}.py",
            storage_key=stored.storage_key,
            size_bytes=stored.size_bytes,
            sha256=stored.sha256,
        )
        db.add(sub)
        subs.append(sub)
    db.commit()

    thread_ids: set[int] = set()
    orig_synth = ai_feedback_engine._synthesize_feedback_payload
    settings = ai_feedback_engine.get_settings()
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(settings, "openai_api_key", "")

    def traced_synth(task):
        thread_ids.add(threading.get_ident())
        time.sleep(0.02)
        return orig_synth(task)

    monkeypatch.setattr(ai_feedback_engine, "_synthesize_feedback_payload", traced_synth)

    outcomes = ai_feedback_engine.generate_batch_feedback_for_submissions(
        submission_ids=[s.id for s in subs],
        db=db,
        max_workers=4,
    )
    assert len(outcomes) == 4
    assert len(thread_ids) >= 2
    for sub in subs:
        grade, exc = outcomes[sub.id]
        assert exc is None
        assert grade is not None
        assert grade.feedback_source == "rules"


def test_codebert_model_singleton_cache(tmp_path, monkeypatch) -> None:
    model_dir = tmp_path / "dummy_codebert"
    model_dir.mkdir()
    codebert_detector._MODEL_CACHE.clear()

    load_calls = {"tokenizer": 0, "model": 0}

    class _DummyConfig:
        id2label = {0: "human", 1: "ai_generated"}

    class _DummyModel:
        config = _DummyConfig()

        def eval(self) -> None:
            pass

    class _DummyTokenizerLoader:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            _ = (args, kwargs)
            load_calls["tokenizer"] += 1
            return object()

    class _DummyModelLoader:
        @staticmethod
        def from_pretrained(*args, **kwargs):
            _ = (args, kwargs)
            load_calls["model"] += 1
            return _DummyModel()

    monkeypatch.setattr(codebert_detector, "TRANSFORMERS_AVAILABLE", True)
    monkeypatch.setattr(codebert_detector, "AutoTokenizer", _DummyTokenizerLoader)
    monkeypatch.setattr(codebert_detector, "AutoModelForSequenceClassification", _DummyModelLoader)

    d1 = codebert_detector.CodeBertDetector(model_name_or_path=str(model_dir))
    d2 = codebert_detector.CodeBertDetector(model_name_or_path=str(model_dir))
    assert d1._init_transformers_model() is True
    assert d2._init_transformers_model() is True
    assert load_calls == {"tokenizer": 1, "model": 1}
    codebert_detector._MODEL_CACHE.clear()
