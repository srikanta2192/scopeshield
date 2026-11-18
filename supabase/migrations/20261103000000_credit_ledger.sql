create table if not exists public.credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_type text not null check (entry_type in ('purchase', 'analysis', 'refund')),
  amount integer not null check (amount <> 0),
  idempotency_key text not null unique,
  checkout_session_id text unique,
  stripe_event_id text unique,
  request_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.analysis_attempts (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists analysis_attempts_user_created_idx
  on public.analysis_attempts(user_id, created_at desc);

alter table public.credit_accounts enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.analysis_attempts enable row level security;

revoke all on public.credit_accounts, public.credit_ledger, public.analysis_attempts from anon, authenticated;
grant select on public.credit_accounts to authenticated;
grant all on public.credit_accounts, public.credit_ledger, public.analysis_attempts to service_role;
create policy "users read their own credit balance"
  on public.credit_accounts for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.create_credit_account_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.credit_accounts(user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_credit_account_after_signup on auth.users;
create trigger create_credit_account_after_signup
  after insert on auth.users
  for each row execute function public.create_credit_account_for_new_user();

create or replace function public.reserve_analysis_credit(p_user_id uuid, p_request_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_balance integer;
  recent_attempts integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.credit_accounts(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select balance into current_balance
    from public.credit_accounts where user_id = p_user_id for update;

  if exists (select 1 from public.analysis_attempts where request_id = p_request_id) then
    return 'duplicate_request';
  end if;

  delete from public.analysis_attempts
    where user_id = p_user_id and created_at <= now() - interval '1 minute';
  select count(*)::integer into recent_attempts
    from public.analysis_attempts
    where user_id = p_user_id and created_at > now() - interval '1 minute';
  if recent_attempts >= 5 then return 'rate_limited'; end if;

  insert into public.analysis_attempts(request_id, user_id) values (p_request_id, p_user_id);
  if current_balance <= 0 then return 'no_credits'; end if;

  update public.credit_accounts set balance = balance - 1, updated_at = now()
    where user_id = p_user_id;
  insert into public.credit_ledger(user_id, entry_type, amount, idempotency_key, request_id)
    values (p_user_id, 'analysis', -1, 'analysis:' || p_request_id::text, p_request_id);
  return 'reserved';
end;
$$;

create or replace function public.refund_analysis_credit(p_user_id uuid, p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.credit_ledger
    where user_id = p_user_id and request_id = p_request_id and entry_type = 'analysis'
  ) then return false; end if;

  insert into public.credit_ledger(user_id, entry_type, amount, idempotency_key, request_id)
    values (p_user_id, 'refund', 1, 'refund:' || p_request_id::text, p_request_id)
    on conflict (idempotency_key) do nothing
    returning id into inserted_id;
  if inserted_id is null then return false; end if;

  update public.credit_accounts set balance = balance + 1, updated_at = now()
    where user_id = p_user_id;
  return true;
end;
$$;

create or replace function public.grant_purchased_credits(
  p_user_id uuid,
  p_credits integer,
  p_checkout_session_id text,
  p_stripe_event_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_credits not in (1, 5) or p_checkout_session_id is null or p_stripe_event_id is null then
    raise exception 'invalid purchase' using errcode = '22023';
  end if;

  insert into public.credit_accounts(user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  perform 1 from public.credit_accounts where user_id = p_user_id for update;
  insert into public.credit_ledger(
    user_id, entry_type, amount, idempotency_key, checkout_session_id, stripe_event_id
  ) values (
    p_user_id, 'purchase', p_credits, 'checkout:' || p_checkout_session_id,
    p_checkout_session_id, p_stripe_event_id
  ) on conflict do nothing returning id into inserted_id;
  if inserted_id is null then return false; end if;

  update public.credit_accounts set balance = balance + p_credits, updated_at = now()
    where user_id = p_user_id;
  return true;
end;
$$;

revoke all on function public.create_credit_account_for_new_user() from public, anon, authenticated;
revoke all on function public.reserve_analysis_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.refund_analysis_credit(uuid, uuid) from public, anon, authenticated;
revoke all on function public.grant_purchased_credits(uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.reserve_analysis_credit(uuid, uuid) to service_role;
grant execute on function public.refund_analysis_credit(uuid, uuid) to service_role;
grant execute on function public.grant_purchased_credits(uuid, integer, text, text) to service_role;
