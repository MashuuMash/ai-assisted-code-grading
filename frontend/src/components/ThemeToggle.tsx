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
      className={`p-2 rounded-lg border border-[#AEAC78] dark:border-[#6D6954] bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA] hover:bg-[#F7E8C8] dark:hover:bg-[#4C4541] hover:border-[#F2C46A] dark:hover:border-[#F2C46A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#F2C46A] cursor-pointer flex items-center justify-center ${className}`}
    >
      <span data-testid="theme-toggle" className="inline-flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-[#F2C46A]" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4 text-[#4C4541]" aria-hidden="true" />
        )}
      </span>
    </button>
  );
};

