# Database entity summary

```
auth.users
  └─ profiles (1:1)
       ├─ wallets (1:1)
       ├─ credit_grants (1:N) ──► consumed FIFO by expires_at
       ├─ credit_transactions (1:N immutable ledger)
       ├─ workspaces (1:N)
       │    └─ projects (N)
       ├─ orders (1:N) ──► payments
       ├─ subscriptions (1:N) ──► plans
       ├─ generations (1:N)
       │    ├─ generation_credit_allocations ──► credit_grants
       │    └─ generation_outputs
       └─ referrals

catalog (public read):
  plans, credit_packs, model_catalog, templates

ops:
  webhook_events (unique provider + event id)
  admin_audit_logs
```

Credit flow: reserve (available→reserved) → capture (reserved→used) or release (reserved→available).
Payment flow: order created → Razorpay → webhook → grant_purchase_credits (idempotent).
Generation flow: submit-generation EF → FAL queue → fal-webhook → output + capture/release.
