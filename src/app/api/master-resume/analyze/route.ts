import "server-only";
import { traced } from "braintrust";
import { z } from "zod";
import { assertLocalUploadRequest, readResumeJson } from "@/lib/resumes/request.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readUploadedResume } from "@/lib/resumes/read-upload.server";
import { extractResumeMetadata } from "@/lib/ai/extract-metadata.server";
import { ResumeUploadError } from "@/lib/resumes/upload";


export async function POST(request: Request) {
  try {
    assertLocalUploadRequest(request);
    const parsed = z.object({ uploadId: z.uuid() }).strict().safeParse(await readResumeJson(request));
    if (!parsed.success) throw new ResumeUploadError("Choose a valid uploaded resume.");
    const upload = await readUploadedResume(createSupabaseServerClient(), parsed.data.uploadId);
    const metadata = await traced(async (span) => {
      span.log({ input: { filename: upload.filename }, metadata: { filename: upload.filename, upload_id: parsed.data.uploadId } });
      const result = await extractResumeMetadata(upload.bytes, parsed.data.uploadId);
      span.log({ output: result });
      return result;
    }, { name: "resume.extractMetadata" });
    return Response.json({ metadata }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof ResumeUploadError ? error.message : "The resume details could not be extracted. Your uploaded PDF is still stored." }, { status: error instanceof ResumeUploadError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
