import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DraftPick, LeagueMember, NationalTeam, Player } from "@/types/database";

interface RosterBoardProps {
  members: LeagueMember[];
  picks: DraftPick[];
  teams: NationalTeam[];
  players: Player[];
}

export function RosterBoard({ members, picks, teams, players }: RosterBoardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {members.map((member) => {
        const memberPicks = picks.filter((pick) => pick.league_member_id === member.id);

        return (
          <Card key={member.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {member.display_name}
                <Badge>#{member.draft_position ?? "-"}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {memberPicks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No picks yet.</p>
              ) : (
                memberPicks.map((pick) => {
                  const team = teams.find((item) => item.id === pick.national_team_id);
                  const player = players.find((item) => item.id === pick.player_id);
                  return (
                    <div key={pick.id} className="rounded-md border p-3">
                      <div className="text-xs text-muted-foreground">Pick {pick.pick_number}</div>
                      <div className="font-medium">{team?.name ?? player?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {team ? "National team" : `${player?.position ?? "Player"} - ${player?.national_teams?.fifa_code ?? ""}`}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
