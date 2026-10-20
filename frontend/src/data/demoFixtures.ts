import {
  Assignment,
  ClassCohort,
  Course,
  Rubric,
  SimilarityReport,
  Submission,
  SubmissionEvidence,
  SubmissionGrade,
  User,
  GradingJob,
} from '../types';
import { DemoSeedResponse } from '../api/client';

export const DEMO_BASE_CODE = `# Starter template provided by instructor
def is_prime(n: int) -> bool:
    """Check if n is prime."""
    pass


def fibonacci(n: int) -> int:
    """Calculate nth Fibonacci number."""
    pass
`;

export const CODE_1001 = `def is_prime(n: int) -> bool:
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True


def fibonacci(n: int) -> int:
    if n <= 0:
        return 0
    if n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
`;

export const CODE_1002 = `import math
import sys


def is_prime(n: int) -> bool:
    for i in range(2, n):
        if n % i == 0:
            return False
    return True


def fibonacci(n: int) -> int:
    if n < 0:
        return -1
    total = 0
    if n > 0:
        if n > 1:
            if n > 2:
                if n > 3:
                    if n > 4:
                        total = 5
    return total
`;

export const CODE_1003 = `def is_prime(number: int) -> bool:
    if number < 2:
        return False
    for divisor in range(2, int(number**0.5) + 1):
        if number % divisor == 0:
            return False
    return True


def fibonacci(count: int) -> int:
    if count <= 0:
        return 0
    if count == 1:
        return 1
    val_x, val_y = 0, 1
    for _ in range(2, count + 1):
        val_x, val_y = val_y, val_x + val_y
    return val_y
`;

export const demoUser: User = {
  id: 1,
  username: 'demo_lecturer',
  email: 'demo_lecturer@university.edu',
  full_name: 'Demo Lecturer',
  role: 'lecturer',
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

export const demoCourse: Course = {
  id: 101,
  code: 'CS102-DEMO',
  name: 'Data Structures & Algorithms',
  description: 'Demonstration course for AI-Assisted Code Grading',
  instructor_id: 1,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const demoClass: ClassCohort = {
  id: 201,
  course_id: 101,
  code: 'C01-DEMO',
  name: 'Class C01 - Spring 2026',
  semester: 'Spring',
  year: 2026,
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
};

export const demoAssignment: Assignment = {
  id: 301,
  class_id: 201,
  title: 'Assignment 1: Prime and Fibonacci Analysis (CS102)',
  description: 'Implement algorithms to analyze prime numbers and compute Fibonacci terms.',
  instructions: 'Implement is_prime and fibonacci according to the specifications.',
  status: 'published',
  deadline: '2026-06-30T23:59:59Z',
  base_code: DEMO_BASE_CODE,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const demoRubric: Rubric = {
  id: 401,
  assignment_id: 301,
  title: 'Assignment 1 Comprehensive Rubric',
  description: 'Four-pillar evaluation covering correctness, robustness, style, and complexity.',
  max_score: 10.0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  criteria: [
    {
      id: 501,
      rubric_id: 401,
      title: 'Automated Tests',
      description: 'Evaluates public test cases verifying basic prime and Fibonacci logic.',
      category: 'correctness',
      evaluation_type: 'automated_test',
      weight_percentage: 40.0,
      max_points: 4.0,
      order_index: 0,
    },
    {
      id: 502,
      rubric_id: 401,
      title: 'Edge Cases & Robustness',
      description: 'Evaluates hidden test cases covering negative inputs and large bounds.',
      category: 'robustness',
      evaluation_type: 'automated_test',
      weight_percentage: 20.0,
      max_points: 2.0,
      order_index: 1,
    },
    {
      id: 503,
      rubric_id: 401,
      title: 'Code Quality',
      description: 'Static analysis diagnostics from Ruff detecting style and unused imports.',
      category: 'code_quality',
      evaluation_type: 'code_quality',
      weight_percentage: 20.0,
      max_points: 2.0,
      config: { penalty_per_error: 0.5, penalty_per_warning: 0.5 },
      order_index: 2,
    },
    {
      id: 504,
      rubric_id: 401,
      title: 'Structural Complexity',
      description: 'AST complexity analysis checking block nesting and cognitive load.',
      category: 'complexity',
      evaluation_type: 'structural_complexity',
      weight_percentage: 20.0,
      max_points: 2.0,
      config: { penalty_per_violation: 0.5 },
      order_index: 3,
    },
  ],
};

export const demoSubmissions: Submission[] = [
  {
    id: 1001,
    assignment_id: 301,
    student_id: 1,
    student_identifier: '1001',
    student_name: 'Nguyen Van An',
    original_filename: 'Nguyen_Van_An_1001_main.py',
    storage_key: 'demo/1001/main.py',
    size_bytes: 382,
    sha256: 'a1001hash',
    submitted_at: '2026-03-01T10:00:00Z',
    grade: {
      status: 'confirmed',
      suggested_total_score: 10.0,
      final_total_score: 10.0,
    },
  },
  {
    id: 1002,
    assignment_id: 301,
    student_id: 2,
    student_identifier: '1002',
    student_name: 'Tran Thi Binh',
    original_filename: 'Tran_Thi_Binh_1002_main.py',
    storage_key: 'demo/1002/main.py',
    size_bytes: 412,
    sha256: 'b1002hash',
    submitted_at: '2026-03-01T11:30:00Z',
    grade: {
      status: 'draft',
      suggested_total_score: 5.5,
      final_total_score: 5.5,
    },
  },
  {
    id: 1003,
    assignment_id: 301,
    student_id: 3,
    student_identifier: '1003',
    student_name: 'Le Van Cuong',
    original_filename: 'Le_Van_Cuong_1003_main.py',
    storage_key: 'demo/1003/main.py',
    size_bytes: 395,
    sha256: 'c1003hash',
    submitted_at: '2026-03-01T12:15:00Z',
    grade: {
      status: 'draft',
      suggested_total_score: 10.0,
      final_total_score: 6.0,
    },
  },
];

export const demoEvidence1001: SubmissionEvidence[] = [
  {
    id: 'ev-1-1',
    submission_id: 1001,
    assignment_id: 301,
    source: 'pytest',
    category: 'correctness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_prime_public' passed in 25ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_prime_public', duration_ms: 25, is_hidden: false },
    created_at: '2026-03-01T10:05:00Z',
  },
  {
    id: 'ev-1-2',
    submission_id: 1001,
    assignment_id: 301,
    source: 'pytest',
    category: 'correctness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_fib_public' passed in 25ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_fib_public', duration_ms: 25, is_hidden: false },
    created_at: '2026-03-01T10:05:00Z',
  },
  {
    id: 'ev-1-3',
    submission_id: 1001,
    assignment_id: 301,
    source: 'pytest',
    category: 'robustness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_prime_hidden' passed in 30ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_prime_hidden', duration_ms: 30, is_hidden: true },
    created_at: '2026-03-01T10:05:00Z',
  },
  {
    id: 'ev-1-4',
    submission_id: 1001,
    assignment_id: 301,
    source: 'pytest',
    category: 'robustness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_fib_hidden' passed in 40ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_fib_hidden', duration_ms: 40, is_hidden: true },
    created_at: '2026-03-01T10:05:00Z',
  },
];

export const demoEvidence1002: SubmissionEvidence[] = [
  {
    id: 'ev-2-1',
    submission_id: 1002,
    assignment_id: 301,
    source: 'pytest',
    category: 'correctness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_prime_public' passed in 20ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_prime_public', duration_ms: 20, is_hidden: false },
    created_at: '2026-03-01T11:35:00Z',
  },
  {
    id: 'ev-2-2',
    submission_id: 1002,
    assignment_id: 301,
    source: 'pytest',
    category: 'correctness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_fib_public' passed in 20ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_fib_public', duration_ms: 20, is_hidden: false },
    created_at: '2026-03-01T11:35:00Z',
  },
  {
    id: 'ev-2-3',
    submission_id: 1002,
    assignment_id: 301,
    source: 'pytest',
    category: 'robustness',
    severity: 'error',
    rule_code: 'AssertionError',
    message: "Test 'test_prime_hidden' failed: assert is_prime(-5) is False",
    metric_value: 0.0,
    raw_data: { test_name: 'test_prime_hidden', failure_type: 'AssertionError', duration_ms: 35, is_hidden: true },
    created_at: '2026-03-01T11:35:00Z',
  },
  {
    id: 'ev-2-4',
    submission_id: 1002,
    assignment_id: 301,
    source: 'pytest',
    category: 'robustness',
    severity: 'error',
    rule_code: 'AssertionError',
    message: "Test 'test_fib_hidden' failed: assert fibonacci(10) == 55",
    metric_value: 0.0,
    raw_data: { test_name: 'test_fib_hidden', failure_type: 'AssertionError', duration_ms: 35, is_hidden: true },
    created_at: '2026-03-01T11:35:00Z',
  },
  {
    id: 'ev-2-5',
    submission_id: 1002,
    assignment_id: 301,
    source: 'ruff',
    category: 'code_quality',
    severity: 'warning',
    rule_code: 'F401',
    message: "'math' imported but unused",
    location: 'main.py:1:8',
    created_at: '2026-03-01T11:35:00Z',
  },
  {
    id: 'ev-2-6',
    submission_id: 1002,
    assignment_id: 301,
    source: 'ruff',
    category: 'code_quality',
    severity: 'warning',
    rule_code: 'F401',
    message: "'sys' imported but unused",
    location: 'main.py:2:8',
    created_at: '2026-03-01T11:35:00Z',
  },
  {
    id: 'ev-2-7',
    submission_id: 1002,
    assignment_id: 301,
    source: 'ast',
    category: 'complexity',
    severity: 'warning',
    rule_code: 'COMPLEXITY_NESTING',
    message: 'Nested block depth of 5 exceeds threshold 4 (depth: 5)',
    location: 'main.py:18',
    metric_value: 5.0,
    created_at: '2026-03-01T11:35:00Z',
  },
];

export const demoEvidence1003: SubmissionEvidence[] = [
  {
    id: 'ev-3-1',
    submission_id: 1003,
    assignment_id: 301,
    source: 'pytest',
    category: 'correctness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_prime_public' passed in 25ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_prime_public', duration_ms: 25, is_hidden: false },
    created_at: '2026-03-01T12:20:00Z',
  },
  {
    id: 'ev-3-2',
    submission_id: 1003,
    assignment_id: 301,
    source: 'pytest',
    category: 'correctness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_fib_public' passed in 25ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_fib_public', duration_ms: 25, is_hidden: false },
    created_at: '2026-03-01T12:20:00Z',
  },
  {
    id: 'ev-3-3',
    submission_id: 1003,
    assignment_id: 301,
    source: 'pytest',
    category: 'robustness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_prime_hidden' passed in 30ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_prime_hidden', duration_ms: 30, is_hidden: true },
    created_at: '2026-03-01T12:20:00Z',
  },
  {
    id: 'ev-3-4',
    submission_id: 1003,
    assignment_id: 301,
    source: 'pytest',
    category: 'robustness',
    severity: 'info',
    rule_code: 'TEST_PASSED',
    message: "Test 'test_fib_hidden' passed in 35ms",
    metric_value: 1.0,
    raw_data: { test_name: 'test_fib_hidden', duration_ms: 35, is_hidden: true },
    created_at: '2026-03-01T12:20:00Z',
  },
  {
    id: 'ev-3-5',
    submission_id: 1003,
    assignment_id: 301,
    source: 'jplag',
    category: 'similarity',
    severity: 'error',
    rule_code: 'HIGH_SIMILARITY_DETECTED',
    message: 'High similarity of 85.0% detected with submission #1001',
    metric_value: 85.0,
    raw_data: {
      matched_submission_id: 1001,
      similarity_percentage: 85.0,
      matched_tokens: 42,
      engine: 'winnowing',
    },
    created_at: '2026-03-01T12:20:00Z',
  },
];

export const demoGrade1001: SubmissionGrade = {
  id: 701,
  submission_id: 1001,
  rubric_id: 401,
  suggested_total_score: 10.0,
  final_total_score: 10.0,
  status: 'confirmed',
  feedback_source: 'rules',
  graded_at: '2026-03-01T10:10:00Z',
  feedback_summary:
    '### AI Feedback Summary\n\nOutstanding work! All automated public and hidden test cases pass cleanly with optimal algorithmic complexity and standard style.',
  detailed_feedback: {
    summary:
      'Outstanding work! All automated tests passed with clean code quality and optimal structural complexity.',
    strengths: [
      'All 4 test cases passed successfully',
      'Optimal iterative algorithm implementations with O(n) / O(sqrt(n)) time',
      'Clean adherence to Python style guidelines',
    ],
    areas_for_improvement: [],
    citations: ['ev-1-1', 'ev-1-2', 'ev-1-3', 'ev-1-4'],
  },
  criterion_scores: [
    {
      id: 801,
      criterion_id: 501,
      suggested_score: 4.0,
      final_score: 4.0,
      is_overridden: false,
      justification: 'Passed 2/2 tests (100.0%) -> 4.0/4.0 points',
      criterion: demoRubric.criteria[0],
    },
    {
      id: 802,
      criterion_id: 502,
      suggested_score: 2.0,
      final_score: 2.0,
      is_overridden: false,
      justification: 'Passed 2/2 tests (100.0%) -> 2.0/2.0 points',
      criterion: demoRubric.criteria[1],
    },
    {
      id: 803,
      criterion_id: 503,
      suggested_score: 2.0,
      final_score: 2.0,
      is_overridden: false,
      justification: 'Found 0 errors, 0 warnings. Deducted 0.00 points -> 2.0/2.0 points',
      criterion: demoRubric.criteria[2],
    },
    {
      id: 804,
      criterion_id: 504,
      suggested_score: 2.0,
      final_score: 2.0,
      is_overridden: false,
      justification: '0 complexity threshold violations detected. Deducted 0.00 points -> 2.0/2.0 points',
      criterion: demoRubric.criteria[3],
    },
  ],
};

export const demoGrade1002: SubmissionGrade = {
  id: 702,
  submission_id: 1002,
  rubric_id: 401,
  suggested_total_score: 5.5,
  final_total_score: 5.5,
  status: 'draft',
  feedback_source: 'rules',
  graded_at: '2026-03-01T11:40:00Z',
  feedback_summary:
    '### AI Feedback Summary\n\nThe submission implements core components of Assignment 1: Prime and Fibonacci Analysis but failed 2 test case(s). Review edge cases and code quality diagnostics.',
  detailed_feedback: {
    summary:
      'The submission implements core components of Assignment 1: Prime and Fibonacci Analysis but failed 2 test case(s). Review edge cases and code quality diagnostics.',
    strengths: [
      'Passed public correctness tests for basic positive numbers',
      'Function signatures match assignment interface',
    ],
    areas_for_improvement: [
      {
        evidence_id: 'ev-2-3',
        criterion_title: 'Edge Cases & Robustness',
        issue: 'Negative number prime test failed (assert is_prime(-5) is False)',
        suggestion: 'Ensure is_prime validates numbers less than 2 immediately.',
        severity: 'error',
      },
      {
        evidence_id: 'ev-2-4',
        criterion_title: 'Edge Cases & Robustness',
        issue: 'Fibonacci calculation failed for n=10 (assert fibonacci(10) == 55)',
        suggestion: 'Review loop termination conditions and recurrence relation.',
        severity: 'error',
      },
      {
        evidence_id: 'ev-2-5',
        criterion_title: 'Code Quality',
        issue: 'Unused import: math',
        suggestion: 'Remove unused imports to avoid namespace pollution.',
        severity: 'warning',
      },
      {
        evidence_id: 'ev-2-6',
        criterion_title: 'Code Quality',
        issue: 'Unused import: sys',
        suggestion: 'Remove unused imports to avoid namespace pollution.',
        severity: 'warning',
      },
      {
        evidence_id: 'ev-2-7',
        criterion_title: 'Structural Complexity',
        issue: 'Nested block depth of 5 exceeds threshold 4',
        suggestion: 'Flatten nested conditional branches with early returns or loop constructs.',
        severity: 'warning',
      },
    ],
    citations: ['ev-2-3', 'ev-2-4', 'ev-2-5', 'ev-2-6', 'ev-2-7'],
  },
  criterion_scores: [
    {
      id: 805,
      criterion_id: 501,
      suggested_score: 4.0,
      final_score: 4.0,
      is_overridden: false,
      justification: 'Passed 2/2 tests (100.0%) -> 4.0/4.0 points',
      criterion: demoRubric.criteria[0],
    },
    {
      id: 806,
      criterion_id: 502,
      suggested_score: 0.0,
      final_score: 0.0,
      is_overridden: false,
      justification: 'Passed 0/2 tests (0.0%) -> 0.0/2.0 points',
      criterion: demoRubric.criteria[1],
    },
    {
      id: 807,
      criterion_id: 503,
      suggested_score: 1.0,
      final_score: 1.0,
      is_overridden: false,
      justification: 'Found 0 errors, 2 warnings. Deducted 1.00 points -> 1.0/2.0 points',
      criterion: demoRubric.criteria[2],
    },
    {
      id: 808,
      criterion_id: 504,
      suggested_score: 0.5,
      final_score: 0.5,
      is_overridden: false,
      justification: '3 complexity threshold violations detected. Deducted 1.50 points -> 0.5/2.0 points',
      criterion: demoRubric.criteria[3],
    },
  ],
};

export const demoGrade1003: SubmissionGrade = {
  id: 703,
  submission_id: 1003,
  rubric_id: 401,
  suggested_total_score: 10.0,
  final_total_score: 6.0,
  status: 'draft',
  feedback_source: 'rules',
  graded_at: '2026-03-01T12:25:00Z',
  feedback_summary:
    '### AI Feedback Summary\n\nAll automated test cases passed. However, notable source code similarity (85%) was detected with peer submission #1001. Awaiting instructor review.',
  detailed_feedback: {
    summary:
      'All automated test cases passed. However, notable source code similarity (85%) was detected with peer submission #1001. Awaiting instructor review.',
    strengths: ['All 4 test cases passed successfully'],
    areas_for_improvement: [
      {
        evidence_id: 'ev-3-5',
        criterion_title: 'Academic Integrity Review',
        issue: 'High similarity of 85.0% detected with submission #1001',
        suggestion:
          'Code structure exhibits high similarity with peer solutions; flagged for instructor review.',
        severity: 'warning',
      },
    ],
    citations: ['ev-3-5'],
  },
  criterion_scores: [
    {
      id: 809,
      criterion_id: 501,
      suggested_score: 4.0,
      final_score: 4.0,
      is_overridden: false,
      justification: 'Passed 2/2 tests (100.0%) -> 4.0/4.0 points',
      criterion: demoRubric.criteria[0],
    },
    {
      id: 810,
      criterion_id: 502,
      suggested_score: 2.0,
      final_score: 2.0,
      is_overridden: false,
      justification: 'Passed 2/2 tests (100.0%) -> 2.0/2.0 points',
      criterion: demoRubric.criteria[1],
    },
    {
      id: 811,
      criterion_id: 503,
      suggested_score: 2.0,
      final_score: 2.0,
      is_overridden: false,
      justification: 'Found 0 errors, 0 warnings. Deducted 0.00 points -> 2.0/2.0 points',
      criterion: demoRubric.criteria[2],
    },
    {
      id: 812,
      criterion_id: 504,
      suggested_score: 2.0,
      final_score: 0.0,
      is_overridden: true,
      justification:
        'Instructor override: Deducted 2.0 points due to flagged uncredited similarity with 1001 (85%).',
      criterion: demoRubric.criteria[3],
    },
  ],
};

export const demoSimilarityReport: SimilarityReport = {
  id: 601,
  assignment_id: 301,
  status: 'completed',
  threshold_used: 50.0,
  engine: 'winnowing',
  submission_count: 3,
  avg_similarity: 40.2,
  max_similarity: 85.0,
  created_at: '2026-03-01T12:30:00Z',
  completed_at: '2026-03-01T12:30:05Z',
  comparisons: [
    {
      id: 901,
      report_id: 601,
      submission_a_id: 1001,
      submission_b_id: 1003,
      similarity_percentage: 85.0,
      matched_tokens: 42,
      status: 'flagged',
      review_notes:
        'Flagged: suspected uncredited collaboration between Student 1001 and Student 1003 (85.0% similarity).',
      matched_regions: [{ lines_a: [1, 16], lines_b: [1, 16] }],
    },
    {
      id: 902,
      report_id: 601,
      submission_a_id: 1001,
      submission_b_id: 1002,
      similarity_percentage: 18.0,
      matched_tokens: 10,
      status: 'unreviewed',
      review_notes: null,
      matched_regions: [],
    },
    {
      id: 903,
      report_id: 601,
      submission_a_id: 1002,
      submission_b_id: 1003,
      similarity_percentage: 17.5,
      matched_tokens: 9,
      status: 'unreviewed',
      review_notes: null,
      matched_regions: [],
    },
  ],
};

export const demoSeedResponse: DemoSeedResponse = {
  access_token: 'demo-jwt-token-xyz',
  token_type: 'bearer',
  user: {
    id: 1,
    username: 'demo_lecturer',
    email: 'demo_lecturer@university.edu',
    full_name: 'Demo Lecturer',
    role: 'lecturer',
  },
  course_id: 101,
  class_id: 201,
  assignment_id: 301,
  sample_submissions: [
    {
      id: 1001,
      student_name: 'Nguyen Van An',
      student_code: '1001',
      grade_status: 'confirmed',
      final_score: 10.0,
    },
    {
      id: 1002,
      student_name: 'Tran Thi Binh',
      student_code: '1002',
      grade_status: 'draft',
      final_score: 5.5,
    },
    {
      id: 1003,
      student_name: 'Le Van Cuong',
      student_code: '1003',
      grade_status: 'draft',
      final_score: 6.0,
    },
  ],
};

export function getDemoSubmissionCode(id: number | string): string {
  const normalizedId = String(id).replace(/^sub-/, '');
  if (normalizedId === '1001') return CODE_1001;
  if (normalizedId === '1002') return CODE_1002;
  if (normalizedId === '1003') return CODE_1003;
  return CODE_1001;
}

export function getDemoSubmissionEvidence(id: number | string): SubmissionEvidence[] {
  const normalizedId = String(id).replace(/^sub-/, '');
  if (normalizedId === '1001') return demoEvidence1001;
  if (normalizedId === '1002') return demoEvidence1002;
  if (normalizedId === '1003') return demoEvidence1003;
  return demoEvidence1001;
}

export function getDemoSubmissionGrade(id: number | string): SubmissionGrade {
  const normalizedId = String(id).replace(/^sub-/, '');
  if (normalizedId === '1001') return { ...demoGrade1001 };
  if (normalizedId === '1002') return { ...demoGrade1002 };
  if (normalizedId === '1003') return { ...demoGrade1003 };
  return { ...demoGrade1001 };
}

export const demoJobs1001: GradingJob[] = [
  {
    id: 101,
    status: 'completed',
    created_at: '2026-03-29T10:05:00Z',
    passed_tests: 4,
    total_tests: 4,
    results: [
      { id: 1, test_name: 'test_prime_public', outcome: 'passed' },
      { id: 2, test_name: 'test_fib_public', outcome: 'passed' },
      { id: 3, test_name: 'test_prime_hidden', outcome: 'passed' },
      { id: 4, test_name: 'test_fib_hidden', outcome: 'passed' },
    ],
  },
];

export const demoJobs1002: GradingJob[] = [
  {
    id: 102,
    status: 'completed',
    created_at: '2026-03-29T10:12:00Z',
    passed_tests: 2,
    total_tests: 4,
    results: [
      { id: 1, test_name: 'test_prime_public', outcome: 'failed' },
      { id: 2, test_name: 'test_fib_public', outcome: 'passed' },
      { id: 3, test_name: 'test_prime_hidden', outcome: 'failed' },
      { id: 4, test_name: 'test_fib_hidden', outcome: 'passed' },
    ],
  },
];

export const demoJobs1003: GradingJob[] = [
  {
    id: 103,
    status: 'completed',
    created_at: '2026-03-29T10:20:00Z',
    passed_tests: 4,
    total_tests: 4,
    results: [
      { id: 1, test_name: 'test_prime_public', outcome: 'passed' },
      { id: 2, test_name: 'test_fib_public', outcome: 'passed' },
      { id: 3, test_name: 'test_prime_hidden', outcome: 'passed' },
      { id: 4, test_name: 'test_fib_hidden', outcome: 'passed' },
    ],
  },
];

export function getDemoGradingJobs(id: number | string): GradingJob[] {
  const normalizedId = String(id).replace(/^sub-/, '');
  if (normalizedId === '1001') return [...demoJobs1001];
  if (normalizedId === '1002') return [...demoJobs1002];
  if (normalizedId === '1003') return [...demoJobs1003];
  return [...demoJobs1001];
}

