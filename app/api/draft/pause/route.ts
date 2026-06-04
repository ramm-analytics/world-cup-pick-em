import { NextResponse } from "next/server";
import { pauseDraftSchema } from "@/lib/draft/validators";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = pauseDraftSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: "Sign in before pausing the draft." }, { status: 401 });
  }

  const draft = await supabase.from("drafts").select("*").eq("id", payload.data.draftId).single();
  if (draft.error || !draft.data) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  const league = await supabase.from("leagues").select("owner_id").eq("id", draft.data.league_id).single();
  if (league.error || !league.data) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  if (league.data.owner_id !== user.id) {
    return NextResponse.json({ error: "Only the league manager can pause the draft." }, { status: 403 });
  }

  const updated = await supabase
    .from("drafts")
    .update({
      status: "paused",
      updated_at: new Date().toISOString()
    })
    .eq("id", payload.data.draftId)
    .eq("status", "active")
    .select("*")
    .single();

  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 400 });
  }

  return NextResponse.json({ draft: updated.data });
}
