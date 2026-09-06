import React, { useState, useEffect } from 'react';
import {
  Bot,
  Search,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { ActionFooter } from '../components/ActionFooter';
import { CodeViewer } from '../components/CodeViewer';
import { api } from '../services/api';
import { SubmissionDetail, SubmissionListItem } from '../types';

interface GradingWorkspacePageProps {
  initialSubmissionId: string | null;
  submissionsList: SubmissionListItem[];
  onRefreshList: () => void;
}

export const GradingWorkspacePage: React.FC<GradingWorkspacePageProps> = ({
  initialSubmissionId,
  submissionsList,
  onRefreshList,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSubmissionId || (submissionsList[0]?.id ?? null)
  );
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedId) {
      loadSubmission(selectedId);
    }
  }, [selectedId]);

  const loadSubmission = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await api.getSubmissionDetail(id);
      setSubmission(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveReview = async (
    finalGrade: number,
    status: string,
    feedback: string,
    notes: string
  ) => {
    if (!submission) return;
    setIsSaving(true);
    try {
      await api.submitReview(submission.id, {
        final_grade: finalGrade,
        status,
        feedback_override: feedback,
        internal_notes: notes,
      });
      await loadSubmission(submission.id);
      onRefreshList();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextStudent = () => {
    const currentIndex = submissionsList.findIndex((s) => s.id === selectedId);
    if (currentIndex >= 0 && currentIndex < submissionsList.length - 1) {
      setSelectedId(submissionsList[currentIndex + 1].id);
    }
  };

  const filteredRoster = submissionsList.filter(
    (s) =>
      s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.student_identifier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] pb-14">
      {/* Main 3-Pane Work Area */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0 overflow-hidden">
        {/* PANE 1: Left Roster List (Cols 3) */}
        <div className="col-span-12 md:col-span-3 bg-white border border-[#E2E8F0] rounded flex flex-col overflow-hidden shadow-2xs">
          <div className="p-2.5 border-b border-[#E2E8F0] bg-slate-50">
            <div className="relative">
              <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredRoster.map((sub) => {
              const isSelected = sub.id === selectedId;
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedId(sub.id)}
                  className={`p-2.5 cursor-pointer text-xs transition-colors flex items-center justify-between ${
                    isSelected
                      ? 'bg-blue-50/70 border-l-3 border-primary'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="font-medium text-slate-900 leading-snug">
                      {sub.student_name}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {sub.student_identifier}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-slate-800">
                      {sub.final_grade !== undefined ? `${sub.final_grade}/10` : '—'}
                    </div>
                    <span
                      className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-mono ${
                        sub.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sub.status === 'FLAGGED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANE 2: Center Code Viewer (Cols 5) */}
        <div className="col-span-12 md:col-span-5 flex flex-col min-h-0">
          <div className="flex-1 min-h-0">
            {isLoading ? (
              <div className="h-full bg-white border border-[#E2E8F0] rounded flex items-center justify-center text-slate-400 text-xs font-mono">
                Loading submission telemetry...
              </div>
            ) : submission ? (
              <CodeViewer
                files={submission.files}
                qualityMetric={submission.quality_metric}
                testDetails={submission.execution_result?.test_details}
              />
            ) : (
              <div className="h-full bg-white border border-[#E2E8F0] rounded flex items-center justify-center text-slate-400 text-xs font-mono">
                Select a student from the roster to view submission code
              </div>
            )}
          </div>

          {/* Test Runner Terminal Output Tray */}
          {submission?.execution_result && (
            <div className="h-36 bg-slate-900 text-slate-100 rounded border border-slate-800 p-3 mt-2 flex flex-col font-mono text-[11px] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span>Pytest Execution Harness</span>
                </div>
                <div>
                  {submission.execution_result.passed_count} /{' '}
                  {submission.execution_result.total_count} Passed (
                  {submission.execution_result.execution_time_ms}ms)
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 pt-1.5">
                {submission.execution_result.test_details.map((t, idx) => (
                  <div key={idx} className="flex items-start justify-between">
                    <span
                      className={
                        t.status === 'PASSED' ? 'text-emerald-400' : 'text-red-400 font-semibold'
                      }
                    >
                      [{t.status}] {t.name}
                    </span>
                    <span className="text-slate-500 text-[10px]">{t.duration_ms}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* PANE 3: Right Evaluation & AI Grounded Panel (Cols 4) */}
        <div className="col-span-12 md:col-span-4 bg-white border border-[#E2E8F0] rounded flex flex-col min-h-0 overflow-y-auto p-4 space-y-4 shadow-2xs">
          {submission ? (
            <>
              {/* Telemetry Badges */}
              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Structural & Static Analysis
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400">Max Complexity</div>
                    <div className="font-bold text-slate-800">
                      {submission.quality_metric?.cyclomatic_complexity_max || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400">Max Nesting Depth</div>
                    <div className="font-bold text-slate-800">
                      {submission.quality_metric?.max_nesting_depth || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400">Ruff Lint Warnings</div>
                    <div className="font-bold text-amber-700">
                      {submission.quality_metric?.ruff_violations.length || 0}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400">Lines of Code</div>
                    <div className="font-bold text-slate-800">
                      {submission.quality_metric?.loc_total || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Heuristics Card */}
              {submission.ai_detection_signal && (
                <div className="p-3 rounded border border-blue-200 bg-blue-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-primary text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Code Heuristic Signal</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700">
                      {submission.ai_detection_signal.confidence_tier} Risk
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">
                    {submission.ai_detection_signal.disclaimer}
                  </p>
                </div>
              )}

              {/* Rubric Breakdown */}
              <div>
                <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2">
                  Rubric Scoring Breakdown
                </div>
                <div className="space-y-1.5 text-xs">
                  {submission.lecturer_review?.grade_adjustments &&
                    Object.entries(submission.lecturer_review.grade_adjustments).map(
                      ([key, val]: any) => (
                        <div
                          key={key}
                          className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200"
                        >
                          <span className="text-slate-700">{key}</span>
                          <span className="font-mono font-semibold text-slate-900">
                            {typeof val === 'object' ? `${val.points} / ${val.max_points}` : String(val)}
                          </span>
                        </div>
                      )
                    )}
                </div>
              </div>

              {/* Grounded AI Draft Feedback */}
              {submission.ai_feedback_draft && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-1.5 text-slate-700 text-xs font-semibold">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                    <span>Evidence-Grounded Feedback Draft</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 space-y-2">
                    <p className="font-medium text-slate-900">
                      {submission.ai_feedback_draft.summary}
                    </p>
                    {submission.ai_feedback_draft.weaknesses.length > 0 && (
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Actionable Items</div>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                          {submission.ai_feedback_draft.weaknesses.map((w, idx) => (
                            <li key={idx}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-slate-400 py-10 font-mono text-xs">
              No submission selected
            </div>
          )}
        </div>
      </div>

      {/* Persistent Bottom Action Footer */}
      <ActionFooter
        submission={submission}
        onSaveReview={handleSaveReview}
        onNextStudent={handleNextStudent}
        isSaving={isSaving}
      />
    </div>
  );
};
