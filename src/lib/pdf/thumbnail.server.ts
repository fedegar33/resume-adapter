import "server-only";
import { createRequire } from "node:module";
import path from "node:path";
import { ResumeUploadError } from "@/lib/resumes/upload";
import type { MasterPreview } from "@/lib/resumes/master";

export function pngDimensions(bytes: Uint8Array) {
  const png = Buffer.from(bytes);
  if (png.length < 24 || png.length > 2 * 1024 * 1024 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new ResumeUploadError("The master preview could not be read.", 502);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (!width || !height || width > 4096 || height > 4096) throw new ResumeUploadError("Invalid preview dimensions.", 502);
  return { width, height };
}

export async function renderMasterPreview(bytes: Uint8Array): Promise<MasterPreview> {
  const require = createRequire(import.meta.url);
  const root = path.dirname(require.resolve("pdfjs-dist/package.json"));
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: new Uint8Array(bytes), useWorkerFetch: false, enableXfa: false, verbosity: 0,
    standardFontDataUrl: `${root}/standard_fonts/`, cMapUrl: `${root}/cmaps/`, cMapPacked: true, wasmUrl: `${root}/wasm/` });
  try {
    const document = await task.promise;
    const page = await document.getPage(1);
    const original = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(640 / original.width, 4096 / original.height) });
    // PDF.js's NodeCanvasFactory uses its installed @napi-rs/canvas dependency.
    const factory = document.canvasFactory as { create(width: number, height: number): { canvas: HTMLCanvasElement & { toBuffer(type: string): Buffer }; context: CanvasRenderingContext2D }; destroy(target: unknown): void };
    const target = factory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    try {
      await page.render({ canvas: target.canvas, canvasContext: target.context, viewport, background: "#ffffff" }).promise;
      const png = target.canvas.toBuffer("image/png");
      return { version: 1, ...pngDimensions(png), png: png.toString("base64") };
    } finally { factory.destroy(target); }
  } catch { throw new ResumeUploadError("The resume preview could not be prepared. Please retry.", 502); }
  finally { await task.destroy(); }
}
