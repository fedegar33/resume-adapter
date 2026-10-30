import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { assertLocalUploadRequest } from "@/lib/resumes/request.server";
import { getMasterPdf, getMasterThumbnail } from "@/lib/resumes/presentation.server";
import { ResumeUploadError } from "@/lib/resumes/upload";

export async function GET(request: Request, { params }: { params: Promise<{ id: string; kind: string }> }) {
  try {
    assertLocalUploadRequest(request, true);
    const parsed = z.object({ id: z.uuid(), kind: z.enum(["thumbnail", "pdf"]) }).safeParse(await params);
    if (!parsed.success) throw new ResumeUploadError("Asset not found.", 404);
    const { id, kind } = parsed.data;
    const bytes = await (kind === "pdf" ? getMasterPdf(id) : getMasterThumbnail(id));
    const etag = `"${createHash("sha256").update(bytes).digest("hex")}"`;
    const headers = { "Cache-Control": "private, max-age=86400, immutable", ETag: etag, Vary: "Host, Origin, Sec-Fetch-Site",
      "Content-Type": kind === "pdf" ? "application/pdf" : "image/png", "X-Content-Type-Options": "nosniff" };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(bytes), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ResumeUploadError ? error.message : "The master file could not be loaded." }, { status: error instanceof ResumeUploadError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
