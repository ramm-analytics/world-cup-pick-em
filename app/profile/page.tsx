import Link from "next/link";
import { redirect } from "next/navigation";
import { AtSign, Shield, Trophy, User } from "lucide-react";
import { updateProfile } from "@/app/profile/actions";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DraftPick, League, LeagueMember, NationalTeam, Player, Profile } from "@/types/database";

type ProfileLeague = League & { member: LeagueMember; teams: NationalTeam[]; players: Player[] };

function uniqueValues<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const profileResult = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileResult.data as Profile | null;

  if (!profile) {
    redirect("/login?message=Profile not found. Try signing in again.");
  }

  const membersResult = await supabase.from("league_members").select("*").eq("user_id", user.id).order("joined_at", { ascending: false });
  const members = (membersResult.data ?? []) as LeagueMember[];
  const leagueIds = members.map((member) => member.league_id);
  const memberIds = members.map((member) => member.id);

  const [leaguesResult, picksResult] = leagueIds.length
    ? await Promise.all([
        supabase.from("leagues").select("*").in("id", leagueIds),
        memberIds.length
          ? supabase.from("draft_picks").select("*").in("league_member_id", memberIds).order("pick_number")
          : Promise.resolve({ data: [] as DraftPick[] })
    ])
    : [{ data: [] as League[] }, { data: [] as DraftPick[] }];

  const leagues = (leaguesResult.data ?? []) as League[];
  const picks = (picksResult.data ?? []) as DraftPick[];
  const teamIds = picks.flatMap((pick) => (pick.national_team_id ? [pick.national_team_id] : []));
  const playerIds = picks.flatMap((pick) => (pick.player_id ? [pick.player_id] : []));

  const [teamsResult, playersResult] = await Promise.all([
    teamIds.length ? supabase.from("national_teams").select("*").in("id", teamIds) : Promise.resolve({ data: [] as NationalTeam[] }),
    playerIds.length
      ? supabase.from("players").select("*, national_teams(name, flag_emoji, fifa_code)").in("id", playerIds)
      : Promise.resolve({ data: [] as Player[] })
  ]);

  const teams = (teamsResult.data ?? []) as NationalTeam[];
  const players = (playersResult.data ?? []) as Player[];
  const leaguesById = new Map(leagues.map((league) => [league.id, league]));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const playersById = new Map(players.map((player) => [player.id, player]));

  const profileLeagues: ProfileLeague[] = members.flatMap((member) => {
    const league = leaguesById.get(member.league_id);

    if (!league) {
      return [];
    }

    const memberPicks = picks.filter((pick) => pick.league_member_id === member.id);
    const rosterTeams = uniqueValues(memberPicks.flatMap((pick) => (pick.national_team_id ? [teamsById.get(pick.national_team_id)].filter(Boolean) : [])) as NationalTeam[]);
    const rosterPlayers = uniqueValues(memberPicks.flatMap((pick) => (pick.player_id ? [playersById.get(pick.player_id)].filter(Boolean) : [])) as Player[]);

    return [{ ...league, member, teams: rosterTeams, players: rosterPlayers }];
  });

  return (
    <AppShell>
      <div className="container space-y-6 py-6">
        <div>
          <Badge>Profile</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{profile.name}</h1>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Update the name and unique username shown on your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateProfile} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4" />
                    Name
                  </div>
                  <Input name="name" defaultValue={profile.name} required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AtSign className="h-4 w-4" />
                    Username
                  </div>
                  <Input name="username" defaultValue={profile.username ?? ""} required />
                </div>
                <Button className="w-full">Save Profile</Button>
              </form>
              {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
            </CardContent>
          </Card>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Current Leagues</h2>
                <p className="text-sm text-muted-foreground">Your leagues and drafted roster picks.</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/">Create or Join</Link>
              </Button>
            </div>

            {profileLeagues.length ? (
              <div className="grid gap-4">
                {profileLeagues.map((league) => (
                  <Card key={league.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                      <div>
                        <CardTitle>{league.name}</CardTitle>
                        <CardDescription>
                          Manager name: {league.member.display_name} · Invite {league.invite_code}
                        </CardDescription>
                      </div>
                      <Button asChild size="sm">
                        <Link href={`/leagues/${league.id}`}>Open</Link>
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <Shield className="h-4 w-4" />
                          Teams
                        </div>
                        {league.teams.length ? (
                          <div className="flex flex-wrap gap-2">
                            {league.teams.map((team) => (
                              <Badge key={team.id}>
                                {team.flag_emoji} {team.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No teams drafted yet.</p>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                          <Trophy className="h-4 w-4" />
                          Players
                        </div>
                        {league.players.length ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {league.players.map((player) => (
                              <div key={player.id} className="rounded-md border bg-background p-3 text-sm">
                                <div className="font-medium">{player.name}</div>
                                <div className="text-muted-foreground">
                                  {player.position} · {player.national_teams?.fifa_code ?? "TBD"} · {player.club ?? "Club TBD"}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No players drafted yet.</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No leagues yet</CardTitle>
                  <CardDescription>Create or join a league to see your teams and players here.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
