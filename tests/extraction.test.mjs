import assert from "node:assert/strict";
import { test } from "node:test";
import { resumeTextToMarkdown, safeLink } from "@/lib/pdf/text-to-markdown";

const fragment = (text, y, options = {}) => ({ text, x: 72, y, width: text.length * 5, height: 11, font: "body", ...options });

test("build sections and project headings, join wrapped lines, and preserve dates and employers", () => {
  const markdown = resumeTextToMarkdown([{ number: 1, fragments: [
    fragment("Alex Example", 60, { height: 25, font: "name" }),
    fragment("Professional Summary", 110, { height: 14, font: "heading" }),
    fragment("Software engineer building reliable services", 135),
    fragment("and thoughtful user interfaces.", 149),
    fragment("Experience", 190, { height: 14, font: "heading" }),
    fragment("Example Company", 217, { font: "bold" }),
    fragment("Senior Engineer | January 2020 - Present", 237),
    fragment("Payments Project", 270, { font: "bold" }),
    fragment("Maintained the payment service and supported", 293),
    fragment("existing integrations without changing chronology.", 307),
  ] }]);
  assert.match(markdown, /^# Alex Example/);
  assert.match(markdown, /## Professional Summary/);
  assert.match(markdown, /## Experience/);
  assert.match(markdown, /### Example Company/);
  assert.match(markdown, /^#### Payments Project$/m);
  assert.match(markdown, /January 2020 - Present/);
  assert.match(markdown, /reliable services and thoughtful user interfaces\./);
  assert.match(markdown, /supported existing integrations/);
});

test("rejoin a paragraph across pages without merging a new section or complete paragraph", () => {
  const markdown = resumeTextToMarkdown([
    { number: 1, fragments: [fragment("Experience", 60, { height: 14 }), fragment("Built services for", 720)] },
    { number: 2, fragments: [fragment("customers across several markets.", 60), fragment("A separate paragraph.", 100), fragment("Education", 150, { height: 14 }), fragment("Example University", 176)] },
  ]);
  assert.match(markdown, /Built services for customers across several markets\./);
  assert.match(markdown, /markets\.\n\nA separate paragraph\.\n\n## Education/);
});

test("same-font adjacent complete paragraphs across a page boundary remain distinct", () => {
  assert.equal(resumeTextToMarkdown([
    { number: 1, fragments: [fragment("Completed a project.", 720)] },
    { number: 2, fragments: [fragment("another paragraph begins here.", 60)] },
  ]), "Completed a project.\n\nanother paragraph begins here.\n");
});

test("preserve bullets, distinguish paragraph gaps, and keep source order", () => {
  const markdown = resumeTextToMarkdown([{ number: 1, fragments: [
    fragment("• First responsibility", 100),
    fragment("continued on the next line.", 114, { x: 84 }),
    fragment("• Second responsibility.", 138),
    fragment("A separate description with a large gap.", 180),
  ] }]);
  assert.equal(markdown, "- First responsibility continued on the next line.\n- Second responsibility.\n\nA separate description with a large gap.\n");
});

test("sort text fragments by position, preserve spaces, and keep safe source links", () => {
  const markdown = resumeTextToMarkdown([{ number: 1, fragments: [
    fragment("Portfolio", 100, { x: 121, link: "https://example.com/work" }),
    fragment("Contact:", 100, { x: 72, width: 42 }),
    fragment("Engineer", 140, { x: 130 }),
    fragment("Software", 140, { x: 72, width: 50 }),
  ] }]);
  assert.match(markdown, /Contact: \[Portfolio\]\(<https:\/\/example.com\/work>\)/);
  assert.match(markdown, /Software Engineer/);
  assert.equal(safeLink("javascript:alert(1)"), undefined);
  assert.equal(safeLink("data:text/html,<script>"), undefined);
  assert.equal(safeLink("mailto:person@example.com"), "mailto:person@example.com");
});

test("escape Markdown/HTML from PDF text and report no selectable text as empty", () => {
  assert.equal(resumeTextToMarkdown([{ number: 1, fragments: [] }]), "");
  const markdown = resumeTextToMarkdown([{ number: 1, fragments: [fragment("<script>*do not execute*</script>", 100)] }]);
  assert.match(markdown, /\\<script\\>\\\*do not execute\\\*/);
  assert.equal(markdown.includes("<script>"), false);
});
