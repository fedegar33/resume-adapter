import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/env.server";
import { MAX_RESUME_BYTES, ResumeUploadError } from "@/lib/resumes/upload";

export async function readUploadedResume(client: SupabaseClient, uploadId: string) {
  const { data: upload, error } = await client.from("master_resume_uploads").select("id,storage_bucket,storage_path,size_bytes,original_filename").eq("id", uploadId).single();
  if (error || !upload) throw new ResumeUploadError("The uploaded resume could not be found.", 404);
  const config = getSupabaseConfig();
  if (upload.storage_bucket !== config.SUPABASE_STORAGE_BUCKET || upload.storage_path !== `masters/${uploadId}.pdf` || upload.size_bytes > MAX_RESUME_BYTES) {
    throw new ResumeUploadError("The uploaded resume has invalid file metadata.", 422);
  }
  const { data: bucket, error: bucketError } = await client.storage.getBucket(upload.storage_bucket);
  if (bucketError || !bucket || bucket.public) throw new ResumeUploadError("The resume bucket must be private and available.", 503);
  const { data: file, error: downloadError } = await client.storage.from(upload.storage_bucket).download(upload.storage_path);
  if (downloadError || !file) throw new ResumeUploadError("The uploaded PDF could not be read.", 502);
  if (file.size !== upload.size_bytes || file.size === 0 || file.size > MAX_RESUME_BYTES) throw new ResumeUploadError("The uploaded PDF no longer matches its metadata.", 409);
  return { bytes: new Uint8Array(await file.arrayBuffer()), filename: typeof upload.original_filename === "string" ? upload.original_filename : "resume.pdf" };
}

export async function readUploadedPdf(client: SupabaseClient, uploadId: string) {
  return (await readUploadedResume(client, uploadId)).bytes;
}
