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
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { SubmissionEvidence } from '../types';

interface EvidenceInspectorProps {
  evidence: SubmissionEvidence[];
  onSelectLine?: (line: number) => void;
}

export const EvidenceInspector: React.FC<EvidenceInspectorProps> = ({ evidence, onSelectLine }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
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
    <div className="bg-[#FFFDF9] dark:bg-[#38322E] rounded-xl border border-[#AEAC78]/40 dark:border-[#AEAC78]/30 shadow-xs flex flex-col h-full overflow-hidden text-[#4C4541] dark:text-[#FCF0DA]">
      {/* Header with category tabs */}
      <div className="p-3.5 border-b border-[#AEAC78]/30 dark:border-[#AEAC78]/20 bg-[#FCF0DA]/40 dark:bg-[#2C2623]/60">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FileSearch className="w-4 h-4 text-[#AEAC78] dark:text-[#F2C46A]" />
            <h3 className="text-xs font-bold text-[#4C4541] dark:text-[#FCF0DA] uppercase tracking-wider">
              Evidence Engine Records
            </h3>
            <span className="text-[11px] bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 px-2 py-0.5 rounded-full font-semibold font-mono">
              {evidence.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#4C4541] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
            }`}
          >
            All ({evidence.length})
          </button>
          <button
            onClick={() => setSelectedCategory('pytest')}
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
            onClick={() => setSelectedCategory('ruff')}
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
            onClick={() => setSelectedCategory('ast')}
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
              onClick={() => setSelectedCategory('jplag')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                selectedCategory === 'jplag'
                  ? 'bg-[#9E3A24] dark:bg-rose-400 text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                  : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Similarity ({jplagEvidence.length})</span>
            </button>
          )}
          {codebertEvidence.length > 0 && (
            <button
              onClick={() => setSelectedCategory('codebert')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                selectedCategory === 'codebert'
                  ? 'bg-[#5C3D75] dark:bg-[#F2C46A] text-[#FCF0DA] dark:text-[#4C4541] shadow-xs'
                : 'bg-[#FFFDF9] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40 hover:bg-[#FCF0DA]/50'
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-[#AEAC78]" />
              <span>AI Style Signal ({codebertEvidence.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Evidence items list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredEvidence.length === 0 ? (
          <div className="text-center py-8 text-[#4C4541]/70 dark:text-[#FCF0DA]/70 text-xs">
            No evidence records found for this category.
          </div>
        ) : (
          filteredEvidence.map((item) => {
            const isExpanded = !!expandedItems[item.id];
            const isPassed = item.rule_code === 'TEST_PASSED';
            const isHiddenTest = item.raw_data?.is_hidden;

            return (
              <div
                key={item.id}
                className={`rounded-lg border p-3 text-xs transition-all ${
                  isPassed
                    ? 'border-[#AEAC78] bg-[#AEAC78]/15 text-[#4C4541] dark:text-[#FCF0DA]'
                    : item.severity === 'error'
                    ? 'border-rose-400 dark:border-rose-700 bg-rose-500/10 text-[#4C4541] dark:text-[#FCF0DA]'
                    : item.severity === 'warning'
                    ? 'border-[#F2C46A] bg-[#F2C46A]/20 text-[#4C4541] dark:text-[#FCF0DA]'
                    : 'border-[#AEAC78]/40 bg-[#FCF0DA]/30 dark:bg-[#2C2623]/40 text-[#4C4541] dark:text-[#FCF0DA]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1">
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-[#AEAC78] mt-0.5 shrink-0" />
                    ) : item.source === 'codebert' ? (
                      <Bot className="w-4 h-4 text-[#AEAC78] mt-0.5 shrink-0" />
                    ) : item.severity === 'error' ? (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                    ) : item.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-[#F2C46A] mt-0.5 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[#AEAC78] mt-0.5 shrink-0" />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-bold text-[#4C4541] dark:text-[#FCF0DA] font-mono">
                          {item.rule_code}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40">
                          {item.source}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-[#FCF0DA] dark:bg-[#2C2623] text-[#4C4541] dark:text-[#FCF0DA] border border-[#AEAC78]/40">
                          {item.category}
                        </span>
                        {isHiddenTest && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-[#F2C46A]/20 text-[#6B4307] dark:text-[#F2C46A] border border-[#F2C46A]/40 flex items-center space-x-0.5">
                            <EyeOff className="w-3 h-3" />
                            <span>Hidden Test</span>
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-[#4C4541] dark:text-[#FCF0DA] font-sans leading-relaxed">
                        {item.message}
                      </p>

                      {item.source === 'codebert' && item.metric_value != null && (
                        <div className="mt-2 p-2 rounded bg-[#FCF0DA]/50 dark:bg-[#2C2623] border border-[#AEAC78]/40 text-[#4C4541] dark:text-[#FCF0DA]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-[#4C4541] dark:text-[#FCF0DA]">
                              Experimental style score:
                            </span>
                            <span className="font-mono font-bold text-[#4C4541] dark:text-[#F2C46A]">
                              {Math.round(item.metric_value * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-[#FCF0DA] dark:bg-[#38322E] h-1.5 rounded-full overflow-hidden border border-[#AEAC78]/30">
                            <div
                              className="bg-[#F2C46A] h-full rounded-full transition-all"
                              style={{ width: `${Math.round(item.metric_value * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-[10px] text-[#4C4541]/70 dark:text-[#FCF0DA]/70 italic">
                            Supporting research signal only. Manual instructor verification required.
                          </p>
                        </div>
                      )}

                      {item.location && (
                        <div className="mt-1 text-[11px] font-mono text-[#4C4541]/70 dark:text-[#FCF0DA]/70 flex items-center space-x-1">
                          <span>Location: {item.location}</span>
                          {onSelectLine && item.raw_data?.line_number && (
                            <button
                              onClick={() => onSelectLine(item.raw_data!.line_number)}
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
                      onClick={() => toggleExpand(item.id)}
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
                  <div className="mt-2.5 pt-2 border-t border-[#AEAC78]/30 font-mono text-[11px] bg-[#2C2623] text-[#FCF0DA] p-2.5 rounded-lg border border-[#4C4541] overflow-x-auto">
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
