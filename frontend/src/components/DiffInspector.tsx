import React from 'react';
import { Columns, Hash, X } from 'lucide-react';
import { SimilarityPairDetail } from '../types';

interface DiffInspectorProps {
  pairDetail: SimilarityPairDetail;
  onClose: () => void;
}

export const DiffInspector: React.FC<DiffInspectorProps> = ({ pairDetail, onClose }) => {
  const linesA = pairDetail.submission_a.code.split('\n');
  const linesB = pairDetail.submission_b.code.split('\n');

  // Set of matched line numbers for submission A and B
  const matchedLinesA = new Set<number>();
  const matchedLinesB = new Set<number>();

  pairDetail.matched_spans.forEach((span) => {
    for (let l = span.a_lines[0]; l <= span.a_lines[1]; l++) {
      matchedLinesA.add(l);
    }
    for (let l = span.b_lines[0]; l <= span.b_lines[1]; l++) {
      matchedLinesB.add(l);
    }
  });

  const simPct = (pairDetail.similarity_score * 100).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-slate-300 shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#E2E8F0] bg-slate-50">
          <div className="flex items-center space-x-3">
            <div className="p-1.5 bg-blue-50 border border-blue-200 rounded text-primary">
              <Columns className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-sm text-slate-800">Side-by-Side Diff Inspector</span>
                <span className={`text-xs px-2 py-0.5 rounded font-mono font-medium ${
                  pairDetail.similarity_score >= 0.70
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {simPct}% Similarity ({pairDetail.algorithm})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Matched token regions highlighted in light amber. Normalized identifiers and structural permutations reconciled.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dual Panels Header */}
        <div className="grid grid-cols-2 border-b border-[#E2E8F0] bg-white divide-x divide-slate-200 text-xs">
          {/* Submission A Info */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                {pairDetail.submission_a.student_name} ({pairDetail.submission_a.student_identifier})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {pairDetail.submission_a.submitted_at.substring(0, 19).replace('T', ' ')}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-slate-500 font-mono mt-0.5">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>SHA-256: {pairDetail.submission_a.raw_archive_hash.substring(0, 16)}...</span>
            </div>
          </div>

          {/* Submission B Info */}
          <div className="p-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">
                {pairDetail.submission_b.student_name} ({pairDetail.submission_b.student_identifier})
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {pairDetail.submission_b.submitted_at.substring(0, 19).replace('T', ' ')}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[11px] text-slate-500 font-mono mt-0.5">
              <Hash className="w-3 h-3 text-slate-400" />
              <span>SHA-256: {pairDetail.submission_b.raw_archive_hash.substring(0, 16)}...</span>
            </div>
          </div>
        </div>

        {/* Synchronized Code Diff Columns */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-200 overflow-hidden bg-[#FAFAFA]">
          {/* Left Column (A) */}
          <div className="overflow-auto font-mono text-xs leading-5">
            <table className="w-full border-collapse">
              <tbody>
                {linesA.map((text, idx) => {
                  const lineNum = idx + 1;
                  const isMatch = matchedLinesA.has(lineNum);
                  return (
                    <tr key={lineNum} className={isMatch ? 'bg-amber-100/70' : 'hover:bg-slate-100/50'}>
                      <td className="w-10 px-2 text-right select-none text-slate-400 bg-slate-50/80 border-r border-slate-200 text-[11px]">
                        {lineNum}
                      </td>
                      <td className="px-3 py-0.5 whitespace-pre text-slate-800">
                        {text || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right Column (B) */}
          <div className="overflow-auto font-mono text-xs leading-5">
            <table className="w-full border-collapse">
              <tbody>
                {linesB.map((text, idx) => {
                  const lineNum = idx + 1;
                  const isMatch = matchedLinesB.has(lineNum);
                  return (
                    <tr key={lineNum} className={isMatch ? 'bg-amber-100/70' : 'hover:bg-slate-100/50'}>
                      <td className="w-10 px-2 text-right select-none text-slate-400 bg-slate-50/80 border-r border-slate-200 text-[11px]">
                        {lineNum}
                      </td>
                      <td className="px-3 py-0.5 whitespace-pre text-slate-800">
                        {text || ' '}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-slate-600">
          <span>
            {pairDetail.matched_spans.length} matched code block(s) detected via winnowed fingerprinting
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
