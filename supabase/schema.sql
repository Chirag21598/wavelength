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

-- ---------------------------------------------------------------------------
-- Genres, novelty/appreciation points and waves (added later).
-- ---------------------------------------------------------------------------
alter table users add column if not exists np_url text;
alter table users add column if not exists np_genre text;
alter table users add column if not exists novelty_score integer not null default 0;
alter table users add column if not exists appreciation_score integer not null default 0;

create table if not exists novelty_marks (
  id uuid primary key default gen_random_uuid(),
  giver_id uuid not null references users(id) on delete cascade,
  receiver_id uuid not null references users(id) on delete cascade,
  track_key text not null,
  created_at timestamptz default now(),
  unique (giver_id, receiver_id, track_key)
);

create table if not exists waves (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references users(id) on delete cascade,
  to_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  seen_at timestamptz
);
create index if not exists waves_to_id_idx on waves(to_id);

alter table novelty_marks enable row level security;
alter table waves enable row level security;

-- Records one "That's new to me" (once per giver/receiver/track) and bumps both
-- scores in the same transaction. Returns false if it was already marked.
create or replace function mark_novel(p_giver uuid, p_receiver uuid, p_track text)
returns boolean
language plpgsql
as $$
declare
  n integer;
begin
  insert into novelty_marks (giver_id, receiver_id, track_key)
  values (p_giver, p_receiver, p_track)
  on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then
    return false;
  end if;
  update users set novelty_score = novelty_score + 1 where id = p_receiver;
  update users set appreciation_score = appreciation_score + 1 where id = p_giver;
  return true;
end;
$$;
revoke execute on function mark_novel(uuid, uuid, text) from public, anon, authenticated;
