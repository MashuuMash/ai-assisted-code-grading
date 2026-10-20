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

const inputClass = 'rounded-lg border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#F2C46A]';

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
      <div className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-4 text-xs space-y-4 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-[#4C4541] dark:text-[#FCF0DA]">{rubric ? 'Edit rubric' : 'Create custom rubric'}</h3>
          <span className={Math.abs(draftTotal - 100) <= 0.05 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-700 dark:text-rose-400 font-bold'}>Total weight: {draftTotal.toFixed(1)}% / 100%</span>
        </div>
        {rubric && <p className="rounded-lg bg-[#F2C46A]/20 border border-[#F2C46A]/40 p-2 text-[#4C4541] dark:text-[#FCF0DA]">Criteria and maximum score can only be changed before grading starts. Existing graded assignments are protected.</p>}
        {error && <p role="alert" className="text-rose-700 dark:text-rose-400 font-semibold">{error}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input className={`${inputClass} sm:col-span-2`} aria-label="Rubric title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Rubric title" maxLength={255} />
          <input className={inputClass} aria-label="Maximum score" type="number" min="0.01" step="0.01" value={draftMaxScore} onChange={(e) => setDraftMaxScore(Number(e.target.value))} />
        </div>
        <div className="space-y-3">
          {draftCriteria.map((criterion) => (
            <div key={criterion.key} className="rounded-lg border border-[#AEAC78]/30 dark:border-[#AEAC78]/20 bg-[#FCF0DA]/20 dark:bg-[#2C2623]/60 p-3 space-y-2 text-[#4C4541] dark:text-[#FCF0DA]">
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
                <div className="flex flex-wrap gap-2 items-center text-[#4C4541] dark:text-[#FCF0DA]">
                  <label>Deduction / error <input className={`${inputClass} w-20`} type="number" min="0" step="0.1" value={criterion.config.penalty_per_error ?? 0.5} onChange={(e) => changeCriterion(criterion.key, { config: { ...criterion.config, penalty_per_error: Number(e.target.value) } })} /></label>
                  <label>Deduction / warning <input className={`${inputClass} w-20`} type="number" min="0" step="0.1" value={criterion.config.penalty_per_warning ?? 0.1} onChange={(e) => changeCriterion(criterion.key, { config: { ...criterion.config, penalty_per_warning: Number(e.target.value) } })} /></label>
                </div>
              )}
              {criterion.evaluation_type === 'structural_complexity' && (
                <label className="text-[#4C4541] dark:text-[#FCF0DA]">Deduction / violation <input className={`${inputClass} w-20`} type="number" min="0" step="0.1" value={criterion.config.penalty_per_violation ?? 0.5} onChange={(e) => changeCriterion(criterion.key, { config: { ...criterion.config, penalty_per_violation: Number(e.target.value) } })} /></label>
              )}
              <button type="button" className="text-rose-600 dark:text-rose-400 hover:text-rose-700 disabled:opacity-40 font-semibold cursor-pointer" disabled={draftCriteria.length === 1} onClick={() => setDraftCriteria((previous) => previous.filter((item) => item.key !== criterion.key))}>Remove criterion</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded-lg border border-[#AEAC78]/60 hover:bg-[#FCF0DA] px-3 py-2 text-[#4C4541] dark:text-[#FCF0DA] font-semibold cursor-pointer" onClick={() => setDraftCriteria((previous) => [...previous, { ...newCriterion(Date.now() + Math.random()), weight_percentage: 0 }])}>Add criterion</button>
          <button type="button" className="rounded-lg border border-[#AEAC78]/60 hover:bg-[#FCF0DA] px-3 py-2 text-[#4C4541] dark:text-[#FCF0DA] font-semibold cursor-pointer" onClick={() => { setEditing(false); setError(null); }}>Cancel</button>
          <button type="button" disabled={creating} className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 px-3 py-2 font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer" onClick={() => void saveRubric()}>{creating ? 'Saving...' : 'Save rubric'}</button>
        </div>
      </div>
    );
  }

  if (!rubric) {
    return (
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 shadow-xs p-6 text-center text-xs text-[#4C4541] dark:text-[#FCF0DA]">
        <Sliders className="w-8 h-8 text-[#AEAC78] dark:text-[#F2C46A] mx-auto mb-2" />
        <h4 className="text-sm font-bold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
          No Rubric Configured Yet
        </h4>
        <p className="text-[#4C4541]/80 dark:text-[#FCF0DA]/80 max-w-md mx-auto mb-4">
          Each assignment requires a deterministic grading rubric mapping automated tests,
          Ruff linter rules, and AST complexity metrics to weighted points.
        </p>

        {error && (
          <p className="text-rose-600 dark:text-rose-400 text-[11px] mb-3 font-semibold">{error}</p>
        )}

        <div className="flex justify-center gap-2">
          <button onClick={handleCreateStandardRubric} disabled={creating} className="px-4 py-2 bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold rounded-lg inline-flex items-center space-x-1.5 shadow-xs border border-[#AEAC78]/60 transition-colors cursor-pointer disabled:opacity-50">
            <Plus className="w-4 h-4" /><span>{creating ? 'Initializing...' : 'Initialize Standard 10-Point Rubric'}</span>
          </button>
          <button onClick={startEditing} className="px-4 py-2 border border-[#AEAC78]/60 hover:bg-[#FCF0DA] text-[#4C4541] dark:text-[#FCF0DA] rounded-lg font-bold transition-colors cursor-pointer">Create custom rubric</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 shadow-xs p-4 text-xs text-[#4C4541] dark:text-[#FCF0DA]">
      <div className="flex items-center justify-between pb-3 border-b border-[#AEAC78]/30 dark:border-[#AEAC78]/20 flex-wrap gap-2">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-[#4C4541] dark:text-[#FCF0DA] text-sm">{rubric.title}</h3>
            <span className="bg-[#FCF0DA]/50 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 font-mono text-[10px] px-2 py-0.5 rounded font-bold">
              Max {rubric.max_score.toFixed(1)} pts
            </span>
          </div>
          <p className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70 text-[11px] mt-0.5">
            Mathematical deterministic formulas calculate suggested grades
          </p>
        </div>

        <button onClick={startEditing} className="rounded-lg border border-[#AEAC78]/60 hover:bg-[#FCF0DA] dark:hover:bg-[#2C2623] px-3 py-1.5 font-bold text-[#4C4541] dark:text-[#FCF0DA] transition-colors cursor-pointer">Edit rubric</button>

        {/* Weight indicator */}
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-[#4C4541]/70 dark:text-[#FCF0DA]/70">Weight Sum:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded-full text-xs ${
              isWeightValid
                ? 'bg-[#AEAC78]/25 text-[#2E4324] dark:bg-[#AEAC78]/30 dark:text-[#FCF0DA] border border-[#AEAC78]/60'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300'
            }`}
          >
            {totalWeight.toFixed(1)}% / 100.0%
          </span>
        </div>
      </div>

      {/* Criteria Table */}
      <div className="mt-3 border border-[#AEAC78]/30 dark:border-[#AEAC78]/20 rounded-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#FCF0DA]/50 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] font-bold border-b border-[#AEAC78]/30 text-[11px]">
            <tr>
              <th className="px-3 py-2">Criterion</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Evaluation Type</th>
              <th className="px-3 py-2 text-right">Weight</th>
              <th className="px-3 py-2 text-right">Max Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#AEAC78]/20 text-[11px]">
            {rubric.criteria.map((crit) => (
              <tr key={crit.id} className="hover:bg-[#FCF0DA]/30 dark:hover:bg-[#2C2623]/40 text-[#4C4541] dark:text-[#FCF0DA]">
                <td className="px-3 py-2 font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                  {crit.title}
                </td>
                <td className="px-3 py-2 text-[#4C4541]/80 dark:text-[#FCF0DA]/80 font-mono text-[10px] uppercase">
                  {crit.category}
                </td>
                <td className="px-3 py-2 text-[#4C4541]/80 dark:text-[#FCF0DA]/80 font-mono text-[10px] uppercase">
                  {crit.evaluation_type}
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-[#4C4541] dark:text-[#F2C46A]">
                  {crit.weight_percentage}%
                </td>
                <td className="px-3 py-2 text-right font-mono font-bold text-[#4C4541] dark:text-[#FCF0DA]">
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
