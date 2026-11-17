import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { ApiError, api } from '../api/client';
import { CourseActivityBarChart, DonutBreakdownChart } from '../components/AdminCharts';
import { Navbar } from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';
import {
  AdminClassItem,
  AdminCourseItem,
  AdminOverview,
  AdminSystemHealth,
  User,
  UserRole,
} from '../types';

type AdminTab = 'overview' | 'users' | 'governance' | 'health';

export const AdminDashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<AdminCourseItem[]>([]);
  const [classes, setClasses] = useState<AdminClassItem[]>([]);
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [busyJobId, setBusyJobId] = useState<number | null>(null);
  const [busyCourseId, setBusyCourseId] = useState<number | null>(null);
  const [busyClassId, setBusyClassId] = useState<number | null>(null);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'lecturer' as UserRole,
  });
  const [creatingUser, setCreatingUser] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, userList, courseList, classList, sysHealth] = await Promise.all([
        api.admin.overview(),
        api.admin.listUsers({ search, role: roleFilter }),
        api.admin.listCourses(),
        api.admin.listClasses(),
        api.admin.getHealth(),
      ]);
      setOverview(ov);
      setUsers(userList.filter((u) => u.role === 'admin' || u.role === 'lecturer'));
      setCourses(courseList);
      setClasses(classList);
      setHealth(sysHealth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleUpdateUser = async (
    targetUser: User,
    patch: { role?: UserRole; is_active?: boolean }
  ) => {
    setBusyUserId(targetUser.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await api.admin.updateUser(targetUser.id, patch);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      setNotice(`Updated account @${updated.username}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDeleteUser = async (targetUser: User) => {
    if (!window.confirm(`Delete user "@${targetUser.username}" (${targetUser.email})?`)) {
      return;
    }
    setBusyUserId(targetUser.id);
    setError(null);
    setNotice(null);
    try {
      await api.admin.deleteUser(targetUser.id, false);
      setNotice(`Deleted account @${targetUser.username}`);
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const confirmForce = window.confirm(
          `${err.message}\n\nProceed with FORCE DELETE of @${targetUser.username} and all their courses, classes, and submissions?`
        );
        if (confirmForce) {
          try {
            await api.admin.deleteUser(targetUser.id, true);
            setNotice(`Force-deleted @${targetUser.username} and owned courses`);
            await loadAll();
            return;
          } catch (innerErr) {
            setError(innerErr instanceof Error ? innerErr.message : 'Force delete failed');
            return;
          }
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingUser(true);
    setError(null);
    setNotice(null);
    try {
      const created = await api.admin.createUser(createForm);
      setNotice(`Created user @${created.username} (${created.role})`);
      setIsCreateUserOpen(false);
      setCreateForm({
        username: '',
        email: '',
        full_name: '',
        password: '',
        role: 'lecturer',
      });
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRetryJob = async (jobId: number) => {
    setBusyJobId(jobId);
    setError(null);
    setNotice(null);
    try {
      await api.admin.retryJob(jobId);
      setNotice(`Job #${jobId} re-queued for grading`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry job');
    } finally {
      setBusyJobId(null);
    }
  };

  const handleDeleteCourse = async (course: AdminCourseItem) => {
    if (
      !window.confirm(
        `Delete course "${course.code}: ${course.name}" and ALL its classes, assignments, and submissions?`
      )
    ) {
      return;
    }
    setBusyCourseId(course.id);
    setError(null);
    setNotice(null);
    try {
      await api.admin.deleteCourse(course.id);
      setNotice(`Deleted course ${course.code}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete course');
    } finally {
      setBusyCourseId(null);
    }
  };

  const handleDeleteClass = async (cohort: AdminClassItem) => {
    if (
      !window.confirm(
        `Delete class "${cohort.code} (${cohort.name})" under ${cohort.course_code} and all its assignments/submissions?`
      )
    ) {
      return;
    }
    setBusyClassId(cohort.id);
    setError(null);
    setNotice(null);
    try {
      await api.admin.deleteClass(cohort.id);
      setNotice(`Deleted class ${cohort.code}`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete class');
    } finally {
      setBusyClassId(null);
    }
  };

  const completedJobs = overview?.jobs_by_status.completed || 0;
  const queuedJobs = overview?.jobs_by_status.queued || 0;
  const runningJobs = overview?.jobs_by_status.running || 0;
  const failedJobs = overview?.jobs_by_status.failed || 0;
  const totalJobs = completedJobs + queuedJobs + runningJobs + failedJobs;
  const jobSuccessPct = totalJobs > 0 ? `${Math.round((completedJobs / totalJobs) * 100)}%` : '0%';
  const platformAccountCount = overview
    ? (overview.users_by_role.lecturer || 0) + (overview.users_by_role.admin || 0)
    : users.length;

  const navItems: Array<{
    id: AdminTab;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string | number;
  }> = [
    {
      id: 'overview',
      label: 'Overview & Jobs',
      shortLabel: 'Overview',
      description: 'Analytics charts, KPI summary, and failed grading job recovery.',
      icon: LayoutDashboard,
    },
    {
      id: 'users',
      label: `Users (${platformAccountCount})`,
      shortLabel: 'Users',
      description: 'Manage instructor and admin accounts, roles, activation state, and deletion.',
      icon: Users,
      badge: platformAccountCount,
    },
    {
      id: 'governance',
      label: `Courses & Classes (${courses.length})`,
      shortLabel: 'Governance',
      description: 'Audit and moderate courses and class cohorts across the platform.',
      icon: FolderKanban,
      badge: courses.length,
    },
    {
      id: 'health',
      label: 'Worker & Health',
      shortLabel: 'Health',
      description: 'Inspect database heartbeat, file storage, and active worker queues.',
      icon: Server,
    },
  ];

  const activeMeta = navItems.find((item) => item.id === activeTab) || navItems[0];

  return (
    <div
      data-testid="admin-dashboard-root"
      className="min-h-screen bg-[#FCF0DA]/40 dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] flex flex-col font-sans"
    >
      <Navbar hideAdminConsoleModalItem />

      <div className="flex-1 flex min-h-0 relative">
        {/* Mobile Sidebar Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Left Sidebar */}
        <aside
          aria-label="Admin sidebar navigation"
          className={cn(
            'bg-[#FFFDF9] dark:bg-[#312B27] border-r border-[#AEAC78]/35 flex flex-col justify-between shrink-0 transition-all duration-200 z-40',
            'fixed lg:static inset-y-0 left-0 top-14 lg:top-0',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
            sidebarCollapsed ? 'w-64 lg:w-20' : 'w-64'
          )}
        >
          <div className="p-3 space-y-4">
            {/* Sidebar Identity Header */}
            <div
              className={cn(
                'p-2.5 rounded-xl bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78]/30 flex items-center gap-2.5',
                sidebarCollapsed && 'lg:justify-center'
              )}
            >
              <div className="p-2 rounded-lg bg-[#4C4541] text-[#F2C46A] shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-extrabold truncate">Admin Console</div>
                  <div className="text-[10px] font-mono text-[#6B625B] dark:text-[#AEAC78] truncate">
                    @{currentUser?.username || 'admin'}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar Nav Items */}
            <nav className="space-y-1">
              {!sidebarCollapsed && (
                <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#AEAC78]">
                  Administration
                </div>
              )}
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left',
                      sidebarCollapsed && 'lg:justify-center lg:px-2',
                      isActive
                        ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] border-[#4C4541] dark:border-[#F2C46A] shadow-xs'
                        : 'bg-transparent border-transparent text-[#4C4541] dark:text-[#FCF0DA] hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623]'
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!sidebarCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Bottom Summary + Collapse Control */}
          <div className="p-3 border-t border-[#AEAC78]/25 space-y-2">
            {!sidebarCollapsed && (
              <div className="p-3 rounded-xl bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/30 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between font-bold">
                  <span>System Status</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[10px]',
                      health?.database_ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                    )}
                  >
                    <span
                      className={cn(
                        'w-2 h-2 rounded-full',
                        health?.database_ok ? 'bg-emerald-500' : 'bg-rose-500'
                      )}
                    />
                    {health?.database_ok ? 'Online' : 'Alert'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[#6B625B] dark:text-[#AEAC78] font-mono">
                  <span>Queue: {health?.queued_jobs ?? 0}</span>
                  <span>Failed: {health?.failed_jobs ?? 0}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSidebarCollapsed((c) => !c)}
              className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50 dark:hover:bg-[#2C2623] text-xs font-semibold cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <>
                  <PanelLeftClose className="w-4 h-4" />
                  <span>Collapse Sidebar</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Workspace */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 overflow-y-auto flex flex-col gap-5">
          {/* Top Section Header */}
          <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/40 px-5 py-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-[#AEAC78]/40 hover:bg-[#FCF0DA] cursor-pointer"
                aria-label="Open admin menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-extrabold tracking-tight text-[#4C4541] dark:text-[#FCF0DA]">
                    System Administration Dashboard
                  </h1>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F2C46A]/25 text-[#4C4541] dark:text-[#F2C46A] border border-[#AEAC78]/40">
                    {activeMeta.shortLabel}
                  </span>
                </div>
                <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-0.5">
                  {activeMeta.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#AEAC78]/50 bg-[#FCF0DA]/40 dark:bg-[#2C2623] hover:bg-[#FCF0DA] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              <span>Refresh Data</span>
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200 text-xs font-semibold flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {error}
              </span>
              <button type="button" onClick={() => setError(null)} className="p-1 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {notice}
              </span>
              <button type="button" onClick={() => setNotice(null)} className="p-1 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* VIEW 1: OVERVIEW, CHARTS & FAILED JOBS */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-5">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between text-[#AEAC78] text-xs font-bold uppercase">
                    <span>Total Users</span>
                    <Users className="w-4 h-4 text-[#F2C46A]" />
                  </div>
                  <div className="text-3xl font-black mt-2">{platformAccountCount}</div>
                  <div className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-1 font-mono">
                    {overview.users_by_role.lecturer || 0} lecturers | {overview.users_by_role.admin || 0} admins
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between text-[#AEAC78] text-xs font-bold uppercase">
                    <span>Courses & Classes</span>
                    <FolderKanban className="w-4 h-4 text-[#F2C46A]" />
                  </div>
                  <div className="text-3xl font-black mt-2">{overview.total_courses}</div>
                  <div className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-1 font-mono">
                    {overview.total_classes} cohorts | {overview.total_assignments} assignments
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between text-[#AEAC78] text-xs font-bold uppercase">
                    <span>Total Submissions</span>
                    <BookOpen className="w-4 h-4 text-[#F2C46A]" />
                  </div>
                  <div className="text-3xl font-black mt-2">{overview.total_submissions}</div>
                  <div className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-1 font-mono">
                    {completedJobs} graded | {queuedJobs} queued
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between text-[#AEAC78] text-xs font-bold uppercase">
                    <span>Failed Grading Jobs</span>
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="text-3xl font-black mt-2 text-rose-600 dark:text-rose-400">
                    {failedJobs}
                  </div>
                  <div className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-1 font-mono">
                    {runningJobs} currently running
                  </div>
                </div>
              </div>

              {/* Analytics Charts Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <DonutBreakdownChart
                  title="Grading Pipeline Distribution"
                  subtitle="Status breakdown across all execution jobs"
                  centerLabel="Success"
                  centerValue={jobSuccessPct}
                  segments={[
                    {
                      label: 'Completed',
                      value: completedJobs,
                      color: '#10b981',
                      dotClass: 'bg-emerald-500',
                    },
                    {
                      label: 'Queued',
                      value: queuedJobs,
                      color: '#F2C46A',
                      dotClass: 'bg-[#F2C46A]',
                    },
                    {
                      label: 'Running',
                      value: runningJobs,
                      color: '#0ea5e9',
                      dotClass: 'bg-sky-500',
                    },
                    {
                      label: 'Failed',
                      value: failedJobs,
                      color: '#f43f5e',
                      dotClass: 'bg-rose-500',
                    },
                  ]}
                />

                <DonutBreakdownChart
                  title="Account Role Composition"
                  subtitle="Instructor and administrator accounts"
                  centerLabel="Accounts"
                  centerValue={platformAccountCount}
                  segments={[
                    {
                      label: 'Lecturers',
                      value: overview.users_by_role.lecturer || 0,
                      color: '#F2C46A',
                      dotClass: 'bg-[#F2C46A]',
                    },
                    {
                      label: 'Admins',
                      value: overview.users_by_role.admin || 0,
                      color: '#4C4541',
                      dotClass: 'bg-[#4C4541] dark:bg-[#FCF0DA]',
                    },
                  ]}
                />

                <CourseActivityBarChart courses={courses} />
              </div>

              {/* Failed Jobs Table */}
              <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/40 overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-[#AEAC78]/25 bg-[#FCF0DA]/40 dark:bg-[#2C2623] flex items-center justify-between">
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#F2C46A]" />
                    <span>Recent Failed Grading Jobs</span>
                  </h2>
                  <span className="text-xs font-mono text-[#AEAC78]">
                    {overview.recent_failed_jobs.length} recent failures
                  </span>
                </div>
                {overview.recent_failed_jobs.length === 0 ? (
                  <div className="p-8 text-center text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All grading jobs are healthy. No failed jobs reported.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-b border-[#AEAC78]/30 font-bold uppercase text-[11px]">
                        <tr>
                          <th className="px-4 py-2.5">Job ID</th>
                          <th className="px-4 py-2.5">Submission ID</th>
                          <th className="px-4 py-2.5">Error Message</th>
                          <th className="px-4 py-2.5">Created At</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#AEAC78]/20">
                        {overview.recent_failed_jobs.map((job) => (
                          <tr key={job.id} className="hover:bg-[#FCF0DA]/25 dark:hover:bg-[#2C2623]/40">
                            <td className="px-4 py-2.5 font-mono font-bold">#{job.id}</td>
                            <td className="px-4 py-2.5 font-mono">#{job.submission_id}</td>
                            <td className="px-4 py-2.5 text-rose-700 dark:text-rose-300 max-w-md truncate">
                              {job.error_message || 'Execution failed'}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[#6B625B] dark:text-[#AEAC78]">
                              {new Date(job.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => void handleRetryJob(job.id)}
                                disabled={busyJobId === job.id}
                                className="px-2.5 py-1 rounded-lg bg-[#F2C46A] hover:bg-[#e5b65b] text-[#4C4541] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>{busyJobId === job.id ? 'Queuing...' : 'Retry'}</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: USERS */}
          {activeTab === 'users' && (
            <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/40 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-[#AEAC78]/25 bg-[#FCF0DA]/35 dark:bg-[#2C2623] flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                  <div className="relative flex-1 max-w-xs">
                    <Search className="w-3.5 h-3.5 text-[#AEAC78] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, username, email..."
                      aria-label="Search admin users"
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#38322E] text-xs"
                    />
                  </div>
                  <select
                    aria-label="Filter users by role"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                    className="px-3 py-1.5 rounded-xl border border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#38322E] text-xs"
                  >
                    <option value="">All Roles</option>
                    <option value="lecturer">Lecturer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create User</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-b border-[#AEAC78]/30 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="px-4 py-2.5">User</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5">Role</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#AEAC78]/20">
                    {users.map((u) => {
                      const isSelf = currentUser?.id === u.id;
                      const busy = busyUserId === u.id;
                      return (
                        <tr key={u.id} className="hover:bg-[#FCF0DA]/25 dark:hover:bg-[#2C2623]/40">
                          <td className="px-4 py-2.5">
                            <div className="font-bold">
                              {u.full_name} {isSelf && <span className="text-[10px] text-[#F2C46A]">(You)</span>}
                            </div>
                            <div className="font-mono text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                              @{u.username}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono">{u.email}</td>
                          <td className="px-4 py-2.5">
                            <select
                              aria-label={`Role for ${u.username}`}
                              value={u.role}
                              disabled={isSelf || busy}
                              onChange={(e) =>
                                void handleUpdateUser(u, { role: e.target.value as UserRole })
                              }
                              className="px-2 py-1 rounded-lg border border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#2C2623] text-xs disabled:opacity-50"
                            >
                              <option value="lecturer">lecturer</option>
                              <option value="admin">admin</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border',
                                u.is_active
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                              )}
                            >
                              {u.is_active ? 'Active' : 'Locked'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right space-x-2">
                            <button
                              type="button"
                              disabled={isSelf || busy}
                              onClick={() => void handleUpdateUser(u, { is_active: !u.is_active })}
                              className="px-2.5 py-1 rounded-lg border border-[#AEAC78]/50 hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623] font-semibold disabled:opacity-40 cursor-pointer"
                            >
                              {u.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                              type="button"
                              disabled={isSelf || busy}
                              onClick={() => void handleDeleteUser(u)}
                              className="p-1.5 rounded-lg border border-rose-300/70 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40 cursor-pointer align-middle"
                              title={`Delete @${u.username}`}
                              aria-label={`Delete ${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-[#AEAC78]">
                          No users match your search filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: COURSES & CLASSES GOVERNANCE */}
          {activeTab === 'governance' && (
            <div className="space-y-5">
              <CourseActivityBarChart courses={courses} />

              <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/40 overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-[#AEAC78]/25 bg-[#FCF0DA]/40 dark:bg-[#2C2623] flex items-center justify-between">
                  <h2 className="text-sm font-bold">All Platform Courses ({courses.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-b border-[#AEAC78]/30 font-bold uppercase text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5">Code & Name</th>
                        <th className="px-4 py-2.5">Instructor</th>
                        <th className="px-4 py-2.5">Classes</th>
                        <th className="px-4 py-2.5">Submissions</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#AEAC78]/20">
                      {courses.map((c) => (
                        <tr key={c.id} className="hover:bg-[#FCF0DA]/25 dark:hover:bg-[#2C2623]/40">
                          <td className="px-4 py-2.5">
                            <div className="font-bold font-mono">{c.code}</div>
                            <div className="text-[#6B625B] dark:text-[#AEAC78]">{c.name}</div>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="font-semibold">{c.instructor_name}</div>
                            <div className="font-mono text-[11px] text-[#AEAC78]">
                              {c.instructor_email}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono">{c.class_count}</td>
                          <td className="px-4 py-2.5 font-mono">{c.submission_count}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={busyCourseId === c.id}
                              onClick={() => void handleDeleteCourse(c)}
                              className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Course</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {courses.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[#AEAC78]">
                            No courses exist in the system yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/40 overflow-hidden shadow-xs">
                <div className="px-5 py-3.5 border-b border-[#AEAC78]/25 bg-[#FCF0DA]/40 dark:bg-[#2C2623] flex items-center justify-between">
                  <h2 className="text-sm font-bold">All Classes / Cohorts ({classes.length})</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-b border-[#AEAC78]/30 font-bold uppercase text-[11px]">
                      <tr>
                        <th className="px-4 py-2.5">Course</th>
                        <th className="px-4 py-2.5">Class Code & Name</th>
                        <th className="px-4 py-2.5">Term</th>
                        <th className="px-4 py-2.5">Assignments</th>
                        <th className="px-4 py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#AEAC78]/20">
                      {classes.map((cl) => (
                        <tr key={cl.id} className="hover:bg-[#FCF0DA]/25 dark:hover:bg-[#2C2623]/40">
                          <td className="px-4 py-2.5 font-mono font-bold">{cl.course_code}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono font-bold">{cl.code}</span> - {cl.name}
                          </td>
                          <td className="px-4 py-2.5 font-mono">
                            {cl.semester} {cl.year}
                          </td>
                          <td className="px-4 py-2.5 font-mono">{cl.assignment_count}</td>
                          <td className="px-4 py-2.5 text-right">
                            <button
                              type="button"
                              disabled={busyClassId === cl.id}
                              onClick={() => void handleDeleteClass(cl)}
                              className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Class</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {classes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-[#AEAC78]">
                            No classes created yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: WORKER & SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#AEAC78]">Database</span>
                    <Database className="w-5 h-5 text-[#F2C46A]" />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-lg font-black">
                    {health?.database_ok ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Connected (Healthy)</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">Disconnected</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-1">
                    Verified via live SQLAlchemy heartbeat query.
                  </p>
                </div>

                <div className="p-5 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#AEAC78]">Submission Storage</span>
                    <HardDrive className="w-5 h-5 text-[#F2C46A]" />
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-lg font-black">
                    {health?.storage_ok ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Writable & Ready</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">Storage Unavailable</span>
                    )}
                  </div>
                  <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] mt-1">
                    Runner mode: <code className="font-mono">{health?.worker_mode || 'unknown'}</code>
                  </p>
                </div>

                <div className="p-5 rounded-2xl border border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-[#AEAC78]">Worker Queue</span>
                    <Server className="w-5 h-5 text-[#F2C46A]" />
                  </div>
                  <div className="mt-3 font-mono text-sm space-y-1">
                    <div>
                      Queued jobs: <strong>{health?.queued_jobs ?? 0}</strong>
                    </div>
                    <div>
                      Running jobs: <strong>{health?.running_jobs ?? 0}</strong>
                    </div>
                    <div className="text-rose-600 dark:text-rose-400">
                      Failed jobs: <strong>{health?.failed_jobs ?? 0}</strong>
                    </div>
                  </div>
                  {health?.checked_at && (
                    <p className="text-[11px] text-[#AEAC78] mt-2 font-mono">
                      Checked: {new Date(health.checked_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>

              {overview && (
                <DonutBreakdownChart
                  title="Live Worker Execution Split"
                  subtitle="Current queue vs completed vs failed execution balance"
                  centerLabel="Success"
                  centerValue={jobSuccessPct}
                  segments={[
                    {
                      label: 'Completed',
                      value: completedJobs,
                      color: '#10b981',
                      dotClass: 'bg-emerald-500',
                    },
                    {
                      label: 'Queued',
                      value: queuedJobs,
                      color: '#F2C46A',
                      dotClass: 'bg-[#F2C46A]',
                    },
                    {
                      label: 'Running',
                      value: runningJobs,
                      color: '#0ea5e9',
                      dotClass: 'bg-sky-500',
                    },
                    {
                      label: 'Failed',
                      value: failedJobs,
                      color: '#f43f5e',
                      dotClass: 'bg-rose-500',
                    },
                  ]}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Create User Modal */}
      {isCreateUserOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create new user"
        >
          <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/50 max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#AEAC78]/25">
              <h3 className="text-sm font-bold">Create Platform Account</h3>
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="p-1 text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleCreateUser(e)} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-bold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="Nguyen Van A"
                  className="w-full px-3 py-2 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/25 dark:bg-[#2C2623]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Username</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={createForm.username}
                  onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="lecturer_a"
                  className="w-full px-3 py-2 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/25 dark:bg-[#2C2623]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="lecturer_a@school.edu"
                  className="w-full px-3 py-2 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/25 dark:bg-[#2C2623]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Initial Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3 py-2 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/25 dark:bg-[#2C2623]"
                />
              </div>
              <div>
                <label className="block font-bold mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, role: e.target.value as UserRole }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/25 dark:bg-[#2C2623]"
                >
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-[#AEAC78]/50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-4 py-2 rounded-xl bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] font-bold cursor-pointer disabled:opacity-50"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
