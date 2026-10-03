import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, fetchSpotifyProfile } from "@/lib/spotify";
import { createSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const STATE_COOKIE = "wl_oauth_state";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const appUrl = new URL("/", request.url);

  if (error) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, request.url));
  }

  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const profile = await fetchSpotifyProfile(tokens.access_token);

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { data: user, error: upsertError } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          spotify_id: profile.id,
          display_name: profile.display_name ?? profile.id,
          avatar_url: profile.images?.[0]?.url ?? null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
        },
        { onConflict: "spotify_id" }
      )
      .select("id")
      .single();

    if (upsertError || !user) {
      throw upsertError ?? new Error("Failed to create or update user row");
    }

    await createSession(user.id);

    const res = NextResponse.redirect(appUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("[auth/callback] failed:", err);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
