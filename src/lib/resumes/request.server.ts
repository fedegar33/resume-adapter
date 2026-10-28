import "server-only";
import { MAX_RESUME_BYTES, ResumeUploadError } from "@/lib/resumes/upload";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertLocalUploadRequest(request: Request) {
  const url = new URL(request.url);
  const forwardedAddresses = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  if (
    process.env.NODE_ENV !== "development" ||
    !loopbackHosts.has(url.hostname) ||
    request.headers.get("host") !== url.host ||
    request.headers.get("origin") !== url.origin ||
    forwardedAddresses.some((address) => !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address.trim())) ||
    (request.headers.has("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin")
  ) {
    throw new ResumeUploadError("Uploads are available only in local development.", 403);
  }
}

export async function readResumeFile(request: Request): Promise<File> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new ResumeUploadError("Choose a PDF file to upload.");
  }
  // Bound the actual stream, including chunked bodies without Content-Length.
  const maxBodyBytes = MAX_RESUME_BYTES + 64 * 1024;
  const reader = request.body?.getReader();
  if (!reader) throw new ResumeUploadError("Choose a PDF file to upload.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBodyBytes) {
        await reader.cancel();
        throw new ResumeUploadError("The PDF must be 10 MB or smaller.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let form: FormData;
  try {
    form = await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData();
  } catch {
    throw new ResumeUploadError("The upload could not be read. Choose the file again.");
  }
  const files = form.getAll("file");
  if ([...form.keys()].some((key) => key !== "file") || files.length !== 1 || !(files[0] instanceof File)) {
    throw new ResumeUploadError("Choose exactly one PDF file.");
  }
  return files[0];
}
