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
  collection_index bigint not null default 0,
  escrow_address text not null,
  state text not null check (
    state in (
      'mint_pending',
      'mint_failed',
      'trial_active',
      'device_bound',
      'released',
      'refunded',
      'burn_pending',
      'revoked'
    )
  ),
  purchase_tx_hash text not null,
  mint_tx_hash text,
  burn_tx_hash text,
  mint_error text,
  burn_deadline integer,
  trial_ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_collections (
  app_id uuid primary key references apps(app_id) on delete cascade,
  collection_address text not null unique,
  owner_wallet text not null,
  deploy_tx_hash text not null,
  metadata_uri_prefix text,
  network text not null check (network in ('mainnet', 'testnet')),
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

create index if not exists idx_apps_seller_wallet on apps (seller_wallet);
create index if not exists idx_purchase_sessions_buyer_wallet on purchase_sessions (buyer_wallet);
create index if not exists idx_licenses_buyer_wallet on licenses (buyer_wallet);
create index if not exists idx_licenses_nft_address on licenses (nft_address);
create index if not exists idx_licenses_state on licenses (state);
create index if not exists idx_app_collections_network on app_collections (network);
create index if not exists idx_reviews_app_id on reviews (app_id);

-- Migration helper: forward-compat for existing DBs deployed before NFT
-- integration. Safe to re-run.
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'collection_index') then
    alter table licenses add column collection_index bigint not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'mint_tx_hash') then
    alter table licenses add column mint_tx_hash text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'burn_tx_hash') then
    alter table licenses add column burn_tx_hash text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'mint_error') then
    alter table licenses add column mint_error text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'updated_at') then
    alter table licenses add column updated_at timestamptz not null default now();
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'licenses' and column_name = 'burn_deadline') then
    alter table licenses add column burn_deadline integer;
  end if;
end$$;

-- v2 migration: drop disputes table (refund is now buyer-initiated on-chain)
drop table if exists disputes;
