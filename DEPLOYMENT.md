# Deployment

## Frontend (Vite)

1. Build: `npm run build`
2. Host `dist/` on Vercel/Netlify/Cloudflare Pages
3. Set production env:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_RAZORPAY_KEY_ID`
   - `VITE_APP_URL=https://your-domain`
   - `VITE_MOCK_BACKEND=false`

## Supabase

1. Create a Supabase project (region close to India if possible)
2. `supabase link --project-ref <ref>`
3. `supabase db push`
4. `supabase db execute -f supabase/seed.sql` (or include seed in migration)
5. Deploy functions:

```bash
supabase secrets set \
  RAZORPAY_KEY_ID=... \
  RAZORPAY_KEY_SECRET=... \
  RAZORPAY_WEBHOOK_SECRET=... \
  FAL_KEY=... \
  FAL_WEBHOOK_SECRET=... \
  R2_ACCESS_KEY_ID=... \
  R2_SECRET_ACCESS_KEY=... \
  R2_BUCKET_NAME=... \
  R2_ENDPOINT=... \
  APP_BASE_URL=https://your-domain \
  ALLOWED_ORIGINS=https://your-domain \
  APP_ENV=production \
  MOCK_PROVIDERS=false

supabase functions deploy create-razorpay-order
supabase functions deploy create-razorpay-subscription
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy submit-generation
supabase functions deploy fal-webhook --no-verify-jwt
```

## Razorpay dashboard

1. Enable UPI, cards, netbanking (INR)
2. Create subscription plans matching Creator / Studio / Agency INR amounts
3. Store each `plan_id` into `plans.razorpay_plan_id`
4. Webhook URL: `https://<project>.supabase.co/functions/v1/razorpay-webhook`
5. Subscribe to: `payment.captured`, `order.paid`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`, refunds
6. **Important:** `razorpay-webhook` must be deployed with `--no-verify-jwt` (Razorpay cannot send a Supabase JWT)

## FAL dashboard

1. Create API key → `FAL_KEY`
2. Configure webhook secret if available → `FAL_WEBHOOK_SECRET`
3. Verify each `provider_model_id` against live docs before enabling in UI

## Cloudflare R2

1. Create private bucket
2. API token with object read/write
3. Set R2 secrets on Edge Functions
4. Implement signed upload/download in production storage worker (adapter interface is in `src/lib/storage/adapter.ts`)

## Redis

Not deployed. Rate limiting can be added later with Upstash without schema changes.

## Remaining checklist

- [ ] Confirm FAL model IDs
- [ ] Map Razorpay plan IDs
- [ ] Configure Google OAuth redirect URLs
- [ ] Enable email OTP templates
- [ ] Create private storage buckets + RLS
- [ ] Schedule `expire_credits()` via pg_cron or Edge cron
- [ ] Turn off `MOCK_PROVIDERS` in production (must fail if secrets missing)
