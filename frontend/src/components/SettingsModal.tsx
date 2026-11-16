import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';
import { demoUser } from '../data/demoFixtures';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

const SPECIAL_CHAR_REGEX = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?~`]/;

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, user: propUser }) => {
  const { user: authUser, updateProfile, changePassword } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('is_demo_mode') === 'true';
  const user = propUser || authUser || (isDemo ? demoUser : null);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  // Profile Form State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [securitySuccess, setSecuritySuccess] = useState<string | null>(null);
  const [securityError, setSecurityError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  // Real-time password criteria
  const hasLength = newPassword.length >= 8 && newPassword.length <= 72;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = SPECIAL_CHAR_REGEX.test(newPassword);
  const isPasswordValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    const clean = fullName.trim();
    if (!clean) {
      setProfileError('Full name cannot be blank.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      await updateProfile(clean);
      setProfileSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);
    setSecuritySuccess(null);

    if (!isPasswordValid) {
      setSecurityError('Please satisfy all password strength requirements.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSecuritySuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setSecurityError(err instanceof Error ? err.message : 'Failed to change password.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const avatarInitial = (user.full_name || user.username || 'U').trim().charAt(0).toUpperCase();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78]/60 dark:border-[#AEAC78]/40 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden text-[#4C4541] dark:text-[#FCF0DA] transition-all flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#AEAC78]/30 bg-[#FCF0DA]/40 dark:bg-[#2C2623]/80 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#F2C46A] text-[#4C4541] font-bold flex items-center justify-center text-sm shadow-2xs">
              {avatarInitial}
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                Account Settings
              </h2>
              <p className="text-xs text-[#6B625B] dark:text-[#D8CEBA]">
                Manage your instructor credentials and password
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] p-1.5 rounded-lg hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Tab Bar */}
        <div className="px-6 pt-3 pb-2 border-b border-[#AEAC78]/20 bg-[#FFFDF9] dark:bg-[#38322E] flex gap-2 shrink-0">
          <button
            type="button"
            data-testid="settings-tab-profile"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 border ${
              activeTab === 'profile'
                ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] border-transparent shadow-xs'
                : 'text-[#6B625B] dark:text-[#AEAC78] border-[#AEAC78]/30 hover:bg-[#FCF0DA]/40 dark:hover:bg-[#2C2623]'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Profile Information</span>
          </button>

          <button
            type="button"
            data-testid="settings-tab-security"
            onClick={() => setActiveTab('security')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 border ${
              activeTab === 'security'
                ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] border-transparent shadow-xs'
                : 'text-[#6B625B] dark:text-[#AEAC78] border-[#AEAC78]/30 hover:bg-[#FCF0DA]/40 dark:hover:bg-[#2C2623]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security &amp; Password</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'profile' ? (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {profileError && (
                <div className="p-3 bg-[#8F3D2C]/10 border border-[#8F3D2C] rounded-xl text-xs text-[#8F3D2C] dark:text-[#f8b4a6] flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-[#8F3D2C] shrink-0 mt-0.5" />
                  <span>{profileError}</span>
                </div>
              )}

              {profileSuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-600/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              {/* Read-only Identity Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/35">
                  <span className="text-[10px] uppercase font-bold text-[#6B625B] dark:text-[#AEAC78] tracking-wider block mb-1">
                    Username
                  </span>
                  <div className="font-mono text-xs font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                    @{user.username}
                  </div>
                  <span className="text-[10px] text-[#8F8782] mt-0.5 block">Cannot be modified</span>
                </div>

                <div className="p-3 rounded-xl bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/35">
                  <span className="text-[10px] uppercase font-bold text-[#6B625B] dark:text-[#AEAC78] tracking-wider block mb-1">
                    System Role
                  </span>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F2C46A]/40 text-[#4C4541] dark:text-[#F2C46A] border border-[#AEAC78]/50">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{user.role}</span>
                  </div>
                </div>
              </div>

              {/* Email Card with verified badge */}
              <div className="p-3 rounded-xl bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/35 flex items-center justify-between">
                <div className="flex items-center space-x-2 min-w-0">
                  <Mail className="w-4 h-4 text-[#AEAC78] shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-[#6B625B] dark:text-[#AEAC78] tracking-wider block">
                      Email Address
                    </span>
                    <span className="text-xs font-mono font-semibold text-[#4C4541] dark:text-[#FCF0DA] truncate block">
                      {user.email}
                    </span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 shrink-0">
                  <Check className="w-3 h-3" />
                  <span>Verified</span>
                </span>
              </div>

              {/* Editable Full Name */}
              <div>
                <label
                  htmlFor="settings-full-name"
                  className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                >
                  Full Name / Display Name
                </label>
                <input
                  id="settings-full-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Nguyen Van A"
                  className="w-full px-3 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors"
                />
              </div>

              {user.created_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-[#6B625B] dark:text-[#AEAC78] pt-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Member since: {new Date(user.created_at).toLocaleDateString()}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingProfile || fullName.trim() === user.full_name}
                  className="px-4 py-2 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile'}</span>
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              {securityError && (
                <div className="p-3 bg-[#8F3D2C]/10 border border-[#8F3D2C] rounded-xl text-xs text-[#8F3D2C] dark:text-[#f8b4a6] flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-[#8F3D2C] shrink-0 mt-0.5" />
                  <span>{securityError}</span>
                </div>
              )}

              {securitySuccess && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-600/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>{securitySuccess}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label
                  htmlFor="settings-current-password"
                  className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                >
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="settings-current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your existing password"
                    className="w-full pl-3 pr-10 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA]"
                  >
                    {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label
                  htmlFor="settings-new-password"
                  className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="settings-new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min. 8 characters, uppercase, number & symbol"
                    className="w-full pl-3 pr-10 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA]"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Real-Time Requirement Checklist */}
                <div className="mt-2.5 p-3 rounded-xl bg-[#FCF0DA]/40 dark:bg-[#2C2623] border border-[#AEAC78]/30 space-y-1.5 text-[11px]">
                  <span className="font-bold text-[#6B625B] dark:text-[#D8CEBA] block mb-1">
                    Password Requirements:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <div className={`flex items-center space-x-1.5 ${hasLength ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasLength ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                        {hasLength ? <Check className="w-2.5 h-2.5" /> : '-'}
                      </span>
                      <span>8 to 72 characters</span>
                    </div>

                    <div className={`flex items-center space-x-1.5 ${hasUpper ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasUpper ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                        {hasUpper ? <Check className="w-2.5 h-2.5" /> : '-'}
                      </span>
                      <span>One uppercase letter (A-Z)</span>
                    </div>

                    <div className={`flex items-center space-x-1.5 ${hasLower ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasLower ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                        {hasLower ? <Check className="w-2.5 h-2.5" /> : '-'}
                      </span>
                      <span>One lowercase letter (a-z)</span>
                    </div>

                    <div className={`flex items-center space-x-1.5 ${hasNumber ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasNumber ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                        {hasNumber ? <Check className="w-2.5 h-2.5" /> : '-'}
                      </span>
                      <span>One number (0-9)</span>
                    </div>

                    <div className={`flex items-center space-x-1.5 sm:col-span-2 ${hasSpecial ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-[#8F8782]'}`}>
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] ${hasSpecial ? 'bg-emerald-500 text-white' : 'bg-black/10 dark:bg-white/10'}`}>
                        {hasSpecial ? <Check className="w-2.5 h-2.5" /> : '-'}
                      </span>
                      <span>One special symbol (!@#$%^&*...)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label
                  htmlFor="settings-confirm-password"
                  className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  className="w-full px-3 py-2 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors"
                />
                {confirmPassword && (
                  <p className={`mt-1 text-[11px] font-semibold flex items-center space-x-1 ${passwordsMatch ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {passwordsMatch && <Check className="w-3 h-3" />}
                    <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                  </p>
                )}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword || !isPasswordValid || !passwordsMatch || !currentPassword}
                  className="px-4 py-2 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isUpdatingPassword ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
