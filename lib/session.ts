import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabaseAdmin";

export const SESSION_COOKIE = "wl_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = {
  id: string;
  spotify_id: string;
  display_name: string | null;
  avatar_url: string | null;
  instagram: string | null;
};

/**
 * Creates a brand-new opaque session token, stores it in the `sessions`
 * table against the given user id, and sets it as an httpOnly cookie on
 * the current outgoing response. Must be called from a Route Handler.
 */
export async function createSession(userId: string) {
  const token = randomUUID();
  const { error } = await supabaseAdmin.from("sessions").insert({
    token,
    user_id: userId,
  });
  if (error) throw error;

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return token;
}

/** Reads the session cookie and resolves it to the signed-in user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("sessions")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  if (sessionError || !session) return null;

  const { data: user, error: userError } = await supabaseAdmin
    .from("users")
    .select("id, spotify_id, display_name, avatar_url, instagram")
    .eq("id", session.user_id)
    .maybeSingle();

  if (userError || !user) return null;
  return user as SessionUser;
}

/** Clears the session cookie and deletes the row from `sessions`. */
export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await supabaseAdmin.from("sessions").delete().eq("token", token);
  }
  cookieStore.delete(SESSION_COOKIE);
}
