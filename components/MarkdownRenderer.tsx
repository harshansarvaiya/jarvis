import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Format inline tokens like **bold**, *italic*, `code`, and links.
 */
function renderInlineText(text: string): React.ReactNode[] {
  // Regex to match inline tokens: images (![...](...)), bold (**...**), italic (*...* or _..._), code (`...`), links ([...](...))
  const tokenRegex = /(!\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Markdown Images: ![alt](url)
    const imgMatch = part.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const [, altText, url] = imgMatch;
      return (
        <span key={index} className="block my-3 rounded-xl border border-cyan-500/40 bg-slate-950/90 p-2.5 shadow-[0_0_20px_rgba(0,229,255,0.15)] group relative overflow-hidden">
          <span className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-cyan-400 border-b border-cyan-500/20 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>🛡️ F.R.I.D.A.Y. VISUAL FRAME</span>
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-cyan-400 hover:text-cyan-200 transition-colors uppercase tracking-wider text-[9px] flex items-center gap-1"
            >
              <span>Download High-Res ↗</span>
            </a>
          </span>
          <span className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/60 min-h-[160px]">
            <img
              src={url}
              alt={altText || 'Generated Visual Asset'}
              className="w-full max-h-[520px] object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.01]"
              loading="lazy"
            />
          </span>
          {altText && (
            <span className="block mt-2 px-1 text-[11px] font-mono text-slate-400 italic">
              ↳ {altText}
            </span>
          )}
        </span>
      );
    }

    // Bold: **text** or __text__
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      const inner = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-cyan-200">
          {renderInlineText(inner)}
        </strong>
      );
    }

    // Inline Code: `code`
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1);
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-950/80 border border-cyan-500/20 text-cyan-300 font-mono text-[0.85em]"
        >
          {code}
        </code>
      );
    }

    // Markdown Links: [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, linkText, url] = linkMatch;
      return (
        <a
          key={index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-200 underline decoration-cyan-500/40 underline-offset-2 transition-colors"
        >
          {linkText}
        </a>
      );
    }

    // Italic: *text* or _text_
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      const inner = part.slice(1, -1);
      return (
        <em key={index} className="italic text-slate-300">
          {renderInlineText(inner)}
        </em>
      );
    }

    // Plain text with math / arrow cleanups
    const cleanedText = part
      .replace(/\\\$/g, '$')
      .replace(/\$\\rightarrow\$/g, '→')
      .replace(/\\rightarrow/g, '→')
      .replace(/->/g, '→');

    return <React.Fragment key={index}>{cleanedText}</React.Fragment>;
  });
}

/**
 * J.A.R.V.I.S. Cinematic HUD Markdown Parser & Renderer
 * Renders structured markdown into polished, executive UI elements.
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushCodeBlock = (key: string) => {
    if (codeBlockLines.length > 0) {
      elements.push(
        <div
          key={key}
          className="my-3 rounded-lg overflow-hidden border border-cyan-500/30 bg-slate-950/90 shadow-inner"
        >
          {codeBlockLang && (
            <div className="px-3 py-1 bg-slate-900/80 border-b border-cyan-500/20 text-[10px] font-mono text-cyan-400 uppercase tracking-wider flex justify-between items-center">
              <span>{codeBlockLang}</span>
              <span className="text-slate-500">TERMINAL OUTPUT</span>
            </div>
          )}
          <pre className="p-3 text-xs font-mono text-cyan-100/90 overflow-x-auto leading-relaxed">
            <code>{codeBlockLines.join('\n')}</code>
          </pre>
        </div>
      );
      codeBlockLines = [];
      codeBlockLang = '';
    }
  };

  const flushTable = (key: string) => {
    if (tableHeader.length > 0 || tableRows.length > 0) {
      elements.push(
        <div key={key} className="my-3 overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60 shadow-sm">
          <table className="w-full text-left text-xs border-collapse font-sans">
            {tableHeader.length > 0 && (
              <thead>
                <tr className="border-b border-cyan-500/20 bg-slate-900/80">
                  {tableHeader.map((headerText, idx) => (
                    <th key={idx} className="px-3 py-2 text-cyan-300 font-semibold tracking-wide">
                      {renderInlineText(headerText.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-slate-800/60 hover:bg-cyan-950/20 transition-colors last:border-b-0"
                >
                  {row.map((cellText, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-300">
                      {renderInlineText(cellText.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableHeader = [];
      tableRows = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // 1. Code Block Fence
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock(`code-block-${i}`);
        inCodeBlock = false;
      } else {
        if (inTable) {
          flushTable(`table-${i}`);
          inTable = false;
        }
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // 2. Table Row Processing
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      // Table separator row (e.g., |---|---|)
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) {
        continue;
      }

      const columns = trimmed
        .slice(1, -1)
        .split('|')
        .map((col) => col.trim());

      if (!inTable) {
        inTable = true;
        tableHeader = columns;
      } else {
        tableRows.push(columns);
      }
      continue;
    } else if (inTable) {
      flushTable(`table-${i}`);
      inTable = false;
    }

    // 3. Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<hr key={`hr-${i}`} className="my-3.5 border-slate-800/80" />);
      continue;
    }

    // 4. Headings
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, '');

      if (level === 1) {
        elements.push(
          <h1 key={`h1-${i}`} className="text-base font-bold text-cyan-100 tracking-wide mt-3.5 mb-1.5 flex items-center gap-2">
            <span className="w-1.5 h-3.5 bg-cyan-400 rounded-sm inline-block shadow-[0_0_8px_rgba(0,229,255,0.6)]" />
            <span>{renderInlineText(text)}</span>
          </h1>
        );
      } else if (level === 2) {
        elements.push(
          <h2 key={`h2-${i}`} className="text-sm font-semibold text-cyan-200 tracking-wide mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1 h-3 bg-cyan-500 rounded-sm inline-block" />
            <span>{renderInlineText(text)}</span>
          </h2>
        );
      } else {
        elements.push(
          <h3 key={`h3-${i}`} className="text-xs font-semibold text-cyan-300 mt-2.5 mb-1">
            {renderInlineText(text)}
          </h3>
        );
      }
      continue;
    }

    // 5. Unordered List Items
    if (/^[\*\-]\s+/.test(trimmed)) {
      const listContent = trimmed.replace(/^[\*\-]\s+/, '');
      elements.push(
        <div key={`ul-${i}`} className="flex items-start gap-2 my-1 pl-1 text-slate-200 leading-relaxed text-xs sm:text-sm">
          <span className="text-cyan-400 mt-1 select-none text-[8px]">◆</span>
          <div className="flex-1">{renderInlineText(listContent)}</div>
        </div>
      );
      continue;
    }

    // 6. Ordered List Items
    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      const [, num, itemContent] = orderedMatch;
      elements.push(
        <div key={`ol-${i}`} className="flex items-start gap-2 my-1 pl-1 text-slate-200 leading-relaxed text-xs sm:text-sm">
          <span className="font-mono text-cyan-400/90 font-semibold select-none text-xs min-w-[1.2rem]">{num}.</span>
          <div className="flex-1">{renderInlineText(itemContent)}</div>
        </div>
      );
      continue;
    }

    // 7. Blockquote
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="my-2 pl-3 py-1 border-l-2 border-cyan-500/50 bg-cyan-950/20 text-cyan-100/90 italic text-xs sm:text-sm rounded-r"
        >
          {renderInlineText(quoteContent)}
        </blockquote>
      );
      continue;
    }

    // 8. Empty lines
    if (trimmed === '') {
      elements.push(<div key={`empty-${i}`} className="h-1.5" />);
      continue;
    }

    // 8B. Standalone Markdown Image Block
    const standaloneImgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (standaloneImgMatch) {
      const [, altText, url] = standaloneImgMatch;
      elements.push(
        <div key={`img-block-${i}`} className="my-3 rounded-xl border border-cyan-500/40 bg-slate-950/90 p-2.5 shadow-[0_0_20px_rgba(0,229,255,0.15)] group relative overflow-hidden">
          <div className="flex items-center justify-between px-2 py-1 text-[10px] font-mono text-cyan-400 border-b border-cyan-500/20 mb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>🛡️ F.R.I.D.A.Y. VISUAL FRAME</span>
            </span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="text-cyan-400 hover:text-cyan-200 transition-colors uppercase tracking-wider text-[9px] flex items-center gap-1"
            >
              <span>Download High-Res ↗</span>
            </a>
          </div>
          <div className="relative rounded-lg overflow-hidden flex items-center justify-center bg-black/60 min-h-[160px]">
            <img
              src={url}
              alt={altText || 'Generated Visual Asset'}
              className="w-full max-h-[520px] object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.01]"
              loading="lazy"
            />
          </div>
          {altText && (
            <div className="mt-2 px-1 text-[11px] font-mono text-slate-400 italic">
              ↳ {altText}
            </div>
          )}
        </div>
      );
      continue;
    }

    // 9. Standard Paragraph
    elements.push(
      <p key={`p-${i}`} className="my-1 text-slate-200 leading-relaxed text-xs sm:text-sm">
        {renderInlineText(trimmed)}
      </p>
    );
  }

  // Flush any trailing code blocks or tables
  if (inCodeBlock) flushCodeBlock('trailing-code-block');
  if (inTable) flushTable('trailing-table');

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}
