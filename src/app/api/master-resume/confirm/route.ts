import "server-only";
import { assertLocalUploadRequest, readResumeJson } from "@/lib/resumes/request.server";
import { confirmMasterSchema, MAX_MASTER_HTML_BYTES } from "@/lib/resumes/master";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmMaster } from "@/lib/resumes/master.server";
import { readUploadedResume } from "@/lib/resumes/read-upload.server";
import { renderMasterPreview } from "@/lib/pdf/thumbnail.server";
import { getMasterSummary } from "@/lib/resumes/presentation.server";
import { ResumeUploadError } from "@/lib/resumes/upload";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    assertLocalUploadRequest(request);
    // JSON escaping can expand converter text to six bytes per input byte.
    const parsed = confirmMasterSchema.safeParse(await readResumeJson(request, MAX_MASTER_HTML_BYTES * 6 + 256 * 1024));
    if (!parsed.success) throw new ResumeUploadError("The master details or section choices are invalid.");
    const client = createSupabaseServerClient();
    const original = await readUploadedResume(client, parsed.data.content.metadata.uploadId);
    const preview = await renderMasterPreview(original.bytes);
    // Client-supplied extracted content remains untrusted; previews are isolated.
    await confirmMaster(client, { ...parsed.data.content, preview }, parsed.data.expectedActiveId);
    return Response.json({ confirmed: true, master: await getMasterSummary(parsed.data.content.metadata.uploadId) }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof ResumeUploadError ? error.message : "The master could not be confirmed. Check the local Supabase configuration." }, { status: error instanceof ResumeUploadError ? error.status : 500, headers });
  }
}
