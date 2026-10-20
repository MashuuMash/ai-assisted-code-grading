import React, { useState } from 'react';
import { api } from '../api/client';
import { Assignment, ClassCohort, Course } from '../types';

interface WorkspaceSetupProps {
  courseId: number | null;
  classId: number | null;
  onCourseCreated: (course: Course) => void;
  onClassCreated: (cohort: ClassCohort) => void;
  onAssignmentCreated: (assignment: Assignment) => void;
}

const inputClass = 'w-full rounded-lg border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C46A] disabled:opacity-50';

export const WorkspaceSetup: React.FC<WorkspaceSetupProps> = ({
  courseId, classId, onCourseCreated, onClassCreated, onAssignmentCreated,
}) => {
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [semester, setSemester] = useState('Fall');
  const [year, setYear] = useState(new Date().getFullYear());
  const [assignmentTitle, setAssignmentTitle] = useState('');
  const [assignmentDescription, setAssignmentDescription] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState<'draft' | 'published'>('draft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await action(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Action failed'); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-4xl mx-auto w-full space-y-4 text-sm text-[#4C4541] dark:text-[#FCF0DA]">
      <div>
        <h2 className="text-lg font-bold text-[#4C4541] dark:text-[#FCF0DA]">Set up grading workspace</h2>
        <p className="text-[#4C4541]/80 dark:text-[#FCF0DA]/80">Create a course, choose it above, then create a class and assignment. Configure tests and rubric before importing submissions.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-rose-700 dark:text-rose-300">{error}</p>}

      <form className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-4 space-y-3 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const course = await api.courses.create({ code: courseCode.trim(), name: courseName.trim() });
          onCourseCreated(course);
          setCourseCode(''); setCourseName('');
        });
      }}>
        <h3 className="font-bold text-[#4C4541] dark:text-[#FCF0DA]">1. New course</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} aria-label="Course code" placeholder="Course code (e.g. PY101)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required minLength={2} maxLength={50} />
          <input className={inputClass} aria-label="Course name" placeholder="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
        </div>
        <button disabled={busy} className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 px-4 py-2 font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer">Create course</button>
      </form>

      <form className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-4 space-y-3 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs" onSubmit={(event) => {
        event.preventDefault();
        if (!courseId) return;
        void run(async () => {
          const cohort = await api.classes.create(courseId, { code: classCode.trim(), name: className.trim(), semester: semester.trim(), year });
          onClassCreated(cohort);
          setClassCode(''); setClassName('');
        });
      }}>
        <h3 className="font-bold text-[#4C4541] dark:text-[#FCF0DA]">2. New class in selected course</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} aria-label="Class code" placeholder="Class code" value={classCode} onChange={(e) => setClassCode(e.target.value)} required minLength={2} maxLength={50} disabled={!courseId} />
          <input className={inputClass} aria-label="Class name" placeholder="Class name" value={className} onChange={(e) => setClassName(e.target.value)} required disabled={!courseId} />
          <input className={inputClass} aria-label="Semester" placeholder="Semester" value={semester} onChange={(e) => setSemester(e.target.value)} required disabled={!courseId} />
          <input className={inputClass} aria-label="Year" type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} required disabled={!courseId} />
        </div>
        <button disabled={busy || !courseId} className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 px-4 py-2 font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer">Create class</button>
      </form>

      <form className="rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 bg-[#FFFDF9] dark:bg-[#38322E] p-4 space-y-3 text-[#4C4541] dark:text-[#FCF0DA] shadow-xs" onSubmit={(event) => {
        event.preventDefault();
        if (!courseId || !classId) return;
        void run(async () => {
          const assignment = await api.assignments.create(courseId, classId, {
            title: assignmentTitle.trim(), description: assignmentDescription.trim(), status: assignmentStatus,
          });
          onAssignmentCreated(assignment);
          setAssignmentTitle(''); setAssignmentDescription('');
        });
      }}>
        <h3 className="font-bold text-[#4C4541] dark:text-[#FCF0DA]">3. New assignment in selected class</h3>
        <input className={inputClass} aria-label="Assignment title" placeholder="Assignment title" value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} required disabled={!classId} />
        <textarea className={inputClass} aria-label="Assignment description" placeholder="Instructions or description" value={assignmentDescription} onChange={(e) => setAssignmentDescription(e.target.value)} disabled={!classId} />
        <select className={inputClass} aria-label="Assignment status" value={assignmentStatus} onChange={(e) => setAssignmentStatus(e.target.value as 'draft' | 'published')} disabled={!classId}>
          <option value="draft">Draft</option><option value="published">Published</option>
        </select>
        <button disabled={busy || !classId} className="rounded-lg bg-[#F2C46A] hover:bg-[#F2C46A]/90 px-4 py-2 font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 transition-colors cursor-pointer">Create assignment</button>
      </form>
    </div>
  );
};
