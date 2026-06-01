import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { MatchInput, PlayerInput, PlayerMatchStatInput, TeamInput } from "@/lib/ingestion/types";

type DbClient = SupabaseClient<Database>;
const placeholderPattern = /\b(winner|runner-up|runner up|third place|best third|play-?off|path|tbd|to be determined|placeholder)\b/i;

export async function cleanupPlaceholderNationalTeams(supabase: DbClient) {
  const teamsResult = await supabase.from("national_teams").select("id, name");
  if (teamsResult.error) throw teamsResult.error;

  const placeholderTeamIds = (teamsResult.data ?? [])
    .filter((team) => placeholderPattern.test(team.name))
    .map((team) => team.id);

  if (!placeholderTeamIds.length) {
    return { removedPlaceholderTeams: 0, removedPlaceholderMatches: 0 };
  }

  const draftPicksResult = await supabase.from("draft_picks").select("national_team_id").in("national_team_id", placeholderTeamIds);
  if (draftPicksResult.error) throw draftPicksResult.error;

  const draftedPlaceholderTeamIds = new Set((draftPicksResult.data ?? []).flatMap((pick) => pick.national_team_id ? [pick.national_team_id] : []));
  const removableTeamIds = placeholderTeamIds.filter((teamId) => !draftedPlaceholderTeamIds.has(teamId));

  if (!removableTeamIds.length) {
    return { removedPlaceholderTeams: 0, removedPlaceholderMatches: 0 };
  }

  const matchesResult = await supabase.from("matches").select("id, home_team_id, away_team_id");
  if (matchesResult.error) throw matchesResult.error;

  const removableTeamIdSet = new Set(removableTeamIds);
  const removableMatchIds = (matchesResult.data ?? [])
    .filter((match) => removableTeamIdSet.has(match.home_team_id) || removableTeamIdSet.has(match.away_team_id))
    .map((match) => match.id);

  if (removableMatchIds.length) {
    const { error } = await supabase.from("matches").delete().in("id", removableMatchIds);
    if (error) throw error;
  }

  const deletedPlayers = await supabase.from("players").delete().in("team_id", removableTeamIds);
  if (deletedPlayers.error) throw deletedPlayers.error;
  const deletedTeams = await supabase.from("national_teams").delete().in("id", removableTeamIds);
  if (deletedTeams.error) throw deletedTeams.error;

  return {
    removedPlaceholderTeams: removableTeamIds.length,
    removedPlaceholderMatches: removableMatchIds.length
  };
}

export async function cleanupStaleOpenFootballTeams(supabase: DbClient, validFifaCodes: string[]) {
  const teamsResult = await supabase.from("national_teams").select("id, fifa_code").eq("external_source", "openfootball");
  if (teamsResult.error) throw teamsResult.error;

  const validCodeSet = new Set(validFifaCodes);
  const staleTeamIds = (teamsResult.data ?? [])
    .filter((team) => !validCodeSet.has(team.fifa_code))
    .map((team) => team.id);

  if (!staleTeamIds.length) {
    return { removedStaleTeams: 0, removedStaleMatches: 0 };
  }

  const draftPicksResult = await supabase.from("draft_picks").select("national_team_id").in("national_team_id", staleTeamIds);
  if (draftPicksResult.error) throw draftPicksResult.error;

  const draftedTeamIds = new Set((draftPicksResult.data ?? []).flatMap((pick) => pick.national_team_id ? [pick.national_team_id] : []));
  const removableTeamIds = staleTeamIds.filter((teamId) => !draftedTeamIds.has(teamId));

  if (!removableTeamIds.length) {
    return { removedStaleTeams: 0, removedStaleMatches: 0 };
  }

  const matchesResult = await supabase.from("matches").select("id, home_team_id, away_team_id");
  if (matchesResult.error) throw matchesResult.error;

  const removableTeamIdSet = new Set(removableTeamIds);
  const removableMatchIds = (matchesResult.data ?? [])
    .filter((match) => removableTeamIdSet.has(match.home_team_id) || removableTeamIdSet.has(match.away_team_id))
    .map((match) => match.id);

  if (removableMatchIds.length) {
    const { error } = await supabase.from("matches").delete().in("id", removableMatchIds);
    if (error) throw error;
  }

  const deletedPlayers = await supabase.from("players").delete().in("team_id", removableTeamIds);
  if (deletedPlayers.error) throw deletedPlayers.error;

  const deletedTeams = await supabase.from("national_teams").delete().in("id", removableTeamIds);
  if (deletedTeams.error) throw deletedTeams.error;

  return {
    removedStaleTeams: removableTeamIds.length,
    removedStaleMatches: removableMatchIds.length
  };
}

export async function upsertTeams(supabase: DbClient, teams: TeamInput[]) {
  if (!teams.length) return 0;

  const rows = teams.map((team) => ({
    fifa_code: team.fifaCode,
    name: team.name,
    confederation: team.confederation,
    group_name: team.groupName ?? null,
    flag_emoji: team.flagEmoji ?? "",
    external_source: team.externalSource,
    external_id: team.externalId,
    logo_url: team.logoUrl ?? null
  }));

  const { error } = await supabase.from("national_teams").upsert(rows, { onConflict: "fifa_code" });
  if (error) throw error;
  return rows.length;
}

export async function upsertMatches(supabase: DbClient, matches: MatchInput[]) {
  if (!matches.length) return 0;

  const teamRows = await getTeamsByExternalAndCode(supabase);
  const teamIdByExternalKey = new Map(teamRows.filter((team) => team.external_source && team.external_id).map((team) => [`${team.external_source}:${team.external_id}`, team.id]));
  const teamIdByFifaCode = new Map(teamRows.map((team) => [team.fifa_code, team.id]));
  const rows = matches.flatMap((match) => {
    const homeTeamId = resolveTeamId(match.externalSource, match.homeTeamExternalId, match.homeTeamFifaCode, teamIdByExternalKey, teamIdByFifaCode);
    const awayTeamId = resolveTeamId(match.externalSource, match.awayTeamExternalId, match.awayTeamFifaCode, teamIdByExternalKey, teamIdByFifaCode);
    const winnerTeamId = resolveTeamId(match.externalSource, match.winnerTeamExternalId, match.winnerTeamFifaCode, teamIdByExternalKey, teamIdByFifaCode);

    if (!homeTeamId || !awayTeamId) {
      return [];
    }

    return [{
      stage: match.stage,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      starts_at: match.startsAt,
      home_score: match.homeScore ?? null,
      away_score: match.awayScore ?? null,
      is_final: match.isFinal ?? false,
      winner_team_id: winnerTeamId ?? null,
      external_source: match.externalSource,
      external_id: match.externalId,
      match_number: match.matchNumber ?? null,
      status: match.status ?? null,
      venue: match.venue ?? null
    }];
  });

  if (!rows.length) return 0;

  const { error } = await supabase.from("matches").upsert(rows, { onConflict: "external_source,external_id" });
  if (error) throw error;
  return rows.length;
}

export async function upsertPlayers(supabase: DbClient, players: PlayerInput[]) {
  if (!players.length) return 0;

  const teamRows = await getTeamsByExternalAndCode(supabase);
  const teamIdByExternalKey = new Map(teamRows.filter((team) => team.external_source && team.external_id).map((team) => [`${team.external_source}:${team.external_id}`, team.id]));
  const teamIdByFifaCode = new Map(teamRows.map((team) => [team.fifa_code, team.id]));
  const rows = players.flatMap((player) => {
    const teamId = player.teamExternalId && player.teamExternalSource
      ? teamIdByExternalKey.get(`${player.teamExternalSource}:${player.teamExternalId}`)
      : player.teamFifaCode
        ? teamIdByFifaCode.get(player.teamFifaCode)
        : null;

    if (!teamId) {
      return [];
    }

    return [{
      team_id: teamId,
      name: player.name,
      position: player.position,
      club: player.club ?? null,
      projected_points: player.projectedPoints ?? 0,
      external_source: player.externalSource,
      external_id: player.externalId ?? `${teamId}:${player.name}`,
      photo_url: player.photoUrl ?? null
    }];
  });

  if (!rows.length) return 0;

  const { error } = await supabase.from("players").upsert(rows, { onConflict: "external_source,external_id" });
  if (error) throw error;
  return rows.length;
}

export async function upsertPlayerMatchStats(supabase: DbClient, stats: PlayerMatchStatInput[]) {
  if (!stats.length) return 0;

  const [matchesResult, playersResult] = await Promise.all([
    supabase.from("matches").select("id, external_source, external_id"),
    supabase.from("players").select("id, external_source, external_id")
  ]);

  if (matchesResult.error) throw matchesResult.error;
  if (playersResult.error) throw playersResult.error;

  const matchIdByExternalId = new Map((matchesResult.data ?? []).filter((match) => match.external_source && match.external_id).map((match) => [`${match.external_source}:${match.external_id}`, match.id]));
  const playerIdByExternalId = new Map((playersResult.data ?? []).filter((player) => player.external_source && player.external_id).map((player) => [`${player.external_source}:${player.external_id}`, player.id]));
  const rows = stats.flatMap((stat) => {
    const matchId = matchIdByExternalId.get(`${stat.externalSource}:${stat.matchExternalId}`);
    const playerId = playerIdByExternalId.get(`${stat.externalSource}:${stat.playerExternalId}`);
    if (!matchId || !playerId) {
      return [];
    }

    return [{
      match_id: matchId,
      player_id: playerId,
      goals: stat.goals ?? 0,
      assists: stat.assists ?? 0,
      clean_sheet: stat.cleanSheet ?? false,
      minutes: stat.minutes ?? 0,
      external_source: stat.externalSource,
      external_id: stat.externalId
    }];
  });

  if (!rows.length) return 0;

  const { error } = await supabase.from("player_match_stats").upsert(rows, { onConflict: "external_source,external_id" });
  if (error) throw error;
  return rows.length;
}

async function getTeamsByExternalAndCode(supabase: DbClient) {
  const { data, error } = await supabase.from("national_teams").select("id, fifa_code, external_source, external_id");
  if (error) throw error;
  return data ?? [];
}

function resolveTeamId(
  source: string,
  externalId: string | null | undefined,
  fifaCode: string | null | undefined,
  teamIdByExternalKey: Map<string, string>,
  teamIdByFifaCode: Map<string, string>
) {
  if (externalId) {
    const externalMatch = teamIdByExternalKey.get(`${source}:${externalId}`);
    if (externalMatch) return externalMatch;
  }

  return fifaCode ? teamIdByFifaCode.get(fifaCode) : null;
}
