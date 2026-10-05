import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WAVE_COOLDOWN_MS = 60 * 60 * 1000; // one wave per person per hour

/** "Send a wave": saves a wave the receiver sees in their profile. */
export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const toId = typeof body?.toId === "string" ? body.toId : null;
  if (!toId || toId === sessionUser.id) {
    return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin.from("users").select("id").eq("id", toId).maybeSingle();
  if (!target) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const cutoff = new Date(Date.now() - WAVE_COOLDOWN_MS).toISOString();
  const { data: recent } = await supabaseAdmin
    .from("waves")
    .select("id")
    .eq("from_id", sessionUser.id)
    .eq("to_id", toId)
    .gte("created_at", cutoff)
    .limit(1);
  if (recent && recent.length > 0) {
    return NextResponse.json({ ok: true, alreadyWaved: true });
  }

  const { error } = await supabaseAdmin.from("waves").insert({ from_id: sessionUser.id, to_id: toId });
  if (error) {
    console.error("[api/waves] insert failed:", error);
    return NextResponse.json({ error: "wave_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, alreadyWaved: false });
}

/** Marks all my received waves as seen (clears the badge). */
export async function PATCH() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  await supabaseAdmin
    .from("waves")
    .update({ seen_at: new Date().toISOString() })
    .eq("to_id", sessionUser.id)
    .is("seen_at", null);
  return NextResponse.json({ ok: true });
}
