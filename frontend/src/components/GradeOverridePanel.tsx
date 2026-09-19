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

  if (!grade) {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 text-center">
        <p className="text-xs text-slate-500 mb-3">No mathematical grade calculated yet.</p>
        <button
          onClick={async () => {
            setEvaluating(true);
            try {
              await onEvaluate();
            } finally {
              setEvaluating(false);
            }
          }}
          disabled={evaluating}
          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors shadow-sm"
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
        score: prev[critId]?.score ?? 0,
        justification: text,
      },
    }));
  };

  const handleSaveOverrides = async (asConfirmed: boolean = false) => {
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const isConfirmed = grade.status === 'confirmed';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Deterministic Grade
          </span>
          <div className="flex items-baseline space-x-2 mt-0.5">
            <span className="text-2xl font-black text-slate-800 font-mono">
              {grade.final_total_score !== null && grade.final_total_score !== undefined
                ? grade.final_total_score.toFixed(2)
                : grade.suggested_total_score.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              / 10.00 pts
            </span>
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                isConfirmed
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {grade.status}
            </span>
          </div>
        </div>

        <button
          onClick={async () => {
            setEvaluating(true);
            try {
              await onEvaluate();
            } finally {
              setEvaluating(false);
            }
          }}
          disabled={evaluating}
          className="text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors"
          title="Recalculate mathematical score from evidence"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Criteria breakdown */}
      <div className="mt-3 space-y-3">
        {grade.criterion_scores.map((cs) => {
          const crit = cs.criterion;
          const critId = cs.criterion_id;
          const maxPts = crit?.max_points || 10;
          const overrideVal = overrides[critId]?.score;
          const currentScore = overrideVal !== undefined ? overrideVal : cs.final_score;

          return (
            <div key={cs.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800">{crit?.title || 'Criterion'}</span>
                  <span className="text-slate-400 ml-1.5 font-mono text-[11px]">
                    ({crit?.weight_percentage}% weight)
                  </span>
                </div>
                <div className="flex items-center space-x-1 font-mono">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max={maxPts}
                    value={currentScore}
                    onChange={(e) => handleScoreChange(critId, parseFloat(e.target.value) || 0, maxPts)}
                    className="w-14 text-right px-1.5 py-0.5 border border-slate-300 rounded font-semibold text-slate-800 focus:outline-indigo-500"
                  />
                  <span className="text-slate-400">/ {maxPts.toFixed(1)}</span>
                </div>
              </div>

              {cs.justification && (
                <p className="mt-1 text-[11px] text-slate-500 italic">
                  {cs.justification}
                </p>
              )}

              {/* Justification input if overridden */}
              <div className="mt-1.5">
                <input
                  type="text"
                  placeholder="Override justification (optional)..."
                  value={overrides[critId]?.justification || ''}
                  onChange={(e) => handleJustificationChange(critId, e.target.value)}
                  className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded text-slate-700 placeholder-slate-400 focus:outline-indigo-500 bg-white"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
        <button
          onClick={() => handleSaveOverrides(false)}
          disabled={saving}
          className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium transition-colors inline-flex items-center space-x-1.5"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Draft</span>
        </button>

        <button
          onClick={() => handleSaveOverrides(true)}
          disabled={saving}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors inline-flex items-center space-x-1.5 shadow-sm"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Confirm Grade</span>
        </button>
      </div>
    </div>
  );
};
