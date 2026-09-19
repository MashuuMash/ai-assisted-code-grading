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
} from '../types';

const API_BASE = '/api/v1';

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
      detailMessage = errData.detail || detailMessage;
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
      return request<User>('/auth/me');
    },
    logout: () => {
      setToken(null);
    },
  },

  courses: {
    list: (): Promise<Course[]> => request<Course[]>('/courses'),
    create: (data: { code: string; name: string; description?: string }): Promise<Course> =>
      request<Course>('/courses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  classes: {
    list: (courseId: number): Promise<ClassCohort[]> =>
      request<ClassCohort[]>(`/courses/${courseId}/classes`),
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
    list: (courseId: number, classId: number): Promise<Assignment[]> =>
      request<Assignment[]>(`/courses/${courseId}/classes/${classId}/assignments`),
    create: (
      courseId: number,
      classId: number,
      data: { title: string; description?: string; base_code?: string; status?: string; deadline?: string }
    ): Promise<Assignment> =>
      request<Assignment>(`/courses/${courseId}/classes/${classId}/assignments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (courseId: number, classId: number, assignmentId: number): Promise<Assignment> =>
      request<Assignment>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}`),
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
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/batch-upload`,
        {
          method: 'POST',
          body: formData,
        }
      );
    },
  },

  submissions: {
    list: (courseId: number, classId: number, assignmentId: number): Promise<Submission[]> =>
      request<Submission[]>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions`),
    get: (courseId: number, classId: number, assignmentId: number, submissionId: number): Promise<Submission> =>
      request<Submission>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}`),
    getSource: async (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<string> => {
      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `${API_BASE}/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/source`,
        { headers }
      );
      if (!res.ok) throw new ApiError(res.status, 'Failed to fetch source code');
      return res.text();
    },
  },

  evidence: {
    list: (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<SubmissionEvidence[]> =>
      request<SubmissionEvidence[]>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/evidence`
      ),
  },

  rubrics: {
    get: (courseId: number, classId: number, assignmentId: number): Promise<Rubric> =>
      request<Rubric>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/rubric`),
    create: (courseId: number, classId: number, assignmentId: number, data: any): Promise<Rubric> =>
      request<Rubric>(`/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/rubric`, {
        method: 'POST',
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
    getGrade: (
      courseId: number,
      classId: number,
      assignmentId: number,
      submissionId: number
    ): Promise<SubmissionGrade> =>
      request<SubmissionGrade>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/grade`
      ),
    overrideGrade: (
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
    ): Promise<SubmissionGrade> =>
      request<SubmissionGrade>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/submissions/${submissionId}/grade`,
        {
          method: 'PUT',
          body: JSON.stringify(data),
        }
      ),
    exportGradebookCsvUrl: (courseId: number, classId: number, assignmentId: number): string =>
      `${API_BASE}/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/gradebook-csv`,
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
    listReports: (courseId: number, classId: number, assignmentId: number): Promise<SimilarityReport[]> =>
      request<SimilarityReport[]>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/similarity/reports`
      ),
    getReport: (
      courseId: number,
      classId: number,
      assignmentId: number,
      reportId: number
    ): Promise<SimilarityReport> =>
      request<SimilarityReport>(
        `/courses/${courseId}/classes/${classId}/assignments/${assignmentId}/similarity/reports/${reportId}`
      ),
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
};
