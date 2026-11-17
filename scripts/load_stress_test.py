"""HTTP Load, Stress, and Endurance testing harness for VeriPie FastAPI backend."""
import argparse
import asyncio
import contextlib
import json
import math
import os
import socket
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = (len(sorted_vals) - 1) * (pct / 100.0)
    lo = math.floor(idx)
    hi = math.ceil(idx)
    if lo == hi:
        return round(sorted_vals[lo], 2)
    frac = idx - lo
    return round(sorted_vals[lo] * (1.0 - frac) + sorted_vals[hi] * frac, 2)


async def _run_stage(
    name: str,
    base_url: str,
    headers: dict[str, str],
    endpoints: list[str],
    concurrency: int,
    total_requests: int | None = None,
    duration_seconds: float | None = None,
) -> dict:
    latencies_ms: list[float] = []
    status_counts: dict[str, int] = {}
    errors = 0

    limits = httpx.Limits(max_connections=concurrency + 10, max_keepalive_connections=concurrency)
    async with httpx.AsyncClient(base_url=base_url, timeout=15.0, limits=limits) as client:
        counter = 0
        lock = asyncio.Lock()
        t0 = time.perf_counter()

        async def worker(worker_id: int) -> None:
            nonlocal counter, errors
            idx = worker_id
            while True:
                if total_requests is not None:
                    async with lock:
                        if counter >= total_requests:
                            return
                        counter += 1
                elif duration_seconds is not None and time.perf_counter() - t0 >= duration_seconds:
                    return

                path = endpoints[idx % len(endpoints)]
                idx += 1
                req_start = time.perf_counter()
                try:
                    resp = await client.get(path, headers=headers)
                    elapsed_ms = (time.perf_counter() - req_start) * 1000.0
                    latencies_ms.append(elapsed_ms)
                    code = str(resp.status_code)
                    status_counts[code] = status_counts.get(code, 0) + 1
                    if resp.status_code >= 500 or resp.status_code == 429:
                        errors += 1
                except httpx.HTTPError:
                    elapsed_ms = (time.perf_counter() - req_start) * 1000.0
                    latencies_ms.append(elapsed_ms)
                    errors += 1
                    status_counts["exception"] = status_counts.get("exception", 0) + 1

        await asyncio.gather(*(worker(i) for i in range(concurrency)))
        wall_s = max(0.001, time.perf_counter() - t0)

    sorted_lat = sorted(latencies_ms)
    completed = len(latencies_ms)
    return {
        "stage": name,
        "concurrency": concurrency,
        "total_requests": completed,
        "duration_seconds": round(wall_s, 3),
        "rps": round(completed / wall_s, 2),
        "error_count": errors,
        "error_rate_pct": round((errors / completed * 100.0) if completed else 0.0, 2),
        "p50_ms": _percentile(sorted_lat, 50.0),
        "p95_ms": _percentile(sorted_lat, 95.0),
        "p99_ms": _percentile(sorted_lat, 99.0),
        "max_ms": round(max(sorted_lat), 2) if sorted_lat else 0.0,
        "status_counts": status_counts,
    }


def _bootstrap_local_data(base_url: str) -> tuple[dict[str, str], list[str]]:
    with httpx.Client(base_url=base_url, timeout=15.0) as client:
        seed_res = client.post("/api/v1/demo/seed")
        seed_res.raise_for_status()
        data = seed_res.json()
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        courses = client.get("/api/v1/courses", headers=headers).json()
        c_id = courses[0]["id"]
        classes = client.get(f"/api/v1/courses/{c_id}/classes", headers=headers).json()
        cl_id = classes[0]["id"]
        assignments = client.get(f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments", headers=headers).json()
        a_id = assignments[0]["id"]
        endpoints = [
            "/health",
            "/api/v1/courses",
            f"/api/v1/courses/{c_id}/classes/{cl_id}/assignments/{a_id}/submissions",
            "/api/v1/auth/me",
        ]
        return headers, endpoints


async def _wait_for_server(base_url: str, timeout_s: float = 20.0) -> None:
    deadline = time.perf_counter() + timeout_s
    async with httpx.AsyncClient(base_url=base_url, timeout=2.0) as client:
        while time.perf_counter() < deadline:
            with contextlib.suppress(httpx.HTTPError):
                r = await client.get("/health")
                if r.status_code == 200:
                    return
            await asyncio.sleep(0.25)
    raise RuntimeError(f"Server at {base_url} did not become healthy within {timeout_s}s")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run HTTP Load, Stress, and Endurance benchmarks")
    parser.add_argument("--base-url", default="", help="Target live server URL (omit for isolated local server)")
    parser.add_argument("--label", default="", help="Optional target label recorded in JSON output")
    parser.add_argument(
        "--output",
        default=str(REPO_ROOT / "docs" / "load_test_results.json"),
        help="Path to write JSON results",
    )
    args = parser.parse_args()

    proc: subprocess.Popen | None = None
    tmp_dir: tempfile.TemporaryDirectory | None = None
    base_url = args.base_url.strip().rstrip("/")

    try:
        if not base_url:
            port = _find_free_port()
            base_url = f"http://127.0.0.1:{port}"
            tmp_dir = tempfile.TemporaryDirectory()
            db_path = Path(tmp_dir.name) / "load_bench.db"
            storage_path = Path(tmp_dir.name) / "submissions"
            storage_path.mkdir(parents=True, exist_ok=True)

            env = os.environ.copy()
            env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
            env["SUBMISSION_STORAGE_PATH"] = str(storage_path)
            env["RATE_LIMIT_ENABLED"] = "false"
            env["ENABLE_DEMO_ENDPOINTS"] = "true"
            env["GEMINI_API_KEY"] = ""

            init_cmd = [
                sys.executable,
                "-c",
                "from app.database import Base, engine; import app.models; Base.metadata.create_all(bind=engine)",
            ]
            subprocess.run(init_cmd, cwd=str(BACKEND_DIR), env=env, check=True)

            proc = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
                cwd=str(BACKEND_DIR),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        asyncio.run(_wait_for_server(base_url))
        headers, endpoints = _bootstrap_local_data(base_url)

        async def run_suite() -> list[dict]:
            results = []
            results.append(
                await _run_stage(
                    name="load_normal_10ccu",
                    base_url=base_url,
                    headers=headers,
                    endpoints=endpoints,
                    concurrency=10,
                    total_requests=200,
                )
            )
            results.append(
                await _run_stage(
                    name="stress_burst_30ccu",
                    base_url=base_url,
                    headers=headers,
                    endpoints=endpoints,
                    concurrency=30,
                    total_requests=300,
                )
            )
            results.append(
                await _run_stage(
                    name="stress_peak_60ccu",
                    base_url=base_url,
                    headers=headers,
                    endpoints=endpoints,
                    concurrency=60,
                    total_requests=600,
                )
            )
            results.append(
                await _run_stage(
                    name="endurance_sustained_10s",
                    base_url=base_url,
                    headers=headers,
                    endpoints=endpoints,
                    concurrency=10,
                    duration_seconds=10.0,
                )
            )
            return results

        stages = asyncio.run(run_suite())
        payload = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "target": args.label.strip() or (base_url if args.base_url else "self-contained-uvicorn-single-worker"),
            "stages": stages,
        }
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

        for st in stages:
            print(
                f"{st['stage']}: {st['total_requests']} reqs | "
                f"{st['rps']} RPS | p50={st['p50_ms']}ms p95={st['p95_ms']}ms p99={st['p99_ms']}ms | "
                f"errors={st['error_count']} ({st['error_rate_pct']}%)"
            )
        print(f"Saved results to {out_path}")
    finally:
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        if tmp_dir is not None:
            tmp_dir.cleanup()


if __name__ == "__main__":
    main()
