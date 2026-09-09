import React from 'react';

interface SimpleMarkdownProps {
  content: string;
}

export const SimpleMarkdown: React.FC<SimpleMarkdownProps> = ({ content }) => {
  if (!content) return null;

  const lines = content.split('\n');

  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentText = text;
    let keyIdx = 0;

    while (currentText.length > 0) {
      const boldStart = currentText.indexOf('**');
      if (boldStart !== -1) {
        if (boldStart > 0) {
          parts.push(currentText.substring(0, boldStart));
        }
        const boldEnd = currentText.indexOf('**', boldStart + 2);
        if (boldEnd !== -1) {
          const boldVal = currentText.substring(boldStart + 2, boldEnd);
          parts.push(<strong key={`b-${keyIdx++}`} className="font-black text-white">{boldVal}</strong>);
          currentText = currentText.substring(boldEnd + 2);
        } else {
          parts.push(currentText.substring(boldStart));
          break;
        }
      } else {
        parts.push(currentText);
        break;
      }
    }
    return parts;
  };

  const renderLine = (line: string, index: number) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return <div key={index} className="h-2" />;
    }

    // Headers
    if (trimmed.startsWith('#### ')) {
      return (
        <h5 key={index} className="text-[10px] font-black text-white mt-4 mb-1 uppercase tracking-wider">
          {parseInline(trimmed.substring(5))}
        </h5>
      );
    }
    if (trimmed.startsWith('### ')) {
      return (
        <h4 key={index} className="text-xs font-black text-violet-400 mt-4 mb-2 uppercase tracking-wide">
          {parseInline(trimmed.substring(4))}
        </h4>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h3 key={index} className="text-sm font-black text-white mt-5 mb-2 uppercase tracking-tight">
          {parseInline(trimmed.substring(3))}
        </h3>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h2 key={index} className="text-base font-black text-white mt-6 mb-3 uppercase">
          {parseInline(trimmed.substring(2))}
        </h2>
      );
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return (
        <div key={index} className="flex items-start gap-2 ml-4 my-1">
          <span className="text-violet-400 text-xs select-none">•</span>
          <span className="text-xs text-slate-300 font-medium leading-relaxed">
            {parseInline(trimmed.substring(2))}
          </span>
        </div>
      );
    }

    // Numbered lists
    const numberedMatch = trimmed.match(/^(\d+)\.\s(.*)/);
    if (numberedMatch) {
      return (
        <div key={index} className="flex items-start gap-2 ml-4 my-1">
          <span className="text-violet-400 text-xs font-bold font-mono">{numberedMatch[1]}.</span>
          <span className="text-xs text-slate-300 font-medium leading-relaxed">
            {parseInline(numberedMatch[2])}
          </span>
        </div>
      );
    }

    // Blockquote or custom styling for highlights
    if (trimmed.startsWith('> ')) {
      return (
        <div key={index} className="border-l-4 border-violet-500 pl-4 py-1 my-2 bg-slate-800/40 rounded-r-xl">
          <p className="text-xs text-slate-300 italic font-medium leading-relaxed">
            {parseInline(trimmed.substring(2))}
          </p>
        </div>
      );
    }

    // Default paragraph
    return (
      <p key={index} className="text-xs text-slate-300 leading-relaxed font-medium mb-2">
        {parseInline(line)}
      </p>
    );
  };

  return <div className="space-y-1">{lines.map((line, idx) => renderLine(line, idx))}</div>;
};
