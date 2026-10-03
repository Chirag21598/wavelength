import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { buildAuthorizeUrl } from "@/lib/spotify";

const STATE_COOKIE = "wl_oauth_state";

export async function GET(request: NextRequest) {
  const state = randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 minutes is plenty to complete the Spotify redirect dance
  });
  return res;
}
