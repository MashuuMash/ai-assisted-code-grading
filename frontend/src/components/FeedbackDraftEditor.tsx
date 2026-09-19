import React, { useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Edit2,
  FileCheck,
  Save,
  Sparkles,
} from 'lucide-react';
import { DetailedFeedbackPayload, SubmissionGrade } from '../types';

interface FeedbackDraftEditorProps {
  grade: SubmissionGrade | null;
  onGenerate: () => Promise<void>;
  onSaveFeedback: (summary: string, detailed?: any, asConfirmed?: boolean) => Promise<void>;
  onSelectEvidence?: (evidenceId: string) => void;
}

export const FeedbackDraftEditor: React.FC<FeedbackDraftEditorProps> = ({
  grade,
  onGenerate,
  onSaveFeedback,
  onSelectEvidence,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState<string>(grade?.feedback_summary || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const detailed: DetailedFeedbackPayload | null = grade?.detailed_feedback || null;

  const handleGenerateClick = async () => {
    setLoading(true);
    try {
      await onGenerate();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClick = async (asConfirmed: boolean = false) => {
    setSaving(true);
    try {
      await onSaveFeedback(editedSummary, detailed, asConfirmed);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-xs flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Evidence-Grounded AI Feedback
          </h3>
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5 rounded border border-indigo-200">
            Draft
          </span>
        </div>

        <button
          onClick={handleGenerateClick}
          disabled={loading}
          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1.5 transition-colors border border-indigo-200"
          title="Synthesize AI feedback draft strictly from evidence"
        >
          <Sparkles className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Synthesizing...' : 'Generate AI Draft'}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-3.5">
        {/* Verified Strengths */}
        {detailed?.strengths && detailed.strengths.length > 0 && (
          <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
            <h4 className="font-bold text-emerald-900 flex items-center space-x-1.5 mb-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Strengths</span>
            </h4>
            <ul className="space-y-1 text-emerald-800 text-[11px]">
              {detailed.strengths.map((s, idx) => (
                <li key={idx} className="flex items-start space-x-1.5">
                  <Check className="w-3 h-3 mt-0.5 text-emerald-600 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for improvement with citations */}
        {detailed?.areas_for_improvement && detailed.areas_for_improvement.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>Areas for Improvement & Traceable Citations</span>
            </h4>
            <div className="space-y-2">
              {detailed.areas_for_improvement.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px]"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-800">
                      {item.criterion_title || 'General Criterion'}
                    </span>
                    {item.evidence_id && (
                      <button
                        onClick={() => onSelectEvidence && onSelectEvidence(item.evidence_id)}
                        className="font-mono text-[10px] bg-slate-200/80 hover:bg-indigo-100 text-slate-600 hover:text-indigo-800 px-1.5 py-0.5 rounded transition-colors"
                        title="Inspect backing evidence item"
                      >
                        Evidence: {item.evidence_id.slice(0, 8)}...
                      </button>
                    )}
                  </div>
                  <p className="text-slate-700">{item.issue}</p>
                  <p className="text-slate-500 italic mt-0.5">{item.suggestion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Markdown Summary Draft */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-bold text-slate-700">
              Instructor Feedback Summary (Markdown)
            </label>
            {!isEditing && (
              <button
                onClick={() => {
                  setEditedSummary(grade?.feedback_summary || '');
                  setIsEditing(true);
                }}
                className="text-indigo-600 hover:text-indigo-800 text-[11px] font-medium inline-flex items-center space-x-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Edit Text</span>
              </button>
            )}
          </div>

          {isEditing ? (
            <textarea
              rows={8}
              value={editedSummary}
              onChange={(e) => setEditedSummary(e.target.value)}
              className="w-full font-mono text-xs p-2.5 border border-slate-300 rounded-lg text-slate-800 focus:outline-indigo-500 bg-white"
              placeholder="Write or edit feedback for the student report..."
            />
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs whitespace-pre-wrap font-sans leading-relaxed">
              {grade?.feedback_summary || 'No feedback summary generated yet.'}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      {isEditing && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
          <button
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSaveClick(false)}
            disabled={saving}
            className="px-3 py-1.5 border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium inline-flex items-center space-x-1"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => handleSaveClick(true)}
            disabled={saving}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold inline-flex items-center space-x-1 shadow-sm"
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Confirm Feedback</span>
          </button>
        </div>
      )}
    </div>
  );
};
