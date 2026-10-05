import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackKey } from "@/lib/trackKey";
import { distanceMeters, bearingDegrees, bearingToRadarAngle } from "@/lib/geo";

export const dynamic = "force-dynamic";

// A listener only shows up on the radar if their device reported a location
// recently, AND they're either playing something right now or finished
// playing something within the last 2 hours (the "broadcast window").
const LOCATION_FRESHNESS_MS = 15 * 60 * 1000; // 15 minutes
const BROADCAST_WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours — widened for early testing with few users
const WAVE_COOLDOWN_MS = 60 * 60 * 1000; // one wave per person per hour
const MAX_RADIUS_M = 20_000_000; // ~20,000km — effectively no cap, so e.g. Gurgaon <-> Coimbatore can see each other while there are few users

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
      "id, display_name, avatar_url, instagram, lat, lng, np_track, np_artist, np_album_art, np_is_playing, np_played_at, np_url, np_genre, novelty_score, appreciation_score"
    )
    .neq("id", me.id)
    .gte("location_updated_at", locationCutoff)
    .or(`np_is_playing.eq.true,np_played_at.gte.${npCutoff}`)
    .limit(200);

  if (candidatesError) {
    console.error("[api/nearby] query failed:", candidatesError);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const ids = (candidates ?? []).map((c) => c.id);

  // What I've already marked as new, and who I've waved at lately, so the
  // profile sheet can show those buttons as done.
  const { data: myMarks } = ids.length
    ? await supabaseAdmin
        .from("novelty_marks")
        .select("receiver_id, track_key")
        .eq("giver_id", me.id)
        .in("receiver_id", ids)
    : { data: [] as { receiver_id: string; track_key: string }[] };
  const markedKeys = new Set((myMarks ?? []).map((m) => `${m.receiver_id}|${m.track_key}`));

  const waveCutoff = new Date(Date.now() - WAVE_COOLDOWN_MS).toISOString();
  const { data: myWaves } = ids.length
    ? await supabaseAdmin
        .from("waves")
        .select("to_id")
        .eq("from_id", me.id)
        .gte("created_at", waveCutoff)
        .in("to_id", ids)
    : { data: [] as { to_id: string }[] };
  const wavedIds = new Set((myWaves ?? []).map((w) => w.to_id));

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
          url: c.np_url ?? null,
          genre: c.np_genre || null,
        },
        noveltyScore: c.novelty_score ?? 0,
        appreciationScore: c.appreciation_score ?? 0,
        hasMarked: markedKeys.has(`${c.id}|${trackKey(c.np_url, c.np_track, c.np_artist)}`),
        hasWaved: wavedIds.has(c.id),
      };
    })
    .filter((l) => l.distanceM <= MAX_RADIUS_M)
    .sort((a, b) => a.distanceM - b.distanceM);

  return NextResponse.json({ listeners, needsLocation: false });
}
