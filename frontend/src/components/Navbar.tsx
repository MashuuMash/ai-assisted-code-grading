import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Command,
  LogOut,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { demoUser } from '../data/demoFixtures';
import { ThemeToggle } from './ThemeToggle';
import { SettingsModal } from './SettingsModal';
import { AdminConsoleModal } from './AdminConsoleModal';

export interface NavbarProps {
  onOpenShortcuts?: () => void;
  hideAdminConsoleModalItem?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenShortcuts,
  hideAdminConsoleModalItem = false,
}) => {
  const { user: authUser, logout } = useAuth();
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('is_demo_mode') === 'true';
  const user = authUser || (isDemo ? demoUser : null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  const avatarInitial = (user?.full_name || user?.username || 'U').trim().charAt(0).toUpperCase();

  return (
    <>
      <header className="bg-[#4C4541] text-[#FCF0DA] border-b border-[#AEAC78]/30 px-6 py-3.5 flex flex-wrap gap-3 items-center justify-between shadow-xs">
        {/* Left Side: Brand Logo and Title */}
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

        {/* Right Side: Shortcuts + ThemeToggle + User Profile Dropdown */}
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="p-2 rounded-xl border border-[#AEAC78]/40 hover:border-[#F2C46A] bg-[#38322E] text-[#FCF0DA] hover:text-[#F2C46A] hover:bg-[#2C2623] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F2C46A] cursor-pointer flex items-center justify-center shrink-0"
            >
              <Command className="w-4 h-4" />
            </button>
          )}

          <ThemeToggle />

          {user && (
            <div ref={dropdownRef} className="relative">
              {/* User Profile Pill Button (Far Right) */}
              <button
                type="button"
                data-testid="user-profile-button"
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                aria-label="User profile and account settings"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
                className="flex items-center space-x-2.5 bg-[#38322E] hover:bg-[#2C2623] px-2.5 sm:px-3 py-1.5 rounded-2xl border border-[#AEAC78]/40 hover:border-[#F2C46A]/60 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#F2C46A]/50 shadow-xs"
              >
                <div className="w-6 h-6 rounded-lg bg-[#F2C46A] text-[#4C4541] font-bold text-xs flex items-center justify-center shrink-0">
                  {avatarInitial}
                </div>

                <div className="hidden sm:flex flex-col text-left leading-tight min-w-0 max-w-[140px]">
                  <span className="text-xs font-semibold text-[#FCF0DA] truncate">
                    {user.full_name || user.username}
                  </span>
                  <span className="text-[10px] text-[#AEAC78] font-mono truncate">
                    @{user.username}
                  </span>
                </div>

                <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[#F2C46A]/20 text-[#F2C46A] border border-[#AEAC78]/40 shrink-0">
                  <ShieldCheck className="w-2.5 h-2.5 mr-0.5" />
                  {user.role}
                </span>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#AEAC78] transition-transform duration-200 shrink-0 ${
                    isDropdownOpen ? 'rotate-180 text-[#F2C46A]' : ''
                  }`}
                />
              </button>

              {/* Floating Dropdown Popover */}
              {isDropdownOpen && (
                <div
                  data-testid="user-profile-dropdown"
                  className="absolute right-0 mt-2 w-64 bg-[#FFFDF9] dark:bg-[#38322E] border-2 border-[#AEAC78]/50 rounded-2xl shadow-xl py-1.5 z-50 text-[#4C4541] dark:text-[#FCF0DA] animate-in fade-in zoom-in-95 duration-100"
                >
                  {/* Account Summary Header */}
                  <div className="px-3.5 py-2.5 border-b border-[#AEAC78]/25 bg-[#FCF0DA]/30 dark:bg-[#2C2623]/60 rounded-t-xl">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#F2C46A] text-[#4C4541] font-bold text-xs flex items-center justify-center shrink-0">
                        {avatarInitial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#4C4541] dark:text-[#FCF0DA] truncate">
                          {user.full_name}
                        </div>
                        <div className="text-[11px] text-[#6B625B] dark:text-[#AEAC78] font-mono truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="p-1 space-y-0.5">
                    {user.role === 'admin' && !hideAdminConsoleModalItem && (
                      <button
                        type="button"
                        data-testid="menu-item-admin"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setIsAdminOpen(true);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] transition-colors cursor-pointer text-left"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#F2C46A]" />
                        <span>Admin Console</span>
                      </button>
                    )}

                    <button
                      type="button"
                      data-testid="menu-item-settings"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold hover:bg-[#FCF0DA]/60 dark:hover:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] transition-colors cursor-pointer text-left"
                    >
                      <Settings className="w-4 h-4 text-[#AEAC78]" />
                      <span>Account Settings</span>
                    </button>

                    <div className="border-t border-[#AEAC78]/20 my-1" />

                    <button
                      type="button"
                      data-testid="menu-item-sign-out"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        user={user}
      />

      {/* Admin Console Modal */}
      <AdminConsoleModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        currentUser={user}
      />
    </>
  );
};
