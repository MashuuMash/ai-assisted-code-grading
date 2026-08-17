import api from './api';

export interface Course {
  id: number;
  code: string;
  name: string;
  description: string | null;
  instructor_id: number;
  is_active: boolean;
}

export interface Cohort {
  id: number;
  course_id: number;
  code: string;
  name: string;
  description: string | null;
  semester: string;
  year: number;
  is_active: boolean;
}

export const courseService = {
  async listCourses(): Promise<Course[]> {
    return (await api.get<Course[]>('/courses')).data;
  },
  async createCourse(data: Pick<Course, 'code' | 'name' | 'description'>): Promise<Course> {
    return (await api.post<Course>('/courses', data)).data;
  },
  async listClasses(courseId: number): Promise<Cohort[]> {
    return (await api.get<Cohort[]>(`/courses/${courseId}/classes`)).data;
  },
  async createClass(
    courseId: number,
    data: Pick<Cohort, 'code' | 'name' | 'description' | 'semester' | 'year'>
  ): Promise<Cohort> {
    return (await api.post<Cohort>(`/courses/${courseId}/classes`, data)).data;
  },
};
