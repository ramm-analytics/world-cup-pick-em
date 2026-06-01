import type {
  ApiFootballFixture,
  ApiFootballFixturePlayers,
  ApiFootballPlayer,
  ApiFootballStanding,
  ApiFootballTeam
} from "@/lib/ingestion/api-football-client";
import type { MatchInput, PlayerInput, PlayerMatchStatInput, TeamInput } from "@/lib/ingestion/types";

const SOURCE = "api-football";

export function mapApiFootballTeams(teams: ApiFootballTeam[], standings: ApiFootballStanding[] = []): TeamInput[] {
  const groupByTeamId = new Map<number, string>();
  const standingGroups = standings.flatMap((standing) => standing.league.standings ?? []);

  for (const group of standingGroups) {
    for (const row of group) {
      groupByTeamId.set(row.team.id, normalizeGroupName(row.group));
    }
  }

  return teams.map(({ team }) => ({
    fifaCode: team.code ?? String(team.id),
    name: team.name,
    confederation: "TBD",
    groupName: groupByTeamId.get(team.id) ?? null,
    flagEmoji: "",
    externalSource: SOURCE,
    externalId: String(team.id),
    logoUrl: team.logo
  }));
}

export function mapApiFootballFixtures(fixtures: ApiFootballFixture[]): MatchInput[] {
  return fixtures
    .filter((item) => item.teams.home.id && item.teams.away.id)
    .map((item, index) => ({
      externalSource: SOURCE,
      externalId: String(item.fixture.id),
      matchNumber: index + 1,
      stage: stageFromRound(item.league?.round),
      homeTeamExternalId: item.teams.home.id ? String(item.teams.home.id) : null,
      awayTeamExternalId: item.teams.away.id ? String(item.teams.away.id) : null,
      winnerTeamExternalId: winnerTeamExternalId(item),
      startsAt: item.fixture.date,
      homeScore: item.goals.home,
      awayScore: item.goals.away,
      isFinal: isFinalStatus(item.fixture.status.short),
      status: item.fixture.status.short,
      venue: [item.fixture.venue?.name, item.fixture.venue?.city].filter(Boolean).join(", ") || null
    }));
}

function winnerTeamExternalId(item: ApiFootballFixture) {
  if (item.teams.home.winner === true && item.teams.home.id) return String(item.teams.home.id);
  if (item.teams.away.winner === true && item.teams.away.id) return String(item.teams.away.id);
  return null;
}

export function mapApiFootballPlayers(players: ApiFootballPlayer[]): PlayerInput[] {
  return players.flatMap((item) => {
    const teamStat = item.statistics.find((stat) => stat.team?.id);
    if (!teamStat?.team?.id) {
      return [];
    }

    return [{
      teamExternalSource: SOURCE,
      teamExternalId: String(teamStat.team.id),
      name: item.player.name,
      position: normalizePosition(teamStat.games?.position),
      club: null,
      projectedPoints: 0,
      externalSource: SOURCE,
      externalId: String(item.player.id),
      photoUrl: item.player.photo ?? null
    }];
  });
}

export function mapApiFootballFixturePlayers(matchExternalId: string, fixturePlayers: ApiFootballFixturePlayers[]): PlayerMatchStatInput[] {
  return fixturePlayers.flatMap((team) =>
    team.players.map((player) => {
      const stat = player.statistics[0] ?? {};
      const goals = stat.goals?.total ?? 0;
      const assists = stat.goals?.assists ?? 0;
      const minutes = stat.games?.minutes ?? 0;
      const position = normalizePosition(stat.games?.position);

      return {
        externalSource: SOURCE,
        externalId: `${matchExternalId}:${player.player.id}`,
        matchExternalId,
        playerExternalId: String(player.player.id),
        goals,
        assists,
        minutes,
        cleanSheet: minutes > 0 && (position === "GK" || position === "DF") && (stat.goals?.conceded ?? 0) === 0
      };
    })
  );
}

function normalizeGroupName(group: string) {
  return group.replace(/^Group\s+/i, "").trim() || group;
}

function isFinalStatus(status: string) {
  return ["FT", "AET", "PEN"].includes(status);
}

function normalizePosition(position?: string | null) {
  const value = (position ?? "").toLowerCase();
  if (value.includes("goalkeeper")) return "GK";
  if (value.includes("defender")) return "DF";
  if (value.includes("midfielder")) return "MF";
  if (value.includes("attacker") || value.includes("forward")) return "FW";
  return position?.slice(0, 2).toUpperCase() || "TBD";
}

function stageFromRound(round?: string) {
  const value = (round ?? "").toLowerCase();
  if (value.includes("round of 32")) return "round_of_32";
  if (value.includes("round of 16")) return "round_of_16";
  if (value.includes("quarter")) return "quarterfinal";
  if (value.includes("semi")) return "semifinal";
  if (value.includes("third")) return "third_place";
  if (value.includes("final")) return "final";
  return "group";
}
