"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { MAX_RESUME_BYTES } from "@/lib/resumes/upload";

type Feedback = { kind: "success" | "error"; message: string } | null;

export function UploadMasterResume({ enabled }: { enabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // Selecting the same file again must trigger onChange.
    if (!file || inFlight.current) return;
    setFeedback(null);
    if (!file.name.toLowerCase().endsWith(".pdf") || file.size === 0 || file.size > MAX_RESUME_BYTES) {
      setFeedback({ kind: "error", message: "Choose a non-empty PDF file, 10 MB or smaller." });
      return;
    }
    inFlight.current = true;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/master-resume", { method: "POST", body });
      const result: { filename?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "The upload failed. Please try again.");
      if (typeof result.filename !== "string") throw new Error("The upload could not be confirmed. Please try again.");
      setFeedback({ kind: "success", message: `${result.filename} uploaded!` });
    } catch (error) {
      setFeedback({ kind: "error", message: error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Connection lost. Check whether the upload completed before retrying." });
    } finally {
      inFlight.current = false;
      setUploading(false);
    }
  }

  return (
    <section className="mt-10" aria-label="Upload master resume" aria-busy={uploading}>
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" aria-label="Choose master resume PDF" onChange={upload} disabled={!enabled || uploading} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={!enabled || uploading}
        aria-describedby="upload-help upload-feedback"
        className="min-h-11 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm enabled:cursor-pointer enabled:hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Upload Master Resume"}
      </button>
      <p id="upload-help" className="mt-3 text-sm text-slate-500">
        {enabled ? "PDF · Up to 10 MB · No password protection" : "Uploads are available only in local development."}
      </p>
      <div id="upload-feedback" role="status" aria-live="polite" aria-atomic="true" className="mt-4 min-h-6 break-words text-sm">
        {feedback && <p className={feedback.kind === "success" ? "text-emerald-700" : "text-red-700"}>{feedback.message}</p>}
      </div>
    </section>
  );
}
