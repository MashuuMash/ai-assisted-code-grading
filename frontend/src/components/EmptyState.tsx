import React from 'react';
import { Inbox, LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      data-testid="empty-state"
      className={`flex flex-col items-center justify-center p-8 text-center rounded-2xl border-2 border-dashed border-[#AEAC78]/50 dark:border-[#AEAC78]/40 bg-[#FFFDF9] dark:bg-[#38322E] text-[#4C4541] dark:text-[#FCF0DA] shadow-xs relative overflow-hidden ${className}`}
    >
      {/* Rich Multi-Layered SVG Illustration Plate */}
      <div className="relative w-24 h-24 mb-4 flex items-center justify-center shrink-0">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 96 96"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Base plate with warm ivory / cream tone */}
          <rect x="8" y="8" width="80" height="80" rx="20" fill="#FCF0DA" className="dark:fill-[#2C2623]" />
          
          {/* Double-stroke sage outer border */}
          <rect x="8" y="8" width="80" height="80" rx="20" stroke="#AEAC78" strokeWidth="1.5" strokeDasharray="5 3" />
          <rect x="12" y="12" width="72" height="72" rx="16" stroke="#AEAC78" strokeWidth="0.75" opacity="0.4" />
          
          {/* Concentric double-stroke sage rings */}
          <circle cx="48" cy="48" r="30" stroke="#AEAC78" strokeWidth="1.5" opacity="0.7" />
          <circle cx="48" cy="48" r="24" stroke="#AEAC78" strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
          
          {/* Golden amber geometric registration marks / diamond accents */}
          <path d="M48 4 L51 9 L48 14 L45 9 Z" fill="#F2C46A" />
          <path d="M48 82 L51 87 L48 92 L45 87 Z" fill="#F2C46A" />
          <path d="M4 48 L9 45 L14 48 L9 51 Z" fill="#F2C46A" />
          <path d="M82 48 L87 45 L92 48 L87 51 Z" fill="#F2C46A" />
          
          {/* Precision archival manuscript registration brackets */}
          <path d="M14 20 H20 V14" stroke="#AEAC78" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M82 20 H76 V14" stroke="#AEAC78" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M14 76 H20 V82" stroke="#AEAC78" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M82 76 H76 V82" stroke="#AEAC78" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <Icon className="w-8 h-8 text-[#4C4541] dark:text-[#FCF0DA] relative z-10" />
      </div>

      <h3 className="text-sm font-bold text-[#4C4541] dark:text-[#FCF0DA] mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-[#4C4541]/80 dark:text-[#FCF0DA]/80 max-w-sm mb-4 leading-relaxed">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center px-4 py-2 bg-[#F2C46A] hover:bg-[#F2C46A]/90 text-[#4C4541] font-bold rounded-lg text-xs shadow-xs border border-[#AEAC78]/60 transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
