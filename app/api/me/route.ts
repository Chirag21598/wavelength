import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getValidAccessToken, fetchNowPlaying } from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: fullUser, error } = await supabaseAdmin
    .from("users")
    .select("id, access_token, refresh_token, token_expires_at, lat, lng, location_updated_at")
    .eq("id", sessionUser.id)
    .single();

  if (error || !fullUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  let nowPlaying = null;
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
      }
    }
  } catch (err) {
    console.error("[api/me] now-playing refresh failed:", err);
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
