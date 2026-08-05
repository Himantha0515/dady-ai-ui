-- Wishlist for saved generation outputs
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  generation_id uuid references public.generations(id) on delete set null,
  output_id uuid references public.generation_outputs(id) on delete set null,
  image_url text not null,
  prompt text,
  aspect_ratio text,
  quality text,
  model_id uuid references public.model_catalog(id) on delete set null,
  model_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, image_url)
);

create index if not exists wishlists_user_created_idx
  on public.wishlists (user_id, created_at desc);

alter table public.wishlists enable row level security;

create policy wishlists_select_own on public.wishlists for select
  using (auth.uid() = user_id or public.is_admin());

create policy wishlists_insert_own on public.wishlists for insert
  with check (auth.uid() = user_id);

create policy wishlists_delete_own on public.wishlists for delete
  using (auth.uid() = user_id);

create policy wishlists_update_own on public.wishlists for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Public bucket for optional reference uploads (dev/staging)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'references',
  'references',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'image/jpg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy references_select_public on storage.objects for select
  using (bucket_id = 'references');

create policy references_insert_own on storage.objects for insert
  with check (
    bucket_id = 'references'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy references_delete_own on storage.objects for delete
  using (
    bucket_id = 'references'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
