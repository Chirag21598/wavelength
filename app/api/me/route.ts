import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getValidAccessToken, fetchNowPlaying, SpotifyRateLimitError } from "@/lib/spotify";
import { lookupGenre } from "@/lib/lastfm";

export const dynamic = "force-dynamic";

// Spotify dev-mode apps have a small shared request quota, so we only ask
// Spotify about a user at most once a minute and serve the saved copy in
// between. If Spotify answers 429 we back off for a few minutes.
const NP_REFRESH_MS = 60_000;
const NP_BACKOFF_MS = 5 * 60_000;

type NowPlayingPayload = {
  isPlaying: boolean;
  track: string;
  artist: string;
  albumArt: string | null;
  playedAt: string;
  progressMs: number | null;
  durationMs: number | null;
  url: string | null;
  genre: string | null;
};

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: fullUser, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, access_token, refresh_token, token_expires_at, lat, lng, location_updated_at, np_track, np_artist, np_album_art, np_is_playing, np_played_at, np_updated_at, np_url, np_genre, novelty_score, appreciation_score"
    )
    .eq("id", sessionUser.id)
    .single();

  if (error || !fullUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  let nowPlaying: NowPlayingPayload | null = null;

  // np_updated_at doubles as the throttle clock (it is set into the future
  // after a 429 to hold off further Spotify calls).
  const lastRefresh = fullUser.np_updated_at ? new Date(fullUser.np_updated_at).getTime() : 0;
  const isFresh = Date.now() - lastRefresh < NP_REFRESH_MS;

  if (isFresh) {
    if (fullUser.np_track) {
      // Backfill a missing genre for the saved track (no Spotify call needed).
      // Stored as "" when nothing was found so we don't look it up again.
      let savedGenre: string | null = fullUser.np_genre || null;
      if (fullUser.np_genre == null) {
        savedGenre = await lookupGenre(fullUser.np_track, fullUser.np_artist ?? "");
        await supabaseAdmin
          .from("users")
          .update({ np_genre: savedGenre ?? "" })
          .eq("id", fullUser.id);
      }
      nowPlaying = {
        isPlaying: Boolean(fullUser.np_is_playing),
        track: fullUser.np_track,
        artist: fullUser.np_artist ?? "",
        albumArt: fullUser.np_album_art ?? null,
        playedAt: fullUser.np_played_at ?? new Date().toISOString(),
        progressMs: null,
        durationMs: null,
        url: fullUser.np_url ?? null,
        genre: savedGenre,
      };
    }
  } else {
    try {
      const accessToken = await getValidAccessToken(fullUser);
      if (accessToken) {
        const fresh = await fetchNowPlaying(accessToken);
        if (fresh) {
          // Only look up the genre when the track changed (or we never found
          // one) — the tag services are free but there's no reason to hammer them.
          // Stored as "" when nothing was found, so we don't retry forever.
          const changed = fullUser.np_track !== fresh.track || fullUser.np_artist !== fresh.artist;
          let genre: string = fullUser.np_genre ?? "";
          if (changed || fullUser.np_genre == null) {
            genre = (await lookupGenre(fresh.track, fresh.artist)) ?? "";
          }

          nowPlaying = { ...fresh, genre: genre || null };
          await supabaseAdmin
            .from("users")
            .update({
              np_track: fresh.track,
              np_artist: fresh.artist,
              np_album_art: fresh.albumArt,
              np_is_playing: fresh.isPlaying,
              np_played_at: fresh.playedAt,
              np_updated_at: new Date().toISOString(),
              np_url: fresh.url,
              np_genre: genre,
            })
            .eq("id", fullUser.id);
        } else {
          // Nothing to show — still stamp the clock so we don't re-ask every poll.
          await supabaseAdmin
            .from("users")
            .update({ np_updated_at: new Date().toISOString() })
            .eq("id", fullUser.id);
        }
      }
    } catch (err) {
      console.error("[api/me] now-playing refresh failed:", err);
      if (err instanceof SpotifyRateLimitError) {
        await supabaseAdmin
          .from("users")
          .update({ np_updated_at: new Date(Date.now() + NP_BACKOFF_MS).toISOString() })
          .eq("id", fullUser.id);
      }
    }
  }

  // Waves other people have sent me.
  const { data: waveRows } = await supabaseAdmin
    .from("waves")
    .select("from_id, created_at, seen_at")
    .eq("to_id", fullUser.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const waves = waveRows ?? [];
  const recentRows = waves.slice(0, 5);
  const senderIds = [...new Set(recentRows.map((w) => w.from_id))];
  const { data: senders } = senderIds.length
    ? await supabaseAdmin.from("users").select("id, display_name").in("id", senderIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((senders ?? []).map((u) => [u.id, u.display_name]));

  return NextResponse.json({
    user: {
      id: sessionUser.id,
      displayName: sessionUser.display_name,
      avatarUrl: sessionUser.avatar_url,
      instagram: sessionUser.instagram,
    },
    location:
      fullUser.lat != null && fullUser.lng != null
        ? {
            lat: fullUser.lat,
            lng: fullUser.lng,
            updatedAt: fullUser.location_updated_at,
          }
        : null,
    nowPlaying,
    noveltyScore: fullUser.novelty_score ?? 0,
    appreciationScore: fullUser.appreciation_score ?? 0,
    waves: {
      unseen: waves.filter((w) => !w.seen_at).length,
      total: waves.length,
      recent: recentRows.map((w) => ({
        fromId: w.from_id,
        fromName: nameById.get(w.from_id) ?? null,
        at: w.created_at,
      })),
    },
  });
}
