# Resume Adapter — project decisions

Confirmed with Federico on October 27, 2026. This document preserves planning
decisions; it is not a list of features that have already been built.

## Current status and authorization

The first authorized delivery covers structure, dependencies, configuration, and
documentation only. The home page is a placeholder.
Upload, resume extraction, adaptation, block review, application persistence,
and final PDF generation are not implemented.

## Goal

A simple, polished personal tool for adapting an English resume to a job
description, reviewing changes, and downloading a PDF copy. This is not a
multiuser product or a complete application tracking system.

## Agreed workflow

1. Upload a simple master PDF with selectable text.
2. Extract its text and organize it as Markdown; review/correct the conversion.
3. Validate a dedicated visual template resembling the original resume.
4. Save and activate the validated master.
5. Paste a job description; the LLM interprets its requirements.
6. Generate a moderate adaptation from the active master.
7. Compare the master and proposal side by side, with red/green and inline changes.
8. Accept/reject blocks and edit the proposal in Markdown.
9. Preview the actual PDF before finalizing.
10. Save the job description, exact master reference, and final PDF; download it.

## Master and storage

- One active, replaceable master. English only initially, without translation.
- Preserve the original PDF, approved Markdown, and template configuration.
- Replacing the master creates a new version: retain versions used by previous
  applications. Reference versions without duplicating PDFs for each application.
- Supabase Postgres for records; Supabase Storage for PDFs, in a private bucket.
- Each application stores the job description, master used, and final PDF. Do not
  save drafts, initial proposals, individual edits, or final Markdown by default.
- Unfinalized changes may be lost when the page is closed or reloaded.
- Database backups and file backups are separate concerns.

## Editing policy

| Section | Allowed changes |
| --- | --- |
| About / Professional Summary | Faithful rewriting with relevant emphasis |
| Experience | Adapt and moderately shorten descriptions |
| Stack / Skills | Select, group, and reorder existing technologies |
| Header, Education, Certifications, Languages | Preserve |

Experience retains all employers and projects in chronological order.
Preserve employers, job titles, dates, and the employer → project relationship.
The LLM must not invent metrics, technologies, responsibilities, or facts.
When evidence is missing, show questions/suggestions separately without blocking
the workflow. Do not impose a page count or artificially repeat keywords.

## Markdown, comparison, and PDF

- A limited Markdown subset: headings, paragraphs, lists, bold, and links.
- No tables, embedded HTML, arbitrary columns, or executable content.
- One logical line per paragraph, with visual line wrapping in the editor.
- Monaco with a read-only original on the left and an editable proposal on the right.
- Monaco computes textual differences. Semantic block approval, section protection,
  and review tracking remain application logic to be implemented.
- Rebuild the PDF using a dedicated template; do not patch the original PDF.
- Preserve the approximate style: fonts, colors, spacing, and margins. Allow extra
  pages and new logical page breaks when text length changes.
- Visually verify that there is no clipped/overlapping text or stranded headings.

## Inspected visual reference

The shared resume has three Letter pages, a single column, selectable text,
links, and no images. It does not require OCR. Experience contains employers
with nested projects and paragraph descriptions; bullets are not mandatory.

Physical page breaks in the original do not define blocks: one description and
one Education entry span pages and must be rejoined during extraction.

Style reference: Instrument Sans for body text; EB Garamond Bold for the name;
blue headings (#3D85C6), dark gray (#353744), body text around 11 pt, and a 72 pt
left margin. Final top/bottom margins will be adjusted in the template. The PDF
contains subset fonts: obtain complete font files or agree on replacements,
without assuming the embedded subsets can be reused for new text.
The personal resume stays outside the repository and `public/`.

## Selected stack and initial configuration

- Next.js App Router, React, TypeScript, Tailwind CSS; pnpm and Node 24.
- Webpack for dev/build and Tailwind via PostCSS. Turbopack could not compile in
  this task's environment because an internal port was blocked; this is not a product requirement.
- AI SDK 7 + the official OpenAI provider. On October 28, 2026, selected
  `gpt-6.1-sol` with `low` reasoning effort. Both are server-configured through
  `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT`, with no model selector in the UI.
  The model factory applies reasoning defaults through AI SDK middleware.
- Zod for structures and environment variables; it does not verify factual accuracy.
- Braintrust 3.40.0 for traces. Next.js auto-instrumentation through the config
  wrapper, with AI SDK 7 telemetry registration. The logger uses the fixed project
  `resume-adapter` and SDK credential discovery. It may record inputs/outputs.
  Tracing setup was updated on October 28, 2026; verification is static only,
  without running the application or sending sample traces.
- Evals will come later, defined in code; there is no dataset or scorer setup yet.
- Supabase JS with a backend secret client; no session auth/SSR integration yet.
- `monaco-editor` + `@monaco-editor/react`, serving installed assets locally.
- `pdfjs-dist` prepared with a local worker, CMaps, standard fonts, and WASM.
- `@react-pdf/renderer` for output; initial styles, without an implemented template.
- unified + remark-parse/stringify for Markdown parsing and serialization.
  Allowed-node validation is not implemented yet.

## Outside the MVP / explicit pending decisions

- URL extraction: pasted text only for now.
- OCR, protected or complex-layout PDFs; multiple active masters; translation.
- Draft recovery, per-edit history, and a visual WYSIWYG editor.
- Autonomous agents, RAG, embeddings, queues, and multiple providers/models in the UI.
- Hosting and access control/authentication remain pending. The intended deployment
  is a public website, but resumes and the bucket are not public. Before exposing
  operations on real data or paid API calls, decide who can invoke them.
- Remote Supabase resources, bucket, schema/migrations, and database types are pending.
- Complete font files and the final template remain pending.

## Suggested order once product implementation is authorized

1. Validate the round trip: reference PDF → reviewed Markdown → templated PDF.
2. Implement job interpretation and structured adaptation with OpenAI/Zod.
3. Implement block review on top of Monaco and the final preview.
4. Add immutable master persistence and finalized applications in Supabase.
5. Resolve access/deployment and introduce evals when that phase is defined.

## Technical references

- https://nextjs.org/docs/app
- https://tailwindcss.com/docs
- https://ai-sdk.dev/docs
- https://developers.openai.com/api/docs/models
- https://www.braintrust.dev/docs/integrations/sdk-integrations/vercel
- https://supabase.com/docs/guides/storage/buckets/fundamentals
- https://github.com/suren-atoyan/monaco-react
- https://mozilla.github.io/pdf.js/
- https://react-pdf.org/
- https://github.com/remarkjs/remark
