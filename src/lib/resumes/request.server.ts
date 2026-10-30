import "server-only";
import { MAX_RESUME_BYTES, ResumeUploadError } from "@/lib/resumes/upload";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function assertLocalUploadRequest(request: Request, allowRead = false) {
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? "";
  let browserOrigin: URL;
  try { browserOrigin = new URL(`${url.protocol}//${host}`); }
  catch { throw new ResumeUploadError("Local development only.", 403); }
  const forwardedAddresses = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  if (
    process.env.NODE_ENV !== "development" ||
    !loopbackHosts.has(url.hostname) ||
    !loopbackHosts.has(browserOrigin.hostname) || browserOrigin.host !== host ||
    (request.headers.get("origin") !== browserOrigin.origin && !(allowRead && request.method === "GET" && (request.headers.get("x-resume-reader") === "1" || (request.headers.get("sec-fetch-site") === "same-origin" && request.headers.get("sec-fetch-dest") === "image")) && !request.headers.has("origin"))) ||
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

export async function readResumeJson(request: Request, maxBytes = 2 * 1024 * 1024): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new ResumeUploadError("Send a JSON request.");
  const reader = request.body?.getReader();
  if (!reader) throw new ResumeUploadError("The request is empty.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new ResumeUploadError("The request is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new ResumeUploadError("The request contains invalid JSON."); }
}

// Top-level document navigations omit Origin and use Sec-Fetch-Site: none.
// Validate before any privileged SSR read, outside the Next cache scopes.
export function assertLocalPageRequest(headers: Headers) {
  const host = headers.get("host") ?? "";
  let url: URL;
  try { url = new URL(`http://${host}`); } catch { throw new ResumeUploadError("Local development only.", 403); }
  const forwarded = headers.get("x-forwarded-for")?.split(",") ?? [];
  if (process.env.NODE_ENV !== "development" || !loopbackHosts.has(url.hostname) || url.host !== host ||
    (headers.has("origin") && headers.get("origin") !== url.origin) ||
    (headers.has("sec-fetch-site") && !["none", "same-origin"].includes(headers.get("sec-fetch-site")!)) ||
    forwarded.some(address => !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address.trim()))) {
    throw new ResumeUploadError("Local development only.", 403);
  }
}
