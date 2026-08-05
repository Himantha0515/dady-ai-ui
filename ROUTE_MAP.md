# Route → Feature Map

Generated from the existing Vite + React Router frontend. Backend work **reuses** these routes; aliases added only where the plan requires missing pages.

## Existing routes (preserve UI)

| Route | Page / Component | Feature | Backend connection |
|---|---|---|---|
| `/` | `Landing` | Marketing home, presets, directory | Public; CTAs → auth-aware redirects |
| `/pricing` | `Pricing` | Plans + Mini Pack | `plans`, `credit_packs`; checkout via Razorpay EF |
| `/auth` | `Auth` | Sign up / sign in | Supabase Auth (Google, email OTP/password) — keep as `/auth` (alias `/login`) |
| `/checkout` | `Checkout` | Purchase flow UI | `create-razorpay-order` / subscription |
| `/app` | `Home` (AppLayout) | Authenticated home / dashboard | Wallet, featured models, presets from DB |
| `/app/create` | `CreateHub` | Create hub | Link to studios |
| `/app/create/image` | `ImageStudio` | Image generation | `submit-generation`, models, wallet |
| `/app/video` | `VideoStudio` | Video generation | `submit-generation` |
| `/app/templates` | `SimplePage` | Templates | `templates` table |
| `/app/projects` | `SimplePage` | Projects list | `projects` table |
| `/app/models` | `Models` | Model catalog | `model_catalog` |
| `/app/credits` | `Credits` | Wallet / usage | `wallets`, `credit_transactions` |
| `/app/help` | `SimplePage` | Help | Static + docs |

## Added authenticated routes (thin pages, match existing design language)

| Route | Purpose |
|---|---|
| `/login` | Redirect → `/auth` |
| `/onboarding` | Profile completion |
| `/dashboard` | Redirect → `/app` (preserve existing home) |
| `/billing/processing` | Wait for Razorpay webhook |
| `/billing/success` | Payment success |
| `/billing/failed` | Payment failed |
| `/403` | Forbidden |
| `/admin/*` | Admin shell (role-gated) |

## Intentionally skipped

- **Upstash Redis / rate-limit locks** — omitted per product request. Rate limits can be added later via DB counters or Redis.

## Button → action mapping (high level)

| Control | Unauthenticated | Authenticated |
|---|---|---|
| Start Creating / Get Started | `/auth?redirect=/app` | `/app` or `/onboarding` |
| Buy Credits / Pricing CTAs | `/auth?redirect=/pricing` | Razorpay checkout |
| Generate (studio) | `/auth?redirect=…` | `submit-generation` EF |
| Logo | `/` | `/app` when in app shell |
| Logout | — | Sign out → `/` |
