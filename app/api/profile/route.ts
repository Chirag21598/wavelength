import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const instagram =
    typeof body?.instagram === "string" ? body.instagram.trim().replace(/^@/, "").slice(0, 60) : null;

  const { error } = await supabaseAdmin
    .from("users")
    .update({ instagram })
    .eq("id", sessionUser.id);

  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, instagram });
}
