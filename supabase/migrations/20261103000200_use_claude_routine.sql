-- Compatibility migration in case the first recipe queue migration was applied before its worker was
-- corrected to match Thongs. Remove the unused OpenAI automation trigger and install the Claude Code routine trigger.
drop trigger if exists recipe_requests_start_automation on public.recipe_requests;
drop function if exists public.recipe_requests_start_automation();

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
