import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Archive,
  BookOpen,
  Bot,
  Check,
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
import { CodeViewer } from '../components/CodeViewer';
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
            { id: 1, name: 'Setup', done: Boolean(selectedCourseId && selectedClassId), current: false },
            { id: 2, name: 'Rubric', done: Boolean(rubric), current: false },
            { id: 3, name: 'Ingest', done: totalSubmissions > 0, current: false },
            { id: 4, name: 'Grade', done: submissions.some((s) => Boolean(s.grade)), current: false },
            { id: 5, name: 'Confirm', done: totalSubmissions > 0 && confirmedSubmissions === totalSubmissions, current: false },
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
            <section aria-label="Assignment progress" className="mb-4 rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-4 shadow-xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2.5 w-2.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F2C46A] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F2C46A]" />
                    </span>
                    <h2 className="text-lg font-bold text-[#4C4541] dark:text-[#FCF0DA] text-balance truncate">
                      {selectedAssignment.title}
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-[#6B625B] dark:text-[#D8CEBA] text-pretty">
                    Review test evidence, adjust scores if needed, then confirm each grade before exporting.
                  </p>

                  {/* 5-Stage Lifecycle Indicator */}
                  <div className="mt-3 flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1">
                    {stages.map((st, idx) => (
                      <React.Fragment key={st.id}>
                        <div className="flex items-center space-x-1.5 shrink-0">
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
                                ? 'text-[#F2C46A] font-bold'
                                : 'text-[#AEAC78]'
                            )}
                          >
                            {st.current && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#F2C46A] inline-block animate-pulse shrink-0" />
                            )}
                            {st.name}
                          </span>
                        </div>
                        {idx < stages.length - 1 && (
                          <div
                            className={cn(
                              'h-0.5 w-4 sm:w-6 shrink-0 transition-colors duration-200',
                              st.done ? 'bg-[#F2C46A]' : 'bg-[#AEAC78]/30'
                            )}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 lg:border-l border-[#AEAC78]/30 pt-3 lg:pt-0 lg:pl-6">
                  {/* Radial Confirmation Progress Meter */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="relative w-14 h-14 flex items-center justify-center">
                      <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 60 60">
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
                        <span className="text-[11px] font-black font-mono text-[#4C4541] dark:text-[#FCF0DA]">
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
                  <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums">
                    <div>
                      <dt className="text-[#AEAC78]">Submissions</dt>
                      <dd className="text-base font-bold text-[#4C4541] dark:text-[#FCF0DA]">{totalSubmissions}</dd>
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
                      <dd className="text-base font-bold text-amber-600 dark:text-amber-400">
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
                      <dd className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {confirmedSubmissions}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {!rubric && !loadingList && (
                <p className="mt-3 text-xs text-[#AEAC78] border-t border-[#AEAC78]/20 pt-2">
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
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
              {/* Left Submissions Roster Master List */}
              <div className="xl:col-span-4 bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 shadow-xs flex flex-col min-w-0 overflow-hidden">
                <div className="p-3 border-b border-[#AEAC78]/30 dark:border-[#AEAC78]/20 bg-[#FCF0DA]/40 dark:bg-[#2C2623]/60 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] text-xs uppercase tracking-wider">
                      Cohort Submissions ({submissions.length})
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

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#AEAC78] absolute left-2.5 top-2.5" />
                    <input
                      aria-label="Search submissions"
                      type="text"
                      placeholder="Search student ID, name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded-lg text-xs placeholder-[#8F8782] text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200"
                    />
                  </div>
                  <label className="mt-3 block text-xs font-medium text-[#6B625B] dark:text-[#D8CEBA]">
                    Grade status
                    <select
                      aria-label="Filter by grade status"
                      className="mt-1 w-full rounded-lg border border-[#AEAC78]/60 bg-[#FFFDF9] dark:bg-[#2C2623] p-2 text-xs text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:ring-2 focus:ring-[#F2C46A] transition-all duration-200"
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
                <div className="flex-1 max-h-96 xl:max-h-none overflow-y-auto divide-y divide-[#AEAC78]/20">
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
                            'w-full text-left p-3 cursor-pointer text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
                            isSelected
                              ? 'bg-[#FCF0DA]/70 dark:bg-[#2C2623] border-l-4 border-[#F2C46A] ring-1 ring-[#F2C46A]/40 shadow-sm'
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

                            <div className="text-right">
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

              {/* Right Pane: Split Detail Workstation */}
              <div className="xl:col-span-8 flex flex-col gap-4 min-w-0">
                {!selectedSubmissionId ? (
                  <div className="p-4">
                    <EmptyState
                      title="Select a submission"
                      description="Select a submission from the list to see its source, evidence and grade."
                      icon={FileSearch}
                    />
                  </div>
                ) : (
                  <>
                    <GradingJobPanel
                      key={`${assignmentBase}/${selectedSubmissionId}`}
                      base={assignmentBase}
                      submissionId={selectedSubmissionId}
                      onFinished={async () => {
                        await loadSubmissionDetail();
                        await loadAssignmentData();
                      }}
                    />

                    {/* Top Row: Source Code Viewer & Evidence Inspector */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                      {/* Code Viewer */}
                      <div data-testid="code-viewer" className="h-96 min-w-0 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between pb-1.5 text-xs text-[#AEAC78]">
                          <div className="flex items-center space-x-1.5">
                            <span className="font-semibold text-[#4C4541] dark:text-[#FCF0DA]">Source:</span>
                            <code className="bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] px-1.5 py-0.5 rounded font-mono border border-[#AEAC78]/30">
                              {selectedSubmission?.original_filename || 'solution.py'}
                            </code>
                          </div>
                          <span className="text-[#AEAC78] font-mono text-[11px]">
                            Student ID: <code>{selectedSubmission?.student_identifier || selectedSubmissionId}</code>
                          </span>
                        </div>
                        {loadingDetail ? (
                          <div className="flex-1 bg-[#2C2623] rounded-xl border border-[#AEAC78]/40 flex items-center justify-center text-[#AEAC78] text-xs font-mono">
                            Loading submission artifacts...
                          </div>
                        ) : (
                          <div className="flex-1 min-h-0">
                            <CodeViewer
                              code={submissionCode}
                              filename={selectedSubmission?.original_filename || 'solution.py'}
                            />
                          </div>
                        )}
                      </div>

                      {/* Evidence Inspector */}
                      <div data-testid="evidence-inspector" className="h-96 min-w-0 overflow-hidden">
                        <EvidenceInspector evidence={evidenceList} />
                      </div>
                    </div>

                    {/* Bottom Row: Deterministic Grade Overrides & AI Feedback Draft */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                      {/* Grade Override Panel */}
                      <div className="min-w-0">
                        <GradeOverridePanel
                          key={selectedSubmissionId}
                          grade={submissionGrade}
                          onEvaluate={handleEvaluateGrade}
                          onOverride={handleOverrideGrade}
                        />
                      </div>

                      {/* AI Feedback Draft Editor */}
                      <div data-testid="feedback-draft-editor" className="min-w-0 min-h-96">
                        <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-[#4C4541] dark:text-[#FCF0DA] px-1">
                          <span>AI Feedback Draft & Suggestions</span>
                          <span className="text-[#AEAC78] font-mono text-[10px]">Human-in-the-Loop Review</span>
                        </div>
                        <FeedbackDraftEditor
                          key={selectedSubmissionId}
                          grade={submissionGrade}
                          onGenerate={handleGenerateFeedback}
                          onSaveFeedback={handleSaveFeedback}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
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
