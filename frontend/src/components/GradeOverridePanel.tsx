import React, { useState } from 'react';
import { Calculator, CheckCircle, RefreshCw, Save } from 'lucide-react';
import { SubmissionGrade } from '../types';

interface GradeOverridePanelProps {
  grade: SubmissionGrade | null;
  onEvaluate: () => Promise<void>;
  onOverride: (data: {
    final_total_score?: number;
    status?: 'draft' | 'confirmed';
    criterion_overrides?: Array<{ criterion_id: number; final_score: number; justification?: string }>;
  }) => Promise<void>;
}

export const GradeOverridePanel: React.FC<GradeOverridePanelProps> = ({
  grade,
  onEvaluate,
  onOverride,
}) => {
  const [overrides, setOverrides] = useState<Record<number, { score: number; justification: string }>>({});
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const evaluate = async () => {
    setEvaluating(true); setError(''); setNotice('');
    try { await onEvaluate(); setOverrides({}); setNotice('Suggested grade recalculated.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not calculate grade. Please retry.'); }
    finally { setEvaluating(false); }
  };

  if (!grade) {
    return (
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] p-5 rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 text-center text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
        <p className="text-xs text-[#4C4541]/80 dark:text-[#FCF0DA]/80 mb-3">No mathematical grade calculated yet.</p>
        {error && <p role="alert" className="mb-3 text-sm text-rose-700 dark:text-rose-400 font-semibold">{error}</p>}
        <button
          onClick={evaluate}
          disabled={evaluating}
          className="px-3.5 py-1.5 bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold rounded-lg text-xs inline-flex items-center space-x-1.5 transition-colors border border-[#AEAC78]/60 shadow-xs cursor-pointer"
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>{evaluating ? 'Evaluating...' : 'Calculate Suggested Grade'}</span>
        </button>
      </div>
    );
  }

  const handleScoreChange = (critId: number, val: number, maxPoints: number) => {
    const clamped = Math.max(0, Math.min(maxPoints, val));
    setOverrides((prev) => ({
      ...prev,
      [critId]: {
        score: clamped,
        justification: prev[critId]?.justification || '',
      },
    }));
  };

  const handleJustificationChange = (critId: number, text: string) => {
    setOverrides((prev) => ({
      ...prev,
      [critId]: {
        score: prev[critId]?.score ?? grade.criterion_scores.find(cs => cs.criterion_id === critId)?.final_score ?? 0,
        justification: text,
      },
    }));
  };

  const handleSaveOverrides = async (asConfirmed: boolean = false) => {
    setSaving(true);
    setError(''); setNotice('');
    try {
      const critOverrides = Object.entries(overrides).map(([cid, data]) => ({
        criterion_id: Number(cid),
        final_score: data.score,
        justification: data.justification,
      }));

      const payload: any = {
        criterion_overrides: critOverrides,
        status: asConfirmed ? 'confirmed' : 'draft',
      };

      await onOverride(payload);
      setOverrides({});
      setNotice(asConfirmed ? 'Grade confirmed.' : 'Draft saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save grade. Your edits are still here.');
    } finally {
      setSaving(false);
    }
  };

  const isConfirmed = grade.status === 'confirmed';

  return (
    <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 shadow-xs p-4 text-xs text-[#4C4541] dark:text-[#FCF0DA]">
      <div className="flex items-center justify-between pb-3 border-b border-[#AEAC78]/30 dark:border-[#AEAC78]/20">
        <div>
          <span className="text-[11px] font-bold text-[#AEAC78] dark:text-[#F2C46A] uppercase tracking-wider">
            Deterministic Grade
          </span>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <span className="text-2xl font-black text-[#4C4541] dark:text-[#FCF0DA] font-mono">
              {grade.final_total_score !== null && grade.final_total_score !== undefined
                ? grade.final_total_score.toFixed(2)
                : grade.suggested_total_score.toFixed(2)}
            </span>
            <span className="text-xs text-[#4C4541]/70 dark:text-[#FCF0DA]/70 font-mono">
              / {grade.criterion_scores.reduce((total, score) => total + (score.criterion?.max_points || 0), 0).toFixed(2)} pts
            </span>
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isConfirmed
                  ? 'bg-[#AEAC78]/25 text-[#2E4324] dark:bg-[#AEAC78]/30 dark:text-[#FCF0DA] border border-[#AEAC78]/50'
                  : 'bg-[#F2C46A]/30 text-[#6B4307] dark:bg-[#F2C46A]/20 dark:text-[#F2C46A] border border-[#F2C46A]/50'
              }`}
            >
              {grade.status}
            </span>
          </div>
        </div>

        <button
          onClick={evaluate}
          disabled={evaluating || saving}
          aria-label="Recalculate suggested grade"
          className="text-[#4C4541] dark:text-[#FCF0DA] hover:text-[#F2C46A] p-1.5 rounded-lg border border-[#AEAC78]/40 hover:border-[#F2C46A] transition-colors cursor-pointer"
          title="Recalculate mathematical score from evidence"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Criteria breakdown */}
      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-sm text-rose-700 dark:text-rose-300 font-semibold">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-semibold text-[#2E4324] dark:text-[#AEAC78]">{notice}</p>}
      <div className="mt-3 space-y-3">
        {grade.criterion_scores.map((cs) => {
          const crit = cs.criterion;
          const critId = cs.criterion_id;
          const maxPts = crit?.max_points || 10;
          const overrideVal = overrides[critId]?.score;
          const currentScore = overrideVal !== undefined ? overrideVal : cs.final_score;

          return (
            <div key={cs.id} className="p-2.5 rounded-lg bg-[#FCF0DA]/30 dark:bg-[#2C2623]/60 border border-[#AEAC78]/30 dark:border-[#AEAC78]/20 text-[#4C4541] dark:text-[#FCF0DA]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA]">{crit?.title || 'Criterion'}</span>
                  <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70 ml-1.5 font-mono text-[11px]">
                    ({crit?.weight_percentage}% weight)
                  </span>
                </div>
                <div className="flex items-center space-x-1 font-mono">
                  <input
                    aria-label={`Score for ${crit?.title || 'criterion'}`}
                    disabled={saving || evaluating}
                    type="number"
                    step="0.1"
                    min="0"
                    max={maxPts}
                    value={currentScore}
                    onChange={(e) => handleScoreChange(critId, parseFloat(e.target.value) || 0, maxPts)}
                    className="w-14 text-right px-1.5 py-0.5 border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] rounded font-semibold text-[#4C4541] dark:text-[#FCF0DA] focus:outline-none focus:ring-2 focus:ring-[#F2C46A]"
                  />
                  <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70">/ {maxPts.toFixed(1)}</span>
                </div>
              </div>

              {cs.justification && (
                <p className="mt-1 text-[11px] text-[#4C4541]/80 dark:text-[#FCF0DA]/80 italic">
                  {cs.justification}
                </p>
              )}

              {/* Justification input if overridden */}
              <div className="mt-1.5">
                <input
                  aria-label={`Justification for ${crit?.title || 'criterion'}`}
                  disabled={saving || evaluating}
                  type="text"
                  placeholder="Override justification (optional)..."
                  value={overrides[critId]?.justification || ''}
                  onChange={(e) => handleJustificationChange(critId, e.target.value)}
                  className="w-full px-2 py-1 text-[11px] border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] rounded text-[#4C4541] dark:text-[#FCF0DA] placeholder-[#4C4541]/50 dark:placeholder-[#FCF0DA]/50 focus:outline-none focus:ring-2 focus:ring-[#F2C46A]"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-4 pt-3 border-t border-[#AEAC78]/30 dark:border-[#AEAC78]/20 flex items-center justify-end space-x-2">
        <button
          onClick={() => handleSaveOverrides(false)}
          disabled={saving || evaluating}
          className="px-3 py-1.5 border border-[#AEAC78]/60 hover:bg-[#FCF0DA] dark:hover:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] rounded-lg font-medium transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Draft</span>
        </button>

        <button
          onClick={() => handleSaveOverrides(true)}
          disabled={saving || evaluating}
          className="px-3.5 py-1.5 bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold rounded-lg border border-[#AEAC78]/60 transition-colors inline-flex items-center space-x-1.5 shadow-xs cursor-pointer"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Confirm Grade</span>
        </button>
      </div>
    </div>
  );
};
