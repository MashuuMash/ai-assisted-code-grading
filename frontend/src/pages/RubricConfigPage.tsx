import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { Assignment, CriterionType, Rubric, RubricCriterion } from '../types';

interface RubricConfigPageProps {
  assignment: Assignment;
}

export const RubricConfigPage: React.FC<RubricConfigPageProps> = ({ assignment }) => {
  const [rubric, setRubric] = useState<Rubric | null>(null);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRubric();
  }, [assignment.id]);

  const loadRubric = async () => {
    try {
      const data = await api.getRubric(assignment.id);
      setRubric(data);
      setCriteria(data.criteria || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCriterion = (idx: number, field: keyof RubricCriterion, val: any) => {
    const updated = [...criteria];
    updated[idx] = { ...updated[idx], [field]: val };
    setCriteria(updated);
  };

  const handleAddCriterion = () => {
    setCriteria([
      ...criteria,
      {
        title: 'New Evaluation Criterion',
        criterion_type: 'CUSTOM',
        weight: 0.10,
        max_points: 1.0,
        evaluation_config: {},
        order_index: criteria.length,
      },
    ]);
  };

  const handleDeleteCriterion = (idx: number) => {
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    // Validate weights sum to roughly 1.0
    const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      setErrorMessage(`Total weights must sum to 1.00 (Current sum: ${totalWeight.toFixed(2)})`);
      setIsSaving(false);
      return;
    }

    try {
      const updated = await api.updateRubric(
        assignment.id,
        rubric?.title || 'Grading Rubric',
        criteria
      );
      setRubric(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save rubric');
    } finally {
      setIsSaving(false);
    }
  };

  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight), 0);
  const totalPoints = criteria.reduce((sum, c) => sum + Number(c.max_points), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-2xs flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-slate-900">Grading Rubric Configuration</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-primary font-mono font-medium border border-blue-200">
              {assignment.title}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure weighted dimensions combining automated pytest assertions, Ruff static analysis, and structural AST metrics.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleAddCriterion}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dimension</span>
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors shadow-2xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Rubric'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded text-xs flex items-center space-x-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Rubric configuration successfully updated.</span>
        </div>
      )}

      {/* Criteria Table */}
      <div className="bg-white border border-[#E2E8F0] rounded shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-[#E2E8F0] text-slate-500 font-medium select-none">
              <th className="px-4 py-2.5">Criterion Title</th>
              <th className="px-4 py-2.5">Evaluation Type</th>
              <th className="px-4 py-2.5">Weight (0-1.0)</th>
              <th className="px-4 py-2.5">Max Points</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {criteria.map((c, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={c.title}
                    onChange={(e) => handleUpdateCriterion(idx, 'title', e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={c.criterion_type}
                    onChange={(e) => handleUpdateCriterion(idx, 'criterion_type', e.target.value as CriterionType)}
                    className="px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary focus:outline-none bg-white font-mono"
                  >
                    <option value="FUNCTIONAL_TEST">FUNCTIONAL_TEST</option>
                    <option value="CODE_QUALITY">CODE_QUALITY</option>
                    <option value="AST_STRUCTURE">AST_STRUCTURE</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={c.weight}
                    onChange={(e) => handleUpdateCriterion(idx, 'weight', parseFloat(e.target.value))}
                    className="w-20 px-2 py-1 text-xs font-mono text-center border border-slate-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={c.max_points}
                    onChange={(e) => handleUpdateCriterion(idx, 'max_points', parseFloat(e.target.value))}
                    className="w-20 px-2 py-1 text-xs font-mono text-center border border-slate-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDeleteCriterion(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t border-[#E2E8F0] font-mono font-semibold text-slate-800 text-xs">
              <td className="px-4 py-2.5" colSpan={2}>
                Total Distributed Weight & Points
              </td>
              <td className={`px-4 py-2.5 ${Math.abs(totalWeight - 1.0) < 0.01 ? 'text-emerald-700' : 'text-red-600'}`}>
                {totalWeight.toFixed(2)} / 1.00
              </td>
              <td className="px-4 py-2.5" colSpan={2}>
                {totalPoints.toFixed(1)} pts
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
