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

const inputClass = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-indigo-500';

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
    <div className="max-w-4xl mx-auto w-full space-y-4 text-sm">
      <div>
        <h2 className="text-lg font-bold">Set up grading workspace</h2>
        <p className="text-slate-600">Create a course, choose it above, then create a class and assignment. Configure tests and rubric before importing submissions.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700">{error}</p>}

      <form className="rounded-xl border bg-white p-4 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          const course = await api.courses.create({ code: courseCode.trim(), name: courseName.trim() });
          onCourseCreated(course);
          setCourseCode(''); setCourseName('');
        });
      }}>
        <h3 className="font-bold">1. New course</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} aria-label="Course code" placeholder="Course code (e.g. PY101)" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} required minLength={2} maxLength={50} />
          <input className={inputClass} aria-label="Course name" placeholder="Course name" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
        </div>
        <button disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Create course</button>
      </form>

      <form className="rounded-xl border bg-white p-4 space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (!courseId) return;
        void run(async () => {
          const cohort = await api.classes.create(courseId, { code: classCode.trim(), name: className.trim(), semester: semester.trim(), year });
          onClassCreated(cohort);
          setClassCode(''); setClassName('');
        });
      }}>
        <h3 className="font-bold">2. New class in selected course</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input className={inputClass} aria-label="Class code" placeholder="Class code" value={classCode} onChange={(e) => setClassCode(e.target.value)} required minLength={2} maxLength={50} disabled={!courseId} />
          <input className={inputClass} aria-label="Class name" placeholder="Class name" value={className} onChange={(e) => setClassName(e.target.value)} required disabled={!courseId} />
          <input className={inputClass} aria-label="Semester" placeholder="Semester" value={semester} onChange={(e) => setSemester(e.target.value)} required disabled={!courseId} />
          <input className={inputClass} aria-label="Year" type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} required disabled={!courseId} />
        </div>
        <button disabled={busy || !courseId} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Create class</button>
      </form>

      <form className="rounded-xl border bg-white p-4 space-y-3" onSubmit={(event) => {
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
        <h3 className="font-bold">3. New assignment in selected class</h3>
        <input className={inputClass} aria-label="Assignment title" placeholder="Assignment title" value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} required disabled={!classId} />
        <textarea className={inputClass} aria-label="Assignment description" placeholder="Instructions or description" value={assignmentDescription} onChange={(e) => setAssignmentDescription(e.target.value)} disabled={!classId} />
        <select className={inputClass} aria-label="Assignment status" value={assignmentStatus} onChange={(e) => setAssignmentStatus(e.target.value as 'draft' | 'published')} disabled={!classId}>
          <option value="draft">Draft</option><option value="published">Published</option>
        </select>
        <button disabled={busy || !classId} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Create assignment</button>
      </form>
    </div>
  );
};
