import React, { useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  EyeOff,
  FileSearch,
  Highlighter,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { SubmissionEvidence } from '../types';

interface EvidenceInspectorProps {
  evidence: SubmissionEvidence[];
  activeCategory?: string;
  onCategoryChange?: (category: string) => void;
  selectedEvidenceId?: string | null;
  onSelectEvidence?: (item: SubmissionEvidence | null) => void;
  onSelectLine?: (line: number) => void;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({
  evidence,
  activeCategory,
  onCategoryChange,
  selectedEvidenceId = null,
  onSelectEvidence,
  onSelectLine,
}) => {
  const [internalCategory, setInternalCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const selectedCategory = activeCategory !== undefined ? activeCategory : internalCategory;

  const handleSelectCategory = (cat: string) => {
    setInternalCategory(cat);
    if (onCategoryChange) {
      onCategoryChange(cat);
    }
    if (onSelectEvidence) {
      onSelectEvidence(null);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const testEvidence = evidence.filter((e) => e.source === 'pytest');
  const ruffEvidence = evidence.filter((e) => e.source === 'ruff');
  const astEvidence = evidence.filter((e) => e.source === 'ast');
  const jplagEvidence = evidence.filter((e) => e.source === 'jplag');
  const codebertEvidence = evidence.filter((e) => e.source === 'codebert');

  const filteredEvidence =
    selectedCategory === 'all'
      ? evidence
      : evidence.filter((e) => e.category === selectedCategory || e.source === selectedCategory);

  return (
    <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-2xl border border-[#AEAC78]/35 dark:border-[#AEAC78]/25 shadow-sm flex flex-col h-full overflow-hidden text-[#4C4541] dark:text-[#FCF0DA]">
      {/* Header with category tabs */}
      <div className="p-3.5 border-b border-[#AEAC78]/25 dark:border-[#AEAC78]/20 bg-[#FCF0DA]/35 dark:bg-[#2C2623]/60 shrink-0">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <FileSearch className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <h3 className="text-xs font-bold text-[#4C4541] dark:text-[#FCF0DA] uppercase tracking-wider">
              Evidence Engine Records
            </h3>
            <span className="text-[11px] bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 px-2 py-0.5 rounded-full font-semibold font-mono">
              {evidence.length}
            </span>
          </div>
          <span className="text-[10px] text-[#6B625B] dark:text-[#AEAC78] flex items-center gap-1">
            <Highlighter className="w-3 h-3 text-[#F2C46A]" />
            <span>Click tab or card to mark code</span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleSelectCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
            }`}
          >
            All ({evidence.length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectCategory('pytest')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
              selectedCategory === 'pytest'
                ? 'bg-[#2E4324] dark:bg-[#AEAC78] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#AEAC78]" />
            <span>Tests ({testEvidence.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectCategory('ruff')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
              selectedCategory === 'ruff'
                ? 'bg-[#6B4307] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-[#F2C46A]" />
            <span>Ruff Linter ({ruffEvidence.length})</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelectCategory('ast')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
              selectedCategory === 'ast'
                ? 'bg-[#4C4541] dark:bg-[#AEAC78] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[#AEAC78]" />
            <span>Complexity ({astEvidence.length})</span>
          </button>
          {jplagEvidence.length > 0 && (
            <button
              type="button"
              onClick={() => handleSelectCategory('jplag')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                selectedCategory === 'jplag'
                  ? 'bg-rose-600 dark:bg-rose-500 text-white shadow-xs'
                  : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-rose-400/50 hover:bg-rose-500/10'
              }`}
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${selectedCategory === 'jplag' ? 'text-white' : 'text-rose-500'}`} />
              <span>Similarity ({jplagEvidence.length})</span>
            </button>
          )}
          {codebertEvidence.length > 0 && (
            <button
              type="button"
              onClick={() => handleSelectCategory('codebert')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                selectedCategory === 'codebert'
                  ? 'bg-violet-700 dark:bg-violet-500 text-white shadow-xs'
                  : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-violet-400/50 hover:bg-violet-500/10'
              }`}
            >
              <Bot className={`w-3.5 h-3.5 ${selectedCategory === 'codebert' ? 'text-white' : 'text-violet-500 dark:text-violet-300'}`} />
              <span>AI Style Signal ({codebertEvidence.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Evidence items list */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {filteredEvidence.length === 0 ? (
          <div className="text-center py-8 text-[#4C4541]/70 dark:text-[#FCF0DA]/70 text-xs">
            No evidence records found for this category.
          </div>
        ) : (
          filteredEvidence.map((item) => {
            const isExpanded = !!expandedItems[item.id];
            const isPassed = item.rule_code === 'TEST_PASSED';
            const isHiddenTest = item.raw_data?.is_hidden;
            const isSelected = selectedEvidenceId === item.id;

            const cardColorClass =
              item.source === 'jplag'
                ? 'border-rose-400/60 dark:border-rose-500/50 bg-rose-500/10 text-[#4C4541] dark:text-[#FCF0DA]'
                : item.source === 'codebert'
                ? 'border-violet-400/60 dark:border-violet-500/50 bg-violet-500/10 text-[#4C4541] dark:text-[#FCF0DA]'
                : isPassed
                ? 'border-[#AEAC78]/60 bg-[#AEAC78]/12 text-[#4C4541] dark:text-[#FCF0DA]'
                : item.severity === 'error'
                ? 'border-rose-400 dark:border-rose-700 bg-rose-500/10 text-[#4C4541] dark:text-[#FCF0DA]'
                : item.severity === 'warning'
                ? 'border-[#F2C46A]/80 bg-[#F2C46A]/15 text-[#4C4541] dark:text-[#FCF0DA]'
                : 'border-[#AEAC78]/35 bg-[#FCF0DA]/25 dark:bg-[#2C2623]/40 text-[#4C4541] dark:text-[#FCF0DA]';

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (onSelectEvidence) {
                    onSelectEvidence(isSelected ? null : item);
                  }
                }}
                className={`rounded-xl border p-3 text-xs transition-all cursor-pointer hover:shadow-xs ${cardColorClass} ${
                  isSelected ? 'ring-2 ring-[#F2C46A] shadow-sm' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2.5 flex-1">
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#AEAC78] mt-0.5 shrink-0" />
                    ) : item.source === 'codebert' ? (
                      <Bot className="w-4 h-4 text-violet-600 dark:text-violet-300 mt-0.5 shrink-0" />
                    ) : item.source === 'jplag' ? (
                      <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    ) : item.severity === 'error' ? (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    ) : item.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-[#F2C46A] mt-0.5 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#AEAC78] mt-0.5 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] font-mono">
                          {item.rule_code}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-md bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40">
                          {item.source}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded-md bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40">
                          {item.category}
                        </span>
                        {isHiddenTest && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[#F2C46A]/20 text-[#6B4307] dark:text-[#F2C46A] border border-[#F2C46A]/40 flex items-center space-x-0.5">
                            <EyeOff className="w-3 h-3" />
                            <span>Hidden Test</span>
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-[#F2C46A] text-[#4C4541] flex items-center gap-0.5">
                            <Highlighter className="w-2.5 h-2.5" />
                            <span>Marked in code</span>
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[#4C4541] dark:text-[#FCF0DA] font-sans leading-relaxed">
                        {item.message}
                      </p>

                      {item.source === 'codebert' && item.metric_value != null && (
                        <div className="mt-2 p-2.5 rounded-lg bg-[#FFFDF9]/80 dark:bg-[#2C2623]/80 border border-violet-400/40 text-[#4C4541] dark:text-[#FCF0DA]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-[#4C4541] dark:text-[#FCF0DA]">
                              Experimental style score:
                            </span>
                            <span className="font-mono font-bold text-violet-700 dark:text-violet-300">
                              {Math.round(item.metric_value * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-[#FCF0DA] dark:bg-[#38322E] h-1.5 rounded-full overflow-hidden border border-violet-400/30">
                            <div
                              className="bg-violet-500 h-full rounded-full transition-all"
                              style={{ width: `${Math.round(item.metric_value * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-[10px] text-[#4C4541]/70 dark:text-[#FCF0DA]/70 italic">
                            Supporting research signal only. Manual instructor verification required.
                          </p>
                        </div>
                      )}

                      {item.location && (
                        <div className="mt-1.5 text-[11px] font-mono text-[#4C4541]/75 dark:text-[#FCF0DA]/75 flex items-center space-x-1">
                          <span>Location: {item.location}</span>
                          {onSelectLine && item.raw_data?.line_number && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectLine(item.raw_data!.line_number);
                              }}
                              className="text-[#AEAC78] dark:text-[#F2C46A] hover:underline ml-1 font-sans font-semibold cursor-pointer"
                            >
                              Jump to line
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {item.raw_data && (
                    <button
                      type="button"
                      onClick={(e) => toggleExpand(item.id, e)}
                      className="text-[#4C4541]/70 hover:text-[#4C4541] dark:text-[#FCF0DA]/70 dark:hover:text-[#FCF0DA] p-1 ml-2 cursor-pointer"
                      title="Toggle detailed trace"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Expanded technical trace */}
                {isExpanded && item.raw_data && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2.5 pt-2 border-t border-[#AEAC78]/30 font-mono text-[11px] bg-[#241F1C] text-[#FCF0DA] p-2.5 rounded-lg border border-[#4C4541] overflow-x-auto"
                  >
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(item.raw_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
