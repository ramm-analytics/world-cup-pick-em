import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Trophy } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { League, LeagueMember } from "@/types/database";

export default async function LeaguesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/leagues");
  }

  const membersResult = await supabase.from("league_members").select("*").eq("user_id", user.id).order("joined_at", { ascending: false });
  const members = (membersResult.data ?? []) as LeagueMember[];
  const leagueIds = members.map((member) => member.league_id);
  const leaguesResult = leagueIds.length ? await supabase.from("leagues").select("*").in("id", leagueIds) : { data: [] as League[] };
  const leagues = (leaguesResult.data ?? []) as League[];
  const membersByLeagueId = new Map(members.map((member) => [member.league_id, member]));

  return (
    <AppShell>
      <div className="container space-y-6 py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge>Leagues</Badge>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your Leagues</h1>
            <p className="mt-1 text-muted-foreground">Open a league landing page, review standings, or enter the draft room.</p>
          </div>
          <Button asChild>
            <Link href="/">
              <Trophy className="h-4 w-4" />
              Create or Join
            </Link>
          </Button>
        </div>

        {leagues.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {leagues.map((league) => {
              const member = membersByLeagueId.get(league.id);

              return (
                <Card key={league.id}>
                  <CardHeader className="space-y-4">
                    <div>
                      <CardTitle>{league.name}</CardTitle>
                      <CardDescription>
                        Invite {league.invite_code} · Draft position {member?.draft_position ?? "-"}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link href={`/leagues/${league.id}`}>League Page</Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/leagues/${league.id}/draft`}>
                          <CalendarDays className="h-4 w-4" />
                          Draft
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No leagues yet</CardTitle>
              <CardDescription>Create a league or join with an invite code from the home page.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
