# Phase 3 security model

Student submissions are untrusted. The API stores them and queues grading work; only the worker can
ask Docker to execute a submission. The FastAPI container never imports or executes submitted code.

## Sandbox controls

Each grading run creates a new container from the pinned project sandbox image. It runs as UID/GID
10001 with all Linux capabilities dropped, `no-new-privileges`, no network, a read-only root filesystem,
and configured CPU, memory, PID, wall-clock, log, and report limits. The only writable locations are an
ephemeral `/tmp` tmpfs and an anonymous grading workspace volume. The volume contains only the current
submission and that assignment's tests; it is removed with the container. No host directory, Docker
socket, database credential, application secret, or other submission is mounted into the grading
container.

The worker needs Docker-socket access and is therefore a trusted infrastructure boundary. Restrict
worker deployment and Docker daemon access to administrators. The short-lived workspace preparation
container handles project-generated files only and never runs student code.

## Authorization and disclosure

Only a course owner, an assigned lecturer, or an administrator may manage tests, queue jobs, and inspect
all results. Students can read grading jobs only for their own submissions in classes where they remain
members. Every lookup is constrained through course, class, assignment, and submission relationships to
prevent IDOR.

Hidden test source, identifiers, names, failure details, runner logs, and infrastructure details are not
returned to students. Students receive only a neutral hidden-test label and its outcome/duration.

## Failure handling and limits

Jobs use explicit `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, and `TIMEOUT` states with timestamps and
safe failure metadata. Assertion failures, syntax errors, runtime/collection errors, timeouts, and runner
infrastructure failures remain distinguishable. The API prevents concurrent active jobs for one
submission and caps test count/content; upload limits are inherited from Phase 2.

## Known boundaries

This phase runs instructor-authored pytest code and student code in the same sandbox process. A hostile
submission can attempt to interfere with in-container pytest behavior, so results are evidence for
lecturer review, not a tamper-proof attestation. Production deployment should additionally isolate the
Docker daemon from other workloads and enforce host-level resource monitoring. Phase 3 does not include
scores, rubrics, static analysis, AI, plagiarism analysis, or execution outside the sandbox.
