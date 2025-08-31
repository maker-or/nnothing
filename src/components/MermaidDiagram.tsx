import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Copy, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

const MermaidDiagram = ({ chart, className }: MermaidDiagramProps) => {
  const ref = useRef(null);
  const [svg, setSvg] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const renderMermaid = useCallback(async (chartContent: string) => {
    try {
      // mermaid.parse is synchronous (throws on error). We don't await it.
      let valid = true;
      let parseError = '';

      try {
        mermaid.parse(chartContent);
      } catch (error: any) {
        valid = false;
        parseError = error?.message || 'Invalid Mermaid syntax';
      }

      if (!valid) {
        setIsValid(false);
        setSvg('');
        setIsLoading(false);
        setErrorMessage(parseError);

        // Show error toast with details
        toast.error('Mermaid Diagram Error', {
          description: parseError,
          duration: 5000,
          action: {
            label: 'Copy Code',
            onClick: () => {
              navigator.clipboard.writeText(chartContent);
              toast.success('Code copied to clipboard');
            }
          }
        });
        return;
      }

      const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { svg } = await mermaid.render(id, chartContent);
      setSvg(svg);
      setIsValid(true);
      setIsLoading(false);
      setErrorMessage('');

      // Show success toast if it was previously invalid
      if (!isValid) {
        toast.success('Diagram rendered successfully');
      }
    } catch (error: any) {
      console.error('Mermaid render error:', error);
      const errorMsg = error?.message || 'Failed to render diagram';
      setIsValid(false);
      setSvg('');
      setIsLoading(false);
      setErrorMessage(errorMsg);

      // Show error toast
      toast.error('Failed to render diagram', {
        description: errorMsg,
        duration: 5000,
      });
    }
  }, [isValid]);

  useEffect(() => {
    // Initialize Mermaid only once (subsequent calls can cause re-parsing issues)
    if (typeof window !== 'undefined' && !(window as any).__MERMAID_INITIALIZED__) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
      });
      (window as any).__MERMAID_INITIALIZED__ = true;
    }

    // Clear any existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // If no chart provided, mark as not loading & invalid
    if (!chart) {
      setIsValid(false);
      setSvg('');
      setIsLoading(false);
      setErrorMessage('No diagram content provided');
      return;
    }

    // Set loading state immediately when chart changes
    setIsLoading(true);

    // Debounce the parsing - wait 500ms after the last change
    const timer = setTimeout(() => {
      renderMermaid(chart);
    }, 500);

    setDebounceTimer(timer);

    return () => {
      clearTimeout(timer);
    };
  }, [chart, renderMermaid]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(chart).then(() => {
      toast.success('Mermaid code copied to clipboard');
    }).catch(() => {
      toast.error('Failed to copy code');
    });
  };

  const downloadSVG = () => {
    try {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.svg';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Diagram downloaded as SVG');
    } catch (error) {
      toast.error('Failed to download diagram');
    }
  };

  const retryRender = () => {
    setIsLoading(true);
    renderMermaid(chart);
  };

  if (isLoading) {
    return (
      <div className={`relative w-full overflow-hidden rounded-xl border-4 border-[#252525] bg-[#252525] text-gray-100 ${className || ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#252525] bg-[#161718]">
          <span className="font-semibold tracking-wide text-gray-200 text-lg">Diagram</span>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Rendering…</span>
          </div>
        </div>
        <div className="animate-pulse bg-gray-700/40 h-40 rounded-b-lg" />
      </div>
    );
  }

  if (!isValid) {
    return (
      <div className={`relative w-full overflow-hidden rounded-xl border-4 border-[#3d0f13] bg-[#2a0b0e] text-red-100 ${className || ''}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#3d0f13] bg-[#3a1216]">
          <div className="flex items-center gap-2">
            <AlertCircle size={20} className="text-red-400" />
            <span className="font-semibold tracking-wide text-red-200 text-lg">Diagram Error</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={retryRender}
              className="rounded-md px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 transition"
              title="Retry rendering"
            >
              Retry
            </button>
            <button
              onClick={copyToClipboard}
              className="rounded-md px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 transition"
              title="Copy raw Mermaid code"
            >
              Copy Code
            </button>
          </div>
        </div>
        <div className="p-4">
          <p className="text-red-300 font-medium mb-2">
            {errorMessage || 'Invalid Mermaid syntax'}
          </p>
          <details className="group">
            <summary className="cursor-pointer text-xs text-red-400 hover:text-red-300 mb-2 transition">
              Show diagram code
            </summary>
            <pre className="text-xs leading-relaxed text-red-200/90 bg-[#3a1216] border border-red-400/30 rounded-lg p-3 overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-transparent">
{chart}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`w-full rounded-xl border-none bg-[#252525] text-gray-100 ${className || ''}`}
    >
      <div className="flex items-center justify-between p-2 m-1 rounded-t-xl bg-[#161718]">
        <span className="font-semibold tracking-wide text-gray-200 text-lg">Diagram</span>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="rounded-md p-2 text-gray-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-gray-600 transition"
            title="Copy Mermaid code"
            type="button"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={downloadSVG}
            className="rounded-md p-2 text-gray-300 hover:text-white hover:bg-white/10 border border-transparent hover:border-gray-600 transition"
            title="Download SVG"
            type="button"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <div
        className="mermaid-render-area px-2 overflow-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

export default MermaidDiagram;
