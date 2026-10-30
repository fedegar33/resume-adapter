import "server-only";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { MAX_RESUME_BYTES, ResumeUploadError } from "@/lib/resumes/upload";

export const PDF2HTMLEX_IMAGE = "pdf2htmlex/pdf2htmlex@sha256:83899e54f842fda9ca531aea6f30342b0cab4933a246dfc336d63b3e696c9990";
const MAX_HTML_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 120_000;

// The command is constant. PDF bytes travel over stdin, never through shell
// interpolation, host mounts, environment variables, or command arguments.
const CONVERT_COMMAND = "cat > /work/input.pdf && pdf2htmlEX --embed CFIJO --split-pages 0 --dest-dir /work /work/input.pdf result.html 1>&2 && cat /work/result.html";

export async function convertPdfToHtml(bytes: Uint8Array): Promise<string> {
  if (!bytes.length || bytes.length > MAX_RESUME_BYTES) throw new ResumeUploadError("Choose a PDF of 10 MB or smaller.", 413);
  const docker = process.env.PDF2HTMLEX_DOCKER_PATH || "docker";
  const name = `resume-html-${randomUUID()}`;
  const args = [
    "run", "--rm", "--pull", "never", "--name", name, "--interactive",
    "--platform", "linux/amd64", "--network", "none", "--read-only",
    "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
    "--memory", "512m", "--cpus", "1", "--pids-limit", "64", "--user", "65534:65534",
    "--tmpfs", "/work:rw,size=128m,mode=1777", "--tmpfs", "/tmp:rw,size=128m,mode=1777",
    "--env", "HOME=/tmp", "--workdir", "/work", "--entrypoint", "/bin/sh",
    PDF2HTMLEX_IMAGE, "-c", CONVERT_COMMAND,
  ];
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(docker, args, { stdio: ["pipe", "pipe", "pipe"] });
      const chunks: Buffer[] = [];
      let size = 0;
      let diagnostics = "";
      let failure: ResumeUploadError | undefined;
      const stop = (error: ResumeUploadError) => { failure ??= error; child.kill("SIGKILL"); };
      const timeout = setTimeout(() => stop(new ResumeUploadError("HTML conversion timed out. Your uploaded PDF is still stored.", 504)), TIMEOUT_MS);
      child.stdout.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_HTML_BYTES) stop(new ResumeUploadError("The generated HTML is too large to preview. Your uploaded PDF is still stored.", 413));
        else chunks.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => { if (diagnostics.length < 8192) diagnostics += chunk.toString("utf8").slice(0, 8192 - diagnostics.length); });
      child.stdin.on("error", () => { /* Early process failure is handled on close. */ });
      child.on("error", () => { failure ??= new ResumeUploadError("Docker could not be started. Install Docker Desktop or check PDF2HTMLEX_DOCKER_PATH.", 503); });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (failure) return reject(failure);
        if (code !== 0) {
          if (/cannot connect|failed to connect|is the docker daemon running/i.test(diagnostics)) return reject(new ResumeUploadError("Start Docker Desktop, then upload the PDF again. Your uploaded PDF is still stored.", 503));
          if (/no such image|pull access denied|not found.*sha256/i.test(diagnostics)) return reject(new ResumeUploadError("The pdf2htmlEX image is missing. Run pnpm pdf:setup, then try again.", 503));
          return reject(new ResumeUploadError("pdf2htmlEX could not convert this PDF. Your uploaded PDF is still stored.", 502));
        }
        const html = Buffer.concat(chunks).toString("utf8");
        if (!/<html[\s>]/i.test(html) || !/<\/html>/i.test(html)) return reject(new ResumeUploadError("pdf2htmlEX returned an incomplete HTML document.", 502));
        resolve(html);
      });
      child.stdin.end(bytes);
    });
  } catch (error) {
    // Killing the CLI alone may leave its container running. Remove only this
    // request's generated name; no other Docker resources are touched.
    await new Promise<void>((resolve) => { execFile(docker, ["rm", "--force", name], { timeout: 10_000 }, () => resolve()); });
    throw error;
  }
}
