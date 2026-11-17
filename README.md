# VeriPie - AI-Assisted Python Code Grading Workstation

VeriPie is an academic workstation that helps university instructors and teaching assistants ingest Python programming submissions, run automated `pytest` suites inside isolated Docker containers, extract deterministic code-quality and similarity evidence, synthesize evidence-grounded AI feedback drafts, and export confirmed CSV gradebooks.

> **Core Philosophy: Evidence First - AI Second - Human Decision Last.**  
> Automated rubric scores are deterministic (`0.0` variance), AI feedback is strictly grounded in extracted `evidence_id` tags, and AI-generated code detection is surfaced purely as an **experimental advisory signal** rather than proof of authorship.

---

## Key Capabilities

- **Authentication & Account Security**:
  - Role-based JWT authentication (`admin`, `lecturer`, `student`) with Argon2/Bcrypt password hashing.
  - 6-digit HMAC-SHA256 Email OTP verification and Forgot/Reset Password flow via Google SMTP with HTML email templates.
  - Strict username (`3-32` chars, lowercase alphanumeric/dot/underscore) and password strength (`8-72` chars with uppercase, lowercase, digit, and symbol) validation.
  - Account Settings modal for updating display name and changing passwords.
- **Course, Cohort & Rubric Management**:
  - Structured hierarchy: `Course -> Class Cohort -> Assignment` with starter `base_code`, deadlines, and public/hidden `pytest` test cases.
  - Weighted rubric builder (criteria weights summing to `100%`) with template presets and immutability guards once grades exist.
- **Isolated Sandbox Execution & Evidence Extraction**:
  - Ephemeral Docker-out-of-Docker execution (`grading-sandbox:latest`) with `--network none`, `256m` memory cap, `1.0` CPU, `64` PIDs limit, and `10s` timeout.
  - Deterministic static analysis via Python `ast` (cyclomatic complexity, nesting depth) and `ruff`.
- **Similarity & AI Signals**:
  - Structural similarity detection via **JPlag 6.2.0** (Java 21) with starter `base_code` subtraction and automatic Winnowing token fallback.
  - Optional fine-tuned **CodeBERT** AI-style probability signal with heuristic fallback.
- **Grounded AI Feedback & 1-Click Live Demo**:
  - Feedback drafting via Google Gemini (`gemini-2.5-flash`) or OpenAI-compatible API, strictly citing verified `evidence_id` tags, with deterministic rule-based fallback.
  - Interactive 1-Click Live Demo mode on the Showcase Landing Page.

---

## Architecture Overview

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React |
| **Backend API** | FastAPI, SQLAlchemy 2.0 ORM, Alembic, Pydantic v2, PyJWT, pwdlib |
| **Database** | PostgreSQL 16 (production), SQLite in-memory (unit tests) |
| **Worker & Sandbox** | Python queue worker (`app.worker`) + Docker (`grading-sandbox:latest`) |
| **Analysis & AI** | `pytest`, `ruff`, `ast`, JPlag 6.2.0 (Java 21), PyTorch/Transformers (CodeBERT), Google `google-genai` |
| **CI/CD & Hosting** | GitHub Actions (`.github/workflows/ci-cd.yml`), Docker Compose, Nginx + Certbot HTTPS |

For a complete technical breakdown, database schema, API routes, and verified benchmark numbers, see [`REPORT.txt`](REPORT.txt).

---

## Quick Start (Local Development with Docker)

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local frontend development)
- Optional: Java 21+ / PowerShell to download JPlag 6.2.0

### 1. Configure Environment & Optional JPlag
```bash
cp .env.example .env
```
Edit `.env` to set `SECRET_KEY`, `GEMINI_API_KEY`, and `SMTP_*` credentials if testing email OTP delivery.

*(Optional)* Download JPlag 6.2.0 (verified by SHA-256) on Windows PowerShell:
```powershell
./scripts/setup_jplag.ps1
```
Or on Linux/macOS:
```bash
mkdir -p tools
curl -fL "https://github.com/jplag/JPlag/releases/download/v6.2.0/jplag-6.2.0-jar-with-dependencies.jar" -o tools/jplag-6.2.0.jar
```
If JPlag is omitted, the platform automatically falls back to the built-in Winnowing token similarity engine.

### 2. Start Backend, Worker, Sandbox & PostgreSQL
```bash
docker compose up --build -d
```
- Backend API: `http://localhost:8000`
- Interactive API Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/health`

The backend automatically waits for PostgreSQL 16 and applies Alembic migrations on startup. Do not delete existing PostgreSQL volumes unless intentionally resetting data.

### 3. Start the Frontend
```bash
cd frontend
npm ci
npm run dev
```
Open `http://localhost:3000` (or the Vite URL printed in the terminal).

### 4. Optional Smoke Test (Disposable Environment)
To run an end-to-end Compose integration check on an isolated project stack (requires JPlag JAR):
```powershell
docker compose -p grading_demo up --build -d
docker compose -p grading_demo exec -e SMOKE_ALLOW_WRITE=1 backend python smoke_compose.py
```
Do not run `smoke_compose.py` against a production database.

---

## Production Deployment & CI/CD

The repository includes a GitHub Actions workflow at `.github/workflows/ci-cd.yml`:
1. **CI (`ci` job)**: Runs on every push to `main` / `V1.2` and pull requests to `main`:
   - Zero-emoji check (`python scripts/check_no_emoji.py`)
   - Backend lint (`ruff check backend scripts`)
   - Backend unit tests (`pytest -m "not docker and not jplag"`)
   - Frontend lint (`npm run lint`) and production build (`npm run build`)
2. **CD (`deploy` job)**: Runs on pushes to `main` (or manual `workflow_dispatch`) when `VPS_HOST`, `VPS_USER`, and `VPS_PASSWORD` repository secrets are configured:
   - Pulls `main` on the Linux VM, rebuilds `frontend/dist` for Nginx, rebuilds/restarts Docker Compose services without touching database volumes, and verifies `/health`.

---

## Testing & Quality Checks

### Backend & Static Checks
```bash
python scripts/check_no_emoji.py
ruff check backend scripts
cd backend && pytest -m "not docker and not jplag" -q
```
*(Docker and JPlag integration tests require the `grading-sandbox:latest` image and `tools/jplag-6.2.0.jar` respectively.)*

### Frontend Build & Lint
```bash
cd frontend
npm ci
npm run lint
npm run build
```

### Playwright End-to-End Tests
```powershell
# Start an isolated backend stack on port 8001 if testing against live API
$env:BACKEND_PORT = '8001'
docker compose -p grading_e2e up --build -d
cd frontend
npx playwright install chromium
npm run test:e2e
Remove-Item Env:BACKEND_PORT
```
Playwright screenshots and traces on failure are saved to `frontend/test-results/` (gitignored).

---

## Honest Limitations

- **No Classroom Field Trial Yet**: All current evaluations and benchmarks reflect technical verification on curated/synthetic datasets and automated E2E suites rather than a live university grading study.
- **Advisory AI Detection**: Without a task-specific fine-tuned checkpoint at `AI_DETECTOR_MODEL_PATH`, AI-style detection uses a heuristic fallback; even with CodeBERT enabled, scores are advisory only and must not be treated as proof of authorship.
- **Similarity vs. Plagiarism**: JPlag and Winnowing detect structural/token overlap, not intent. Instructors must always review highlighted code comparisons alongside the prompt and starter code.
