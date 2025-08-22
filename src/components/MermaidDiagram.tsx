import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';
import { Copy, Download } from 'lucide-react';


type MermaidDiagramProps = {
  chart: string;
  className?: string;
};

const MermaidDiagram = ({ chart, className }: MermaidDiagramProps) => {
  const ref = useRef(null);
  const [svg, setSvg] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const renderMermaid = useCallback(async (chartContent: string) => {
    try {
      // mermaid.parse is synchronous (throws on error). We don't await it.
      let valid = true;
      try {
        mermaid.parse(chartContent);
      } catch {
        valid = false;
      }

      if (!valid) {
        setIsValid(false);
        setSvg('');
        setIsLoading(false);
        return;
      }

      const id = `mermaid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const { svg } = await mermaid.render(id, chartContent);
      setSvg(svg);
      setIsValid(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Mermaid render error:', error);
      setIsValid(false);
      setSvg('');
      setIsLoading(false);
    }
  }, []);

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
    navigator.clipboard.writeText(chart);
  };

  const downloadSVG = () => {
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
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
          <span className="font-semibold tracking-wide text-red-200 text-lg">Diagram Error</span>
          <button
            onClick={copyToClipboard}
            className="rounded-md px-2 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 transition"
            title="Copy raw Mermaid code"
          >
            Copy Code
          </button>
        </div>
        <div className="p-4">
          <p className="text-red-300 font-medium mb-2">Invalid Mermaid syntax</p>
          <pre className="text-xs leading-relaxed text-red-200/90 bg-[#3a1216] border border-red-400/30 rounded-lg p-3 overflow-x-auto">
{chart}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={` w-full rounded-xl border-none  bg-[#252525] text-gray-100 ${className || ''}`}
    >
      <div className="flex items-center justify-between p-2 m-1 rounded-t-xl  bg-[#161718]">
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
