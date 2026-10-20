import React, { useState } from 'react';
import { BookOpen, KeyRound, Lock, ShieldAlert, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
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
    <div className="min-h-screen bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] flex flex-col justify-center items-center px-4 font-sans selection:bg-[#F2C46A] selection:text-[#4C4541] transition-colors duration-150">
      <div className="max-w-md w-full bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78]/60 rounded-2xl p-8 shadow-xl">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-[#F2C46A]/25 border border-[#AEAC78]/60 rounded-xl text-[#4C4541] dark:text-[#FCF0DA] mb-3 shadow-xs">
            <BookOpen className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#4C4541] dark:text-[#FCF0DA] tracking-tight">
            Instructor Grading Workstation
          </h2>
          <p className="text-xs text-[#6B625B] dark:text-[#D8CEBA] mt-1 font-medium">
            Evidence First · AI Second · Human Decision Last
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#8F3D2C]/10 border border-[#8F3D2C] rounded-xl text-xs text-[#8F3D2C] dark:text-[#f8b4a6] flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-[#8F3D2C] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
              Username or Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#AEAC78]">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="lecturer_username"
                className="w-full pl-9 pr-3 py-2 bg-[#FCF0DA]/60 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
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
                className="w-full pl-9 pr-3 py-2 bg-[#FCF0DA]/60 dark:bg-[#2C2623] border border-[#AEAC78] rounded-xl text-[#4C4541] dark:text-[#FCF0DA] text-xs focus:outline-none focus:border-[#F2C46A] focus:ring-1 focus:ring-[#F2C46A] font-sans transition-colors placeholder-[#8F8782]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#F2C46A] hover:bg-[#e2b55b] border border-[#AEAC78]/60 disabled:opacity-50 text-[#4C4541] rounded-xl text-xs font-bold transition-all shadow-md mt-2 flex items-center justify-center space-x-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In to Workstation'}</span>
          </button>
        </form>

        <p className="mt-6 pt-5 border-t border-[#AEAC78]/40 text-center text-[11px] text-[#6B625B] dark:text-[#AEAC78]">
          For a local demo account, run the documented Compose smoke test and use the credentials it prints.
        </p>
      </div>
    </div>
  );
};
