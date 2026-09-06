import {
  Assignment,
  Course,
  Lecturer,
  LecturerReview,
  Rubric,
  RubricCriterion,
  SimilarityPairDetail,
  SimilarityPairItem,
  SubmissionDetail,
  SubmissionListItem,
  TestCase,
} from '../types';

const BASE_URL = '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('pygrade_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ access_token: string; lecturer: Lecturer }> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(err.detail || 'Login failed');
    }
    return res.json();
  },

  async register(email: string, password: string, full_name: string): Promise<{ access_token: string; lecturer: Lecturer }> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(err.detail || 'Registration failed');
    }
    return res.json();
  },

  async getMe(): Promise<Lecturer> {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to get lecturer profile');
    return res.json();
  },

  // Courses
  async listCourses(): Promise<Course[]> {
    const res = await fetch(`${BASE_URL}/courses`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load courses');
    return res.json();
  },

  async createCourse(code: string, name: string, semester: string): Promise<Course> {
    const res = await fetch(`${BASE_URL}/courses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ code, name, semester }),
    });
    if (!res.ok) throw new Error('Failed to create course');
    return res.json();
  },

  // Assignments
  async listAssignments(courseId: string): Promise<Assignment[]> {
    const res = await fetch(`${BASE_URL}/courses/${courseId}/assignments`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load assignments');
    return res.json();
  },

  async getAssignment(assignmentId: string): Promise<Assignment> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load assignment');
    return res.json();
  },

  async createAssignment(courseId: string, payload: any): Promise<Assignment> {
    const res = await fetch(`${BASE_URL}/courses/${courseId}/assignments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create assignment');
    return res.json();
  },

  async getRubric(assignmentId: string): Promise<Rubric> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/rubric`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load rubric');
    return res.json();
  },

  async updateRubric(assignmentId: string, title: string, criteria: RubricCriterion[]): Promise<Rubric> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/rubric`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, criteria }),
    });
    if (!res.ok) throw new Error('Failed to update rubric');
    return res.json();
  },

  async getTestCases(assignmentId: string): Promise<TestCase[]> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/test-cases`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load test cases');
    return res.json();
  },

  // Submissions & Ingestion
  async uploadBatchSubmissions(assignmentId: string, zipFile: File, rosterFile?: File): Promise<any> {
    const token = localStorage.getItem('pygrade_token');
    const formData = new FormData();
    formData.append('archive_file', zipFile);
    if (rosterFile) {
      formData.append('roster_file', rosterFile);
    }

    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/submissions/upload-batch`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) throw new Error('Batch upload failed');
    return res.json();
  },

  async listSubmissions(assignmentId: string): Promise<SubmissionListItem[]> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/submissions`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load submissions');
    return res.json();
  },

  async getSubmissionDetail(submissionId: string): Promise<SubmissionDetail> {
    const res = await fetch(`${BASE_URL}/submissions/${submissionId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load submission detail');
    return res.json();
  },

  async reEvaluateSubmission(submissionId: string): Promise<SubmissionDetail> {
    const res = await fetch(`${BASE_URL}/submissions/${submissionId}/re-evaluate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to re-evaluate submission');
    return res.json();
  },

  // Similarity
  async runSimilarity(assignmentId: string, threshold: number = 0.40): Promise<any> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/similarity/run?threshold=${threshold}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to run similarity analysis');
    return res.json();
  },

  async getSimilarityMatrix(assignmentId: string, threshold: number = 0.40): Promise<{ flagged_pairs: SimilarityPairItem[] }> {
    const res = await fetch(`${BASE_URL}/assignments/${assignmentId}/similarity/matrix?threshold=${threshold}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load similarity matrix');
    return res.json();
  },

  async getSimilarityPairDetail(pairId: string): Promise<SimilarityPairDetail> {
    const res = await fetch(`${BASE_URL}/similarity/pairs/${pairId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load similarity pair detail');
    return res.json();
  },

  // Review & Overrides
  async submitReview(submissionId: string, payload: {
    final_grade: number;
    grade_adjustments?: Record<string, any>;
    feedback_override?: string;
    status: string;
    internal_notes?: string;
  }): Promise<LecturerReview> {
    const res = await fetch(`${BASE_URL}/submissions/${submissionId}/review`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to submit review');
    return res.json();
  },

  // Export
  getExportGradesUrl(assignmentId: string): string {
    return `${BASE_URL}/assignments/${assignmentId}/export`;
  },
};
