'use client';
import { CheckIcon, CopyIcon } from 'lucide-react';
import type { ComponentProps, HTMLAttributes, ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type CodeBlockContextType = {
  code: string;
};

const CodeBlockContext = createContext<CodeBlockContextType>({
  code: '',
});

const PRETTY_LANGUAGE: Record<string, string> = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  typescript: 'TypeScript',
  py: 'Python',
  python: 'Python',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  md: 'Markdown',
  markdown: 'Markdown',
  html: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  java: 'Java',
  csharp: 'C#',
  cs: 'C#',
  cpp: 'C++',
  c: 'C',
  swift: 'Swift',
  kotlin: 'Kotlin',
};
const prettyLanguage = (lang: string) =>
  PRETTY_LANGUAGE[lang.toLowerCase()] ??
  (lang.slice(0, 1).toUpperCase() + lang.slice(1));

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string;
  language: string;
  showLineNumbers?: boolean;
  children?: ReactNode;
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => (
  <CodeBlockContext.Provider value={{ code }}>
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl border-4 border-[#252525] bg-[#252525] text-gray-100',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#252525] bg-[#161718]">
          <span className="font-semibold tracking-wide text-gray-200 text-lg">{prettyLanguage(language)}</span>
          {children ? <div className="flex items-center gap-2">{children}</div> : null}
        </div>
        <div className="relative">
          <SyntaxHighlighter
            language={language}
            style={oneLight}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#f1f5f9',
            }}
            showLineNumbers={showLineNumbers}
            lineNumberStyle={{
              color: '#6b7280',
              paddingRight: '1rem',
              minWidth: '2.5rem',
            }}
            codeTagProps={{
              className: 'font-mono text-md',
            }}
            className="dark:hidden overflow-hidden"
          >
            {code}
          </SyntaxHighlighter>
          <SyntaxHighlighter
            language={language}
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              background: 'transparent',
              color: '#f1f5f9',
            }}
            showLineNumbers={showLineNumbers}
            lineNumberStyle={{
              color: '#6b7280',
              paddingRight: '1rem',
              minWidth: '2.5rem',
            }}
            codeTagProps={{
              className: 'font-mono text-sm',
            }}
            className="hidden dark:block overflow-hidden"
          >
            {code}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  </CodeBlockContext.Provider>
);

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = async () => {
    if (typeof window === 'undefined' || !navigator.clipboard.writeText) {
      onError?.(new Error('Clipboard API not available'));
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      onCopy?.();
      setTimeout(() => setIsCopied(false), timeout);
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn('shrink-0   text-gray-300 border-gray-700', className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};
