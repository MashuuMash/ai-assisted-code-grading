import React from 'react';
import {
  Archive,
  Bot,
  CheckCircle2,
  Cpu,
  LogOut,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

export interface DemoStage {
  id: number;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const DEMO_STAGES: DemoStage[] = [
  {
    id: 1,
    label: 'Setup & Ingest',
    icon: Archive,
    description: 'Explore course, cohort, assignment specifications, and test suite setup.',
  },
  {
    id: 2,
    label: 'Docker Sandbox Tests',
    icon: CheckCircle2,
    description: 'Inspect isolated sandboxed test execution and automated pass/fail verification.',
  },
  {
    id: 3,
    label: 'Evidence & AST',
    icon: Cpu,
    description: 'Review multi-engine evidence: Ruff style rules, pytest traces, and AST complexity.',
  },
  {
    id: 4,
    label: 'Grounded AI Feedback',
    icon: Bot,
    description: 'Audit citation-grounded AI feedback draft and confirm instructor grade.',
  },
  {
    id: 5,
    label: 'Similarity Analysis',
    icon: ShieldAlert,
    description: 'Audit Karp-Rabin token winnowing similarity detection between peer submissions.',
  },
];

export interface DemoWalkthroughBarProps {
  currentStage?: number;
  onSelectStage?: (stageId: number) => void;
  onResetDemo: () => Promise<void> | void;
  onExitDemo: () => void;
  isResetting?: boolean;
}

export const DemoWalkthroughBar: React.FC<DemoWalkthroughBarProps> = ({
  currentStage = 2,
  onSelectStage,
  onResetDemo,
  onExitDemo,
  isResetting = false,
}) => {
  return (
    <aside
      data-testid="demo-walkthrough-bar"
      aria-label="Demo walkthrough navigation"
      className="sticky top-0 z-40 w-full max-w-full bg-[#4C4541] border-b border-[#AEAC78]/40 shadow-md text-[#FCF0DA] text-xs select-none"
    >
      <div className="max-w-7xl mx-auto px-3 py-2 sm:px-4 sm:py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        {/* Left: Defense Mode Indicator Badge */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="inline-flex items-center space-x-2 bg-[#38322E] border border-[#AEAC78]/50 px-2.5 py-1 rounded-full text-[#FCF0DA] shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F2C46A] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F2C46A] animate-pulse" />
            </span>
            <span className="font-semibold tracking-wide text-[11px] uppercase">
              VeriPie Defense Walkthrough Mode • CS102 Demo
            </span>
          </div>
        </div>

        {/* Center: Interactive Defense Stages */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none max-w-full">
          {DEMO_STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = currentStage === stage.id;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage && onSelectStage(stage.id)}
                title={stage.description}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] whitespace-nowrap cursor-pointer shrink-0 hover:-translate-y-0.5 ${
                  isActive
                    ? 'bg-[#F2C46A] text-[#4C4541] shadow-xs ring-1 ring-[#F2C46A]/80 font-bold'
                    : 'bg-[#38322E] text-[#FCF0DA]/90 hover:bg-[#2C2623] hover:text-[#FCF0DA] border border-[#AEAC78]/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#4C4541]' : 'text-[#AEAC78]'}`} />
                <span className="font-mono text-[10px] opacity-75">{stage.id}.</span>
                <span>{stage.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Reset Demo & Exit Demo Controls */}
        <div className="flex items-center space-x-2 shrink-0 justify-end">
          <button
            type="button"
            data-testid="reset-demo-button"
            onClick={onResetDemo}
            disabled={isResetting}
            title="Reset demo data to initial baseline"
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#38322E] hover:bg-[#2C2623] hover:-translate-y-0.5 text-[#F2C46A] hover:text-[#F2C46A]/90 border border-[#AEAC78]/40 text-[11px] font-semibold transition-all disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer shadow-xs"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset Demo</span>
          </button>

          <button
            type="button"
            data-testid="exit-demo-button"
            onClick={onExitDemo}
            title="Exit demo mode and return to public showcase landing page"
            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-[#5C2D2B] hover:bg-[#703634] hover:-translate-y-0.5 text-[#FCF0DA] border border-[#AEAC78]/40 text-[11px] font-semibold transition-all cursor-pointer shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Demo</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default DemoWalkthroughBar;
