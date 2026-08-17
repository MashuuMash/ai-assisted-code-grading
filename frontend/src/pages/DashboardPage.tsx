import React, { FormEvent, useEffect, useState } from 'react';
import AuthenticatedLayout from '../components/AuthenticatedLayout';
import AssignmentPanel from '../components/AssignmentPanel';
import { authService, UserResponse } from '../services/authService';
import { Cohort, Course, courseService } from '../services/courseService';
import { getErrorMessage } from '../services/errors';
import './DashboardPage.css';

const DashboardPage: React.FC = () => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [classes, setClasses] = useState<Cohort[]>([]);
  const [selectedClass, setSelectedClass] = useState<Cohort | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadCourses = async () => {
    const values = await courseService.listCourses();
    setCourses(values);
  };

  useEffect(() => {
    Promise.all([authService.getCurrentUser(), courseService.listCourses()])
      .then(([currentUser, values]) => {
        setUser(currentUser);
        setCourses(values);
      })
      .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load dashboard')))
      .finally(() => setLoading(false));
  }, []);

  const chooseCourse = async (course: Course) => {
    setSelectedCourse(course);
    setSelectedClass(null);
    setError('');
    try {
      setClasses(await courseService.listClasses(course.id));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to load classes'));
    }
  };

  const createCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await courseService.createCourse({
        code: String(form.get('code')),
        name: String(form.get('name')),
        description: String(form.get('description')) || null,
      });
      event.currentTarget.reset();
      await loadCourses();
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to create course'));
    }
  };

  const createClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCourse) return;
    const form = new FormData(event.currentTarget);
    try {
      await courseService.createClass(selectedCourse.id, {
        code: String(form.get('code')),
        name: String(form.get('name')),
        description: null,
        semester: String(form.get('semester')),
        year: Number(form.get('year')),
      });
      event.currentTarget.reset();
      setClasses(await courseService.listClasses(selectedCourse.id));
    } catch (reason: unknown) {
      setError(getErrorMessage(reason, 'Unable to create class'));
    }
  };

  if (loading) return <div className="dashboard-container"><p>Loading...</p></div>;
  if (!user) return <div className="dashboard-container"><p>{error || 'Authentication required'}</p></div>;
  const canManage = user.role === 'lecturer' || user.role === 'admin';

  return (
    <AuthenticatedLayout user={user}>
      {error && <div className="error-message">{error}</div>}
      <section className="welcome-section">
        <h2>{canManage ? 'Your courses' : 'Enrolled courses'}</h2>
        {courses.length === 0 && <p>No courses are available.</p>}
        <div className="features-grid">
          {courses.map((course) => (
            <button key={course.id} className="feature-card" onClick={() => chooseCourse(course)}>
              <h3>{course.code}</h3><p>{course.name}</p>
            </button>
          ))}
        </div>
      </section>
      {canManage && (
        <form className="phase-form" onSubmit={createCourse}>
          <h3>Create course</h3>
          <input name="code" placeholder="Course code" required maxLength={50} />
          <input name="name" placeholder="Course name" required maxLength={255} />
          <input name="description" placeholder="Description (optional)" maxLength={5000} />
          <button type="submit">Create</button>
        </form>
      )}
      {selectedCourse && (
        <section className="welcome-section">
          <h2>{selectedCourse.code} classes</h2>
          {classes.length === 0 ? <p>No accessible classes.</p> : classes.map((item) => (
            <button className="feature-card" key={item.id} onClick={() => setSelectedClass(item)}>
              <h3>{item.code} — {item.name}</h3><p>{item.semester} {item.year}</p>
            </button>
          ))}
          {canManage && (
            <form className="phase-form" onSubmit={createClass}>
              <h3>Create class</h3>
              <input name="code" placeholder="Class code" required maxLength={50} />
              <input name="name" placeholder="Class name" required maxLength={255} />
              <input name="semester" placeholder="Semester" required maxLength={50} />
              <input name="year" type="number" min="2000" max="2200" defaultValue={new Date().getFullYear()} required />
              <button type="submit">Create</button>
            </form>
          )}
        </section>
      )}
      {selectedCourse && selectedClass && (
        <AssignmentPanel course={selectedCourse} cohort={selectedClass} user={user} />
      )}
    </AuthenticatedLayout>
  );
};

export default DashboardPage;
