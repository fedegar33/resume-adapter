# Resume Adapter

Personal tool for adapting an English CV to a job description. Current functionality:
PDF upload to private Supabase Storage, candidate/section extraction with the LLM,
PDF-to-HTML conversion with pdf2htmlEX, and the approved master wizard with
confirmation, replacement, server-rendered restoration and an animated PDF viewer. Job adaptation remains pending. See [project decisions](docs/PROJECT.md) and [AGENTS.md](AGENTS.md).

## Local development

Requirements: Node.js 24, pnpm 10.33.2, and Docker Desktop for HTML conversion.

```sh
pnpm install
cp .env.example .env.local
pnpm pdf:setup
pnpm dev
```

Open http://127.0.0.1:3000. Follow [Supabase setup](docs/SUPABASE_SETUP.md),
[metadata extraction](docs/RESUME_METADATA.md), and [PDF-to-HTML setup](docs/PDF_HTML.md).
Builds need no credentials; the home reads the active master
server-side in development and needs the existing Supabase configuration. Keep Docker
Desktop running while using conversion. Endpoints accept only same-origin local
development requests; production access/authentication remains unresolved.

```sh
pnpm test       # Offline upload, metadata, conversion and API behavior
pnpm check      # ESLint + route types + TypeScript
pnpm build     # Production build (data endpoints remain disabled)
pnpm start     # Serve the production build
```

`pnpm install`, `pnpm dev`, and `pnpm build` prepare installed PDF.js assets in
`public/vendor`, which is generated and ignored. Run `pnpm assets:prepare` if
installation scripts were skipped. Dev/build use Webpack because Turbopack's
internal port was blocked in the original execution environment. ESLint 9 is
retained for compatibility with the eslint-config-next peer dependency set.

## Current flow

The approved three-screen wizard now runs on `/`:

1. **Add resume** validates/uploads a PDF, extracts candidate/sections,
   and converts the stored original to HTML with local Docker.
2. Review the candidate and choose adaptable sections. All extracted sections are
   eligible and initially checked. **Confirm master** saves the metadata,
   raw HTML and exact permission choices in a confirmed snapshot.
3. The ready screen shows the real PDF on the left, master details and a
   **Create your first adaptation** empty state on the right, with its CTA below
   (a pending feature). The right-hand region will hold future adaptations.
   **Replace** sits under the PDF filename on the left. The retired inspection UI has been removed. Hover gently scales the thumbnail on
   pointer devices; reduced motion disables that effect.

On return, Next renders the confirmed master directly on the server, with a
stable skeleton while data loads. A persisted first-page PNG replaces initial
browser PDF rendering. Clicking it opens the full scrollable PDF over an overlay,
with a Motion shared transition. PDF download is prefetched after the image, and
PDF.js loads only when opening the viewer. See [loading and cache details](docs/CACHING.md).
**Replace** starts another upload; the current master stays active until
confirmation succeeds. Canceling or processing failures preserve it. Unconfirmed
reviews are not restored after closing the page; uploaded PDFs remain stored.

Apply the new [master migration](supabase/migrations/202610290001_confirmed_master_resumes.sql)
once in the existing Supabase project before using the wizard. See
[Supabase setup](docs/SUPABASE_SETUP.md). The app does not run migrations itself.
The active pointer switches transactionally; old snapshots stay immutable.
Concurrent replacement from another tab requires reloading. Exact confirmation
retries after a lost response are idempotent.

Missing name/role stays null. There is no candidate editor or semantic HTML editing.
Checkboxes store section eligibility only; detailed adaptation behavior is deferred.
No automatic OpenAI calls occur when restoring or viewing a confirmed master.
New confirmations store their preview in existing snapshot JSONB; no additional
migration is required for this loading/viewer change. Older snapshots generate a
private derived PNG on first read, without modifying their confirmed content.
Data endpoints remain same-origin, loopback-only and development-only.

The real UI uses Tailwind CSS 4 utilities, shared layout recipes and CSS theme
tokens. Custom wizard CSS is limited to animation sequences. Converted CV HTML is preserved as raw converter output.

## Environment variables

All credentials are server-only; never use `NEXT_PUBLIC_` for them.

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Full-PDF metadata extraction |
| `OPENAI_MODEL` | Server-configured model; initially `gpt-6.1-sol` |
| `OPENAI_REASONING_EFFORT` | Defaults to `low`; see `.env.example` |
| `BRAINTRUST_API_KEY` | Tracing credentials; SDK discovery locally, explicit in production |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Backend secret key |
| `SUPABASE_STORAGE_BUCKET` | Existing private bucket; defaults to `resumes` |
| `PDF2HTMLEX_DOCKER_PATH` | Optional Docker CLI path; defaults to `docker` |

OpenAI and Supabase validate configuration when used, so builds run without
credentials. Braintrust initializes in `src/instrumentation.ts` for `resume-adapter`
and uses AI SDK 7 automatic telemetry. Traces include filename and output JSON,
with PDF/prompt input recording disabled. See [observability](docs/OBSERVABILITY.md).
No eval dataset or scorers have been created.

## Structure

```text
src/app/                     # Real wizard and local API routes
src/components/              # Wizard, SSR skeleton and PDF viewer
src/lib/ai/                  # Model factory and full-PDF metadata extraction
src/lib/observability/       # Braintrust initialization
src/lib/pdf/                 # Validation, browser reader, thumbnails and Docker conversion
src/lib/resumes/             # Metadata schema, request validation and upload persistence
src/lib/supabase/            # Private server client
scripts/                     # PDF.js assets and converter setup
supabase/migrations/         # Manual SQL migrations; do not reapply historical migrations
tests/                       # Synthetic fixtures and offline behavior tests
```

The retired Markdown/Monaco editors, text-to-Markdown conversion and full-content
structuring experiment were removed. Dependencies are kept only where current code
or scripts use them. The historical content-table migration remains for installations
that may already have applied it; it is not required by the current flow.

Keep personal CVs and exported traces outside the repository and `public/`.
Local working directories `private/`, `tmp/`, and `output/` are ignored.
