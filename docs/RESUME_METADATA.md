# Resume metadata from the complete PDF

The working `/` flow now uploads the PDF, extracts candidate details with the LLM,
then converts it with pdf2htmlEX.

## Setup

Keep the existing private Supabase upload and Docker setup. Configure
`OPENAI_API_KEY`, `OPENAI_MODEL` and `OPENAI_REASONING_EFFORT` in `.env.local` and
restart `pnpm dev`. Extraction itself needs no new dependency or table. The real
wizard also requires the confirmed-master migration in [SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Input and output

`POST /api/master-resume/analyze` accepts only an existing upload UUID. After the
same local-development checks as upload/conversion, the backend reads that PDF
from private Storage and attaches its full bytes as `application/pdf` to the
configured OpenAI Responses model. No public URL or separate Files API upload is
needed. The model receives the PDF, not converted HTML or extracted text alone;
OpenAI's vision-capable PDF input includes text and page images.

The strict structured response identifies a resume and extracts only candidate
name, role and top-level section titles. The role is the explicit professional
headline when available, otherwise the most recent unambiguous printed job title.
Missing/uncertain name and role remain null. Section titles retain wording,
language and reading order. Repeated page-break headings are deduplicated.

The returned `metadata` object contains `schemaVersion`, `uploadId`, `candidate`
(name/role), and `sections` (server-generated UUID/title). UUIDs are stable within
this result and retained in its confirmed master snapshot. They are not linked
to converted HTML elements.
A non-resume returns 422. Invalid/truncated/refused model output returns a safe
error. The browser displays extracted details and expandable JSON read-only.
Check semantic accuracy against the original: schema validation does not prove
that the model identified the correct name, role or section boundary.

## Boundaries

The call has no tools, agent loop, retries, rewriting or style correction. There
is a 120-second timeout and a 2,500-token output cap. pdf2htmlEX still owns HTML
conversion. Upload → Reading resume → Converting must all succeed before showing
the section review. Replacement becomes active only after user confirmation. Failed processing preserves the stored upload and any
previous confirmed master; there is no automatic resubmission.

Before confirmation, extracted JSON and HTML remain in the tab. Confirmation
saves them with section permissions in an immutable master snapshot; reopening
restores that master without another model call. Unconfirmed reviews are not
restored. Semantic HTML mapping and actual adaptation remain pending. The real
wizard applies the approved minimal visual design.

Braintrust uses automatic AI SDK 7 traces with inputs disabled and outputs enabled.
Federico explicitly authorized logging the original filename and JSON result for
personal use on October 29, 2026. The parent `resume.extractMetadata` span includes
filename/upload ID metadata, a filename-only input, and the final normalized JSON.
Automatic child spans record the raw model output, model, usage and timing.
Provider errors are sanitized centrally; the PDF/prompt is not recorded as input.
OpenAI `store:false` is independent of this Braintrust logging policy.
See [OBSERVABILITY.md](OBSERVABILITY.md).

Tests use synthetic PDFs and mocked models/provider/Storage. They verify the exact
PDF bytes sent, structured output, missing facts, non-resume rejection, heading
order/deduplication, safe failures, local access and enabled output telemetry with input recording disabled.
No live OpenAI request or real CV upload is used during local verification.
