export type CriterionType = 'FUNCTIONAL_TEST' | 'CODE_QUALITY' | 'AST_STRUCTURE' | 'CUSTOM';
export type SubmissionStatus = 'QUEUED' | 'EXECUTING' | 'ANALYZED' | 'REQUIRES_REVIEW' | 'APPROVED' | 'FLAGGED';
export type ExecutionStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'MEMORY_LIMIT_EXCEEDED' | 'ERROR';
export type ConfidenceTier = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type ReviewStatus = 'APPROVED' | 'MODIFIED' | 'INTERVIEW_REQUESTED';

export interface Lecturer {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Course {
  id: string;
  lecturer_id: string;
  code: string;
  name: string;
  semester: string;
  created_at: string;
  assignment_count?: number;
}

export interface TestCase {
  id: string;
  assignment_id: string;
  name: string;
  description?: string;
  input_data: string;
  expected_output: string;
  is_hidden: boolean;
  weight: number;
  timeout_ms: number;
}

export interface RubricCriterion {
  id?: string;
  rubric_id?: string;
  title: string;
  criterion_type: CriterionType;
  weight: number;
  max_points: number;
  evaluation_config: Record<string, any>;
  order_index: number;
}

export interface Rubric {
  id: string;
  assignment_id: string;
  title: string;
  created_at: string;
  criteria: RubricCriterion[];
}

export interface Assignment {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  deadline: string;
  max_score: number;
  timeout_sec: number;
  memory_limit_mb: number;
  created_at: string;
  test_cases_count?: number;
  submissions_count?: number;
}

export interface SubmissionListItem {
  id: string;
  assignment_id: string;
  student_identifier: string;
  student_name: string;
  submitted_at: string;
  status: SubmissionStatus;
  automated_grade?: number;
  final_grade?: number;
  review_status?: ReviewStatus;
  execution_status?: ExecutionStatus;
  ai_risk_tier?: ConfidenceTier;
  max_similarity?: number;
}

export interface SubmissionFile {
  id: string;
  relative_path: string;
  file_content: string;
}

export interface TestDetail {
  name: string;
  status: 'PASSED' | 'FAILED' | 'ERROR' | 'TIMEOUT';
  duration_ms: number;
  message?: string | null;
}

export interface ExecutionResult {
  id: string;
  status: ExecutionStatus;
  passed_count: number;
  failed_count: number;
  total_count: number;
  execution_time_ms: number;
  test_details: TestDetail[];
}

export interface RuffViolation {
  code: string;
  message: string;
  filename: string;
  location: { row: number; column: number };
  end_location: { row: number; column: number };
}

export interface QualityMetric {
  id: string;
  cyclomatic_complexity_max: number;
  cyclomatic_complexity_avg: number;
  max_nesting_depth: number;
  loc_total: number;
  function_count: number;
  banned_imports_found: string[];
  ruff_violations: RuffViolation[];
}

export interface AIDetectionSignal {
  id: string;
  probability_score: number;
  confidence_tier: ConfidenceTier;
  indicators: Record<string, any>;
  disclaimer: string;
}

export interface AIFeedbackDraft {
  id: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  remediation_steps: string[];
  model_identifier: string;
  created_at: string;
}

export interface LecturerReview {
  id: string;
  reviewer_id?: string;
  automated_grade: number;
  final_grade: number;
  grade_adjustments: Record<string, any>;
  feedback_override?: string;
  status: ReviewStatus;
  internal_notes?: string;
  reviewed_at: string;
  version_id: number;
}

export interface SubmissionDetail {
  id: string;
  assignment_id: string;
  student_identifier: string;
  student_name: string;
  submitted_at: string;
  status: SubmissionStatus;
  files: SubmissionFile[];
  execution_result?: ExecutionResult;
  quality_metric?: QualityMetric;
  ai_detection_signal?: AIDetectionSignal;
  ai_feedback_draft?: AIFeedbackDraft;
  lecturer_review?: LecturerReview;
}

export interface SimilarityPairItem {
  id: string;
  assignment_id: string;
  submission_a_id: string;
  submission_b_id: string;
  student_a_identifier?: string;
  student_a_name?: string;
  student_b_identifier?: string;
  student_b_name?: string;
  similarity_score: number;
  algorithm: string;
  matched_spans: Array<{ a_lines: [number, number]; b_lines: [number, number] }>;
}

export interface SimilarityPairDetail {
  id: string;
  assignment_id: string;
  similarity_score: number;
  algorithm: string;
  matched_spans: Array<{ a_lines: [number, number]; b_lines: [number, number] }>;
  submission_a: {
    id: string;
    student_identifier: string;
    student_name: string;
    code: string;
    raw_archive_hash: string;
    submitted_at: string;
  };
  submission_b: {
    id: string;
    student_identifier: string;
    student_name: string;
    code: string;
    raw_archive_hash: string;
    submitted_at: string;
  };
}
