import { NextResponse } from "next/server";
import { createLeagueSchema } from "@/lib/league/validators";
import { defaultScoringRules } from "@/lib/scoring/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = createLeagueSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid league." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: "Sign in before creating a league." }, { status: 401 });
  }

  const { name, maxMembers } = payload.data;
  const profile = await supabase.from("profiles").select("name").eq("id", user.id).single();

  if (profile.error || !profile.data) {
    return NextResponse.json({ error: "Create your profile before creating a league." }, { status: 400 });
  }

  const league = await supabase
    .from("leagues")
    .insert({
      name,
      owner_id: user.id,
      max_members: maxMembers,
      roster_team_slots: 2,
      roster_player_slots: 8,
      scoring_mode: "combo",
      scoring_rules: defaultScoringRules
    })
    .select("*")
    .single();

  if (league.error) {
    return NextResponse.json({ error: league.error.message }, { status: 400 });
  }

  const member = await supabase.from("league_members").insert({
    league_id: league.data.id,
    user_id: user.id,
    display_name: profile.data.name,
    draft_position: 1
  });

  if (member.error) {
    return NextResponse.json({ error: member.error.message }, { status: 400 });
  }

  const draft = await supabase.from("drafts").insert({
    league_id: league.data.id,
    status: "pending",
    current_pick_number: 1,
    round_count: league.data.roster_team_slots + league.data.roster_player_slots,
    seconds_per_pick: 90,
    started_at: null,
    completed_at: null
  });

  if (draft.error) {
    return NextResponse.json({ error: draft.error.message }, { status: 400 });
  }

  return NextResponse.json({ league: league.data });
}
