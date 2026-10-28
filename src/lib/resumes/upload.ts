export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export class ResumeUploadError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "ResumeUploadError";
  }
}
