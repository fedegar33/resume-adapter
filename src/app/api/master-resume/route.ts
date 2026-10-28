import "server-only";
import { getSupabaseConfig } from "@/lib/env.server";
import { validateResumePdf } from "@/lib/pdf/validate.server";
import { assertLocalUploadRequest, readResumeFile } from "@/lib/resumes/request.server";
import { storeResume } from "@/lib/resumes/store.server";
import { ResumeUploadError } from "@/lib/resumes/upload";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertLocalUploadRequest(request);
    const file = await readResumeFile(request);
    const bytes = await validateResumePdf(file);
    const config = getSupabaseConfig();
    const result = await storeResume(createSupabaseServerClient(), config.SUPABASE_STORAGE_BUCKET, file, bytes);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ResumeUploadError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Master resume upload failed:", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ error: "The upload could not be completed. Check the local Supabase configuration and try again." }, { status: 500 });
  }
}
