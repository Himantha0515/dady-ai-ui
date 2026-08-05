-- Dady.ai core schema
-- Redis / Upstash intentionally omitted

create extension if not exists "pgcrypto";

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  country_code text not null default 'IN',
  preferred_language text default 'en',
  onboarding_completed boolean not null default false,
  auth_provider text,
  account_status text not null default 'active'
    check (account_status in ('active', 'suspended', 'deleted')),
  role text not null default 'user'
    check (role in ('user', 'support', 'admin', 'super_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

-- 2. wallets
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  available_credits integer not null default 0 check (available_credits >= 0),
  reserved_credits integer not null default 0 check (reserved_credits >= 0),
  lifetime_purchased integer not null default 0,
  lifetime_promotional integer not null default 0,
  lifetime_used integer not null default 0,
  lifetime_refunded integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger wallets_updated_at before update on public.wallets
for each row execute function public.set_updated_at();

-- 3. credit_grants
create table public.credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null
    check (source_type in ('purchase', 'subscription', 'referral', 'promotion', 'refund', 'admin')),
  source_id uuid,
  credits_total integer not null check (credits_total > 0),
  credits_remaining integer not null check (credits_remaining >= 0),
  expires_at timestamptz,
  status text not null default 'active'
    check (status in ('active', 'exhausted', 'expired', 'revoked')),
  created_at timestamptz not null default now()
);

create index credit_grants_user_expiry_idx
  on public.credit_grants (user_id, expires_at nulls last)
  where status = 'active' and credits_remaining > 0;

-- 4. credit_transactions (immutable ledger)
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  transaction_type text not null
    check (transaction_type in (
      'PURCHASE', 'SUBSCRIPTION_RENEWAL', 'GENERATION_RESERVE', 'GENERATION_CAPTURE',
      'GENERATION_RELEASE', 'GENERATION_REFUND', 'PROMOTIONAL_CREDIT', 'REFERRAL_CREDIT',
      'ADMIN_ADJUSTMENT', 'EXPIRY'
    )),
  credits integer not null,
  balance_before integer not null,
  balance_after integer not null,
  source_type text,
  source_id uuid,
  generation_id uuid,
  order_id uuid,
  description text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index credit_transactions_idempotency_uidx
  on public.credit_transactions (idempotency_key)
  where idempotency_key is not null;

-- 5. plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  price_inr integer not null check (price_inr >= 0),
  billing_interval text not null check (billing_interval in ('month', 'year', 'one_time')),
  included_credits integer not null check (included_credits >= 0),
  credit_validity_days integer not null default 30,
  rollover_limit integer not null default 0,
  priority_level integer not null default 1,
  commercial_usage boolean not null default true,
  storage_limit_bytes bigint not null default 5368709120,
  team_seats integer not null default 1,
  active boolean not null default true,
  razorpay_plan_id text,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at before update on public.plans
for each row execute function public.set_updated_at();

-- 6. credit_packs
create table public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price_inr integer not null check (price_inr > 0),
  credits integer not null check (credits > 0),
  validity_days integer not null default 30,
  active boolean not null default true,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger credit_packs_updated_at before update on public.credit_packs
for each row execute function public.set_updated_at();

-- 7. subscriptions
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  provider text not null default 'razorpay',
  provider_subscription_id text,
  provider_customer_id text,
  status text not null default 'created'
    check (status in (
      'created', 'authenticated', 'active', 'paused', 'past_due',
      'cancelled', 'completed', 'expired'
    )),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  next_charge_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on public.subscriptions
for each row execute function public.set_updated_at();

create index subscriptions_user_idx on public.subscriptions (user_id);

-- 8. orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_type text not null check (order_type in ('credit_pack', 'subscription')),
  credit_pack_id uuid references public.credit_packs(id),
  plan_id uuid references public.plans(id),
  provider text not null default 'razorpay',
  provider_order_id text,
  amount_inr integer not null,
  amount_paise integer not null,
  currency text not null default 'INR',
  status text not null default 'created'
    check (status in (
      'created', 'pending', 'paid', 'failed', 'refunded',
      'partially_refunded', 'cancelled'
    )),
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index orders_idempotency_uidx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();

-- 9. payments
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  subscription_id uuid references public.subscriptions(id),
  provider text not null default 'razorpay',
  provider_payment_id text,
  provider_order_id text,
  amount_inr integer not null,
  amount_paise integer not null,
  currency text not null default 'INR',
  gateway_fee_inr numeric(12,2),
  tax_on_gateway_fee_inr numeric(12,2),
  status text not null default 'created',
  payment_method text,
  captured_at timestamptz,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index payments_provider_payment_uidx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

-- workspaces (minimal for projects.workspace_id)
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Personal',
  created_at timestamptz not null default now()
);

-- 10. projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_id uuid references public.workspaces(id),
  name text not null,
  project_type text not null default 'general',
  description text,
  thumbnail_path text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger projects_updated_at before update on public.projects
for each row execute function public.set_updated_at();

-- 11. model_catalog
create table public.model_catalog (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'fal',
  provider_model_id text not null,
  friendly_name text not null,
  slug text not null unique,
  category text not null,
  generation_type text not null
    check (generation_type in ('image', 'video', 'audio', 'utility')),
  description text,
  quality_tier text not null default 'standard'
    check (quality_tier in ('standard', 'hd', 'premium', 'fast', 'cinematic')),
  credit_cost integer not null check (credit_cost > 0),
  provider_pricing_unit text,
  estimated_provider_cost_usd numeric(12,6),
  estimated_provider_cost_inr numeric(12,2),
  commercial_use_allowed boolean not null default true,
  supports_audio boolean not null default false,
  supports_text_input boolean not null default true,
  supports_image_input boolean not null default false,
  supports_video_input boolean not null default false,
  supported_durations jsonb not null default '[]'::jsonb,
  supported_aspect_ratios jsonb not null default '["1:1","4:5","16:9","9:16"]'::jsonb,
  supported_resolutions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  experimental boolean not null default false,
  fallback_model_id uuid,
  configuration jsonb not null default '{}'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger model_catalog_updated_at before update on public.model_catalog
for each row execute function public.set_updated_at();

-- 12. generations
create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id),
  model_id uuid not null references public.model_catalog(id),
  generation_type text not null,
  prompt text,
  negative_prompt text,
  input_configuration jsonb not null default '{}'::jsonb,
  output_configuration jsonb not null default '{}'::jsonb,
  provider_request_id text,
  provider_status text,
  application_status text not null default 'draft'
    check (application_status in (
      'draft', 'validating', 'queued', 'generating', 'enhancing',
      'completed', 'failed', 'failed_refunded', 'cancelled', 'cancelled_refunded'
    )),
  credits_reserved integer not null default 0,
  credits_charged integer not null default 0,
  estimated_provider_cost_usd numeric(12,6),
  actual_provider_cost_usd numeric(12,6),
  exchange_rate numeric(12,6),
  actual_provider_cost_inr numeric(12,2),
  failure_code text,
  failure_message text,
  idempotency_key text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index generations_idempotency_uidx
  on public.generations (idempotency_key)
  where idempotency_key is not null;

create index generations_provider_request_idx
  on public.generations (provider_request_id);

create trigger generations_updated_at before update on public.generations
for each row execute function public.set_updated_at();

alter table public.credit_transactions
  add constraint credit_transactions_generation_fk
  foreign key (generation_id) references public.generations(id);

alter table public.credit_transactions
  add constraint credit_transactions_order_fk
  foreign key (order_id) references public.orders(id);

-- 13. generation_credit_allocations
create table public.generation_credit_allocations (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  credit_grant_id uuid not null references public.credit_grants(id),
  credits_reserved integer not null default 0,
  credits_captured integer not null default 0,
  credits_released integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger generation_credit_allocations_updated_at
before update on public.generation_credit_allocations
for each row execute function public.set_updated_at();

-- 14. generation_outputs
create table public.generation_outputs (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  output_type text not null,
  storage_provider text not null default 'r2',
  storage_bucket text,
  storage_key text not null,
  original_provider_url text,
  mime_type text,
  file_size_bytes bigint,
  width integer,
  height integer,
  duration_seconds numeric(10,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- 15. templates
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  category text not null,
  description text,
  preview_storage_key text,
  recommended_model_id uuid references public.model_catalog(id),
  default_prompt text,
  default_configuration jsonb not null default '{}'::jsonb,
  estimated_credit_cost integer,
  active boolean not null default true,
  featured boolean not null default false,
  trending_score integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger templates_updated_at before update on public.templates
for each row execute function public.set_updated_at();

-- 16. webhook_events
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  signature_valid boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processing', 'processed', 'failed', 'ignored')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

-- 17. admin_audit_logs
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- 18. referrals
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.profiles(id),
  referred_user_id uuid references public.profiles(id),
  referral_code text not null,
  qualifying_order_id uuid references public.orders(id),
  reward_status text not null default 'pending'
    check (reward_status in ('pending', 'qualified', 'rewarded', 'rejected')),
  reward_credits integer not null default 0,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);

create unique index referrals_code_uidx on public.referrals (referral_code);
