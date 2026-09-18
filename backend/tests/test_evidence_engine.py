import io
import zipfile

from app.evidence_engine import (
    generate_static_analysis_evidence,
    generate_test_evidence,
)
from app.models import (
    Assignment,
    AssignmentStatus,
    Cohort,
    Course,
    EvidenceCategory,
    EvidenceSeverity,
    EvidenceSource,
    SubmissionEvidence,
    TestOutcome,
    TestResult,
    TestVisibility,
)
from app.static_analysis import StaticAnalyzer


def test_generate_test_evidence_logic():
    tr1 = TestResult(
        test_case_id=10,
        test_name="test_addition",
        outcome=TestOutcome.PASSED,
        duration_ms=15,
    )
    tr2 = TestResult(
        test_case_id=11,
        test_name="test_edge_case",
        outcome=TestOutcome.FAILED,
        duration_ms=25,
        failure_type="AssertionError",
        failure_detail="assert 0 == 1",
    )

    vis_map = {10: TestVisibility.PUBLIC, 11: TestVisibility.HIDDEN}
    evidence = generate_test_evidence(
        submission_id=1,
        assignment_id=2,
        test_results=[tr1, tr2],
        test_visibility_map=vis_map,
    )

    assert len(evidence) == 2

    ev1 = evidence[0]
    assert ev1.source == EvidenceSource.PYTEST
    assert ev1.category == EvidenceCategory.CORRECTNESS
    assert ev1.severity == EvidenceSeverity.INFO
    assert ev1.rule_code == "TEST_PASSED"
    assert ev1.metric_value == 1.0

    ev2 = evidence[1]
    assert ev2.source == EvidenceSource.PYTEST
    assert ev2.category == EvidenceCategory.ROBUSTNESS
    assert ev2.severity == EvidenceSeverity.ERROR
    assert ev2.rule_code == "AssertionError"
    assert ev2.metric_value == 0.0


def test_generate_static_analysis_evidence_logic():
    code = """import sys

def deeply_nested_function(x):
    if x > 0:
        for i in range(10):
            while x > 5:
                if i % 2 == 0:
                    try:
                        print(i)
                    except Exception:
                        pass
"""
    analyzer = StaticAnalyzer()
    report = analyzer.analyze_source(code)
    evidence = generate_static_analysis_evidence(
        submission_id=5,
        assignment_id=10,
        report=report,
    )

    assert len(evidence) >= 2
    sources = {e.source for e in evidence}
    assert EvidenceSource.AST in sources
    # Should include AST summary record
    summary_ev = [e for e in evidence if e.rule_code == "CODE_METRICS_SUMMARY"]
    assert len(summary_ev) == 1


def test_evidence_persistence_and_api(client, lecturer_token, lecturer_user, db):
    headers = {"Authorization": f"Bearer {lecturer_token}"}

    # Create course, class, assignment via API or DB
    course = Course(code="CS202-EVID", name="Evidence Course", instructor_id=lecturer_user.id)
    db.add(course)
    db.flush()

    cohort = Cohort(code="EV1", name="Evidence Cohort", semester="Spring", year=2026, course_id=course.id)
    db.add(cohort)
    db.flush()

    assignment = Assignment(class_id=cohort.id, title="Evidence Assignment", status=AssignmentStatus.PUBLISHED)
    db.add(assignment)
    db.flush()

    # Upload batch submissions via zip endpoint
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w") as zf:
        zf.writestr("SV2026_student1.py", "def add(a, b): return a + b\n")
    zip_bytes = zip_buf.getvalue()

    batch_resp = client.post(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/submissions/batch-zip",
        headers=headers,
        files={"file": ("submissions.zip", zip_bytes, "application/zip")},
    )
    assert batch_resp.status_code == 200
    batch_data = batch_resp.json()
    assert batch_data["imported_count"] == 1
    sub_id = batch_data["submissions"][0]["submission_id"]

    # Insert mock evidence into DB
    ev = SubmissionEvidence(
        id="ev-uuid-001",
        submission_id=sub_id,
        assignment_id=assignment.id,
        source=EvidenceSource.AST,
        category=EvidenceCategory.COMPLEXITY,
        severity=EvidenceSeverity.INFO,
        rule_code="CODE_METRICS_SUMMARY",
        message="Metrics: 1 LOC",
    )
    db.add(ev)
    db.commit()

    # Query evidence via API as lecturer
    get_resp = client.get(
        f"/api/v1/courses/{course.id}/classes/{cohort.id}/assignments/{assignment.id}/submissions/{sub_id}/evidence",
        headers=headers,
    )
    assert get_resp.status_code == 200
    records = get_resp.json()
    assert len(records) == 1
    assert records[0]["id"] == "ev-uuid-001"
    assert records[0]["rule_code"] == "CODE_METRICS_SUMMARY"
