export type UserRole = 'admin' | 'lecturer' | 'student';

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  instructor_id: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClassCohort {
  id: number;
  course_id: number;
  code: string;
  name: string;
  description?: string | null;
  semester: string;
  year: number;
  is_active: boolean;
  created_at: string;
}

export type AssignmentStatus = 'draft' | 'published' | 'closed';

export interface Assignment {
  id: number;
  class_id: number;
  title: string;
  description?: string | null;
  status: AssignmentStatus;
  deadline?: string | null;
  base_code?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id?: number | null;
  student_identifier: string;
  student_name?: string | null;
  original_filename: string;
  storage_key: string;
  size_bytes: number;
  sha256: string;
  submitted_at: string;
  grade?: SubmissionGrade | null;
}

export type EvidenceSource = 'pytest' | 'ruff' | 'ast' | 'jplag' | 'codebert';
export type EvidenceCategory = 'correctness' | 'robustness' | 'code_quality' | 'complexity' | 'similarity';
export type EvidenceSeverity = 'info' | 'warning' | 'error';

export interface CodeBertPrediction {
  submission_id: number;
  ai_probability: number;
  classification: 'ai_generated' | 'human' | 'inconclusive' | string;
  confidence_score: number;
  model_mode: string;
  signals: string[];
  evidence_id?: string | null;
}

export interface BatchAiDetectionResponse {
  total_analyzed: number;
  high_probability_count: number;
  results: CodeBertPrediction[];
}

export interface SubmissionEvidence {
  id: string;
  submission_id: number;
  assignment_id: number;
  source: EvidenceSource;
  category: EvidenceCategory;
  severity: EvidenceSeverity;
  rule_code: string;
  message: string;
  location?: string | null;
  metric_value?: number | null;
  raw_data?: Record<string, any> | null;
  created_at: string;
}

export type EvaluationType = 'automated_test' | 'code_quality' | 'structural_complexity' | 'manual';
export type GradeStatus = 'pending' | 'draft' | 'confirmed';

export interface RubricCriterion {
  id: number;
  rubric_id: number;
  title: string;
  description?: string | null;
  category: EvidenceCategory;
  evaluation_type: EvaluationType;
  weight_percentage: number;
  max_points: number;
  order_index: number;
  penalty_per_error?: number | null;
  penalty_per_warning?: number | null;
  max_allowed_complexity?: number | null;
  max_allowed_nesting?: number | null;
}

export interface Rubric {
  id: number;
  assignment_id: number;
  title: string;
  description?: string | null;
  max_score: number;
  created_at: string;
  updated_at: string;
  criteria: RubricCriterion[];
}

export interface CriterionScore {
  id: number;
  criterion_id: number;
  suggested_score: number;
  final_score: number;
  is_overridden: boolean;
  justification?: string | null;
  criterion?: RubricCriterion | null;
}

export interface FeedbackImprovementItem {
  evidence_id: string;
  criterion_title?: string | null;
  issue: string;
  suggestion: string;
  severity: EvidenceSeverity;
}

export interface DetailedFeedbackPayload {
  summary: string;
  strengths: string[];
  areas_for_improvement: FeedbackImprovementItem[];
  citations: string[];
}

export interface SubmissionGrade {
  id: number;
  submission_id: number;
  rubric_id: number;
  suggested_total_score: number;
  final_total_score?: number | null;
  status: GradeStatus;
  feedback_summary?: string | null;
  detailed_feedback?: DetailedFeedbackPayload | null;
  graded_at: string;
  confirmed_by_id?: number | null;
  criterion_scores: CriterionScore[];
}

export type SimilarityStatus = 'queued' | 'running' | 'completed' | 'failed';
export type ComparisonReviewStatus = 'unreviewed' | 'flagged' | 'dismissed';

export interface SimilarityComparison {
  id: number;
  report_id: number;
  submission_a_id: number;
  submission_b_id: number;
  similarity_percentage: number;
  matched_tokens: number;
  status: ComparisonReviewStatus;
  matched_regions?: Array<{ lines_a: [number, number]; lines_b: [number, number] }> | null;
  review_notes?: string | null;
}

export interface SimilarityReport {
  id: number;
  assignment_id: number;
  status: SimilarityStatus;
  threshold_used: number;
  submission_count: number;
  avg_similarity?: number | null;
  max_similarity?: number | null;
  report_path?: string | null;
  error_message?: string | null;
  created_at: string;
  completed_at?: string | null;
  comparisons?: SimilarityComparison[];
}

export interface BatchIngestResponse {
  total_files_extracted: number;
  submissions_created: number;
  skipped_files: number;
  results: Array<{
    filename: string;
    student_id: string;
    student_name?: string | null;
    status: string;
    submission_id?: number | null;
    error?: string | null;
  }>;
}
