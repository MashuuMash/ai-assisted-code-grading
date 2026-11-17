import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Columns,
  Eye,
  Filter,
  Flag,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ComparisonReviewStatus, SimilarityComparison, Submission } from '../types';

interface MatchedRegion {
  lines_a: [number, number];
  lines_b: [number, number];
}

interface SimilarityCompareModalProps {
  isOpen: boolean;
  comparison: SimilarityComparison | null;
  codeA: string;
  codeB: string;
  loading: boolean;
  submissions?: Submission[];
  initialNote?: string;
  actionLoading?: boolean;
  onClose: () => void;
  onReview: (compId: number, status: ComparisonReviewStatus, notes: string) => Promise<void> | void;
  onSelectSubmissions?: (subAId: number, subBId: number) => void;
}

export const SimilarityCompareModal: React.FC<SimilarityCompareModalProps> = ({
  isOpen,
  comparison,
  codeA,
  codeB,
  loading,
  submissions = [],
  initialNote = '',
  actionLoading = false,
  onClose,
  onReview,
  onSelectSubmissions,
}) => {
  const [activeSpanIndex, setActiveSpanIndex] = useState<number>(0);
  const [matchedOnly, setMatchedOnly] = useState<boolean>(false);
  const [note, setNote] = useState<string>(initialNote);

  const leftLineRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const rightLineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    setNote(initialNote);
    setActiveSpanIndex(0);
    setMatchedOnly(false);
  }, [comparison?.id, initialNote]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const regions: MatchedRegion[] = useMemo(() => {
    const raw = (comparison?.matched_regions as MatchedRegion[] | undefined) || [];
    return raw.filter(
      (r) =>
        Array.isArray(r.lines_a) &&
        r.lines_a.length === 2 &&
        Array.isArray(r.lines_b) &&
        r.lines_b.length === 2
    );
  }, [comparison]);

  const jumpToSpan = (idx: number) => {
    setActiveSpanIndex(idx);
    const region = regions[idx];
    if (!region) return;
    const targetA = leftLineRefs.current[region.lines_a[0]];
    const targetB = rightLineRefs.current[region.lines_b[0]];
    if (targetA) {
      targetA.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (targetB) {
      targetB.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  useEffect(() => {
    if (!isOpen || loading || regions.length === 0) return;
    const timer = window.setTimeout(() => {
      jumpToSpan(0);
    }, 80);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loading, comparison?.id]);

  if (!isOpen || !comparison) return null;

  const pct = comparison.similarity_percentage;
  const subA = submissions.find((s) => s.id === comparison.submission_a_id);
  const subB = submissions.find((s) => s.id === comparison.submission_b_id);

  const labelA = subA?.student_name
    ? `${subA.student_name} (${subA.student_identifier || `#${comparison.submission_a_id}`})`
    : `Submission #${comparison.submission_a_id}`;
  const labelB = subB?.student_name
    ? `${subB.student_name} (${subB.student_identifier || `#${comparison.submission_b_id}`})`
    : `Submission #${comparison.submission_b_id}`;

  const getLineMatchInfo = (lineNo: number, side: 'a' | 'b') => {
    for (let i = 0; i < regions.length; i += 1) {
      const [start, end] = side === 'a' ? regions[i].lines_a : regions[i].lines_b;
      if (lineNo >= start && lineNo <= end) {
        return {
          spanIndex: i,
          isStart: lineNo === start,
          isActive: i === activeSpanIndex,
        };
      }
    }
    return null;
  };

  const isWithinMatchedContext = (lineNo: number, side: 'a' | 'b') => {
    if (!matchedOnly || regions.length === 0) return true;
    return regions.some((r) => {
      const [start, end] = side === 'a' ? r.lines_a : r.lines_b;
      return lineNo >= start - 2 && lineNo <= end + 2;
    });
  };

  const linesA = codeA.split('\n');
  const linesB = codeB.split('\n');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Side-by-Side Similarity Comparison"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#241F1C] text-[#FCF0DA] rounded-2xl border border-[#AEAC78]/50 shadow-2xl max-w-7xl w-[96vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#312B27] px-5 py-3.5 border-b border-[#AEAC78]/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 shrink-0">
              <Columns className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[#FCF0DA] truncate">
                  {labelA} <span className="text-[#AEAC78] font-normal">vs</span> {labelB}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono ${
                    pct >= 75
                      ? 'bg-rose-500/25 text-rose-200 border border-rose-400/40'
                      : 'bg-amber-500/25 text-amber-200 border border-amber-400/40'
                  }`}
                >
                  {pct.toFixed(1)}% Similarity
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    comparison.status === 'flagged'
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-400/40'
                      : comparison.status === 'dismissed'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                        : 'bg-[#AEAC78]/20 text-[#FCF0DA] border border-[#AEAC78]/40'
                  }`}
                >
                  {comparison.status}
                </span>
              </div>
              <p className="text-[11px] text-[#AEAC78] font-mono mt-0.5 truncate">
                {subA?.original_filename || `submission_${comparison.submission_a_id}.py`} &lt;-&gt;{' '}
                {subB?.original_filename || `submission_${comparison.submission_b_id}.py`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {regions.length > 0 && (
              <button
                type="button"
                onClick={() => setMatchedOnly((v) => !v)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                  matchedOnly
                    ? 'bg-[#F2C46A] text-[#4C4541] border-[#F2C46A]'
                    : 'bg-[#241F1C] text-[#FCF0DA] border-[#AEAC78]/40 hover:border-[#F2C46A]'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{matchedOnly ? 'Matched Spans Only' : 'Show Full File'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#AEAC78] hover:text-[#FCF0DA] hover:bg-[#4C4541]/50 transition-colors cursor-pointer"
              aria-label="Close comparison modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Matching Spans Navigation Bar */}
        {regions.length > 0 && (
          <div className="bg-[#2A2421] px-5 py-2 border-b border-[#AEAC78]/25 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="text-[11px] font-bold text-[#F2C46A] uppercase tracking-wider shrink-0">
              Matching Spans ({regions.length}):
            </span>
            <div className="flex items-center gap-1.5">
              {regions.map((reg, idx) => {
                const isActive = idx === activeSpanIndex;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => jumpToSpan(idx)}
                    className={`px-2.5 py-1 rounded-md font-mono text-[11px] font-bold transition-all cursor-pointer shrink-0 border ${
                      isActive
                        ? 'bg-[#F2C46A] text-[#4C4541] border-[#F2C46A] shadow-sm'
                        : 'bg-[#38322E] text-[#FCF0DA] border-[#AEAC78]/40 hover:border-[#F2C46A]/80'
                    }`}
                  >
                    Span #{idx + 1}: A:L{reg.lines_a[0]}-{reg.lines_a[1]} &lt;-&gt; B:L{reg.lines_b[0]}-
                    {reg.lines_b[1]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 2-Column Code Comparison Body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center font-mono text-xs text-[#AEAC78]">
              Loading side-by-side student implementations...
            </div>
          ) : (
            <div className="h-full grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#AEAC78]/25">
              {/* Left Pane: Submission A */}
              <div className="h-full flex flex-col min-h-0">
                <div className="px-4 py-2 bg-[#2C2623] border-b border-[#AEAC78]/20 flex items-center justify-between text-[11px] font-bold text-[#F2C46A] shrink-0">
                  <span className="truncate">{labelA}</span>
                  <span className="text-[10px] text-[#AEAC78] font-mono">
                    {linesA.length} lines
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5">
                  {linesA.map((line, idx) => {
                    const lineNo = idx + 1;
                    if (!isWithinMatchedContext(lineNo, 'a')) return null;
                    const match = getLineMatchInfo(lineNo, 'a');
                    const highlighted = Boolean(match && line.trim().length > 0);
                    return (
                      <div
                        key={lineNo}
                        ref={(el) => {
                          leftLineRefs.current[lineNo] = el;
                        }}
                        className={`flex items-start gap-2.5 px-2 py-0.5 rounded-xs transition-colors ${
                          highlighted
                            ? match?.isActive
                              ? 'bg-rose-500/30 border-l-4 border-[#F2C46A]'
                              : 'bg-rose-500/15 border-l-4 border-rose-400/80'
                            : 'border-l-4 border-transparent opacity-80'
                        }`}
                      >
                        <span className="w-7 text-right select-none text-[11px] text-[#AEAC78]/70 shrink-0">
                          {lineNo}
                        </span>
                        <span className="whitespace-pre text-[#FCF0DA] flex-1">{line || ' '}</span>
                        {match?.isStart && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              match.isActive
                                ? 'bg-[#F2C46A] text-[#4C4541]'
                                : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                            }`}
                          >
                            Span #{match.spanIndex + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Pane: Submission B */}
              <div className="h-full flex flex-col min-h-0">
                <div className="px-4 py-2 bg-[#2C2623] border-b border-[#AEAC78]/20 flex items-center justify-between text-[11px] font-bold text-[#F2C46A] shrink-0">
                  <span className="truncate">{labelB}</span>
                  <span className="text-[10px] text-[#AEAC78] font-mono">
                    {linesB.length} lines
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-5">
                  {linesB.map((line, idx) => {
                    const lineNo = idx + 1;
                    if (!isWithinMatchedContext(lineNo, 'b')) return null;
                    const match = getLineMatchInfo(lineNo, 'b');
                    const highlighted = Boolean(match && line.trim().length > 0);
                    return (
                      <div
                        key={lineNo}
                        ref={(el) => {
                          rightLineRefs.current[lineNo] = el;
                        }}
                        className={`flex items-start gap-2.5 px-2 py-0.5 rounded-xs transition-colors ${
                          highlighted
                            ? match?.isActive
                              ? 'bg-rose-500/30 border-l-4 border-[#F2C46A]'
                              : 'bg-rose-500/15 border-l-4 border-rose-400/80'
                            : 'border-l-4 border-transparent opacity-80'
                        }`}
                      >
                        <span className="w-7 text-right select-none text-[11px] text-[#AEAC78]/70 shrink-0">
                          {lineNo}
                        </span>
                        <span className="whitespace-pre text-[#FCF0DA] flex-1">{line || ' '}</span>
                        {match?.isStart && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                              match.isActive
                                ? 'bg-[#F2C46A] text-[#4C4541]'
                                : 'bg-rose-500/30 text-rose-200 border border-rose-400/40'
                            }`}
                          >
                            Span #{match.spanIndex + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-[#312B27] px-5 py-3 border-t border-[#AEAC78]/30 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Audit note before Flag / Dismiss (e.g. Identical helper logic)..."
              aria-label="Modal similarity review note"
              className="flex-1 rounded-lg border border-[#AEAC78]/40 bg-[#241F1C] px-3 py-1.5 text-xs text-[#FCF0DA] placeholder-[#AEAC78]/60 focus:outline-none focus:ring-1 focus:ring-[#F2C46A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSelectSubmissions && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectSubmissions(comparison.submission_a_id, comparison.submission_b_id);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#241F1C] hover:bg-[#38322E] border border-[#AEAC78]/40 text-[#FCF0DA] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#F2C46A]" />
                  <span>Open #{comparison.submission_a_id}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectSubmissions(comparison.submission_b_id, comparison.submission_a_id);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#241F1C] hover:bg-[#38322E] border border-[#AEAC78]/40 text-[#FCF0DA] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-[#F2C46A]" />
                  <span>Open #{comparison.submission_b_id}</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                onReview(
                  comparison.id,
                  'flagged',
                  note.trim() || 'Flagged for academic review'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Flag Plagiarism</span>
            </button>

            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                onReview(
                  comparison.id,
                  'dismissed',
                  note.trim() || 'Dismissed false positive'
                )
              }
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Dismiss</span>
            </button>

            {comparison.status === 'flagged' && (
              <span className="inline-flex items-center gap-1 text-[11px] text-rose-300 font-semibold ml-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                Flagged
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
