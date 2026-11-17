import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, FileCode, Highlighter, X } from 'lucide-react';

export type HighlightKind = 'similarity' | 'ai' | 'lint' | 'complexity' | 'test' | 'default';

export interface LineHighlight {
  line: number;
  kind: HighlightKind;
  label?: string;
}

interface CodeViewerProps {
  code: string;
  filename: string;
  highlightedLines?: number[];
  lineHighlights?: LineHighlight[];
  activeHighlightSummary?: {
    kind: HighlightKind;
    title: string;
  } | null;
  onClearHighlight?: () => void;
}

const HIGHLIGHT_STYLES: Record<
  HighlightKind,
  {
    rowBg: string;
    borderLeft: string;
    lineNoText: string;
    badgeBg: string;
    badgeText: string;
    bannerBg: string;
    bannerBorder: string;
    bannerText: string;
  }
> = {
  similarity: {
    rowBg: 'bg-rose-500/20',
    borderLeft: 'border-l-4 border-rose-400',
    lineNoText: 'text-rose-300 font-bold',
    badgeBg: 'bg-rose-500/25 border-rose-400/50',
    badgeText: 'text-rose-200',
    bannerBg: 'bg-rose-950/60',
    bannerBorder: 'border-rose-500/40',
    bannerText: 'text-rose-200',
  },
  ai: {
    rowBg: 'bg-violet-500/20',
    borderLeft: 'border-l-4 border-violet-400',
    lineNoText: 'text-violet-300 font-bold',
    badgeBg: 'bg-violet-500/25 border-violet-400/50',
    badgeText: 'text-violet-200',
    bannerBg: 'bg-violet-950/60',
    bannerBorder: 'border-violet-500/40',
    bannerText: 'text-violet-200',
  },
  lint: {
    rowBg: 'bg-[#F2C46A]/22',
    borderLeft: 'border-l-4 border-[#F2C46A]',
    lineNoText: 'text-[#F2C46A] font-bold',
    badgeBg: 'bg-[#F2C46A]/25 border-[#F2C46A]/50',
    badgeText: 'text-[#F2C46A]',
    bannerBg: 'bg-[#6B4307]/50',
    bannerBorder: 'border-[#F2C46A]/40',
    bannerText: 'text-[#FCF0DA]',
  },
  complexity: {
    rowBg: 'bg-amber-500/20',
    borderLeft: 'border-l-4 border-amber-400',
    lineNoText: 'text-amber-300 font-bold',
    badgeBg: 'bg-amber-500/25 border-amber-400/50',
    badgeText: 'text-amber-200',
    bannerBg: 'bg-amber-950/60',
    bannerBorder: 'border-amber-500/40',
    bannerText: 'text-amber-200',
  },
  test: {
    rowBg: 'bg-emerald-500/18',
    borderLeft: 'border-l-4 border-emerald-400',
    lineNoText: 'text-emerald-300 font-bold',
    badgeBg: 'bg-emerald-500/25 border-emerald-400/50',
    badgeText: 'text-emerald-200',
    bannerBg: 'bg-emerald-950/60',
    bannerBorder: 'border-emerald-500/40',
    bannerText: 'text-emerald-200',
  },
  default: {
    rowBg: 'bg-[#F2C46A]/20',
    borderLeft: 'border-l-4 border-[#F2C46A]',
    lineNoText: 'text-[#F2C46A] font-bold',
    badgeBg: 'bg-[#F2C46A]/25 border-[#F2C46A]/50',
    badgeText: 'text-[#F2C46A]',
    bannerBg: 'bg-[#38322E]',
    bannerBorder: 'border-[#AEAC78]/40',
    bannerText: 'text-[#FCF0DA]',
  },
};

const PYTHON_KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'import', 'from',
  'as', 'class', 'try', 'except', 'finally', 'raise', 'with', 'pass', 'break',
  'continue', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'lambda', 'yield',
]);

const PYTHON_BUILTINS = new Set([
  'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'List', 'Dict',
  'Set', 'Tuple', 'Optional', 'Any', 'len', 'range', 'enumerate', 'min', 'max',
  'sum', 'sorted', 'abs', 'print', 'isinstance', 'ValueError', 'TypeError', 'KeyError',
]);

const TOKEN_REGEX =
  /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/gm;

function renderPythonLine(line: string): React.ReactNode {
  if (!line) return ' ';
  const trimmed = line.trimStart();
  if (trimmed.startsWith('#')) {
    return <span className="text-[#AEAC78] italic">{line}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(line)) !== null) {
    if (match.index > lastIdx) {
      parts.push(line.slice(lastIdx, match.index));
    }
    const token = match[0];
    const key = `${match.index}-${token.length}`;
    if (token.startsWith('#')) {
      parts.push(
        <span key={key} className="text-[#AEAC78] italic">
          {token}
        </span>
      );
    } else if (token.startsWith('"') || token.startsWith("'")) {
      parts.push(
        <span key={key} className="text-[#6EE7B7]">
          {token}
        </span>
      );
    } else if (PYTHON_KEYWORDS.has(token)) {
      parts.push(
        <span key={key} className="text-[#F2C46A] font-semibold">
          {token}
        </span>
      );
    } else if (PYTHON_BUILTINS.has(token)) {
      parts.push(
        <span key={key} className="text-[#93C5FD]">
          {token}
        </span>
      );
    } else if (/^\d/.test(token)) {
      parts.push(
        <span key={key} className="text-[#C4B5FD]">
          {token}
        </span>
      );
    } else {
      parts.push(token);
    }
    lastIdx = TOKEN_REGEX.lastIndex;
  }

  if (lastIdx < line.length) {
    parts.push(line.slice(lastIdx));
  }
  return parts;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  filename,
  highlightedLines = [],
  lineHighlights = [],
  activeHighlightSummary = null,
  onClearHighlight,
}) => {
  const [copied, setCopied] = useState(false);
  const [pulsingLines, setPulsingLines] = useState<Set<number>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const lines = code.split('\n');

  const highlightMap = useMemo(() => {
    const map = new Map<number, LineHighlight>();
    for (const lineNo of highlightedLines) {
      map.set(lineNo, { line: lineNo, kind: 'default' });
    }
    for (const item of lineHighlights) {
      map.set(item.line, item);
    }
    return map;
  }, [highlightedLines, lineHighlights]);

  const scrollToLine = (targetLine: number) => {
    const rowEl = lineRowRefs.current[targetLine];
    const containerEl = scrollContainerRef.current;
    if (rowEl && containerEl) {
      const rowTop = rowEl.offsetTop;
      const targetScroll = Math.max(0, rowTop - containerEl.clientHeight / 3);
      containerEl.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
    setPulsingLines(new Set([targetLine]));
  };

  useEffect(() => {
    if (highlightMap.size === 0) {
      setPulsingLines(new Set());
      return;
    }
    const keys = Array.from(highlightMap.keys());
    const firstLine = Math.min(...keys);
    const rowEl = lineRowRefs.current[firstLine];
    const containerEl = scrollContainerRef.current;
    if (rowEl && containerEl) {
      const rowTop = rowEl.offsetTop;
      const targetScroll = Math.max(0, rowTop - containerEl.clientHeight / 3);
      containerEl.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
    setPulsingLines(new Set(keys));
    const timer = window.setTimeout(() => {
      setPulsingLines(new Set());
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [highlightMap]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bannerStyle = activeHighlightSummary
    ? HIGHLIGHT_STYLES[activeHighlightSummary.kind]
    : null;

  return (
    <div className="bg-[#241F1C] text-[#FCF0DA] rounded-2xl border border-[#AEAC78]/35 overflow-hidden shadow-sm flex flex-col h-full">
      {/* Header Bar */}
      <div className="bg-[#312B27] px-4 py-2.5 border-b border-[#AEAC78]/25 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center space-x-2 text-[#FCF0DA] font-mono min-w-0">
          <div className="flex items-center space-x-1.5 mr-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#F2C46A]/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70 inline-block" />
          </div>
          <FileCode className="w-4 h-4 text-[#F2C46A] shrink-0" />
          <span className="font-semibold truncate">{filename}</span>
          <span className="text-[#AEAC78] shrink-0">({lines.length} lines)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-[#FCF0DA] hover:text-[#F2C46A] bg-[#241F1C] hover:bg-[#38322E] px-2.5 py-1 rounded-lg border border-[#AEAC78]/30 transition-colors cursor-pointer shrink-0"
          title="Copy source code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Active Markpen Highlight Legend Banner */}
      {activeHighlightSummary && bannerStyle && highlightMap.size > 0 && (
        <div
          className={`px-4 py-1.5 border-b ${bannerStyle.bannerBg} ${bannerStyle.bannerBorder} ${bannerStyle.bannerText} flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0 transition-all`}
        >
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <Highlighter className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold truncate">{activeHighlightSummary.title}</span>
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from(highlightMap.keys())
                .sort((a, b) => a - b)
                .slice(0, 8)
                .map((ln) => (
                  <button
                    key={ln}
                    type="button"
                    onClick={() => scrollToLine(ln)}
                    className="px-1.5 py-0.5 rounded bg-black/25 hover:bg-black/45 font-mono text-[10px] font-bold transition-colors cursor-pointer"
                    title={`Jump to line ${ln}`}
                  >
                    L{ln}
                  </button>
                ))}
              {highlightMap.size > 8 && (
                <span className="font-mono text-[10px] opacity-80">
                  +{highlightMap.size - 8} more
                </span>
              )}
            </div>
          </div>
          {onClearHighlight && (
            <button
              type="button"
              onClick={onClearHighlight}
              className="flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-black/25 hover:bg-black/40 transition-colors cursor-pointer shrink-0 ml-2"
              title="Clear code highlight"
            >
              <X className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}

      {/* Code Lines Table */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto font-mono text-xs py-3 px-2 leading-relaxed flex-1"
      >
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNo = idx + 1;
              const highlight = highlightMap.get(lineNo);
              const style = highlight ? HIGHLIGHT_STYLES[highlight.kind] : null;
              const isPulsing = pulsingLines.has(lineNo);

              return (
                <tr
                  key={idx}
                  ref={(el) => {
                    lineRowRefs.current[lineNo] = el;
                  }}
                  className={`transition-colors duration-150 ${
                    style
                      ? `${style.rowBg} ${style.borderLeft} ${isPulsing ? 'animate-pulse ring-1 ring-inset ring-[#F2C46A]/80' : ''}`
                      : 'hover:bg-[#312B27]/70 border-l-4 border-transparent'
                  }`}
                >
                  <td
                    className={`pl-2 pr-4 text-right select-none w-11 align-top py-0.5 ${
                      style ? style.lineNoText : 'text-[#AEAC78]/70'
                    }`}
                  >
                    {lineNo}
                  </td>
                  <td className="text-[#FCF0DA] whitespace-pre font-mono py-0.5 pr-3">
                    <div className="flex items-center justify-between gap-3">
                      <span>{renderPythonLine(line)}</span>
                      {highlight?.label && style && (
                        <span
                          className={`text-[10px] font-sans font-bold px-2 py-0.2 rounded-full border ${style.badgeBg} ${style.badgeText} select-none shrink-0`}
                        >
                          {highlight.label}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
