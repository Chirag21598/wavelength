import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getValidAccessToken, fetchNowPlaying, SpotifyRateLimitError } from "@/lib/spotify";

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
};

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: fullUser, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, access_token, refresh_token, token_expires_at, lat, lng, location_updated_at, np_track, np_artist, np_album_art, np_is_playing, np_played_at, np_updated_at"
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
      nowPlaying = {
        isPlaying: Boolean(fullUser.np_is_playing),
        track: fullUser.np_track,
        artist: fullUser.np_artist ?? "",
        albumArt: fullUser.np_album_art ?? null,
        playedAt: fullUser.np_played_at ?? new Date().toISOString(),
        progressMs: null,
        durationMs: null,
      };
    }
  } else {
    try {
      const accessToken = await getValidAccessToken(fullUser);
      if (accessToken) {
        nowPlaying = await fetchNowPlaying(accessToken);
        if (nowPlaying) {
          await supabaseAdmin
            .from("users")
            .update({
              np_track: nowPlaying.track,
              np_artist: nowPlaying.artist,
              np_album_art: nowPlaying.albumArt,
              np_is_playing: nowPlaying.isPlaying,
              np_played_at: nowPlaying.playedAt,
              np_updated_at: new Date().toISOString(),
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
  });
}
