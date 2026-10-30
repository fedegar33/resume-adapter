import { z } from "zod";
import { resumeMetadataSchema } from "@/lib/resumes/metadata";

export const MAX_MASTER_HTML_BYTES = 32 * 1024 * 1024;
export const masterPreviewSchema = z.object({
  version: z.literal(1), width: z.number().int().min(1).max(4096), height: z.number().int().min(1).max(4096),
  png: z.string().min(1).max(3 * 1024 * 1024),
}).strict();
export type MasterPreview = z.infer<typeof masterPreviewSchema>;
export const masterContentSchema = z.object({
  metadata: resumeMetadataSchema,
  preview: masterPreviewSchema.optional(),
  html: z.string().min(1).refine(value => value.trim().length > 0).refine(value => new TextEncoder().encode(value).length <= MAX_MASTER_HTML_BYTES),
  permissions: z.array(z.object({ sectionId: z.uuid(), adaptable: z.boolean() }).strict()).max(50),
}).strict().superRefine((value, context) => {
  const ids = value.metadata.sections.map(section => section.id);
  const permissionIds = value.permissions.map(permission => permission.sectionId);
  if (new Set(ids).size !== ids.length || new Set(permissionIds).size !== permissionIds.length || ids.length !== permissionIds.length || ids.some(id => !permissionIds.includes(id))) {
    context.addIssue({ code: "custom", message: "Permissions must match the extracted sections exactly." });
  }
});

export const confirmMasterSchema = z.object({
  content: masterContentSchema,
  expectedActiveId: z.uuid().nullable(),
}).strict();
export type MasterContent = z.infer<typeof masterContentSchema>;

export const masterSummarySchema = z.object({
  id: z.uuid(), filename: z.string().min(1), candidate: resumeMetadataSchema.shape.candidate,
  adaptableCount: z.number().int().min(0).max(50),
  preview: z.object({ width: z.number().positive(), height: z.number().positive(), url: z.string() }),
  pdfUrl: z.string(),
});
export type MasterSummary = z.infer<typeof masterSummarySchema>;
