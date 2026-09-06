import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { GradingWorkspacePage } from './pages/GradingWorkspacePage';
import { IntegrityMatrixPage } from './pages/IntegrityMatrixPage';
import { LoginPage } from './pages/LoginPage';
import { RubricConfigPage } from './pages/RubricConfigPage';
import { api } from './services/api';
import { Assignment, Course, Lecturer, SubmissionListItem } from './types';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('pygrade_token'));
  const [lecturer, setLecturer] = useState<Lecturer | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [targetSubmissionId, setTargetSubmissionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      initApp();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const initApp = async () => {
    setIsLoading(true);
    try {
      const me = await api.getMe();
      setLecturer(me);

      let courseList = await api.listCourses();
      // If no course exists yet, create default CS101 demo course
      if (courseList.length === 0) {
        const defaultCourse = await api.createCourse(
          'CS101',
          'Introduction to Python Programming',
          'Fall 2026'
        );
        courseList = [defaultCourse];
      }
      setCourses(courseList);
      const activeCourse = courseList[0];
      setSelectedCourse(activeCourse);

      let assignList = await api.listAssignments(activeCourse.id);
      // If no assignment exists yet, create default Assignment 1
      if (assignList.length === 0) {
        const defaultAssign = await api.createAssignment(activeCourse.id, {
          title: 'Assignment 1: Recursive Fibonacci & Greeter',
          description: 'Implement recursive Fibonacci computation and greeting input parsing with clean PEP 8 styling.',
          deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          max_score: 10.0,
          timeout_sec: 10,
          memory_limit_mb: 256,
          test_cases: [
            {
              name: 'test_greeting_world',
              input_data: 'World',
              expected_output: 'Hello World',
              is_hidden: false,
              weight: 1.0,
              timeout_ms: 3000,
            },
          ],
        });
        assignList = [defaultAssign];
      }
      setAssignments(assignList);
      const activeAssign = assignList[0];
      setSelectedAssignment(activeAssign);

      await loadSubmissions(activeAssign.id);
    } catch (err) {
      console.error(err);
      handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubmissions = async (assignmentId: string) => {
    try {
      const subs = await api.listSubmissions(assignmentId);
      setSubmissions(subs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoginSuccess = (newToken: string, newLecturer: Lecturer) => {
    localStorage.setItem('pygrade_token', newToken);
    setToken(newToken);
    setLecturer(newLecturer);
  };

  const handleLogout = () => {
    localStorage.removeItem('pygrade_token');
    setToken(null);
    setLecturer(null);
    setCourses([]);
    setAssignments([]);
    setSubmissions([]);
  };

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    const assignList = await api.listAssignments(course.id);
    setAssignments(assignList);
    if (assignList.length > 0) {
      setSelectedAssignment(assignList[0]);
      await loadSubmissions(assignList[0].id);
    } else {
      setSelectedAssignment(null);
      setSubmissions([]);
    }
  };

  const handleSelectAssignment = async (assign: Assignment) => {
    setSelectedAssignment(assign);
    await loadSubmissions(assign.id);
  };

  const handleNavigateToEvaluation = (submissionId: string) => {
    setTargetSubmissionId(submissionId);
    setActiveTab('grading');
  };

  if (!token) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center text-xs text-slate-500 font-mono">
        Loading PyGrade AI Portal...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-900">
      <Navbar
        lecturer={lecturer}
        courses={courses}
        selectedCourse={selectedCourse}
        assignments={assignments}
        selectedAssignment={selectedAssignment}
        activeTab={activeTab}
        onSelectCourse={handleSelectCourse}
        onSelectAssignment={handleSelectAssignment}
        onSelectTab={setActiveTab}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {selectedAssignment ? (
          <>
            {activeTab === 'dashboard' && (
              <DashboardPage
                assignment={selectedAssignment}
                submissions={submissions}
                onSelectSubmission={handleNavigateToEvaluation}
                onRefreshSubmissions={() => loadSubmissions(selectedAssignment.id)}
              />
            )}

            {activeTab === 'grading' && (
              <GradingWorkspacePage
                initialSubmissionId={targetSubmissionId}
                submissionsList={submissions}
                onRefreshList={() => loadSubmissions(selectedAssignment.id)}
              />
            )}

            {activeTab === 'integrity' && (
              <IntegrityMatrixPage assignment={selectedAssignment} />
            )}

            {activeTab === 'rubric' && (
              <RubricConfigPage assignment={selectedAssignment} />
            )}
          </>
        ) : (
          <div className="text-center py-20 text-slate-400 font-mono text-xs">
            No active assignment selected.
          </div>
        )}
      </main>
    </div>
  );
};
