import React, { useState, useEffect } from 'react';
import { Columns, RefreshCw } from 'lucide-react';
import { DiffInspector } from '../components/DiffInspector';
import { api } from '../services/api';
import { Assignment, SimilarityPairDetail, SimilarityPairItem } from '../types';

interface IntegrityMatrixPageProps {
  assignment: Assignment;
}

export const IntegrityMatrixPage: React.FC<IntegrityMatrixPageProps> = ({ assignment }) => {
  const [pairs, setPairs] = useState<SimilarityPairItem[]>([]);
  const [threshold, setThreshold] = useState<number>(0.40);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedPairDetail, setSelectedPairDetail] = useState<SimilarityPairDetail | null>(null);
  const [isLoadingPair, setIsLoadingPair] = useState<boolean>(false);

  useEffect(() => {
    loadMatrix();
  }, [assignment.id, threshold]);

  const loadMatrix = async () => {
    try {
      const data = await api.getSimilarityMatrix(assignment.id, threshold);
      setPairs(data.flagged_pairs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    try {
      await api.runSimilarity(assignment.id, threshold);
      await loadMatrix();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpenDiff = async (pairId: string) => {
    setIsLoadingPair(true);
    try {
      const detail = await api.getSimilarityPairDetail(pairId);
      setSelectedPairDetail(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingPair(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white border border-[#E2E8F0] rounded p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-slate-900">Academic Integrity & Similarity Matrix</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-mono font-medium border border-amber-200">
              Winnowing Token Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Detects token n-gram matches, identifier renaming, and code block permutations across student submissions.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 font-medium">Similarity Threshold:</span>
            <input
              type="range"
              min="0.20"
              max="0.90"
              step="0.05"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-28 accent-primary"
            />
            <span className="font-mono font-bold text-slate-800 w-10">
              {Math.round(threshold * 100)}%
            </span>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={isRunning}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-primary text-white rounded text-xs font-medium hover:bg-primary-700 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Analyzing...' : 'Recompute Matrix'}</span>
          </button>
        </div>
      </div>

      {/* Similarity Pairs List */}
      <div className="bg-white border border-[#E2E8F0] rounded shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E2E8F0] bg-slate-50/70 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700">Flagged Similarity Pairs</span>
          <span className="text-slate-400 font-mono">{pairs.length} pair(s) at or above {Math.round(threshold * 100)}%</span>
        </div>

        <div className="divide-y divide-slate-100">
          {pairs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 font-mono text-xs">
              No submission pairs match or exceed the {Math.round(threshold * 100)}% similarity threshold.
            </div>
          ) : (
            pairs.map((p) => {
              const pct = (p.similarity_score * 100).toFixed(1);
              const isHigh = p.similarity_score >= 0.70;

              return (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-6">
                    {/* Similarity Score Pill */}
                    <div className={`px-3 py-1.5 rounded text-xs font-mono font-bold border text-center min-w-[70px] ${
                      isHigh
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {pct}%
                    </div>

                    {/* Student A & B */}
                    <div className="flex items-center space-x-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-800">{p.student_a_name}</div>
                        <div className="font-mono text-slate-500 text-[11px]">{p.student_a_identifier}</div>
                      </div>

                      <span className="text-slate-300 font-bold">vs</span>

                      <div>
                        <div className="font-semibold text-slate-800">{p.student_b_name}</div>
                        <div className="font-mono text-slate-500 text-[11px]">{p.student_b_identifier}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {p.matched_spans.length} matched block(s)
                    </span>

                    <button
                      onClick={() => handleOpenDiff(p.id)}
                      disabled={isLoadingPair}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
                    >
                      <Columns className="w-3.5 h-3.5 text-primary" />
                      <span>Inspect Diff</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Side-by-Side Diff Inspector Modal */}
      {selectedPairDetail && (
        <DiffInspector
          pairDetail={selectedPairDetail}
          onClose={() => setSelectedPairDetail(null)}
        />
      )}
    </div>
  );
};
