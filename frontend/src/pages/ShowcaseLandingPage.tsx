import React, { useState } from 'react';
import {
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  FileSearch,
  Layers,
  Sliders,
} from 'lucide-react';
import {
  Stage1IngestDiagram,
  Stage2SandboxDiagram,
  Stage3EvidenceDiagram,
  Stage4AiDraftDiagram,
  Stage5ReviewDiagram,
} from '../assets/LandingVisuals';
import { LoginModal } from '../components/LoginModal';

export interface ShowcaseLandingPageProps {
  onLaunchDemo?: () => void;
}

interface PillarData {
  id: string;
  title: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  statValue: number;
  statSuffix: string;
  statLabel: string;
  summary: string;
  highlights: string[];
}

const AnimatedCounter: React.FC<{ target: number; suffix?: string; duration?: number }> = ({
  target,
  suffix = '',
  duration = 1200,
}) => {
  const [count, setCount] = useState(0);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frameId: number;
    let started = false;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          started = true;
          const startTime = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) {
              frameId = requestAnimationFrame(step);
            }
          };
          frameId = requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [target, duration]);

  return (
    <span ref={ref} data-testid="pillar-stat">
      {count}
      {suffix}
    </span>
  );
};

interface LifecycleStage {
  id: number;
  name: string;
  shortTitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  diagram: React.ComponentType;
  description: string;
  inputs: string[];
  outputs: string[];
  guarantees: string[];
}

const PILLARS: PillarData[] = [
  {
    id: 'sandbox',
    title: 'Isolated Container Sandbox',
    badge: 'Kernel-Isolated Alpine • Network Disabled',
    icon: Cpu,
    statValue: 256,
    statSuffix: ' MB',
    statLabel: 'RAM Ceiling · 10s Watchdog',
    summary:
      'Spawns dedicated Alpine containers with read-only mounts, network disabled, cgroups limits, and pytest execution.',
    highlights: ['alpine:3.19-cgroups', 'Zero Network Egress'],
  },
  {
    id: 'similarity',
    title: 'Code Similarity & Anti-Plagiarism',
    badge: 'Karp-Rabin + JPlag 6.2',
    icon: FileSearch,
    statValue: 100,
    statSuffix: '%',
    statLabel: 'Boilerplate Template Subtracted',
    summary:
      'Dual-engine Karp-Rabin token winnowing and JPlag 6.2 AST structure comparison eliminating starter boilerplate.',
    highlights: ['Variable-Invariant', 'AST Structure Match'],
  },
  {
    id: 'rubrics',
    title: '4-Tier Rubric & Formula Engine',
    badge: '100% Normalized Math',
    icon: Sliders,
    statValue: 100,
    statSuffix: '%',
    statLabel: 'Normalized Weight across 4 Tiers',
    summary:
      'Multi-category float scoring across automated test suites (40%), Ruff PEP8 (20%), AST (20%), and manual review (20%).',
    highlights: ['0.4T + 0.2R + 0.2A + 0.2M', 'Deterministic Audit'],
  },
  {
    id: 'ai-feedback',
    title: 'Citation-Grounded AI Feedback',
    badge: 'Evidence-Anchored LLM',
    icon: Bot,
    statValue: 100,
    statSuffix: '%',
    statLabel: 'Evidence-Cited Claims',
    summary:
      'Every AI suggestion cites verifiable evidence IDs with offline rulebook fallback and human lecturer decision last.',
    highlights: ['[EVID_*] Anchored', 'Instructor Sign-off'],
  },
];

const LIFECYCLE_STAGES: LifecycleStage[] = [
  {
    id: 1,
    name: 'Batch Ingest',
    shortTitle: 'Batch Ingest',
    badge: 'Stage 1: Ingestion',
    icon: Layers,
    diagram: Stage1IngestDiagram,
    description:
      'LMS archive ingestion with automated ZIP manifest validation, directory traversal sanitization, and student submission extraction.',
    inputs: ['LMS Archive (.zip)', 'Class Roster CSV', 'Starter Code Template'],
    outputs: ['Sanitized Solution Files', 'Submission Records', 'SHA-256 Checksums'],
    guarantees: [
      'Path traversal and zip-slip vulnerability defense',
      'Automatic UTF-8 normalization and newline conversion',
      'Idempotent ingestion preserving submission metadata',
    ],
  },
  {
    id: 2,
    name: 'Docker Sandbox Test',
    shortTitle: 'Sandbox Runner',
    badge: 'Stage 2: Execution',
    icon: Cpu,
    diagram: Stage2SandboxDiagram,
    description:
      'Spawns ephemeral Alpine Linux container to execute instructor test cases in strict isolation with zero network egress.',
    inputs: ['Student solution.py', 'Public Test Cases', 'Hidden Test Cases'],
    outputs: ['In-Container Test JSON', 'Captured stdout/stderr', 'Execution Duration'],
    guarantees: [
      'Zero network access (--network none) preventing socket connections',
      'Strict Linux cgroups constraints: 256MB RAM and 1 vCPU limits',
      '10-second SIGKILL watchdog timeout protecting against infinite loops',
    ],
  },
  {
    id: 3,
    name: 'Evidence & AST Extraction',
    shortTitle: 'Evidence & AST',
    badge: 'Stage 3: Analysis',
    icon: FileSearch,
    diagram: Stage3EvidenceDiagram,
    description:
      'Runs static analysis pipelines extracting Ruff linter violations, McCabe cyclomatic complexity, and tokenized similarity windows.',
    inputs: ['Extracted Source Code', 'Ruff Rule Config', 'Base Code Skeleton'],
    outputs: ['EVID_TEST_* Records', 'EVID_LINT_* Diagnostics', 'Karp-Rabin Token Hashes'],
    guarantees: [
      'Deterministic evidence ID generation mapped to exact line numbers',
      'Base-code subtraction eliminating false positive similarity matches',
      'Immutable structured evidence records persisted to database',
    ],
  },
  {
    id: 4,
    name: 'Grounded AI Draft',
    shortTitle: 'Grounded AI',
    badge: 'Stage 4: Synthesis',
    icon: Bot,
    diagram: Stage4AiDraftDiagram,
    description:
      'Synthesizes pedagogical feedback strictly grounded in verified evidence IDs, generating score suggestions without hallucination.',
    inputs: ['Structured Evidence Manifest', 'Rubric Criteria & Formulas', 'Pedagogical Guidelines'],
    outputs: ['Draft Feedback Markdown', 'Suggested Rubric Scores', 'Verifiable Citations'],
    guarantees: [
      'Every criticism or commendation anchored to an active evidence ID',
      'Deterministic rule-based fallback when external LLM API is unavailable',
      'AI suggestions remain in draft state until confirmed by lecturer',
    ],
  },
  {
    id: 5,
    name: 'Human Instructor Confirmation',
    shortTitle: 'Lecturer Review',
    badge: 'Stage 5: Final Authority',
    icon: CheckCircle2,
    diagram: Stage5ReviewDiagram,
    description:
      'The instructor reviews test traces, inspects evidence citations, overrides criterion scores if warranted, and confirms final publication.',
    inputs: ['AI Feedback Draft', 'Test Execution Logs', 'Grade Override Controls'],
    outputs: ['Confirmed Total Score', 'Signed Feedback Report', 'Exportable Gradebook CSV'],
    guarantees: [
      'Zero unreviewed grades published to student gradebook',
      'Full audit trail recording manual overrides and justification notes',
      'Seamless gradebook export formatted for university LMS systems',
    ],
  },
];

interface AssertionChip {
  id: string;
  name: string;
  time: string;
  status: 'PASSED' | 'FAILED';
  line: number;
  description: string;
}

const MOCKUP_CHIPS: AssertionChip[] = [
  { id: 'c1', name: 'test_basic', time: '14ms', status: 'PASSED', line: 83, description: 'Standard complementary pair evaluation' },
  { id: 'c2', name: 'test_negative', time: '18ms', status: 'PASSED', line: 89, description: 'Negative values and zero-sum verification' },
  { id: 'c3', name: 'test_large_n', time: '42ms', status: 'PASSED', line: 92, description: 'Large array scale and O(n log n) constraint test' },
  { id: 'c4', name: 'test_bounds', time: '16ms', status: 'PASSED', line: 94, description: 'Single element and boundary limits test' },
];

const NAV_SECTIONS = [
  { id: 'demo', label: 'Workstation Demo' },
  { id: 'how-it-works', label: 'How it Works' },
  { id: 'lifecycle', label: 'Grading Pipeline' },
  { id: 'features', label: 'Features' },
  { id: 'comparison', label: 'Comparison' },
] as const;

export const ShowcaseLandingPage: React.FC<ShowcaseLandingPageProps> = ({ onLaunchDemo }) => {
  // Interactive Mockup State
  const [selectedChipId, setSelectedChipId] = useState<string>('c1');
  const [mockupApproved, setMockupApproved] = useState<boolean>(false);
  const [isSimulatingRun, setIsSimulatingRun] = useState<boolean>(false);
  const [simulatedScore, setSimulatedScore] = useState<number>(10.0);
  const [passedChipIds, setPassedChipIds] = useState<string[]>(['c1', 'c2', 'c3', 'c4']);
  const [currentRunningChipId, setCurrentRunningChipId] = useState<string | null>(null);
  const [highlightedEvidenceKey, setHighlightedEvidenceKey] = useState<string | null>(null);
  const [executionTimestamp, setExecutionTimestamp] = useState<string>('0.12s');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Header Scroll-Spy State & Sliding Indicator
  const [activeNavId, setActiveNavId] = useState<string>('demo');
  const navRef = React.useRef<HTMLElement>(null);
  const navItemRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorStyle, setIndicatorStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  React.useEffect(() => {
    const handleScroll = () => {
      const triggerY = 240;
      let currentId: string = NAV_SECTIONS[0].id;
      for (const sec of NAV_SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= triggerY) {
            currentId = sec.id;
          }
        }
      }
      setActiveNavId(currentId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    const updateIndicator = () => {
      const activeEl = navItemRefs.current[activeNavId];
      if (activeEl) {
        setIndicatorStyle({
          left: activeEl.offsetLeft,
          width: activeEl.offsetWidth,
        });
      }
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeNavId]);

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  };

  const handleTriggerSimulateRun = () => {
    if (isSimulatingRun) return;
    setIsSimulatingRun(true);
    setPassedChipIds([]);
    setCurrentRunningChipId('c1');
    setSimulatedScore(0.0);
    setExecutionTimestamp('0.02s');

    setTimeout(() => {
      setPassedChipIds(['c1']);
      setCurrentRunningChipId('c2');
      setSimulatedScore(2.5);
      setExecutionTimestamp('0.05s');
    }, 300);

    setTimeout(() => {
      setPassedChipIds(['c1', 'c2']);
      setCurrentRunningChipId('c3');
      setSimulatedScore(5.0);
      setExecutionTimestamp('0.08s');
    }, 600);

    setTimeout(() => {
      setPassedChipIds(['c1', 'c2', 'c3']);
      setCurrentRunningChipId('c4');
      setSimulatedScore(7.5);
      setExecutionTimestamp('0.10s');
    }, 900);

    setTimeout(() => {
      setPassedChipIds(['c1', 'c2', 'c3', 'c4']);
      setCurrentRunningChipId(null);
      setSimulatedScore(10.0);
      setExecutionTimestamp('0.12s');
      setIsSimulatingRun(false);
    }, 1200);
  };

  // Interactive Lifecycle Stage State
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const activeStage = LIFECYCLE_STAGES.find((s) => s.id === activeStageId) || LIFECYCLE_STAGES[0];
  const ActiveStageDiagram = activeStage.diagram;

  return (
    <div data-testid="workstation-root" className="min-h-screen bg-surface font-sans text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* HEADER BAR (Stitch Specification) */}
      <header className="fixed top-0 w-full z-50 bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/60">
        <div className="h-20 max-w-[1320px] mx-auto px-gutter-lg flex items-center justify-between">
          {/* Logo & Platform Title */}
          <div className="flex items-center gap-space-lg">
            <a className="flex items-center" href="#" aria-label="VeriPie Home">
              <img
                src="/logo.png"
                alt="VeriPie Logo"
                className="h-10 sm:h-11 md:h-12 w-auto object-contain shrink-0"
              />
            </a>
          </div>

          {/* Navigation Links with Animated Scroll-Spy Indicator */}
          <nav ref={navRef} className="hidden xl:flex items-center gap-space-xs relative p-1 rounded-xl">
            {indicatorStyle.width > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-1 bottom-1 rounded-lg bg-surface-container border border-outline-variant/30 shadow-xs transition-all duration-300 ease-out pointer-events-none"
                style={{
                  transform: `translateX(${indicatorStyle.left - 4}px)`,
                  width: `${indicatorStyle.width}px`,
                }}
              >
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-primary-container" />
              </span>
            )}
            {NAV_SECTIONS.map((item) => {
              const isActive = activeNavId === item.id;
              return (
                <a
                  key={item.id}
                  ref={(el) => {
                    navItemRefs.current[item.id] = el;
                  }}
                  href={`#${item.id}`}
                  onClick={() => setActiveNavId(item.id)}
                  data-active={isActive ? 'true' : 'false'}
                  className={`relative z-10 px-space-md py-space-sm rounded-lg font-label-md text-label-md transition-colors duration-200 ${
                    isActive
                      ? 'text-on-surface font-bold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Actions: Sign In & 1-Click Demo */}
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              className="hidden sm:inline-flex items-center px-space-md py-space-sm text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={onLaunchDemo}
              type="button"
              className="inline-flex items-center justify-center px-space-lg py-space-sm bg-gradient-to-r from-primary-container to-tertiary text-on-primary font-label-md text-label-md rounded-lg shadow-sm hover:opacity-95 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              Try Interactive Demo
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full pt-20 bg-surface min-h-[calc(100vh-240px)]">
        <div className="flex flex-col w-full">
          {/* Top Decorative Ambient Glow */}
          <div className="relative w-full overflow-hidden">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-primary-fixed/40 via-secondary-container/20 to-transparent blur-3xl pointer-events-none -z-10 rounded-full" />

            {/* HERO SECTION */}
            <section id="hero" className="max-w-[1320px] mx-auto px-gutter-lg pt-space-xl pb-margin-lg flex flex-col items-center text-center">
              {/* Punchy Badge */}
              <div
                data-testid="stitch-pill-badge"
                className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container text-on-surface font-label-mono text-label-mono shadow-sm"
              >
                <span className="text-primary-container material-symbols-outlined text-[14px]">auto_awesome</span>
                <span className="font-semibold text-on-surface">Next-Gen Python Grading Engine</span>
                <span className="mx-space-xs text-outline-variant">•</span>
                <span className="text-secondary font-medium">Easy as Pie • Evidence First</span>
              </div>

              {/* Main Hero Headline */}
              <h1
                data-testid="showcase-title"
                className="mt-space-lg max-w-4xl font-display-hero text-display-hero text-on-surface tracking-tight"
              >
                Grading Student Code <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-primary via-tertiary to-primary-container bg-clip-text text-transparent">
                  Shouldn't Take All Night.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="mt-space-md max-w-2xl font-body-lg text-body-lg text-on-surface-variant">
                VeriPie combines isolated Docker sandboxing, token-level anti-plagiarism, and citation-grounded AI feedback into one seamless workstation for computer science educators.
              </p>

              {/* Action Buttons */}
              <div className="mt-space-xl flex flex-wrap items-center justify-center gap-space-md">
                <button
                  type="button"
                  onClick={onLaunchDemo}
                  className="inline-flex items-center justify-center gap-space-sm px-space-xl py-space-md bg-primary-container hover:bg-primary-container/90 text-on-primary font-label-md text-label-md rounded-lg shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
                >
                  <span>Launch Interactive Live Demo</span>
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </button>
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-space-sm px-space-xl py-space-md bg-surface-container-lowest text-on-surface font-label-md text-label-md rounded-lg shadow-sm hover:bg-surface-container-low transition-colors border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[18px] text-secondary">terminal</span>
                  <span>View Grading Workstation</span>
                </a>
              </div>

              {/* Trust Badges Strip */}
              <div className="mt-space-lg flex flex-wrap items-center justify-center gap-x-space-xl gap-y-space-sm font-label-mono text-label-mono text-on-surface-variant">
                <div className="flex items-center gap-space-xs">
                  <span className="text-primary-container material-symbols-outlined text-[16px]">bolt</span>
                  <span>Sub-Second Sandbox Execution (0.8s)</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="text-secondary material-symbols-outlined text-[16px]">verified_user</span>
                  <span>JPlag + Winnowing Plagiarism Guard</span>
                </div>
                <div className="flex items-center gap-space-xs">
                  <span className="text-tertiary material-symbols-outlined text-[16px]">smart_toy</span>
                  <span>Hallucination-Proof AI Explanations</span>
                </div>
              </div>

              {/* INTERACTIVE HIGH-FIDELITY GRADING MOCKUP */}
              <div
                id="demo"
                data-testid="hero-workstation-mockup"
                onMouseMove={handleCardMouseMove}
                className="spotlight-card mt-space-xl w-full max-w-[1180px] bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden text-left border border-outline-variant/30"
              >
                {/* Mockup Chrome Header Bar */}
                <div className="bg-surface-container-low px-space-lg py-space-sm flex items-center justify-between border-b border-surface-container-high/60">
                  <div className="flex items-center gap-space-md">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-error inline-block" />
                      <span className="w-3 h-3 rounded-full bg-primary-container inline-block" />
                      <span className="w-3 h-3 rounded-full bg-secondary inline-block" />
                    </div>
                    <div className="flex items-center gap-space-xs font-label-mono text-label-mono text-on-surface-variant">
                      <span className="material-symbols-outlined text-[16px] text-secondary">folder_zip</span>
                      <span>CS101_Assignment4 / student_submission_921.py</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-space-sm font-label-mono text-label-mono">
                    <button
                      type="button"
                      onClick={handleTriggerSimulateRun}
                      disabled={isSimulatingRun}
                      className="px-2.5 py-1 rounded bg-primary-container hover:bg-primary-container/90 text-on-primary font-mono text-[11px] font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-60"
                      title="Simulate Docker sandbox execution and autograding"
                    >
                      <span className={`material-symbols-outlined text-[14px] ${isSimulatingRun ? 'animate-spin' : ''}`}>
                        {isSimulatingRun ? 'refresh' : 'play_arrow'}
                      </span>
                      <span>{isSimulatingRun ? 'Executing...' : 'Simulate Run'}</span>
                    </button>
                    <span className="px-space-sm py-0.5 rounded bg-surface-container-high text-on-secondary-container hidden sm:inline-block">
                      Sandbox: isolated-alpine:3.12
                    </span>
                    <span className={`px-space-sm py-0.5 rounded bg-primary-fixed text-on-primary-fixed flex items-center gap-1 font-semibold transition-all duration-300 ${isSimulatingRun ? 'ring-2 ring-primary-container animate-pulse' : ''}`}>
                      <span className="w-2 h-2 rounded-full bg-primary" /> {simulatedScore.toFixed(1)} / 10.0
                    </span>
                  </div>
                </div>

                {/* Dual Code / Rubric Panel View */}
                <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[460px]">
                  {/* Left: Code Editor Inspection */}
                  <div className="lg:col-span-7 bg-[#1e1e24] text-[#ecf1ff] p-space-lg font-code-sm text-code-sm flex flex-col justify-between overflow-x-auto relative">
                    {/* Scanline Sweep Effect during active run */}
                    {isSimulatingRun && (
                      <div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary-container/30 to-transparent pointer-events-none animate-scanline z-10" />
                    )}
                    <div>
                      <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-white/10 font-label-mono text-label-mono">
                        <span className="text-slate-400"># VERIFIED STUDENT IMPLEMENTATION (AUTOGRADED)</span>
                        <span className="text-tertiary-fixed font-semibold">AST: Validated O(n log n)</span>
                      </div>
                      <pre className="leading-relaxed font-mono">
                        <code data-testid="mockup-code" className="text-[#ecf1ff] block font-mono text-xs">
                          <div><span className="text-[#93ccff]">from</span> typing <span className="text-[#93ccff]">import</span> List, Tuple</div>
                          <div>&nbsp;</div>
                          <div><span className="text-[#ffb95f]">def</span> <span className="text-white font-bold">find_target_pairs</span>(nums: List[<span className="text-[#cce5ff]">int</span>], target: <span className="text-[#cce5ff]">int</span>) -&gt; List[Tuple[<span className="text-[#cce5ff]">int</span>, <span className="text-[#cce5ff]">int</span>]]:</div>
                          <div className="text-slate-400">&nbsp;&nbsp;&nbsp;&nbsp;&quot;&quot;&quot;Returns all unique complementary pairs satisfying the sum target.&quot;&quot;&quot;</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;seen = <span className="text-[#cce5ff]">set</span>()</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;output = <span className="text-[#cce5ff]">set</span>()</div>
                          <div className={`transition-all duration-300 rounded px-1.5 -mx-1.5 ${highlightedEvidenceKey === 'EVID_TEST_03' ? 'bg-amber-500/25 border-l-2 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : ''}`}>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#93ccff]">for</span> val <span className="text-[#93ccff]">in</span> nums:</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;complement = target - val</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#93ccff]">if</span> complement <span className="text-[#93ccff]">in</span> seen:</div>
                            <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;output.add((<span className="text-[#cce5ff]">min</span>(val, complement), <span className="text-[#cce5ff]">max</span>(val, complement)))</div>
                          </div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;seen.add(val)</div>
                          <div>&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-[#93ccff]">return</span> <span className="text-[#cce5ff]">sorted</span>(<span className="text-[#cce5ff]">list</span>(output))</div>
                        </code>
                      </pre>
                      {highlightedEvidenceKey === 'EVID_TEST_03' && (
                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] animate-scale-pop">
                          <span className="material-symbols-outlined text-[13px]">search_check</span>
                          <span>Target lines 7-10 anchored to [EVID_TEST_03]: Complementary pair match verified</span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Pytest Assertion Chips */}
                    <div className="mt-space-lg bg-black/40 rounded-lg p-space-md border border-white/10">
                      <div className="flex items-center justify-between font-label-mono text-label-mono text-[#ecf1ff]">
                        <span className="flex items-center gap-1.5 text-secondary-fixed">
                          <span className={`material-symbols-outlined text-[16px] ${isSimulatingRun ? 'animate-spin text-amber-400' : 'text-emerald-400'}`}>
                            {isSimulatingRun ? 'refresh' : 'check_circle'}
                          </span>
                          <span>
                            {isSimulatingRun ? 'Running Pytest Sandbox...' : `${passedChipIds.length} / 4 Deterministic Tests Passed`}
                          </span>
                        </span>
                        <span className="text-slate-400 font-mono">Execution time: {executionTimestamp}</span>
                      </div>
                      <div className="mt-space-xs grid grid-cols-2 sm:grid-cols-4 gap-space-xs font-label-mono text-label-mono">
                        {MOCKUP_CHIPS.map((chip) => {
                          const isPassed = passedChipIds.includes(chip.id);
                          const isRunning = currentRunningChipId === chip.id;
                          return (
                            <button
                              key={chip.id}
                              type="button"
                              data-testid="mockup-assertion-chip"
                              aria-pressed={selectedChipId === chip.id}
                              onClick={() => setSelectedChipId(chip.id)}
                              className={`px-2 py-1.5 rounded text-center transition-all cursor-pointer text-xs font-mono flex items-center justify-center gap-1 ${
                                selectedChipId === chip.id
                                  ? 'bg-primary-container text-on-primary font-bold ring-2 ring-primary-container/40'
                                  : 'bg-white/10 hover:bg-white/20 text-[#ffddb8]'
                              }`}
                            >
                              <span>{chip.name}</span>
                              <span>{isRunning ? '⏳' : isPassed ? '[PASS]' : '[..]'}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: Rubric Engine & Verifiable Feedback */}
                  <div className="lg:col-span-5 bg-surface-container-low p-space-lg flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-space-xs">
                        <div>
                          <span className="font-headline-sm text-headline-sm text-on-surface">Rubric Verification</span>
                          <p className="font-body-sm text-body-sm text-on-surface-variant">Deterministic Mathematical Weighting</p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center font-headline-sm text-headline-sm font-bold text-on-primary-fixed shadow-sm">
                          100%
                        </div>
                      </div>

                      {/* Rubric Breakdown Rows */}
                      <div className="mt-space-md space-y-space-sm">
                        <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-space-sm">
                            <span className="material-symbols-outlined text-secondary text-[20px]">task_alt</span>
                            <div>
                              <p className="font-label-md text-label-md text-on-surface">Tier 1: Pytest Suite</p>
                              <p className="font-body-sm text-body-sm text-on-surface-variant">Public &amp; Hidden Test Cases</p>
                            </div>
                          </div>
                          <span className="font-label-mono text-label-mono font-bold text-secondary">4.0 / 4.0 pts</span>
                        </div>

                        <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-space-sm">
                            <span className="material-symbols-outlined text-secondary text-[20px]">auto_fix_high</span>
                            <div>
                              <p className="font-label-md text-label-md text-on-surface">Tier 2: Ruff Static Lint</p>
                              <p className="font-body-sm text-body-sm text-on-surface-variant">PEP8, Type Annotations</p>
                            </div>
                          </div>
                          <span className="font-label-mono text-label-mono font-bold text-secondary">2.0 / 2.0 pts</span>
                        </div>

                        <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-space-sm">
                            <span className="material-symbols-outlined text-primary-container text-[20px]">psychology</span>
                            <div>
                              <p className="font-label-md text-label-md text-on-surface">Tier 3: AST Complexity</p>
                              <p className="font-body-sm text-body-sm text-on-surface-variant">McCabe Complexity &lt;= 4</p>
                            </div>
                          </div>
                          <span className="font-label-mono text-label-mono font-bold text-primary">2.0 / 2.0 pts</span>
                        </div>

                        <div className="p-space-sm rounded-lg bg-surface-container-lowest shadow-sm flex items-center justify-between">
                          <div className="flex items-center gap-space-sm">
                            <span className="material-symbols-outlined text-tertiary text-[20px]">format_image_left</span>
                            <div>
                              <p className="font-label-md text-label-md text-on-surface">Plagiarism Index (JPlag)</p>
                              <p className="font-body-sm text-body-sm text-on-surface-variant">Template subtracted: 4.2% sim</p>
                            </div>
                          </div>
                          <span className="px-space-sm py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-mono text-label-mono">
                            PASS (Clean)
                          </span>
                        </div>
                      </div>

                      {/* AI Grounded Draft Card */}
                      <div data-testid="mockup-ai-card" className="mt-space-md p-space-sm rounded-lg bg-tertiary-fixed/30 shadow-sm border border-tertiary-fixed/40 transition-all hover:shadow-md">
                        <div className="flex items-center gap-space-xs font-label-mono text-label-mono text-on-tertiary-fixed-variant mb-1">
                          <span className="material-symbols-outlined text-[16px]">format_quote</span>
                          <span>Citation-Grounded AI Draft [Ready for Approval]</span>
                        </div>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Optimal linear set membership approach. Both edge conditions{' '}
                          <code
                            onMouseEnter={() => setHighlightedEvidenceKey('EVID_TEST_03')}
                            onMouseLeave={() => setHighlightedEvidenceKey(null)}
                            className="font-label-mono bg-surface-container-lowest px-1.5 py-0.5 rounded text-primary font-bold cursor-pointer hover:bg-primary-container hover:text-on-primary transition-all shadow-sm ring-1 ring-primary/30 inline-flex items-center gap-0.5"
                          >
                            <span className="material-symbols-outlined text-[13px]">pin_drop</span>
                            EVID_TEST_03
                          </code>{' '}
                          and duplicates handling verified.
                        </p>
                      </div>
                    </div>

                    {/* Instructor Action Buttons */}
                    <div className="mt-space-md pt-space-sm flex items-center gap-space-sm">
                      <button
                        type="button"
                        onClick={() => setMockupApproved(!mockupApproved)}
                        className={`flex-1 py-space-sm px-space-md rounded-lg shadow-sm font-label-md text-label-md transition-all flex items-center justify-center gap-space-xs cursor-pointer active:scale-95 ${
                          mockupApproved
                            ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                            : 'bg-secondary text-on-secondary hover:opacity-95'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {mockupApproved ? 'check' : 'done_all'}
                        </span>
                        <span>{mockupApproved ? 'Grade Published!' : 'Approve Grade & Post'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={onLaunchDemo}
                        className="py-space-sm px-space-md bg-surface-container-highest text-on-surface font-label-md text-label-md rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        Override
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* HOW VERIPIE WORKS: 3-STEP VISUAL FLOW */}
          <section id="how-it-works" className="w-full bg-surface-container-low py-margin-lg">
            <div className="max-w-[1320px] mx-auto px-gutter-lg">
              <div className="text-center max-w-2xl mx-auto mb-space-xl">
                <span className="font-label-mono text-label-mono uppercase tracking-wider text-primary font-bold">
                  Execution Workflow
                </span>
                <h2 className="mt-space-xs font-headline-lg text-headline-lg text-on-surface">
                  Grading in Three Seamless Slices
                </h2>
                <p className="mt-space-xs font-body-lg text-body-lg text-on-surface-variant">
                  No fragile shell scripts or ungrounded generative hallucinations. Deterministic at every stage.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-space-lg relative">
                {/* Step 1 */}
                <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md hover:shadow-lg transition-transform hover:-translate-y-1 relative border border-surface-container-high/40">
                  <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center text-on-primary-fixed font-headline-sm text-headline-sm font-bold mb-space-md shadow-sm">
                    01
                  </div>
                  <div className="flex items-center gap-space-xs mb-space-xs font-label-mono text-label-mono text-primary font-semibold">
                    <span className="material-symbols-outlined text-[18px]">archive</span>
                    <span>INGESTION &amp; DEFENSE</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Ingest &amp; Sanitize</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Upload Moodle or Canvas bulk archives. VeriPie enforces Zip-Slip defense, checks SHA-256 checksums, and normalizes student roster metadata automatically.
                  </p>
                  <div className="mt-space-lg p-space-sm bg-surface-container-low rounded-lg font-label-mono text-label-mono text-on-surface-variant">
                    Zip-Slip Protected • UTF-8 Normalized
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md hover:shadow-lg transition-transform hover:-translate-y-1 relative border border-surface-container-high/40">
                  <div className="w-12 h-12 rounded-xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed font-headline-sm text-headline-sm font-bold mb-space-md shadow-sm">
                    02
                  </div>
                  <div className="flex items-center gap-space-xs mb-space-xs font-label-mono text-label-mono text-secondary font-semibold">
                    <span className="material-symbols-outlined text-[18px]">memory</span>
                    <span>CONTAINER ISOLATION</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Deterministic Run</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Executes student code within network-disabled Alpine Linux containers. Monitored by cgroup memory bounds, Ruff lint analysis, and AST syntax trees.
                  </p>
                  <div className="mt-space-lg p-space-sm bg-surface-container-low rounded-lg font-label-mono text-label-mono text-on-surface-variant">
                    Read-Only Mount • Zero Network Sockets
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md hover:shadow-lg transition-transform hover:-translate-y-1 relative border border-surface-container-high/40">
                  <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed font-headline-sm text-headline-sm font-bold mb-space-md shadow-sm">
                    03
                  </div>
                  <div className="flex items-center gap-space-xs mb-space-xs font-label-mono text-label-mono text-tertiary font-semibold">
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>HUMAN-IN-THE-LOOP</span>
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface mb-space-sm">Verified AI Feedback</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    AI feedback is strictly anchored to test execution IDs. Instructors review and sign off with a single click before releasing grades to students.
                  </p>
                  <div className="mt-space-lg p-space-sm bg-surface-container-low rounded-lg font-label-mono text-label-mono text-on-surface-variant">
                    Zero Hallucination • 1-Click Instructor Sign-off
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* INTERACTIVE 5-STAGE LIFECYCLE PIPELINE (Tested in Playwright) */}
          <section id="lifecycle" data-testid="interactive-lifecycle-diagram" className="max-w-[1320px] mx-auto px-gutter-lg py-margin-lg w-full">
            <div className="text-center max-w-2xl mx-auto mb-space-xl">
              <span className="font-label-mono text-label-mono uppercase tracking-wider text-secondary font-bold">
                Grading Lifecycle
              </span>
              <h2 className="mt-space-xs font-headline-lg text-headline-lg text-on-surface">
                End-to-End Pipeline Architecture
              </h2>
              <p className="mt-space-xs font-body-md text-body-md text-on-surface-variant">
                Select any stage to inspect execution guarantees, inputs, outputs, and architectural diagrams.
              </p>
            </div>

            {/* Stage Selector Pills */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-space-lg">
              {LIFECYCLE_STAGES.map((stage) => {
                const Icon = stage.icon;
                const isActive = activeStageId === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    data-testid="lifecycle-step"
                    data-step={stage.id}
                    data-active={isActive ? 'true' : 'false'}
                    aria-selected={isActive}
                    onClick={() => setActiveStageId(stage.id)}
                    className={`flex items-center gap-2 px-space-md py-space-sm rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary-container text-on-primary-container font-bold shadow-md'
                        : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{stage.shortTitle}</span>
                  </button>
                );
              })}
            </div>

            {/* Stage Details Pane & Interactive SVG Visual */}
            <div data-testid="step-details" className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md border border-surface-container-high/60 grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-center">
              <div className="lg:col-span-5 space-y-space-md">
                <span className="px-space-sm py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-mono text-label-mono">
                  {activeStage.badge}
                </span>
                <h3 className="font-headline-sm text-headline-sm text-on-surface">{activeStage.name}</h3>
                <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                  {activeStage.description}
                </p>

                <div className="space-y-space-xs pt-space-xs">
                  <span className="font-label-mono text-[11px] text-on-surface font-bold uppercase tracking-wide block">
                    Engineering Guarantees
                  </span>
                  <ul className="space-y-1 font-body-sm text-body-sm text-on-surface-variant">
                    {activeStage.guarantees.map((g, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-secondary shrink-0" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Dynamic Diagram Visual Container */}
              <div className="lg:col-span-7 bg-surface-container-low rounded-xl p-space-md flex items-center justify-center min-h-[280px]">
                <ActiveStageDiagram />
              </div>
            </div>
          </section>

          {/* CORE ARCHITECTURAL PILLARS (THE VERIPIE INTEGRITY ENGINE) */}
          <section id="pillars" className="max-w-[1320px] mx-auto px-gutter-lg py-margin-lg w-full">
            <div>
              <div id="features" className="flex flex-col md:flex-row md:items-end justify-between mb-space-xl">
                <div>
                  <span className="font-label-mono text-label-mono uppercase tracking-wider text-secondary font-bold">
                    Engineering Guarantees
                  </span>
                  <h2 className="mt-space-xs font-headline-lg text-headline-lg text-on-surface">
                    The VeriPie Integrity Engine
                  </h2>
                </div>
                <p className="mt-space-sm md:mt-0 max-w-md font-body-md text-body-md text-on-surface-variant">
                  Engineered specifically for computer science faculty who require forensic audit trails, reproducibility, and high speed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
                {PILLARS.map((pillar) => (
                  <div
                    key={pillar.id}
                    data-testid="pillar-card"
                    onMouseMove={handleCardMouseMove}
                    className="spotlight-card bg-surface-container-lowest rounded-xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 border border-surface-container-high/50 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-space-md">
                        <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container shrink-0">
                          <pillar.icon className="w-4 h-4 text-primary-container" />
                        </div>
                        <span
                          data-testid="pillar-badge"
                          className="px-2 py-0.5 rounded bg-surface-container font-label-mono text-[11px] text-on-surface-variant truncate"
                        >
                          {pillar.badge}
                        </span>
                      </div>

                      {/* Animated Stat Block */}
                      <div className="mb-space-sm py-space-sm px-space-md rounded-lg bg-surface-container-low border border-outline-variant/25">
                        <div className="font-headline-md text-headline-md font-bold text-primary-container tracking-tight">
                          <AnimatedCounter target={pillar.statValue} suffix={pillar.statSuffix} />
                        </div>
                        <div className="font-label-mono text-[11px] text-on-surface-variant font-medium">
                          {pillar.statLabel}
                        </div>
                      </div>

                      <h3 className="font-headline-sm text-base font-bold text-on-surface mb-1">
                        {pillar.title}
                      </h3>
                      <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed mb-space-md">
                        {pillar.summary}
                      </p>
                    </div>

                    {/* Compact Summary Highlights */}
                    <div className="pt-space-sm border-t border-surface-container-high/50 flex flex-wrap gap-1.5">
                      {pillar.highlights.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-surface-container text-on-surface font-label-mono text-[11px] font-medium"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
          </div>
        </section>

          {/* INTERACTIVE COMPARISON: BEFORE VS WITH VERIPIE */}
          <section id="comparison" className="w-full bg-surface-container-low py-margin-lg">
            <div className="max-w-[1320px] mx-auto px-gutter-lg">
              <div className="text-center max-w-2xl mx-auto mb-space-xl">
                <span className="font-label-mono text-label-mono uppercase tracking-wider text-primary font-bold">
                  Workflow Transformation
                </span>
                <h2 className="mt-space-xs font-headline-lg text-headline-lg text-on-surface">
                  Grading Chaos vs. VeriPie Harmony
                </h2>
                <p className="mt-space-xs font-body-lg text-body-lg text-on-surface-variant">
                  See why university instructors switch from manual unmaintainable scripts to VeriPie.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                {/* Without VeriPie Card */}
                <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-sm border-l-4 border-error">
                  <div className="flex items-center gap-space-sm mb-space-md">
                    <span className="material-symbols-outlined text-error text-[28px]">cancel</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      Without VeriPie (Manual Chaos)
                    </span>
                  </div>
                  <ul className="space-y-space-md font-body-md text-body-md text-on-surface-variant">
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">close</span>
                      <span><strong>14+ Hours Per Assignment:</strong> Manually unpacking LMS zip archives and fighting corrupted encodings.</span>
                    </li>
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">close</span>
                      <span><strong>Host Machine Risk:</strong> Running untrusted student scripts directly in host terminal with potential file-wiping bugs.</span>
                    </li>
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">close</span>
                      <span><strong>Inconsistent TA Grading:</strong> Different teaching assistants apply varying subjective penalties for PEP8 and complexity.</span>
                    </li>
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-error text-[18px] shrink-0 mt-0.5">close</span>
                      <span><strong>Hallucinatory Feedback:</strong> Raw AI autograders inventing non-existent compiler bugs and confusing learners.</span>
                    </li>
                  </ul>
                </div>

                {/* With VeriPie Card */}
                <div className="bg-surface-container-lowest rounded-xl p-space-xl shadow-md border-l-4 border-primary-container">
                  <div className="flex items-center gap-space-sm mb-space-md">
                    <span className="material-symbols-outlined text-primary-container text-[28px]">check_circle</span>
                    <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                      With VeriPie (Easy as Pie)
                    </span>
                  </div>
                  <ul className="space-y-space-md font-body-md text-body-md text-on-surface-variant">
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                      <span><strong>45-Minute Total Turnaround:</strong> Upload once, let the sandboxed runner execute 250+ submissions in parallel.</span>
                    </li>
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                      <span><strong>Total Kernel Isolation:</strong> Alpine Docker sandbox strictly prevents socket exfiltration and disk writes.</span>
                    </li>
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                      <span><strong>Deterministic Fairness:</strong> 4-tier rubric ensures identical mathematical scoring standards across all TAs.</span>
                    </li>
                    <li className="flex items-start gap-space-sm">
                      <span className="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-0.5">check</span>
                      <span><strong>Citation-Grounded AI:</strong> Every piece of student advice links to actual line numbers and assertion keys.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* CALL TO ACTION & LECTURER ACCESS (WARM GRADIENT CARD) */}
          <section id="login-card" className="max-w-[1320px] mx-auto px-gutter-lg py-margin-lg w-full">
            <div className="bg-gradient-to-br from-surface-container via-surface-container-high to-primary-fixed/30 rounded-xl p-space-xl md:p-margin-lg shadow-xl text-center relative overflow-hidden border border-outline-variant/30">
              {/* Decorative background accent circle */}
              <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-primary-container/20 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -top-24 -left-24 w-80 h-80 bg-secondary-container/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-space-xs px-space-md py-space-xs rounded-full bg-surface-container-lowest text-on-surface font-label-mono text-label-mono shadow-sm mb-space-md">
                  <span className="material-symbols-outlined text-[16px] text-primary-container">pie_chart</span>
                  <span>Accurate to the Last Crumb</span>
                </div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                  Ready to Slice Through Your Python Grading Backlog?
                </h2>
                <p className="mt-space-sm font-body-lg text-body-lg text-on-surface-variant">
                  Join faculty members across leading CS departments who grade hundreds of student submissions with zero compromise on academic integrity.
                </p>

                {/* Primary Action Buttons */}
                <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-md">
                  <button
                    type="button"
                    onClick={onLaunchDemo}
                    className="px-space-xl py-space-md bg-gradient-to-r from-primary-container to-tertiary text-on-primary font-label-md text-label-md rounded-lg shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5 inline-flex items-center gap-space-xs cursor-pointer"
                  >
                    <span>Start Free Instructor Trial</span>
                    <span className="material-symbols-outlined text-[18px]">school</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(true)}
                    className="px-space-xl py-space-md bg-surface-container-lowest text-on-surface font-label-md text-label-md rounded-lg shadow-sm hover:bg-surface-container-low transition-colors inline-flex items-center gap-space-xs cursor-pointer border border-outline-variant/40"
                  >
                    <span>Sign In to Workstation</span>
                    <span className="material-symbols-outlined text-[18px]">login</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER (Stitch Specification) */}
      <footer className="w-full bg-surface-container-low py-margin-md shadow-[0_-1px_4px_rgba(0,0,0,0.02)] border-t border-surface-container-high/60">
        <div className="max-w-[1320px] mx-auto px-gutter-lg flex flex-col md:flex-row items-center justify-between gap-space-lg">
          <div className="flex items-center gap-space-md">
            <img
              src="/logo.png"
              alt="VeriPie Logo"
              className="h-8 sm:h-9 md:h-10 w-auto object-contain shrink-0"
            />
            <span className="text-on-surface-variant font-body-sm text-body-sm hidden sm:inline border-l border-surface-container-high pl-space-md">
              Deterministic Python Code Verification Platform
            </span>
          </div>

          <div className="flex items-center gap-space-lg font-body-sm text-body-sm">
            <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#lifecycle">
              Pipeline Architecture
            </a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#features">
              Academic Licensing
            </a>
            <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#hero">
              Sandbox Protocol
            </a>
          </div>

          <div className="text-on-surface-variant font-label-mono text-label-mono">
            &copy; 2026 VeriPie Engine. All rights reserved.
          </div>
        </div>
      </footer>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};
