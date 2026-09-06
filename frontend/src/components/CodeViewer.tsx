import React, { useState } from 'react';
import { AlertTriangle, Code, FileCode } from 'lucide-react';
import { QualityMetric, RuffViolation, SubmissionFile, TestDetail } from '../types';

interface CodeViewerProps {
  files: SubmissionFile[];
  qualityMetric?: QualityMetric;
  testDetails?: TestDetail[];
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ files, qualityMetric }) => {
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  if (!files || files.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-mono">
        <FileCode className="w-8 h-8 text-slate-300 mb-2" />
        <span>No submission files available</span>
      </div>
    );
  }

  const currentFile = files[activeFileIndex] || files[0];
  const lines = currentFile.file_content.split('\n');

  // Map Ruff violations by line number
  const ruffByLine = new Map<number, RuffViolation[]>();
  if (qualityMetric?.ruff_violations) {
    qualityMetric.ruff_violations.forEach((v) => {
      const line = v.location.row;
      const list = ruffByLine.get(line) || [];
      list.push(v);
      ruffByLine.set(line, list);
    });
  }

  return (
    <div className="flex flex-col h-full bg-white border border-[#E2E8F0] rounded shadow-sm overflow-hidden">
      {/* File Tabs Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-b border-[#E2E8F0] text-xs">
        <div className="flex items-center space-x-1 overflow-x-auto">
          {files.map((f, idx) => (
            <button
              key={f.id || idx}
              onClick={() => setActiveFileIndex(idx)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                activeFileIndex === idx
                  ? 'bg-white text-primary font-medium border border-slate-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-slate-400" />
              <span>{f.relative_path}</span>
            </button>
          ))}
        </div>

        <div className="text-[11px] text-slate-400 font-mono">
          {lines.length} lines | UTF-8
        </div>
      </div>

      {/* Code Area with Line Numbers and Annotations */}
      <div className="flex-1 overflow-auto font-mono text-xs leading-5 bg-[#FAFAFA]">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((lineText, idx) => {
              const lineNum = idx + 1;
              const ruffList = ruffByLine.get(lineNum);
              const hasIssues = Boolean(ruffList && ruffList.length > 0);

              return (
                <React.Fragment key={lineNum}>
                  <tr className={`hover:bg-slate-100/70 transition-colors ${hasIssues ? 'bg-amber-50/50' : ''}`}>
                    {/* Line number gutter */}
                    <td className="w-12 px-2 text-right select-none text-slate-400 bg-slate-50/80 border-r border-slate-200 font-mono text-[11px]">
                      {lineNum}
                    </td>

                    {/* Code line content */}
                    <td className="px-3 py-0.5 whitespace-pre font-mono text-slate-800">
                      {lineText || ' '}
                    </td>
                  </tr>

                  {/* Inline Ruff Lint Annotations */}
                  {ruffList && ruffList.map((v, vIdx) => (
                    <tr key={`ann-${lineNum}-${vIdx}`} className="bg-amber-50 border-y border-amber-100/80 text-[11px]">
                      <td className="w-12 bg-amber-100/60 text-amber-700 text-center select-none font-semibold">
                        !
                      </td>
                      <td className="px-3 py-1 text-amber-900 font-sans flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="font-mono font-medium text-amber-800">[{v.code}]</span>
                        <span>{v.message}</span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
