-- Каноническая PostgreSQL-схема фиксирует целевые домены TonForge, чтобы demo API можно было безопасно заменить реальными таблицами.
create extension if not exists "pgcrypto";

create table if not exists developer_profiles (
  wallet text primary key,
  display_name text not null,
  legal_name text not null,
  contact_email text not null,
  country_code text not null,
  bio text not null,
  kyc_status text not null check (kyc_status in ('draft', 'under_review', 'approved', 'rejected')),
  seller_badge text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists apps (
  app_id uuid primary key default gen_random_uuid(),
  catalog_product_id text not null unique,
  slug text not null unique,
  seller_wallet text not null references developer_profiles(wallet),
  name text not null,
  category text not null,
  summary text not null,
  description text not null,
  featured boolean not null default false,
  price_ton numeric(18, 9) not null,
  commission_bps integer not null default 2000,
  buyer_protection_hours integer not null default 72,
  license_type text not null check (license_type in ('SBT', 'Transferable')),
  transfer_limit integer not null default 0,
  activation_policy text not null,
  contract_status text not null default 'registry_pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_artifacts (
  artifact_id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(app_id) on delete cascade,
  file_name text not null,
  version text not null,
  size_label text not null,
  download_url text not null,
  sha256 text not null,
  developer_signature text not null,
  malware_status text not null,
  platforms text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists artifact_scans (
  scan_id uuid primary key default gen_random_uuid(),
  seller_wallet text not null references developer_profiles(wallet),
  file_name text not null,
  artifact_url text not null,
  sha256 text not null,
  integrity_fingerprint text not null,
  status text not null,
  findings jsonb not null default '[]'::jsonb,
  engines jsonb not null default '[]'::jsonb,
  scanned_at timestamptz not null default now()
);

create table if not exists purchase_sessions (
  purchase_session_id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(app_id),
  buyer_wallet text not null,
  state text not null check (
    state in (
      'draft',
      'awaiting_wallet_payment',
      'escrow_locked',
      'license_minted',
      'trial_active',
      'refunded',
      'released',
      'device_bound'
    )
  ),
  amount_ton numeric(18, 9) not null,
  amount_nano text not null,
  treasury_wallet text not null,
  escrow_address text not null,
  memo text not null,
  tx_hash text,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists licenses (
  license_id uuid primary key default gen_random_uuid(),
  purchase_session_id uuid not null unique references purchase_sessions(purchase_session_id),
  app_id uuid not null references apps(app_id),
  buyer_wallet text not null,
  nft_address text not null unique,
  collection_address text not null,
  escrow_address text not null,
  state text not null check (
    state in ('trial_active', 'released', 'refunded', 'device_bound')
  ),
  purchase_tx_hash text not null,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists license_devices (
  license_device_id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(license_id) on delete cascade,
  device_id text not null,
  activated_at timestamptz not null default now(),
  unique (license_id, device_id)
);

create table if not exists reviews (
  review_id uuid primary key default gen_random_uuid(),
  app_id uuid not null references apps(app_id) on delete cascade,
  author_wallet text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  created_at timestamptz not null default now()
);

create table if not exists disputes (
  dispute_id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(license_id) on delete cascade,
  buyer_wallet text not null,
  reason text not null,
  state text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists idx_apps_seller_wallet on apps (seller_wallet);
create index if not exists idx_purchase_sessions_buyer_wallet on purchase_sessions (buyer_wallet);
create index if not exists idx_licenses_buyer_wallet on licenses (buyer_wallet);
create index if not exists idx_reviews_app_id on reviews (app_id);
create index if not exists idx_disputes_license_id on disputes (license_id);
