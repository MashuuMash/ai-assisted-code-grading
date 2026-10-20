import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, ShieldAlert, ShieldCheck, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || 'Login failed. Check your credentials.');
      } else {
        setError('Login failed. Check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      data-testid="login-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78]/60 dark:border-[#AEAC78]/40 rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden text-[#4C4541] dark:text-[#FCF0DA] transition-all grid grid-cols-1 md:grid-cols-12">
        {/* Left Column: Brand Identity & Flat Character Illustration */}
        <div className="md:col-span-5 bg-gradient-to-b from-[#FCF0DA]/70 via-[#FCF0DA]/40 to-[#F2C46A]/20 dark:from-[#2C2623] dark:via-[#2C2623]/90 dark:to-[#38322E] p-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-[#AEAC78]/40">
          <div>
            <div className="flex items-center justify-between gap-2">
              <img
                src="/logo.png"
                alt="VeriPie"
                className="h-9 w-auto object-contain"
              />
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#F2C46A]/35 text-[#4C4541] dark:text-[#F2C46A] border border-[#AEAC78]/50">
                <ShieldCheck className="w-3 h-3" />
                <span>Faculty Portal</span>
              </span>
            </div>
            <p className="mt-2 text-xs text-[#6B625B] dark:text-[#D8CEBA] font-medium leading-relaxed">
              Automated Python Evaluation &amp; Deterministic Evidence Workstation.
            </p>
          </div>

          <div className="my-4 flex items-center justify-center">
            <img
              src="/lecturer-illustration.svg"
              alt="Instructor grading workstation illustration"
              className="w-full max-w-[240px] h-auto object-contain drop-shadow-xs select-none"
            />
          </div>

          <div className="pt-3 border-t border-[#AEAC78]/30 text-[11px] font-mono text-[#6B625B] dark:text-[#AEAC78] flex items-center justify-between">
            <span>Evidence First</span>
            <span>•</span>
            <span>Human Decision Last</span>
          </div>
        </div>

        {/* Right Column: Lecturer Sign-In Form */}
        <div className="md:col-span-7 p-6 sm:p-7 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between pb-4 border-b border-[#AEAC78]/30">
              <div>
                <h2
                  id="login-modal-title"
                  className="text-lg font-bold text-[#4C4541] dark:text-[#FCF0DA] tracking-tight"
                >
                  Instructor Workstation Sign-In
                </h2>
                <p className="mt-0.5 text-xs text-[#6B625B] dark:text-[#D8CEBA]">
                  Enter your academic lecturer credentials to access cohorts and grading queues.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close login dialog"
                className="text-[#6B625B] dark:text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] p-1.5 rounded-lg hover:bg-[#FCF0DA]/50 dark:hover:bg-[#2C2623] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-[#8F3D2C]/10 border border-[#8F3D2C] rounded-xl text-xs text-[#8F3D2C] dark:text-[#f8b4a6] flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-[#8F3D2C] shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="lecturer_username"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2.5 bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-md mt-2 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? 'Authenticating...' : 'Sign In to Workstation'}</span>
              </button>
            </form>
          </div>

          <p className="mt-6 pt-4 border-t border-[#AEAC78]/30 text-center text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
            Restricted access for academic instructors and evaluation staff.
          </p>
        </div>
      </div>
    </div>
  );
};
