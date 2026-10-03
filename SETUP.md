# Getting Wavelength live

This turns the prototype into a real app: real Spotify login, your real
current/last-played track, real browser geolocation, and real nearby
listeners pulled from a database — nothing simulated. Three accounts are
needed, all free: Spotify (you already have this), Supabase, and Vercel.

Budget about 20–30 minutes for the one-time setup below.

## 1. Create a Spotify app (gets you a Client ID + Secret)

1. Go to https://developer.spotify.com/dashboard and log in with your normal
   Spotify account.
2. Click **Create app**.
   - App name: `Wavelength` (anything works, only you see this)
   - App description: anything, e.g. `Personal proximity music app`
   - Redirect URI: add **exactly** `http://127.0.0.1:3000/api/auth/callback`
     for now — you'll add the production one after deploying (step 4).
   - Which API/SDKs are you planning to use: check **Web API**.
   - Agree to the terms and click **Save**.
3. Open the new app, click **Settings**, and copy the **Client ID**. Click
   **View client secret** and copy that too. You'll paste both into Vercel
   in step 3.

Keep the Client Secret private — never commit it to git or share it.

## 2. Create a Supabase project (the database)

1. Go to https://supabase.com, sign up free, and create a new project
   (pick any name/region; remember the database password it asks you to
   set, though you won't need it for this).
2. Once it's ready, open the **SQL Editor** (left sidebar), click
   **New query**, paste in the entire contents of this project's
   `supabase/schema.sql` file, and click **Run**. That creates the two
   tables Wavelength needs (`users`, `sessions`).
3. Go to **Project Settings -> Data API**. Copy the **Project URL** — that's
   your `SUPABASE_URL`.
4. Go to **Project Settings -> API Keys**. Copy the **service_role** secret
   key — that's your `SUPABASE_SERVICE_ROLE_KEY`. (Not the `anon` key — the
   service-role key is what lets the server read/write user rows; it's never
   exposed to the browser.)

## 3. Deploy to Vercel

1. Push this project to a GitHub repo (or ask me to do it for you if this
   session has GitHub access set up).
2. Go to https://vercel.com, sign up free with GitHub, click **Add New ->
   Project**, and import the repo.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `SPOTIFY_REDIRECT_URI` — leave this blank for now, you'll fill it in
     after the first deploy (step 4), once you know your real URL.
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**. Vercel gives you a URL like
   `https://wavelength-xyz.vercel.app`.

## 4. Wire the real redirect URI

1. Back in Vercel -> Settings -> Environment Variables, set
   `SPOTIFY_REDIRECT_URI` to
   `https://wavelength-xyz.vercel.app/api/auth/callback` (your actual
   domain), then redeploy (Vercel -> Deployments -> ⋯ -> Redeploy).
2. Back in the Spotify dashboard -> your app -> Settings -> Redirect URIs,
   click **Add** and add that same
   `https://wavelength-xyz.vercel.app/api/auth/callback` URL (keep the
   `127.0.0.1` one too, so local dev keeps working). Save.

## 5. Try it

Open your Vercel URL on your phone (over cellular or wifi — location works
either way), tap **Connect with Spotify**, approve the permissions, and
allow location access when your browser asks. Your real now-playing track
should show up in the turntable card at the bottom. Get a friend to do the
same on their phone near you, and you should each show up on the other's
radar within about 15 seconds.

Two things worth knowing about how "real-time" works here: your location
and now-playing are refreshed automatically every 10–30 seconds (not a
constant live stream — much simpler to run reliably for free, and plenty
fast for walking-around testing), and the play/pause/skip buttons send real
commands to whatever device your Spotify app is currently active on
(requires Spotify Premium — Spotify's API doesn't allow playback control on
free accounts).

## Local development

```
cp .env.example .env.local   # fill in the real values
npm install
npm run dev
```

Then open http://127.0.0.1:3000 (use `127.0.0.1`, not `localhost` — Spotify
requires the literal loopback IP for non-HTTPS redirect URIs).

## What's intentionally not built yet

To keep this first real version focused and shippable, a few things from
the earlier prototype aren't wired up yet: genre filters, and the
playlists/novelty-points sections in the profile sheet (those had no real
data source). Happy to add any of these for real once the core is working
— just ask.
