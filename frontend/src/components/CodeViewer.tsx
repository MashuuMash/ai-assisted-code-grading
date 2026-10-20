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
    <div className="bg-[#2C2623] text-[#FCF0DA] rounded-xl border border-[#AEAC78]/40 overflow-hidden shadow-sm flex flex-col h-full">
      <div className="bg-[#38322E] px-4 py-2.5 border-b border-[#AEAC78]/30 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-[#FCF0DA] font-mono">
          <FileCode className="w-4 h-4 text-[#F2C46A]" />
          <span className="font-semibold">{filename}</span>
          <span className="text-[#AEAC78]">({lines.length} lines)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-1 text-[#FCF0DA] hover:text-[#F2C46A] bg-[#2C2623] hover:bg-[#38322E] px-2.5 py-1 rounded border border-[#AEAC78]/30 transition-colors"
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
                  className={`hover:bg-[#38322E]/60 ${
                    isHighlighted ? 'bg-[#F2C46A]/20 border-l-2 border-[#F2C46A]' : ''
                  }`}
                >
                  <td className="pr-4 text-right text-[#AEAC78]/80 select-none w-10 align-top">
                    {lineNo}
                  </td>
                  <td className="text-[#FCF0DA] whitespace-pre font-mono">
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
