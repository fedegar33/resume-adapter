# Master resume upload setup

The upload feature runs only with `pnpm dev` on your machine. Supabase remains
remote. These instructions are manual; the app never creates tables or buckets.

## 1. Configure the existing bucket

In your Supabase project, open **Storage**, select **resumes**, and open its
configuration:

- Keep **Public bucket** disabled.
- Set the file size limit to **10 MB** (10,485,760 bytes).
- Restrict allowed MIME types to **application/pdf**.
- Do not add anonymous or authenticated upload/read policies for this feature.
  The server uses its secret key; the browser never accesses Supabase directly.

The app verifies that the bucket is private before uploading. If it is public,
the upload is rejected instead of sending the PDF.

## 2. Create the table

Open **SQL Editor** → **New query**, paste the contents of
[`202610280001_master_resume_uploads.sql`](../supabase/migrations/202610280001_master_resume_uploads.sql),
and run it once. The transaction creates `public.master_resume_uploads`, enables
RLS, revokes browser-role privileges, and grants the backend access. It does not
modify the bucket or delete existing data. Do not rerun it if the table exists.

Each row contains a UUID, bucket, unique object path, original filename, byte
size, PDF MIME type, and a server-generated timestamp. It is an upload record,
not a validated or active master.

## 3. Configure the local app

Set these in `.env.local` (never commit them):

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_SECRET_KEY
SUPABASE_STORAGE_BUCKET=resumes
```

Use the project's server secret key, not its publishable/anonymous key. Keep
all credentials server-side, with no `NEXT_PUBLIC_` prefix. Other integrations
are not required for upload. Restart the development server after changes.

```sh
pnpm dev
```

Open **http://127.0.0.1:3000** and click **Upload Master Resume**. The development
command binds to loopback. The endpoint additionally requires development mode,
a loopback host, a matching browser Origin, and local forwarded addresses. Do
not expose this development server through a tunnel or reverse proxy. Uploads
are disabled in `pnpm build` / `pnpm start`; public hosting needs access control.

## 4. Verify with a file you choose

This step sends your selected PDF to your Supabase project:

1. Select an unprotected PDF of at most 10 MB. While uploading, the button reads
   `Uploading…` and is disabled.
2. Expect `<filename> uploaded!` only after Storage and the insert succeed.
3. In Storage, find `resumes/masters/<uuid>.pdf`. In Table Editor, find the
   matching `master_resume_uploads` row.
4. Upload the same filename again: expect a second object and a second row.
5. A renamed text file, corrupt PDF, protected PDF, or oversized file must show
   an error without uploading. A valid scanned PDF is allowed at this stage;
   text extraction and content validation are deferred.

If the table insert is explicitly rejected, the app attempts to remove the object through the
Storage API. If removal also fails, the UI reports it; the local console logs
only the generated object path for manual cleanup. Delete that object through
Storage, not by deleting rows from `storage.objects` with SQL.

An ambiguous insert response (network failure or server error) preserves the
object, since the insert may already have committed, and shows an error asking
you to inspect Storage and the table.

Storage and Postgres are separate systems, so this is compensating cleanup,
not an atomic transaction. An interrupted process or lost network response can
leave an object or an unconfirmed completed upload. Check Storage and the table
before retrying after an ambiguous connection failure. There is no automatic
retry, deduplication, or background cleanup in this feature.

No parsing output, signed URL, download route, active master, or AI call is created.

## Local verification

`pnpm test` uses synthetic PDFs and an in-memory HTTP mock for Supabase; it never
reads `.env.local`, uploads a real resume, or calls external services.

Relevant API references: [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads),
[Storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects),
[RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security).
