import React from 'react';
import { Command, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from './ThemeToggle';

export interface NavbarProps {
  onOpenShortcuts?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenShortcuts }) => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-[#4C4541] text-[#FCF0DA] border-b border-[#AEAC78]/30 px-6 py-3.5 flex flex-wrap gap-3 items-center justify-between shadow-xs">
      <div className="flex items-center space-x-3">
        <img
          src="/logo.png"
          alt="VeriPie"
          className="h-8 w-auto object-contain shrink-0"
        />
        <div>
          <h1 className="text-base font-bold tracking-tight text-[#FCF0DA]">
            VeriPie · AI Grading Workstation
          </h1>
          <p className="text-xs text-[#AEAC78] font-mono">
            Automated Python Evaluation · Easy as Pie
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {user && (
          <div className="hidden sm:flex items-center space-x-3 bg-[#38322E] px-3.5 py-1.5 rounded-full border border-[#AEAC78]/40">
            <UserIcon className="w-4 h-4 text-[#AEAC78]" />
            <span className="text-xs font-medium text-[#FCF0DA]">{user.full_name}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#F2C46A] text-[#4C4541] border border-[#AEAC78]/40">
              <ShieldCheck className="w-3 h-3 mr-1" />
              {user.role}
            </span>
          </div>
        )}

        {onOpenShortcuts && (
          <button
            type="button"
            onClick={onOpenShortcuts}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className="p-2 rounded-lg border border-[#AEAC78]/40 hover:border-[#F2C46A] bg-[#38322E] text-[#FCF0DA] hover:text-[#F2C46A] hover:bg-[#2C2623] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F2C46A] cursor-pointer flex items-center justify-center"
          >
            <Command className="w-4 h-4" />
          </button>
        )}

        <ThemeToggle />

        <button
          onClick={logout}
          className="flex items-center space-x-1.5 text-xs text-[#FCF0DA]/80 hover:text-rose-200 hover:bg-[#38322E] px-3 py-1.5 rounded-lg transition-colors border border-transparent hover:border-[#AEAC78]/40 cursor-pointer"
          title="Sign out of workstation"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
