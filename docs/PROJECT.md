# Resume Adapter — project decisions

Current state after cleanup on October 30, 2026. This document distinguishes
working functionality from approved design and future product work.

## Goal and boundaries

A simple personal tool for adapting Federico's English CV to a pasted job
description, reviewing changes, and downloading a PDF. Target this CV rather
than a general-purpose importer or multiuser application tracking system.

- The wizard supports one active confirmed master. Every future adaptation starts
  from that master.
- Preserve employers/projects, chronology, job titles and dates. Do not invent
  responsibilities, metrics, skills, technologies or other facts.
- On October 29, Federico replaced the About/Experience/Stack-only restriction:
  every extracted section can be selected as adaptable. Detailed adaptation
  semantics are deferred; this delivery stores eligibility without implementing
  editing or adaptation.
- Keep personal CVs, secrets and exported traces out of the repository/public assets.
- No OCR, translation, RAG, autonomous agents, queues, draft history or authentication
  has been added. Public hosting/access control is unresolved; data endpoints are
  restricted to same-origin local development.

## Working flow on `/`

1. Validate an unencrypted, readable PDF: nonempty, at most 10 MB, real signature
   and page tree. Validation alone does not prove it is a CV.
2. Upload an independent private object at `masters/<uuid>.pdf` in the existing
   `resumes` bucket and insert metadata in `master_resume_uploads`. Repeated
   filenames create separate uploads. A rejected insert triggers compensating
   object cleanup; an ambiguous response preserves the possibly referenced PDF.
3. Read the authoritative private PDF and send its complete bytes inline to the
   configured OpenAI Responses model. Extract CV classification, name, role and
   ordered top-level section headings with a strict structured response.
4. Prefer the explicit headline role, otherwise the most recent unambiguous printed
   title. Unknown name/role stays null. Preserve unfamiliar headings; deduplicate
   repeated page headings and generate metadata section UUIDs on the server.
5. Reject non-resumes. Provider/schema/refusal/truncation failures show safe errors;
   there are no automatic retries, tools, or agent loops.
6. Convert the stored PDF with a pinned pdf2htmlEX Linux amd64 image in local Docker.
   Stream bytes over stdin with no host mounts/network or credentials in the
   container. Temporary files are removed. This image was verified on the arm64 Mac.
7. Present the approved wizard with real extracted candidate details and section
   checkboxes. Every section is eligible and initially selected. Missing candidate
   values remain unknown, and no headings are invented when extraction finds none.
8. Confirm the master to save candidate/sections, section eligibility and raw HTML
   in `confirmed_master_resumes`, referencing the original private upload. A single
   Postgres function inserts an immutable snapshot and switches the singleton
   `active_master_resume` pointer atomically. No original PDF is overwritten.
9. Restore the active master on future visits, without AI extraction or conversion.
   Ready shows a real first-page PDF thumbnail and the pending Create adaptation CTA.
10. The retired technical inspection UI and its unused helpers have been removed;
    extraction/conversion and confirmed content persistence continue.
11. Replace repeats upload/processing/review. The previous master remains
    active until successful confirmation. Canceling or failures preserve it.

States are Opening → Welcome → Uploading → Reading resume → Converting →
Section review → Confirming → Ready, plus safe error states.
Unconfirmed reviews are intentionally not restored: reopening returns to the
confirmed master or welcome, and a new upload is required. Original uploads from
abandoned reviews are retained; no cleanup/background job has been added.
Exact confirmation retries are idempotent. An expected active ID prevents another
tab's stale replacement from silently overwriting a newer selection.

Implementation requires the new manual migration
`202610290001_confirmed_master_resumes.sql` in the existing Supabase project.
The migration is prepared locally; it has not been applied remotely by the agent.
Existing upload installations need only this new migration, not the historical
content experiment. RLS/grants restrict tables/functions to the backend role;
GET readers require the local gate and a custom header to prevent cross-origin
browser reads. Production data routes remain disabled. Extracted content is
validated for shape, permissions must match section IDs exactly, and HTML remains
untrusted and isolated. Confirmation is user approval, not factual verification.
Metadata IDs still do not map to HTML elements. No adaptation endpoint exists.

Setup: [SUPABASE_SETUP.md](SUPABASE_SETUP.md), [RESUME_METADATA.md](RESUME_METADATA.md),
and [PDF_HTML.md](PDF_HTML.md).

## Approved design reference

The original design prototype was approved on October 29, 2026 and informed the
real wizard. On October 30, Federico requested deleting the separate prototype,
including its route, demo state, fictional PDF and generator. The real UI below
is now the reference; its shared fonts and licenses live in `src/app/fonts/`.

### Minimal real-wizard styling

Later on October 29, Federico approved a visual refinement for the real `/`
wizard, inspired by Interface Craft and federicogarcia.me.

- Warm white background `#FAF9F6`, charcoal text/buttons, warm neutral dividers.
- Keep EB Garamond headings and Instrument Sans UI, with 32–40 px headings,
  straightforward labels and no ornamental italic phrases or intro paragraphs.
- Welcome says **Your master resume** with **Add resume**. Section review says
  **Choose adaptable sections**, shows candidate name/role and checkboxes, and
  confirms with **Confirm master**. Compact processing labels show real progress.
- Ready uses two columns on desktop: the small PDF with **Replace** below its
  filename on the left, and candidate name/role and eligible-section count on the
  right. Inspect has been removed. Beneath the details, an adaptations region
  currently shows **Create your first adaptation** with **Create adaptation** below. This region is reserved
  for the future adaptation list; no list, persistence or creation flow is implemented.
  On mobile, stack the PDF above the content. No second decorative sheet/footer.
- This two-column layout and first-adaptation empty state were requested after
  the initially approved centered composition on October 29, 2026.
- The thumbnail is 210 px wide on desktop, 180 px on mobile, with a 16 px corner
  radius and soft shadow. It represents only the first page. Fine-pointer hover
  scales the preview to 1.025 over 180 ms and returns smoothly; the hover wrapper
  is separate from the pop so the transforms do not compete. The hit area stays
  stationary. Touch devices and reduced-motion mode do not use hover scaling.
- After the persisted preview image loads (originally after PDF.js rendering),
  play a 500 ms pop on every ready-screen entry,
  including reload and canceled replacement: opacity 0→1, rotateX -12°→1.5°→0°,
  scale .9→1.1→1. The peak occurs at 300 ms. No loop or resting rotation.
- Reduced motion uses a 120 ms opacity-only fade, without scale or rotation.
  Motion uses CSS transform/opacity only, without adding dependencies. Color/font tokens live in `src/app/globals.css`;
  the animation storyboard and sequence keyframes live in `src/app/wizard.css`.
- The real wizard uses Tailwind utilities and dedicated animation sequences.
  Persistence and adaptation scope are unchanged.

### SSR, cache and PDF viewer

Approved and implemented October 30, 2026 after a grilling session. The initial
client restore waterfall is replaced by server-rendered master summary data and a
stable skeleton. The mutable active pointer is read fresh; immutable summary,
thumbnail and PDF reads use Next Cache Components by master ID/project namespace.
No converted HTML is sent in the initial UI payload. Versioned private HTTP assets
cache for one day with ETags; the open page reuses its PDF promise/File.

New confirmations generate a first-page PNG from the authoritative PDF on the
server and store it in the existing snapshot JSON. No new SQL migration or Storage
bucket policy is required for this change. Older snapshots generate a local
private derived PNG on first read without mutating historical content. See
[CACHING.md](CACHING.md) for exact policies, storage and cache lifetimes.

The thumbnail now opens a PDF-only scrollable viewer with a dim overlay. Motion
uses shared layout between thumbnail and viewer; Radix provides accessible modal
behavior with overlay/Escape and a close icon inside the top-right corner. Closing returns focus to the
thumbnail. Reduced motion uses fades. PDF download starts after the preview image,
and PDF.js/worker load on opening. Motion and Radix Dialog are the only added
packages. No adaptation flow or authentication/deployment work is included.

The preview disables selection/native image dragging locally. The expanded viewer
was widened another 10% after the first 20% increase (desktop cap 1003.2 px), keeping viewport-bounded height
and vertical scrolling; its close button sits inside the document at top right.

Offline verification uses synthetic data. An isolated local Next instance and
synthetic Supabase were tested for SSR, actual cache reuse, new active-pointer
reads, conditional 304, the complete viewer, mobile/reduced motion, and legacy
preview generation. Initial synthetic CLS measured 0. Live personal data/services
were not used. Existing API gates were adjusted to handle Next normalizing the
internal URL to localhost while preserving a validated loopback Host/Origin.

## Observability

Federico explicitly authorized logging original filenames and output JSON for
personal use on October 29, 2026. Braintrust uses AI SDK 7 automatic telemetry,
with PDF/prompt input recording disabled and output recording enabled.
A native `traced` parent attaches authoritative filename/upload ID and the final
application JSON; child traces contain raw model output, timings and token usage.
Provider errors are sanitized centrally. No custom per-call recorder is needed.
See [OBSERVABILITY.md](OBSERVABILITY.md).

## Current stack and verification

Next.js App Router, React, strict TypeScript, Tailwind, pnpm 10.33.2 and Node 24.
AI SDK 7 + OpenAI, Zod, Braintrust 3.40.0, Supabase Postgres/Storage and PDF.js.
The model remains server-configured (`gpt-6.1-sol`, low reasoning initially).
React PDF, Monaco and unified/remark were removed because no current feature
uses them.

Run `pnpm test`, `pnpm check` and `pnpm build` after relevant changes. Verification
uses synthetic PDFs, mocked provider/Storage/DB/Docker calls, and browser tests.
Actual pdf2htmlEX output was also checked using synthetic data. The real wizard
was checked in a browser with synthetic PDFs and intercepted API responses,
including restore, selection, cancellation, replacement, failure preservation,
discarded unconfirmed reviews, mobile layout and reduced motion. The new SQL
transaction has not been run against the remote database. Federico reported
good results with his CV; the agent does not upload real CVs, run paid model
calls or send live traces as part of local verification.

## Remaining work

- Apply the prepared confirmed-master migration to the existing Supabase project
  and verify the real workflow with a user-selected file.
- Define detailed adaptation rules for selectable sections before implementing
  adaptation. Any section can be selected; eligibility alone is not an editor.
- Evaluate how converted HTML can identify editable semantic blocks and reflow
  when descriptions change length. Representation and final PDF rendering remain
  open decisions; do not assume fixed-position HTML already handles this.
- Implement job interpretation, adaptation from the master, accept/reject review,
  preview and final PDF download. Review/diff tooling will be chosen when needed.
- Preserve immutable master versions used by finalized applications; each finalized
  application should reference its master, job description and final PDF.
- Resolve access/deployment and add evals later. The visual review agent is deferred.

## Visual reference

The reference CV has three Letter pages, one column, selectable text, links and no
images. Experience has employers with projects and paragraphs. A description and
an Education entry cross page breaks; physical page breaks do not define blocks.
Original styling: Instrument Sans body, EB Garamond Bold name, blue headings
(#3D85C6), dark gray (#353744), about 11 pt body and 72 pt left margin. New text
must not rely on embedded subset fonts. Complete fonts are available for the
real UI; a real export template remains pending.

## Historical deliveries and cleanup

- Upload was committed/pushed as `7cceed8`; heuristic Markdown review as `826445c`.
- Whole-document Markdown, source-grounded full-content JSON, section editing and
  immutable reviewed-content saving were experiments, superseded by the current
  full-PDF metadata + pdf2htmlEX flow.
- On October 29, 2026 Federico authorized removing unused experiment code. The old
  extractors, review schemas, editor components, their tests/fixtures and unused
  Monaco/Markdown dependencies were removed. Active behavior and approved prototype
  remain intact. Historical setup instructions were replaced with current guides.
- `202610280002_master_resume_contents.sql` remains as migration history because
  it may already have been applied. It is unused and not required by the current
  app. No remote schema/data changes or cleanup were performed.

## Tailwind styling

On October 30, 2026, the real wizard, SSR skeleton and PDF viewer were migrated
to the already installed Tailwind CSS 4 pipeline. Layout, responsive rules,
colors, typography and control states now use utilities. Shared Tailwind recipes
in `src/components/wizard-styles.ts` keep skeleton and ready geometry aligned;
`src/app/globals.css` defines the palette and font theme tokens.
`src/app/wizard.css` retains only the scene/pop animation sequences and their
reduced-motion/hover handling. No package changes were needed.
The separate prototype was subsequently removed during cleanup. Converted
master HTML remains untouched.

## October 30 cleanup

Removed the separate prototype route/components/data/CSS, fictional PDF and
generator, unused italic font, and `@react-pdf/renderer` with its exclusive
transitive dependencies. Retained the two UI fonts and their OFL licenses.
Removed the unreachable inspection/upload UI and static HTML preview wrapper.
The original PDF viewer now has one mode, used by the modal.
Removed `/api/master-resume/active` and `/api/master-resume/pdf`, their full-snapshot
reader and unused schema/types: SSR and versioned assets supersede them. Tests
now exercise the current readers and endpoints. Conversion and raw HTML
persistence remain active; the two setup/assets scripts and historical SQL
migrations remain necessary. No local personal documents or remote data were deleted.
