import React, { useState } from 'react';
import { Plus, Sliders } from 'lucide-react';
import { api } from '../api/client';
import { Rubric } from '../types';

interface RubricManagerProps {
  courseId: number;
  classId: number;
  assignmentId: number;
  rubric: Rubric | null;
  onRubricUpdated: () => void;
}

export const RubricManager: React.FC<RubricManagerProps> = ({
  courseId,
  classId,
  assignmentId,
  rubric,
  onRubricUpdated,
}) => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateStandardRubric = async () => {
    setCreating(true);
    setError(null);
    try {
      const standardPayload = {
        title: 'Standard 10-Point Engineering Rubric',
        max_score: 10.0,
        criteria: [
          {
            title: 'Functional Correctness',
            category: 'correctness',
            evaluation_type: 'automated_test',
            weight_percentage: 50.0,
            order_index: 0,
          },
          {
            title: 'Edge Cases & Robustness',
            category: 'robustness',
            evaluation_type: 'automated_test',
            weight_percentage: 20.0,
            order_index: 1,
          },
          {
            title: 'Code Quality & Style (Ruff)',
            category: 'code_quality',
            evaluation_type: 'code_quality',
            weight_percentage: 20.0,
            penalty_per_error: 0.5,
            penalty_per_warning: 0.1,
            order_index: 2,
          },
          {
            title: 'Structural Complexity (AST)',
            category: 'complexity',
            evaluation_type: 'structural_complexity',
            weight_percentage: 10.0,
            max_allowed_complexity: 10,
            max_allowed_nesting: 4,
            penalty_per_error: 0.5,
            order_index: 3,
          },
        ],
      };

      await api.rubrics.create(courseId, classId, assignmentId, standardPayload);
      onRubricUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize rubric.');
    } finally {
      setCreating(false);
    }
  };

  const totalWeight = rubric?.criteria?.reduce((sum, c) => sum + c.weight_percentage, 0) || 0;
  const isWeightValid = Math.abs(totalWeight - 100.0) < 0.01;

  if (!rubric) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-xs">
        <Sliders className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
        <h4 className="text-sm font-bold text-slate-800 mb-1">
          No Rubric Configured Yet
        </h4>
        <p className="text-slate-500 max-w-md mx-auto mb-4">
          Each assignment requires a deterministic grading rubric mapping automated tests,
          Ruff linter rules, and AST complexity metrics to weighted points.
        </p>

        {error && (
          <p className="text-rose-600 text-[11px] mb-3">{error}</p>
        )}

        <button
          onClick={handleCreateStandardRubric}
          disabled={creating}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1.5 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{creating ? 'Initializing...' : 'Initialize Standard 10-Point Rubric'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-slate-800 text-sm">{rubric.title}</h3>
            <span className="bg-slate-100 text-slate-700 font-mono text-[10px] px-2 py-0.5 rounded font-bold">
              Max {rubric.max_score.toFixed(1)} pts
            </span>
          </div>
          <p className="text-slate-400 text-[11px] mt-0.5">
            Mathematical deterministic formulas calculate suggested grades
          </p>
        </div>

        {/* Weight indicator */}
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-slate-500">Weight Sum:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded-full text-xs ${
              isWeightValid
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}
          >
            {totalWeight.toFixed(1)}% / 100.0%
          </span>
        </div>
      </div>

      {/* Criteria Table */}
      <div className="mt-3 border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px]">
            <tr>
              <th className="px-3 py-2">Criterion</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Evaluation Type</th>
              <th className="px-3 py-2 text-right">Weight</th>
              <th className="px-3 py-2 text-right">Max Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[11px]">
            {rubric.criteria.map((crit) => (
              <tr key={crit.id} className="hover:bg-slate-50/60">
                <td className="px-3 py-2 font-bold text-slate-800">
                  {crit.title}
                </td>
                <td className="px-3 py-2 text-slate-600 font-mono text-[10px] uppercase">
                  {crit.category}
                </td>
                <td className="px-3 py-2 text-slate-600 font-mono text-[10px] uppercase">
                  {crit.evaluation_type}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-indigo-700">
                  {crit.weight_percentage}%
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">
                  {crit.max_points.toFixed(2)} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
