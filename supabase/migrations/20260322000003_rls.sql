-- Row Level Security

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.credit_grants enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.plans enable row level security;
alter table public.credit_packs enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.workspaces enable row level security;
alter table public.projects enable row level security;
alter table public.model_catalog enable row level security;
alter table public.generations enable row level security;
alter table public.generation_credit_allocations enable row level security;
alter table public.generation_outputs enable row level security;
alter table public.templates enable row level security;
alter table public.webhook_events enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.referrals enable row level security;

-- profiles
create policy profiles_select_own on public.profiles for select
  using (auth.uid() = id or public.is_admin());
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- wallets (read-only for users)
create policy wallets_select_own on public.wallets for select
  using (auth.uid() = user_id or public.is_admin());

-- credit grants / transactions
create policy credit_grants_select_own on public.credit_grants for select
  using (auth.uid() = user_id or public.is_admin());
create policy credit_tx_select_own on public.credit_transactions for select
  using (auth.uid() = user_id or public.is_admin());

-- public catalogs
create policy plans_public_read on public.plans for select using (active = true or public.is_admin());
create policy packs_public_read on public.credit_packs for select using (active = true or public.is_admin());
create policy models_public_read on public.model_catalog for select using (active = true or public.is_admin());
create policy templates_public_read on public.templates for select using (active = true or public.is_admin());

-- subscriptions / orders / payments
create policy subscriptions_select_own on public.subscriptions for select
  using (auth.uid() = user_id or public.is_admin());
create policy orders_select_own on public.orders for select
  using (auth.uid() = user_id or public.is_admin());
create policy payments_select_own on public.payments for select
  using (auth.uid() = user_id or public.is_admin());

-- workspaces / projects
create policy workspaces_own on public.workspaces for all
  using (auth.uid() = owner_user_id or public.is_admin())
  with check (auth.uid() = owner_user_id or public.is_admin());

create policy projects_select_own on public.projects for select
  using (auth.uid() = user_id or public.is_admin());
create policy projects_insert_own on public.projects for insert
  with check (auth.uid() = user_id);
create policy projects_update_own on public.projects for update
  using (auth.uid() = user_id);
create policy projects_delete_own on public.projects for delete
  using (auth.uid() = user_id);

-- generations / outputs
create policy generations_select_own on public.generations for select
  using (auth.uid() = user_id or public.is_admin());
create policy generations_insert_own on public.generations for insert
  with check (auth.uid() = user_id);

create policy outputs_select_own on public.generation_outputs for select
  using (auth.uid() = user_id or public.is_admin());

create policy allocations_select_own on public.generation_credit_allocations for select
  using (
    exists (
      select 1 from public.generations g
      where g.id = generation_id and (g.user_id = auth.uid() or public.is_admin())
    )
  );

-- webhooks & audit: admin only
create policy webhook_admin_only on public.webhook_events for select
  using (public.is_admin());
create policy audit_admin_only on public.admin_audit_logs for select
  using (public.is_admin());

-- referrals
create policy referrals_select_own on public.referrals for select
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id or public.is_admin());
