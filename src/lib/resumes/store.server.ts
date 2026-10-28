import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ResumeUploadError } from "@/lib/resumes/upload";

export async function storeResume(
  client: SupabaseClient,
  bucket: string,
  file: File,
  bytes: Uint8Array,
) {
  const id = randomUUID();
  const path = `masters/${id}.pdf`;
  const storage = client.storage.from(bucket);
  const { data: bucketInfo, error: bucketError } = await client.storage.getBucket(bucket);
  if (bucketError || !bucketInfo || bucketInfo.public) {
    throw new ResumeUploadError("Upload storage is unavailable. Check that the resumes bucket exists and is private.", 503);
  }

  const { error: uploadError } = await storage.upload(path, bytes, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) throw new ResumeUploadError("The PDF could not be uploaded. Please try again.", 502);

  let insertRejected = false;
  try {
    const { error, status } = await client.from("master_resume_uploads").insert({
      id,
      storage_bucket: bucket,
      storage_path: path,
      original_filename: file.name,
      size_bytes: file.size,
      mime_type: "application/pdf",
    });
    if (error) {
      // A missing response or a server error does not prove the insert rolled back.
      insertRejected = status >= 400 && status < 500;
      throw error;
    }
  } catch {
    if (!insertRejected) {
      throw new ResumeUploadError("The upload could not be confirmed. Check Supabase Storage and the database before retrying.", 502);
    }
    try {
      const { error } = await storage.remove([path]);
      if (error) throw error;
    } catch {
      // Log only the generated object identifier, never file contents or credentials.
      console.error("Resume upload cleanup failed:", path);
      throw new ResumeUploadError("The upload could not be saved and cleanup failed. Check Supabase Storage before retrying.", 502);
    }
    throw new ResumeUploadError("The upload could not be saved. The uploaded file was removed. Please try again.", 502);
  }
  return { id, filename: file.name };
}
