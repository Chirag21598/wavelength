import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { trackKey } from "@/lib/trackKey";

/**
 * "That's new to me": marks the track someone is playing as a discovery.
 * Gives them +1 novelty and gives the marker +1 appreciation. Each person can
 * mark a given track from a given listener only once.
 */
export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const receiverId = typeof body?.receiverId === "string" ? body.receiverId : null;
  if (!receiverId || receiverId === sessionUser.id) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  // Read the track from the database, never from the client, so nobody can
  // award points for a song the other person isn't actually playing.
  const { data: receiver, error } = await supabaseAdmin
    .from("users")
    .select("id, np_track, np_artist, np_url, novelty_score")
    .eq("id", receiverId)
    .maybeSingle();
  if (error || !receiver || !receiver.np_track) {
    return NextResponse.json({ error: "nothing_to_mark" }, { status: 404 });
  }

  const key = trackKey(receiver.np_url, receiver.np_track, receiver.np_artist);
  const { data: counted, error: rpcError } = await supabaseAdmin.rpc("mark_novel", {
    p_giver: sessionUser.id,
    p_receiver: receiver.id,
    p_track: key,
  });
  if (rpcError) {
    console.error("[api/marks] rpc failed:", rpcError);
    return NextResponse.json({ error: "mark_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyMarked: counted === false });
}
