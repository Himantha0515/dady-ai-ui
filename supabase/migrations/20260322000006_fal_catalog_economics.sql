-- Fal inventory + credit economics fields on model_catalog

create table if not exists public.fal_model_inventory (
  id uuid primary key default gen_random_uuid(),
  endpoint_id text not null unique,
  display_name text not null,
  category text not null,
  generation_type text not null
    check (generation_type in ('image', 'video')),
  unit text,
  unit_price_usd numeric(12,6),
  currency text not null default 'USD',
  thumbnail_url text,
  status text not null default 'active',
  description text,
  raw_metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fal_model_inventory_type_price_idx
  on public.fal_model_inventory (generation_type, unit_price_usd nulls last);

create trigger fal_model_inventory_updated_at
before update on public.fal_model_inventory
for each row execute function public.set_updated_at();

alter table public.fal_model_inventory enable row level security;

create policy fal_inventory_admin_select on public.fal_model_inventory
  for select using (public.is_admin());

-- Catalog economics columns
alter table public.model_catalog
  add column if not exists credits_per_unit integer,
  add column if not exists pricing_unit text,
  add column if not exists margin_pct numeric(6,2) default 50,
  add column if not exists fx_usd_inr numeric(12,6) default 86;

-- Backfill credits_per_unit from existing flat credit_cost
update public.model_catalog
set
  credits_per_unit = coalesce(credits_per_unit, credit_cost),
  pricing_unit = coalesce(
    pricing_unit,
    provider_pricing_unit,
    case when generation_type = 'video' then 'second' else 'image' end
  )
where credits_per_unit is null or pricing_unit is null;

alter table public.model_catalog
  alter column credits_per_unit set default 1;

-- Unique provider model id (ignore conflicts if already present)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'model_catalog_provider_model_uidx'
  ) then
    alter table public.model_catalog
      add constraint model_catalog_provider_model_uidx
      unique (provider, provider_model_id);
  end if;
end $$;

-- Reserve credits with explicit amount (duration / output aware)
drop function if exists public.reserve_generation_credits(uuid, uuid, text);

create or replace function public.reserve_generation_credits(
  p_generation_id uuid,
  p_model_id uuid,
  p_idempotency_key text,
  p_credits integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost integer;
  v_wallet public.wallets%rowtype;
  v_needed integer;
  v_grant public.credit_grants%rowtype;
  v_take integer;
  v_before integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if exists (
    select 1 from public.credit_transactions
    where idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  if p_credits is not null and p_credits > 0 then
    v_cost := p_credits;
  else
    select credit_cost into v_cost
    from public.model_catalog
    where id = p_model_id and active = true;
  end if;

  if v_cost is null or v_cost <= 0 then
    raise exception 'MODEL_UNAVAILABLE';
  end if;

  select * into v_wallet
  from public.wallets
  where user_id = v_user_id
  for update;

  if not found then
    raise exception 'INTERNAL_ERROR';
  end if;

  if v_wallet.available_credits < v_cost then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  v_before := v_wallet.available_credits;
  v_needed := v_cost;

  for v_grant in
    select * from public.credit_grants
    where user_id = v_user_id
      and status = 'active'
      and credits_remaining > 0
      and (expires_at is null or expires_at > now())
    order by expires_at nulls last, created_at
    for update
  loop
    exit when v_needed <= 0;
    v_take := least(v_grant.credits_remaining, v_needed);
    update public.credit_grants
    set
      credits_remaining = credits_remaining - v_take,
      status = case when credits_remaining - v_take = 0 then 'exhausted' else status end
    where id = v_grant.id;

    insert into public.generation_credit_allocations (
      generation_id, credit_grant_id, credits_reserved
    ) values (p_generation_id, v_grant.id, v_take);

    v_needed := v_needed - v_take;
  end loop;

  if v_needed > 0 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.wallets
  set
    available_credits = available_credits - v_cost,
    reserved_credits = reserved_credits + v_cost
  where user_id = v_user_id;

  insert into public.credit_transactions (
    user_id, transaction_type, credits, balance_before, balance_after,
    generation_id, description, idempotency_key
  ) values (
    v_user_id, 'GENERATION_RESERVE', -v_cost, v_before, v_before - v_cost,
    p_generation_id, 'Reserve credits for generation', p_idempotency_key
  );

  update public.generations
  set credits_reserved = v_cost, application_status = 'queued', started_at = now()
  where id = p_generation_id and user_id = v_user_id;

  return jsonb_build_object('ok', true, 'credits', v_cost);
end;
$$;

grant execute on function public.reserve_generation_credits(uuid, uuid, text, integer) to authenticated;
