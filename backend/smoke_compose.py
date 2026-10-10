"""Exercise the live API, PostgreSQL, worker, and Docker grader in a local Compose stack."""

import io
import os
import time
import uuid
import zipfile
from pathlib import Path

import httpx
from sqlalchemy import select

from app.auth import get_password_hash
from app.database import SessionLocal
from app.models import User, UserRole


def main() -> None:
    if os.environ.get("SMOKE_ALLOW_WRITE") != "1":
        raise SystemExit("Refusing to seed the database: set SMOKE_ALLOW_WRITE=1 for a disposable local stack.")

    unique = uuid.uuid4().hex[:8]
    username = f"smoke_{unique}"
    password = uuid.uuid4().hex

    with SessionLocal() as db:
        user = User(
            email=f"{username}@example.com",
            username=username,
            full_name="Compose Smoke Test",
            hashed_password=get_password_hash(password),
            role=UserRole.LECTURER,
            is_active=True,
        )
        db.add(user)
        db.commit()

    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=30.0) as client:
        def post(path: str, **kwargs) -> dict:
            response = client.post(path, **kwargs)
            response.raise_for_status()
            return response.json()

        token = post(
            "/api/v1/auth/login/json",
            json={"username_or_email": username, "password": password},
        )["access_token"]
        client.headers["Authorization"] = f"Bearer {token}"

        course = post("/api/v1/courses", json={"code": f"SMOKE-{unique}", "name": "Smoke Test"})
        course_id = course["id"]
        cohort = post(
            f"/api/v1/courses/{course_id}/classes",
            json={"code": "C01", "name": "Smoke Class", "semester": "Fall", "year": 2026},
        )
        class_id = cohort["id"]
        assignment = post(
            f"/api/v1/courses/{course_id}/classes/{class_id}/assignments",
            json={"title": "Add two numbers", "status": "published"},
        )
        base = f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment['id']}"

        post(
            f"{base}/rubric",
            json={
                "title": "Correctness",
                "max_score": 10,
                "criteria": [{
                    "title": "Automated tests",
                    "category": "correctness",
                    "evaluation_type": "automated_test",
                    "weight_percentage": 100,
                }],
            },
        )
        post(
            f"{base}/test-cases",
            json={
                "name": "test_add",
                "visibility": "public",
                "content": "from solution import add\n\ndef test_add():\n    assert add(2, 3) == 5\n",
            },
        )

        archive = io.BytesIO()
        fixture_root = Path(__file__).parent / "tests" / "fixtures" / "jplag"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
            for index in (1, 2):
                source = (fixture_root / f"sub_{index}" / "solution.py").read_text(encoding="utf-8")
                zipped.writestr(
                    f"S100{index}_solution.py",
                    source + "\ndef add(a, b):\n    return a + b\n",
                )
        batch = post(
            f"{base}/submissions/batch-zip",
            files={"file": ("submissions.zip", archive.getvalue(), "application/zip")},
        )
        assert batch["imported_count"] == 2, batch
        submission_id = batch["submissions"][0]["submission_id"]
        job_id = batch["submissions"][0]["job_id"]

        job = None
        for _ in range(30):
            response = client.get(f"{base}/submissions/{submission_id}/jobs/{job_id}")
            response.raise_for_status()
            job = response.json()
            if job["status"] in {"completed", "failed", "timeout"}:
                break
            time.sleep(1)
        assert job is not None and job["status"] == "completed", job
        assert job["passed_tests"] == 1, job

        evidence_response = client.get(f"{base}/submissions/{submission_id}/evidence")
        evidence_response.raise_for_status()
        assert evidence_response.json(), "Worker did not persist evidence"

        grade_response = client.get(f"{base}/submissions/{submission_id}/grade")
        grade_response.raise_for_status()
        grade = grade_response.json()
        assert grade["suggested_total_score"] > 0, grade

        feedback = post(f"{base}/submissions/{submission_id}/feedback/generate")
        assert feedback["feedback_summary"], feedback

        similarity = post(f"{base}/similarity/run", json={"threshold": 50})
        assert similarity["engine"] == "jplag", similarity
        report_response = client.get(f"{base}/similarity/reports/{similarity['id']}")
        report_response.raise_for_status()
        assert report_response.json()["comparisons"], "JPlag did not persist pairwise results"

        csv_response = client.get(f"{base}/gradebook-csv")
        csv_response.raise_for_status()
        assert "S1001" in csv_response.text, csv_response.text

    with SessionLocal() as db:
        assert db.scalar(select(User).where(User.username == username)) is not None

    print(f"PASS: submission={submission_id}, job={job_id}, score={grade['suggested_total_score']}, similarity={similarity['engine']}")
    print(f"Local demo login (disposable stack only): username={username} password={password}")


if __name__ == "__main__":
    main()
