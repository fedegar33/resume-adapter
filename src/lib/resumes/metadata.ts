import { z } from "zod";

export const extractedMetadataSchema = z.object({
  isResume: z.boolean(),
  name: z.string().trim().min(1).max(200).nullable(),
  role: z.string().trim().min(1).max(200).nullable(),
  sections: z.array(z.object({ title: z.string().trim().min(1).max(200) }).strict()).max(50),
}).strict();

export const resumeMetadataSchema = z.object({
  schemaVersion: z.literal(1), uploadId: z.uuid(),
  candidate: z.object({ name: z.string().min(1).max(200).nullable(), role: z.string().min(1).max(200).nullable() }).strict(),
  sections: z.array(z.object({ id: z.uuid(), title: z.string().min(1).max(200) }).strict()).max(50),
}).strict();
export type ResumeMetadata = z.infer<typeof resumeMetadataSchema>;
