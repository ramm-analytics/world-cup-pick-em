"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recalculateLeagueScores } from "@/lib/scoring/engine";
import { scoringSettingsSchema, settingsToRules } from "@/lib/scoring/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function saveScoringSettings(leagueId: string, formData: FormData) {
  const payload = scoringSettingsSchema.safeParse({
    scoringMode: formData.get("scoringMode"),
    teamWin: formData.get("teamWin"),
    teamDraw: formData.get("teamDraw"),
    teamPkLoss: formData.get("teamPkLoss"),
    teamLoss: formData.get("teamLoss"),
    roundBonusRoundOf32: formData.get("roundBonusRoundOf32"),
    roundBonusRoundOf16: formData.get("roundBonusRoundOf16"),
    roundBonusQuarterfinal: formData.get("roundBonusQuarterfinal"),
    roundBonusSemifinal: formData.get("roundBonusSemifinal"),
    roundBonusFinal: formData.get("roundBonusFinal"),
    roundBonusChampion: formData.get("roundBonusChampion")
  });

  if (!payload.success) {
    redirect(`/leagues/${leagueId}/settings?message=${encodeURIComponent("Invalid scoring settings.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const updated = await supabase
    .from("leagues")
    .update({
      scoring_mode: payload.data.scoringMode,
      scoring_rules: settingsToRules(payload.data)
    })
    .eq("id", leagueId);

  if (updated.error) {
    redirect(`/leagues/${leagueId}/settings?message=${encodeURIComponent(updated.error.message)}`);
  }

  await recalculateLeagueScores(leagueId);
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/settings`);
  redirect(`/leagues/${leagueId}/settings?message=${encodeURIComponent("Scoring settings saved and scores recalculated.")}`);
}

export async function recalculateScoresAction(leagueId: string) {
  await recalculateLeagueScores(leagueId);
  revalidatePath(`/leagues/${leagueId}`);
  revalidatePath(`/leagues/${leagueId}/settings`);
  redirect(`/leagues/${leagueId}/settings?message=${encodeURIComponent("Scores recalculated.")}`);
}
