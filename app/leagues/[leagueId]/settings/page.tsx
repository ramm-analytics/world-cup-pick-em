import Link from "next/link";
import { ArrowLeft, Calculator, Save } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { modeLabel, normalizeScoringRules } from "@/lib/scoring/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recalculateScoresAction, saveScoringSettings } from "./actions";
import type { LeagueScoringMode } from "@/types/database";

export default async function LeagueScoringSettingsPage({
  params,
  searchParams
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { leagueId } = await params;
  const { message } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const leagueResult = await supabase.from("leagues").select("*").eq("id", leagueId).single();
  const latestRun = await supabase
    .from("league_score_runs")
    .select("*")
    .eq("league_id", leagueId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!leagueResult.data) {
    return <AppShell><div className="container py-10">League not found.</div></AppShell>;
  }

  const league = leagueResult.data;
  const rules = normalizeScoringRules(league.scoring_rules);
  const saveAction = saveScoringSettings.bind(null, league.id);
  const recalculateAction = recalculateScoresAction.bind(null, league.id);

  return (
    <AppShell>
      <div className="container max-w-5xl space-y-6 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2">
              <Link href={`/leagues/${league.id}`}>
                <ArrowLeft className="h-4 w-4" />
                League
              </Link>
            </Button>
            <h1 className="text-3xl font-semibold tracking-tight">Scoring Settings</h1>
            <p className="text-muted-foreground">{league.name} - {modeLabel(league.scoring_mode)}</p>
          </div>

          <form action={recalculateAction}>
            <Button type="submit" variant="secondary">
              <Calculator className="h-4 w-4" />
              Recalculate
            </Button>
          </form>
        </div>

        {message ? (
          <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {message}
          </div>
        ) : null}

        <form action={saveAction} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>League Mode</CardTitle>
              <CardDescription>Controls which drafted assets are scored.</CardDescription>
            </CardHeader>
            <CardContent>
              <select
                name="scoringMode"
                defaultValue={league.scoring_mode}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {(["team_pickem", "player_pickem", "combo"] as LeagueScoringMode[]).map((mode) => (
                  <option key={mode} value={mode}>{modeLabel(mode)}</option>
                ))}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Team Scoring</CardTitle>
              <CardDescription>Used by Team Pick'em and Combo leagues.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField name="teamWin" label="Win" value={rules.team_win} />
              <NumberField name="teamDraw" label="Draw" value={rules.team_draw} />
              <NumberField name="teamPkLoss" label="PK Loss" value={rules.team_pk_loss} />
              <NumberField name="teamLoss" label="Loss" value={rules.team_loss} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Round Bonuses</CardTitle>
              <CardDescription>Awarded when a drafted team advances from a knockout match.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField name="roundBonusRoundOf32" label="Round of 32" value={rules.round_bonus_round_of_32} />
              <NumberField name="roundBonusRoundOf16" label="Round of 16" value={rules.round_bonus_round_of_16} />
              <NumberField name="roundBonusQuarterfinal" label="Quarterfinal" value={rules.round_bonus_quarterfinal} />
              <NumberField name="roundBonusSemifinal" label="Semifinal" value={rules.round_bonus_semifinal} />
              <NumberField name="roundBonusFinal" label="Final" value={rules.round_bonus_final} />
              <NumberField name="roundBonusChampion" label="Champion" value={rules.round_bonus_champion} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Player Scoring</CardTitle>
              <CardDescription>Stored for future Player Pick'em and Combo scoring expansion.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <ReadOnlyField label="Goal" value={rules.player_goal} />
              <ReadOnlyField label="Assist" value={rules.player_assist} />
              <ReadOnlyField label="Clean Sheet" value={rules.clean_sheet} />
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit">
              <Save className="h-4 w-4" />
              Save Settings
            </Button>
          </div>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Latest Recalculation</CardTitle>
            <CardDescription>Scores are rebuilt from source data each time.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {latestRun.data ? (
              <p>
                {latestRun.data.status} - started {new Date(latestRun.data.started_at).toLocaleString()}
                {latestRun.data.error ? ` - ${latestRun.data.error}` : ""}
              </p>
            ) : (
              <p>No scoring run has been recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function NumberField({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Input name={name} type="number" step="0.5" defaultValue={value} />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
