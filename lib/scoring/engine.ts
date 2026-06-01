import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeScoringRules } from "@/lib/scoring/settings";
import type { Database, DraftPick, League, LeagueMember, Match, MatchStage } from "@/types/database";

type ScoreEventInsert = Database["public"]["Tables"]["league_score_events"]["Insert"];

type TeamPick = DraftPick & {
  league_member_id: string;
  national_team_id: string;
};

const roundBonusByStage: Partial<Record<MatchStage, keyof ReturnType<typeof normalizeScoringRules>>> = {
  round_of_32: "round_bonus_round_of_32",
  round_of_16: "round_bonus_round_of_16",
  quarterfinal: "round_bonus_quarterfinal",
  semifinal: "round_bonus_semifinal",
  final: "round_bonus_final"
};

export async function recalculateLeagueScores(leagueId: string) {
  const supabase = createSupabaseAdminClient();
  const run = await supabase.from("league_score_runs").insert({ league_id: leagueId, status: "running" }).select("id").single();
  if (run.error) throw run.error;

  try {
    await supabase.from("league_score_events").delete().eq("league_id", leagueId);

    const leagueResult = await supabase.from("leagues").select("*").eq("id", leagueId).single();
    if (leagueResult.error || !leagueResult.data) {
      throw leagueResult.error ?? new Error("League not found.");
    }

    const events = await calculateLeagueScoreEvents(leagueResult.data);
    if (events.length) {
      const inserted = await supabase.from("league_score_events").insert(events);
      if (inserted.error) throw inserted.error;
    }

    const finished = await supabase
      .from("league_score_runs")
      .update({ status: "success", finished_at: new Date().toISOString() })
      .eq("id", run.data.id);
    if (finished.error) throw finished.error;

    return { runId: run.data.id, events: events.length };
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Unknown scoring failure.";
    await supabase
      .from("league_score_runs")
      .update({ status: "failed", finished_at: new Date().toISOString(), error })
      .eq("id", run.data.id);
    throw caught;
  }
}

async function calculateLeagueScoreEvents(league: League): Promise<ScoreEventInsert[]> {
  if (league.scoring_mode === "player_pickem") {
    return [];
  }

  const supabase = createSupabaseAdminClient();
  const [membersResult, draftResult, matchesResult] = await Promise.all([
    supabase.from("league_members").select("*").eq("league_id", league.id),
    supabase.from("drafts").select("id").eq("league_id", league.id).maybeSingle(),
    supabase.from("matches").select("*").eq("is_final", true)
  ]);

  if (membersResult.error) throw membersResult.error;
  if (draftResult.error) throw draftResult.error;
  if (matchesResult.error) throw matchesResult.error;
  if (!draftResult.data) return [];

  const picksResult = await supabase
    .from("draft_picks")
    .select("*")
    .eq("draft_id", draftResult.data.id)
    .eq("draftable_type", "team")
    .not("national_team_id", "is", null);
  if (picksResult.error) throw picksResult.error;

  const membersById = new Map((membersResult.data ?? []).map((member) => [member.id, member]));
  const picks = (picksResult.data ?? []).filter(isTeamPick);
  const rules = normalizeScoringRules(league.scoring_rules);

  return picks.flatMap((pick) => {
    const member = membersById.get(pick.league_member_id);
    if (!member) return [];

    return calculateTeamPickEvents(league, member, pick, matchesResult.data ?? [], rules);
  });
}

function calculateTeamPickEvents(
  league: League,
  member: LeagueMember,
  pick: TeamPick,
  matches: Match[],
  rules: ReturnType<typeof normalizeScoringRules>
): ScoreEventInsert[] {
  return matches
    .filter((match) => match.home_team_id === pick.national_team_id || match.away_team_id === pick.national_team_id)
    .flatMap((match) => {
      const events: ScoreEventInsert[] = [];
      const outcome = teamOutcome(match, pick.national_team_id);
      const outcomePoints = rules[outcome.ruleKey];

      events.push({
        league_id: league.id,
        league_member_id: member.id,
        draft_pick_id: pick.id,
        source_type: "team_match",
        source_id: match.id,
        category: outcome.category,
        points: outcomePoints,
        description: outcome.description,
        metadata: {
          stage: match.stage,
          home_team_id: match.home_team_id,
          away_team_id: match.away_team_id,
          home_score: match.home_score,
          away_score: match.away_score,
          status: match.status
        }
      });

      const bonus = roundBonus(match, pick.national_team_id, rules);
      if (bonus) {
        events.push({
          league_id: league.id,
          league_member_id: member.id,
          draft_pick_id: pick.id,
          source_type: "team_match",
          source_id: match.id,
          category: bonus.category,
          points: bonus.points,
          description: bonus.description,
          metadata: {
            stage: match.stage,
            winner_team_id: match.winner_team_id
          }
        });
      }

      return events;
    });
}

function teamOutcome(match: Match, teamId: string) {
  const isHome = match.home_team_id === teamId;
  const teamScore = isHome ? match.home_score : match.away_score;
  const opponentScore = isHome ? match.away_score : match.home_score;
  const wonPenaltyShootout = match.status === "PEN" && match.winner_team_id === teamId;
  const lostPenaltyShootout = match.status === "PEN" && match.winner_team_id && match.winner_team_id !== teamId;

  if (wonPenaltyShootout) {
    return { category: "team_win", ruleKey: "team_win" as const, description: "Team advanced after penalties." };
  }

  if (lostPenaltyShootout) {
    return { category: "team_pk_loss", ruleKey: "team_pk_loss" as const, description: "Team lost after penalties." };
  }

  if (teamScore !== null && opponentScore !== null && teamScore > opponentScore) {
    return { category: "team_win", ruleKey: "team_win" as const, description: "Team won the match." };
  }

  if (teamScore !== null && opponentScore !== null && teamScore === opponentScore) {
    return { category: "team_draw", ruleKey: "team_draw" as const, description: "Team drew the match." };
  }

  return { category: "team_loss", ruleKey: "team_loss" as const, description: "Team lost the match." };
}

function roundBonus(match: Match, teamId: string, rules: ReturnType<typeof normalizeScoringRules>) {
  if (match.winner_team_id !== teamId) return null;

  const ruleKey = match.stage === "final" ? "round_bonus_champion" : roundBonusByStage[match.stage];
  if (!ruleKey) return null;

  return {
    category: ruleKey,
    points: rules[ruleKey],
    description: match.stage === "final" ? "Champion bonus." : `Advanced from ${match.stage.replace(/_/g, " ")}.`
  };
}

function isTeamPick(pick: DraftPick): pick is TeamPick {
  return pick.draftable_type === "team" && Boolean(pick.national_team_id);
}
