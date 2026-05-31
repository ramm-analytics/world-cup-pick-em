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

  const { inviteCode } = payload.data;
  const admin = createSupabaseAdminClient();
  const [league, profile] = await Promise.all([
    admin.from("leagues").select("*").eq("invite_code", inviteCode).single(),
    admin.from("profiles").select("name").eq("id", user.id).single()
  ]);

  if (!league.data) {
    return NextResponse.json({ error: "Invite code not found." }, { status: 404 });
  }

  if (profile.error || !profile.data) {
    return NextResponse.json({ error: "Create your profile before joining a league." }, { status: 400 });
  }

  const members = await admin
    .from("league_members")
    .select("draft_position")
    .eq("league_id", league.data.id)
    .order("draft_position", { ascending: false });

  if ((members.data?.length ?? 0) >= league.data.max_members) {
    return NextResponse.json({ error: "League is full." }, { status: 409 });
  }

  const nextDraftPosition = (members.data?.[0]?.draft_position ?? 0) + 1;
  const member = await admin.from("league_members").insert({
    league_id: league.data.id,
    user_id: user.id,
    display_name: profile.data.name,
    draft_position: nextDraftPosition
  });

  if (member.error) {
    return NextResponse.json({ error: member.error.message }, { status: 400 });
  }

  return NextResponse.json({ league: league.data });
}
