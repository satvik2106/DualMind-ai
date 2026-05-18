'use client';

import React, { memo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

interface StreamedMarkdownProps {
  content: string;
  isStreaming: boolean;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function StreamedMarkdown({ content, isStreaming }: StreamedMarkdownProps) {
  if (!content) {
    return isStreaming ? (
      <div className="flex items-center gap-2 py-2">
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-xs text-foreground-muted font-mono">Thinking...</span>
      </div>
    ) : null;
  }

  return (
    <div className="prose dark:prose-invert prose-sm max-w-none
      prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight
      prose-h1:text-xl prose-h1:mt-6 prose-h1:mb-3
      prose-h2:text-lg prose-h2:mt-5 prose-h2:mb-2
      prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2
      prose-p:text-foreground-secondary prose-p:leading-7 prose-p:my-2
      prose-li:text-foreground-secondary prose-li:leading-7
      prose-strong:text-foreground prose-strong:font-semibold
      prose-a:text-accent-cyan prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-accent-cyan/40 prose-blockquote:bg-glass-overlay prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
      prose-table:border-collapse
      prose-th:bg-glass-overlay prose-th:border prose-th:border-border-glass prose-th:px-3 prose-th:py-2 prose-th:text-xs prose-th:font-semibold prose-th:text-foreground
      prose-td:border prose-td:border-border-glass prose-td:px-3 prose-td:py-2 prose-td:text-sm
      prose-hr:border-border-glass
      prose-pre:p-0 prose-pre:bg-transparent
    ">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            
            return !inline && match ? (
              <div className="rounded-xl overflow-hidden my-4 border border-[#30363d] shadow-lg group/code bg-[#0d1117]">
                <div className="bg-[#161b22] px-4 py-2.5 text-xs text-gray-400 font-mono border-b border-[#30363d] flex justify-between items-center">
                  <span className="uppercase tracking-wider text-[10px] font-bold text-gray-500">{match[1]}</span>
                  <CopyButton text={codeString} />
                </div>
                <SyntaxHighlighter
                  {...(props as Record<string, unknown>)}
                  style={vscDarkPlus as Record<string, React.CSSProperties>}
                  language={match[1]}
                  PreTag="div"
                  className="!m-0 !bg-[#0d1117] !text-sm !leading-6"
                  showLineNumbers={codeString.split('\n').length > 3}
                  lineNumberStyle={{ color: '#3d4451', fontSize: '11px', paddingRight: '16px' }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code {...props} className={`${className || ''} bg-glass-overlay px-1.5 py-0.5 rounded-md text-accent-cyan font-mono text-[13px] border border-border-glass`}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-5 ml-0.5 bg-accent-cyan animate-pulse align-middle rounded-sm shadow-[0_0_8px_rgba(0,229,255,0.4)]" />
      )}
    </div>
  );
}

export default memo(StreamedMarkdown);
