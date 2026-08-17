# Phase 1 — Platform Foundation

Phase 1 is limited to authentication, roles, courses, classes/cohorts, and class membership. Assignment,
submission, grading, code execution, AI, and integrity-analysis functionality is intentionally absent.

## Authorization contract

- Public registration always creates a `STUDENT`; the request cannot select a privileged role.
- Administrators can access all Phase 1 courses and classes.
- Lecturers can create courses and manage only courses they own and their nested classes/memberships.
- Students can list and read only courses and classes for which a class membership exists.
- Nested class lookups constrain both `course_id` and `class_id` to prevent cross-course IDOR.
- Only users with the `STUDENT` role can be added to a class membership.

Privileged accounts are provisioned from the backend container or configured environment:

```bash
python -m app.create_user --email lecturer@example.edu --username lecturer \
  --full-name "Course Lecturer" --role lecturer
```

The command prompts for a password and does not accept it as a command-line argument.

## API

All application endpoints are versioned under `/api/v1`:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- CRUD `/api/v1/courses`
- CRUD `/api/v1/courses/{course_id}/classes`
- list/add/remove `/api/v1/courses/{course_id}/classes/{class_id}/memberships`

Interactive OpenAPI documentation is available at `/docs` while the backend is running.

## Data model

The migration creates only `users`, `courses`, `classes`, and `class_memberships`. Foreign keys, lookup
indexes, unique class codes per course, and unique user/class memberships are enforced by PostgreSQL.

## Verification

```bash
make backend-lint
make backend-test
make frontend-lint
make frontend-build
```

The backend suite covers authentication, invalid credentials, protected endpoints, lecturer ownership,
student enrollment access, unauthorized Course/Class access, nested-resource IDOR, role restrictions, and
database constraints.
