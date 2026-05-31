import { env } from "@/lib/env";
import type { MatchInput, TeamInput } from "@/lib/ingestion/types";

const SOURCE = "openfootball";

type OpenFootballJson = {
  name?: string;
  groups?: Array<{
    name?: string;
    teams?: Array<string | { name?: string; code?: string }>;
  }>;
  matches?: Array<Record<string, unknown>>;
  rounds?: Array<{
    name?: string;
    matches?: Array<Record<string, unknown>>;
  }>;
};

export async function fetchOpenFootballBaseline(url = env.openFootballWorldCupUrl) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`openfootball baseline fetch failed with ${response.status}.`);
  }

  const text = await response.text();
  return parseOpenFootballBaseline(text);
}

export function parseOpenFootballBaseline(text: string): { teams: TeamInput[]; matches: MatchInput[] } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { teams: [], matches: [] };
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseOpenFootballJson(JSON.parse(trimmed) as OpenFootballJson);
  }

  return parseFootballTxt(trimmed);
}

function parseOpenFootballJson(data: OpenFootballJson) {
  const teams = new Map<string, TeamInput>();

  for (const group of data.groups ?? []) {
    const groupName = normalizeGroup(group.name);
    for (const rawTeam of group.teams ?? []) {
      const teamName = typeof rawTeam === "string" ? rawTeam : rawTeam.name;
      if (!teamName) continue;

      const fifaCode = typeof rawTeam === "string" ? makeCode(teamName) : rawTeam.code ?? makeCode(teamName);
      teams.set(fifaCode, {
        fifaCode,
        name: teamName,
        confederation: "TBD",
        groupName,
        flagEmoji: "",
        externalSource: SOURCE,
        externalId: fifaCode
      });
    }
  }

  const allMatches = [...(data.matches ?? []), ...(data.rounds ?? []).flatMap((round) => round.matches ?? [])];
  const matches = allMatches.flatMap((match, index) => mapOpenFootballMatch(match, index, teams));

  return { teams: [...teams.values()], matches };
}

function parseFootballTxt(text: string) {
  const teams = new Map<string, TeamInput>();
  const matches: MatchInput[] = [];
  let currentGroup: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    if (!clean) continue;

    const groupMatch = clean.match(/^Group\s+([A-Z0-9]+)\s*\|\s*(.+)$/i);
    if (groupMatch) {
      currentGroup = groupMatch[1].toUpperCase();
      for (const teamName of groupMatch[2].split(/\s{2,}|\t+/).map((item) => item.trim()).filter(Boolean)) {
        const fifaCode = makeCode(teamName);
        teams.set(fifaCode, {
          fifaCode,
          name: teamName,
          confederation: "TBD",
          groupName: currentGroup,
          flagEmoji: "",
          externalSource: SOURCE,
          externalId: fifaCode
        });
      }
      continue;
    }

    const match = clean.match(/^\[(.+?)\]\s+(.+?)\s+(?:v|vs\.?)\s+(.+?)(?:\s+@\s+(.+))?$/i);
    if (match) {
      const homeCode = ensureTeam(teams, match[2], currentGroup);
      const awayCode = ensureTeam(teams, match[3], currentGroup);
      matches.push({
        externalSource: SOURCE,
        externalId: `${homeCode}-${awayCode}-${matches.length + 1}`,
        matchNumber: matches.length + 1,
        stage: "group",
        homeTeamFifaCode: homeCode,
        awayTeamFifaCode: awayCode,
        startsAt: new Date(match[1]).toISOString(),
        isFinal: false,
        status: "scheduled",
        venue: match[4] ?? null
      });
    }
  }

  return { teams: [...teams.values()], matches };
}

function mapOpenFootballMatch(match: Record<string, unknown>, index: number, teams: Map<string, TeamInput>): MatchInput[] {
  const team1 = getString(match.team1) ?? getString(match.home_team) ?? getString(match.home);
  const team2 = getString(match.team2) ?? getString(match.away_team) ?? getString(match.away);
  const date = getString(match.date) ?? getString(match.datetime) ?? getString(match.time);

  if (!team1 || !team2 || !date) {
    return [];
  }

  const homeCode = ensureTeam(teams, team1, null);
  const awayCode = ensureTeam(teams, team2, null);
  const score1 = getNumber(match.score1) ?? getNumber(match.home_score);
  const score2 = getNumber(match.score2) ?? getNumber(match.away_score);

  return [{
    externalSource: SOURCE,
    externalId: getString(match.id) ?? `${homeCode}-${awayCode}-${index + 1}`,
    matchNumber: getNumber(match.num) ?? getNumber(match.match_number) ?? index + 1,
    stage: "group",
    homeTeamFifaCode: homeCode,
    awayTeamFifaCode: awayCode,
    startsAt: new Date(date).toISOString(),
    homeScore: score1,
    awayScore: score2,
    isFinal: score1 !== null && score1 !== undefined && score2 !== null && score2 !== undefined,
    status: score1 !== null && score1 !== undefined ? "final" : "scheduled",
    venue: getString(match.stadium) ?? getString(match.venue) ?? null
  }];
}

function ensureTeam(teams: Map<string, TeamInput>, name: string, groupName: string | null) {
  const fifaCode = makeCode(name);
  if (!teams.has(fifaCode)) {
    teams.set(fifaCode, {
      fifaCode,
      name,
      confederation: "TBD",
      groupName,
      flagEmoji: "",
      externalSource: SOURCE,
      externalId: fifaCode
    });
  }

  return fifaCode;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function normalizeGroup(value?: string) {
  return value?.replace(/^Group\s+/i, "").trim() ?? null;
}

function makeCode(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
}
