import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const { isDark, toggleTheme } = useTheme();

  const label = isDark ? 'Switch to light theme mode' : 'Switch to dark theme mode';

  return (
    <button
      type="button"
      data-testid="theme-toggle-btn"
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={`p-2 rounded-lg border border-[#AEAC78]/40 hover:border-[#F2C46A] bg-[#38322E] text-[#FCF0DA] hover:text-[#F2C46A] hover:bg-[#2C2623] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F2C46A] cursor-pointer flex items-center justify-center ${className}`}
    >
      <span data-testid="theme-toggle" className="inline-flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-[#F2C46A]" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4 text-[#FCF0DA]" aria-hidden="true" />
        )}
      </span>
    </button>
  );
};
