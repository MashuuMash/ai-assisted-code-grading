import React, { useState } from 'react';
import { Plus, Sliders } from 'lucide-react';
import { api } from '../api/client';
import { EvidenceCategory, EvaluationType, Rubric } from '../types';

type EditableCriterion = {
  key: number;
  title: string;
  category: EvidenceCategory;
  evaluation_type: EvaluationType;
  weight_percentage: number;
  config: Record<string, number>;
};

const newCriterion = (key: number): EditableCriterion => ({
  key, title: '', category: 'correctness', evaluation_type: 'automated_test',
  weight_percentage: 100, config: {},
});

const inputClass = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-xs focus:outline-indigo-500';

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
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftMaxScore, setDraftMaxScore] = useState(10);
  const [draftCriteria, setDraftCriteria] = useState<EditableCriterion[]>([]);

  const startEditing = () => {
    setError(null);
    setDraftTitle(rubric?.title || 'Grading Rubric');
    setDraftMaxScore(rubric?.max_score || 10);
    setDraftCriteria(rubric?.criteria.map((criterion) => ({
      key: criterion.id,
      title: criterion.title,
      category: criterion.category,
      evaluation_type: criterion.evaluation_type,
      weight_percentage: criterion.weight_percentage,
      config: { ...(criterion.config || {}) },
    })) || [newCriterion(Date.now())]);
    setEditing(true);
  };

  const changeCriterion = (key: number, change: Partial<EditableCriterion>) => {
    setDraftCriteria((previous) => previous.map((criterion) =>
      criterion.key === key ? { ...criterion, ...change } : criterion
    ));
  };

  const saveRubric = async () => {
    const total = draftCriteria.reduce((sum, criterion) => sum + criterion.weight_percentage, 0);
    if (!draftTitle.trim() || !Number.isFinite(draftMaxScore) || draftMaxScore <= 0 ||
        draftCriteria.length === 0 || draftCriteria.some((criterion) => !criterion.title.trim() || !Number.isFinite(criterion.weight_percentage) || criterion.weight_percentage <= 0) ||
        Math.abs(total - 100) > 0.05) {
      setError('Add named criteria with positive weights totaling 100%, and a positive maximum score.');
      return;
    }
    setCreating(true);
    setError(null);
    const payload = {
      title: draftTitle.trim(), max_score: draftMaxScore,
      criteria: draftCriteria.map((criterion, index) => ({
        title: criterion.title.trim(), category: criterion.category,
        evaluation_type: criterion.evaluation_type,
        weight_percentage: criterion.weight_percentage,
        config: criterion.config,
        order_index: index,
      })),
    };
    try {
      if (rubric) await api.rubrics.update(courseId, classId, assignmentId, payload);
      else await api.rubrics.create(courseId, classId, assignmentId, payload);
      setEditing(false);
      onRubricUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rubric');
    } finally {
      setCreating(false);
    }
  };

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
            config: { penalty_per_error: 0.5, penalty_per_warning: 0.1 },
            order_index: 2,
          },
          {
            title: 'Structural Complexity (AST)',
            category: 'complexity',
            evaluation_type: 'structural_complexity',
            weight_percentage: 10.0,
            config: { penalty_per_violation: 0.5 },
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

  if (editing) {
    const draftTotal = draftCriteria.reduce((sum, criterion) => sum + criterion.weight_percentage, 0);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm">{rubric ? 'Edit rubric' : 'Create custom rubric'}</h3>
          <span className={Math.abs(draftTotal - 100) <= 0.05 ? 'text-emerald-700' : 'text-rose-700'}>Total weight: {draftTotal.toFixed(1)}% / 100%</span>
        </div>
        {rubric && <p className="rounded bg-amber-50 p-2 text-amber-800">Criteria and maximum score can only be changed before grading starts. Existing graded assignments are protected.</p>}
        {error && <p role="alert" className="text-rose-700">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={`${inputClass} sm:col-span-2`} aria-label="Rubric title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Rubric title" maxLength={255} />
          <input className={inputClass} aria-label="Maximum score" type="number" min="0.01" step="0.01" value={draftMaxScore} onChange={(e) => setDraftMaxScore(Number(e.target.value))} />
        </div>
        <div className="space-y-3">
          {draftCriteria.map((criterion) => (
            <div key={criterion.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <input className={`${inputClass} sm:col-span-2`} aria-label="Criterion title" placeholder="Criterion title" value={criterion.title} onChange={(e) => changeCriterion(criterion.key, { title: e.target.value })} maxLength={255} />
                <select className={inputClass} aria-label="Evaluation type" value={criterion.evaluation_type} onChange={(e) => {
                  const evaluation_type = e.target.value as EvaluationType;
                  const category: EvidenceCategory = evaluation_type === 'code_quality' ? 'code_quality' : evaluation_type === 'structural_complexity' ? 'complexity' : 'correctness';
                  changeCriterion(criterion.key, { evaluation_type, category });
                }}>
                  <option value="automated_test">Automated test</option>
                  <option value="code_quality">Code quality</option>
                  <option value="structural_complexity">Complexity</option>
                </select>
                <input className={inputClass} aria-label="Criterion weight" type="number" min="0.01" max="100" step="0.1" value={criterion.weight_percentage} onChange={(e) => changeCriterion(criterion.key, { weight_percentage: Number(e.target.value) })} />
              </div>
              {criterion.evaluation_type === 'automated_test' && (
                <select className={inputClass} aria-label="Test category" value={criterion.category} onChange={(e) => changeCriterion(criterion.key, { category: e.target.value as EvidenceCategory })}>
                  <option value="correctness">Correctness</option><option value="robustness">Robustness / edge cases</option>
                </select>
              )}
              {criterion.evaluation_type === 'code_quality' && (
                <div className="flex flex-wrap gap-2 items-center">
                  <label>Deduction / error <input className={`${inputClass} w-20`} type="number" min="0" step="0.1" value={criterion.config.penalty_per_error ?? 0.5} onChange={(e) => changeCriterion(criterion.key, { config: { ...criterion.config, penalty_per_error: Number(e.target.value) } })} /></label>
                  <label>Deduction / warning <input className={`${inputClass} w-20`} type="number" min="0" step="0.1" value={criterion.config.penalty_per_warning ?? 0.1} onChange={(e) => changeCriterion(criterion.key, { config: { ...criterion.config, penalty_per_warning: Number(e.target.value) } })} /></label>
                </div>
              )}
              {criterion.evaluation_type === 'structural_complexity' && (
                <label>Deduction / violation <input className={`${inputClass} w-20`} type="number" min="0" step="0.1" value={criterion.config.penalty_per_violation ?? 0.5} onChange={(e) => changeCriterion(criterion.key, { config: { ...criterion.config, penalty_per_violation: Number(e.target.value) } })} /></label>
              )}
              <button type="button" className="text-rose-600 disabled:opacity-40" disabled={draftCriteria.length === 1} onClick={() => setDraftCriteria((previous) => previous.filter((item) => item.key !== criterion.key))}>Remove criterion</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-slate-300 px-3 py-2" onClick={() => setDraftCriteria((previous) => [...previous, { ...newCriterion(Date.now() + Math.random()), weight_percentage: 0 }])}>Add criterion</button>
          <button type="button" className="rounded border border-slate-300 px-3 py-2" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>
          <button type="button" disabled={creating} className="rounded bg-indigo-600 px-3 py-2 font-semibold text-white disabled:opacity-50" onClick={() => void saveRubric()}>{creating ? 'Saving...' : 'Save rubric'}</button>
        </div>
      </div>
    );
  }

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

        <div className="flex justify-center gap-2">
          <button onClick={handleCreateStandardRubric} disabled={creating} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1.5 shadow-sm transition-colors">
            <Plus className="w-4 h-4" /><span>{creating ? 'Initializing...' : 'Initialize Standard 10-Point Rubric'}</span>
          </button>
          <button onClick={startEditing} className="px-4 py-2 border border-indigo-300 text-indigo-700 rounded-lg font-semibold">Create custom rubric</button>
        </div>
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

        <button onClick={startEditing} className="rounded-lg border border-indigo-300 px-3 py-1.5 font-semibold text-indigo-700">Edit rubric</button>

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
