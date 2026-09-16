# Research Proposal / Graduation Thesis

## AI-Assisted Platform for Programming Assignment Grading, Code Quality Assessment, and Academic Integrity Analysis

**Field:** Software Engineering  
**Location:** Ho Chi Minh City, Vietnam  
**Year:** 2026

---

## 1. Research Background and Problem

Programming assignments require more than checking whether a program executes successfully. Instructors may also need to evaluate edge cases, source-code structure, readability, complexity, documentation, and compliance with assignment requirements. As the number of submissions increases, manually checking all criteria becomes time-consuming and difficult to keep consistent.

This project proposes a platform that automates the parts of programming assessment that can be objectively verified while giving instructors structured evidence for aspects that still require professional judgment.

The central principle is:

> **Evidence First → AI Second → Human Decision Last**

The system should first generate traceable and verifiable evidence. AI is then used to explain that evidence and generate feedback. The instructor retains responsibility for the final grade and any academic-integrity decision.

### Core research problem

The research is not simply about executing code and assigning a score. It focuses on how multiple sources of evidence can be combined into an explainable, verifiable workflow that matches how instructors make grading decisions.

A system that produces only a numerical score or a label such as "cheating" provides insufficient information about why the result was produced. Therefore, the proposed system follows a **human-in-the-loop** approach:

1. Automated modules generate evidence.
2. AI assists with interpretation and feedback.
3. The instructor reviews the evidence.
4. The instructor makes the final decision.

---

## 2. Scope Adjustment

AI-generated-code detection was initially considered an important part of the project. However, the proposal recognizes that this is a difficult research problem because AI-generated code can be modified, refactored, combined with human-written code, or written in styles that resemble generated code.

Therefore, AI-generated-code detection is **not part of the core MVP**. The core system focuses on evidence that can be directly verified:

- Automated test results
- Static-analysis findings
- Rubric evidence
- Source-code similarity

AI-generated-code detection may be implemented as an experimental research module if sufficient time, data, and evaluation resources are available.

Even if implemented, its output should be treated only as a **supporting signal**, not as independent proof of academic misconduct.

---

# 3. Research Objectives

## 3.1 General Objective

To develop and evaluate a platform that supports instructors in grading Python programming assignments by automating verifiable assessment steps, organizing evidence according to a rubric, using AI for explanation and feedback, and providing source-code similarity analysis for academic-integrity review.

## 3.2 Specific Objectives

1. Design workflows for courses/classes, assignments, rubrics, and submissions.
2. Implement secure Python execution using Docker sandboxing.
3. Integrate automated testing with `pytest` and store test evidence.
4. Implement static analysis using Ruff and Python AST.
5. Design customizable rubrics for individual assignments.
6. Calculate suggested grades from evidence and rubric weights.
7. Build an **Evidence Engine** that combines testing, static analysis, similarity, and rubric evidence.
8. Integrate JPlag for source-code similarity analysis within a class/assignment.
9. Implement AI-assisted feedback grounded in evidence rather than allowing AI to determine grades independently.
10. Provide an instructor-review interface for checking, editing, and confirming results.
11. Investigate AI-generated-code detection experimentally if sufficient data is available.

---

# 4. Research Questions

### RQ1
Does combining automated testing and static analysis provide sufficient useful evidence for rubric-based grading?

### RQ2
Can an evidence-first workflow reduce manual checking while maintaining explainability and verifiability?

### RQ3
How can source-code similarity help instructors identify cases that require review when presented together with other evidence?

### RQ4
Can AI generate useful and consistent feedback when it is provided only with evidence produced by verifiable analysis modules?

### RQ5 — Secondary Question
If an AI-generated-code detection module is implemented, how do its accuracy and generalization change according to the data source, code-generation model, prompt, and code transformations/refactoring?

RQ5 is explicitly secondary. The project can still be completed through RQ1–RQ4 if sufficient data or time for the detector is unavailable.

---

# 5. Research Subject, Scope, and Assumptions

## 5.1 Research Subjects

The research focuses on:

- Python programming assignment grading in higher education.
- Automated testing and sandboxed code execution.
- Static analysis and AST-based code analysis.
- Rubric-based grading and evidence-based feedback.
- Source-code similarity and academic-integrity review.
- AI-assisted explanation and feedback.
- Experimental AI-generated-code detection.

## 5.2 Scope

| Area | In Scope | Initially Out of Scope |
|---|---|---|
| Language | Python | Multilingual support in the first version |
| Users | Students, Instructors | — |
| Grading | Automated testing + rubric | Fully autonomous grading |
| Integrity | Similarity + evidence + instructor review | Automatic cheating verdict |
| AI | Feedback + experimental detector | Training an LLM from scratch |
| Integration | JPlag, pytest, Ruff, Docker | Full LMS replacement |
| Infrastructure | Docker Compose / Linux server or VPS | Kubernetes |

## 5.3 Assumptions

- Assignments are sufficiently well specified to create test cases.
- Instructors can provide or confirm grading rubrics.
- Student source code may legally and institutionally be processed by the system.
- If an AI detector is implemented, the research data has appropriate usage rights and reliable labels.

---

# 6. Theoretical and Technical Foundations

## 6.1 Automated Testing

Automated testing provides the primary correctness evidence.

For Python assignments, `pytest` can collect:

- Pass/fail results
- Exceptions
- Timeouts
- Output
- Public-test results
- Hidden-test results

Hidden tests can evaluate edge cases that students cannot directly optimize against, while the system protects the hidden test implementation and expected outputs.

## 6.2 Static Analysis and Python AST

Static analysis examines source code without executing it.

**Ruff** can provide rule-based findings such as unused imports and other programming/style issues.

**Python AST** can provide structural information such as:

- Number of functions/classes
- Number of branches
- Loop structures
- Nesting depth
- Selected structural patterns

AST metrics do not independently determine whether code is "good" or "bad." Their interpretation depends on the assignment and rubric.

## 6.3 Source-Code Similarity and JPlag

JPlag is used to identify similarity between programs, including syntax/program-structure similarity rather than simple textual matching.

The MVP prioritizes **same-class similarity**. Historical similarity can be added later by comparing current submissions with submissions from previous classes or semesters.

Similarity should be presented as a **case for review**, not automatically converted into a plagiarism verdict.

## 6.4 CodeBERT and Pretrained Code Models

CodeBERT is a pretrained representation model for programming and natural language. It can be fine-tuned for downstream classification tasks.

If used for AI-generated-code detection, CodeBERT should therefore be treated as a pretrained representation model that is adapted to the specific classification task—not as a built-in AI-code detector.

## 6.5 Fine-Tuning

A possible experimental pipeline is:

```text
Human/AI-labeled code
        ↓
Preprocessing
        ↓
Pretrained code model
        ↓
Fine-tuning
        ↓
Classifier
        ↓
Evaluation
```

## 6.6 Minimum Viable Product

The MVP is the smallest implementation that demonstrates the project's core value.

The proposed MVP prioritizes:

- Authentication
- Course/class management
- Assignment management
- Rubrics
- Python submissions
- Docker execution
- pytest grading
- Static analysis
- Suggested grading
- AI feedback
- Current-class similarity
- Instructor review

---

# 7. Conceptual System Model

The proposed workflow is:

```text
Student Submission
        ↓
Secure Execution
        ↓
Automated Testing
        ↓
Static Analysis
        ↓
Rubric Evaluation
        ↓
Evidence Collection
        ↓
AI-Assisted Feedback
        ↓
Instructor Review
```

Academic-integrity analysis connects to the Evidence Engine through similarity analysis:

```text
Submission Set
      ↓
Similarity Analysis
      ↓
Candidate Cases
      ↓
Evidence View
      ↓
Instructor Review
```

There is deliberately **no automatic cheating verdict** in the main workflow.

## Evidence Model

| Evidence Source | Example | Purpose |
|---|---|---|
| Test Evidence | Passed/failed tests, timeout, exception | Correctness |
| Static Analysis | Unused import, dead code, rule violation | Code quality |
| Structural Evidence | Function count, nesting, complexity | Additional context |
| Similarity Evidence | Pairwise similarity, matched regions | Review candidate |
| Rubric Evidence | Criterion achieved/not achieved | Suggested grade |
| AI Feedback | Explanation of evidence | Communication support |

Every evidence item should be traceable to:

- Submission
- Assignment
- Producing module
- Analysis timestamp

---

# 8. Proposed System Architecture

The planned architecture consists of:

| Layer | Technology | Role |
|---|---|---|
| Presentation | React + TypeScript | Student/instructor UI |
| API | Python + FastAPI | Authentication, assignments, submissions, results |
| Persistence | PostgreSQL | Users, courses, assignments, rubrics, submissions, evidence |
| Worker | Background jobs | Long-running tasks |
| Execution | Docker Sandbox | Isolated student-code execution |
| Testing | pytest | Automated grading |
| Static Analysis | Ruff + Python AST | Code-quality evidence |
| Integrity | JPlag | Source-code similarity |
| AI/ML | PyTorch / Hugging Face | Feedback and experimental detector |
| Deployment | Docker Compose / Linux | Packaging and deployment |

## Submission Processing Flow

1. Student uploads source code.
2. Backend validates format and metadata.
3. Submission enters a job queue.
4. A dedicated sandbox is created.
5. Public and hidden tests run with resource limits.
6. Static analysis generates evidence.
7. Similarity analysis is performed when required.
8. Evidence Engine combines the results.
9. Rubric Engine calculates a suggested grade.
10. AI generates evidence-grounded feedback.
11. Instructor reviews, edits, and confirms the result.

---

# 9. Main Functional Modules

## 9.1 Authentication and Authorization

At minimum, the system has two roles:

- **Instructor**
- **Student**

Instructors can manage courses, assignments, rubrics, tests, and submissions. Students can manage and view their own submissions within the permitted scope.

## 9.2 Course/Class Management

A course/class organizes:

- Students
- Assignments
- Submissions
- Similarity-analysis data

Courses and classes should be separated where the same course is delivered across multiple classes or semesters.

## 9.3 Assignment Management

Each assignment stores:

- Description
- Deadline
- Programming language
- Submission structure
- Test configuration
- Rubric
- Integrity-analysis configuration

Assignment templates may be reusable while remaining customizable.

## 9.4 Submission Management

A submission should store:

- Student
- Assignment
- Source artifact
- Version
- Timestamp
- Job status
- Results
- Evidence

Multiple submissions may later be retained for studying the student's revision process.

## 9.5 Instructor Review

The instructor review interface should expose:

- Suggested grade
- Test results
- Static-analysis findings
- Similarity cases
- AI-generated feedback

Each section should allow the instructor to inspect the underlying evidence rather than displaying only a final score.

## 9.6 Student Feedback

Students receive feedback after instructor confirmation where required by the course workflow.

The MVP should prioritize feedback supported by clear evidence, such as failed tests or specific rule violations.

---

# 10. Rubric and Grading Model

Each assignment has its own configurable rubric.

Suggested criteria include:

- Correctness
- Edge Cases / Robustness
- Code Quality
- Documentation / Readability
- Performance / Complexity
- Custom criteria

### Example Rubric

| Criterion | Example Evidence | Example Weight |
|---|---|---:|
| Correctness | Passed/failed tests | 40% |
| Edge Cases / Robustness | Hidden tests, exception handling | 15% |
| Code Quality | Ruff / AST findings | 20% |
| Readability | Naming, structure, documentation | 10% |
| Performance | Runtime / complexity evidence | 15% |

Actual weights are configured by the instructor.

## Suggested Grade

The suggested grade is a decision-support result.

The system should map evidence to rubric criteria and apply configured weights. However, individual warnings should not automatically become fixed point deductions.

For example, an unused import may have little significance in a short assignment, while performance may be critical for an algorithm-optimization assignment.

## Explainability

Every suggested score component should have a reason.

Example:

> "Correctness: 8/10 because 8 of 10 test cases passed; 2 hidden tests failed."

This is more verifiable than a score inferred by an LLM from the entire source code.

---

# 11. Automated Testing and Secure Code Execution

Student source code must be treated as **untrusted code**.

It should not execute directly inside the FastAPI process or on the host system without isolation.

The proposed Docker sandbox should enforce:

- Timeout
- CPU limits
- Memory limits
- Process/thread limits
- Disabled network access
- Filesystem restrictions
- Non-root execution
- Container destruction after execution

### Hidden Tests

Hidden tests should evaluate edge cases while protecting test implementation and expected outputs.

The runner should provide sufficient evidence for instructors without exposing the complete hidden test suite.

### Background Jobs

Code execution and similarity analysis may take significant time. They should run asynchronously.

Possible states:

```text
queued → running → completed
                  ↘ failed
```

### Resource Limits

At minimum:

- Test-run timeout
- CPU limit
- Memory limit
- Process/thread limit
- Network isolation
- Filesystem/output restrictions
- Non-root execution
- Container cleanup
- Appropriate logging without unnecessary sensitive information

---

# 12. Code Quality Analysis

The objective of code-quality analysis is not to replace instructor judgment. It is to identify verifiable signals such as:

- Unused imports
- Dead code
- Code smells
- Excessive structural complexity
- Patterns that reduce readability

## Ruff

Ruff acts as the rule-based static-analysis layer. Findings should be normalized into a common schema for the Evidence Engine.

## Python AST

AST analysis can collect:

- Function/class counts
- Branch counts
- Loop structures
- Nesting depth
- Specific AST patterns

These metrics should be interpreted as supporting evidence rather than independent judgments of code quality.

## Evidence Examples

| Finding | Evidence | Presentation |
|---|---|---|
| Unused import | Import is not used | File + line + rule |
| Dead code | Unused/inaccessible code | File + line + explanation |
| Deep nesting | Nesting exceeds configured threshold | Function + depth |
| Long function | Function exceeds line threshold | Function + line count |
| Complexity | Many branches/conditions | Function + metric |

---

# 13. Source-Code Similarity and Academic Integrity

## 13.1 Same-Class Similarity

This is the priority for the MVP.

For submissions belonging to the same assignment, JPlag can produce pairs with notable similarity. Base code can be used to exclude common instructor-provided framework code.

## 13.2 Historical Similarity

After same-class similarity is stable, the system can compare current submissions with submissions from previous classes or semesters.

## 13.3 Candidate Retrieval

For large numbers of submissions, comparing every possible pair may become expensive.

A later optimization could use:

```text
Normalization
    ↓
Fingerprint / Index
    ↓
Candidate Retrieval
    ↓
Detailed Comparison
```

This is an optimization beyond the initial MVP.

## 13.4 Evidence Presentation

The integrity interface should allow instructors to inspect:

- Related submissions
- Matched code regions
- Similarity measures
- Submission metadata

The system should **not** display a plagiarism label solely from a similarity score.

## 13.5 Similarity vs. Plagiarism

These concepts must remain separate:

- **Similarity** is an observation about how much source code resembles another program.
- **Plagiarism** is a conclusion about academic-rule violations.

Similarity therefore serves as a **review signal**, which instructors can consider alongside other relevant evidence.

External Internet/corpus comparison is a separate problem and is not a core JPlag function in this proposal.

---

# 14. AI-Assisted Feedback and Evidence Engine

## 14.1 Evidence Engine

The Evidence Engine acts as an intermediary between analyzers and AI.

Each analyzer produces evidence using a common schema. The Evidence Engine groups evidence by submission and rubric criterion, then supplies structured context to the AI.

## 14.2 Evidence Schema

| Field | Meaning |
|---|---|
| `submission_id` | Submission that generated the evidence |
| `assignment_id` | Related assignment |
| `source` | Test / Ruff / AST / JPlag / other |
| `type` | Evidence type |
| `severity` | Impact or priority |
| `location` | File / line / function |
| `message` | Human-readable description |
| `raw_data` | Technical trace data |
| `created_at` | Analysis timestamp |

## 14.3 AI Feedback Pipeline

```text
Normalized Evidence
        ↓
Select Evidence Relevant to Rubric Criterion
        ↓
Structured Prompt
        ↓
AI Explanation
        ↓
Output Validation
        ↓
Instructor Editing / Confirmation
        ↓
Published Feedback
```

The AI should explain evidence rather than make unsupported inferences.

## 14.4 AI Guardrails

The system should enforce:

- AI cannot independently conclude plagiarism.
- AI cannot invent test results.
- Correctness claims must trace to test evidence.
- Code-quality claims must trace to rules or metrics.
- AI feedback must be editable.
- Source code and API secrets must not be sent to external services unless system policy permits it.

Student source code should be treated as untrusted input both in the execution layer and in the AI layer, including possible prompt injection through source code or comments.

---

# 15. Experimental AI-Generated-Code Detection

## 15.1 Why It Is Outside the Core MVP

AI-generated-code detection is difficult to make reliable in real educational environments.

Code may be:

- Fully AI-generated
- Partially modified
- Refactored
- Translated
- Combined with human-written code
- Human-written but stylistically similar to generated code

Therefore, strong performance on one dataset does not automatically establish reliability in real-world academic-integrity decisions.

## 15.2 Dataset

If implemented, the dataset should include at least:

- Human-written code
- AI-generated code

AI-generated samples should record metadata such as:

- Model
- Prompt
- Temperature/configuration
- Assignment
- Other generation settings where applicable

Multiple assignments and diverse coding styles should be included to reduce dataset-specific learning.

## 15.3 Experimental Model

A possible binary-classification setup:

```text
Human / AI Code
      ↓
Preprocessing
      ↓
CodeBERT or another pretrained code model
      ↓
Fine-tuning
      ↓
Binary Classifier
      ↓
Evaluation
```

## 15.4 Evaluation

Metrics and experiments include:

- Precision
- Recall
- F1 score
- Confusion matrix
- Cross-model evaluation
- Cross-prompt evaluation
- Format/refactoring/renaming/modification tests
- Student-like evaluation

## 15.5 Product Use

Even if the experimental module performs well, its output should remain a **signal or confidence estimate**, accompanied by explanatory features where possible.

If results are unstable, the detector should remain a research component and should not enter the primary grading workflow.

---

# 16. Data and Research Methodology

## 16.1 System Data Sources

The research may use:

- Assignment specifications
- Public and hidden tests
- Student submissions that are permitted for research
- Static-analysis findings
- JPlag similarity reports
- Rubrics
- Instructor reviews
- AI-generated-code datasets, if the detector is implemented

## 16.2 Development Method

The project can follow an iterative/incremental approach:

- **P0:** Core workflow
- **P1:** Evidence-based AI feedback and current-class similarity
- **P2:** Historical similarity, indexing, external corpus where appropriate
- **P3:** Experimental AI-generated-code detection

## 16.3 Module-Level Experiments

Each module should have dedicated test data.

### Automated Grading

Include:

- Correct submissions
- Incorrect submissions
- Edge cases
- Malicious/resource-intensive submissions

### Static Analysis

Include code examples both with and without specific findings.

### Similarity

Include:

- Similar code
- Dissimilar code
- Refactored code
- Starter-template code
- Independent implementations

## 16.4 Human Evaluation

Experienced instructors or graders can evaluate:

- Whether evidence is sufficiently clear
- Whether AI feedback is useful
- Whether suggested grades are appropriate
- Whether similarity reports make review faster

---

# 17. System Evaluation Framework

| Component | Metrics / Criteria | Objective |
|---|---|---|
| Automated Testing | Correctness, consistency | Reliable execution and grading |
| Sandbox | Timeout, isolation, resource enforcement | Protect host environment |
| Static Analysis | Rule precision, source location | Accurate evidence |
| Rubric | Traceability, editability | Justified grading |
| Similarity | Known similar/dissimilar cases | Identify review candidates |
| AI Feedback | Factual consistency, usefulness | Grounded feedback |
| AI Detector | Precision, Recall, F1 | Experimental evaluation |
| UX | Task completion, instructor feedback | Usability |

## 17.1 Correctness

Correctness is evaluated against test cases with expected results. Errors should be traceable from the UI to the corresponding result and log.

## 17.2 Explainability

An evidence item is considered explainable if an instructor can answer:

1. What did the system detect?
2. What data supports the detection?
3. How does it affect the rubric?

## 17.3 Performance

Measure:

- Submission-to-result time
- Test execution time
- Static-analysis time
- Similarity-analysis time
- Resource consumption as dataset size increases

These measurements can indicate when candidate retrieval becomes necessary.

## 17.4 AI Feedback

Evaluate:

- Factual consistency
- Completeness
- Clarity
- Editability
- Evidence grounding
- Unsupported claims

Evaluation should not rely only on whether the writing "sounds good."

---

# 18. Security and Risks

## 18.1 Risks from Student Code

Potential threats include:

- Infinite loops
- Memory exhaustion
- Process spawning
- Filesystem abuse
- Network access
- Command execution
- Dependency abuse

## 18.2 Data Risks

Potential risks include exposure of:

- Student source code
- Hidden tests
- Grades/rubrics
- Similarity reports
- API keys
- Data across different classes

## 18.3 AI Risks

Potential risks include:

- Hallucinated feedback
- Unsupported claims
- Prompt injection through source code/comments
- Source-code leakage to external services
- Bias in AI-generated-code detection

## 18.4 Mitigation Principles

The system should apply:

- Sandboxing
- Least privilege
- Network isolation
- Resource limits
- Role-based access control
- Secret management
- Audit logging
- AI-output validation

---

# 19. MVP Scope and Implementation Plan

## 19.1 Priority P0 — Core MVP

- Authentication and roles
- Course/class management
- Assignment management
- Rubrics
- Python submissions
- Secure Docker runner
- pytest grading
- Basic static analysis
- Evidence storage
- Instructor review

## 19.2 Priority P1

- AI-assisted evidence-based feedback
- Current-class JPlag similarity

## 19.3 Priority P2

- Historical similarity
- Candidate indexing/retrieval
- Curated external corpus, if an appropriate dataset is available

## 19.4 Priority P3

- Experimental AI-generated-code detector
- Cross-model and cross-prompt robustness experiments

## 19.5 Development Roadmap

| Phase | Main Work | Output |
|---|---|---|
| G1 | Confirm workflow, rubric, scope | Requirements |
| G2 | Backend, database, authentication, course/assignment | Core API/UI |
| G3 | Submission, Docker, pytest | Secure grading |
| G4 | Ruff, AST, evidence | Code-quality analysis |
| G5 | Rubric, suggested grade, review | Grading workflow |
| G6 | JPlag similarity | Integrity review |
| G7 | AI feedback | Evidence-based feedback |
| G8 | Evaluation and thesis writing | Results + report |
| G9 | AI detector, if feasible | Experimental results |

---

# 20. Expected Contributions

The project is expected to contribute:

1. An evidence-first workflow for programming-assignment grading.
2. An architecture integrating automated testing, static analysis, rubrics, and similarity analysis.
3. An Evidence Engine that grounds AI feedback in verifiable evidence.
4. A secure sandbox pipeline for student source code.
5. An instructor-review interface supporting human-in-the-loop decision making.
6. An empirical evaluation of AI-assisted feedback.
7. If sufficient data is available, an experimental evaluation of AI-generated-code detection.

---

# 21. Limitations

The proposal recognizes several limitations:

- The MVP focuses on Python and therefore does not initially demonstrate multilingual support.
- Static analysis depends on rules and assignment context.
- Similarity analysis cannot determine a student's intent by itself.
- AI feedback depends on the quality of the evidence and the AI model.
- AI-generated-code detection may produce false positives and false negatives and may have limited generalization.
- Evaluation quality depends on access to realistic data and instructors/experienced graders.

---

# 22. Future Development

Potential future directions include:

- Supporting Java, C, and C++.
- LMS integration.
- Historical learning analytics.
- Large-scale candidate retrieval.
- Human-in-the-loop active learning.
- Fine-tuned models for course-specific feedback.
- Analysis of the submission process rather than only the final submission.

---

# 23. Overall Workflow

```text
Student
   ↓
Submit
   ↓
Queue
   ↓
Docker Sandbox
   ↓
pytest
   ↓
Ruff / AST
   ↓
JPlag (if enabled)
   ↓
Evidence Engine
   ↓
Rubric Evaluation
   ↓
Suggested Grade
   ↓
AI Feedback
   ↓
Instructor Review
   ↓
Final Grade / Feedback
```

Academic-integrity branch:

```text
Submission Set
      ↓
Similarity Analysis
      ↓
Candidate Cases
      ↓
Evidence View
      ↓
Instructor Review
```

There is no **Automatic Cheating Verdict** in the main workflow.

---

# 24. Conclusion

This project is designed as an instructor-support platform rather than a replacement for instructors.

Its core value is the automation of objectively verifiable tasks and the organization of their results into structured, traceable evidence. The proposed workflow begins with automated testing, continues through static analysis and rubric evaluation, and then adds source-code similarity and AI-assisted feedback.

The instructor remains responsible for reviewing the evidence and making the final grading and academic-integrity decisions.

This approach provides a practical scope for a software-engineering thesis while creating measurable research dimensions including:

- Correctness
- Security
- Explainability
- Consistency
- Similarity analysis
- Feedback usefulness

AI-generated-code detection remains an optional secondary research direction rather than a requirement for a complete MVP.

---

# 25. Questions to Confirm with the Instructor

Before implementation, the following issues should be confirmed:

1. What is the official Vietnamese and English project title?
2. Which modules are mandatory for the MVP?
3. Does the demo require a complete student portal?
4. Can rubrics be customized for each assignment?
5. Are hidden tests mandatory?
6. How deeply should code quality be evaluated?
7. Is JPlag acceptable as the primary similarity-analysis tool?
8. Is historical similarity a core requirement or an extension?
9. Should AI feedback propose scores or only explain evidence?
10. Should AI-generated-code detection remain a secondary research module or be removed?
11. What submission data may be used for experiments?
12. What evaluation methodology does the instructor expect?
13. What level of security/sandboxing is mandatory for the demo?
14. What are the acceptance criteria for the final product?

---

# 26. Example Evidence Report

| Evidence | Result | Source | Impact |
|---|---|---|---|
| Correctness | 8/10 tests passed | pytest | Rubric: Correctness |
| Edge Case | 2 hidden tests failed | pytest | Rubric: Robustness |
| Unused Import | 1 finding | Ruff | Code Quality |
| Deep Nesting | Depth = 5 | AST | Code Quality |
| Similarity | High pairwise similarity | JPlag | Integrity Review |
| AI Feedback | Explanation generated | LLM + evidence | Feedback |

---

# References

1. JPlag. *JPlag – Detecting Source Code Plagiarism*. GitHub repository.  
   https://github.com/jplag/JPlag

2. JPlag. *Home – JPlag Wiki*. GitHub Wiki.  
   https://github.com/jplag/JPlag/wiki

3. Feng, Z. et al. *CodeBERT: A Pre-Trained Model for Programming and Natural Languages*. Findings of ACL: EMNLP 2020, pp. 1536–1547.  
   https://aclanthology.org/2020.findings-emnlp.139/

4. Suh, H., Tafreshipour, M., Li, J., Bhattiprolu, A., & Ahmed, I. *An Empirical Study on Automatically Detecting AI-Generated Source Code: How Far Are We?* arXiv:2411.04299, 2024.  
   https://arxiv.org/abs/2411.04299

5. Internal group document. *Project Direction*.

6. Internal group document. *Project Analysis and Implementation Direction*.

---

## Key Design Principle

> **Evidence First → AI Second → Human Decision Last**

The platform should help instructors make informed, traceable decisions—not replace those decisions with opaque automated judgments.
