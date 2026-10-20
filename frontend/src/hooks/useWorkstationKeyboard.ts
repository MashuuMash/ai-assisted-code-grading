import { useEffect } from 'react';

export interface UseWorkstationKeyboardOptions {
  onSwitchTab: (tabIndex: number) => void;
  onNextSubmission: () => void;
  onPrevSubmission: () => void;
  onConfirmGrade: () => void;
  onToggleShortcutsModal: () => void;
  onCloseShortcutsModal: () => void;
  isShortcutsModalOpen: boolean;
}

export const useWorkstationKeyboard = ({
  onSwitchTab,
  onNextSubmission,
  onPrevSubmission,
  onConfirmGrade,
  onToggleShortcutsModal,
  onCloseShortcutsModal,
  isShortcutsModalOpen,
}: UseWorkstationKeyboardOptions) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Escape key closes modal if open
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          e.preventDefault();
          onCloseShortcutsModal();
        }
        return;
      }

      // '?' key toggles shortcuts modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onToggleShortcutsModal();
        return;
      }

      // If modal is open, avoid executing other navigation keys
      if (isShortcutsModalOpen) {
        return;
      }

      // 1-5 tab switching
      if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onSwitchTab(parseInt(e.key, 10));
        return;
      }

      // j/k roster navigation
      if ((e.key === 'j' || e.key === 'J') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onNextSubmission();
        return;
      }

      if ((e.key === 'k' || e.key === 'K') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onPrevSubmission();
        return;
      }

      // c confirms grade
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onConfirmGrade();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    onSwitchTab,
    onNextSubmission,
    onPrevSubmission,
    onConfirmGrade,
    onToggleShortcutsModal,
    onCloseShortcutsModal,
    isShortcutsModalOpen,
  ]);
};
