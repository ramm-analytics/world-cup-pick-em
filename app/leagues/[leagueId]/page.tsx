import Link from "next/link";
import { Clipboard, Timer } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RosterBoard } from "@/components/league/roster-board";
import { StandingsTable } from "@/components/league/standings-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLeagueDashboard } from "@/lib/queries";

export default async function LeaguePage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const { league, members, standings, picks, teams, players, isDemo } = await getLeagueDashboard(leagueId);

  if (!league) {
    return <AppShell><div className="container py-10">League not found.</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="container space-y-6 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <Badge>{isDemo ? "Demo data" : "Supabase"}</Badge>
              <Badge className="bg-primary text-primary-foreground">Invite {league.invite_code}</Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">{league.name}</h1>
            <p className="text-muted-foreground">{members.length} managers - {league.roster_team_slots} teams and {league.roster_player_slots} players per roster</p>
          </div>
          <Button asChild>
            <Link href={`/leagues/${league.id}/draft`}>
              <Timer className="h-4 w-4" />
              Open Draft
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Members</CardDescription>
              <CardTitle>{members.length}/{league.max_members}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Scoring</CardDescription>
              <CardTitle>Auto-calculated</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Invite Code</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Clipboard className="h-5 w-5" />
                {league.invite_code}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Standings</CardTitle>
            <CardDescription>Backed by the league_standings database view.</CardDescription>
          </CardHeader>
          <CardContent>
            <StandingsTable standings={standings} />
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-3 text-xl font-semibold">Rosters</h2>
          <RosterBoard members={members} picks={picks} teams={teams} players={players} />
        </section>
      </div>
    </AppShell>
  );
}
