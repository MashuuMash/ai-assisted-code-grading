import { useState } from 'react';
import { api } from '../api/client';
import { Assignment, AssignmentStatus } from '../types';

const input = 'w-full rounded-lg border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C46A]';

export function AssignmentEditor({ courseId, classId, assignment, onSaved }: {
  courseId: number; classId: number; assignment: Assignment; onSaved: (value: Assignment) => void;
}) {
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description || '');
  const [instructions, setInstructions] = useState(assignment.instructions || '');
  const [baseCode, setBaseCode] = useState(assignment.base_code || '');
  const [status, setStatus] = useState<AssignmentStatus>(assignment.status);
  const [deadline, setDeadline] = useState(() => {
    if (!assignment.deadline) return '';
    const date = new Date(assignment.deadline);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <form className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-5 space-y-3 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const saved = await api.assignments.update(courseId, classId, assignment.id, {
        title: title.trim(), description, instructions, base_code: baseCode, status,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      });
      onSaved(saved); setMessage('Assignment saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Save failed'); }
    finally { setBusy(false); }
  }}>
    <h2 className="font-bold text-lg text-[#4C4541] dark:text-[#FCF0DA]">Assignment settings</h2>
    <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Title<input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={255} /></label>
    <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Description<textarea aria-label="Description" className={input} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Instructions<textarea aria-label="Instructions" className={input} rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></label>
    <label className="block font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Starter code<textarea aria-label="Starter code" className={`${input} font-mono`} rows={5} value={baseCode} onChange={(e) => setBaseCode(e.target.value)} /></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Status<select aria-label="Status" className={input} value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus)}>
        <option value="draft">Draft</option><option value="published">Published</option><option value="closed">Closed</option>
      </select></label>
      <label className="font-semibold text-xs text-[#4C4541] dark:text-[#FCF0DA]">Deadline (local time)<input className={input} type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></label>
    </div>
    <p className="text-xs text-[#4C4541]/70 dark:text-[#FCF0DA]/70">Leave deadline empty to remove the deadline. Draft assignments are hidden from students; closed assignments stop student submissions.</p>
    {message && <p role="status" className="text-sm font-semibold text-[#2E4324] dark:text-[#AEAC78]">{message}</p>}
    <button className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold px-4 py-2 border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer" disabled={busy || !title.trim()}>{busy ? 'Saving...' : 'Save assignment'}</button>
  </form>;
}
