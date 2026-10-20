import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-modal-title"
      data-testid="keyboard-shortcuts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/70 backdrop-blur-xs"
    >
      <div className="bg-[#FFFDF9] dark:bg-[#38322E] border border-[#AEAC78]/40 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden text-[#4C4541] dark:text-[#FCF0DA]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#AEAC78]/30 bg-[#FCF0DA]/30 dark:bg-[#2C2623]/40">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-[#FCF0DA] dark:bg-[#2C2623] text-[#F2C46A] border border-[#AEAC78]/30 rounded-lg">
              <Keyboard className="w-5 h-5 text-[#F2C46A]" />
            </div>
            <div>
              <h2 id="shortcuts-modal-title" className="text-base font-bold text-[#4C4541] dark:text-[#FCF0DA]">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-[#AEAC78]">
                Workstation navigation and grading controls
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts modal"
            className="text-[#AEAC78] hover:text-[#4C4541] dark:hover:text-[#FCF0DA] p-1.5 rounded-lg hover:bg-[#FCF0DA]/50 dark:hover:bg-[#2C2623] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEAC78]">
              Roster Navigation (j / k)
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">Next submission</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  j
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">Previous submission</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  k
                </kbd>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEAC78]">
              Grading Actions (c)
            </h3>
            <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30 text-xs">
              <span className="text-[#4C4541] dark:text-[#FCF0DA]">Confirm grade on active submission</span>
              <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                c
              </kbd>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEAC78]">
              Switch Tabs (1-5)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">1: Setup Course & Class</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  1
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">2: Rubric & Formulas</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  2
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">3: Assignment & Tests</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FCF0DA] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  3
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">4: Similarity & Integrity</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  4
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30 sm:col-span-2">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">5: Grading Queue & Evidence</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  5
                </kbd>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#AEAC78]">
              General
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">Keyboard shortcuts help</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FCF0DA]/20 dark:bg-[#2C2623]/50 border border-[#AEAC78]/30">
                <span className="text-[#4C4541] dark:text-[#FCF0DA]">Dismiss modal</span>
                <kbd className="px-2 py-0.5 font-mono text-[11px] font-bold bg-[#FFFDF9] dark:bg-[#2C2623] border border-[#AEAC78]/60 rounded text-[#4C4541] dark:text-[#FCF0DA] shadow-xs">
                  Esc
                </kbd>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 bg-[#FCF0DA]/30 dark:bg-[#2C2623]/40 border-t border-[#AEAC78]/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#F2C46A] hover:bg-[#e0b45b] text-[#4C4541] rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
