export type SyncMode = "baseline" | "api-football-lite" | "api-football-full" | "results" | "all";

export type SyncStatus = "running" | "success" | "partial" | "skipped" | "failed";

export type SyncCounts = {
  apiRequests?: number;
  teams?: number;
  actualTeams?: number;
  expectedTeams?: number;
  removedPlaceholderTeams?: number;
  removedPlaceholderMatches?: number;
  removedStaleTeams?: number;
  removedStaleMatches?: number;
  players?: number;
  matches?: number;
  playerStats?: number;
  skipped?: number;
};

export type SyncResult = {
  source: string;
  mode: SyncMode;
  status: SyncStatus;
  counts: SyncCounts;
  error?: string;
};

export type TeamInput = {
  fifaCode: string;
  name: string;
  confederation: string;
  groupName?: string | null;
  flagEmoji?: string;
  externalSource: string;
  externalId: string;
  logoUrl?: string | null;
};

export type PlayerInput = {
  teamExternalSource?: string;
  teamExternalId?: string;
  teamFifaCode?: string;
  name: string;
  position: string;
  club?: string | null;
  projectedPoints?: number;
  externalSource: string;
  externalId?: string | null;
  photoUrl?: string | null;
};

export type MatchInput = {
  externalSource: string;
  externalId: string;
  matchNumber?: number | null;
  stage: "group" | "round_of_32" | "round_of_16" | "quarterfinal" | "semifinal" | "third_place" | "final";
  homeTeamExternalId?: string | null;
  awayTeamExternalId?: string | null;
  homeTeamFifaCode?: string | null;
  awayTeamFifaCode?: string | null;
  startsAt: string;
  homeScore?: number | null;
  awayScore?: number | null;
  isFinal?: boolean;
  status?: string | null;
  venue?: string | null;
};

export type PlayerMatchStatInput = {
  externalSource: string;
  externalId: string;
  matchExternalId: string;
  playerExternalId: string;
  goals?: number;
  assists?: number;
  cleanSheet?: boolean;
  minutes?: number;
};
