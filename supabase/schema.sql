-- Wavelength database schema.
-- Run this once in your Supabase project's SQL editor (Supabase dashboard ->
-- SQL Editor -> New query -> paste this whole file -> Run).

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  spotify_id text unique not null,
  display_name text,
  avatar_url text,
  instagram text,

  -- Spotify OAuth tokens (server-side only; never sent to the browser).
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,

  -- Most recent real device location, sent by the browser's geolocation API.
  lat double precision,
  lng double precision,
  location_updated_at timestamptz,

  -- Cached snapshot of this user's real Spotify now-playing / last-played track.
  np_track text,
  np_artist text,
  np_album_art text,
  np_is_playing boolean default false,
  np_played_at timestamptz,
  np_updated_at timestamptz,

  created_at timestamptz default now()
);

create table if not exists sessions (
  token text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now()
);

create index if not exists sessions_user_id_idx on sessions(user_id);

-- Lock the tables down from the public/anon API key — only the service-role
-- key (used exclusively by our server-side Route Handlers) can read/write.
alter table users enable row level security;
alter table sessions enable row level security;
