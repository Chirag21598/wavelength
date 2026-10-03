import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getValidAccessToken, controlPlayback } from "@/lib/spotify";

const VALID_ACTIONS = new Set(["play", "pause", "next", "previous"]);

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/playback/[action]">
) {
  const { action } = await ctx.params;
  if (!VALID_ACTIONS.has(action)) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const { data: fullUser, error } = await supabaseAdmin
    .from("users")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("id", sessionUser.id)
    .single();

  if (error || !fullUser) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const accessToken = await getValidAccessToken(fullUser);
  if (!accessToken) {
    return NextResponse.json({ error: "no_spotify_token" }, { status: 400 });
  }

  const result = await controlPlayback(
    accessToken,
    action as "play" | "pause" | "next" | "previous"
  );

  if (!result.ok) {
    // Most common real-world cause: no active Spotify device, or a non-Premium account.
    return NextResponse.json(
      { error: "playback_control_failed", detail: result.message },
      { status: result.status === 404 ? 404 : 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
