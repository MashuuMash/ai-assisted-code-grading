import React, { FormEvent, useEffect, useState } from 'react';
import {
  Assignment,
  AssignmentStatus,
  GradingJob,
  Submission,
  TestCase,
  assignmentService,
} from '../services/assignmentService';
import { UserResponse } from '../services/authService';
import { Cohort, Course } from '../services/courseService';
import { getErrorMessage } from '../services/errors';

interface Props {
  course: Course;
  cohort: Cohort;
  user: UserResponse;
}

const AssignmentPanel: React.FC<Props> = ({ course, cohort, user }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [tests, setTests] = useState<TestCase[]>([]);
  const [jobs, setJobs] = useState<GradingJob[]>([]);
  const [jobSubmission, setJobSubmission] = useState<number | null>(null);
  const [error, setError] = useState('');
  const canManage = user.role === 'lecturer' || user.role === 'admin';

  const loadAssignments = async () => {
    setAssignments(await assignmentService.list(course.id, cohort.id));
  };

  useEffect(() => {
    setSelected(null);
    setSubmissions([]);
    setTests([]);
    setJobs([]);
    loadAssignments().catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load assignments')));
  }, [course.id, cohort.id]);

  const chooseAssignment = async (assignment: Assignment) => {
    setSelected(assignment);
    setError('');
    try {
      const [submissionValues, testValues] = await Promise.all([
        assignmentService.listSubmissions(course.id, cohort.id, assignment.id),
        assignmentService.listTests(course.id, cohort.id, assignment.id),
      ]);
      setSubmissions(submissionValues);
      setTests(testValues);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to load submissions'));
    }
  };

  const createAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const deadlineValue = String(form.get('deadline'));
    try {
      await assignmentService.create(course.id, cohort.id, {
        title: String(form.get('title')),
        description: String(form.get('description')) || null,
        instructions: String(form.get('instructions')) || null,
        language: 'python',
        deadline: deadlineValue ? new Date(deadlineValue).toISOString() : null,
        status: String(form.get('status')) as AssignmentStatus,
      });
      event.currentTarget.reset();
      await loadAssignments();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to create assignment'));
    }
  };

  const changeStatus = async (status: AssignmentStatus) => {
    if (!selected) return;
    try {
      const updated = await assignmentService.update(course.id, cohort.id, selected.id, { status });
      setSelected(updated);
      await loadAssignments();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to update assignment'));
    }
  };

  const submitSource = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const input = event.currentTarget.elements.namedItem('source') as HTMLInputElement;
    const source = input.files?.[0];
    if (!source) return;
    try {
      await assignmentService.submit(course.id, cohort.id, selected.id, source);
      event.currentTarget.reset();
      setSubmissions(await assignmentService.listSubmissions(course.id, cohort.id, selected.id));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to submit source'));
    }
  };

  const deleteAssignment = async () => {
    if (!selected || !window.confirm(`Delete assignment "${selected.title}" and all of its submissions?`)) return;
    try {
      await assignmentService.remove(course.id, cohort.id, selected.id);
      setSelected(null);
      setSubmissions([]);
      await loadAssignments();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to delete assignment'));
    }
  };

  const createTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    try {
      await assignmentService.createTest(course.id, cohort.id, selected.id, {
        name: String(form.get('name')),
        visibility: String(form.get('visibility')) as 'public' | 'hidden',
        content: String(form.get('content')),
      });
      event.currentTarget.reset();
      setTests(await assignmentService.listTests(course.id, cohort.id, selected.id));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to create test'));
    }
  };

  const loadJobs = async (submissionId: number) => {
    if (!selected) return;
    setJobSubmission(submissionId);
    try {
      setJobs(await assignmentService.listJobs(course.id, cohort.id, selected.id, submissionId));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to load grading results'));
    }
  };

  const triggerGrading = async (submissionId: number) => {
    if (!selected) return;
    try {
      await assignmentService.triggerGrading(course.id, cohort.id, selected.id, submissionId);
      await loadJobs(submissionId);
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to queue grading'));
    }
  };

  return (
    <section className="assignment-panel">
      {error && <div className="error-message">{error}</div>}
      <h2>{cohort.code} assignments</h2>
      {assignments.length === 0 && <p>No visible assignments.</p>}
      <div className="features-grid">
        {assignments.map((assignment) => (
          <button key={assignment.id} className="feature-card" onClick={() => chooseAssignment(assignment)}>
            <h3>{assignment.title}</h3>
            <p>{assignment.status} · Python</p>
          </button>
        ))}
      </div>

      {canManage && (
        <form className="phase-form" onSubmit={createAssignment}>
          <h3>Create assignment</h3>
          <input name="title" placeholder="Assignment title" required maxLength={255} />
          <textarea name="description" placeholder="Description" maxLength={20000} />
          <textarea name="instructions" placeholder="Instructions" maxLength={50000} />
          <label>Deadline (optional)<input name="deadline" type="datetime-local" /></label>
          <label>Status
            <select name="status" defaultValue="draft">
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <button type="submit">Create assignment</button>
        </form>
      )}

      {selected && (
        <article className="assignment-detail">
          <h3>{selected.title}</h3>
          {selected.description && <p>{selected.description}</p>}
          {selected.instructions && <pre className="instructions">{selected.instructions}</pre>}
          <p>Language: Python</p>
          <p>Deadline: {selected.deadline ? new Date(selected.deadline).toLocaleString() : 'None'}</p>
          <p>Status: {selected.status}</p>
          {canManage && (
            <div className="assignment-actions">
              <label>Status
                <select value={selected.status} onChange={(event) => changeStatus(event.target.value as AssignmentStatus)}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <button className="danger-button" onClick={deleteAssignment}>Delete assignment</button>
            </div>
          )}
          {!canManage && selected.status === 'published' && (
            <form className="phase-form" onSubmit={submitSource}>
              <label>Python source<input name="source" type="file" accept=".py,text/x-python" required /></label>
              <button type="submit">Submit source</button>
            </form>
          )}
          <h4>{canManage ? 'Configured tests' : 'Public test information'}</h4>
          {tests.length === 0 ? <p>No tests are available.</p> : (
            <ul>{tests.map((test) => <li key={test.id}>{test.name} ({test.visibility})</li>)}</ul>
          )}
          {canManage && (
            <form className="phase-form" onSubmit={createTest}>
              <h4>Add pytest test file</h4>
              <input name="name" placeholder="Test name" required maxLength={255} />
              <select name="visibility" defaultValue="public">
                <option value="public">Public</option><option value="hidden">Hidden</option>
              </select>
              <textarea name="content" placeholder="import solution\n\ndef test_answer(): ..." required maxLength={50000} />
              <button type="submit">Add test</button>
            </form>
          )}
          <h4>{canManage ? 'Student submissions' : 'Your submissions'}</h4>
          {submissions.length === 0 ? <p>No submissions.</p> : (
            <ul className="submission-list">
              {submissions.map((submission) => (
                <li key={submission.id}>
                  <span>{submission.original_filename} · student #{submission.student_id} · {submission.size_bytes} bytes · {new Date(submission.submitted_at).toLocaleString()}</span>
                  <button onClick={() => assignmentService.downloadSource(course.id, cohort.id, selected.id, submission)}>
                    Download
                  </button>
                  {canManage && <button onClick={() => triggerGrading(submission.id)}>Queue grading</button>}
                  <button onClick={() => loadJobs(submission.id)}>View results</button>
                </li>
              ))}
            </ul>
          )}
          {jobSubmission !== null && (
            <section className="grading-results">
              <h4>Grading jobs for submission #{jobSubmission}</h4>
              <button onClick={() => loadJobs(jobSubmission)}>Refresh</button>
              {jobs.length === 0 ? <p>No grading jobs.</p> : jobs.map((job) => (
                <article key={job.id} className="feature-card">
                  <strong>Job #{job.id}: {job.status}</strong>
                  <p>{job.passed_tests}/{job.total_tests} passed · {job.runtime_ms ?? 0} ms</p>
                  {job.failure_type && <p>Failure: {job.failure_type}</p>}
                  <ul>{job.results.map((result) => (
                    <li key={result.id}>{result.test_name}: {result.outcome}
                      {result.failure_detail && <pre className="instructions">{result.failure_detail}</pre>}
                    </li>
                  ))}</ul>
                </article>
              ))}
            </section>
          )}
        </article>
      )}
    </section>
  );
};

export default AssignmentPanel;
