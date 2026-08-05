# Backend setup (Dady.ai)

Redis / Upstash was **intentionally omitted** from this implementation.

## Prerequisites

- Node 20+
- Supabase CLI (`npm i -g supabase`)
- Razorpay test account
- FAL.ai account (optional in mock mode)
- Cloudflare R2 (optional; falls back to Supabase Storage in development)

## 1. Environment

```bash
cp .env.example .env
cp .env.example supabase/.env.local   # for edge function secrets locally
```

Set at least:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_RAZORPAY_KEY_ID`
- `VITE_MOCK_BACKEND=true` for UI-only local work without Supabase

When Supabase is not configured, the app runs a **mock backend** (catalog + auth + checkout simulation).

## 2. Start Supabase locally

```bash
supabase start
supabase db reset   # applies migrations + seed.sql
supabase status     # copy anon / service role keys into .env
```

## 3. Serve Edge Functions

```bash
supabase functions serve --env-file supabase/.env.local
```

Functions included:

| Function | Purpose |
|---|---|
| `create-razorpay-order` | One-time Mini Pack checkout |
| `create-razorpay-subscription` | Recurring plan checkout |
| `razorpay-webhook` | Signature-validated credit grants |
| `submit-generation` | Reserve credits + FAL queue submit |
| `fal-webhook` | Capture/release credits + store outputs |

Set `MOCK_PROVIDERS=true` to avoid live Razorpay/FAL calls while developing.

## 4. Frontend

```bash
npm install
npm run dev
```

Open http://localhost:5173

## 5. Webhooks (test)

Tunnel Edge Functions (example):

```bash
npx localtunnel --port 54321
```

Point Razorpay webhook to `/functions/v1/razorpay-webhook` and FAL webhook to `/functions/v1/fal-webhook`.

## 6. Admin bootstrap

After first Google/email user exists:

```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```

## 7. Storage

- Production: Cloudflare R2 via Edge Function signed URLs
- Development fallback: Supabase Storage bucket `outputs` (private)
- Never put `R2_SECRET_ACCESS_KEY` in `VITE_` vars

## 8. Verify FAL model IDs

Seed `model_catalog.provider_model_id` values are placeholders until verified against current FAL docs. Do not invent unsupported endpoints for production.

## Route map

See `ROUTE_MAP.md`.
