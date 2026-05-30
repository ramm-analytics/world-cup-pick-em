import { NextResponse } from "next/server";
import { joinLeagueSchema } from "@/lib/league/validators";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = joinLeagueSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid invite." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: "Sign in before joining a league." }, { status: 401 });
  }

  const { inviteCode, profileName } = payload.data;
  const admin = createSupabaseAdminClient();
  const league = await admin.from("leagues").select("*").eq("invite_code", inviteCode).single();

  if (!league.data) {
    return NextResponse.json({ error: "Invite code not found." }, { status: 404 });
  }

  const members = await admin
    .from("league_members")
    .select("draft_position")
    .eq("league_id", league.data.id)
    .order("draft_position", { ascending: false });

  if ((members.data?.length ?? 0) >= league.data.max_members) {
    return NextResponse.json({ error: "League is full." }, { status: 409 });
  }

  await admin.from("profiles").upsert({ id: user.id, name: profileName });

  const nextDraftPosition = (members.data?.[0]?.draft_position ?? 0) + 1;
  const member = await admin.from("league_members").insert({
    league_id: league.data.id,
    user_id: user.id,
    display_name: profileName,
    draft_position: nextDraftPosition
  });

  if (member.error) {
    return NextResponse.json({ error: member.error.message }, { status: 400 });
  }

  return NextResponse.json({ league: league.data });
}
