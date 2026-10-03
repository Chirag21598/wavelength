import { supabaseAdmin } from "./supabaseAdmin";

const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-read-email",
  "user-read-private",
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-read-recently-played",
  "user-modify-playback-state",
].join(" ");

function basicAuthHeader() {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  return "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export function buildAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SPOTIFY_SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
  });
  return `${SPOTIFY_ACCOUNTS_URL}/authorize?${params.toString()}`;
}

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

/** Exchanges an OAuth authorization code for an access + refresh token pair. */
export async function exchangeCodeForTokens(
  code: string
): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Uses a refresh token to obtain a fresh access token. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<SpotifyTokenResponse> {
  const res = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

type UserTokenRow = {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
};

/**
 * Returns a valid Spotify access token for this user, transparently
 * refreshing (and persisting) it if the cached one has expired.
 */
export async function getValidAccessToken(user: UserTokenRow): Promise<string | null> {
  if (!user.refresh_token) return null;

  const expiresAt = user.token_expires_at ? new Date(user.token_expires_at).getTime() : 0;
  const stillValid = user.access_token && expiresAt - Date.now() > 30_000; // 30s buffer
  if (stillValid) return user.access_token;

  const refreshed = await refreshAccessToken(user.refresh_token);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabaseAdmin
    .from("users")
    .update({
      access_token: refreshed.access_token,
      token_expires_at: newExpiresAt,
      // Spotify only sometimes rotates the refresh token.
      ...(refreshed.refresh_token ? { refresh_token: refreshed.refresh_token } : {}),
    })
    .eq("id", user.id);

  return refreshed.access_token;
}

export type SpotifyNowPlaying = {
  isPlaying: boolean;
  track: string;
  artist: string;
  albumArt: string | null;
  playedAt: string; // ISO timestamp: "now" for currently playing, else last-played time
  progressMs: number | null;
  durationMs: number | null;
};

/**
 * Fetches what this Spotify user is playing right now, falling back to
 * their most recently played track if nothing is currently active.
 * Returns null only if we truly have no data (no recent plays at all).
 */
export async function fetchNowPlaying(accessToken: string): Promise<SpotifyNowPlaying | null> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const currentRes = await fetch(`${SPOTIFY_API_URL}/me/player/currently-playing`, { headers });
  if (currentRes.status === 200) {
    const data = await currentRes.json();
    if (data && data.item) {
      return {
        isPlaying: Boolean(data.is_playing),
        track: data.item.name,
        artist: (data.item.artists || []).map((a: { name: string }) => a.name).join(", "),
        albumArt: data.item.album?.images?.[0]?.url ?? null,
        playedAt: new Date().toISOString(),
        progressMs: typeof data.progress_ms === "number" ? data.progress_ms : null,
        durationMs: typeof data.item.duration_ms === "number" ? data.item.duration_ms : null,
      };
    }
  }

  // Nothing currently playing (204, or empty body) — fall back to recently played.
  const recentRes = await fetch(
    `${SPOTIFY_API_URL}/me/player/recently-played?limit=1`,
    { headers }
  );
  if (!recentRes.ok) return null;
  const recentData = await recentRes.json();
  const last = recentData?.items?.[0];
  if (!last) return null;

  return {
    isPlaying: false,
    track: last.track.name,
    artist: (last.track.artists || []).map((a: { name: string }) => a.name).join(", "),
    albumArt: last.track.album?.images?.[0]?.url ?? null,
    playedAt: last.played_at,
    progressMs: null,
    durationMs: null,
  };
}

/**
 * Sends a real playback-control command to whatever Spotify device the user
 * currently has active. Requires the user-modify-playback-state scope and an
 * active device in their Spotify app; Spotify returns 404 if neither exists.
 */
export async function controlPlayback(
  accessToken: string,
  action: "play" | "pause" | "next" | "previous"
): Promise<{ ok: boolean; status: number; message?: string }> {
  const method = action === "next" || action === "previous" ? "POST" : "PUT";
  const res = await fetch(`${SPOTIFY_API_URL}/me/player/${action}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 204 || res.ok) return { ok: true, status: res.status };
  const body = await res.text().catch(() => "");
  return { ok: false, status: res.status, message: body };
}

export type SpotifyProfile = {
  id: string;
  display_name: string | null;
  images?: { url: string }[];
};

export async function fetchSpotifyProfile(accessToken: string): Promise<SpotifyProfile> {
  const res = await fetch(`${SPOTIFY_API_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Spotify profile: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
