"use client";

import { resumeMetadataSchema, type ResumeMetadata } from "@/lib/resumes/metadata";
import { MAX_RESUME_BYTES } from "@/lib/resumes/upload";

export type UploadedResume = { id: string; filename: string; file: File; html: string; metadata: ResumeMetadata };
export type ProcessingPhase = "uploading" | "analyzing" | "converting";

export async function processResumeFile(file: File, onPhase: (phase: ProcessingPhase) => void): Promise<UploadedResume> {
  if (!file.name.toLowerCase().endsWith(".pdf") || file.size === 0 || file.size > MAX_RESUME_BYTES) throw new Error("Choose a non-empty PDF file, 10 MB or smaller.");
  onPhase("uploading");
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/master-resume", { method: "POST", body });
  const result: { id?: string; filename?: string; error?: string } = await response.json();
  if (!response.ok) throw new Error(result.error || "The upload failed. Please try again.");
  if (typeof result.filename !== "string" || typeof result.id !== "string") throw new Error("The upload could not be confirmed. Please try again.");
  onPhase("analyzing");
  const analysisResponse = await fetch("/api/master-resume/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId: result.id }) });
  const analysis: { metadata?: unknown; error?: string } = await analysisResponse.json();
  if (!analysisResponse.ok) throw new Error(analysis.error || "The resume details could not be extracted. Your uploaded PDF is still stored.");
  const parsed = resumeMetadataSchema.safeParse(analysis.metadata);
  if (!parsed.success || parsed.data.uploadId !== result.id) throw new Error("The extracted details could not be read. Your uploaded PDF is still stored.");
  onPhase("converting");
  const conversionResponse = await fetch("/api/master-resume/convert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uploadId: result.id }) });
  const conversion: { uploadId?: unknown; html?: unknown; error?: string } = await conversionResponse.json();
  if (!conversionResponse.ok) throw new Error(conversion.error || "The HTML could not be generated. Your uploaded PDF is still stored.");
  if (typeof conversion.html !== "string" || !conversion.html.trim() || conversion.uploadId !== result.id) throw new Error("The generated HTML could not be read. Your uploaded PDF is still stored.");
  return { id: result.id, filename: result.filename, file, html: conversion.html, metadata: parsed.data };
}
