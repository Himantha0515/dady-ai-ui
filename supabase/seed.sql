-- Seed: plans, packs, models, templates
-- Replace provider_model_id values with verified FAL model IDs before production.

insert into public.credit_packs (slug, name, price_inr, credits, validity_days, display_order, metadata)
values
  ('mini-99', 'Mini Credit Pack', 99, 100, 30, 1, '{"tagline":"Try Dady with UPI"}'::jsonb),
  ('starter-299', 'Starter Credit Pack', 299, 300, 30, 2, '{"tagline":"More room to create"}'::jsonb),
  ('plus-449', 'Plus Credit Pack', 449, 450, 30, 3, '{"tagline":"Best one-time value","popular":true}'::jsonb),
  ('creator-monthly', 'Creator', 499, 600, 35, 10, '{"billing":"monthly","popular":true}'::jsonb),
  ('studio-monthly', 'Studio', 999, 1200, 35, 11, '{"billing":"monthly"}'::jsonb)
on conflict (slug) do nothing;

insert into public.plans (
  slug, name, description, price_inr, billing_interval, included_credits,
  credit_validity_days, priority_level, commercial_usage, team_seats, display_order, metadata
) values
  ('creator', 'Creator', 'For individual creators', 499, 'month', 600, 35, 2, true, 1, 1, '{}'::jsonb),
  ('studio', 'Studio', 'For growing studios', 999, 'month', 1200, 35, 3, true, 3, 2, '{}'::jsonb),
  ('agency', 'Agency', 'For agencies & teams', 2499, 'month', 5000, 35, 4, true, 10, 3, '{"cta":"Talk to us"}'::jsonb)
on conflict (slug) do nothing;

insert into public.model_catalog (
  provider, provider_model_id, friendly_name, slug, category, generation_type,
  description, quality_tier, credit_cost, commercial_use_allowed,
  supports_image_input, supported_aspect_ratios, display_order, configuration
) values
  ('fal', 'fal-ai/flux/dev', 'Flux Studio', 'flux-studio', 'image', 'image',
   'Fast product-ready drafts', 'standard', 2, true, true,
   '["1:1","4:5","16:9","9:16"]'::jsonb, 1, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/flux/schnell', 'Imagen Fast', 'imagen-fast', 'image', 'image',
   'Quick standard images', 'fast', 2, true, false,
   '["1:1","4:5","16:9","9:16"]'::jsonb, 2, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/flux-pro', 'Imagen Pro', 'imagen-pro', 'image', 'image',
   'HD detail for campaigns', 'hd', 5, true, true,
   '["1:1","4:5","16:9","9:16"]'::jsonb, 3, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/flux-pro/v1.1', 'Imagen Premium', 'imagen-premium', 'image', 'image',
   'Premium image quality', 'premium', 10, true, true,
   '["1:1","4:5","16:9","9:16"]'::jsonb, 4, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/minimax/video-01', 'Video Fast', 'video-fast', 'video', 'video',
   'Fast short clips', 'fast', 10, true, true,
   '["16:9","9:16"]'::jsonb, 10, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/minimax/video-01-live', 'Video Standard', 'video-standard', 'video', 'video',
   'Standard motion', 'standard', 25, true, true,
   '["16:9","9:16"]'::jsonb, 11, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/kling-video/v1.6/standard', 'Video HD', 'video-hd', 'video', 'video',
   'HD video generations', 'hd', 45, true, true,
   '["16:9","9:16"]'::jsonb, 12, '{"verified":false}'::jsonb),
  ('fal', 'fal-ai/kling-video/v1.6/pro', 'Cinematic Video', 'video-cinematic', 'video', 'video',
   'Film-grade motion', 'cinematic', 80, true, true,
   '["16:9","9:16"]'::jsonb, 13, '{"verified":false}'::jsonb)
on conflict (slug) do nothing;

insert into public.templates (
  name, slug, category, description, default_prompt, estimated_credit_cost, featured, trending_score
) values
  ('Product Orbit', 'product-orbit', 'ads', 'Orbiting product hero',
   'Studio product shot on marble, soft window light, launch offer', 5, true, 100),
  ('Festival Burst', 'festival-burst', 'festival', 'Festival reel look',
   'Indian festival celebration, warm lights, vibrant colors', 25, true, 90),
  ('Portrait Drift', 'portrait-drift', 'portrait', 'Soft portrait drift',
   'Cinematic portrait, shallow depth of field', 5, false, 40)
on conflict (slug) do nothing;

-- Admin bootstrap note: after creating a user, run:
-- update public.profiles set role = 'super_admin' where email = 'you@example.com';
