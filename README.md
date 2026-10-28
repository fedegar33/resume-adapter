# Resume Adapter

Scaffold for a personal tool that adapts an English resume to a job description
and lets the user review changes before downloading a PDF.

**Status:** scaffolding and integration setup are ready. Product workflows are
not implemented yet. Confirmed scope is in [docs/PROJECT.md](docs/PROJECT.md),
and agent instructions are in [AGENTS.md](AGENTS.md).

## Local development

Requirements: Node.js 24 and pnpm 10.33.2 (pinned in `package.json`).

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. The initial page works without credentials.
`pnpm install`, `pnpm dev`, and `pnpm build` prepare local Monaco and PDF.js
assets; `public/vendor` is generated and excluded from Git. If installation
scripts were skipped, run `pnpm assets:prepare`.

```sh
pnpm check      # ESLint + route type generation + TypeScript
pnpm build     # Production build
pnpm start     # Serve the production build
```

There is no test suite or eval setup yet. ESLint 9 is retained for compatibility
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
| `SUPABASE_STORAGE_BUCKET` | Planned private bucket name; defaults to `resumes` |

OpenAI and Supabase validate variables when their clients are constructed, not
at module import or build time. Braintrust starts through `src/instrumentation.ts`
for the `resume-adapter` project and discovers credentials through the SDK.
The Next.js config wrapper enables auto-instrumentation. Traces may contain
inputs and outputs from future calls.

Accounts, remote resources, tables, and the bucket are not set up.
The app does not call OpenAI, upload files, or send sample traces.
Authentication/access control remain pending; there are no data or generation endpoints.

## Structure

```text
src/
  app/                         # Layout, Tailwind styles, and initial page
  components/editor/           # Client-side Monaco DiffEditor wrapper
  lib/
    ai/model.server.ts         # OpenAI model factory
    env.server.ts              # Configuration validation with Zod
    markdown/processor.ts      # Parsing/serialization with unified + remark
    observability/             # Braintrust telemetry registration for AI SDK 7
    pdf/                       # PDF.js configuration and initial PDF styles
    supabase/server.ts         # Privileged server-only client
  instrumentation.ts           # Node observability initialization
scripts/prepare-assets.mjs      # Copies installed package assets to public/vendor
docs/PROJECT.md                # Decisions, scope, pending work, and next phase
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
  Authorization and Storage/DB operations will be implemented later.
- **Monaco:** `ResumeDiffEditor`, side-by-side Markdown, a read-only original,
  an editable proposal, and visual line wrapping. It exposes `onMount` for editor
  access; block approval and saving are pending. It is not mounted on the home page.
- **PDF.js:** `getPdfReader()` loads the module in the browser and configures its worker.
  Use `pdfReaderOptions` when calling `getDocument` to load local assets.
  Resume extraction and conversion are not implemented yet.
- **React PDF:** Letter page size and base styles; the template and complete
  Instrument Sans / EB Garamond font files remain pending. Next automatically
  externalizes this package on the backend.
- **Markdown:** a standard parsing/serialization processor. It does not yet enforce
  the product's allowed node subset; do not use it as a sanitizer or HTML renderer.

The native scripts for `braintrust` and `esbuild` are explicitly allowed in
`pnpm-workspace.yaml`. No eval configuration or cloud resources have been added.

Keep resumes and personal documents outside `public/` and the repository.
For local working files, `private/`, `tmp/`, and `output/` are ignored.
