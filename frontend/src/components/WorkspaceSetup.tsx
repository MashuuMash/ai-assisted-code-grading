import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  FolderOpen,
  GraduationCap,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { Assignment, ClassCohort, Course } from '../types';

interface WorkspaceSetupProps {
  courseId: number | null;
  classId: number | null;
  assignmentId: number | null;
  courses: Course[];
  classes: ClassCohort[];
  assignments: Assignment[];
  onSelectCourse: (courseId: number) => void;
  onSelectClass: (classId: number) => void;
  onOpenAssignment: (assignmentId: number, targetTab: 'assignment' | 'grading') => void;
  onCourseCreated: (course: Course) => void;
  onClassCreated: (cohort: ClassCohort) => void;
  onAssignmentCreated: (assignment: Assignment) => void;
  onCourseDeleted: (courseId: number) => void;
  onClassDeleted: (classId: number) => void;
  onAssignmentDeleted: (assignmentId: number) => void;
}

type ViewLevel = 'courses' | 'classes' | 'assignments';
type CreateModalKind = 'course' | 'class' | 'assignment' | null;

interface ConfirmDeleteTarget {
  title: string;
  warning: string;
  execute: () => Promise<void>;
}

const inputClass =
  'w-full rounded-lg border border-[#AEAC78]/60 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2C46A] disabled:opacity-50';

export const WorkspaceSetup: React.FC<WorkspaceSetupProps> = ({
  courseId,
  classId,
  assignmentId,
  courses,
  classes,
  assignments,
  onSelectCourse,
  onSelectClass,
  onOpenAssignment,
  onCourseCreated,
  onClassCreated,
  onAssignmentCreated,
  onCourseDeleted,
  onClassDeleted,
  onAssignmentDeleted,
}) => {
  const [viewLevel, setViewLevel] = useState<ViewLevel>('courses');
  const [createModal, setCreateModal] = useState<CreateModalKind>(null);

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
  const [confirmTarget, setConfirmTarget] = useState<ConfirmDeleteTarget | null>(null);

  const activeCourse = courses.find((c) => c.id === courseId) || null;
  const activeClass = classes.find((cl) => cl.id === classId) || null;

  // Guard viewLevel if parent selection was cleared (e.g. after deleting active course/class)
  const effectiveLevel: ViewLevel =
    viewLevel === 'assignments' && activeCourse && activeClass
      ? 'assignments'
      : viewLevel === 'classes' && activeCourse
      ? 'classes'
      : 'courses';

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const openCreateModalForCurrentLevel = () => {
    setError(null);
    if (effectiveLevel === 'courses') setCreateModal('course');
    else if (effectiveLevel === 'classes') setCreateModal('class');
    else setCreateModal('assignment');
  };

  return (
    <div
      data-testid="workspace-manager"
      className="max-w-5xl mx-auto w-full space-y-5 text-sm text-[#4C4541] dark:text-[#FCF0DA]"
    >
      {/* Top Header: Breadcrumb + Contextual Create Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#AEAC78]/35">
        <div className="space-y-1 min-w-0">
          <nav aria-label="Workspace breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewLevel('courses')}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                effectiveLevel === 'courses'
                  ? 'bg-[#F2C46A]/35 text-[#4C4541] dark:text-[#F2C46A] font-bold'
                  : 'text-[#6B625B] dark:text-[#AEAC78] hover:bg-[#FCF0DA]/50 dark:hover:bg-[#38322E]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>All Courses</span>
            </button>

            {activeCourse && effectiveLevel !== 'courses' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-[#AEAC78] shrink-0" />
                <button
                  type="button"
                  onClick={() => setViewLevel('classes')}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition-colors cursor-pointer truncate max-w-[220px] ${
                    effectiveLevel === 'classes'
                      ? 'bg-[#F2C46A]/35 text-[#4C4541] dark:text-[#F2C46A] font-bold'
                      : 'text-[#6B625B] dark:text-[#AEAC78] hover:bg-[#FCF0DA]/50 dark:hover:bg-[#38322E]'
                  }`}
                >
                  <span className="font-mono">{activeCourse.code}</span>
                  <span className="truncate">- {activeCourse.name}</span>
                </button>
              </>
            )}

            {activeClass && effectiveLevel === 'assignments' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-[#AEAC78] shrink-0" />
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F2C46A]/35 text-[#4C4541] dark:text-[#F2C46A] font-bold truncate max-w-[220px]">
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {activeClass.name} ({activeClass.semester} {activeClass.year})
                  </span>
                </span>
              </>
            )}
          </nav>

          <p className="text-xs text-[#6B625B] dark:text-[#AEAC78]">
            {effectiveLevel === 'courses'
              ? 'Select a course to manage its classes, or create a new course.'
              : effectiveLevel === 'classes'
              ? `Classes inside ${activeCourse?.code}. Select a class to manage its assignments.`
              : `Assignments inside ${activeClass?.name}. Click an assignment to edit tests or grade submissions.`}
          </p>
        </div>

        <button
          type="button"
          data-testid={
            effectiveLevel === 'courses'
              ? 'open-create-course-btn'
              : effectiveLevel === 'classes'
              ? 'open-create-class-btn'
              : 'open-create-assignment-btn'
          }
          onClick={openCreateModalForCurrentLevel}
          className="inline-flex items-center space-x-1.5 rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>
            {effectiveLevel === 'courses'
              ? 'Create New Course'
              : effectiveLevel === 'classes'
              ? 'Create New Class'
              : 'Create New Assignment'}
          </span>
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 p-3 text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {/* LEVEL 1: COURSES */}
      {effectiveLevel === 'courses' && (
        courses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#38322E] p-10 text-center space-y-3">
            <GraduationCap className="w-10 h-10 mx-auto text-[#AEAC78]" />
            <h3 className="text-base font-bold">No courses yet</h3>
            <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] max-w-md mx-auto">
              Create your first course to organize class cohorts, Python assignments, rubrics, and student submissions.
            </p>
            <button
              type="button"
              onClick={() => setCreateModal('course')}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Course</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => {
              const isSelected = c.id === courseId;
              return (
                <div
                  key={c.id}
                  data-testid={`course-card-${c.id}`}
                  onClick={() => {
                    onSelectCourse(c.id);
                    setViewLevel('classes');
                  }}
                  className={`group rounded-2xl border p-4 bg-[#FFFDF9] dark:bg-[#38322E] transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[#F2C46A] ring-2 ring-[#F2C46A]/35'
                      : 'border-[#AEAC78]/40 hover:border-[#F2C46A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#FCF0DA] dark:bg-[#2C2623] border border-[#AEAC78]/40 font-mono text-[11px] font-bold">
                        {c.code}
                      </span>
                      <h3 className="mt-2 font-bold text-sm text-[#4C4541] dark:text-[#FCF0DA] line-clamp-2">
                        {c.name}
                      </h3>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      data-testid={`delete-course-${c.id}`}
                      aria-label={`Delete course ${c.code}`}
                      title={`Delete course ${c.code}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmTarget({
                          title: `Delete course "${c.code} - ${c.name}"?`,
                          warning:
                            'This permanently deletes the course along with all nested classes, assignments, test cases, student submissions, rubrics, and grades.',
                          execute: async () => {
                            await api.courses.remove(c.id);
                            onCourseDeleted(c.id);
                          },
                        });
                      }}
                      className="p-1.5 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#AEAC78]/20 flex items-center justify-between text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                    <span className="inline-flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open classes</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* LEVEL 2: CLASSES IN SELECTED COURSE */}
      {effectiveLevel === 'classes' && activeCourse && (
        classes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#38322E] p-10 text-center space-y-3">
            <Users className="w-10 h-10 mx-auto text-[#AEAC78]" />
            <h3 className="text-base font-bold">No classes in {activeCourse.code} yet</h3>
            <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] max-w-md mx-auto">
              Create a class cohort (e.g. CS101-A, Fall 2026) to start adding assignments.
            </p>
            <button
              type="button"
              onClick={() => setCreateModal('class')}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Class</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((cl) => {
              const isSelected = cl.id === classId;
              return (
                <div
                  key={cl.id}
                  data-testid={`class-card-${cl.id}`}
                  onClick={() => {
                    onSelectClass(cl.id);
                    setViewLevel('assignments');
                  }}
                  className={`group rounded-2xl border p-4 bg-[#FFFDF9] dark:bg-[#38322E] transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[#F2C46A] ring-2 ring-[#F2C46A]/35'
                      : 'border-[#AEAC78]/40 hover:border-[#F2C46A]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block px-2 py-0.5 rounded-md bg-[#FCF0DA] dark:bg-[#2C2623] border border-[#AEAC78]/40 font-mono text-[11px] font-bold">
                        {cl.code}
                      </span>
                      <h3 className="mt-2 font-bold text-sm text-[#4C4541] dark:text-[#FCF0DA] line-clamp-2">
                        {cl.name}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                        {cl.semester} {cl.year}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      data-testid={`delete-class-${cl.id}`}
                      aria-label={`Delete class ${cl.name}`}
                      title={`Delete class ${cl.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmTarget({
                          title: `Delete class "${cl.name} (${cl.semester} ${cl.year})"?`,
                          warning:
                            'This permanently deletes the class cohort along with all its assignments, test cases, student submissions, rubrics, and grades.',
                          execute: async () => {
                            await api.classes.remove(activeCourse.id, cl.id);
                            onClassDeleted(cl.id);
                          },
                        });
                      }}
                      className="p-1.5 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#AEAC78]/20 flex items-center justify-between text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                    <span className="inline-flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Open assignments</span>
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* LEVEL 3: ASSIGNMENTS IN SELECTED CLASS */}
      {effectiveLevel === 'assignments' && activeCourse && activeClass && (
        assignments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#38322E] p-10 text-center space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-[#AEAC78]" />
            <h3 className="text-base font-bold">No assignments in {activeClass.name} yet</h3>
            <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] max-w-md mx-auto">
              Create your first Python assignment to configure test cases, rubrics, and grading.
            </p>
            <button
              type="button"
              onClick={() => setCreateModal('assignment')}
              className="inline-flex items-center space-x-1.5 rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Assignment</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const isSelected = a.id === assignmentId;
              return (
                <div
                  key={a.id}
                  data-testid={`assignment-card-${a.id}`}
                  className={`rounded-2xl border p-4 bg-[#FFFDF9] dark:bg-[#38322E] transition-all flex flex-wrap items-center justify-between gap-4 ${
                    isSelected
                      ? 'border-[#F2C46A] ring-2 ring-[#F2C46A]/35'
                      : 'border-[#AEAC78]/40 hover:border-[#F2C46A]'
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-[#4C4541] dark:text-[#FCF0DA] truncate">
                        {a.title}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          a.status === 'published'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-[#FCF0DA] dark:bg-[#2C2623] text-[#6B625B] dark:text-[#AEAC78]'
                        }`}
                      >
                        {a.status}
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] line-clamp-1">
                        {a.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenAssignment(a.id, 'assignment')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#AEAC78]/50 bg-[#FCF0DA]/40 dark:bg-[#2C2623] hover:border-[#F2C46A] cursor-pointer"
                    >
                      Assignment &amp; Tests
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAssignment(a.id, 'grading')}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F2C46A] hover:bg-[#e2b55b] text-[#4C4541] border border-[#AEAC78]/60 cursor-pointer"
                    >
                      Open Grading
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      data-testid={`delete-assignment-${a.id}`}
                      aria-label={`Delete assignment ${a.title}`}
                      title={`Delete assignment ${a.title}`}
                      onClick={() =>
                        setConfirmTarget({
                          title: `Delete assignment "${a.title}"?`,
                          warning:
                            'This permanently deletes the assignment, all test cases, uploaded student submissions, evidence records, rubric, similarity reports, and grades.',
                          execute: async () => {
                            await api.assignments.remove(activeCourse.id, activeClass.id, a.id);
                            onAssignmentDeleted(a.id);
                          },
                        })
                      }
                      className="p-1.5 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* QUICK-CREATE MODALS */}
      {createModal === 'course' && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="create-course-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setCreateModal(null);
          }}
        >
          <form
            className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78] rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const course = await api.courses.create({
                  code: courseCode.trim(),
                  name: courseName.trim(),
                });
                onCourseCreated(course);
                setCourseCode('');
                setCourseName('');
                setCreateModal(null);
                setViewLevel('classes');
              });
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Create New Course</h3>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                aria-label="Close modal"
                className="p-1 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Course code</label>
                <input
                  className={inputClass}
                  aria-label="Course code"
                  placeholder="e.g. PY101"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  required
                  autoFocus
                  minLength={2}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Course name</label>
                <input
                  className={inputClass}
                  aria-label="Course name"
                  placeholder="Introduction to Python"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#AEAC78]/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Creating...' : 'Create course'}
              </button>
            </div>
          </form>
        </div>
      )}

      {createModal === 'class' && activeCourse && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="create-class-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setCreateModal(null);
          }}
        >
          <form
            className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78] rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const cohort = await api.classes.create(activeCourse.id, {
                  code: classCode.trim(),
                  name: className.trim(),
                  semester: semester.trim(),
                  year,
                });
                onClassCreated(cohort);
                setClassCode('');
                setClassName('');
                setCreateModal(null);
                setViewLevel('assignments');
              });
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Create New Class in {activeCourse.code}</h3>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                aria-label="Close modal"
                className="p-1 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Class code</label>
                <input
                  className={inputClass}
                  aria-label="Class code"
                  placeholder="e.g. C01"
                  value={classCode}
                  onChange={(e) => setClassCode(e.target.value)}
                  required
                  autoFocus
                  minLength={2}
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Class name</label>
                <input
                  className={inputClass}
                  aria-label="Class name"
                  placeholder="Section A"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Semester</label>
                <input
                  className={inputClass}
                  aria-label="Semester"
                  placeholder="Fall"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Year</label>
                <input
                  className={inputClass}
                  aria-label="Year"
                  type="number"
                  min={2020}
                  max={2100}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#AEAC78]/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Creating...' : 'Create class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {createModal === 'assignment' && activeCourse && activeClass && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="create-assignment-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setCreateModal(null);
          }}
        >
          <form
            className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78] rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                const assignment = await api.assignments.create(activeCourse.id, activeClass.id, {
                  title: assignmentTitle.trim(),
                  description: assignmentDescription.trim(),
                  status: assignmentStatus,
                });
                onAssignmentCreated(assignment);
                setAssignmentTitle('');
                setAssignmentDescription('');
                setCreateModal(null);
              });
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">New Assignment in {activeClass.name}</h3>
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                aria-label="Close modal"
                className="p-1 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:bg-black/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Assignment title</label>
                <input
                  className={inputClass}
                  aria-label="Assignment title"
                  placeholder="e.g. Lab 1 - Sorting"
                  value={assignmentTitle}
                  onChange={(e) => setAssignmentTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description</label>
                <textarea
                  className={inputClass}
                  aria-label="Assignment description"
                  placeholder="Instructions or short description"
                  value={assignmentDescription}
                  onChange={(e) => setAssignmentDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Status</label>
                <select
                  className={inputClass}
                  aria-label="Assignment status"
                  value={assignmentStatus}
                  onChange={(e) => setAssignmentStatus(e.target.value as 'draft' | 'published')}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateModal(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#AEAC78]/50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#F2C46A] hover:bg-[#e2b55b] px-4 py-2 text-xs font-bold text-[#4C4541] border border-[#AEAC78]/60 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Creating...' : 'Create assignment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="confirm-delete-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setConfirmTarget(null);
          }}
        >
          <div className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-rose-500/60 rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-2.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h4 className="text-base font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                  {confirmTarget.title}
                </h4>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmTarget(null)}
                aria-label="Cancel delete"
                className="p-1 rounded-lg text-[#6B625B] dark:text-[#AEAC78] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-[#6B625B] dark:text-[#D8CEBA]">
              {confirmTarget.warning}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#AEAC78]/50 text-[#4C4541] dark:text-[#FCF0DA] hover:bg-[#FCF0DA]/40 dark:hover:bg-[#2C2623] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                data-testid="confirm-delete-submit"
                onClick={() => {
                  const target = confirmTarget;
                  void run(async () => {
                    await target.execute();
                    setConfirmTarget(null);
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50 cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{busy ? 'Deleting...' : 'Delete permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
