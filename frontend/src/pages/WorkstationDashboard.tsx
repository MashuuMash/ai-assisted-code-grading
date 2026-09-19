import React, { useEffect, useState } from 'react';
import {
  Archive,
  BookOpen,
  Bot,
  Download,
  FileSearch,
  GraduationCap,
  RefreshCw,
  Search,
  ShieldAlert,
  Sliders,
  Users,
} from 'lucide-react';
import { api } from '../api/client';
import { BatchIngestModal } from '../components/BatchIngestModal';
import { CodeViewer } from '../components/CodeViewer';
import { EvidenceInspector } from '../components/EvidenceInspector';
import { FeedbackDraftEditor } from '../components/FeedbackDraftEditor';
import { GradeOverridePanel } from '../components/GradeOverridePanel';
import { Navbar } from '../components/Navbar';
import { RubricManager } from '../components/RubricManager';
import { SimilarityWorkbench } from '../components/SimilarityWorkbench';
import {
  Assignment,
  ClassCohort,
  Course,
  Rubric,
  Submission,
  SubmissionEvidence,
  SubmissionGrade,
} from '../types';

type ActiveTab = 'grading' | 'rubric' | 'similarity';

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
  const [loadingList, setLoadingList] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // 1. Initial Load: Courses
  useEffect(() => {
    const loadCourses = async () => {
      try {
        const list = await api.courses.list();
        setCourses(list);
        if (list.length > 0) {
          setSelectedCourseId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load courses', err);
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
      }
    };
    loadAssignments();
  }, [selectedCourseId, selectedClassId]);

  // 4. Assignment changed: load submissions & rubric
  const loadAssignmentData = async () => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId) {
      setSubmissions([]);
      setRubric(null);
      setSelectedSubmissionId(null);
      return;
    }
    setLoadingList(true);
    try {
      const [subsList, rubData] = await Promise.all([
        api.submissions.list(selectedCourseId, selectedClassId, selectedAssignmentId),
        api.rubrics.get(selectedCourseId, selectedClassId, selectedAssignmentId).catch(() => null),
      ]);

      setSubmissions(subsList);
      setRubric(rubData);
      if (subsList.length > 0) {
        setSelectedSubmissionId(subsList[0].id);
      } else {
        setSelectedSubmissionId(null);
      }
    } catch (err) {
      console.error('Failed to load assignment data', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadAssignmentData();
  }, [selectedCourseId, selectedClassId, selectedAssignmentId]);

  // 5. Selected Submission changed: load code, evidence, and grade
  const loadSubmissionDetail = async () => {
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

      setSubmissionCode(code);
      setEvidenceList(evList);
      setSubmissionGrade(grade);
    } catch (err) {
      console.error('Failed to load submission details', err);
    } finally {
      setLoadingDetail(false);
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
      await api.aiDetector.detect(
        selectedCourseId,
        selectedClassId,
        selectedAssignmentId,
        selectedSubmissionId
      );
      await loadSubmissionDetail();
    } finally {
      setDetectingAi(false);
    }
  };


  const handleExportCsv = () => {
    if (!selectedCourseId || !selectedClassId || !selectedAssignmentId) return;
    const url = api.rubrics.exportGradebookCsvUrl(
      selectedCourseId,
      selectedClassId,
      selectedAssignmentId
    );
    window.open(url, '_blank');
  };

  const filteredSubmissions = submissions.filter((s) => {
    const query = searchQuery.toLowerCase();
    return (
      s.student_identifier.toLowerCase().includes(query) ||
      (s.student_name && s.student_name.toLowerCase().includes(query)) ||
      s.original_filename.toLowerCase().includes(query) ||
      s.id.toString().includes(query)
    );
  });

  const selectedSubmission = submissions.find((s) => s.id === selectedSubmissionId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      <Navbar />

      {/* Top Selector Ribbon */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center space-x-3 text-xs">
            {/* Course Selector */}
            <div className="flex items-center space-x-1.5">
              <GraduationCap className="w-4 h-4 text-slate-400" />
              <select
                value={selectedCourseId || ''}
                onChange={(e) => setSelectedCourseId(Number(e.target.value))}
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
                value={selectedClassId || ''}
                onChange={(e) => setSelectedClassId(Number(e.target.value))}
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
                value={selectedAssignmentId || ''}
                onChange={(e) => setSelectedAssignmentId(Number(e.target.value))}
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
          <div className="flex items-center space-x-2">
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
              title="Run CodeBERT AI-generated code detection on current submission"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{detectingAi ? 'Detecting...' : 'Detect AI (CodeBERT)'}</span>
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
        <div className="flex space-x-6 mt-3 border-t border-slate-100 pt-2 text-xs">
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
        {activeTab === 'rubric' && (
          <div className="max-w-4xl mx-auto w-full">
            <RubricManager
              courseId={selectedCourseId!}
              classId={selectedClassId!}
              assignmentId={selectedAssignmentId!}
              rubric={rubric}
              onRubricUpdated={loadAssignmentData}
            />
          </div>
        )}

        {activeTab === 'similarity' && (
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
          <div className="flex-1 grid grid-cols-12 gap-4 h-[calc(100vh-185px)] overflow-hidden">
            {/* Left Submissions Roster Master List */}
            <div className="col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                    Cohort Submissions ({submissions.length})
                  </span>
                  <button
                    onClick={loadAssignmentData}
                    className="text-slate-400 hover:text-slate-700 p-1"
                    title="Reload submissions"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search student ID, name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-indigo-500"
                  />
                </div>
              </div>

              {/* Roster List items */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {loadingList ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    Loading submissions...
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    No submissions found. Import a ZIP batch to start.
                  </div>
                ) : (
                  filteredSubmissions.map((sub) => {
                    const isSelected = sub.id === selectedSubmissionId;
                    const finalScore = sub.grade?.final_total_score;
                    const suggestedScore = sub.grade?.suggested_total_score;
                    const displayScore = finalScore !== null && finalScore !== undefined ? finalScore : suggestedScore;
                    const isConfirmed = sub.grade?.status === 'confirmed';

                    return (
                      <div
                        key={sub.id}
                        onClick={() => setSelectedSubmissionId(sub.id)}
                        className={`p-3 cursor-pointer transition-colors text-xs ${
                          isSelected
                            ? 'bg-indigo-50/90 border-l-4 border-indigo-600'
                            : 'hover:bg-slate-50'
                        }`}
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
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Split Detail Workstation */}
            <div className="col-span-8 flex flex-col h-full gap-4 overflow-hidden">
              {/* Top Row: Source Code Viewer & Evidence Inspector */}
              <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
                {/* Code Viewer */}
                <div className="h-full overflow-hidden">
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
                <div className="h-full overflow-hidden">
                  <EvidenceInspector evidence={evidenceList} />
                </div>
              </div>

              {/* Bottom Row: Deterministic Grade Overrides & AI Feedback Draft */}
              <div className="grid grid-cols-2 gap-4 h-64 shrink-0 overflow-hidden">
                {/* Grade Override Panel */}
                <div className="h-full overflow-y-auto">
                  <GradeOverridePanel
                    grade={submissionGrade}
                    onEvaluate={handleEvaluateGrade}
                    onOverride={handleOverrideGrade}
                  />
                </div>

                {/* AI Feedback Draft Editor */}
                <div className="h-full overflow-hidden">
                  <FeedbackDraftEditor
                    grade={submissionGrade}
                    onGenerate={handleGenerateFeedback}
                    onSaveFeedback={handleSaveFeedback}
                  />
                </div>
              </div>
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
