import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const vendor = join(root, "public/vendor");
const monacoRoot = dirname(dirname(dirname(require.resolve("monaco-editor"))));
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));

// Only generated vendor directories are replaced. Versions follow pnpm-lock.yaml.
for (const name of ["monaco", "pdfjs"]) {
  await rm(join(vendor, name), { recursive: true, force: true });
  await mkdir(join(vendor, name), { recursive: true });
}
await cp(join(monacoRoot, "min/vs"), join(vendor, "monaco/vs"), { recursive: true });
await cp(join(pdfjsRoot, "build/pdf.worker.min.mjs"), join(vendor, "pdfjs/pdf.worker.min.mjs"));
for (const name of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(join(pdfjsRoot, name), join(vendor, "pdfjs", name), { recursive: true });
}
console.log("Monaco and PDF.js assets prepared in public/vendor.");
