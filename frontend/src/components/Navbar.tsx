import React from 'react';
import { BookOpen, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-slate-900 text-slate-100 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-600 text-white p-2 rounded-lg shadow">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-bold tracking-tight text-white">
            AI Grading Workstation
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Instructor & TA Evaluation Suite
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {user && (
          <div className="flex items-center space-x-3 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-medium text-slate-200">{user.full_name}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {user.role}
            </span>
          </div>
        )}

        <button
          onClick={logout}
          className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-300 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-700"
          title="Sign out of workstation"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
