import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { distanceMeters, bearingDegrees, bearingToRadarAngle } from "@/lib/geo";

export const dynamic = "force-dynamic";

// A listener only shows up on the radar if their device reported a location
// recently, AND they're either playing something right now or finished
// playing something within the last 2 hours (the "broadcast window").
const LOCATION_FRESHNESS_MS = 15 * 60 * 1000; // 15 minutes
const BROADCAST_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RADIUS_M = 5000; // 5km — generous for real-world testing

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: me, error: meError } = await supabaseAdmin
    .from("users")
    .select("id, lat, lng")
    .eq("id", sessionUser.id)
    .single();

  if (meError || !me) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  if (me.lat == null || me.lng == null) {
    return NextResponse.json({ listeners: [], needsLocation: true });
  }

  const locationCutoff = new Date(Date.now() - LOCATION_FRESHNESS_MS).toISOString();
  const npCutoff = new Date(Date.now() - BROADCAST_WINDOW_MS).toISOString();

  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from("users")
    .select(
      "id, display_name, avatar_url, instagram, lat, lng, np_track, np_artist, np_album_art, np_is_playing, np_played_at"
    )
    .neq("id", me.id)
    .gte("location_updated_at", locationCutoff)
    .or(`np_is_playing.eq.true,np_played_at.gte.${npCutoff}`)
    .limit(200);

  if (candidatesError) {
    console.error("[api/nearby] query failed:", candidatesError);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const listeners = (candidates ?? [])
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => {
      const distanceM = distanceMeters(me.lat!, me.lng!, c.lat!, c.lng!);
      const bearing = bearingDegrees(me.lat!, me.lng!, c.lat!, c.lng!);
      return {
        id: c.id,
        displayName: c.display_name,
        avatarUrl: c.avatar_url,
        instagram: c.instagram,
        distanceM: Math.round(distanceM),
        angle: bearingToRadarAngle(bearing),
        nowPlaying: {
          track: c.np_track,
          artist: c.np_artist,
          albumArt: c.np_album_art,
          isPlaying: c.np_is_playing,
          playedAt: c.np_played_at,
        },
      };
    })
    .filter((l) => l.distanceM <= MAX_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  return NextResponse.json({ listeners, needsLocation: false });
}
