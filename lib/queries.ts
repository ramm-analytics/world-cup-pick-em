import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  demoDraft,
  demoLeague,
  demoMembers,
  demoPicks,
  demoPlayers,
  demoStandings,
  demoTeams
} from "@/lib/mock-data";

export async function getLeagueDashboard(leagueId = demoLeague.id) {
  if (!hasSupabaseEnv()) {
    return {
      league: demoLeague,
      members: demoMembers,
      standings: demoStandings,
      picks: demoPicks,
      teams: demoTeams,
      players: demoPlayers,
      scoreEvents: [],
      isDemo: true
    };
  }

  const supabase = await createSupabaseServerClient();
  const [league, members, standings, draft, teams, players, scoreEvents] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", leagueId).single(),
    supabase.from("league_members").select("*").eq("league_id", leagueId).order("draft_position"),
    supabase.from("league_scoring_standings").select("*").eq("league_id", leagueId).order("rank"),
    supabase.from("drafts").select("id").eq("league_id", leagueId).maybeSingle(),
    supabase.from("national_teams").select("*").order("name"),
    supabase.from("players").select("*, national_teams(name, flag_emoji, fifa_code)").order("name"),
    supabase.from("league_score_events").select("*").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(10)
  ]);

  const picks = draft.data?.id
    ? await supabase.from("draft_picks").select("*").eq("draft_id", draft.data.id).order("pick_number")
    : { data: [] };

  return {
    league: league.data,
    members: members.data ?? [],
    standings: standings.data ?? [],
    picks: picks.data ?? [],
    teams: teams.data ?? [],
    players: players.data ?? [],
    scoreEvents: scoreEvents.data ?? [],
    isDemo: false
  };
}

export async function getDraftRoom(leagueId = demoLeague.id) {
  if (!hasSupabaseEnv()) {
    return {
      league: demoLeague,
      members: demoMembers,
      draft: demoDraft,
      picks: demoPicks,
      teams: demoTeams,
      players: demoPlayers,
      isDemo: true
    };
  }

  const supabase = await createSupabaseServerClient();
  const [league, members, draft, teams, players] = await Promise.all([
    supabase.from("leagues").select("*").eq("id", leagueId).single(),
    supabase.from("league_members").select("*").eq("league_id", leagueId).order("draft_position"),
    supabase.from("drafts").select("*").eq("league_id", leagueId).single(),
    supabase.from("national_teams").select("*").order("name"),
    supabase.from("players").select("*, national_teams(name, flag_emoji, fifa_code)").order("projected_points", { ascending: false })
  ]);

  const picks = draft.data?.id
    ? await supabase.from("draft_picks").select("*").eq("draft_id", draft.data.id).order("pick_number")
    : { data: [] };

  return {
    league: league.data,
    members: members.data ?? [],
    draft: draft.data,
    picks: picks.data ?? [],
    teams: teams.data ?? [],
    players: players.data ?? [],
    isDemo: false
  };
}
