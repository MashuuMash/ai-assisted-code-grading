import React, { useState } from 'react';
import { Check, Copy, FileCode } from 'lucide-react';

interface CodeViewerProps {
  code: string;
  filename: string;
  highlightedLines?: number[];
}

export const CodeViewer: React.FC<CodeViewerProps> = ({ code, filename, highlightedLines = [] }) => {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden shadow-md flex flex-col h-full">
      <div className="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-300 font-mono">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold">{filename}</span>
          <span className="text-slate-500">({lines.length} lines)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded transition-colors"
          title="Copy source code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      <div className="overflow-auto font-mono text-xs p-3 leading-relaxed flex-1">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNo = idx + 1;
              const isHighlighted = highlightedLines.includes(lineNo);
              return (
                <tr
                  key={idx}
                  className={`hover:bg-slate-800/50 ${
                    isHighlighted ? 'bg-amber-950/40 border-l-2 border-amber-400' : ''
                  }`}
                >
                  <td className="pr-4 text-right text-slate-600 select-none w-10 align-top">
                    {lineNo}
                  </td>
                  <td className="text-slate-200 whitespace-pre font-mono">
                    {line || ' '}
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
