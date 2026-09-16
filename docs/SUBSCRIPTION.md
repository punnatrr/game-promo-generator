# Subscription system

The current production target is a manual-payment subscription flow:

1. A signed-in user selects an active plan from the database.
2. The API creates or reuses one pending payment for that user and plan.
3. The user submits payment proof.
4. An admin approves or rejects the payment.
5. Approval creates an active 30-day subscription with immutable plan snapshots.

## Database migrations

Preview the ordered migration list without connecting to the database:

```powershell
npm.cmd run db:migrate -- --dry-run
```

Inspect aggregate legacy-data counts before applying the Phase 1 cleanup:

```powershell
npm.cmd run db:check:subscription
```

Apply pending migrations using `DATABASE_URL` from the process environment or
`.env.local`:

```powershell
npm.cmd run db:migrate
```

To apply only the Subscription Phase 1 migration without touching unrelated
Game Calendar migrations in the same working tree:

```powershell
npm.cmd run db:migrate:subscription
```

Inspect and apply Subscription Phase 2 separately:

```powershell
npm.cmd run db:check:subscription:phase2
npm.cmd run db:migrate:subscription:phase2
npm.cmd run db:check:subscription:phase2
```

Phase 2 adds a 24-hour expiry to manual payment requests and records private
Blob metadata for proof images. The preflight reports how many legacy pending
payments will expire before the migration changes any data.

The runner records file names and SHA-256 checksums in `schema_migrations` and
uses a PostgreSQL advisory lock so only one runner can apply migrations at a
time. Applied migration files must not be edited; add a new migration instead.

The Phase 1 migration performs a one-time cleanup before adding invariants:

- active subscriptions whose period already ended become `expired`;
- only the newest active subscription per user remains active;
- only the newest pending payment per user and plan remains pending;
- only the newest pending proof per payment remains pending.

Review production data before applying the migration. The migration is not run
automatically during deployment.

## Plan source of truth

Public pricing, checkout, new payments, and new subscription entitlements read
from the `plans` table. Edit and seed plans in the database rather than adding
price or quota constants to application code.

Payments and subscriptions store snapshots of the selected plan. Later edits
to `plans` therefore affect new purchases only and do not change existing paid
entitlements.

## Free-trial codes

The trial-code migration creates the hidden `trial` plan (10 images), the
hashed promo-code tables, and the initial campaign code `LAZYFREE10`. A code
can be distributed to many users, but the database permits only one trial
redemption per user account. Users redeem it from the member dashboard.

Codes are normalized to uppercase and stored only as SHA-256 hashes. To add a
new campaign code, hash it inside PostgreSQL and connect it to the hidden trial
plan:

```sql
insert into promo_codes (code_hash, label, plan_id, expires_at, max_redemptions)
select
  encode(digest(upper('YOUR-CAMPAIGN-CODE'), 'sha256'), 'hex'),
  'Campaign label',
  id,
  null,
  null
from plans
where slug = 'trial';
```

Set `max_redemptions` to limit total claims for a campaign, or leave it null
for no campaign-wide limit. Deactivating a code blocks new claims without
removing trial entitlements that were already redeemed.

## Admin access

Admin access is granted by `users.role = 'admin'` or an exact normalized email
in `ADMIN_EMAILS`. Display names never grant admin access.

## Idempotency

Payment creation and admin decisions require an `Idempotency-Key` header. The
web UI sends a UUID. The database also prevents duplicate pending payments,
duplicate active subscriptions, duplicate provider payment IDs, and duplicate
pending proofs.

## PromptPay and private proof storage

Checkout displays the bundled static PromptPay image at
`public/payment/promptpay-qr.png`. Because this QR does not embed the payment
amount, the user must enter the exact THB amount shown on the payment request
before confirming the transfer. Bank-transfer instructions use `BANK_NAME`,
`BANK_ACCOUNT_NAME`, and `BANK_ACCOUNT_NUMBER`.

Create a **Private** Vercel Blob store and connect it to this project so
`BLOB_READ_WRITE_TOKEN` is available. Payment proofs accept JPG, PNG, or WebP
up to 4 MB. The server validates the file signature, stores it privately, and
delivers it only through an authenticated owner/admin route. Raw Blob URLs are
not returned by the payment APIs.
