"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Activity, Check, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { makeDraftPick } from "@/lib/api";
import { buildSnakeDraftOrder, getCurrentTurn } from "@/lib/draft/order";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Draft, DraftPick, League, LeagueMember, NationalTeam, Player } from "@/types/database";

interface DraftRoomProps {
  league: League;
  members: LeagueMember[];
  draft: Draft;
  picks: DraftPick[];
  teams: NationalTeam[];
  players: Player[];
  isDemo?: boolean;
}

export function DraftRoom({ league, members, draft, picks, teams, players, isDemo = false }: DraftRoomProps) {
  const [liveDraft, setLiveDraft] = useState(draft);
  const [livePicks, setLivePicks] = useState(picks);
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isDemo) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`draft:${draft.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks", filter: `draft_id=eq.${draft.id}` }, () => {
        window.location.reload();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drafts", filter: `id=eq.${draft.id}` }, (payload) => {
        setLiveDraft(payload.new as Draft);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draft.id, isDemo]);

  const draftedTeamIds = new Set(livePicks.map((pick) => pick.national_team_id).filter(Boolean));
  const draftedPlayerIds = new Set(livePicks.map((pick) => pick.player_id).filter(Boolean));
  const currentTurn = getCurrentTurn(members, liveDraft.round_count, liveDraft.current_pick_number);
  const order = buildSnakeDraftOrder(members, liveDraft.round_count).slice(0, members.length * 2);
  const normalizedFilter = filter.toLowerCase();

  const availableTeams = useMemo(
    () => teams.filter((team) => !draftedTeamIds.has(team.id) && team.name.toLowerCase().includes(normalizedFilter)),
    [draftedTeamIds, normalizedFilter, teams]
  );
  const availablePlayers = useMemo(
    () => players.filter((player) => !draftedPlayerIds.has(player.id) && player.name.toLowerCase().includes(normalizedFilter)),
    [draftedPlayerIds, normalizedFilter, players]
  );

  function submitPick(input: { draftableType: "team" | "player"; nationalTeamId?: string; playerId?: string }) {
    if (!currentTurn) return;

    if (isDemo) {
      const nextPick: DraftPick = {
        id: crypto.randomUUID(),
        draft_id: liveDraft.id,
        league_member_id: currentTurn.member.id,
        pick_number: liveDraft.current_pick_number,
        round_number: currentTurn.roundNumber,
        draftable_type: input.draftableType,
        national_team_id: input.nationalTeamId ?? null,
        player_id: input.playerId ?? null,
        picked_at: new Date().toISOString()
      };
      setLivePicks((existing) => [...existing, nextPick]);
      setLiveDraft((existing) => ({ ...existing, current_pick_number: existing.current_pick_number + 1 }));
      return;
    }

    startTransition(async () => {
      await makeDraftPick({
        draftId: liveDraft.id,
        leagueMemberId: currentTurn.member.id,
        draftableType: input.draftableType,
        nationalTeamId: input.nationalTeamId,
        playerId: input.playerId
      });
    });
  }

  return (
    <div className="container py-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground">{liveDraft.status}</Badge>
            {isDemo ? <Badge>Demo mode</Badge> : <Badge>Live realtime</Badge>}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{league.name} Draft</h1>
          <p className="text-muted-foreground">Snake order rotates each round. Drafted teams and players lock immediately.</p>
        </div>
        <Card className="w-full md:w-72">
          <CardHeader className="pb-2">
            <CardDescription>On the clock</CardDescription>
            <CardTitle>{currentTurn?.member.display_name ?? "Draft complete"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Pick {liveDraft.current_pick_number} of {members.length * liveDraft.round_count}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Next Turns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.slice(Math.max(0, liveDraft.current_pick_number - 1), liveDraft.current_pick_number + 7).map((turn) => (
                <div key={turn.pickNumber} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span>{turn.member.display_name}</span>
                  <span className="text-muted-foreground">R{turn.roundNumber} P{turn.pickNumber}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <section className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search draft pool" value={filter} onChange={(event) => setFilter(event.target.value)} />
          </div>

          <div className="grid draft-grid gap-4">
            {availableTeams.map((team) => (
              <Card key={team.id}>
                <CardHeader>
                  <CardDescription>{team.confederation} - Group {team.group_name ?? "TBD"}</CardDescription>
                  <CardTitle>{team.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled={isPending || !currentTurn} onClick={() => submitPick({ draftableType: "team", nationalTeamId: team.id })}>
                    <Check className="h-4 w-4" />
                    Draft Team
                  </Button>
                </CardContent>
              </Card>
            ))}

            {availablePlayers.map((player) => (
              <Card key={player.id}>
                <CardHeader>
                  <CardDescription>{player.position} - {player.national_teams?.fifa_code ?? "TBD"} - {player.club ?? "Club TBD"}</CardDescription>
                  <CardTitle>{player.name}</CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">{player.projected_points} projected pts</div>
                  <Button disabled={isPending || !currentTurn} onClick={() => submitPick({ draftableType: "player", playerId: player.id })}>
                    Draft
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
