create table if not exists public.recipe_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  url text not null check (length(trim(url)) between 8 and 2000 and url ~ '^https?://'),
  note text check (length(note) <= 2000),
  state text not null default 'waiting' check (state in ('waiting', 'working', 'ready', 'failed')),
  slug text check (slug is null or slug ~ '^[a-z0-9-]+$'),
  result_note text not null default '' check (length(result_note) <= 1000),
  claim_token uuid,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((state = 'ready') = (slug is not null))
);

create index if not exists recipe_requests_queue on public.recipe_requests(state, created_at);
create index if not exists recipe_requests_owner on public.recipe_requests(user_id, created_at desc);
create unique index if not exists recipe_requests_pending
  on public.recipe_requests(user_id, url) where state in ('waiting', 'working');

alter table public.recipe_requests enable row level security;
drop policy if exists recipe_requests_read on public.recipe_requests;
drop policy if exists recipe_requests_add on public.recipe_requests;
create policy recipe_requests_read on public.recipe_requests for select to authenticated
  using (user_id = (select auth.uid()));
create policy recipe_requests_add on public.recipe_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and state = 'waiting');

revoke all on public.recipe_requests from anon, authenticated;
grant select on public.recipe_requests to authenticated;
grant insert(url, note) on public.recipe_requests to authenticated;
grant all on public.recipe_requests to service_role;

create or replace function public.claim_recipe_request(request_id uuid)
returns setof public.recipe_requests language sql security definer set search_path = '' as $$
  update public.recipe_requests
  set state = 'working', claim_token = gen_random_uuid(), claimed_at = now(), updated_at = now()
  where id = request_id and state = 'waiting'
  returning *;
$$;

create or replace function public.finish_recipe_request(
  request_id uuid,
  token uuid,
  result_slug text default null,
  new_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.recipe_requests
  set state = case when result_slug is null then 'failed' else 'ready' end,
      slug = result_slug,
      result_note = new_note,
      claim_token = null,
      updated_at = now()
  where id = request_id and state = 'working' and claim_token = token;
  if not found then raise exception 'Claim lost'; end if;
end;
$$;

create or replace function public.retry_recipe_request(request_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.recipe_requests
  set state = 'waiting', slug = null, claim_token = null, claimed_at = null,
      result_note = '', updated_at = now()
  where id = request_id and state in ('working', 'failed');
$$;

revoke all on function public.claim_recipe_request(uuid),
  public.finish_recipe_request(uuid, uuid, text, text),
  public.retry_recipe_request(uuid) from public, anon, authenticated;
grant execute on function public.claim_recipe_request(uuid),
  public.finish_recipe_request(uuid, uuid, text, text),
  public.retry_recipe_request(uuid) to service_role;

-- Same architecture as Thongs: a saved request fires a Claude Code routine immediately, charged against
-- Bruce's Claude plan rather than an API account. Store the routine trigger URL and its bearer token in
-- Supabase Vault as recipe_routine_fire_url and recipe_routine_fire_token. Without them, the request remains
-- queued and the scheduled routine can still pick it up later.
create extension if not exists pg_net with schema extensions;

create or replace function public.recipe_requests_start_routine()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  tok text;
  routine_url text;
begin
  select decrypted_secret into tok from vault.decrypted_secrets
    where name = 'recipe_routine_fire_token' limit 1;
  select decrypted_secret into routine_url from vault.decrypted_secrets
    where name = 'recipe_routine_fire_url' limit 1;
  if tok is null or routine_url is null then return new; end if;
  perform net.http_post(
    url := routine_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'anthropic-version', '2026-10-21',
      'anthropic-beta', 'experimental-cc-routine-2026-04-01',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'text', 'A recipe request was just made (' || new.id || '). Do the oldest waiting recipe request using the repository workflow.'
    )
  );
  return new;
end;
$$;

revoke all on function public.recipe_requests_start_routine() from public, anon, authenticated;
drop trigger if exists recipe_requests_start_routine on public.recipe_requests;
create trigger recipe_requests_start_routine
after insert on public.recipe_requests for each row
execute function public.recipe_requests_start_routine();
