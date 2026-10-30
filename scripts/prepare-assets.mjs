import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const vendor = join(root, "public/vendor");
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));

// Only generated vendor directories are replaced. Versions follow pnpm-lock.yaml.
// Clean the retired editor assets left by earlier installations.
await rm(join(vendor, "monaco"), { recursive: true, force: true });
await rm(join(vendor, "pdfjs"), { recursive: true, force: true });
await mkdir(join(vendor, "pdfjs"), { recursive: true });
await cp(join(pdfjsRoot, "build/pdf.worker.min.mjs"), join(vendor, "pdfjs/pdf.worker.min.mjs"));
for (const name of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(join(pdfjsRoot, name), join(vendor, "pdfjs", name), { recursive: true });
}
console.log("PDF.js assets prepared in public/vendor.");
