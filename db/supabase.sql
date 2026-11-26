-- Vale Palheiro — Supabase schema
-- Paste this into the Supabase SQL editor (Dashboard → SQL Editor → New query → Run).
-- Creates the two tables the app persists: guest preferences and events consent.

-- Guest preferences: the "prepare your stay" questionnaire answers, as JSON,
-- keyed by reservation id.
create table if not exists public.guest_preferences (
  reservation_id text primary key,
  data           jsonb       not null,
  updated_at     timestamptz not null default now()
);

-- Events / marketing consent, keyed by reservation id.
create table if not exists public.guest_consent (
  reservation_id    text        primary key,
  marketing_consent boolean     not null,
  updated_at        timestamptz not null default now()
);

-- Row Level Security.
-- The app connects with the SERVICE ROLE key (server-side only), which bypasses
-- RLS, so these tables are not exposed to anonymous/public clients. Enabling RLS
-- with no public policies is the safe default.
alter table public.guest_preferences enable row level security;
alter table public.guest_consent     enable row level security;

-- (Intentionally no public policies: only the service role may read/write.)
