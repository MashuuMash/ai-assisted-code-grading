import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, Flag, Save } from 'lucide-react';
import { SubmissionDetail } from '../types';

interface ActionFooterProps {
  submission: SubmissionDetail | null;
  onSaveReview: (finalGrade: number, status: string, feedback: string, notes: string) => Promise<void>;
  onNextStudent: () => void;
  isSaving: boolean;
}

export const ActionFooter: React.FC<ActionFooterProps> = ({
  submission,
  onSaveReview,
  onNextStudent,
  isSaving,
}) => {
  const [gradeInput, setGradeInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');

  useEffect(() => {
    if (submission) {
      const currentGrade = submission.lecturer_review?.final_grade ?? submission.lecturer_review?.automated_grade ?? 0;
      setGradeInput(String(currentGrade));
      setFeedbackInput(submission.lecturer_review?.feedback_override || submission.ai_feedback_draft?.summary || '');
      setNotesInput(submission.lecturer_review?.internal_notes || '');
    }
  }, [submission]);

  if (!submission) return null;

  const handleAction = async (status: string, advance: boolean = false) => {
    const numGrade = parseFloat(gradeInput);
    if (isNaN(numGrade) || numGrade < 0) return;
    await onSaveReview(numGrade, status, feedbackInput, notesInput);
    if (advance) onNextStudent();
  };

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-[#E2E8F0] shadow-md px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Student & Calculated Grade */}
        <div className="flex items-center space-x-4">
          <div>
            <div className="text-xs text-slate-500 font-medium">Evaluating Student</div>
            <div className="text-sm font-semibold text-slate-800">
              {submission.student_name} <span className="font-mono text-xs text-slate-500">({submission.student_identifier})</span>
            </div>
          </div>

          <div className="h-7 w-px bg-slate-200" />

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500">Automated Grade:</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700">
              {submission.lecturer_review?.automated_grade ?? 0.00} / 10
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-700">Lecturer Final:</span>
            <input
              type="number"
              step="0.25"
              min="0"
              max="10"
              value={gradeInput}
              onChange={(e) => setGradeInput(e.target.value)}
              className="w-16 px-2 py-1 text-xs font-mono font-bold text-center border border-slate-300 rounded focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Human-in-the-Loop Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* Flag for Oral Defense */}
          <button
            onClick={() => handleAction('INTERVIEW_REQUESTED', false)}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100 transition-colors"
          >
            <Flag className="w-3.5 h-3.5 text-amber-600" />
            <span>Flag for Oral Defense</span>
          </button>

          {/* Save / Override */}
          <button
            onClick={() => handleAction('MODIFIED', false)}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>Save Override</span>
          </button>

          {/* Approve & Next Student */}
          <button
            onClick={() => handleAction('APPROVED', true)}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded bg-primary text-white text-xs font-medium hover:bg-primary-700 shadow-2xs transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approve & Next</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
