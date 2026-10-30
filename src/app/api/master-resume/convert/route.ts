import "server-only";
import { z } from "zod";
import { assertLocalUploadRequest, readResumeJson } from "@/lib/resumes/request.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readUploadedPdf } from "@/lib/resumes/read-upload.server";
import { convertPdfToHtml } from "@/lib/pdf/html.server";
import { ResumeUploadError } from "@/lib/resumes/upload";


export async function POST(request: Request) {
  try {
    assertLocalUploadRequest(request);
    const parsed = z.object({ uploadId: z.uuid() }).strict().safeParse(await readResumeJson(request));
    if (!parsed.success) throw new ResumeUploadError("Choose a valid uploaded resume.");
    const bytes = await readUploadedPdf(createSupabaseServerClient(), parsed.data.uploadId);
    const html = await convertPdfToHtml(bytes);
    return Response.json({ uploadId: parsed.data.uploadId, html }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof ResumeUploadError ? error.message : "The HTML could not be generated. Your uploaded PDF is still stored." }, { status: error instanceof ResumeUploadError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
