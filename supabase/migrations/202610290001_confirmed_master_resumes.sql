-- Apply once in the existing project's SQL Editor, after 202610280001.
-- The historical 202610280002 experiment is not required.
begin;
create table public.confirmed_master_resumes (
  id uuid primary key references public.master_resume_uploads(id),
  filename text not null,
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  confirmed_at timestamptz not null default now()
);
create table public.active_master_resume (
  singleton boolean primary key default true check (singleton),
  master_id uuid references public.confirmed_master_resumes(id)
);
insert into public.active_master_resume(singleton, master_id) values (true, null);
alter table public.confirmed_master_resumes enable row level security;
alter table public.active_master_resume enable row level security;
revoke all on public.confirmed_master_resumes, public.active_master_resume from public, anon, authenticated, service_role;
grant select, insert on public.confirmed_master_resumes to service_role;
grant select, update on public.active_master_resume to service_role;

create function public.confirm_master_resume(p_upload_id uuid, p_content jsonb, p_expected_active_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare current_id uuid; stored_content jsonb; original_name text;
begin
  select master_id into current_id from public.active_master_resume where singleton = true for update;
  if not found then raise exception 'Missing active master slot'; end if;
  select content into stored_content from public.confirmed_master_resumes where id = p_upload_id;
  -- Exact retries are safe after a lost success response; old snapshots cannot be reactivated.
  if current_id = p_upload_id and stored_content = p_content then return; end if;
  if current_id is distinct from p_expected_active_id then
    raise exception using errcode = '40001', message = 'Active master changed';
  end if;
  if stored_content is not null then raise exception 'Master snapshot is immutable'; end if;
  if p_content #>> '{metadata,uploadId}' is distinct from p_upload_id::text then raise exception 'Upload mismatch'; end if;
  select original_filename into strict original_name from public.master_resume_uploads where id = p_upload_id;
  insert into public.confirmed_master_resumes(id, filename, content) values (p_upload_id, original_name, p_content);
  update public.active_master_resume set master_id = p_upload_id where singleton = true;
end;
$$;
revoke execute on function public.confirm_master_resume(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.confirm_master_resume(uuid, jsonb, uuid) to service_role;
comment on table public.confirmed_master_resumes is 'Immutable confirmed snapshots. Replacement changes only the active pointer.';
commit;
