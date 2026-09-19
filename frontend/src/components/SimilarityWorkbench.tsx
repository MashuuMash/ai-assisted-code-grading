import React, { useEffect, useState } from 'react';
import {
  Check,
  Eye,
  Flag,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../api/client';
import { ComparisonReviewStatus, SimilarityReport } from '../types';

interface SimilarityWorkbenchProps {
  courseId: number;
  classId: number;
  assignmentId: number;
  onSelectSubmissions?: (subAId: number, subBId: number) => void;
}

export const SimilarityWorkbench: React.FC<SimilarityWorkbenchProps> = ({
  courseId,
  classId,
  assignmentId,
  onSelectSubmissions,
}) => {
  const [reports, setReports] = useState<SimilarityReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<SimilarityReport | null>(null);
  const [threshold, setThreshold] = useState<number>(50.0);
  const [running, setRunning] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchReports = async () => {
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
  };

  useEffect(() => {
    fetchReports();
  }, [courseId, classId, assignmentId]);

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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs flex flex-col h-full overflow-hidden">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2 shrink-0">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Cohort Similarity & Academic Integrity
          </h3>
          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
            JPlag / Winnowing
          </span>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-mono text-slate-600">
            <span>Threshold:</span>
            <input
              type="number"
              min="10"
              max="100"
              step="5"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 50)}
              className="w-14 px-1.5 py-0.5 border border-slate-300 rounded text-center text-xs font-semibold focus:outline-indigo-500"
            />
            <span>%</span>
          </div>

          <button
            onClick={handleRunSimilarity}
            disabled={running}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1.5 shadow-sm transition-colors"
          >
            <Play className={`w-3.5 h-3.5 ${running ? 'animate-spin' : ''}`} />
            <span>{running ? 'Running...' : 'Run Similarity Analysis'}</span>
          </button>
        </div>
      </div>

      {/* Report selector & metrics summary */}
      {selectedReport && (
        <div className="py-2.5 px-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] shrink-0">
          <div className="flex items-center space-x-4">
            <div>
              <span className="text-slate-400">Submissions: </span>
              <span className="font-bold text-slate-700 font-mono">
                {selectedReport.submission_count}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Average: </span>
              <span className="font-bold text-slate-700 font-mono">
                {selectedReport.avg_similarity?.toFixed(1) || '0.0'}%
              </span>
            </div>
            <div>
              <span className="text-slate-400">Max Match: </span>
              <span className="font-bold text-rose-700 font-mono">
                {selectedReport.max_similarity?.toFixed(1) || '0.0'}%
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {reports.length > 1 ? (
              <select
                value={selectedReport.id}
                onChange={(e) => handleSelectReport(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded px-2 py-0.5 font-mono text-[11px] text-slate-700 focus:outline-indigo-500"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    Report #{r.id}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-slate-400 font-mono">Report #{selectedReport.id}</span>
            )}
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
              {selectedReport.status}
            </span>
          </div>
        </div>
      )}

      {/* Comparisons list */}
      <div className="flex-1 overflow-y-auto pt-2 space-y-2">
        {loading ? (
          <div className="text-center py-10 text-slate-400">Loading similarity data...</div>
        ) : comparisons.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            No similarity comparisons available. Click "Run Similarity Analysis" to compare submissions.
          </div>
        ) : (
          comparisons.map((comp) => {
            const pct = comp.similarity_percentage;
            const isHigh = pct >= 70;
            const isMedium = pct >= 40 && pct < 70;
            const isActionBusy = actionLoading === comp.id;

            return (
              <div
                key={comp.id}
                className="p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="font-mono font-bold text-slate-800 text-xs">
                      Submission #{comp.submission_a_id} <span className="text-slate-400">vs</span> #{comp.submission_b_id}
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            isHigh
                              ? 'bg-rose-500'
                              : isMedium
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          isHigh
                            ? 'text-rose-600'
                            : isMedium
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {pct.toFixed(1)}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({comp.matched_tokens} tokens)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        comp.status === 'flagged'
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : comp.status === 'dismissed'
                          ? 'bg-slate-100 text-slate-600 border border-slate-300'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {comp.status}
                    </span>

                    {/* Review action buttons */}
                    <button
                      onClick={() => handleReview(comp.id, 'flagged', 'Flagged for academic review')}
                      disabled={isActionBusy}
                      className="p-1 hover:bg-rose-50 text-rose-600 rounded border border-rose-200 transition-colors"
                      title="Flag candidate pair for investigation"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleReview(comp.id, 'dismissed', 'Verified false positive')}
                      disabled={isActionBusy}
                      className="p-1 hover:bg-slate-100 text-slate-600 rounded border border-slate-200 transition-colors"
                      title="Dismiss match as false positive"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    {onSelectSubmissions && (
                      <button
                        onClick={() => onSelectSubmissions(comp.submission_a_id, comp.submission_b_id)}
                        className="p-1 hover:bg-indigo-50 text-indigo-600 rounded border border-indigo-200 transition-colors"
                        title="View submissions"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Review Notes */}
                {comp.review_notes && (
                  <p className="mt-1.5 text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                    Instructor Note: {comp.review_notes}
                  </p>
                )}

                {/* Matched Regions */}
                {comp.matched_regions && comp.matched_regions.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 font-mono text-[10px] text-slate-500">
                    <span className="font-semibold text-slate-600">Matching Spans:</span>
                    {comp.matched_regions.map((reg, idx) => (
                      <span key={idx} className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
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
    </div>
  );
};
