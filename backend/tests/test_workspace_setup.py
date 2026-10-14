"""Exercise the API sequence used by the instructor setup forms."""

from fastapi.testclient import TestClient

from tests.conftest import auth_headers


def test_instructor_can_create_course_class_assignment_and_edit_rubric(
    client: TestClient, lecturer_token: str
) -> None:
    headers = auth_headers(lecturer_token)

    course_response = client.post(
        "/api/v1/courses",
        headers=headers,
        json={"code": "SETUP101", "name": "Workspace Setup"},
    )
    assert course_response.status_code == 201
    course_id = course_response.json()["id"]

    class_response = client.post(
        f"/api/v1/courses/{course_id}/classes",
        headers=headers,
        json={"code": "SETA", "name": "Class A", "semester": "Fall", "year": 2026},
    )
    assert class_response.status_code == 201
    class_id = class_response.json()["id"]

    assignment_response = client.post(
        f"/api/v1/courses/{course_id}/classes/{class_id}/assignments",
        headers=headers,
        json={"title": "Python Basics", "status": "draft"},
    )
    assert assignment_response.status_code == 201
    assignment_id = assignment_response.json()["id"]
    assignment_url = f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}"
    updated_assignment = client.put(assignment_url, headers=headers, json={
        "title": "Revised Python Basics", "description": "Description", "instructions": "Instructions",
        "base_code": "def add(a, b): pass", "status": "published", "deadline": "2026-11-20T10:00:00Z",
    })
    assert updated_assignment.status_code == 200
    assert updated_assignment.json()["instructions"] == "Instructions"
    assert updated_assignment.json()["deadline"] is not None
    cleared = client.put(assignment_url, headers=headers, json={"deadline": None})
    assert cleared.status_code == 200
    assert cleared.json()["deadline"] is None

    rubric_url = f"/api/v1/courses/{course_id}/classes/{class_id}/assignments/{assignment_id}/rubric"
    rubric_response = client.post(
        rubric_url,
        headers=headers,
        json={
            "title": "First rubric",
            "max_score": 10,
            "criteria": [
                {
                    "title": "Correctness",
                    "category": "correctness",
                    "evaluation_type": "automated_test",
                    "weight_percentage": 100,
                }
            ],
        },
    )
    assert rubric_response.status_code == 200

    updated_response = client.put(
        rubric_url,
        headers=headers,
        json={
            "title": "Revised rubric",
            "max_score": 20,
            "criteria": [
                {
                    "title": "Tests",
                    "category": "correctness",
                    "evaluation_type": "automated_test",
                    "weight_percentage": 70,
                },
                {
                    "title": "Style",
                    "category": "code_quality",
                    "evaluation_type": "code_quality",
                    "weight_percentage": 30,
                    "config": {"penalty_per_error": 1.0},
                },
            ],
        },
    )
    assert updated_response.status_code == 200
    updated = updated_response.json()
    assert updated["title"] == "Revised rubric"
    assert updated["max_score"] == 20
    assert [item["max_points"] for item in updated["criteria"]] == [14, 6]
    assert updated["criteria"][1]["config"]["penalty_per_error"] == 1.0
