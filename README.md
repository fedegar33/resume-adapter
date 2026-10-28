# Resume Adapter

Personal tool that adapts an English resume to a job description
and lets the user review changes before downloading a PDF.

**Status:** local PDF upload, browser text extraction, and Markdown/PDF review
are implemented. Adaptation, template generation, and master activation remain planned. Confirmed scope is in [docs/PROJECT.md](docs/PROJECT.md),
and agent instructions are in [AGENTS.md](AGENTS.md).

## Local development

Requirements: Node.js 24 and pnpm 10.33.2 (pinned in `package.json`).

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://127.0.0.1:3000. The home page works without credentials; uploads
require Supabase. Follow [Supabase setup](docs/SUPABASE_SETUP.md) to configure
the existing private `resumes` bucket and apply the table migration. The dev
server binds to loopback; uploads are disabled outside development.
`pnpm install`, `pnpm dev`, and `pnpm build` prepare local Monaco and PDF.js
assets; `public/vendor` is generated and excluded from Git. If installation
scripts were skipped, run `pnpm assets:prepare`.

```sh
pnpm test       # Offline PDF validation and mocked Storage/DB behavior
pnpm check      # ESLint + route type generation + TypeScript
pnpm build     # Production build
pnpm start     # Serve the production build
```

There is no eval setup yet. ESLint 9 is retained for compatibility
with the peer dependencies of the `eslint-config-next` plugins; upgrade that
set together once their supported ranges include ESLint 10.

## Environment variables

All variables are server-side; do not use the `NEXT_PUBLIC_` prefix for credentials.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | Fixed OpenAI model; initially `gpt-6.1-sol` |
| `OPENAI_REASONING_EFFORT` | Default reasoning effort: `low`, `medium`, `high`, `xhigh`, or `max`; defaults to `low` |
| `BRAINTRUST_API_KEY` | Tracing credentials; discovered automatically by the SDK locally, set explicitly in production |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Backend secret key; never exposed to the browser |
| `SUPABASE_STORAGE_BUCKET` | Existing private bucket name; defaults to `resumes` |

OpenAI and Supabase validate variables when their clients are constructed, not
at module import or build time. Braintrust starts through `src/instrumentation.ts`
for the `resume-adapter` project and discovers credentials through the SDK.
The Next.js config wrapper enables auto-instrumentation. Traces may contain
inputs and outputs from future calls.

The user created the `resumes` bucket and reported working upload persistence.
For a new setup, apply the table migration manually; the agent has not independently
verified remote settings. Each successful upload stores an
independent PDF and a `master_resume_uploads` record, without activating a master.
Public authentication/access control remain pending; the endpoint accepts only
same-origin local development requests. There are no AI/generation endpoints.

After upload, the browser extracts text from the selected PDF and proposes
Markdown in an editor on the right, with the original PDF on the left. The PDF
preview displays all pages in a vertically scrollable panel. Small
screens switch views. Review the conversion carefully: section/project detection
and paragraph joining are heuristic. PDFs without selectable text need manual
typing/pasting; OCR is not implemented. Corrections stay in the current tab and
are lost on reload; saving/activating a master belongs to the next phase. No AI
calls or extra Storage downloads are used for this review.

## Structure

```text
src/
  app/                         # Layout, home, and local upload endpoint
  components/editor/           # Markdown editor and adaptation DiffEditor wrapper
  components/pdf/              # Original PDF canvas viewer
  components/resume-workspace.tsx # Upload and content review workflow
  lib/
    ai/model.server.ts         # OpenAI model factory
    env.server.ts              # Configuration validation with Zod
    markdown/processor.ts      # Parsing/serialization with unified + remark
    observability/             # Braintrust telemetry registration for AI SDK 7
    pdf/                       # Browser extraction, Node validation, and PDF styles
    resumes/                   # Upload validation and Storage/DB persistence
    supabase/server.ts         # Privileged server-only client
  instrumentation.ts           # Node observability initialization
scripts/prepare-assets.mjs      # Copies installed package assets to public/vendor
docs/PROJECT.md                # Decisions, scope, pending work, and next phase
docs/SUPABASE_SETUP.md          # Manual bucket/table setup and verification
supabase/migrations/            # SQL to apply manually
tests/                         # Offline upload and synthetic-PDF extraction tests
```

## Prepared integrations

- **Next.js / React / TypeScript / Tailwind:** App Router, `@/*` alias, strict
  typing, ESLint, and Tailwind with PostCSS. Dev/build use Webpack: Turbopack
  requires an internal port that this task's execution environment blocks.
- **AI SDK / OpenAI / Zod:** `getResumeModel()` factory using the Responses API
  and validated configuration. Default reasoning effort is applied through AI SDK
  middleware; explicit per-call provider options can override it. Business prompts
  and schemas are pending.
- **Braintrust:** `registerTelemetry(braintrustAISDKTelemetry())` for AI SDK 7.
  Do not use the AI SDK 3–6 wrapper. Evals and scorers are deferred.
- **Supabase:** `createSupabaseServerClient()` factory without persistent sessions.
  Local PDF upload writes to a private bucket and `master_resume_uploads`, with
  compensating cleanup after a rejected insert. Public authorization is pending.
- **Monaco:** `ResumeDiffEditor`, side-by-side Markdown, a read-only original,
  an editable proposal, and visual line wrapping. It exposes `onMount` for editor
  access; block approval and saving are pending. The upload review uses a separate
  single Markdown editor; the DiffEditor is not mounted on the home page.
- **PDF.js:** `getPdfReader()` loads the module in the browser and configures its worker.
  Use `pdfReaderOptions` when calling `getDocument` to load local assets.
  A separate Node-only legacy reader validates uploaded PDFs without rendering
  or extracting text. The browser reader extracts positional text into proposed
  Markdown and renders the original PDF in the review panel.
- **React PDF:** Letter page size and base styles; the template and complete
  Instrument Sans / EB Garamond font files remain pending. Next automatically
  externalizes this package on the backend.
- **Markdown:** a standard parsing/serialization processor. It does not yet enforce
  the product's allowed node subset; do not use it as a sanitizer or HTML renderer.

The native scripts for `braintrust` and `esbuild` are explicitly allowed in
`pnpm-workspace.yaml`. No eval configuration or remote resources have been created by the agent.

Keep resumes and personal documents outside `public/` and the repository.
For local working files, `private/`, `tmp/`, and `output/` are ignored.
