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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header with category tabs */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <FileSearch className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Evidence Engine Records
            </h3>
            <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-semibold font-mono">
              {evidence.length}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            All ({evidence.length})
          </button>
          <button
            onClick={() => setSelectedCategory('pytest')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center space-x-1 ${
              selectedCategory === 'pytest'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Tests ({testEvidence.length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('ruff')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center space-x-1 ${
              selectedCategory === 'ruff'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Ruff Linter ({ruffEvidence.length})</span>
          </button>
          <button
            onClick={() => setSelectedCategory('ast')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center space-x-1 ${
              selectedCategory === 'ast'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Complexity ({astEvidence.length})</span>
          </button>
          {jplagEvidence.length > 0 && (
            <button
              onClick={() => setSelectedCategory('jplag')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center space-x-1 ${
                selectedCategory === 'jplag'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Similarity ({jplagEvidence.length})</span>
            </button>
          )}
          {codebertEvidence.length > 0 && (
            <button
              onClick={() => setSelectedCategory('codebert')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center space-x-1 ${
                selectedCategory === 'codebert'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-50'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI CodeBERT ({codebertEvidence.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Evidence items list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filteredEvidence.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
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
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : item.severity === 'error'
                    ? 'border-rose-200 bg-rose-50/40'
                    : item.severity === 'warning'
                    ? 'border-amber-200 bg-amber-50/40'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-2 flex-1">
                    {isPassed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    ) : item.source === 'codebert' ? (
                      <Bot className="w-4 h-4 text-purple-600 mt-0.5 shrink-0" />
                    ) : item.severity === 'error' ? (
                      <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                    ) : item.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                    )}

                    <div className="flex-1">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-bold text-slate-800 font-mono">
                          {item.rule_code}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-200/80 text-slate-700">
                          {item.source}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.category}
                        </span>
                        {isHiddenTest && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 border border-purple-200 flex items-center space-x-0.5">
                            <EyeOff className="w-3 h-3" />
                            <span>Hidden Test</span>
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-slate-700 font-sans leading-relaxed">
                        {item.message}
                      </p>

                      {item.source === 'codebert' && item.metric_value != null && (
                        <div className="mt-2 p-2 rounded bg-purple-50 border border-purple-200">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-purple-900">
                              Estimated AI Probability:
                            </span>
                            <span className="font-mono font-bold text-purple-700">
                              {Math.round(item.metric_value * 100)}%
                            </span>
                          </div>
                          <div className="w-full bg-purple-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-purple-600 h-full rounded-full transition-all"
                              style={{ width: `${Math.round(item.metric_value * 100)}%` }}
                            />
                          </div>
                          <p className="mt-1.5 text-[10px] text-purple-700 italic">
                            Supporting research signal only. Manual instructor verification required.
                          </p>
                        </div>
                      )}

                      {item.location && (
                        <div className="mt-1 text-[11px] font-mono text-slate-500 flex items-center space-x-1">
                          <span>Location: {item.location}</span>
                          {onSelectLine && item.raw_data?.line_number && (
                            <button
                              onClick={() => onSelectLine(item.raw_data!.line_number)}
                              className="text-indigo-600 hover:underline ml-1 font-sans"
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
                      className="text-slate-400 hover:text-slate-700 p-1 ml-2"
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
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 font-mono text-[11px] bg-slate-900 text-slate-200 p-2.5 rounded-lg overflow-x-auto">
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
