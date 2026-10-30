import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type MasterContent } from "@/lib/resumes/master";
import { ResumeUploadError } from "@/lib/resumes/upload";

export async function confirmMaster(client: SupabaseClient, content: MasterContent, expectedActiveId: string | null) {
  const { error } = await client.rpc("confirm_master_resume", { p_upload_id: content.metadata.uploadId, p_content: content, p_expected_active_id: expectedActiveId });
  if (error) {
    if (error.code === "40001") throw new ResumeUploadError("The active master changed in another tab. Reload before replacing it.", 409);
    throw new ResumeUploadError("Confirmation could not be verified. Reload to check the active master before retrying.", 502);
  }
}
