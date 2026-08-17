# AI-Assisted Code Grading Platform

This repository implements Phases 1–3: the platform foundation, assignment/submission workflow, and
secure automated Python testing. Submitted source is executed only by the asynchronous worker inside a
fresh constrained Docker sandbox; it is never executed in the API process.

## Stack

- Python 3.11, FastAPI, SQLAlchemy, Alembic, PostgreSQL
- Argon2 password hashing and expiring signed bearer tokens
- PostgreSQL submission metadata and Docker-volume source storage
- React 18, TypeScript, Vite, React Router
- Docker Compose
- Database-backed grading worker and isolated pytest sandbox

## Start with Docker

Copy `.env.example` to `.env` and replace both example values. `SECRET_KEY` must contain at least 32 characters.
Then run:

```bash
docker compose up --build
```

Alembic migrations run before the backend starts. Services are available at:

- Frontend: http://localhost:3000
- API: http://localhost:8000/api/v1
- OpenAPI: http://localhost:8000/docs
- Health: http://localhost:8000/health

Create the first administrator or lecturer after startup:

```bash
docker compose exec backend python -m app.create_user \
  --email admin@example.edu --username admin --full-name "System Administrator" --role admin
```

Public registration is intentionally student-only.

## Local development

Backend configuration is documented in `backend/.env.example`; frontend configuration is documented in
`frontend/.env.example`.

```bash
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\alembic upgrade head
venv\Scripts\uvicorn app.main:app --reload
```

```bash
cd frontend
npm ci
npm start
```

## Quality checks

```bash
cd backend
ruff check .
pytest -q
```

```bash
cd frontend
npm run lint
npm run build
npm audit
```

See [PHASE1_IMPLEMENTATION.md](./PHASE1_IMPLEMENTATION.md) for authorization and endpoint details.
See [PHASE2_IMPLEMENTATION.md](./PHASE2_IMPLEMENTATION.md) for assignment, upload, and storage details.
See [PHASE3_IMPLEMENTATION.md](./PHASE3_IMPLEMENTATION.md) and [docs/SECURITY.md](./docs/SECURITY.md) for
grading operation, sandbox controls, and trust boundaries.
