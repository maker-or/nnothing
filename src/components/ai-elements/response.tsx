'use client';
import { CodeBlock, CodeBlockCopyButton } from './code-block';
import type { ComponentProps, HTMLAttributes } from 'react';
import { memo } from 'react';
import ReactMarkdown, { type Options } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';
import hardenReactMarkdown from 'harden-react-markdown';
import MermaidDiagram from '../MermaidDiagram';

/**
 * Parses markdown text and removes incomplete tokens to prevent partial rendering
 * of links, images, bold, and italic formatting during streaming.
 */
function parseIncompleteMarkdown(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let result = text;

  // Handle incomplete links and images
  // Pattern: [...] or ![...] where the closing ] is missing
  const linkImagePattern = /(!?\[)([^\]]*?)$/;
  const linkMatch = result.match(linkImagePattern);
  if (linkMatch) {
    // If we have an unterminated [ or ![, remove it and everything after
    const startIndex = result.lastIndexOf(linkMatch[1]);
    result = result.substring(0, startIndex);
  }

  // Handle incomplete bold formatting (**)
  const boldPattern = /(\*\*)([^*]*?)$/;
  const boldMatch = result.match(boldPattern);
  if (boldMatch) {
    // Count the number of ** in the entire string
    const asteriskPairs = (result.match(/\*\*/g) || []).length;
    // If odd number of **, we have an incomplete bold - complete it
    if (asteriskPairs % 2 === 1) {
      result = `${result}**`;
    }
  }

  // Handle incomplete italic formatting (__)
  const italicPattern = /(__)([^_]*?)$/;
  const italicMatch = result.match(italicPattern);
  if (italicMatch) {
    // Count the number of __ in the entire string
    const underscorePairs = (result.match(/__/g) || []).length;
    // If odd number of __, we have an incomplete italic - complete it
    if (underscorePairs % 2 === 1) {
      result = `${result}__`;
    }
  }

  // Handle incomplete single asterisk italic (*)
  const singleAsteriskPattern = /(\*)([^*]*?)$/;
  const singleAsteriskMatch = result.match(singleAsteriskPattern);
  if (singleAsteriskMatch) {
    // Count single asterisks that aren't part of ** pairs
    const singleAsterisks = result.split('').reduce((acc, char, index) => {
      if (char === '*') {
        // Check if it's part of a ** pair
        const prevChar = result[index - 1];
        const nextChar = result[index + 1];
        if (prevChar !== '*' && nextChar !== '*') {
          return acc + 1;
        }
      }
      return acc;
    }, 0);
    // If odd number of single *, we have an incomplete italic - complete it
    if (singleAsterisks % 2 === 1) {
      result = `${result}*`;
    }
  }

  // Handle incomplete single underscore italic (_)
  const singleUnderscorePattern = /(_)([^_]*?)$/;
  const singleUnderscoreMatch = result.match(singleUnderscorePattern);
  if (singleUnderscoreMatch) {
    // Count single underscores that aren't part of __ pairs
    const singleUnderscores = result.split('').reduce((acc, char, index) => {
      if (char === '_') {
        // Check if it's part of a __ pair
        const prevChar = result[index - 1];
        const nextChar = result[index + 1];
        if (prevChar !== '_' && nextChar !== '_') {
          return acc + 1;
        }
      }
      return acc;
    }, 0);
    // If odd number of single _, we have an incomplete italic - complete it
    if (singleUnderscores % 2 === 1) {
      result = `${result}_`;
    }
  }

  // Handle incomplete inline code blocks (`) - but avoid code blocks (```
  const inlineCodePattern = /(`)([^`]*?)$/;
  const inlineCodeMatch = result.match(inlineCodePattern);
  if (inlineCodeMatch) {
    // Check if we're dealing with a code block (triple backticks)
    const allTripleBackticks = (result.match(/```/g) || []).length;

    // If we have an odd number of ```
    // In this case, don't complete inline code
    const insideIncompleteCodeBlock = allTripleBackticks % 2 === 1;

    if (!insideIncompleteCodeBlock) {
      // Count the number of single backticks that are NOT part of triple backticks
      let singleBacktickCount = 0;
      for (let i = 0; i < result.length; i++) {
        if (result[i] === '`') {
          // Check if this backtick is part of a triple backtick sequence
          const isTripleStart = result.substring(i, i + 3) === '```';
          const isTripleMiddle = i > 0 && result.substring(i - 1, i + 2) === '``'
          const isTripleEnd = i > 1 && result.substring(i - 2, i + 1) === '```';

          if (!isTripleStart && !isTripleMiddle && !isTripleEnd) {
            singleBacktickCount++;
          }
        }
      }
      // If odd number of single backticks, we have an incomplete inline code - complete it
      if (singleBacktickCount % 2 === 1) {
        result = `${result}\``;
      }
    }
  }

  // Handle incomplete strikethrough formatting (~~)
  const strikethroughPattern = /(~~)([^~]*?)$/;
  const strikethroughMatch = result.match(strikethroughPattern);
  if (strikethroughMatch) {
    // Count the number of ~~ in the entire string
    const tildePairs = (result.match(/~~/g) || []).length;
    // If odd number of ~~, we have an incomplete strikethrough - complete it
    if (tildePairs % 2 === 1) {
      result = `${result}~~`;
    }
  }

  // Collapse multiple raw <br> tags into a single one
  result = result.replace(/(?:<br\s*\/?>\s*){2,}/gi, '<br />');

  // Remove leading <br> sequences immediately before a table
  result = result.replace(/(?:<br\s*\/?>\s*)+(?=\s*<table\b)/gi, '');

  return result;
}

// Create a hardened version of ReactMarkdown
const HardenedMarkdown = hardenReactMarkdown(ReactMarkdown);

export type ResponseProps = HTMLAttributes<HTMLDivElement> & {
  options?: Options;
  children: Options['children'];
  allowedImagePrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >['allowedImagePrefixes'];
  allowedLinkPrefixes?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >['allowedLinkPrefixes'];
  defaultOrigin?: ComponentProps<
    ReturnType<typeof hardenReactMarkdown>
  >['defaultOrigin'];
  parseIncompleteMarkdown?: boolean;
};

const components: Options['components'] = {
  // Paragraph component
  p: ({ node, children, className, ...props }) => (
    <p
      className={cn('mb-4 leading-none tracking-tight text-[#f7eee3] text-[1.4em]', className)}
      {...props}
    >
      {children}
    </p>
  ),

  // Inline code component - separate from code block rendering
  code: ({ node, children, className, ...props }) => {
    // Check if it's inline code (not inside pre)
    const isInline = !className?.includes('language-');

    if (isInline) {
      return (
        <code
          className={cn(
            'px-1.5 py-0.5 rounded  text-white/80 text-[0.8em] item-center justify-center  border-white/20 bg-white/10 font-mono text-sm border ',
            className
          )}
          {...props}
        >
          {children}
        </code>
      );
    }

    // For code blocks, return as is (handled by pre component and CodeBlock)
    return <code className={className} {...props}>{children}</code>;
  },

  ol: ({ node, children, className, ...props }) => (
    <ol className={cn('ml-4 mb-4 list-outside  list-decimal ', className)} {...props}>
      {children}
    </ol>
  ),

  li: ({ node, children, className, ...props }) => (
    <li className={cn(' leading-none tracking-tight text-[1.2em] list-[upper-roman]  ', className)} {...props}>
      {children}
    </li>
  ),

  ul: ({ node, children, className, ...props }) => (
    <ul className={cn('ml-4 mb-4 list-outside list-disc ', className)} {...props}>
      {children}
    </ul>
  ),

  strong: ({ node, children, className, ...props }) => (
    <span className={cn('font-medium  leading-relaxed tracking-tight', className)} {...props}>
      {children}
    </span>
  ),

  em: ({ node, children, className, ...props }) => (
    <em className={cn('italic font-serif text-indigo-300', className)} {...props}>
      {children}
    </em>
  ),

  // Enhanced link component with citation detection
  a: ({ node, children, className, href, ...props }) => {
    // Check if this looks like a citation link
    const isCitation = typeof children === 'string' && /^\[?\d+\]?$|^\[?[A-Z][a-z]+ \d{4}\]?$/.test(children);



    return (
      <a
        className={cn('font-medium text-blue-400 underline hover:text-blue-300 transition-colors', className)}
        rel="noreferrer"
        target="_blank"
        href={href}
        {...props}
      >
        {children}
      </a>
    );
  },

  h1: ({ node, children, className, ...props }) => (
    <h1
      className={cn('mt-8 mb-4  font-bold leading-none tracking-tighter text-[2em] border-b border-green-400/30 pb-2', className)}
      {...props}
    >
      {children}
    </h1>
  ),

  h2: ({ node, children, className, ...props }) => (
    <h2
      className={cn('mt-7 mb-3  leading-none font-stretch-semi-condensed 200 tracking-tighter font-normal text-[2em] border-b border-blue-400/20 pb-2', className)}
      {...props}
    >
      {children}
    </h2>
  ),

  h3: ({ node, children, className, ...props }) => (
    <h3 className={cn('mt-6 mb-3  font-stretch-semi-condensed  leading-none tracking-tighter font-normal text-[1.8em]', className)} {...props}>
      {children}
    </h3>
  ),

  h4: ({ node, children, className, ...props }) => (
    <h4 className={cn('mt-5 mb-2   font-stretch-semi-condensed leading-none tracking-tight font-semibold text-lg', className)} {...props}>
      {children}
    </h4>
  ),

  h5: ({ node, children, className, ...props }) => (
    <h5
      className={cn('mt-4 mb-2 leading-none tracking-tight font-semibold text-base', className)}
      {...props}
    >
      {children}
    </h5>
  ),

  h6: ({ node, children, className, ...props }) => (
    <h6 className={cn('mt-4 mb-2 text-gray-400 leading-none tracking-tight font-semibold text-sm', className)} {...props}>
      {children}
    </h6>
  ),

  // Blockquote component
  blockquote: ({ node, children, className, ...props }) => (
    <blockquote
      className={cn(
        'my-4 pl-4 border-l-4 border-white/20  rounded-sm leading-none  bg-white/10 py-2  ',
        className
      )}
      {...props}
    >
      {children}
    </blockquote>
  ),

  // Math components - enhanced styling for KaTeX output
  div: ({ node, children, className, ...props }) => {
    // Check if this is a KaTeX math display block
    if (className === 'math math-display' || className?.includes('katex-display')) {
      return (
        <div
          className={cn(
            'my-6 p-4 bg-gray-900/30 border border-gray-600/50 text-[1.2em] rounded-lg overflow-x-auto',
            'text-center [&_.katex]:text-gray-100 [&_.katex-html]:text-gray-100',
            'katex-display-wrapper',
            className
          )}
          {...props}
        >
          {children}
        </div>
      );
    }
    return <div className={className} {...props}>{children}</div>;
  },

  span: ({ node, children, className, ...props }) => {
    // Check if this is KaTeX inline math
    if (className === 'math math-inline' || className?.includes('katex')) {
      return (
        <span
          className={cn(
            'inline-block px-1 py-0.5 text-[1.2em] [&_.katex]:text-gray-100 [&_.katex-html]:text-gray-100',
            'katex-inline-wrapper',
            className
          )}
          {...props}
        >
          {children}
        </span>
      );
    }
    return <span className={className} {...props}>{children}</span>;
  },

  // Table components
  table: ({ node, children, className, ...props }) => (
    <div className="overflow-x-auto p-1 bg-[#252525] rounded-2xl">
      <table
        className={cn(
          'm-0 mb-4 w-full border-collapse rounded-lg border-red-600 bg-[#161718] text-sm',
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  ),

  thead: ({ node, children, className, ...props }) => (
    <thead
      className={cn(' text-gray-200 p-2 text-[1.2em] rounded-t-2xl ', className)}
      {...props}
    >
      {children}
    </thead>
  ),

  tbody: ({ node, children, className, ...props }) => (
    <tbody className={cn('text-gray-300  text-[1.2em] bg-[#252525] ', className)} {...props}>
      {children}
    </tbody>
  ),

  tr: ({ node, children, className, ...props }) => (
    <tr
      className={cn(
        'border-b border-[#161718]  hover:bg-[#161718]/80 transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  ),

  th: ({ node, children, className, ...props }) => (
    <th
      className={cn(
        '  px-4 py-3  text-left font-stretch-condensed text-[1.2em]   ',
        className
      )}
      {...props}
    >
      {children}
    </th>
  ),

  td: ({ node, children, className, ...props }) => (
    <td
      className={cn(
        '  px-4 py-3 text-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </td>
  ),

  pre: ({ node, className, children }) => {
    // Detect language from child <code> element className (e.g., "language-python")
    let language = 'plaintext';
    const extractLang = (cls: any): string | null => {
      if (typeof cls === 'string') {
        const m = cls.match(/language-([^\s]+)/);
        return m ? m[1] : null;
      }
      if (Array.isArray(cls)) {
        const found = cls.find((c) => typeof c === 'string' && c.startsWith('language-'));
        return typeof found === 'string' ? found.replace('language-', '') : null;
      }
      return null;
    };
    if (children && typeof children === 'object' && 'props' in (children as any)) {
      const el = children as any;
      language = extractLang(el.props?.className) ?? language;
    } else if (Array.isArray(children)) {
      for (const child of children as any[]) {
        if (child && typeof child === 'object' && 'props' in child) {
          const l = extractLang((child as any).props?.className);
          if (l) {
            language = l;
            break;
          }
        }
      }
    }

    // Extract code content from children
    let code = '';

    if (typeof children === 'string') {
      code = children;
    } else if (children && typeof children === 'object') {
      // Handle React element structure
      if ('props' in children) {
        const element = children as any;
        if (element.props && typeof element.props.children === 'string') {
          code = element.props.children;
        } else {
          code = String(children);
        }
      } else if (Array.isArray(children)) {
        // Handle array of children
        code = children.map(child => {
          if (typeof child === 'string') {
            return child;
          } else if (child && typeof child === 'object' && 'props' in child) {
            const childElement = child as any;
            return childElement.props?.children || '';
          }
          return '';
        }).join('');
      } else {
        code = String(children);
      }
    } else {
      code = String(children);
    }

    if (language.toLowerCase() === 'mermaid') {
      return (
        <div className="my-6">
          <MermaidDiagram
            chart={code.trim()}
            className="border border-white/20 rounded-lg p-4 bg-white/5 backdrop-blur-sm"
          />
        </div>
      );
    }

    return (
      <CodeBlock
        className={cn('my-4 h-auto', className)}
        code={code}
        language={language}
      >
        <CodeBlockCopyButton
          onCopy={() => console.log('Copied code to clipboard')}
          onError={() => console.error('Failed to copy code to clipboard')}
        />
      </CodeBlock>
    );
  },
};

export const Response = memo(
  ({
    className,
    options,
    children,
    allowedImagePrefixes,
    allowedLinkPrefixes,
    defaultOrigin,
    parseIncompleteMarkdown: shouldParseIncompleteMarkdown = true,
    ...props
  }: ResponseProps) => {
    // Parse the children to remove incomplete markdown tokens if enabled
    const parsedChildren =
      typeof children === 'string' && shouldParseIncompleteMarkdown
        ? parseIncompleteMarkdown(children)
        : children;

    return (
      <div
        className={cn(
          'size-full prose prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          // KaTeX styling overrides
          '[&_.katex]:text-gray-100 text-[1em] [&_.katex-html]:text-gray-100 [&_.katex-display]:text-gray-100',
          '[&_.katex_.base]:text-gray-100 text-[1em] [&_.katex_.mord]:text-gray-100 [&_.katex_.mbin]:text-blue-300',
          '[&_.katex_.mrel]:text-green-300 text-[1em] [&_.katex_.mop]:text-yellow-300 [&_.katex_.mpunct]:text-gray-300',
          '[&_.katex-display]:my-6 text-[1em] [&_.katex-display]:text-center',
          className,
        )}
        {...props}
      >
        <HardenedMarkdown
          components={components}
          rehypePlugins={[[rehypeKatex, {
            strict: false,
            throwOnError: false,
            errorColor: '#cc0000',
            macros: {
              "\\RR": "\\mathbb{R}",
              "\\NN": "\\mathbb{N}",
              "\\ZZ": "\\mathbb{Z}",
              "\\QQ": "\\mathbb{Q}",
              "\\CC": "\\mathbb{C}",
            },
            trust: true,
            fleqn: false,
            leqno: false,
            minRuleThickness: 0.04,
          }]]}
          remarkPlugins={[remarkMath, remarkGfm]}
          allowedImagePrefixes={allowedImagePrefixes ?? ['*']}
          allowedLinkPrefixes={allowedLinkPrefixes ?? ['*']}
          defaultOrigin={defaultOrigin}
          {...options}
        >
          {parsedChildren}
        </HardenedMarkdown>
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);
