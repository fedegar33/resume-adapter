import assert from "node:assert/strict";
import { test } from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractResumeMarkdown } from "@/lib/pdf/extract.client";
import { makeResumePdf } from "./fixtures/resume.mjs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const fontPath = join(dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts/");

test("extract a real two-page PDF through PDF.js, including project hierarchy and page continuation", async () => {
  const task = getDocument({ data: new Uint8Array(makeResumePdf()), standardFontDataUrl: fontPath, verbosity: 0 });
  try {
    const markdown = await extractResumeMarkdown(await task.promise, new AbortController().signal);
    assert.match(markdown, /^# Alex Example/);
    assert.match(markdown, /## Professional Summary/);
    assert.match(markdown, /### Example Company/);
    assert.match(markdown, /^#### Payments Project$/m);
    assert.match(markdown, /Worked on existing integrations for customers across different markets\./);
    assert.match(markdown, /## Education/);
    for (const original of ["alex@example.com", "January 2020 - Present", "Example University", "2014 - 2018"]) assert.ok(markdown.includes(original));
  } finally {
    await task.destroy();
  }
});

test("image-only/empty pages return no Markdown without fabricating resume content", async () => {
  const task = getDocument({ data: new Uint8Array(makeResumePdf({ empty: true })), verbosity: 0 });
  try {
    assert.equal(await extractResumeMarkdown(await task.promise, new AbortController().signal), "");
  } finally {
    await task.destroy();
  }
});

test("cancelled extraction does not process the document", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(extractResumeMarkdown({ numPages: 2, getPage: () => { throw new Error("must not run"); } }, controller.signal), { name: "AbortError" });
});
