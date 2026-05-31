import { env } from "@/lib/env";
import {
  ApiFootballClient,
  type ApiFootballFixture,
  type ApiFootballFixturePlayers,
  type ApiFootballPlayer,
  type ApiFootballStanding,
  type ApiFootballTeam,
  makeApiFootballCounts,
  RequestBudget
} from "@/lib/ingestion/api-football-client";
import {
  mapApiFootballFixturePlayers,
  mapApiFootballFixtures,
  mapApiFootballPlayers,
  mapApiFootballTeams
} from "@/lib/ingestion/api-football-mappers";
import { EXPECTED_WORLD_CUP_TEAM_COUNT, fetchOpenFootballBaseline } from "@/lib/ingestion/openfootball";
import type { SyncCounts, SyncMode, SyncResult, SyncStatus } from "@/lib/ingestion/types";
import {
  cleanupPlaceholderNationalTeams,
  cleanupStaleOpenFootballTeams,
  upsertMatches,
  upsertPlayerMatchStats,
  upsertPlayers,
  upsertTeams
} from "@/lib/ingestion/upsert";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export async function syncWorldCupData(mode: SyncMode): Promise<SyncResult[]> {
  const supabase = createSupabaseAdminClient();
  const modes = expandMode(mode);
  const results: SyncResult[] = [];

  for (const expandedMode of modes) {
    if (expandedMode === "baseline") {
      results.push(await withSyncRun("openfootball", expandedMode, async () => {
        const baseline = await fetchOpenFootballBaseline();
        const placeholderCleanupCounts = await cleanupPlaceholderNationalTeams(supabase);
        const staleCleanupCounts = await cleanupStaleOpenFootballTeams(supabase, baseline.teams.map((team) => team.fifaCode));
        const teams = await upsertTeams(supabase, baseline.teams);
        const matches = await upsertMatches(supabase, baseline.matches);
        const actualTeams = await countActualNationalTeams();
        const isValidTeamCount = actualTeams === EXPECTED_WORLD_CUP_TEAM_COUNT;

        return {
          status: isValidTeamCount ? "success" : "partial",
          counts: {
            ...placeholderCleanupCounts,
            ...staleCleanupCounts,
            teams,
            matches,
            actualTeams,
            expectedTeams: EXPECTED_WORLD_CUP_TEAM_COUNT
          },
          error: isValidTeamCount
            ? undefined
            : `Expected ${EXPECTED_WORLD_CUP_TEAM_COUNT} national teams, found ${actualTeams}.`
        };
      }));
      continue;
    }

    results.push(await withSyncRun("api-football", expandedMode, async () => {
      const client = new ApiFootballClient();
      if (!client.isConfigured) {
        return { status: "skipped", counts: {}, error: "Missing API_FOOTBALL_KEY." };
      }

      const alreadyUsed = await getApiRequestsUsedToday();
      const budget = new RequestBudget(env.apiFootballDailyBudget, alreadyUsed);

      if (budget.remaining <= 0) {
        return { status: "skipped", counts: { apiRequests: budget.count }, error: "API-Football daily budget exhausted." };
      }

      if (expandedMode === "api-football-lite") {
        return syncApiFootballLite(client, budget);
      }

      if (expandedMode === "results") {
        return syncApiFootballResults(client, budget);
      }

      return syncApiFootballFull(client, budget);
    }));
  }

  return results;
}

async function syncApiFootballLite(client: ApiFootballClient, budget: RequestBudget) {
  const supabase = createSupabaseAdminClient();
  await client.get("/leagues", { id: env.apiFootballLeagueId, season: env.apiFootballSeason }, budget);
  const teamsResponse = await client.get<ApiFootballTeam>("/teams", commonParams(), budget);
  const fixturesResponse = await client.get<ApiFootballFixture>("/fixtures", commonParams(), budget);
  const standingsResponse = await client.get<ApiFootballStanding>("/standings", commonParams(), budget);

  const teams = await upsertTeams(supabase, mapApiFootballTeams(teamsResponse.response, standingsResponse.response));
  const matches = await upsertMatches(supabase, mapApiFootballFixtures(fixturesResponse.response));

  return {
    status: "success" as const,
    counts: { ...makeApiFootballCounts(budget), teams, matches }
  };
}

async function syncApiFootballResults(client: ApiFootballClient, budget: RequestBudget) {
  const supabase = createSupabaseAdminClient();
  const fixturesResponse = await client.get<ApiFootballFixture>("/fixtures", commonParams(), budget);
  const matches = await upsertMatches(supabase, mapApiFootballFixtures(fixturesResponse.response));

  return {
    status: "success" as const,
    counts: { ...makeApiFootballCounts(budget), matches }
  };
}

async function syncApiFootballFull(client: ApiFootballClient, budget: RequestBudget) {
  const supabase = createSupabaseAdminClient();
  const lite = await syncApiFootballLite(client, budget);
  let players = 0;
  let playerStats = 0;
  let status: SyncStatus = "success";
  let error: string | undefined;

  try {
    players = await syncPlayerPages(client, budget);
    playerStats = await syncFixturePlayerStats(client, budget);
  } catch (caught) {
    status = "partial";
    error = caught instanceof Error ? caught.message : "API-Football full sync stopped early.";
  }

  return {
    status,
    counts: {
      ...lite.counts,
      ...makeApiFootballCounts(budget),
      players,
      playerStats
    },
    error
  };

  async function syncPlayerPages(clientInstance: ApiFootballClient, activeBudget: RequestBudget) {
    let page = 1;
    let totalPages = 1;
    let count = 0;

    while (page <= totalPages && activeBudget.remaining > 0) {
      const response = await clientInstance.get<ApiFootballPlayer>("/players", { ...commonParams(), page }, activeBudget);
      totalPages = response.paging?.total ?? page;
      count += await upsertPlayers(supabase, mapApiFootballPlayers(response.response));
      page += 1;
    }

    return count;
  }

  async function syncFixturePlayerStats(clientInstance: ApiFootballClient, activeBudget: RequestBudget) {
    const fixtures = await clientInstance.get<ApiFootballFixture>("/fixtures", commonParams(), activeBudget);
    let count = 0;

    for (const fixture of fixtures.response) {
      if (activeBudget.remaining <= 0) break;
      if (!fixture.fixture.status || !["FT", "AET", "PEN"].includes(fixture.fixture.status.short)) continue;

      const response = await clientInstance.get<ApiFootballFixturePlayers>("/fixtures/players", { fixture: fixture.fixture.id }, activeBudget);
      count += await upsertPlayerMatchStats(supabase, mapApiFootballFixturePlayers(String(fixture.fixture.id), response.response));
    }

    return count;
  }
}

async function withSyncRun(
  source: string,
  mode: SyncMode,
  callback: () => Promise<{ status: SyncStatus; counts: SyncCounts; error?: string }>
): Promise<SyncResult> {
  const supabase = createSupabaseAdminClient();
  const started = await supabase.from("data_sync_runs").insert({ source, mode, status: "running" }).select("id").single();
  if (started.error) throw started.error;

  try {
    const result = await callback();
    await finishSyncRun(started.data.id, result.status, result.counts, result.error);
    return { source, mode, ...result };
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : "Unknown sync failure.";
    await finishSyncRun(started.data.id, "failed", {}, error);
    return { source, mode, status: "failed", counts: {}, error };
  }
}

async function finishSyncRun(id: string, status: SyncStatus, counts: SyncCounts, error?: string) {
  const supabase = createSupabaseAdminClient();
  const { error: updateError } = await supabase
    .from("data_sync_runs")
    .update({
      status,
      counts,
      error: error ?? null,
      finished_at: new Date().toISOString()
    })
    .eq("id", id);

  if (updateError) throw updateError;
}

async function getApiRequestsUsedToday() {
  const supabase = createSupabaseAdminClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("data_sync_runs")
    .select("counts")
    .eq("source", "api-football")
    .gte("started_at", startOfDay.toISOString());

  if (error) throw error;

  return (data ?? []).reduce((sum, row) => {
    const apiRequests = typeof row.counts === "object" && row.counts && !Array.isArray(row.counts) ? row.counts.apiRequests : 0;
    return sum + (typeof apiRequests === "number" ? apiRequests : 0);
  }, 0);
}

async function countActualNationalTeams() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("national_teams").select("name");
  if (error) throw error;

  return (data ?? []).filter((team) => !isPlaceholderTeamName(team.name)).length;
}

function commonParams() {
  return {
    league: env.apiFootballLeagueId,
    season: env.apiFootballSeason
  };
}

function isPlaceholderTeamName(name: string) {
  return /\b(winner|runner-up|runner up|third place|best third|play-?off|path|tbd|to be determined|placeholder)\b/i.test(name);
}

function expandMode(mode: SyncMode): SyncMode[] {
  if (mode === "all") {
    return ["baseline", "api-football-lite", "api-football-full", "results"];
  }

  return [mode];
}
