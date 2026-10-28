-- Run manually in the Supabase SQL Editor. The existing resumes bucket is
-- configured separately in Storage; this migration does not create a bucket.
begin;

create table public.master_resume_uploads (
  id uuid primary key,
  storage_bucket text not null,
  storage_path text not null,
  original_filename text not null check (length(original_filename) > 0),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  mime_type text not null check (mime_type = 'application/pdf'),
  created_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

comment on table public.master_resume_uploads is
  'Original PDF uploads only. A row does not identify a validated or active master.';

alter table public.master_resume_uploads enable row level security;
revoke all on table public.master_resume_uploads from public, anon, authenticated;
grant select, insert on table public.master_resume_uploads to service_role;

-- No browser-facing table or Storage policies: only the server secret client
-- performs these operations. Public access/authentication are not implemented.
commit;
