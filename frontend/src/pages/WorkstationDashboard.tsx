import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  BookOpen,
  Bot,
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
import { api } from '../api/client';
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

export const WorkstationDashboard: React.FC = () => {
  // Navigation hierarchy
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);

  const [classes, setClasses] = useState<ClassCohort[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  // Assignment data
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);

  // Active submission inspection
  const [submissionCode, setSubmissionCode] = useState<string>('');
  const [evidenceList, setEvidenceList] = useState<SubmissionEvidence[]>([]);
  const [submissionGrade, setSubmissionGrade] = useState<SubmissionGrade | null>(null);

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
  const loadAssignmentData = async () => {
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
  };

  useEffect(() => {
    loadAssignmentData();
  }, [selectedCourseId, selectedClassId, selectedAssignmentId]);

  // 5. Selected Submission changed: load code, evidence, and grade
  const loadSubmissionDetail = async () => {
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
  };

  useEffect(() => {
    loadSubmissionDetail();
  }, [selectedSubmissionId]);

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

  const handleOverrideGrade = async (data: any) => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId || !selectedSubmissionId) return;
    await api.rubrics.overrideGrade(
      selectedCourseId,
      selectedClassId,
      selectedAssignmentId,
      selectedSubmissionId,
      data
    );
    await loadSubmissionDetail();
    await loadAssignmentData();
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

  return (
    <div className="min-h-dvh bg-slate-100 flex flex-col font-sans text-slate-800">
      <Navbar />

      {exportError && (
        <div role="alert" className="bg-rose-50 px-6 py-2 text-xs text-rose-700">
          {exportError}
        </div>
      )}

      {/* Top Selector Ribbon */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm min-w-0">
            {/* Course Selector */}
            <div className="flex items-center space-x-1.5">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              <select
                aria-label="Selected course"
                value={selectedCourseId || ''}
                onChange={(e) => {
                  clearAssignmentView();
                  setSelectedClassId(null);
                  setSelectedAssignmentId(null);
                  setSelectedCourseId(Number(e.target.value));
                }}
                className="bg-slate-50 border border-slate-300 font-bold text-slate-800 py-1 px-2.5 rounded-lg focus:outline-indigo-500"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-300">/</span>

            {/* Class Cohort Selector */}
            <div className="flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-slate-400" />
              <select
                aria-label="Selected class"
                value={selectedClassId || ''}
                onChange={(e) => {
                  clearAssignmentView();
                  setSelectedAssignmentId(null);
                  setSelectedClassId(Number(e.target.value));
                }}
                className="bg-slate-50 border border-slate-300 font-bold text-slate-800 py-1 px-2.5 rounded-lg focus:outline-indigo-500"
              >
                {classes.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name} ({cl.semester} {cl.year})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-300">/</span>

            {/* Assignment Selector */}
            <div className="flex items-center space-x-1.5">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <select
                aria-label="Selected assignment"
                value={selectedAssignmentId || ''}
                onChange={(e) => {
                  clearAssignmentView();
                  setSelectedAssignmentId(Number(e.target.value));
                }}
                className="bg-slate-50 border border-slate-300 font-bold text-slate-800 py-1 px-2.5 rounded-lg focus:outline-indigo-500 max-w-xs"
              >
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
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
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors border border-indigo-200 shadow-sm"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Import LMS ZIP</span>
            </button>

            <button
              onClick={handleDetectAi}
              disabled={!selectedSubmissionId || detectingAi}
              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors border border-purple-200 shadow-sm"
              title="Run experimental code-style analysis; the result cannot prove authorship"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{detectingAi ? 'Analyzing...' : 'AI Style Signal'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              disabled={!selectedAssignmentId}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Gradebook CSV</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        {actionError && <p role="alert" className="mt-2 text-sm text-rose-700">{actionError}</p>}
        <div aria-label="Workspace sections" className="flex flex-wrap gap-4 mt-3 border-t border-slate-100 pt-3 text-sm">
          <button disabled={!selectedAssignmentId} onClick={() => setActiveTab('assignment')} className={`pb-1 font-bold border-b-2 disabled:opacity-40 ${activeTab === 'assignment' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
            Assignment & Tests
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`pb-1 font-bold tracking-tight transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'setup' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Set Up Course & Class</span>
          </button>
          <button
            onClick={() => setActiveTab('grading')}
            className={`pb-1 font-bold tracking-tight transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'grading'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSearch className="w-4 h-4" />
            <span>Grading Queue & Evidence Inspector</span>
          </button>

          <button
            disabled={!selectedAssignmentId}
            onClick={() => setActiveTab('rubric')}
            className={`pb-1 font-bold tracking-tight transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'rubric'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Rubric & Formulas</span>
          </button>

          <button
            disabled={!selectedAssignmentId}
            onClick={() => setActiveTab('similarity')}
            className={`pb-1 font-bold tracking-tight transition-all border-b-2 flex items-center space-x-1.5 ${
              activeTab === 'similarity'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Similarity & Integrity</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 p-5 overflow-hidden flex flex-col">
        {workspaceError && <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{workspaceError}</p>}
        {selectedAssignment && activeTab === 'grading' && <section aria-label="Assignment progress" className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold text-balance">{selectedAssignment.title}</h2>
          <p className="mt-1 text-sm text-slate-600 text-pretty">Review test evidence, adjust scores if needed, then confirm each grade before exporting.</p>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm tabular-nums">
            <div><dt className="text-slate-500">Submissions</dt><dd className="text-lg font-semibold">{submissions.length}</dd></div>
            <div><dt className="text-slate-500">Awaiting review</dt><dd className="text-lg font-semibold">{submissions.filter(s => s.grade && s.grade.status !== 'confirmed').length}</dd></div>
            <div><dt className="text-slate-500">Confirmed grades</dt><dd className="text-lg font-semibold">{submissions.filter(s => s.grade?.status === 'confirmed').length}</dd></div>
          </dl>
          {!rubric && !loadingList && <p className="mt-3 text-sm text-slate-600">Set up a rubric before grading. <button className="text-indigo-700 underline" onClick={() => setActiveTab('rubric')}>Configure rubric</button></p>}
        </section>}
        {activeTab === 'setup' && (
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
        )}
        {activeTab === 'assignment' && selectedAssignment && selectedCourseId && selectedClassId && (
          <div className="max-w-4xl mx-auto w-full space-y-5 overflow-y-auto min-h-0">
            <AssignmentEditor key={selectedAssignment.id} courseId={selectedCourseId} classId={selectedClassId} assignment={selectedAssignment}
              onSaved={(updated) => setAssignments((previous) => previous.map((item) => item.id === updated.id ? updated : item))} />
            <TestCaseManager key={assignmentBase} base={assignmentBase} />
          </div>
        )}
        {activeTab === 'rubric' && selectedAssignmentId && (
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
        )}

        {activeTab === 'similarity' && selectedAssignmentId && (
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
        )}

        {activeTab === 'grading' && (
          <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
            {/* Left Submissions Roster Master List */}
            <div className="xl:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-w-0 overflow-hidden">
              <div className="p-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Cohort Submissions ({submissions.length})
                  </span>
                  <button
                    onClick={loadAssignmentData}
                    className="text-slate-400 hover:text-slate-700 p-1"
                    title="Reload submissions"
                    aria-label="Reload submissions"
                    disabled={loadingList || !selectedAssignmentId}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    aria-label="Search submissions"
                    type="text"
                    placeholder="Search student ID, name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-indigo-500"
                  />
                </div>
                <label className="mt-3 block text-sm text-slate-600">Grade status
                  <select aria-label="Filter by grade status" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-slate-800" value={gradeFilter} onChange={e => setGradeFilter(e.target.value)}>
                    <option value="all">All submissions</option><option value="ungraded">Not graded</option><option value="review">Awaiting review</option><option value="confirmed">Confirmed</option>
                  </select>
                </label>
              </div>

              {/* Roster List items */}
              <div className="flex-1 max-h-96 xl:max-h-none overflow-y-auto divide-y divide-slate-100">
                {loadingList ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Loading submissions...
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="p-6 text-center text-sm text-slate-600 space-y-3">
                    <p>{!selectedAssignmentId ? 'Create or select an assignment to start.' : submissions.length ? 'No submissions match these filters.' : 'No submissions yet. Configure tests and rubric, then import student work.'}</p>
                    {!selectedAssignmentId ? <button className="text-indigo-700 underline" onClick={() => setActiveTab('setup')}>Set up workspace</button> : submissions.length ? <button className="text-indigo-700 underline" onClick={() => { setSearchQuery(''); setGradeFilter('all'); }}>Clear filters</button> : <button className="text-indigo-700 underline" onClick={() => setIsBatchModalOpen(true)}>Import submissions</button>}
                  </div>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const isSelected = sub.id === selectedSubmissionId;
                    const finalScore = sub.grade?.final_total_score;
                    const suggestedScore = sub.grade?.suggested_total_score;
                    const displayScore = finalScore !== null && finalScore !== undefined ? finalScore : suggestedScore;
                    const isConfirmed = sub.grade?.status === 'confirmed';

                    return (
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        key={sub.id}
                        onClick={() => setSelectedSubmissionId(sub.id)}
                        className={cn('w-full text-left p-3 cursor-pointer text-sm',
                          isSelected
                            ? 'bg-indigo-50/90 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-slate-900">
                              {sub.student_name || sub.student_identifier || `Submission #${sub.id}`}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                              ID: {sub.student_identifier || 'N/A'} - {sub.original_filename}
                            </div>
                          </div>

                          <div className="text-right">
                            {displayScore !== undefined && displayScore !== null ? (
                              <span className="font-mono font-bold text-xs text-slate-800">
                                {displayScore.toFixed(2)} pts
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">ungraded</span>
                            )}
                            {sub.grade && (
                              <div className="mt-0.5">
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                                    isConfirmed
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {sub.grade.status}
                                </span>
                              </div>
                            )}
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
              {!selectedSubmissionId ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
                <h2 className="text-lg font-semibold text-balance">Your review workspace</h2>
                <p className="mt-2 text-sm text-pretty">Select a submission from the list to see its source, evidence and grade.</p>
              </div> : <>
              {selectedSubmissionId && <GradingJobPanel key={`${assignmentBase}/${selectedSubmissionId}`} base={assignmentBase} submissionId={selectedSubmissionId}
                onFinished={async () => { await loadSubmissionDetail(); await loadAssignmentData(); }} />}
              {/* Top Row: Source Code Viewer & Evidence Inspector */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
                {/* Code Viewer */}
                <div className="h-96 min-w-0 overflow-hidden">
                  {loadingDetail ? (
                    <div className="h-full bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 text-xs font-mono">
                      Loading submission artifacts...
                    </div>
                  ) : (
                    <CodeViewer
                      code={submissionCode}
                      filename={selectedSubmission?.original_filename || 'solution.py'}
                    />
                  )}
                </div>

                {/* Evidence Inspector */}
                <div className="h-96 min-w-0 overflow-hidden">
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
                <div className="min-w-0 min-h-96">
                  <FeedbackDraftEditor
                    key={selectedSubmissionId}
                    grade={submissionGrade}
                    onGenerate={handleGenerateFeedback}
                    onSaveFeedback={handleSaveFeedback}
                  />
                </div>
              </div>
              </>}
            </div>
          </div>
        )}
      </main>

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
