"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

function PdfPage({ document, pageNumber, width }: { document: PDFDocumentProxy; pageNumber: number; width: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderedWidth, setRenderedWidth] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(612 / 792);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!width) return;
    let cancelled = false;
    let task: RenderTask | undefined;
    async function render() {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const viewport = page.getViewport({ scale: Math.max(0.1, width / page.getViewport({ scale: 1 }).width) });
        setAspectRatio(viewport.width / viewport.height);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        task = page.render({ canvas, viewport, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
        await task.promise;
        if (!cancelled) { setRenderedWidth(width); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void render();
    return () => { cancelled = true; task?.cancel(); };
  }, [document, pageNumber, width]);

  return (
    <div>
      <p className="mb-2 text-center text-xs text-slate-500 tabular-nums">Page {pageNumber} of {document.numPages}</p>
      <div className="relative overflow-hidden bg-white shadow-sm" style={{ aspectRatio }}>
        {error && <p role="alert" className="p-4 text-sm text-red-700">Page {pageNumber} could not be displayed. Your Markdown edits are still available.</p>}
        {!error && renderedWidth !== width && <p role="status" className="p-4 text-sm text-slate-500">Loading page {pageNumber}…</p>}
        <canvas ref={canvasRef} role="img" aria-label={`Original PDF, page ${pageNumber}. Extracted content is available in the Markdown editor.`} className={`absolute inset-0 ${renderedWidth === width && width > 0 && !error ? "block" : "hidden"}`} />
      </div>
    </div>
  );
}

export function OriginalPdf({ document }: { document: PDFDocumentProxy }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.floor(entry.contentRect.width);
      if (nextWidth > 0) setWidth(nextWidth);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} role="region" aria-label="Original PDF pages" tabIndex={0} className="h-full space-y-6 overflow-auto bg-slate-100 p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px]" style={{ scrollbarGutter: "stable" }}>
      {Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index + 1} document={document} pageNumber={index + 1} width={width} />)}
    </div>
  );
}
