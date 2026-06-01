import type { DraftableType, League } from "@/types/database";

export function allowedDraftableTypes(league: Pick<League, "scoring_mode">): DraftableType[] {
  if (league.scoring_mode === "team_pickem") return ["team"];
  if (league.scoring_mode === "player_pickem") return ["player"];
  return ["team", "player"];
}

export function isDraftableTypeAllowed(league: Pick<League, "scoring_mode">, type: DraftableType) {
  return allowedDraftableTypes(league).includes(type);
}

export function draftRoundCountForLeague(league: Pick<League, "scoring_mode" | "roster_team_slots" | "roster_player_slots">) {
  if (league.scoring_mode === "team_pickem") return league.roster_team_slots;
  if (league.scoring_mode === "player_pickem") return league.roster_player_slots;
  return league.roster_team_slots + league.roster_player_slots;
}
