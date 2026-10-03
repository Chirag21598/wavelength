# Wavelength

A location-proximity music discovery app: see what people near you are
really playing on Spotify right now.

This is the real build — it uses actual Spotify login and playback data,
actual browser geolocation, and a real database for nearby-listener
matching (no simulated data).

**New here?** Start with [`SETUP.md`](./SETUP.md) — it walks through the
one-time setup (Spotify app, Supabase database, Vercel deploy) needed before
this will run.

## Stack

- [Next.js](https://nextjs.org) (App Router) — frontend + API routes, one
  deployable project
- [Supabase](https://supabase.com) (Postgres) — stores user profiles,
  Spotify tokens, last known location, and cached now-playing data
- Spotify Web API — real OAuth login, real currently-playing / recently-played
  data, and real playback control (play/pause/skip)
- Deployed on [Vercel](https://vercel.com) (free tier)

## Project layout

- `app/api/auth/*` — Spotify OAuth login/callback/logout
- `app/api/me` — your own profile + live now-playing (refreshes from Spotify
  on every call)
- `app/api/location` — receives real geolocation updates from the browser
- `app/api/nearby` — computes real nearby listeners (distance + bearing) who
  are currently broadcasting (playing now, or played something in the last
  2 hours)
- `app/api/playback/[action]` — real play/pause/next/previous control
- `components/` — the UI (radar, turntable now-playing card, listener list,
  profile sheet)
- `lib/` — Spotify API helpers, session handling, geo math, Supabase client
- `supabase/schema.sql` — the two tables this app needs (run once, see
  SETUP.md)
