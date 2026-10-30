import "server-only";
import { cacheLife } from "next/cache";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { getSupabaseConfig } from "@/lib/env.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readUploadedResume } from "@/lib/resumes/read-upload.server";
import { masterContentSchema, masterPreviewSchema, masterSummarySchema } from "@/lib/resumes/master";
import { resumeMetadataSchema } from "@/lib/resumes/metadata";
import { pngDimensions, renderMasterPreview } from "@/lib/pdf/thumbnail.server";
import { ResumeUploadError } from "@/lib/resumes/upload";

function namespace() {
  const config = getSupabaseConfig();
  return createHash("sha256").update(`${config.SUPABASE_URL}:${config.SUPABASE_STORAGE_BUCKET}`).digest("hex").slice(0, 20);
}
export function masterAssetUrl(id: string, kind: "thumbnail" | "pdf") {
  return `/api/master-resume/assets/${id}/${kind}`;
}
// Fresh, deliberately outside every cache scope. A replacement must win immediately.
export async function readActiveMasterId() {
  const { data, error } = await createSupabaseServerClient().from("active_master_resume").select("master_id").eq("singleton", true).maybeSingle();
  if (error) throw new ResumeUploadError("Your master could not be loaded. Check Supabase and the master migration, then retry.", 503);
  return data?.master_id as string | null ?? null;
}
export async function getMasterSummary(id: string) { return cachedSummary(id, namespace()); }
export async function getMasterThumbnail(id: string) { return cachedThumbnail(id, namespace()); }
export async function getMasterPdf(id: string) { return cachedPdf(id, namespace()); }

async function cachedSummary(id: string, project: string) {
  "use cache";
  cacheLife({ stale: 0, revalidate: 86400, expire: 604800 });
  const { data, error } = await createSupabaseServerClient().from("confirmed_master_resumes")
    .select("id,filename,metadata:content->metadata,permissions:content->permissions,width:content->preview->width,height:content->preview->height").eq("id", id).single();
  if (error || !data) throw new ResumeUploadError("Your confirmed master could not be loaded.", 502);
  const metadata = resumeMetadataSchema.parse(data.metadata);
  if (metadata.uploadId !== id || !Array.isArray(data.permissions)) throw new ResumeUploadError("The stored master is invalid.", 502);
  const permissions = masterContentSchema.shape.permissions.parse(data.permissions);
  const dimensions = data.width && data.height ? { width: data.width, height: data.height } : pngDimensions(await cachedThumbnail(id, project));
  return masterSummarySchema.parse({ id, filename: data.filename, candidate: metadata.candidate,
    adaptableCount: permissions.filter(permission => permission.adaptable).length,
    preview: { ...dimensions, url: masterAssetUrl(id, "thumbnail") }, pdfUrl: masterAssetUrl(id, "pdf") });
}
async function cachedThumbnail(id: string, project: string): Promise<Uint8Array> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 86400, expire: 604800 });
  const { data, error } = await createSupabaseServerClient().from("confirmed_master_resumes").select("preview:content->preview").eq("id", id).single();
  if (error || !data) throw new ResumeUploadError("The confirmed master could not be found.", 404);
  const preview = masterPreviewSchema.safeParse(data.preview);
  if (preview.success) {
    const bytes = Buffer.from(preview.data.png, "base64");
    const dimensions = pngDimensions(bytes);
    if (dimensions.width !== preview.data.width || dimensions.height !== preview.data.height) throw new ResumeUploadError("The preview is invalid.", 502);
    return new Uint8Array(bytes);
  }
  // Legacy masters have immutable snapshots without a preview. Cache the derived
  // PNG privately on disk, without mutating that snapshot or calling the model.
  const directory = path.join(process.cwd(), "private", "master-previews", project);
  const filename = path.join(directory, `${id}-v1.png`);
  try { const bytes = await readFile(filename); pngDimensions(bytes); return new Uint8Array(bytes); } catch { /* Cold or damaged derived cache: regenerate. */ }
  const original = await readUploadedResume(createSupabaseServerClient(), id);
  const generated = await renderMasterPreview(original.bytes);
  const bytes = Buffer.from(generated.png, "base64");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, bytes, { mode: 0o600 }); await rename(temporary, filename); }
  finally { await rm(temporary, { force: true }); }
  return new Uint8Array(bytes);
}
async function cachedPdf(id: string, project: string): Promise<Uint8Array> {
  "use cache";
  cacheLife({ stale: 0, revalidate: 86400, expire: 604800 });
  void project;
  // Only confirmed versions are addressable; do not resolve the active pointer here.
  const { data, error } = await createSupabaseServerClient().from("confirmed_master_resumes").select("id").eq("id", id).single();
  if (error || !data) throw new ResumeUploadError("The confirmed master could not be found.", 404);
  return (await readUploadedResume(createSupabaseServerClient(), id)).bytes;
}
