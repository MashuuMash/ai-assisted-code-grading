# Phase 2 — Assignment and Submission System

Phase 2 adds cohort assignments and secure Python source storage. Submitted code is stored as untrusted data
and is never imported, parsed, or executed.

## Assignment lifecycle

Assignments belong to exactly one class/cohort and support `DRAFT`, `PUBLISHED`, and `CLOSED` states.
Lecturers can manage assignments only through courses they own; administrators can manage all assignments.
Students must be members of the target class and cannot see draft assignments.

Only `python` is accepted as the assignment language. Deadlines are optional, timezone-aware timestamps.
Submissions are accepted only while an assignment is published and before its deadline.

## Submission storage

Submission metadata is relational PostgreSQL data. Source bytes are stored outside the database under
`SUBMISSION_STORAGE_PATH`, backed by the `submission_data` Docker volume by default.

Upload safeguards include:

- one `.py` file per request; ZIP and archive uploads are unsupported;
- configurable size limit (`SUBMISSION_MAX_BYTES`, 256 KiB by default);
- accepted source-oriented content types only;
- rejection of path components, null bytes, empty files, and invalid extensions;
- sanitized display filenames;
- random UUID-based internal storage keys;
- resolved-path containment checks;
- SHA-256 and byte-size metadata.

Students can list and download only their own submissions. Authorized course lecturers can list and download
submissions for their assignments. Deleting an assignment, class, or course also removes its source files.

## API additions

Under `/api/v1/courses/{course_id}/classes/{class_id}`:

- CRUD `/assignments`
- `POST /assignments/{assignment_id}/submissions`
- `GET /assignments/{assignment_id}/submissions`
- `GET /assignments/{assignment_id}/submissions/{submission_id}`
- `GET /assignments/{assignment_id}/submissions/{submission_id}/source`

## Explicit boundary

Phase 2 does not execute code and includes no grading, rubric, test runner, static analysis, AI, similarity,
plagiarism, JPlag, or AI-authorship functionality.
