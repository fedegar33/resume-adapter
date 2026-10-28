import "server-only";
import { MAX_RESUME_BYTES, ResumeUploadError } from "@/lib/resumes/upload";

export async function validateResumePdf(file: File): Promise<Uint8Array> {
  if (file.size === 0) throw new ResumeUploadError("Choose a non-empty PDF file.");
  if (file.size > MAX_RESUME_BYTES) {
    throw new ResumeUploadError("The PDF must be 10 MB or smaller.", 413);
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    throw new ResumeUploadError("Choose a PDF file (.pdf).");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // File extensions and browser MIME types alone do not establish the format.
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") {
    throw new ResumeUploadError("This file is not a valid PDF.");
  }

  // A separate Node-only reader; the browser PDF.js integration stays unchanged.
  const { getDocument, PasswordException } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: bytes.slice(), // PDF.js takes ownership; preserve the original for Storage.
    stopAtErrors: true,
    useWorkerFetch: false,
    disableFontFace: true,
    enableXfa: false,
    verbosity: 0,
  });
  try {
    const document = await task.promise;
    if (document.numPages < 1) throw new Error("Empty PDF");
    const { info } = await document.getMetadata();
    if ((info as { EncryptFilterName?: string | null }).EncryptFilterName) {
      throw new ResumeUploadError("Password-protected PDFs are not supported.");
    }
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      page.cleanup();
    }
  } catch (error) {
    if (error instanceof ResumeUploadError) throw error;
    if (error instanceof PasswordException) {
      throw new ResumeUploadError("Password-protected PDFs are not supported.");
    }
    throw new ResumeUploadError("This PDF could not be opened. Choose a valid, unprotected PDF.");
  } finally {
    await task.destroy();
  }
  return bytes;
}
