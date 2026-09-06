import io
import zipfile
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def create_sample_zip() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("2011001_NguyenVanA/solution.py", "import sys\ninp = sys.stdin.read().strip()\nprint(f'Hello {inp}')\n")
        zf.writestr("2011002_TranThiB/solution.py", "import sys\nname = sys.stdin.read().strip()\nprint(f'Hello {name}')\n")
    return buf.getvalue()

def test_full_portal_grading_workflow():
    # 1. Register lecturer
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": "dr.smith@university.edu",
        "password": "strongPassword123!",
        "full_name": "Dr. Alan Smith",
    })
    assert reg_resp.status_code == 201
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create course
    course_resp = client.post("/api/v1/courses", headers=headers, json={
        "code": "CS101",
        "name": "Introduction to Python Programming",
        "semester": "Fall 2026",
    })
    assert course_resp.status_code == 201
    course_id = course_resp.json()["id"]

    # 3. Create assignment
    assign_resp = client.post(f"/api/v1/courses/{course_id}/assignments", headers=headers, json={
        "title": "Assignment 1: Greeter",
        "description": "Read name from standard input and output 'Hello <name>'",
        "deadline": "2026-10-01T23:59:59Z",
        "max_score": 10.0,
        "test_cases": [
            {
                "name": "test_basic_greeting",
                "input_data": "World",
                "expected_output": "Hello World",
                "is_hidden": False,
                "weight": 1.0,
            }
        ],
    })
    assert assign_resp.status_code == 201
    assignment_id = assign_resp.json()["id"]

    # 4. Upload batch ZIP submission
    zip_bytes = create_sample_zip()
    files = {
        "archive_file": ("submissions.zip", zip_bytes, "application/zip")
    }
    upload_resp = client.post(
        f"/api/v1/assignments/{assignment_id}/submissions/upload-batch",
        headers=headers,
        files=files,
    )
    assert upload_resp.status_code == 200
    batch_summary = upload_resp.json()
    assert batch_summary["created_count"] == 2

    # 5. List submissions
    list_resp = client.get(f"/api/v1/assignments/{assignment_id}/submissions", headers=headers)
    assert list_resp.status_code == 200
    submissions = list_resp.json()
    assert len(submissions) == 2
    sub_a_id = submissions[0]["id"]

    # 6. Check submission detail
    detail_resp = client.get(f"/api/v1/submissions/{sub_a_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["execution_result"] is not None
    assert detail["execution_result"]["passed_count"] == 1
    assert detail["quality_metric"] is not None
    assert detail["ai_detection_signal"] is not None

    # 7. Run similarity check
    sim_resp = client.post(f"/api/v1/assignments/{assignment_id}/similarity/run?threshold=0.5", headers=headers)
    assert sim_resp.status_code == 200
    sim_data = sim_resp.json()
    assert len(sim_data["flagged_pairs"]) >= 1

    # 8. Submit Lecturer Review (Human-in-the-Loop Override)
    review_resp = client.post(f"/api/v1/submissions/{sub_a_id}/review", headers=headers, json={
        "final_grade": 9.5,
        "status": "APPROVED",
        "feedback_override": "Great structure and clean code.",
        "internal_notes": "Verified in office hours.",
    })
    assert review_resp.status_code == 200
    assert float(review_resp.json()["final_grade"]) == 9.5

    # 9. Export grades CSV
    export_resp = client.get(f"/api/v1/assignments/{assignment_id}/export", headers=headers)
    assert export_resp.status_code == 200
    assert "Student ID,Student Name" in export_resp.text
    assert "2011001" in export_resp.text
