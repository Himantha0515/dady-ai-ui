-- User bootstrap + credit RPCs (security definer)

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.create_new_user_resources()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  insert into public.profiles (id, email, full_name, auth_provider, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    'user'
  )
  on conflict (id) do nothing;

  insert into public.wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.workspaces (owner_user_id, name)
  values (new.id, 'Personal')
  on conflict do nothing
  returning id into ws_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_new_user_resources();

-- Prevent users from changing their own role
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'FORBIDDEN: role cannot be changed by user';
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- reserve_generation_credits
create or replace function public.reserve_generation_credits(
  p_generation_id uuid,
  p_model_id uuid,
  p_idempotency_key text
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

  select credit_cost into v_cost
  from public.model_catalog
  where id = p_model_id and active = true;

  if v_cost is null then
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
    set credits_remaining = credits_remaining - v_take,
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
  set available_credits = available_credits - v_cost,
      reserved_credits = reserved_credits + v_cost
  where user_id = v_user_id;

  update public.generations
  set credits_reserved = v_cost,
      application_status = 'queued',
      started_at = coalesce(started_at, now())
  where id = p_generation_id and user_id = v_user_id;

  insert into public.credit_transactions (
    user_id, transaction_type, credits, balance_before, balance_after,
    generation_id, description, idempotency_key
  ) values (
    v_user_id, 'GENERATION_RESERVE', -v_cost, v_before, v_before - v_cost,
    p_generation_id, 'Reserve credits for generation', p_idempotency_key
  );

  return jsonb_build_object(
    'ok', true,
    'credits_reserved', v_cost,
    'balance_after', v_before - v_cost
  );
end;
$$;

-- capture_generation_credits
create or replace function public.capture_generation_credits(
  p_generation_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gen public.generations%rowtype;
  v_before integer;
begin
  if exists (
    select 1 from public.credit_transactions where idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  select * into v_gen from public.generations where id = p_generation_id for update;
  if not found then
    raise exception 'INVALID_INPUT';
  end if;

  if v_gen.credits_charged > 0 then
    return jsonb_build_object('ok', true, 'already_captured', true);
  end if;

  select available_credits into v_before from public.wallets
  where user_id = v_gen.user_id for update;

  update public.generation_credit_allocations
  set credits_captured = credits_reserved
  where generation_id = p_generation_id;

  update public.wallets
  set reserved_credits = reserved_credits - v_gen.credits_reserved,
      lifetime_used = lifetime_used + v_gen.credits_reserved
  where user_id = v_gen.user_id;

  update public.generations
  set credits_charged = credits_reserved,
      application_status = 'completed',
      completed_at = now()
  where id = p_generation_id;

  insert into public.credit_transactions (
    user_id, transaction_type, credits, balance_before, balance_after,
    generation_id, description, idempotency_key
  ) values (
    v_gen.user_id, 'GENERATION_CAPTURE', 0, v_before, v_before,
    p_generation_id, 'Capture reserved credits', p_idempotency_key
  );

  return jsonb_build_object('ok', true, 'credits_charged', v_gen.credits_reserved);
end;
$$;

-- release_generation_credits
create or replace function public.release_generation_credits(
  p_generation_id uuid,
  p_idempotency_key text,
  p_status text default 'failed_refunded'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gen public.generations%rowtype;
  v_alloc record;
  v_before integer;
begin
  if exists (
    select 1 from public.credit_transactions where idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  select * into v_gen from public.generations where id = p_generation_id for update;
  if not found then
    raise exception 'INVALID_INPUT';
  end if;

  if v_gen.credits_reserved = 0 or v_gen.credits_charged > 0 then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;

  select available_credits into v_before from public.wallets
  where user_id = v_gen.user_id for update;

  for v_alloc in
    select * from public.generation_credit_allocations
    where generation_id = p_generation_id and credits_released = 0
  loop
    update public.credit_grants
    set credits_remaining = credits_remaining + v_alloc.credits_reserved,
        status = 'active'
    where id = v_alloc.credit_grant_id;

    update public.generation_credit_allocations
    set credits_released = credits_reserved
    where id = v_alloc.id;
  end loop;

  update public.wallets
  set available_credits = available_credits + v_gen.credits_reserved,
      reserved_credits = reserved_credits - v_gen.credits_reserved,
      lifetime_refunded = lifetime_refunded + v_gen.credits_reserved
  where user_id = v_gen.user_id;

  update public.generations
  set credits_reserved = 0,
      application_status = p_status,
      completed_at = now()
  where id = p_generation_id;

  insert into public.credit_transactions (
    user_id, transaction_type, credits, balance_before, balance_after,
    generation_id, description, idempotency_key
  ) values (
    v_gen.user_id, 'GENERATION_RELEASE', v_gen.credits_reserved, v_before,
    v_before + v_gen.credits_reserved, p_generation_id,
    'Release reserved credits', p_idempotency_key
  );

  return jsonb_build_object('ok', true, 'credits_released', v_gen.credits_reserved);
end;
$$;

-- grant_purchase_credits
create or replace function public.grant_purchase_credits(
  p_user_id uuid,
  p_order_id uuid,
  p_credits integer,
  p_validity_days integer,
  p_source_type text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before integer;
  v_grant_id uuid;
begin
  if exists (
    select 1 from public.credit_transactions where idempotency_key = p_idempotency_key
  ) then
    return jsonb_build_object('ok', true, 'deduped', true);
  end if;

  select available_credits into v_before from public.wallets
  where user_id = p_user_id for update;

  insert into public.credit_grants (
    user_id, source_type, source_id, credits_total, credits_remaining, expires_at, status
  ) values (
    p_user_id, p_source_type, p_order_id, p_credits, p_credits,
    case when p_validity_days is null then null else now() + (p_validity_days || ' days')::interval end,
    'active'
  ) returning id into v_grant_id;

  update public.wallets
  set available_credits = available_credits + p_credits,
      lifetime_purchased = lifetime_purchased + case when p_source_type in ('purchase', 'subscription') then p_credits else 0 end,
      lifetime_promotional = lifetime_promotional + case when p_source_type = 'promotion' then p_credits else 0 end
  where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id, transaction_type, credits, balance_before, balance_after,
    order_id, source_type, source_id, description, idempotency_key
  ) values (
    p_user_id,
    case when p_source_type = 'subscription' then 'SUBSCRIPTION_RENEWAL' else 'PURCHASE' end,
    p_credits, v_before, v_before + p_credits,
    p_order_id, p_source_type, v_grant_id,
    'Grant credits from verified payment', p_idempotency_key
  );

  return jsonb_build_object('ok', true, 'grant_id', v_grant_id, 'credits', p_credits);
end;
$$;

-- expire_credits
create or replace function public.expire_credits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grant record;
  v_before integer;
  v_count integer := 0;
begin
  for v_grant in
    select * from public.credit_grants
    where status = 'active'
      and credits_remaining > 0
      and expires_at is not null
      and expires_at < now()
    for update
  loop
    select available_credits into v_before from public.wallets
    where user_id = v_grant.user_id for update;

    update public.wallets
    set available_credits = greatest(0, available_credits - v_grant.credits_remaining)
    where user_id = v_grant.user_id;

    update public.credit_grants
    set status = 'expired', credits_remaining = 0
    where id = v_grant.id;

    insert into public.credit_transactions (
      user_id, transaction_type, credits, balance_before, balance_after,
      source_type, source_id, description, idempotency_key
    ) values (
      v_grant.user_id, 'EXPIRY', -v_grant.credits_remaining, v_before,
      greatest(0, v_before - v_grant.credits_remaining),
      'purchase', v_grant.id, 'Expired unused credits',
      'expiry:' || v_grant.id::text
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.reserve_generation_credits(uuid, uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
-- capture/release/grant are service-role only in practice (edge functions)
