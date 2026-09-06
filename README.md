# PyGrade AI — Lecturer Portal

**Vietnamese Project Title:**
*PHÁT TRIỂN NỀN TẢNG HỖ TRỢ GIẢNG VIÊN CHẤM BÀI LẬP TRÌNH, TÍCH HỢP AI ĐỂ ĐÁNH GIÁ CHẤT LƯỢNG CODE, PHÁT HIỆN SAO CHÉP VÀ HỖ TRỢ PHÁT HIỆN GIAN LẬN HỌC THUẬT*

---

## 1. System Philosophy: Human-in-the-Loop (HITL)

PyGrade AI is an evidence-based grading, code quality evaluation, and academic integrity platform for computer science university instructors.

The system strictly adheres to the principle:
```text
Automation / AI  -->  Deterministic Evidence  -->  Recommendation  -->  Lecturer Review  -->  Final Decision
```

* **No Automated Penalties**: Plagiarism percentages and AI detection heuristics serve as advisory evidence and never issue irreversible grades automatically.
* **Evidence Grounding**: Feedback and recommendations are grounded strictly in execution output, Ruff static linter diagnostics, and AST structural metrics.
* **Lecturer Authority**: The instructor retains full editorial control to override grades, adjust rubric dimensions, or flag submissions for oral defense.

---

## 2. Architecture & Tech Stack

```text
Lecturer Portal (React 18 + TypeScript + Tailwind CSS)
      |
      v
FastAPI Modular Monolith
      |
      +---- PostgreSQL / SQLite (SQLAlchemy 2.0 ORM)
      |
      +---- Isolated Execution Sandbox
      |         |
      |         +---- Docker Runner (--network none, --read-only, non-root user)
      |         +---- Isolated Pytest Harness with execution timeouts
      |
      +---- Code Quality & Static Analysis
      |         |
      |         +---- Python AST Visitor (McCabe complexity, nesting depth, recursion, banned imports)
      |         +---- Ruff Linter Integration (PEP 8 diagnostics, bugbear rules)
      |
      +---- Similarity Engine
      |         |
      |         +---- Tokenization & Identifier Normalization
      |         +---- Rabin-Karp Winnowing Fingerprinting
      |         +---- Pairwise Jaccard Alignment & Side-by-Side Diff Inspector
      |
      +---- AI Integrity & Grounded Feedback
                |
                +---- Heuristic AI Stylometry Analysis (calibrated risk tiers & disclaimers)
                +---- Evidence-Grounded LLM Feedback Drafts
```

---

## 3. Getting Started

### Prerequisites
* Python 3.12+ (or 3.14)
* Node.js v18+
* Docker Desktop (optional for production sandbox containerization)

### Backend Setup
```bash
# 1. Activate virtual environment
python -m venv .venv
.\.venv\Scripts\activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Run test suite
pytest -v

# 4. Start backend API server
uvicorn app.main:app --app-dir backend --reload --port 8000
```
Interactive API documentation will be available at `http://localhost:8000/api/docs`.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to access the Lecturer Portal.

---

## 4. Design System Standards
* **Palette**: Primary `#2563EB`, Background `#F8FAFC`, Borders `#E2E8F0`
* **Typography**: Inter (UI), JetBrains Mono (Code)
* **Strict Rule**: **Zero Emojis**. All indicators, statuses, and navigation elements utilize technical SVG line icons.
