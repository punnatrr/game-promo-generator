-- Subscription Phase 2: expiring manual payments and private proof metadata.

alter table payments
  add column if not exists expires_at timestamptz;

update payments
set expires_at = created_at + interval '24 hours'
where expires_at is null;

alter table payments
  alter column expires_at set default (now() + interval '24 hours'),
  alter column expires_at set not null;

update payments
set status = 'expired', updated_at = now()
where status = 'pending'
  and expires_at <= now();

alter table payment_proofs
  add column if not exists storage_provider text,
  add column if not exists blob_pathname text,
  add column if not exists content_type text,
  add column if not exists size_bytes integer,
  add column if not exists original_filename text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists payments_pending_expiry_idx
  on payments(expires_at)
  where status = 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'payments_expiry_check'
  ) then
    alter table payments
      add constraint payments_expiry_check
      check (expires_at > created_at);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payment_proofs_size_bytes_check'
  ) then
    alter table payment_proofs
      add constraint payment_proofs_size_bytes_check
      check (size_bytes is null or size_bytes between 1 and 5242880);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'payment_proofs_content_type_check'
  ) then
    alter table payment_proofs
      add constraint payment_proofs_content_type_check
      check (
        content_type is null
        or content_type in ('image/jpeg', 'image/png', 'image/webp')
      );
  end if;
end $$;
