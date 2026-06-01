import { NextResponse } from "next/server";
import { draftPickSchema } from "@/lib/draft/validators";
import { getCurrentTurn } from "@/lib/draft/order";
import { isDraftableTypeAllowed } from "@/lib/draft/rules";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = draftPickSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid pick." }, { status: 400 });
  }

  const authClient = await createSupabaseServerClient();
  const { data: userResult } = await authClient.auth.getUser();
  const user = userResult.user;

  if (!user) {
    return NextResponse.json({ error: "Sign in before making a pick." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { draftId, leagueMemberId, draftableType, nationalTeamId, playerId } = payload.data;

  const draftResult = await supabase.from("drafts").select("*").eq("id", draftId).single();
  if (!draftResult.data) {
    return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  }

  const draft = draftResult.data;
  if (draft.status !== "active") {
    return NextResponse.json({ error: "Draft is not active." }, { status: 409 });
  }

  const leagueResult = await supabase.from("leagues").select("*").eq("id", draft.league_id).single();
  if (!leagueResult.data) {
    return NextResponse.json({ error: "League not found." }, { status: 404 });
  }

  if (!isDraftableTypeAllowed(leagueResult.data, draftableType)) {
    return NextResponse.json({ error: "This league mode does not allow that pick type." }, { status: 400 });
  }

  const membersResult = await supabase
    .from("league_members")
    .select("*")
    .eq("league_id", draft.league_id)
    .order("draft_position");

  const members = membersResult.data ?? [];
  const currentTurn = getCurrentTurn(members, draft.round_count, draft.current_pick_number);

  if (!currentTurn || currentTurn.member.id !== leagueMemberId) {
    return NextResponse.json({ error: "It is not this manager's turn." }, { status: 409 });
  }

  if (currentTurn.member.user_id !== user.id) {
    return NextResponse.json({ error: "You can only draft during your own turn." }, { status: 403 });
  }

  const inserted = await supabase.from("draft_picks").insert({
    draft_id: draftId,
    league_member_id: leagueMemberId,
    pick_number: draft.current_pick_number,
    round_number: currentTurn.roundNumber,
    draftable_type: draftableType,
    national_team_id: nationalTeamId ?? null,
    player_id: playerId ?? null
  }).select("*").single();

  if (inserted.error) {
    return NextResponse.json({ error: inserted.error.message }, { status: 409 });
  }

  const totalPicks = members.length * draft.round_count;
  const nextPickNumber = draft.current_pick_number + 1;
  const isComplete = nextPickNumber > totalPicks;

  const updated = await supabase
    .from("drafts")
    .update({
      current_pick_number: isComplete ? draft.current_pick_number : nextPickNumber,
      status: isComplete ? "complete" : "active",
      completed_at: isComplete ? new Date().toISOString() : draft.completed_at,
      updated_at: new Date().toISOString()
    })
    .eq("id", draftId)
    .select("*")
    .single();

  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 500 });
  }

  return NextResponse.json({ pick: inserted.data, draft: updated.data });
}
