# Phase 3 — Secure Code Execution and Automated Testing

Phase 3 adds assignment-scoped public/hidden pytest cases, persistent grading jobs and per-test results,
an asynchronous database-backed worker, and a constrained Docker sandbox. Lecturers can manage tests,
queue a submitted Python file, and inspect structured results. Students can inspect results for only
their own submissions; hidden test evidence is redacted.

Build and start the complete system with:

```bash
docker compose up --build
```

The `sandbox-image` service builds the execution image and the `worker` polls PostgreSQL for queued jobs.
Apply migrations manually with `docker compose exec backend alembic upgrade head` when required.

Run normal checks with the commands in the README. Docker integration tests are opt-in because they
create real constrained containers:

```bash
cd backend
RUN_SANDBOX_TESTS=1 pytest tests/test_sandbox_integration.py -q
```

See `docs/SECURITY.md` for trust boundaries, controls, disclosure rules, and known limitations.
