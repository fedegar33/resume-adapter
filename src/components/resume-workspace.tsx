"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";
import { UploadMasterResume, type UploadedResume } from "@/components/upload-master-resume";
import { ResumeMarkdownEditor } from "@/components/editor/resume-markdown-editor";
import { OriginalPdf } from "@/components/pdf/original-pdf";
import { getPdfReader, pdfReaderOptions } from "@/lib/pdf/reader.client";
import { extractResumeMarkdown } from "@/lib/pdf/extract.client";

function ReviewResume({ resume, onEdited }: { resume: UploadedResume; onEdited: () => void }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<"extracting" | "ready" | "error">("extracting");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<"markdown" | "pdf">("markdown");

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    async function load() {
      try {
        const [reader, data] = await Promise.all([getPdfReader(), resume.file.arrayBuffer()]);
        if (controller.signal.aborted) return;
        task = reader.getDocument({ ...pdfReaderOptions, data: new Uint8Array(data), enableXfa: false });
        const pdf = await task.promise;
        if (controller.signal.aborted) return;
        setDocument(pdf);
        const extracted = await extractResumeMarkdown(pdf, controller.signal);
        if (controller.signal.aborted) return;
        setMarkdown(extracted);
        setStatus("ready");
        if (!extracted.trim()) setMessage("No selectable text was found. You can type or paste your resume in the editor; OCR is not available yet.");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("error");
          setMessage("Your PDF was uploaded, but text extraction could not be completed. You can type or paste the content in the editor. Reopen the original file on your device if its preview is unavailable.");
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      void task?.destroy().catch(() => {});
    };
  }, [resume]);

  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!markdown) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [markdown]);

  return (
    <section aria-labelledby="review-title" className="mt-7">
      <div className="mb-5">
        <h2 id="review-title" className="text-xl font-semibold tracking-tight">Review your resume</h2>
        <p className="mt-2 max-w-3xl text-sm text-pretty leading-6 text-slate-600">Compare the extracted Markdown with your original PDF. Check headings, projects, dates, and paragraphs that continue across pages.</p>
        <p className="mt-1 text-xs text-slate-500">Edits stay in this tab and will be lost on reload. Saving and activating the master come next.</p>
      </div>
      <div role="status" aria-live="polite" className="mb-4 text-sm text-amber-800">
        {status === "extracting" ? "Extracting text…" : message}
      </div>
      <div className="mb-3 flex gap-2 lg:hidden" role="group" aria-label="Review view">
        {(["pdf", "markdown"] as const).map((mode) => <button key={mode} type="button" onClick={() => setView(mode)} aria-pressed={view === mode} className={`min-h-10 rounded-lg px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${view === mode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{mode === "markdown" ? "Edit Markdown" : "Original PDF"}</button>)}
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section aria-labelledby="pdf-title" className={`min-w-0 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_3px_12px_rgba(0,0,0,0.03)] ${view === "pdf" ? "block" : "hidden lg:block"}`}>
          <div className="flex h-14 items-center justify-between gap-3 border-b border-slate-200 px-5">
            <h3 id="pdf-title" className="shrink-0 text-sm font-semibold">Original PDF</h3>
            <span className="truncate text-xs text-slate-500" title={resume.filename}>{resume.filename}</span>
          </div>
          <div className="h-[65vh] min-h-96">
            {document ? <OriginalPdf document={document} /> : <p className="p-5 text-sm text-slate-500">{status === "error" ? "PDF preview unavailable." : "Opening PDF…"}</p>}
          </div>
        </section>
        <section aria-labelledby="markdown-title" className={`min-w-0 overflow-hidden rounded-xl bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_3px_12px_rgba(0,0,0,0.03)] ${view === "markdown" ? "block" : "hidden lg:block"}`}>
          <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5">
            <h3 id="markdown-title" className="text-sm font-semibold">Markdown</h3>
            <span className="text-xs text-slate-500">Editable</span>
          </div>
          <div className="h-[65vh] min-h-96" aria-busy={status === "extracting"}>
            {status === "extracting" ? <p className="p-5 text-sm text-slate-500">Preparing your content…</p> : <ResumeMarkdownEditor value={markdown} onChange={(value) => { setMarkdown(value); onEdited(); }} />}
          </div>
        </section>
      </div>
    </section>
  );
}

export function ResumeWorkspace({ enabled }: { enabled: boolean }) {
  const [resume, setResume] = useState<UploadedResume | null>(null);
  const [hasEdits, setHasEdits] = useState(false);
  return (
    <>
      <div className="mt-8">
        <UploadMasterResume enabled={enabled} hasEdits={hasEdits} onUploaded={(uploaded) => { setResume(uploaded); setHasEdits(false); }} />
      </div>
      {resume && <ReviewResume key={resume.id} resume={resume} onEdited={() => setHasEdits(true)} />}
    </>
  );
}
