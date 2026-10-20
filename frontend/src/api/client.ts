import {
  Assignment,
  BatchAiDetectionResponse,
  BatchIngestResponse,
  ClassCohort,
  CodeBertPrediction,
  Course,
  DetailedFeedbackPayload,
  GradeStatus,
  LoginResponse,
  Rubric,
  SimilarityComparison,
  SimilarityReport,
  Submission,
  SubmissionEvidence,
  SubmissionGrade,
  User,
  TestCase,
  GradingJob,
} from '../types';
import {
  demoAssignment,
  demoClass,
  demoCourse,
  demoRubric,
  demoSimilarityReport,
  demoSubmissions,
  demoUser,
  getDemoSubmissionCode,
  getDemoSubmissionEvidence,
  getDemoSubmissionGrade,
  getDemoGradingJobs,
} from '../data/demoFixtures';

export const API_BASE_URL = '/api/v1';
const API_BASE = API_BASE_URL;

export interface DemoUserResponse {
  id: number | string;
  username: string;
  email: string;
  full_name: string;
  role: string;
}

export interface DemoSampleSubmission {
  id: number | string;
  student_name: string;
  student_code: string;
  grade_status: string;
  final_score: number;
}

export interface DemoSeedResponse {
  access_token: string;
  token_type: string;
  user: DemoUserResponse;
  course_id: number | string;
  class_id: number | string;
  assignment_id: number | string;
  sample_submissions: DemoSampleSubmission[];
}

export class ApiError extends Error {
  status: number;
  detail?: any;

  constructor(status: number, message: string, detail?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

export function isDemoModeActive(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem('is_demo_mode') === 'true';
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let detailMessage = `Request failed with status ${res.status}`;
    try {
      const errData = await res.json();
      detailMessage = typeof errData.detail === 'string' ? errData.detail :
        Array.isArray(errData.detail) ? errData.detail.map((item: { msg: string }) => item.msg).join('; ') : detailMessage;
    } catch {
      // Ignored
    }
    throw new ApiError(res.status, detailMessage);
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  auth: {
    loginJson: async (username_or_email: string, password: string): Promise<LoginResponse> => {
      const data = await request<LoginResponse>('/auth/login/json', {
        method: 'POST',
        body: JSON.stringify({ username_or_email, password }),
      });
      setToken(data.access_token);
      return data;
    },
    getMe: async (): Promise<User> => {
      try {
        return await request<User>('/auth/me');
      } catch (err) {
        if (isDemoModeActive()) return demoUser;
        throw err;
      }
    },
    logout: () => {
      setToken(null);
    },
  },

  courses: {
    list: async (): Promise<Course[]> => {
      try {
        const list = await request<Course[]>('/courses');
        if (list && list.length > 0) return list;
        if (isDemoModeActive()) return [demoCourse];
        return list;
      } catch (err) {
        if (isDemoModeActive()) return [demoCourse];
        throw err;
      }
    },
    create: (data: { code: string; name: string; description?: string }): Promise<Course> =>
      request<Course>('/courses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  classes: {
    list: async (courseId: number): Promise<ClassCohort[]> => {
      try {
        const list = await request<ClassCohort[]>(`/courses/${courseId}/classes`);
        if (list && list.length > 0) return list;
        if (isDemoModeActive()) return [demoClass];
        return list;
      } catch (err) {
        if (isDemoModeActive()) return [demoClass];
        throw err;
      }
    },
    create: (
      courseId: number,
      data: { code: string; name: string; semester: string; year: number; description?: string }
    ): Promise<ClassCohort> =>
      request<ClassCohort[] | ClassCohort>(`/courses/${courseId}/classes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ClassCohort>,
  },

  assignments: {
    list: async (courseId: number, classId: number): Promise<Assignment[]> => {
      try {
        const list = await request<Assignment[]>(`/courses/${courseId}/classes/${classId}/assignments`);
        if (list && list.length > 0) return list;
        if (isDemoModeActive()) return [demoAssignment];
        return list;
      } catch (err) {
        if (isDemoModeActive()) return [demoAssignment];
        throw err;
      }
    },
    create: (
      courseId: number,
      classId: number,
      data: { title: string; description?: string; base_code?: string; status?: string; deadline?: string }
    ): Promise<Assignment> =>
      request<Assignment>(`/courses/${courseId}/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: async (courseId: number, classId: number, assignmentId: number): Promise<Assignment> => {
      try {
        return await request<Assignment>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}`);
      } catch (err) {
        if (isDemoModeActive()) return demoAssignment;
        throw err;
      }
    },
    update: (courseId: number, classId: number, assignmentId: number, data: Partial<Assignment>): Promise<Assignment> =>
      request<Assignment>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}`, {
        method: 'PUT', body: JSON.stringify(data),
      }),
  },

  tests: {
    list: (base: string) => request<TestCase[]>(`${base}/test-cases`),
    save: (base: string, data: Omit<TestCase, 'id'>, id?: number) => request<TestCase>(
      `${base}/test-cases${id === undefined ? '' : `/${id}`}`,
      { method: id === undefined ? 'POST' : 'PUT', body: JSON.stringify(data) },
    ),
    remove: (base: string, id: number) => request<void>(`${base}/test-cases/${id}`, { method: 'DELETE' }),
  },
  jobs: {
    list: async (base: string, submissionId: number) => {
      try {
        return await request<GradingJob[]>(`${base}/submissions/${submissionId}/jobs`);
      } catch (err) {
        if (isDemoModeActive()) return getDemoGradingJobs(submissionId);
        throw err;
      }
    },
    get: async (base: string, submissionId: number, id: number) => {
      try {
        return await request<GradingJob>(`${base}/submissions/${submissionId}/jobs/${id}`);
      } catch (err) {
        if (isDemoModeActive()) {
          const jobs = getDemoGradingJobs(submissionId);
          return jobs.find((j) => j.id === id) || jobs[0];
        }
        throw err;
      }
    },
    queue: async (base: string, submissionId: number) => {
      try {
        return await request<GradingJob>(`${base}/submissions/${submissionId}/grade`, { method: 'POST' });
      } catch (err) {
        if (isDemoModeActive()) {
          const jobs = getDemoGradingJobs(submissionId);
          return jobs[0];
        }
        throw err;
      }
    },
  },

  batch: {
    uploadZip: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      file: File
    ): Promise<BatchIngestResponse> => {
      const formData = new FormData();
      formData.append('file', file);
      return request<BatchIngestResponse>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/batch-zip`,
        {
          method: 'POST',
          body: formData,
        }
      );
    },
  },

  submissions: {
    list: async (courseId: number, classId: number, assignmentId: number): Promise<Submission[]> => {
      try {
        const list = await request<Submission[]>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions`);
        if (list && list.length > 0) return list;
        if (isDemoModeActive()) return demoSubmissions;
        return list;
      } catch (err) {
        if (isDemoModeActive()) return demoSubmissions;
        throw err;
      }
    },
    get: async (courseId: number, classId: number, assignmentId: number, submissionId: number): Promise<Submission> => {
      try {
        return await request<Submission>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`);
      } catch (err) {
        if (isDemoModeActive()) {
          const found = demoSubmissions.find((s) => s.id === submissionId || String(s.id) === String(submissionId));
          if (found) return found;
        }
        throw err;
      }
    },
    getSource: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<string> => {
      try {
        const token = getToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE}/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/source`,
          { headers }
        );
        if (!res.ok) throw new ApiError(res.status, 'Failed to fetch source code');
        return await res.text();
      } catch (err) {
        if (isDemoModeActive()) {
          return getDemoSubmissionCode(submissionId);
        }
        throw err;
      }
    },
  },

  evidence: {
    list: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<SubmissionEvidence[]> => {
      try {
        return await request<SubmissionEvidence[]>(
          `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/evidence`
        );
      } catch (err) {
        if (isDemoModeActive()) {
          return getDemoSubmissionEvidence(submissionId);
        }
        throw err;
      }
    },
  },

  rubrics: {
    get: async (courseId: number, classId: number, assignmentId: number): Promise<Rubric> => {
      try {
        return await request<Rubric>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/rubric`);
      } catch (err) {
        if (isDemoModeActive()) return demoRubric;
        throw err;
      }
    },
    create: (courseId: number, classId: number, assignmentId: number, data: any): Promise<Rubric> =>
      request<Rubric>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/rubric`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (courseId: number, classId: number, assignmentId: number, data: any): Promise<Rubric> =>
      request<Rubric>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/rubric`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    evaluateGrade: (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<SubmissionGrade> =>
      request<SubmissionGrade>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/evaluate-grade`,
        { method: 'POST' }
      ),
    getGrade: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<SubmissionGrade> => {
      try {
        return await request<SubmissionGrade>(
          `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/grade`
        );
      } catch (err) {
        if (isDemoModeActive()) {
          return getDemoSubmissionGrade(submissionId);
        }
        throw err;
      }
    },
    overrideGrade: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number,
      data: {
        final_total_score?: number;
        status?: GradeStatus;
        feedback_summary?: string;
        criterion_overrides?: Array<{ criterion_id: number; final_score: number; justification?: string }>;
      }
    ): Promise<SubmissionGrade> => {
      try {
        return await request<SubmissionGrade>(
          `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        );
      } catch (err) {
        if (isDemoModeActive()) {
          const base = getDemoSubmissionGrade(submissionId);
          return {
            ...base,
            status: data.status || 'confirmed',
            final_total_score: data.final_total_score !== undefined ? data.final_total_score : base.final_total_score,
            feedback_summary: data.feedback_summary || base.feedback_summary,
          };
        }
        throw err;
      }
    },
    downloadGradebookCsv: async (courseId: number, classId: number, assignmentId: number): Promise<void> => {
      const token = getToken();
      const response = await fetch(
        `${API_BASE}/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/gradebook-csv`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) {
        throw new ApiError(response.status, `Gradebook export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `gradebook_assignment_${assignmentId}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
    },
  },

  similarity: {
    run: (courseId: number, classId: number, assignmentId: number, threshold = 50.0): Promise<SimilarityReport> =>
      request<SimilarityReport>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/similarity/run`,
        {
          method: 'POST',
          body: JSON.stringify({ threshold }),
        }
      ),
    listReports: async (courseId: number, classId: number, assignmentId: number): Promise<SimilarityReport[]> => {
      try {
        const list = await request<SimilarityReport[]>(
          `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/similarity/reports`
        );
        if (list && list.length > 0) return list;
        if (isDemoModeActive()) return [demoSimilarityReport];
        return list;
      } catch (err) {
        if (isDemoModeActive()) return [demoSimilarityReport];
        throw err;
      }
    },
    getReport: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      reportId: number
    ): Promise<SimilarityReport> => {
      try {
        return await request<SimilarityReport>(
          `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/similarity/reports/${reportId}`
        );
      } catch (err) {
        if (isDemoModeActive()) return demoSimilarityReport;
        throw err;
      }
    },
    reviewComparison: (
      courseId: number,
      classId: number,
      assignmentId: number,
      reportId: number,
      comparisonId: number,
      data: { status: string; review_notes?: string }
    ): Promise<SimilarityComparison> =>
      request<SimilarityComparison>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/similarity/reports/${reportId}/comparisons/${comparisonId}`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      ),
  },

  feedback: {
    generate: (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<{
      submission_id: number;
      submission_grade_id: number;
      status: GradeStatus;
      suggested_total_score: number;
      final_total_score?: number | null;
      feedback_summary?: string;
      detailed_feedback?: DetailedFeedbackPayload;
      citations: string[];
    }> =>
      request(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/feedback/generate`,
        { method: 'POST' }
      ),
    get: (courseId: number, classId: number, assignmentId: number, submissionId: number) =>
      request(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/feedback`
      ),
    update: (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number,
      data: { feedback_summary?: string; detailed_feedback?: any; status?: GradeStatus }
    ) =>
      request(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/feedback`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      ),
    batchGenerate: (courseId: number, classId: number, assignmentId: number) =>
      request(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/batch-generate-feedback`,
        { method: 'POST' }
      ),
  },

  aiDetector: {
    detect: (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<CodeBertPrediction> =>
      request<CodeBertPrediction>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/detect-ai`,
        { method: 'POST' }
      ),
    batchDetect: (
      courseId: number,
      classId: number,
      assignmentId: number
    ): Promise<BatchAiDetectionResponse> =>
      request<BatchAiDetectionResponse>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/batch-detect-ai`,
        { method: 'POST' }
      ),
  },

  demo: {
    seed: (reset?: boolean) =>
      request<DemoSeedResponse>(`/demo/seed${reset ? '?reset=true' : ''}`, { method: 'POST' }),
    reset: () =>
      request<{ status: string; message: string }>('/demo/reset', { method: 'POST' }),
    sampleZip: () => `${API_BASE_URL}/demo/sample-zip`,
  },
};
