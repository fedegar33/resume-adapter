"use client";
import { useEffect, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { getPdfReader, pdfReaderOptions } from "@/lib/pdf/reader.client";
import { OriginalPdf } from "@/components/pdf/original-pdf";

export default function MasterPdfPages({ getFile, onReady }: { getFile: () => Promise<File>; onReady: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    let task: PDFDocumentLoadingTask | undefined;
    async function load() {
      try {
        const [reader, file] = await Promise.all([getPdfReader(), getFile()]);
        if (!active) return;
        task = reader.getDocument({ ...pdfReaderOptions, data: new Uint8Array(await file.arrayBuffer()), enableXfa: false });
        const pdf = await task.promise;
        if (active) setDocument(pdf);
      } catch { if (active) setError(true); }
    }
    void load();
    return () => { active = false; void task?.destroy().catch(() => {}); };
  }, [getFile, attempt]);
  if (error) return <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white text-[13px] [&_button]:min-h-11 [&_button]:underline" role="alert">PDF unavailable.<button onClick={() => { setError(false); setAttempt(value => value + 1); }}>Retry</button></div>;
  return document ? <OriginalPdf document={document} onFirstPageRendered={onReady} /> : <span className="sr-only" role="status">Opening PDF…</span>;
}
