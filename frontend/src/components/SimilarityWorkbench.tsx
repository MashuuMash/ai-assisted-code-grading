import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Columns,
  Eye,
  Flag,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { getDemoSubmissionCode } from '../data/demoFixtures';
import { ComparisonReviewStatus, SimilarityComparison, SimilarityReport, Submission } from '../types';
import { SimilarityCompareModal } from './SimilarityCompareModal';

interface SimilarityWorkbenchProps {
  courseId: number;
  classId: number;
  assignmentId: number;
  submissions?: Submission[];
  onSelectSubmissions?: (subAId: number, subBId: number) => void;
}

export const SimilarityWorkbench: React.FC<SimilarityWorkbenchProps> = ({
  courseId,
  classId,
  assignmentId,
  submissions = [],
  onSelectSubmissions,
}) => {
  const [reports, setReports] = useState<SimilarityReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SimilarityReport | null>(null);
  const [threshold, setThreshold] = useState<number>(50.0);
  const [running, setRunning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [modalCompId, setModalCompId] = useState<number | null>(null);
  const [diffCodes, setDiffCodes] = useState<{ codeA: string; codeB: string; loading: boolean }>({
    codeA: '',
    codeB: '',
    loading: false,
  });
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>({});

  const getSubmissionLabel = (subId: number) => {
    const found = submissions.find((s) => s.id === subId);
    return found?.student_name ? `${found.student_name} (#${subId})` : `Submission #${subId}`;
  };

  const handleOpenCompareModal = async (comp: SimilarityComparison) => {
    setModalCompId(comp.id);
    setDiffCodes({ codeA: '', codeB: '', loading: true });
    try {
      const [codeA, codeB] = await Promise.all([
        api.submissions
          .getSource(courseId, classId, assignmentId, comp.submission_a_id)
          .catch(() => getDemoSubmissionCode(comp.submission_a_id)),
        api.submissions
          .getSource(courseId, classId, assignmentId, comp.submission_b_id)
          .catch(() => getDemoSubmissionCode(comp.submission_b_id)),
      ]);
      setDiffCodes({ codeA, codeB, loading: false });
    } catch {
      setDiffCodes({
        codeA: getDemoSubmissionCode(comp.submission_a_id),
        codeB: getDemoSubmissionCode(comp.submission_b_id),
        loading: false,
      });
    }
  };

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.similarity.listReports(courseId, classId, assignmentId);
      setReports(list);
      if (list.length > 0) {
        // Fetch detailed report for the most recent one
        const detail = await api.similarity.getReport(courseId, classId, assignmentId, list[0].id);
        setSelectedReport(detail);
      } else {
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to fetch similarity reports', err);
    } finally {
      setLoading(false);
    }
  }, [courseId, classId, assignmentId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleRunSimilarity = async () => {
    setRunning(true);
    try {
      await api.similarity.run(courseId, classId, assignmentId, threshold);
      await fetchReports();
    } catch (err) {
      console.error('Similarity run failed', err);
    } finally {
      setRunning(false);
    }
  };

  const handleSelectReport = async (reportId: number) => {
    setLoading(true);
    try {
      const detail = await api.similarity.getReport(courseId, classId, assignmentId, reportId);
      setSelectedReport(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (
    comparisonId: number,
    status: ComparisonReviewStatus,
    notes?: string
  ) => {
    if (!selectedReport) return;
    setActionLoading(comparisonId);
    try {
      const updated = await api.similarity.reviewComparison(
        courseId,
        classId,
        assignmentId,
        selectedReport.id,
        comparisonId,
        { status, review_notes: notes || '' }
      );

      // Update in state
      setSelectedReport((prev) => {
        if (!prev || !prev.comparisons) return prev;
        return {
          ...prev,
          comparisons: prev.comparisons.map((c) => (c.id === comparisonId ? updated : c)),
        };
      });
    } finally {
      setActionLoading(null);
    }
  };

  const comparisons = selectedReport?.comparisons || [];

  return (
    <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 shadow-xs p-4 text-xs flex flex-col h-full overflow-hidden text-[#4C4541] dark:text-[#FCF0DA]">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-3 border-b border-[#AEAC78]/30 dark:border-[#AEAC78]/20 flex-wrap gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
          <h3 className="text-xs font-bold text-[#4C4541] dark:text-[#FCF0DA] uppercase tracking-wider">
            Cohort Similarity & Academic Integrity
          </h3>
          <span className="text-[10px] bg-[#FCF0DA]/50 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 px-2 py-0.5 rounded font-mono">
            {selectedReport?.engine === 'jplag' ? 'JPlag 6.2' : 'Token winnowing'}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-mono text-[#4C4541] dark:text-[#FCF0DA]">
            <span>Threshold:</span>
            <input
              type="number"
              min="10"
              max="100"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 50)}
              className="w-14 px-1.5 py-0.5 border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] rounded text-center text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#F2C46A]"
            />
            <span>%</span>
          </div>

          <button
            onClick={handleRunSimilarity}
            disabled={running}
            className="px-3.5 py-1.5 bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold rounded-lg inline-flex items-center space-x-1.5 shadow-xs border border-[#AEAC78]/60 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Running...' : 'Run Similarity Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Report selector & metrics summary */}
      {selectedReport && (
        <div className="py-2.5 px-3 bg-[#FCF0DA]/40 dark:bg-[#2C2623]/60 border-b border-[#AEAC78]/30 flex items-center justify-between text-[11px] shrink-0 text-[#4C4541] dark:text-[#FCF0DA]">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70">Submissions: </span>
              <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] font-mono">
                {selectedReport.submission_count}
              </span>
            </div>
            <div>
              <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70">Average: </span>
              <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] font-mono">
                {selectedReport.avg_similarity?.toFixed(1) || '0.0'}%
              </span>
            </div>
            <div>
              <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70">Max Match: </span>
              <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                {selectedReport.max_similarity?.toFixed(1) || '0.0'}%
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {reports.length > 1 ? (
              <select
                value={selectedReport.id}
                onChange={(e) => handleSelectReport(Number(e.target.value))}
                className="bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/40 rounded px-2 py-0.5 font-mono text-[11px] text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:ring-2 focus:ring-[#F2C46A]"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    Report #{r.id}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70 font-mono">Report #{selectedReport.id}</span>
            )}
            <span className="text-[10px] bg-[#AEAC78]/25 text-[#2E4324] dark:bg-[#AEAC78]/30 dark:text-[#FCF0DA] font-bold px-1.5 py-0.5 rounded border border-[#AEAC78]/50">
              {selectedReport.status}
            </span>
          </div>
        </div>
      )}

      {/* Comparisons list */}
      <div className="flex-1 overflow-y-auto pt-2 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-[#4C4541]/70 dark:text-[#FCF0DA]/70 font-mono">Loading similarity data...</div>
        ) : comparisons.length === 0 ? (
          <div className="text-center py-10 text-[#4C4541]/70 dark:text-[#FCF0DA]/70">
            No similarity comparisons available. Click "Run Similarity Analysis" to compare submissions.
          </div>
        ) : (
          comparisons.map((comp) => {
            const pct = comp.similarity_percentage;
            const isHigh = pct >= 70;
            const isMedium = pct >= 40 && pct < 70;
            const isActionBusy = actionLoading === comp.id;

            const customNote = draftNotes[comp.id] ?? '';

            return (
              <div
                key={comp.id}
                onClick={() => handleOpenCompareModal(comp)}
                className="p-3 rounded-lg border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FCF0DA]/20 dark:bg-[#2C2623]/60 hover:border-[#F2C46A] transition-colors text-[#4C4541] dark:text-[#FCF0DA] cursor-pointer"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="font-mono font-bold text-[#4C4541] dark:text-[#FCF0DA] text-xs">
                      {getSubmissionLabel(comp.submission_a_id)}{' '}
                      <span className="text-[#4C4541]/60 dark:text-[#FCF0DA]/60">vs</span>{' '}
                      {getSubmissionLabel(comp.submission_b_id)}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-[#FCF0DA]/50 dark:bg-[#2C2623] rounded-full h-2 overflow-hidden border border-[#AEAC78]/40">
                        <div
                          className={`h-full rounded-full ${
                            isHigh
                              ? 'bg-rose-500'
                              : isMedium
                              ? 'bg-[#F2C46A]'
                              : 'bg-[#AEAC78]'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          isHigh
                            ? 'text-rose-600 dark:text-rose-400'
                            : isMedium
                            ? 'text-[#6B4307] dark:text-[#F2C46A]'
                            : 'text-[#2E4324] dark:text-[#AEAC78]'
                        }`}
                      >
                        {pct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-[#4C4541]/70 dark:text-[#FCF0DA]/70 font-mono">
                        ({comp.matched_tokens} tokens)
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        comp.status === 'flagged'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : comp.status === 'dismissed'
                          ? 'bg-[#FCF0DA]/60 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40'
                          : 'bg-[#F2C46A]/20 text-[#6B4307] dark:text-[#F2C46A] border border-[#F2C46A]/40'
                      }`}
                    >
                      {comp.status}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCompareModal(comp);
                      }}
                      className="px-2 py-1 rounded border text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer bg-[#FFFDF9] dark:bg-[#38322E] hover:bg-[#F2C46A]/30 text-[#4C4541] dark:text-[#FCF0DA] border-[#AEAC78]/50"
                      title="Compare Submission A and Submission B side-by-side"
                    >
                      <Columns className="w-3 h-3" />
                      <span>Compare Modal</span>
                    </button>

                    {/* Review action buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReview(
                          comp.id,
                          'flagged',
                          customNote.trim() || 'Flagged for academic review'
                        );
                      }}
                      disabled={isActionBusy}
                      className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 rounded border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                      title="Flag candidate pair for investigation"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReview(
                          comp.id,
                          'dismissed',
                          customNote.trim() || 'Verified false positive'
                        );
                      }}
                      disabled={isActionBusy}
                      className="p-1 hover:bg-[#FCF0DA] dark:hover:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA] rounded border border-[#AEAC78]/40 transition-colors cursor-pointer"
                      title="Dismiss match as false positive"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    {onSelectSubmissions && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectSubmissions(comp.submission_a_id, comp.submission_b_id);
                        }}
                        className="p-1 hover:bg-[#F2C46A]/20 text-[#4C4541] dark:text-[#FCF0DA] rounded border border-[#AEAC78]/40 transition-colors cursor-pointer"
                        title="View submissions"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Review Notes */}
                {comp.review_notes && (
                  <p className="mt-1.5 text-[11px] text-[#4C4541]/90 dark:text-[#FCF0DA]/90 italic bg-[#FCF0DA]/40 dark:bg-[#2C2623] p-1.5 rounded border border-[#AEAC78]/30">
                    Instructor Note: {comp.review_notes}
                  </p>
                )}

                {/* Matched Regions */}
                {comp.matched_regions && comp.matched_regions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-[#4C4541]/80 dark:text-[#FCF0DA]/80">
                    <span className="font-semibold text-[#4C4541] dark:text-[#FCF0DA]">Matching Spans:</span>
                    {comp.matched_regions.map((reg, idx) => (
                      <span key={idx} className="bg-[#FCF0DA]/50 dark:bg-[#2C2623] px-1.5 py-0.5 rounded border border-[#AEAC78]/30">
                        A: lines {reg.lines_a[0]}-{reg.lines_a[1]} | B: lines {reg.lines_b[0]}-{reg.lines_b[1]}
                      </span>
                    ))}
                  </div>
                )}

              </div>
            );
          })
        )}
      </div>

      <SimilarityCompareModal
        isOpen={modalCompId !== null}
        comparison={comparisons.find((c) => c.id === modalCompId) ?? null}
        codeA={diffCodes.codeA}
        codeB={diffCodes.codeB}
        loading={diffCodes.loading}
        submissions={submissions}
        initialNote={modalCompId !== null ? draftNotes[modalCompId] ?? '' : ''}
        actionLoading={modalCompId !== null && actionLoading === modalCompId}
        onClose={() => setModalCompId(null)}
        onReview={async (compId, status, notes) => {
          setDraftNotes((prev) => ({ ...prev, [compId]: notes }));
          await handleReview(compId, status, notes);
        }}
        onSelectSubmissions={onSelectSubmissions}
      />
    </div>
  );
};
