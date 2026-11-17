import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FolderKanban,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import { AdminOverview, User, UserRole } from '../types';

export interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [loading, setLoading] = useState(false);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, userList] = await Promise.all([
        api.admin.overview(),
        api.admin.listUsers({ search, role: roleFilter }),
      ]);
      setOverview(ov);
      setUsers(userList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin console data');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    if (!isOpen) return;
    void loadData();
  }, [isOpen, loadData]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !currentUser || currentUser.role !== 'admin') return null;

  const handleUpdateUser = async (
    targetId: number,
    patch: { role?: UserRole; is_active?: boolean; is_email_verified?: boolean }
  ) => {
    setBusyUserId(targetId);
    setError(null);
    try {
      const updated = await api.admin.updateUser(targetId, patch);
      setUsers((prev) => prev.map((u) => (u.id === targetId ? updated : u)));
      const ov = await api.admin.overview();
      setOverview(ov);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-console-title"
      data-testid="admin-console-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78] rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FCF0DA]/60 dark:bg-[#2C2623] border-b border-[#AEAC78]/40 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#4C4541] dark:bg-[#F2C46A] text-[#F2C46A] dark:text-[#4C4541] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="admin-console-title"
                className="text-base font-bold text-[#4C4541] dark:text-[#FCF0DA]"
              >
                Admin Console
              </h2>
              <p className="text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                System overview, user access control, and grading queue health
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void loadData()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#AEAC78]/50 bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA] hover:border-[#F2C46A] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close admin console"
              className="text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] p-1.5 rounded-lg hover:bg-[#FCF0DA]/60 dark:hover:bg-[#38322E] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-[#4C4541] dark:text-[#FCF0DA]">
          {error && (
            <div className="p-3 bg-[#8F3D2C]/10 border border-[#8F3D2C] rounded-xl text-xs text-[#8F3D2C] dark:text-[#f8b4a6] flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Block 1: System Overview */}
          {overview && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl border border-[#AEAC78]/40 bg-[#FCF0DA]/35 dark:bg-[#2C2623]">
                <div className="flex items-center justify-between text-[#6B625B] dark:text-[#AEAC78] mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Total Users</span>
                  <Users className="w-4 h-4 text-[#AEAC78]" />
                </div>
                <div className="text-2xl font-extrabold font-mono">{overview.total_users}</div>
                <div className="mt-1 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                  {overview.users_by_role.lecturer ?? 0} lecturers &middot;{' '}
                  {overview.users_by_role.admin ?? 0} admins
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-[#AEAC78]/40 bg-[#FCF0DA]/35 dark:bg-[#2C2623]">
                <div className="flex items-center justify-between text-[#6B625B] dark:text-[#AEAC78] mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Workspaces</span>
                  <FolderKanban className="w-4 h-4 text-[#AEAC78]" />
                </div>
                <div className="text-2xl font-extrabold font-mono">{overview.total_courses}</div>
                <div className="mt-1 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                  Courses across {overview.total_classes} class cohorts
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-[#AEAC78]/40 bg-[#FCF0DA]/35 dark:bg-[#2C2623]">
                <div className="flex items-center justify-between text-[#6B625B] dark:text-[#AEAC78] mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Submissions</span>
                  <BookOpen className="w-4 h-4 text-[#AEAC78]" />
                </div>
                <div className="text-2xl font-extrabold font-mono">{overview.total_submissions}</div>
                <div className="mt-1 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                  Across {overview.total_assignments} assignments
                </div>
              </div>

              <div className="p-3.5 rounded-2xl border border-[#AEAC78]/40 bg-[#FCF0DA]/35 dark:bg-[#2C2623]">
                <div className="flex items-center justify-between text-[#6B625B] dark:text-[#AEAC78] mb-1">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Grading Queue</span>
                  <Activity className="w-4 h-4 text-[#AEAC78]" />
                </div>
                <div className="text-2xl font-extrabold font-mono">
                  {overview.jobs_by_status.completed ?? 0}
                </div>
                <div className="mt-1 text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
                  {overview.jobs_by_status.queued ?? 0} queued &middot;{' '}
                  {overview.jobs_by_status.running ?? 0} running &middot;{' '}
                  <span className={(overview.jobs_by_status.failed ?? 0) > 0 ? 'text-rose-600 dark:text-rose-400 font-bold' : ''}>
                    {overview.jobs_by_status.failed ?? 0} failed
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Block 2: User Management */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold">User Management ({users.length})</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#AEAC78] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search user, email..."
                    aria-label="Search users"
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-xs focus:outline-none focus:ring-1 focus:ring-[#F2C46A]"
                  />
                </div>
                <select
                  aria-label="Filter by role"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
                  className="px-2.5 py-1.5 rounded-xl border border-[#AEAC78]/50 bg-[#FCF0DA]/30 dark:bg-[#2C2623] text-xs focus:outline-none focus:ring-1 focus:ring-[#F2C46A]"
                >
                  <option value="">All roles</option>
                  <option value="lecturer">Lecturer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-[#AEAC78]/40">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#FCF0DA]/50 dark:bg-[#2C2623] border-b border-[#AEAC78]/30 text-[10px] uppercase tracking-wider text-[#6B625B] dark:text-[#AEAC78]">
                    <th className="py-2.5 px-3 font-bold">Account</th>
                    <th className="py-2.5 px-3 font-bold">Role</th>
                    <th className="py-2.5 px-3 font-bold">Email Verification</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#AEAC78]/20">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    const isBusy = busyUserId === u.id;
                    return (
                      <tr key={u.id} className="hover:bg-[#FCF0DA]/20 dark:hover:bg-[#2C2623]/50">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                            {u.full_name} {isSelf && <span className="text-[10px] text-[#AEAC78]">(You)</span>}
                          </div>
                          <div className="text-[11px] font-mono text-[#6B625B] dark:text-[#AEAC78]">
                            @{u.username} &middot; {u.email}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            aria-label={`Role for ${u.username}`}
                            disabled={isSelf || isBusy}
                            value={u.role}
                            onChange={(e) =>
                              void handleUpdateUser(u.id, { role: e.target.value as UserRole })
                            }
                            className="px-2 py-1 rounded-lg border border-[#AEAC78]/50 bg-[#FCF0DA]/40 dark:bg-[#2C2623] text-xs font-semibold disabled:opacity-50"
                          >
                            <option value="lecturer">lecturer</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3">
                          {u.is_email_verified ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Verified</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleUpdateUser(u.id, { is_email_verified: true })}
                              className="px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px] font-semibold cursor-pointer"
                            >
                              Mark Verified
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            disabled={isSelf || isBusy}
                            onClick={() => void handleUpdateUser(u.id, { is_active: !u.is_active })}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                              u.is_active
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-rose-500/15 hover:text-rose-700'
                                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 hover:bg-emerald-500/15 hover:text-emerald-700'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#6B625B] dark:text-[#AEAC78]">
                        No matching users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Block 3: Recent Failed Jobs */}
          {overview && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#AEAC78]" />
                <span>Recent Failed Grading Jobs</span>
              </h3>
              {overview.recent_failed_jobs.length === 0 ? (
                <p className="text-xs text-[#6B625B] dark:text-[#AEAC78] p-3 rounded-xl border border-[#AEAC78]/30 bg-[#FCF0DA]/20 dark:bg-[#2C2623]/40">
                  No failed grading jobs recorded.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {overview.recent_failed_jobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold">
                          Job #{job.id} (Submission #{job.submission_id})
                        </span>
                        <p className="text-[11px] text-rose-700 dark:text-rose-300 truncate">
                          {job.error_message || 'Unknown worker error'}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-[#6B625B] dark:text-[#AEAC78] shrink-0">
                        {new Date(job.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
