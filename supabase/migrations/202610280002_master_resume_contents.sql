-- Historical migration from the superseded content-approval experiment.
-- Not required by the current file inspector; do not apply for this flow.
-- Retained for installations where it has already been applied.
begin;

create table public.master_resume_contents (
  id uuid primary key,
  upload_id uuid not null references public.master_resume_uploads(id),
  schema_version integer not null check (schema_version = 1),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_evidence jsonb not null check (jsonb_typeof(source_evidence) = 'object'),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  approved_at timestamptz not null default now(),
  constraint approved_content_identity check (coalesce((
    content->>'id' = id::text and content->>'uploadId' = upload_id::text
    and content->>'sourceHash' = source_sha256
    and content->'pending' = '[]'::jsonb
    and source_evidence->>'pdfHash' = source_sha256
    and (content->>'schemaVersion')::integer = schema_version
    and jsonb_typeof(content->'sections') = 'array'
  ), false))
);

comment on table public.master_resume_contents is
  'Immutable reviewed content snapshots. Approval does not activate a master or validate a visual template.';

alter table public.master_resume_contents enable row level security;
revoke all on table public.master_resume_contents from public, anon, authenticated, service_role;
grant select, insert on table public.master_resume_contents to service_role;

commit;
