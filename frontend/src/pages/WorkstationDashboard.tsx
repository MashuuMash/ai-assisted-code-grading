import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  FileSearch,
  GraduationCap,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Users,
} from 'lucide-react';
import { api, DemoSeedResponse } from '../api/client';
import { cn } from '../lib/cn';
import { BatchIngestModal } from '../components/BatchIngestModal';
import { CodeViewer, HighlightKind, LineHighlight } from '../components/CodeViewer';
import { EvidenceInspector } from '../components/EvidenceInspector';
import { FeedbackDraftEditor } from '../components/FeedbackDraftEditor';
import { GradeOverridePanel } from '../components/GradeOverridePanel';
import { Navbar } from '../components/Navbar';
import { RubricManager } from '../components/RubricManager';
import { SimilarityWorkbench } from '../components/SimilarityWorkbench';
import { WorkspaceSetup } from '../components/WorkspaceSetup';
import { AssignmentEditor } from '../components/AssignmentEditor';
import { TestCaseManager } from '../components/TestCaseManager';
import { GradingJobPanel } from '../components/GradingJobPanel';
import { DemoWalkthroughBar } from '../components/DemoWalkthroughBar';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { EmptyState } from '../components/EmptyState';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import { useWorkstationKeyboard } from '../hooks/useWorkstationKeyboard';
import {
  CODE_1001,
  demoAssignment,
  demoClass,
  demoCourse,
  demoEvidence1001,
  demoGrade1001,
  demoRubric,
  demoSubmissions,
  getDemoSubmissionCode,
  getDemoSubmissionEvidence,
  getDemoSubmissionGrade,
} from '../data/demoFixtures';
import {
  Assignment,
  ClassCohort,
  Course,
  Rubric,
  Submission,
  SubmissionEvidence,
  SubmissionGrade,
} from '../types';

type ActiveTab = 'setup' | 'assignment' | 'grading' | 'rubric' | 'similarity';

function deriveCodeHighlights(
  code: string,
  evidenceList: SubmissionEvidence[],
  category: string,
  selectedEvidence: SubmissionEvidence | null
): {
  highlights: LineHighlight[];
  summary: { kind: HighlightKind; title: string } | null;
} {
  const lines = code.split('\n');
  const totalLines = lines.length;
  if (totalLines === 0) return { highlights: [], summary: null };

  const targetItems = selectedEvidence
    ? [selectedEvidence]
    : category !== 'all'
    ? evidenceList.filter((e) => e.source === category || e.category === category)
    : [];

  if (targetItems.length === 0) {
    return { highlights: [], summary: null };
  }

  const lineMap = new Map<number, LineHighlight>();

  const addLine = (lineNo: number, kind: HighlightKind, label?: string) => {
    if (lineNo < 1 || lineNo > totalLines) return;
    const existing = lineMap.get(lineNo);
    if (!existing || label) {
      lineMap.set(lineNo, { line: lineNo, kind, label: label || existing?.label });
    }
  };

  for (const item of targetItems) {
    // 1. Similarity (JPlag / Winnowing)
    if (item.source === 'jplag' || item.category === 'similarity') {
      if (item.source === 'codebert') {
        // Handled below in AI Style Signal branch
      } else {
        const simLabel = `Similarity Match (${Math.round(item.metric_value || 0)}%)`;
        const matchedRanges = item.raw_data?.matched_lines;
        if (Array.isArray(matchedRanges) && matchedRanges.length > 0) {
          matchedRanges.forEach((range: number[], rIdx: number) => {
            if (Array.isArray(range) && range.length >= 2) {
              const start = Math.max(1, Number(range[0]));
              const end = Math.min(totalLines, Number(range[1]));
              for (let l = start; l <= end; l++) {
                if (lines[l - 1]?.trim()) {
                  addLine(l, 'similarity', l === start && rIdx === 0 ? simLabel : undefined);
                }
              }
            }
          });
        } else {
          let labeledFirst = false;
          lines.forEach((lineText, idx) => {
            const trimmed = lineText.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              const isDef = trimmed.startsWith('def ');
              addLine(
                idx + 1,
                'similarity',
                !labeledFirst || isDef ? simLabel : undefined
              );
              labeledFirst = true;
            }
          });
        }
        continue;
      }
    }

    // 2. AI Style Signal (CodeBERT)
    if (item.source === 'codebert') {
      const probPct = Math.round((item.metric_value || 0) * 100);
      const aiLabel = `AI Style Signal (${probPct}%)`;
      let inDocstring = false;
      let markedAny = false;

      lines.forEach((lineText, idx) => {
        const trimmed = lineText.trim();
        const lineNo = idx + 1;
        const tripleQuotes = (trimmed.match(/"""|'''/g) || []).length;

        if (tripleQuotes > 0) {
          addLine(lineNo, 'ai', !markedAny ? aiLabel : 'LLM Docstring Pattern');
          markedAny = true;
          if (tripleQuotes === 1) {
            inDocstring = !inDocstring;
          }
          return;
        }
        if (inDocstring) {
          addLine(lineNo, 'ai');
          return;
        }
        if (trimmed.startsWith('def ') && (trimmed.includes('->') || trimmed.includes(':'))) {
          addLine(
            lineNo,
            'ai',
            !markedAny
              ? aiLabel
              : trimmed.includes('->')
              ? 'Type-Annotated Signature'
              : undefined
          );
          markedAny = true;
          return;
        }
        if (trimmed.startsWith('#') && trimmed.length > 18) {
          addLine(lineNo, 'ai', !markedAny ? aiLabel : 'Structured Comment');
          markedAny = true;
          return;
        }
        if ((item.metric_value || 0) >= 0.5 && trimmed && !trimmed.startsWith('import ')) {
          addLine(lineNo, 'ai', !markedAny ? aiLabel : undefined);
          markedAny = true;
        }
      });

      if (!markedAny) {
        lines.forEach((lineText, idx) => {
          if (lineText.trim()) {
            addLine(idx + 1, 'ai', idx === 0 ? aiLabel : undefined);
          }
        });
      }
      continue;
    }

    // 3. Explicit line location (Ruff Linter & AST Complexity)
    const locMatch = item.location?.match(/:(\d+)/);
    const explicitLine = item.raw_data?.line_number
      ? Number(item.raw_data.line_number)
      : locMatch
      ? Number(locMatch[1])
      : null;

    if (explicitLine && explicitLine >= 1 && explicitLine <= totalLines) {
      if (item.source === 'ruff') {
        addLine(explicitLine, 'lint', `Ruff ${item.rule_code}`);
      } else if (item.source === 'ast') {
        const baseIndent = lines[explicitLine - 1]?.search(/\S|$/) ?? 0;
        addLine(explicitLine, 'complexity', `AST ${item.rule_code}`);
        for (let l = explicitLine + 1; l <= Math.min(totalLines, explicitLine + 8); l++) {
          const text = lines[l - 1];
          if (!text.trim()) continue;
          const indent = text.search(/\S|$/);
          if (indent >= baseIndent && baseIndent > 0) {
            addLine(l, 'complexity');
          } else {
            break;
          }
        }
      } else {
        addLine(explicitLine, 'default', item.rule_code);
      }
      continue;
    }

    // 4. Pytest automated test evidence -> highlight tested function block
    if (item.source === 'pytest') {
      const msg = `${item.message} ${item.raw_data?.test_name || ''}`.toLowerCase();
      let matchedFuncStart = -1;
      lines.forEach((lineText, idx) => {
        const m = lineText.match(/^\s*def\s+([a-zA-Z0-9_]+)\s*\(/);
        if (m) {
          const fnName = m[1].toLowerCase();
          const rootToken = fnName.replace(/^is_|^get_|^calculate_|^compute_/, '');
          if (msg.includes(fnName) || (rootToken.length >= 3 && msg.includes(rootToken))) {
            matchedFuncStart = idx + 1;
          }
        }
      });

      if (matchedFuncStart !== -1) {
        const kind: HighlightKind = item.severity === 'error' ? 'similarity' : 'test';
        const label =
          item.severity === 'error'
            ? `Failed: ${item.raw_data?.test_name || item.rule_code}`
            : `Passed: ${item.raw_data?.test_name || item.rule_code}`;
        addLine(matchedFuncStart, kind, label);
        for (let l = matchedFuncStart + 1; l <= totalLines; l++) {
          const text = lines[l - 1];
          if (/^\s*def\s+/.test(text)) break;
          if (text.trim()) {
            addLine(l, kind);
          }
        }
      }
    }
  }

  const highlights = Array.from(lineMap.values()).sort((a, b) => a.line - b.line);
  if (highlights.length === 0) return { highlights: [], summary: null };

  const primaryKind = highlights[0].kind;
  const summaryTitle = selectedEvidence
    ? `${selectedEvidence.rule_code}: ${selectedEvidence.message}`
    : category === 'jplag'
    ? 'Similarity Match Highlight (AST & Token Regions)'
    : category === 'codebert'
    ? 'AI Style Signal Highlight (CodeBERT Stylistic Markers)'
    : category === 'ruff'
    ? 'Ruff Linter Diagnostics Highlight'
    : category === 'ast'
    ? 'AST Structural Complexity Highlight'
    : 'Automated Test Target Function Highlight';

  return {
    highlights,
    summary: { kind: primaryKind, title: summaryTitle },
  };
}

export interface WorkstationDashboardProps {
  isDemoMode?: boolean;
  onExitDemo?: () => void;
  onResetDemo?: () => Promise<void> | void;
  demoData?: DemoSeedResponse | null;
}

export const WorkstationDashboard: React.FC<WorkstationDashboardProps> = ({
  isDemoMode = false,
  onExitDemo,
  onResetDemo,
  demoData: _demoData,
}) => {
  const [demoStage, setDemoStage] = useState<number>(2);
  const [isResettingDemo, setIsResettingDemo] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);

  // Navigation hierarchy
  const [courses, setCourses] = useState<Course[]>(() => (isDemoMode ? [demoCourse] : []));
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(() =>
    isDemoMode ? demoCourse.id : null
  );

  const [classes, setClasses] = useState<ClassCohort[]>(() => (isDemoMode ? [demoClass] : []));
  const [selectedClassId, setSelectedClassId] = useState<number | null>(() =>
    isDemoMode ? demoClass.id : null
  );

  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    isDemoMode ? [demoAssignment] : []
  );
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(() =>
    isDemoMode ? demoAssignment.id : null
  );

  // Assignment data
  const [rubric, setRubric] = useState<Rubric | null>(() => (isDemoMode ? demoRubric : null));
  const [submissions, setSubmissions] = useState<Submission[]>(() =>
    isDemoMode ? demoSubmissions.map((s) => ({ ...s, grade: { ...s.grade! } })) : []
  );
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(() =>
    isDemoMode ? 1001 : null
  );

  // Active submission inspection
  const [submissionCode, setSubmissionCode] = useState<string>(() =>
    isDemoMode ? CODE_1001 : ''
  );
  const [evidenceList, setEvidenceList] = useState<SubmissionEvidence[]>(() =>
    isDemoMode ? demoEvidence1001 : []
  );
  const [submissionGrade, setSubmissionGrade] = useState<SubmissionGrade | null>(() =>
    isDemoMode ? demoGrade1001 : null
  );

  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>('grading');
  const [evidenceCategory, setEvidenceCategory] = useState<string>('all');
  const [selectedEvidence, setSelectedEvidence] = useState<SubmissionEvidence | null>(null);
  const [manualJumpLine, setManualJumpLine] = useState<number | null>(null);
  const [activeDockSection, setActiveDockSection] = useState<'evidence' | 'rubric' | 'feedback'>('evidence');
  const col3ScrollRef = useRef<HTMLDivElement>(null);
  const programmaticScrollUntilRef = useRef<number>(0);

  const scrollToDockSection = (section: 'evidence' | 'rubric' | 'feedback') => {
    setActiveDockSection(section);
    programmaticScrollUntilRef.current = Date.now() + 550;

    const container = col3ScrollRef.current;
    const target =
      container?.querySelector<HTMLElement>(`#dock-${section}`) ??
      document.getElementById(`dock-${section}`);
    if (!target) return;

    if (container && container.scrollHeight > container.clientHeight + 8) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 4;
      container.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'smooth',
      });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [workspaceError, setWorkspaceError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const assignmentRequestId = useRef(0);
  const detailRequestId = useRef(0);

  const clearAssignmentView = () => {
    assignmentRequestId.current += 1;
    detailRequestId.current += 1;
    setRubric(null);
    setSubmissions([]);
    setSelectedSubmissionId(null);
    setSubmissionGrade(null);
    setEvidenceList([]);
    setSubmissionCode('');
    setSearchQuery('');
    setGradeFilter('all');
    setWorkspaceError('');
    setActionError('');
  };

  // 1. Initial Load: Courses
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const list = await api.courses.list();
        setCourses(list);
        if (list.length > 0) {
          setSelectedCourseId(list[0].id);
        } else {
          setActiveTab('setup');
        }
      } catch (err) {
        console.error('Failed to load courses', err);
        setWorkspaceError('Could not load courses. Check your connection and reload the page.');
      }
    };
    loadCourses();
  }, []);

  // 2. Course changed: load classes
  useEffect(() => {
    if (!selectedCourseId) {
      setClasses([]);
      setSelectedClassId(null);
      return;
    }
    const loadClasses = async () => {
      try {
        const list = await api.classes.list(selectedCourseId);
        setClasses(list);
        if (list.length > 0) {
          setSelectedClassId(list[0].id);
        } else {
          setSelectedClassId(null);
        }
      } catch (err) {
        console.error('Failed to load classes', err);
        setWorkspaceError('Could not load classes. Select the course again to retry.');
      }
    };
    loadClasses();
  }, [selectedCourseId]);

  // 3. Class changed: load assignments
  useEffect(() => {
    if (!selectedCourseId || !selectedClassId) {
      setAssignments([]);
      setSelectedAssignmentId(null);
      return;
    }
    const loadAssignments = async () => {
      try {
        const list = await api.assignments.list(selectedCourseId, selectedClassId);
        setAssignments(list);
        if (list.length > 0) {
          setSelectedAssignmentId(list[0].id);
        } else {
          setSelectedAssignmentId(null);
        }
      } catch (err) {
        console.error('Failed to load assignments', err);
        setWorkspaceError('Could not load assignments. Select the class again to retry.');
      }
    };
    loadAssignments();
  }, [selectedCourseId, selectedClassId]);

  // 4. Assignment changed: load submissions & rubric
  const loadAssignmentData = useCallback(async () => {
    const requestId = ++assignmentRequestId.current;
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId) {
      setSubmissions([]);
      setRubric(null);
      setSelectedSubmissionId(null);
      return;
    }
    setLoadingList(true);
    setWorkspaceError('');
    try {
      const [subsList, rubData] = await Promise.all([
        api.submissions.list(selectedCourseId, selectedClassId, selectedAssignmentId),
        api.rubrics.get(selectedCourseId, selectedClassId, selectedAssignmentId).catch(() => null),
      ]);

      if (requestId !== assignmentRequestId.current) return;

      setSubmissions(subsList);
      setRubric(rubData);
      if (subsList.length > 0) {
        setSelectedSubmissionId((previous) => subsList.some((sub) => sub.id === previous) ? previous : subsList[0].id);
      } else {
        setSelectedSubmissionId(null);
      }
    } catch (err) {
      if (requestId === assignmentRequestId.current) setWorkspaceError(err instanceof Error ? err.message : 'Could not load submissions. Use Reload submissions to retry.');
    } finally {
      if (requestId === assignmentRequestId.current) setLoadingList(false);
    }
  }, [selectedCourseId, selectedClassId, selectedAssignmentId]);

  useEffect(() => {
    loadAssignmentData();
  }, [loadAssignmentData]);

  // 5. Selected Submission changed: load code, evidence, and grade
  const loadSubmissionDetail = useCallback(async () => {
    const requestId = ++detailRequestId.current;
    if (
      !selectedCourseId ||
      !selectedClassId ||
      !selectedAssignmentId ||
      !selectedSubmissionId
    ) {
      setSubmissionCode('');
      setEvidenceList([]);
      setSubmissionGrade(null);
      return;
    }

    setLoadingDetail(true);
    try {
      const [code, evList, grade] = await Promise.all([
        api.submissions.getSource(
          selectedCourseId,
          selectedClassId,
          selectedAssignmentId,
          selectedSubmissionId
        ).catch(() => '# Failed to load source code'),
        api.evidence.list(
          selectedCourseId,
          selectedClassId,
          selectedAssignmentId,
          selectedSubmissionId
        ).catch(() => []),
        api.rubrics.getGrade(
          selectedCourseId,
          selectedClassId,
          selectedAssignmentId,
          selectedSubmissionId
        ).catch(() => null),
      ]);

      if (requestId !== detailRequestId.current) return;

      setSubmissionCode(code);
      setEvidenceList(evList);
      setSubmissionGrade(grade);
    } catch (err) {
      if (requestId === detailRequestId.current) console.error('Failed to load submission details', err);
    } finally {
      if (requestId === detailRequestId.current) setLoadingDetail(false);
    }
  }, [selectedCourseId, selectedClassId, selectedAssignmentId, selectedSubmissionId]);

  useEffect(() => {
    loadSubmissionDetail();
  }, [loadSubmissionDetail]);

  // Handlers
  const handleEvaluateGrade = async () => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId || !selectedSubmissionId) return;
    await api.rubrics.evaluateGrade(
      selectedCourseId,
      selectedClassId,
      selectedAssignmentId,
      selectedSubmissionId
    );
    await loadSubmissionDetail();
    await loadAssignmentData();
  };

  const handleSelectDemoStage = (stageId: number) => {
    setDemoStage(stageId);
    if (stageId === 1) {
      setActiveTab('setup');
    } else if (stageId === 2) {
      setActiveTab('grading');
      const sub1 = submissions.find((s) => s.student_identifier === '1001' || s.id === 1001);
      if (sub1) setSelectedSubmissionId(sub1.id);
    } else if (stageId === 3) {
      setActiveTab('grading');
      const sub2 = submissions.find((s) => s.student_identifier === '1002' || s.id === 1002);
      if (sub2) setSelectedSubmissionId(sub2.id);
    } else if (stageId === 4) {
      setActiveTab('grading');
      const sub2 = submissions.find((s) => s.student_identifier === '1002' || s.id === 1002);
      if (sub2) setSelectedSubmissionId(sub2.id);
    } else if (stageId === 5) {
      setActiveTab('similarity');
    }
  };

  const handleResetDemoInternal = async () => {
    setIsResettingDemo(true);
    try {
      if (onResetDemo) {
        await onResetDemo();
      } else {
        await api.demo.reset().catch(() => null);
      }
      const baseline = demoSubmissions.map((s) => ({ ...s, grade: { ...s.grade! } }));
      setSubmissions(baseline);
      setSelectedSubmissionId(1001);
      setActiveTab('grading');
      setDemoStage(2);
      setSearchQuery('');
      setGradeFilter('all');
      setActionError('');
      setWorkspaceError('');
      setSubmissionCode(getDemoSubmissionCode(1001));
      setEvidenceList(getDemoSubmissionEvidence(1001));
      setSubmissionGrade(getDemoSubmissionGrade(1001));
    } finally {
      setIsResettingDemo(false);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'setup' || tab === 'assignment') {
      setDemoStage(1);
    } else if (tab === 'similarity') {
      setDemoStage(5);
    } else if (tab === 'rubric') {
      setDemoStage(4);
    } else if (tab === 'grading') {
      loadSubmissionDetail();
      const selected = submissions.find((s) => s.id === selectedSubmissionId);
      if (selected?.student_identifier === '1003' || selected?.id === 1003) {
        setDemoStage(5);
      } else if (selected?.student_identifier === '1002' || selected?.id === 1002) {
        setDemoStage(3);
      } else {
        setDemoStage(2);
      }
    }
  };

  const handleSelectSubmission = (subId: number) => {
    setSelectedSubmissionId(subId);
    setSelectedEvidence(null);
    setManualJumpLine(null);
    if (isDemoMode) {
      const sub = submissions.find((s) => s.id === subId);
      if (sub?.student_identifier === '1001' || subId === 1001) {
        setDemoStage(2);
      } else if (sub?.student_identifier === '1002' || subId === 1002) {
        setDemoStage(3);
      } else if (sub?.student_identifier === '1003' || subId === 1003) {
        setDemoStage(5);
      }
    }
  };

  const handleOverrideGrade = async (data: any) => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId || !selectedSubmissionId) {
      if (isDemoMode && selectedSubmissionId) {
        const base = submissionGrade || getDemoSubmissionGrade(selectedSubmissionId);
        const updated: SubmissionGrade = {
          ...base,
          status: data.status || 'confirmed',
          final_total_score: data.final_total_score !== undefined ? data.final_total_score : base.final_total_score,
        };
        setSubmissionGrade(updated);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === selectedSubmissionId
              ? {
                  ...s,
                  grade: {
                    status: updated.status,
                    suggested_total_score: updated.suggested_total_score,
                    final_total_score: updated.final_total_score,
                  },
                }
              : s
          )
        );
      }
      return;
    }
    try {
      const updated = await api.rubrics.overrideGrade(
        selectedCourseId,
        selectedClassId,
        selectedAssignmentId,
        selectedSubmissionId,
        data
      );
      setSubmissionGrade(updated);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === selectedSubmissionId
            ? {
                ...s,
                grade: {
                  status: updated.status,
                  suggested_total_score: updated.suggested_total_score,
                  final_total_score: updated.final_total_score,
                },
              }
            : s
        )
      );
      await loadSubmissionDetail();
      await loadAssignmentData();
    } catch {
      if (isDemoMode) {
        const base = submissionGrade || getDemoSubmissionGrade(selectedSubmissionId);
        const updated: SubmissionGrade = {
          ...base,
          status: data.status || 'confirmed',
          final_total_score: data.final_total_score !== undefined ? data.final_total_score : base.final_total_score,
        };
        setSubmissionGrade(updated);
        setSubmissions((prev) =>
          prev.map((s) =>
            s.id === selectedSubmissionId
              ? {
                  ...s,
                  grade: {
                    status: updated.status,
                    suggested_total_score: updated.suggested_total_score,
                    final_total_score: updated.final_total_score,
                  },
                }
              : s
          )
        );
      }
    }
  };

  const handleGenerateFeedback = async () => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId || !selectedSubmissionId) return;
    await api.feedback.generate(
      selectedCourseId,
      selectedClassId,
      selectedAssignmentId,
      selectedSubmissionId
    );
    await loadSubmissionDetail();
  };

  const handleSaveFeedback = async (summary: string, detailed?: any, asConfirmed?: boolean) => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId || !selectedSubmissionId) return;
    await api.feedback.update(
      selectedCourseId,
      selectedClassId,
      selectedAssignmentId,
      selectedSubmissionId,
      {
        feedback_summary: summary,
        detailed_feedback: detailed,
        status: asConfirmed ? 'confirmed' : 'draft',
      }
    );
    await loadSubmissionDetail();
  };

  const [detectingAi, setDetectingAi] = useState(false);

  const handleDetectAi = async () => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId || !selectedSubmissionId) return;
    try {
      setDetectingAi(true);
      setActionError('');
      await api.aiDetector.detect(
        selectedCourseId,
        selectedClassId,
        selectedAssignmentId,
        selectedSubmissionId
      );
      await loadSubmissionDetail();
      setEvidenceCategory('codebert');
      setSelectedEvidence(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Analysis failed. Please retry.');
    } finally {
      setDetectingAi(false);
    }
  };

  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportCsv = async () => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId) return;
    setExportError(null);
    try {
      await api.rubrics.downloadGradebookCsv(selectedCourseId, selectedClassId, selectedAssignmentId);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Gradebook export failed');
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    const query = searchQuery.toLowerCase();
    if (gradeFilter === 'ungraded' && s.grade) return false;
    if (gradeFilter === 'review' && (!s.grade || s.grade.status === 'confirmed')) return false;
    if (gradeFilter === 'confirmed' && s.grade?.status !== 'confirmed') return false;
    return (
      s.student_identifier.toLowerCase().includes(query) ||
      (s.student_name && s.student_name.toLowerCase().includes(query)) ||
      s.original_filename.toLowerCase().includes(query) ||
      s.id.toString().includes(query)
    );
  });

  const selectedSubmission = submissions.find((s) => s.id === selectedSubmissionId);
  const selectedAssignment = assignments.find((a) => a.id === selectedAssignmentId);
  const assignmentBase = `/courses/${selectedCourseId}/classes/${selectedClassId}/assignments/${selectedAssignmentId}`;

  const codeHighlightData = useMemo(
    () =>
      deriveCodeHighlights(
        submissionCode,
        evidenceList,
        evidenceCategory,
        selectedEvidence
      ),
    [submissionCode, evidenceList, evidenceCategory, selectedEvidence]
  );

  // Keyboard navigation helpers
  const handleSwitchTabByIndex = (index: number) => {
    switch (index) {
      case 1:
        handleTabChange('setup');
        break;
      case 2:
        handleTabChange('rubric');
        break;
      case 3:
        handleTabChange('assignment');
        break;
      case 4:
        handleTabChange('similarity');
        break;
      case 5:
        handleTabChange('grading');
        break;
    }
  };

  const handleNextSubmission = () => {
    if (filteredSubmissions.length === 0) return;
    const currentIndex = filteredSubmissions.findIndex((s) => s.id === selectedSubmissionId);
    if (currentIndex === -1) {
      handleSelectSubmission(filteredSubmissions[0].id);
    } else if (currentIndex < filteredSubmissions.length - 1) {
      handleSelectSubmission(filteredSubmissions[currentIndex + 1].id);
    }
  };

  const handlePrevSubmission = () => {
    if (filteredSubmissions.length === 0) return;
    const currentIndex = filteredSubmissions.findIndex((s) => s.id === selectedSubmissionId);
    if (currentIndex > 0) {
      handleSelectSubmission(filteredSubmissions[currentIndex - 1].id);
    } else if (currentIndex === -1) {
      handleSelectSubmission(filteredSubmissions[0].id);
    }
  };

  const handleConfirmActiveGrade = async () => {
    if (!selectedSubmissionId) return;
    await handleOverrideGrade({ status: 'confirmed' });
  };

  useWorkstationKeyboard({
    onSwitchTab: handleSwitchTabByIndex,
    onNextSubmission: handleNextSubmission,
    onPrevSubmission: handlePrevSubmission,
    onConfirmGrade: handleConfirmActiveGrade,
    onToggleShortcutsModal: () => setIsShortcutsModalOpen((prev) => !prev),
    onCloseShortcutsModal: () => setIsShortcutsModalOpen(false),
    isShortcutsModalOpen,
  });

  return (
    <div
      data-testid="workstation-dashboard"
      className="min-h-dvh bg-[#FCF0DA] dark:bg-[#2C2623] flex flex-col font-sans text-[#4C4541] dark:text-[#FCF0DA] w-full max-w-full overflow-x-hidden transition-colors"
    >
      <Navbar onOpenShortcuts={() => setIsShortcutsModalOpen(true)} />
      {isDemoMode && (
        <DemoWalkthroughBar
          currentStage={demoStage}
          onSelectStage={handleSelectDemoStage}
          onResetDemo={handleResetDemoInternal}
          onExitDemo={onExitDemo || (() => {})}
          isResetting={isResettingDemo}
        />
      )}

      {exportError && (
        <div role="alert" className="bg-rose-50 dark:bg-rose-950/50 border-b border-rose-300 dark:border-rose-900 px-6 py-2 text-xs text-rose-800 dark:text-rose-200">
          {exportError}
        </div>
      )}

      {/* Top Selector Ribbon */}
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] border-b border-[#AEAC78]/40 dark:border-[#AEAC78]/30 px-6 py-2.5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm min-w-0">
            {/* Course Selector */}
            <div className="flex items-center space-x-1.5">
              <GraduationCap className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
              <select
                aria-label="Selected course"
                value={selectedCourseId || ''}
                onChange={(e) => {
                  clearAssignmentView();
                  setSelectedClassId(null);
                  setSelectedAssignmentId(null);
                  setSelectedCourseId(Number(e.target.value));
                }}
                className="bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/50 font-bold text-[#4C4541] dark:text-[#FCF0DA] py-1 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA]">
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[#AEAC78] font-mono">/</span>

            {/* Class Cohort Selector */}
            <div className="flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
              <select
                aria-label="Selected class"
                value={selectedClassId || ''}
                onChange={(e) => {
                  clearAssignmentView();
                  setSelectedAssignmentId(null);
                  setSelectedClassId(Number(e.target.value));
                }}
                className="bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/50 font-bold text-[#4C4541] dark:text-[#FCF0DA] py-1 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200"
              >
                {classes.map((cl) => (
                  <option key={cl.id} value={cl.id} className="bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA]">
                    {cl.name} ({cl.semester} {cl.year})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[#AEAC78] font-mono">/</span>

            {/* Assignment Selector */}
            <div className="flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
              <select
                aria-label="Selected assignment"
                value={selectedAssignmentId || ''}
                onChange={(e) => {
                  clearAssignmentView();
                  setSelectedAssignmentId(Number(e.target.value));
                }}
                className="bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/50 font-bold text-[#4C4541] dark:text-[#FCF0DA] py-1 px-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200 max-w-xs"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id} className="bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA]">
                    {a.title} ({a.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsBatchModalOpen(true)}
              disabled={!selectedAssignmentId}
              className="px-3 py-1.5 bg-[#FCF0DA]/60 dark:bg-[#2C2623] hover:bg-[#FCF0DA] dark:hover:bg-[#4C4541] text-[#4C4541] dark:text-[#FCF0DA] rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 border border-[#AEAC78]/50 shadow-xs cursor-pointer disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100"
            >
              <Archive className="w-3.5 h-3.5 text-[#AEAC78] dark:text-[#F2C46A]" />
              <span>Import LMS ZIP</span>
            </button>

            <button
              onClick={handleDetectAi}
              disabled={!selectedSubmissionId || detectingAi}
              className="px-3 py-1.5 bg-[#FCF0DA]/60 dark:bg-[#2C2623] hover:bg-[#FCF0DA] dark:hover:bg-[#4C4541] text-[#4C4541] dark:text-[#FCF0DA] rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 border border-[#AEAC78]/50 shadow-xs cursor-pointer disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100"
              title="Run experimental code-style analysis; the result cannot prove authorship"
            >
              <Bot className={cn("w-3.5 h-3.5 text-[#AEAC78] dark:text-[#F2C46A]", detectingAi && "animate-spin")} />
              <span>{detectingAi ? 'Analyzing...' : 'AI Style Signal'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={!selectedAssignmentId}
              className="px-3 py-1.5 bg-[#F2C46A] hover:bg-[#e5b65b] text-[#4C4541] border border-[#AEAC78]/60 rounded-lg text-xs font-bold inline-flex items-center space-x-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-95 shadow-xs cursor-pointer disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:active:scale-100"
            >
              <Download className="w-3.5 h-3.5 text-[#4C4541]" />
              <span>Export Gradebook CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        {actionError && <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-400">{actionError}</p>}
        <div aria-label="Workspace sections" className="flex flex-wrap gap-4 mt-3 border-t border-[#AEAC78]/30 pt-3 text-sm">
          <button
            onClick={() => handleTabChange('setup')}
            className={cn(
              "pb-1 font-bold tracking-tight transition-all duration-200 border-b-2 flex items-center space-x-1.5 cursor-pointer hover:-translate-y-0.5",
              activeTab === 'setup'
                ? "border-[#F2C46A] text-[#4C4541] dark:text-[#FCF0DA]"
                : "border-transparent text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] hover:border-[#AEAC78]/50"
            )}
          >
            <Plus className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <span>Set Up Course & Class</span>
            {activeTab === 'setup' && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse ml-0.5" />
            )}
          </button>

          <button
            disabled={!selectedAssignmentId}
            onClick={() => handleTabChange('rubric')}
            className={cn(
              "pb-1 font-bold tracking-tight transition-all duration-200 border-b-2 flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 hover:-translate-y-0.5 disabled:hover:translate-y-0",
              activeTab === 'rubric'
                ? "border-[#F2C46A] text-[#4C4541] dark:text-[#FCF0DA]"
                : "border-transparent text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] hover:border-[#AEAC78]/50"
            )}
          >
            <Sliders className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <span>Rubric & Formulas</span>
            {activeTab === 'rubric' && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse ml-0.5" />
            )}
          </button>

          <button
            disabled={!selectedAssignmentId}
            onClick={() => handleTabChange('assignment')}
            className={cn(
              "pb-1 font-bold tracking-tight transition-all duration-200 border-b-2 flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 hover:-translate-y-0.5 disabled:hover:translate-y-0",
              activeTab === 'assignment'
                ? "border-[#F2C46A] text-[#4C4541] dark:text-[#FCF0DA]"
                : "border-transparent text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] hover:border-[#AEAC78]/50"
            )}
          >
            <BookOpen className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <span>Assignment & Tests</span>
            {activeTab === 'assignment' && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse ml-0.5" />
            )}
          </button>

          <button
            disabled={!selectedAssignmentId}
            onClick={() => handleTabChange('similarity')}
            className={cn(
              "pb-1 font-bold tracking-tight transition-all duration-200 border-b-2 flex items-center space-x-1.5 cursor-pointer disabled:opacity-40 hover:-translate-y-0.5 disabled:hover:translate-y-0",
              activeTab === 'similarity'
                ? "border-[#F2C46A] text-[#4C4541] dark:text-[#FCF0DA]"
                : "border-transparent text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] hover:border-[#AEAC78]/50"
            )}
          >
            <ShieldAlert className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <span>Similarity & Integrity</span>
            {activeTab === 'similarity' && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleTabChange('grading')}
            className={cn(
              "pb-1 font-bold tracking-tight transition-all duration-200 border-b-2 flex items-center space-x-1.5 cursor-pointer hover:-translate-y-0.5",
              activeTab === 'grading'
                ? "border-[#F2C46A] text-[#4C4541] dark:text-[#FCF0DA]"
                : "border-transparent text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] hover:border-[#AEAC78]/50"
            )}
          >
            <FileSearch className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <span>Grading Queue & Evidence Inspector</span>
            {activeTab === 'grading' && (
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 p-5 overflow-hidden flex flex-col">
        {workspaceError && (
          <p role="alert" className="mb-4 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-sm text-rose-800 dark:text-rose-200">
            {workspaceError}
          </p>
        )}

        {selectedAssignment && activeTab === 'grading' && (() => {
          const totalSubmissions = submissions.length;
          const confirmedSubmissions = submissions.filter((s) => s.grade?.status === 'confirmed').length;
          const awaitingReviewSubmissions = submissions.filter((s) => s.grade && s.grade.status !== 'confirmed').length;
          const confirmedPercent = totalSubmissions > 0 ? Math.round((confirmedSubmissions / totalSubmissions) * 100) : 0;
          const radius = 24;
          const circumference = 2 * Math.PI * radius;
          const strokeOffset = circumference - (circumference * confirmedPercent) / 100;

          const stages = [
            {
              id: 1,
              name: 'Setup',
              done: Boolean(selectedCourseId && selectedClassId),
              current: false,
              action: () => handleTabChange('setup'),
            },
            {
              id: 2,
              name: 'Rubric',
              done: Boolean(rubric),
              current: false,
              action: () => handleTabChange('rubric'),
            },
            {
              id: 3,
              name: 'Ingest',
              done: totalSubmissions > 0,
              current: false,
              action: () => setIsBatchModalOpen(true),
            },
            {
              id: 4,
              name: 'Grade',
              done: submissions.some((s) => Boolean(s.grade)),
              current: false,
              action: () => setGradeFilter('all'),
            },
            {
              id: 5,
              name: 'Confirm',
              done: totalSubmissions > 0 && confirmedSubmissions === totalSubmissions,
              current: false,
              action: () => setGradeFilter('review'),
            },
          ];

          let currentFound = false;
          for (let i = 0; i < stages.length; i++) {
            if (!stages[i].done && !currentFound) {
              stages[i].current = true;
              currentFound = true;
            }
          }
          if (!currentFound && stages.length > 0) {
            stages[stages.length - 1].current = true;
          }

          return (
            <section aria-label="Assignment progress" className="mb-3 rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] px-4 py-2.5 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F2C46A] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F2C46A]" />
                      </span>
                      <h2 className="text-base font-bold text-[#4C4541] dark:text-[#FCF0DA] text-balance truncate">
                        {selectedAssignment.title}
                      </h2>
                    </div>
                    <p className="mt-0.5 text-xs text-[#6B625B] dark:text-[#D8CEBA] text-pretty">
                      Review test evidence, adjust scores if needed, then confirm each grade before exporting.
                    </p>
                  </div>

                  {/* Interactive 5-Stage Lifecycle Stepper */}
                  <div className="flex items-center space-x-1 sm:space-x-1.5 overflow-x-auto py-0.5">
                    {stages.map((st, idx) => (
                      <React.Fragment key={st.id}>
                        <button
                          type="button"
                          onClick={st.action}
                          className="flex items-center space-x-1.5 shrink-0 px-2 py-1 rounded-lg hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623] transition-colors cursor-pointer"
                          title={`Jump to ${st.name} step`}
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono transition-all duration-200',
                              st.done
                                ? 'bg-[#F2C46A] text-[#4C4541]'
                                : st.current
                                ? 'bg-[#FCF0DA] dark:bg-[#2C2623] text-[#F2C46A] border-2 border-[#F2C46A] ring-2 ring-[#F2C46A]/30'
                                : 'bg-[#FCF0DA]/40 dark:bg-[#2C2623] text-[#AEAC78] border border-[#AEAC78]/40'
                            )}
                          >
                            {st.done ? <Check className="w-3 h-3 stroke-[3]" /> : st.id}
                          </div>
                          <span
                            className={cn(
                              'text-xs font-semibold flex items-center gap-1',
                              st.done
                                ? 'text-[#4C4541] dark:text-[#FCF0DA]'
                                : st.current
                                ? 'text-[#4C4541] dark:text-[#F2C46A] font-bold'
                                : 'text-[#AEAC78]'
                            )}
                          >
                            {st.current && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse shrink-0" />
                            )}
                            {st.name}
                          </span>
                        </button>
                        {idx < stages.length - 1 && (
                          <div
                            className={cn(
                              'h-0.5 w-3 sm:w-5 shrink-0 transition-colors duration-200',
                              st.done ? 'bg-[#F2C46A]' : 'bg-[#AEAC78]/30'
                            )}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-5 shrink-0 border-t lg:border-t-0 lg:border-l border-[#AEAC78]/30 pt-2 lg:pt-0 lg:pl-5">
                  {/* Radial Confirmation Progress Meter */}
                  <div className="flex items-center space-x-2.5 shrink-0">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 60 60">
                        <circle
                          cx="30"
                          cy="30"
                          r={radius}
                          stroke="currentColor"
                          strokeWidth="5"
                          fill="transparent"
                          className="text-[#AEAC78]/25"
                        />
                        <circle
                          cx="30"
                          cy="30"
                          r={radius}
                          stroke="#F2C46A"
                          strokeWidth="5"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeOffset}
                          strokeLinecap="round"
                          fill="transparent"
                          className="transition-all duration-700 ease-out"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] font-black font-mono text-[#4C4541] dark:text-[#FCF0DA]">
                          {confirmedPercent}%
                        </span>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#AEAC78] block">
                        Confirmed
                      </span>
                      <span className="text-xs font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                        {confirmedSubmissions}/{totalSubmissions}
                      </span>
                    </div>
                  </div>

                  {/* Standard dl / dt / dd metrics preserved for Playwright selectors */}
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs tabular-nums">
                    <div>
                      <dt className="text-[#AEAC78]">Submissions</dt>
                      <dd className="text-sm font-bold text-[#4C4541] dark:text-[#FCF0DA]">{totalSubmissions}</dd>
                    </div>
                    <div>
                      <dt className="text-[#AEAC78] flex items-center gap-1.5">
                        {awaitingReviewSubmissions > 0 && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                          </span>
                        )}
                        <span>Awaiting review</span>
                      </dt>
                      <dd className="text-sm font-bold text-amber-600 dark:text-amber-400">
                        {awaitingReviewSubmissions}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#AEAC78] flex items-center gap-1.5">
                        {confirmedSubmissions > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                        )}
                        <span>Confirmed grades</span>
                      </dt>
                      <dd className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                        {confirmedSubmissions}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {!rubric && !loadingList && (
                <p className="mt-2 text-xs text-[#AEAC78] border-t border-[#AEAC78]/20 pt-2">
                  Set up a rubric before grading.{' '}
                  <button className="text-[#F2C46A] hover:underline font-bold cursor-pointer" onClick={() => handleTabChange('rubric')}>
                    Configure rubric
                  </button>
                </p>
              )}
            </section>
          );
        })()}

        {activeTab === 'setup' && (
          <ErrorBoundary fallbackTitle="Error loading workspace setup">
            <div className="overflow-y-auto">
              <WorkspaceSetup
                courseId={selectedCourseId}
                classId={selectedClassId}
                onCourseCreated={(course) => {
                  clearAssignmentView();
                  setSelectedClassId(null);
                  setSelectedAssignmentId(null);
                  setCourses((previous) => [course, ...previous]);
                  setSelectedCourseId(course.id);
                }}
                onClassCreated={(cohort) => {
                  clearAssignmentView();
                  setSelectedAssignmentId(null);
                  setClasses((previous) => [cohort, ...previous]);
                  setSelectedClassId(cohort.id);
                }}
                onAssignmentCreated={(assignment) => {
                  clearAssignmentView();
                  setAssignments((previous) => [assignment, ...previous]);
                  setSelectedAssignmentId(assignment.id);
                  setActiveTab('assignment');
                }}
              />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'assignment' && selectedAssignment && selectedCourseId && selectedClassId && (
          <ErrorBoundary fallbackTitle="Error loading assignment & tests editor">
            <div className="max-w-4xl mx-auto w-full space-y-5 overflow-y-auto min-h-0">
              <AssignmentEditor
                key={selectedAssignment.id}
                courseId={selectedCourseId}
                classId={selectedClassId}
                assignment={selectedAssignment}
                onSaved={(updated) =>
                  setAssignments((previous) =>
                    previous.map((item) => (item.id === updated.id ? updated : item))
                  )
                }
              />
              <TestCaseManager key={assignmentBase} base={assignmentBase} />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'rubric' && selectedAssignmentId && (
          <ErrorBoundary fallbackTitle="Error loading rubric manager">
            <div className="max-w-4xl mx-auto w-full overflow-y-auto min-h-0">
              <RubricManager
                key={selectedAssignmentId}
                courseId={selectedCourseId!}
                classId={selectedClassId!}
                assignmentId={selectedAssignmentId!}
                rubric={rubric}
                onRubricUpdated={loadAssignmentData}
              />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'similarity' && selectedAssignmentId && (
          <ErrorBoundary fallbackTitle="Error loading similarity workbench">
            <div className="flex-1 max-w-6xl mx-auto w-full overflow-hidden">
              <SimilarityWorkbench
                courseId={selectedCourseId!}
                classId={selectedClassId!}
                assignmentId={selectedAssignmentId!}
                submissions={submissions}
                onSelectSubmissions={(a, _b) => {
                  setSelectedSubmissionId(a);
                  setActiveTab('grading');
                }}
              />
            </div>
          </ErrorBoundary>
        )}

        {activeTab === 'grading' && (
          <ErrorBoundary fallbackTitle="Error loading grading workspace">
            <div
              data-testid="grading-studio-grid"
              className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] gap-4 min-w-0 items-start lg:items-stretch lg:h-[calc(100dvh-195px)] lg:min-h-[650px] lg:max-h-[860px]"
            >
              {/* Column 1 (3/12): Cohort Submissions Roster */}
              <div className="lg:col-span-3 lg:h-full bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/35 dark:border-[#AEAC78]/25 shadow-sm flex flex-col min-w-0 min-h-0 overflow-hidden">
                <div className="p-3 border-b border-[#AEAC78]/25 dark:border-[#AEAC78]/20 bg-[#FCF0DA]/35 dark:bg-[#2C2623]/60 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] text-xs uppercase tracking-wider">
                      Cohort Submissions ({submissions.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="hidden sm:inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40">
                        [K]/[J]
                      </span>
                      <button
                        onClick={loadAssignmentData}
                        className="text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#F2C46A] p-1 cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 disabled:hover:scale-100"
                        title="Reload submissions"
                        aria-label="Reload submissions"
                        disabled={loadingList || !selectedAssignmentId}
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", loadingList && "animate-spin")} />
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#AEAC78] absolute left-2.5 top-2.5" />
                    <input
                      aria-label="Search submissions"
                      type="text"
                      placeholder="Search student ID, name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/50 rounded-xl text-xs placeholder-[#8F8782] text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200"
                    />
                  </div>

                  {/* 1-Click Segmented Filter Pills synced with accessible <select> */}
                  <div className="mt-2 grid grid-cols-4 gap-1">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'review', label: 'Review' },
                      { id: 'confirmed', label: 'Done' },
                      { id: 'ungraded', label: 'New' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setGradeFilter(tab.id)}
                        className={cn(
                          'py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border text-center truncate',
                          gradeFilter === tab.id
                            ? 'bg-[#F2C46A] text-[#4C4541] border-[#AEAC78]/60 shadow-2xs'
                            : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#6B625B] dark:text-[#D8CEBA] border-[#AEAC78]/35 hover:bg-[#FCF0DA]/60'
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <label className="mt-2 block text-[11px] font-medium text-[#6B625B] dark:text-[#D8CEBA]">
                    Grade status
                    <select
                      aria-label="Filter by grade status"
                      className="mt-1 w-full rounded-xl border border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#2C2623] p-1.5 text-xs text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200"
                      value={gradeFilter}
                      onChange={(e) => setGradeFilter(e.target.value)}
                    >
                      <option value="all">All submissions</option>
                      <option value="ungraded">Not graded</option>
                      <option value="review">Awaiting review</option>
                      <option value="confirmed">Confirmed</option>
                    </select>
                  </label>
                </div>

                {/* Roster List items */}
                <div className="flex-1 min-h-0 max-h-96 lg:max-h-none overflow-y-auto divide-y divide-[#AEAC78]/15 p-1.5 space-y-1">
                  {loadingList ? (
                    <div className="text-center py-12 text-[#AEAC78] text-xs font-mono">
                      Loading submissions...
                    </div>
                  ) : filteredSubmissions.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        title={
                          !selectedAssignmentId
                            ? 'No Assignment Selected'
                            : submissions.length
                            ? 'No submissions match'
                            : 'No Submissions Yet'
                        }
                        description={
                          !selectedAssignmentId
                            ? 'Create or select an assignment to start.'
                            : submissions.length
                            ? 'No submissions match these filters.'
                            : 'Configure tests and rubric, then import student work.'
                        }
                        icon={!selectedAssignmentId ? BookOpen : submissions.length ? Search : Users}
                        actionLabel={
                          !selectedAssignmentId
                            ? 'Set up workspace'
                            : submissions.length
                            ? 'Clear filters'
                            : 'Import submissions'
                        }
                        onAction={
                          !selectedAssignmentId
                            ? () => handleTabChange('setup')
                            : submissions.length
                            ? () => {
                                setSearchQuery('');
                                setGradeFilter('all');
                              }
                            : () => setIsBatchModalOpen(true)
                        }
                      />
                    </div>
                  ) : (
                    filteredSubmissions.map((sub) => {
                      const isSelected = sub.id === selectedSubmissionId;
                      const finalScore = sub.grade?.final_total_score;
                      const suggestedScore = sub.grade?.suggested_total_score;
                      const displayScore = finalScore !== null && finalScore !== undefined ? finalScore : suggestedScore;

                      const statusStr: string = sub.grade?.status || 'ungraded';
                      const badgeColorClass =
                        statusStr === 'confirmed'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : statusStr === 'completed'
                          ? 'bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#F2C46A] border border-[#AEAC78]/50'
                          : statusStr === 'draft'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                          : 'bg-[#FCF0DA]/50 dark:bg-[#2C2623]/60 text-[#AEAC78] border border-[#AEAC78]/40';

                      return (
                        <button
                          type="button"
                          data-testid="submission-item"
                          aria-pressed={isSelected}
                          key={sub.id}
                          onClick={() => handleSelectSubmission(sub.id)}
                          className={cn(
                            'w-full text-left p-2.5 rounded-xl cursor-pointer text-sm transition-all duration-200',
                            isSelected
                              ? 'bg-[#FCF0DA]/80 dark:bg-[#2C2623] border-l-4 border-[#F2C46A] ring-1 ring-[#F2C46A]/40 shadow-xs'
                              : 'hover:bg-[#FCF0DA]/35 dark:hover:bg-[#2C2623]/60 border-l-4 border-transparent'
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1 mr-2">
                              <div className="flex items-center gap-1.5">
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] shrink-0 animate-pulse" />
                                )}
                                <div className="font-bold text-[#4C4541] dark:text-[#FCF0DA] truncate">
                                  {sub.student_name || sub.student_identifier || `Submission #${sub.id}`}
                                </div>
                              </div>
                              <div className="text-[11px] font-mono text-[#6B625B] dark:text-[#AEAC78] mt-0.5 truncate">
                                ID: <code>{sub.student_identifier || 'N/A'}</code> - <code>{sub.original_filename}</code>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {displayScore !== undefined && displayScore !== null ? (
                                <span className="font-mono font-bold text-xs text-[#4C4541] dark:text-[#F2C46A]">
                                  {displayScore.toFixed(2)} pts
                                </span>
                              ) : (
                                <span className="text-[11px] text-[#AEAC78] italic">ungraded</span>
                              )}
                              <div className="mt-0.5">
                                <span
                                  data-testid="status-badge"
                                  className={cn(
                                    'text-[9px] font-bold uppercase px-2 py-0.5 rounded-full inline-block tracking-wider',
                                    badgeColorClass
                                  )}
                                >
                                  {statusStr}
                                </span>
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {!selectedSubmissionId ? (
                <div className="lg:col-span-9 p-4">
                  <EmptyState
                    title="Select a submission"
                    description="Select a submission from the list to see its source, evidence and grade."
                    icon={FileSearch}
                  />
                </div>
              ) : (
                <>
                  {/* Column 2 (5/12): Active Student Context + Source Code Studio + Sandbox Runner */}
                  <div className="lg:col-span-5 lg:h-full flex flex-col gap-3 min-w-0 min-h-0 overflow-hidden">
                    {/* Active Student Context Bar */}
                    {(() => {
                      const activeIndex = filteredSubmissions.findIndex((s) => s.id === selectedSubmissionId);
                      const studentDisplayName =
                        selectedSubmission?.student_name ||
                        selectedSubmission?.student_identifier ||
                        `Submission #${selectedSubmissionId}`;
                      const avatarInitial = studentDisplayName.trim().charAt(0).toUpperCase() || 'S';

                      const passedTests = evidenceList.filter((e) => e.source === 'pytest' && e.rule_code === 'TEST_PASSED').length;
                      const totalTests = evidenceList.filter((e) => e.source === 'pytest').length;
                      const ruffCount = evidenceList.filter((e) => e.source === 'ruff').length;
                      const astCount = evidenceList.filter((e) => e.source === 'ast').length;
                      const jplagItem = evidenceList.find((e) => e.source === 'jplag');
                      const codebertItem = evidenceList.find((e) => e.source === 'codebert');

                      return (
                        <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/35 dark:border-[#AEAC78]/25 px-3.5 py-2.5 shadow-sm flex flex-col gap-2 shrink-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-[#FCF0DA] dark:bg-[#2C2623] border border-[#AEAC78]/50 flex items-center justify-center font-bold text-xs text-[#4C4541] dark:text-[#F2C46A] shrink-0">
                                {avatarInitial}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-sm text-[#4C4541] dark:text-[#FCF0DA] truncate">
                                    {studentDisplayName}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-[#FCF0DA]/60 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/35">
                                    ID: {selectedSubmission?.student_identifier || selectedSubmissionId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#6B625B] dark:text-[#AEAC78] font-mono truncate">
                                  Source: <code>{selectedSubmission?.original_filename || 'solution.py'}</code>
                                  {activeIndex !== -1 && (
                                    <span>
                                      {' '}• {activeIndex + 1}/{filteredSubmissions.length}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Prev [K] / Next [J] Student Navigation Controls */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={handlePrevSubmission}
                                disabled={activeIndex <= 0}
                                className="px-2 py-1 rounded-lg border border-[#AEAC78]/50 bg-[#FCF0DA]/50 dark:bg-[#2C2623] hover:bg-[#FCF0DA] text-[#4C4541] dark:text-[#FCF0DA] text-[11px] font-mono font-bold inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                                title="Previous submission (Shortcut: K)"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Prev [K]</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleNextSubmission}
                                disabled={activeIndex === -1 || activeIndex >= filteredSubmissions.length - 1}
                                className="px-2 py-1 rounded-lg border border-[#AEAC78]/50 bg-[#FCF0DA]/50 dark:bg-[#2C2623] hover:bg-[#FCF0DA] text-[#4C4541] dark:text-[#FCF0DA] text-[11px] font-mono font-bold inline-flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
                                title="Next submission (Shortcut: J)"
                              >
                                <span>Next [J]</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Quick Signal Pills (Click to Markpen Code) */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            {totalTests > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvidenceCategory((prev) => (prev === 'pytest' ? 'all' : 'pytest'));
                                  setSelectedEvidence(null);
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 transition-all cursor-pointer border',
                                  evidenceCategory === 'pytest'
                                    ? 'bg-[#4C4541] text-[#FCF0DA] border-[#4C4541] shadow-xs'
                                    : 'bg-[#FCF0DA]/40 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border-[#AEAC78]/40 hover:bg-[#FCF0DA]'
                                )}
                                title="Click to highlight tested functions in code"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>Tests {passedTests}/{totalTests}</span>
                              </button>
                            )}
                            {ruffCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvidenceCategory((prev) => (prev === 'ruff' ? 'all' : 'ruff'));
                                  setSelectedEvidence(null);
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 transition-all cursor-pointer border',
                                  evidenceCategory === 'ruff'
                                    ? 'bg-[#4C4541] text-[#FCF0DA] border-[#4C4541] shadow-xs'
                                    : 'bg-[#F2C46A]/20 text-[#6B4307] dark:text-[#F2C46A] border-[#F2C46A]/50 hover:bg-[#F2C46A]/35'
                                )}
                                title="Click to mark Ruff linter lines in code"
                              >
                                <AlertTriangle className="w-3 h-3 text-[#F2C46A]" />
                                <span>Ruff ({ruffCount})</span>
                              </button>
                            )}
                            {astCount > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvidenceCategory((prev) => (prev === 'ast' ? 'all' : 'ast'));
                                  setSelectedEvidence(null);
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 transition-all cursor-pointer border',
                                  evidenceCategory === 'ast'
                                    ? 'bg-[#4C4541] text-[#FCF0DA] border-[#4C4541] shadow-xs'
                                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400/50 hover:bg-amber-500/25'
                                )}
                                title="Click to mark AST complexity blocks in code"
                              >
                                <Cpu className="w-3 h-3" />
                                <span>Complexity ({astCount})</span>
                              </button>
                            )}
                            {jplagItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvidenceCategory((prev) => (prev === 'jplag' ? 'all' : 'jplag'));
                                  setSelectedEvidence(null);
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 transition-all cursor-pointer border',
                                  evidenceCategory === 'jplag'
                                    ? 'bg-[#4C4541] text-[#FCF0DA] border-[#4C4541] shadow-xs'
                                    : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/50 hover:bg-rose-500/25'
                                )}
                                title="Click to mark similarity regions in code"
                              >
                                <ShieldAlert className="w-3 h-3" />
                                <span>Similarity {Math.round(jplagItem.metric_value || 0)}%</span>
                              </button>
                            )}
                            {codebertItem && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEvidenceCategory((prev) => (prev === 'codebert' ? 'all' : 'codebert'));
                                  setSelectedEvidence(null);
                                }}
                                className={cn(
                                  'px-2 py-0.5 rounded-lg font-bold inline-flex items-center gap-1 transition-all cursor-pointer border',
                                  evidenceCategory === 'codebert'
                                    ? 'bg-[#4C4541] text-[#FCF0DA] border-[#4C4541] shadow-xs'
                                    : 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-400/50 hover:bg-violet-500/25'
                                )}
                                title="Click to mark AI stylistic regions in code"
                              >
                                <Bot className="w-3 h-3" />
                                <span>AI Style {Math.round((codebertItem.metric_value || 0) * 100)}%</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Source Code Viewer (Front-and-Center in Column 2, fills remaining height) */}
                    <div
                      data-testid="code-viewer"
                      className="flex-1 min-h-[420px] lg:min-h-0 min-w-0 overflow-hidden flex flex-col"
                    >
                      {loadingDetail ? (
                        <div className="flex-1 bg-[#241F1C] rounded-2xl border border-[#AEAC78]/35 flex items-center justify-center text-[#AEAC78] text-xs font-mono">
                          Loading submission artifacts...
                        </div>
                      ) : (
                        <div className="flex-1 min-h-0">
                          <CodeViewer
                            code={submissionCode}
                            filename={selectedSubmission?.original_filename || 'solution.py'}
                            highlightedLines={manualJumpLine ? [manualJumpLine] : []}
                            lineHighlights={codeHighlightData.highlights}
                            activeHighlightSummary={codeHighlightData.summary}
                            onClearHighlight={() => {
                              setSelectedEvidence(null);
                              setEvidenceCategory('all');
                              setManualJumpLine(null);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Sandbox Grading Job Runner (Pinned at bottom of Column 2) */}
                    <div className="shrink-0">
                      <GradingJobPanel
                        key={`${assignmentBase}/${selectedSubmissionId}`}
                        base={assignmentBase}
                        submissionId={selectedSubmissionId}
                        onFinished={async () => {
                          await loadSubmissionDetail();
                          await loadAssignmentData();
                        }}
                      />
                    </div>
                  </div>

                  {/* Column 3 (4/12): Quick-Jump Dock Bar + Independent Scrollable Inspector Stack */}
                  <div className="lg:col-span-4 lg:h-full flex flex-col gap-2.5 min-w-0 min-h-0 overflow-hidden">
                    {/* Quick-Jump Inspector Dock Bar */}
                    <div
                      data-testid="inspector-dock-bar"
                      className="shrink-0 bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/35 dark:border-[#AEAC78]/25 p-1 shadow-xs grid grid-cols-3 gap-1"
                    >
                      {[
                        { id: 'evidence' as const, label: `1. Evidence (${evidenceList.length})` },
                        { id: 'rubric' as const, label: '2. Rubric & Score' },
                        { id: 'feedback' as const, label: '3. AI Feedback' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => scrollToDockSection(tab.id)}
                          className={cn(
                            'py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer truncate text-center',
                            activeDockSection === tab.id
                              ? 'bg-[#4C4541] text-[#FCF0DA] dark:bg-[#F2C46A] dark:text-[#4C4541] shadow-2xs'
                              : 'text-[#6B625B] dark:text-[#D8CEBA] hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623]'
                          )}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Independent Scrollable Inspector Stack */}
                    <div
                      ref={col3ScrollRef}
                      data-testid="inspector-scroll-pane"
                      onScroll={(e) => {
                        if (Date.now() < programmaticScrollUntilRef.current) return;
                        const container = e.currentTarget;
                        const containerTop = container.getBoundingClientRect().top;
                        const rubricEl = container.querySelector<HTMLElement>('#dock-rubric');
                        const feedbackEl = container.querySelector<HTMLElement>('#dock-feedback');
                        if (feedbackEl && feedbackEl.getBoundingClientRect().top - containerTop <= 140) {
                          setActiveDockSection('feedback');
                        } else if (rubricEl && rubricEl.getBoundingClientRect().top - containerTop <= 140) {
                          setActiveDockSection('rubric');
                        } else {
                          setActiveDockSection('evidence');
                        }
                      }}
                      className="flex-1 min-h-0 lg:overflow-y-auto space-y-3 pr-1 pb-56 relative"
                    >
                      {/* Evidence Inspector */}
                      <div
                        id="dock-evidence"
                        data-testid="evidence-inspector"
                        className="h-[340px] min-w-0 overflow-hidden"
                      >
                        <EvidenceInspector
                          evidence={evidenceList}
                          activeCategory={evidenceCategory}
                          onCategoryChange={setEvidenceCategory}
                          selectedEvidenceId={selectedEvidence?.id || null}
                          onSelectEvidence={(ev) => {
                            setSelectedEvidence(ev);
                            setManualJumpLine(null);
                          }}
                          onSelectLine={(line) => setManualJumpLine(line)}
                        />
                      </div>

                      {/* Grade Override Panel */}
                      <div id="dock-rubric" className="min-w-0">
                        <GradeOverridePanel
                          key={selectedSubmissionId}
                          grade={submissionGrade}
                          onEvaluate={handleEvaluateGrade}
                          onOverride={handleOverrideGrade}
                        />
                      </div>

                      {/* AI Feedback Draft Editor */}
                      <div
                        id="dock-feedback"
                        data-testid="feedback-draft-editor"
                        className="min-w-0 min-h-[380px]"
                      >
                        <FeedbackDraftEditor
                          key={selectedSubmissionId}
                          grade={submissionGrade}
                          onGenerate={handleGenerateFeedback}
                          onSaveFeedback={handleSaveFeedback}
                          onSelectEvidence={(evidenceId) => {
                            const found = evidenceList.find((e) => e.id === evidenceId);
                            if (found) {
                              setSelectedEvidence(found);
                              setManualJumpLine(null);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ErrorBoundary>
        )}
      </main>

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Batch Ingest Modal */}
      {selectedCourseId && selectedClassId && selectedAssignmentId && (
        <BatchIngestModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          courseId={selectedCourseId}
          classId={selectedClassId}
          assignmentId={selectedAssignmentId}
          onIngestSuccess={loadAssignmentData}
        />
      )}
    </div>
  );
};
