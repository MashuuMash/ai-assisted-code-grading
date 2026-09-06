import React from 'react';
import { Terminal, Shield, FileText, BarChart3, Sliders, LogOut, ChevronRight } from 'lucide-react';
import { Assignment, Course, Lecturer } from '../types';

interface NavbarProps {
  lecturer: Lecturer | null;
  courses: Course[];
  selectedCourse: Course | null;
  assignments: Assignment[];
  selectedAssignment: Assignment | null;
  activeTab: string;
  onSelectCourse: (course: Course) => void;
  onSelectAssignment: (assignment: Assignment) => void;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lecturer,
  courses,
  selectedCourse,
  assignments,
  selectedAssignment,
  activeTab,
  onSelectCourse,
  onSelectAssignment,
  onSelectTab,
  onLogout,
}) => {
  return (
    <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Breadcrumbs */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 text-primary font-bold text-base tracking-tight">
              <div className="w-8 h-8 rounded bg-primary-50 flex items-center justify-center border border-primary-200">
                <Terminal className="w-4 h-4 text-primary" />
              </div>
              <span className="text-slate-900 font-semibold">PyGrade AI</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200">
                Lecturer
              </span>
            </div>

            <ChevronRight className="w-4 h-4 text-slate-400" />

            {/* Course Selector */}
            <select
              value={selectedCourse?.id || ''}
              onChange={(e) => {
                const c = courses.find((x) => x.id === e.target.value);
                if (c) onSelectCourse(c);
              }}
              className="text-xs font-medium bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>

            {selectedCourse && (
              <>
                <ChevronRight className="w-4 h-4 text-slate-400" />
                {/* Assignment Selector */}
                <select
                  value={selectedAssignment?.id || ''}
                  onChange={(e) => {
                    const a = assignments.find((x) => x.id === e.target.value);
                    if (a) onSelectAssignment(a);
                  }}
                  className="text-xs font-medium bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {assignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-4">
            {lecturer && (
              <div className="flex items-center space-x-2 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{lecturer.full_name}</span>
                <span className="text-slate-400">({lecturer.email})</span>
              </div>
            )}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        {selectedAssignment && (
          <nav className="flex space-x-6 -mb-px pt-1 text-xs font-medium border-t border-slate-100">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`flex items-center space-x-1.5 py-2.5 border-b-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Assessments Dashboard</span>
            </button>

            <button
              onClick={() => onSelectTab('grading')}
              className={`flex items-center space-x-1.5 py-2.5 border-b-2 transition-colors ${
                activeTab === 'grading'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Grading Workspace</span>
            </button>

            <button
              onClick={() => onSelectTab('integrity')}
              className={`flex items-center space-x-1.5 py-2.5 border-b-2 transition-colors ${
                activeTab === 'integrity'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Integrity Matrix</span>
            </button>

            <button
              onClick={() => onSelectTab('rubric')}
              className={`flex items-center space-x-1.5 py-2.5 border-b-2 transition-colors ${
                activeTab === 'rubric'
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Rubric Configuration</span>
            </button>
          </nav>
        )}
      </div>
    </header>
  );
};
