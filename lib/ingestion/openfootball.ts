import { env } from "@/lib/env";
import type { MatchInput, TeamInput } from "@/lib/ingestion/types";

const SOURCE = "openfootball";
export const EXPECTED_WORLD_CUP_TEAM_COUNT = 48;
const OPENFOOTBALL_CUP_TXT_URL = "https://raw.githubusercontent.com/openfootball/worldcup/master/2026--usa/cup.txt";

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
  const parsed = parseOpenFootballBaseline(text);
  const hasGroups = parsed.teams.some((team) => team.groupName);

  if ((!hasGroups || parsed.teams.length !== EXPECTED_WORLD_CUP_TEAM_COUNT) && url !== OPENFOOTBALL_CUP_TXT_URL) {
    const fallbackResponse = await fetch(OPENFOOTBALL_CUP_TXT_URL, { cache: "no-store" });
    if (fallbackResponse.ok) {
      return parseOpenFootballBaseline(await fallbackResponse.text());
    }
  }

  return parsed;
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
      const teamName = normalizeTeamName(typeof rawTeam === "string" ? rawTeam : rawTeam.name);
      if (!teamName) continue;

      const fifaCode = typeof rawTeam === "string" ? makeCode(teamName) : normalizeFifaCode(rawTeam.code, teamName);
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
  let currentDate: string | null = null;

  for (const line of text.split(/\r?\n/)) {
    const clean = line.replace(/#.*/, "").trim();
    if (!clean) continue;

    const groupMatch = clean.match(/^Group\s+([A-Z0-9]+)\s*\|\s*(.+)$/i);
    if (groupMatch) {
      currentGroup = groupMatch[1].toUpperCase();
      for (const teamName of splitGroupTeams(groupMatch[2]).flatMap((item) => {
        const normalized = normalizeTeamName(item);
        return normalized ? [normalized] : [];
      })) {
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

    const groupHeader = clean.match(/^▪\s*Group\s+([A-Z0-9]+)$/i);
    if (groupHeader) {
      currentGroup = groupHeader[1].toUpperCase();
      continue;
    }

    const dateHeader = clean.match(/^(?:▪\s*)?([A-Z][a-z]{2}\s+[A-Z][a-z]+\s+\d{1,2})$/);
    if (dateHeader) {
      currentDate = dateHeader[1];
      continue;
    }

    const match = clean.match(/^(?:(.+?)\s+)?(\d{1,2}:\d{2})\s+UTC([+-]\d{1,2})\s+(.+?)\s+(?:v|vs\.?)\s+(.+?)(?:\s+@\s+(.+))?$/i);
    if (match) {
      const matchDate = normalizeMatchDate(match[1], currentDate);
      if (!matchDate) continue;

      const homeCode = ensureTeam(teams, match[4], currentGroup);
      const awayCode = ensureTeam(teams, match[5], currentGroup);
      if (!homeCode || !awayCode) continue;

      matches.push({
        externalSource: SOURCE,
        externalId: `${homeCode}-${awayCode}-${matches.length + 1}`,
        matchNumber: matches.length + 1,
        stage: "group",
        homeTeamFifaCode: homeCode,
        awayTeamFifaCode: awayCode,
        startsAt: toIsoDate(matchDate, match[2], match[3]),
        isFinal: false,
        status: "scheduled",
        venue: match[6] ?? null
      });
    }
  }

  return { teams: [...teams.values()], matches };
}

function mapOpenFootballMatch(match: Record<string, unknown>, index: number, teams: Map<string, TeamInput>): MatchInput[] {
  const team1 = getString(match.team1) ?? getString(match.home_team) ?? getString(match.home);
  const team2 = getString(match.team2) ?? getString(match.away_team) ?? getString(match.away);
  const date = getString(match.date) ?? getString(match.datetime) ?? getString(match.time);

  if (!team1 || !team2 || !date || isPlaceholderTeamName(team1) || isPlaceholderTeamName(team2)) {
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
  const normalizedName = normalizeTeamName(name);
  if (!normalizedName) {
    return null;
  }

  const fifaCode = makeCode(normalizedName);
  if (!teams.has(fifaCode)) {
    teams.set(fifaCode, {
      fifaCode,
      name: normalizedName,
      confederation: "TBD",
      groupName,
      flagEmoji: "",
      externalSource: SOURCE,
      externalId: fifaCode
    });
  }

  return fifaCode;
}

export function isPlaceholderTeamName(name: string) {
  return /\b(winner|runner-up|runner up|third place|best third|play-?off|path|tbd|to be determined|placeholder)\b/i.test(name)
    || /^\d[A-L](?:\/[A-L])*$/.test(name)
    || /^W\d+$/i.test(name);
}

function normalizeTeamName(name?: string | null) {
  if (!name || isPlaceholderTeamName(name)) {
    return null;
  }

  const trimmed = name.trim();
  const normalizedNames: Record<string, string> = {
    USA: "United States"
  };

  return normalizedNames[trimmed] ?? trimmed;
}

function normalizeFifaCode(code: string | undefined, name: string) {
  const cleanCode = code?.trim().toUpperCase();
  return cleanCode && !isPlaceholderTeamName(cleanCode) ? cleanCode : makeCode(name);
}

function splitGroupTeams(value: string) {
  const compactTeams = [
    "Bosnia & Herzegovina",
    "Cape Verde",
    "Czech Republic",
    "DR Congo",
    "Ivory Coast",
    "New Zealand",
    "Saudi Arabia",
    "South Africa",
    "South Korea"
  ];
  const protectedValue = compactTeams.reduce(
    (current, team) => current.replace(new RegExp(escapeRegExp(team), "g"), team.replace(/ /g, "_")),
    value
  );

  return protectedValue.split(/\s{1,}|\t+/).map((item) => item.replace(/_/g, " "));
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
  const knownCodes: Record<string, string> = {
    Algeria: "ALG",
    Argentina: "ARG",
    Australia: "AUS",
    Austria: "AUT",
    Belgium: "BEL",
    "Bosnia & Herzegovina": "BIH",
    Brazil: "BRA",
    Canada: "CAN",
    "Cape Verde": "CPV",
    Colombia: "COL",
    Croatia: "CRO",
    "Curaçao": "CUW",
    "Czech Republic": "CZE",
    "DR Congo": "COD",
    Ecuador: "ECU",
    Egypt: "EGY",
    England: "ENG",
    France: "FRA",
    Germany: "GER",
    Ghana: "GHA",
    Haiti: "HAI",
    Iran: "IRN",
    Iraq: "IRQ",
    "Ivory Coast": "CIV",
    Japan: "JPN",
    Jordan: "JOR",
    Mexico: "MEX",
    Morocco: "MAR",
    Netherlands: "NED",
    "New Zealand": "NZL",
    Norway: "NOR",
    Panama: "PAN",
    Paraguay: "PAR",
    Portugal: "POR",
    Qatar: "QAT",
    "Saudi Arabia": "KSA",
    Scotland: "SCO",
    Senegal: "SEN",
    "South Africa": "RSA",
    "South Korea": "KOR",
    Spain: "ESP",
    Sweden: "SWE",
    Switzerland: "SUI",
    Tunisia: "TUN",
    Turkey: "TUR",
    "United States": "USA",
    Uruguay: "URU",
    Uzbekistan: "UZB"
  };

  if (knownCodes[name]) {
    return knownCodes[name];
  }

  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, "X");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMatchDate(inlineDate: string | undefined, currentDate: string | null) {
  return inlineDate?.trim() || currentDate;
}

function toIsoDate(date: string, time: string, utcOffset: string) {
  const [, monthName, day] = date.match(/[A-Z][a-z]{2}\s+([A-Z][a-z]+)\s+(\d{1,2})/) ?? [];
  if (!monthName || !day) {
    return new Date(`${date} 2026 ${time} UTC${utcOffset}`).toISOString();
  }

  return new Date(`${monthName} ${day}, 2026 ${time}:00 GMT${utcOffset}`).toISOString();
}
