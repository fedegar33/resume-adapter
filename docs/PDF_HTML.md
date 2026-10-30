# Direct PDF-to-HTML experiment

Confirmed on October 28, 2026. This experiment compares the original PDF with
unmodified pdf2htmlEX output. Metadata extraction now runs before conversion: see [RESUME_METADATA.md](RESUME_METADATA.md).
The converter itself does not use OpenAI or an agent, reconstruct
semantic HTML, configure permissions, or regenerate a PDF.

## Setup

1. Complete [Supabase upload setup](SUPABASE_SETUP.md).
2. Install Docker Desktop if needed and start it. It must remain running while
   using conversion. On Federico's Mac, Docker Desktop is already installed.
3. Run `pnpm pdf:setup` once to download the pinned official pdf2htmlEX image.
4. Run `pnpm dev` and open http://127.0.0.1:3000.

Conversion itself adds no npm dependency or database migration; master confirmation
requires the migration in the Supabase setup guide. OpenAI credentials are now required for automatic metadata extraction before conversion. If Docker is outside the app's PATH, optionally set
`PDF2HTMLEX_DOCKER_PATH` in `.env.local` to the Docker executable path (for example,
`/usr/local/bin/docker`) and restart the dev server. The setup script also accepts
this variable from its shell environment; it does not load `.env.local`.

The image is pinned by digest:

```text
pdf2htmlex/pdf2htmlex@sha256:83899e54f842fda9ca531aea6f30342b0cab4933a246dfc336d63b3e696c9990
```

It corresponds to `0.18.8.rc1-master-20200630-Ubuntu-focal-x86_64`. The actual
converter reports pdf2htmlEX 0.18.8.rc1 with Poppler 0.89.0. On this arm64 Mac,
Docker's Linux amd64 emulation was verified with a synthetic two-page PDF. This
old converter is confined to a local experiment; hosting remains out of scope.

## Runtime flow

1. `POST /api/master-resume` validates the selected PDF, uploads its private
   Storage object, and inserts an independent `master_resume_uploads` record.
2. The browser first calls `POST /api/master-resume/analyze` for full-PDF metadata
   extraction, then `POST /api/master-resume/convert` with that upload UUID.
3. The backend checks local-development access, reads the upload record, confirms
   the bucket is private, and downloads the authoritative stored PDF.
4. A short-lived Docker container receives PDF bytes over stdin. It runs
   pdf2htmlEX with `--embed CFIJO --split-pages 0`: CSS, fonts, images, viewer
   JavaScript, and outlines are embedded in one HTML file. Uppercase letters
   enable embedding; lowercase letters disable it.
5. The API returns HTML with `Cache-Control: no-store`. Confirmation retains the
   raw HTML and section eligibility in the master snapshot without modifying the
   converter output. The retired HTML inspector/download UI has been removed.
   The current preview is a persisted PNG; clicking opens the original PDF.
   See [CACHING.md](CACHING.md) for SSR, thumbnails and PDF caching.

The container runs without network, host mounts, application credentials, Linux
capabilities, or root privileges. Its filesystem is read-only except temporary
in-memory work directories. Runtime pulls are disabled: setup downloads the image
explicitly. Conversion uses a 120-second timeout, 32 MB HTML output limit, 512 MB
memory limit, and request-specific container cleanup on failure. Only the generated
container name is eligible for cleanup; unrelated Docker resources are untouched.

## State and failures

States are Uploading → Reading resume → Converting → Section review → Confirming
→ Ready, or an inline error. Upload stays disabled while requests are running. Missing/stopped Docker and a missing
image provide setup guidance; other converter errors stay generic. Raw converter
stderr and HTML are not logged or sent to Braintrust.

Conversion failure preserves the stored PDF/upload record. A failed replacement
also keeps the previous confirmed master available. There are no retries,
queues or public file URLs in the conversion endpoint. Separate confirmation
saves HTML/metadata/permissions and activates a master atomically; replacement
preserves the previous master until confirmation succeeds. Unconfirmed reviews
are discarded on reload, while confirmed HTML stays persisted in Supabase.
Container temporary files disappear on removal. The original upload persists as before.

## Verification and limitations

Offline tests mock Docker's process streams and Supabase HTTP calls. They verify
unchanged stdin bytes, raw HTML return, safe failures, output limits, scoped
cleanup, local access, private Storage reads, and no AI/content-write requests.
Real converter verification uses only a synthetic PDF, without Supabase/OpenAI.
The retired HTML inspector previously underwent browser verification; current
browser verification covers the wizard, PNG preview and original-PDF viewer.

pdf2htmlEX aims at visual fidelity using positioned elements. This does not prove
that paragraphs can be lengthened, sections identified, or pages repaginated after
editing. Evaluate Federico's CV first; resume the design questions afterward.
A possible bounded visual LLM correction loop remains a proposal, not implementation.

Primary references:

- [Project Docker setup](https://github.com/pdf2htmlEX/pdf2htmlEX/wiki/Download-Docker-Image)
- [CLI options](https://github.com/pdf2htmlEX/pdf2htmlEX/wiki/Command-Line-Options)
