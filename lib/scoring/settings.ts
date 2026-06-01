import { z } from "zod";
import type { Json, LeagueScoringMode } from "@/types/database";

export const defaultScoringRules = {
  team_win: 3,
  team_draw: 1,
  team_pk_loss: 1,
  team_loss: 0,
  round_bonus_round_of_32: 1,
  round_bonus_round_of_16: 2,
  round_bonus_quarterfinal: 3,
  round_bonus_semifinal: 5,
  round_bonus_final: 8,
  round_bonus_champion: 13,
  player_goal: 4,
  player_assist: 3,
  clean_sheet: 2
};

export const scoringModeSchema = z.enum(["team_pickem", "player_pickem", "combo"]);

export const scoringSettingsSchema = z.object({
  scoringMode: scoringModeSchema,
  teamWin: z.coerce.number().min(-100).max(100),
  teamDraw: z.coerce.number().min(-100).max(100),
  teamPkLoss: z.coerce.number().min(-100).max(100),
  teamLoss: z.coerce.number().min(-100).max(100),
  roundBonusRoundOf32: z.coerce.number().min(-100).max(100),
  roundBonusRoundOf16: z.coerce.number().min(-100).max(100),
  roundBonusQuarterfinal: z.coerce.number().min(-100).max(100),
  roundBonusSemifinal: z.coerce.number().min(-100).max(100),
  roundBonusFinal: z.coerce.number().min(-100).max(100),
  roundBonusChampion: z.coerce.number().min(-100).max(100)
});

export type TeamScoringRules = typeof defaultScoringRules;

export function normalizeScoringRules(rules: Json): TeamScoringRules {
  const input = typeof rules === "object" && rules && !Array.isArray(rules) ? rules : {};

  return {
    ...defaultScoringRules,
    ...Object.fromEntries(
      Object.keys(defaultScoringRules).map((key) => {
        const value = input[key];
        return [key, typeof value === "number" ? value : defaultScoringRules[key as keyof typeof defaultScoringRules]];
      })
    )
  };
}

export function settingsToRules(settings: z.infer<typeof scoringSettingsSchema>) {
  return {
    ...defaultScoringRules,
    team_win: settings.teamWin,
    team_draw: settings.teamDraw,
    team_pk_loss: settings.teamPkLoss,
    team_loss: settings.teamLoss,
    round_bonus_round_of_32: settings.roundBonusRoundOf32,
    round_bonus_round_of_16: settings.roundBonusRoundOf16,
    round_bonus_quarterfinal: settings.roundBonusQuarterfinal,
    round_bonus_semifinal: settings.roundBonusSemifinal,
    round_bonus_final: settings.roundBonusFinal,
    round_bonus_champion: settings.roundBonusChampion
  };
}

export function modeLabel(mode: LeagueScoringMode) {
  if (mode === "team_pickem") return "Team Pick'em";
  if (mode === "player_pickem") return "Player Pick'em";
  return "Combo";
}
