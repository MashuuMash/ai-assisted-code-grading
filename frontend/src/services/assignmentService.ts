import api from './api';

export type AssignmentStatus = 'draft' | 'published' | 'closed';

export interface Assignment {
  id: number;
  class_id: number;
  title: string;
  description: string | null;
  instructions: string | null;
  language: 'python';
  deadline: string | null;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  original_filename: string;
  size_bytes: number;
  sha256: string;
  submitted_at: string;
}

export interface TestCase {
  id: number;
  assignment_id: number;
  name: string;
  visibility: 'public' | 'hidden';
  content: string | null;
}

export interface TestResult {
  id: number;
  test_case_id: number | null;
  test_name: string;
  visibility: 'public' | 'hidden';
  outcome: 'passed' | 'failed' | 'error';
  duration_ms: number;
  failure_type: string | null;
  failure_detail: string | null;
}

export interface GradingJob {
  id: number;
  submission_id: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  runtime_ms: number | null;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  failure_type: string | null;
  failure_information: string | null;
  runner_output: string | null;
  results: TestResult[];
}

function assignmentPath(courseId: number, classId: number): string {
  return `/courses/${courseId}/classes/${classId}/assignments`;
}

export const assignmentService = {
  async list(courseId: number, classId: number): Promise<Assignment[]> {
    return (await api.get<Assignment[]>(assignmentPath(courseId, classId))).data;
  },
  async create(
    courseId: number,
    classId: number,
    data: Pick<Assignment, 'title' | 'description' | 'instructions' | 'language' | 'deadline' | 'status'>
  ): Promise<Assignment> {
    return (await api.post<Assignment>(assignmentPath(courseId, classId), data)).data;
  },
  async update(
    courseId: number,
    classId: number,
    assignmentId: number,
    data: Partial<Pick<Assignment, 'title' | 'description' | 'instructions' | 'deadline' | 'status'>>
  ): Promise<Assignment> {
    return (await api.patch<Assignment>(`${assignmentPath(courseId, classId)}/${assignmentId}`, data)).data;
  },
  async remove(courseId: number, classId: number, assignmentId: number): Promise<void> {
    await api.delete(`${assignmentPath(courseId, classId)}/${assignmentId}`);
  },
  async listSubmissions(courseId: number, classId: number, assignmentId: number): Promise<Submission[]> {
    return (
      await api.get<Submission[]>(`${assignmentPath(courseId, classId)}/${assignmentId}/submissions`)
    ).data;
  },
  async submit(courseId: number, classId: number, assignmentId: number, source: File): Promise<Submission> {
    const body = new FormData();
    body.append('source', source);
    return (
      await api.post<Submission>(`${assignmentPath(courseId, classId)}/${assignmentId}/submissions`, body)
    ).data;
  },
  async downloadSource(courseId: number, classId: number, assignmentId: number, submission: Submission) {
    const response = await api.get<Blob>(
      `${assignmentPath(courseId, classId)}/${assignmentId}/submissions/${submission.id}/source`,
      { responseType: 'blob' }
    );
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = submission.original_filename;
    link.click();
    URL.revokeObjectURL(url);
  },
  async listTests(courseId: number, classId: number, assignmentId: number): Promise<TestCase[]> {
    return (await api.get<TestCase[]>(`${assignmentPath(courseId, classId)}/${assignmentId}/test-cases`)).data;
  },
  async createTest(
    courseId: number,
    classId: number,
    assignmentId: number,
    data: Pick<TestCase, 'name' | 'visibility'> & { content: string }
  ): Promise<TestCase> {
    return (await api.post<TestCase>(`${assignmentPath(courseId, classId)}/${assignmentId}/test-cases`, data)).data;
  },
  async triggerGrading(courseId: number, classId: number, assignmentId: number, submissionId: number) {
    return (
      await api.post<GradingJob>(
        `${assignmentPath(courseId, classId)}/${assignmentId}/submissions/${submissionId}/grading-jobs`
      )
    ).data;
  },
  async listJobs(courseId: number, classId: number, assignmentId: number, submissionId: number) {
    return (
      await api.get<GradingJob[]>(
        `${assignmentPath(courseId, classId)}/${assignmentId}/submissions/${submissionId}/grading-jobs`
      )
    ).data;
  },
};
