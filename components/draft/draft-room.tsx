"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Activity, Check, Clock, Pause, Search, Shield, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { makeDraftPick, pauseDraft, startDraft } from "@/lib/api";
import { buildSnakeDraftOrder, getCurrentTurn } from "@/lib/draft/order";
import { allowedDraftableTypes } from "@/lib/draft/rules";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Draft, DraftPick, League, LeagueMember, NationalTeam, Player } from "@/types/database";

interface DraftRoomProps {
  league: League;
  members: LeagueMember[];
  draft: Draft;
  picks: DraftPick[];
  teams: NationalTeam[];
  players: Player[];
  currentUserId: string | null;
  isDemo?: boolean;
}

type PoolMode = "players" | "teams";

function formatClock(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export function DraftRoom({ league, members, draft, picks, teams, players, currentUserId, isDemo = false }: DraftRoomProps) {
  const [liveDraft, setLiveDraft] = useState(draft);
  const [livePicks, setLivePicks] = useState(picks);
  const [syncStatus, setSyncStatus] = useState<"connecting" | "live" | "polling">("connecting");
  const [filter, setFilter] = useState("");
  const allowedPoolModes = useMemo(() => allowedDraftableTypes(league).map((type) => (type === "team" ? "teams" : "players") as PoolMode), [league]);
  const [poolMode, setPoolMode] = useState<PoolMode>(allowedPoolModes[0] ?? "teams");
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const syncDraftState = useCallback(async () => {
    if (isDemo) return;

    const supabase = createSupabaseBrowserClient();
    const draftResult = await supabase.from("drafts").select("*").eq("id", draft.id).single() as unknown as { data: Draft | null };
    const picksResult = await supabase.from("draft_picks").select("*").eq("draft_id", draft.id).order("pick_number") as unknown as { data: DraftPick[] | null };

    if (draftResult.data) {
      setLiveDraft(draftResult.data);
    }

    if (picksResult.data) {
      setLivePicks(picksResult.data);
    }
  }, [draft.id, isDemo]);

  useEffect(() => {
    if (isDemo) return;

    const supabase = createSupabaseBrowserClient();
    const mergePick = (nextPick: DraftPick) => {
      setLivePicks((existing) => {
        const withoutDuplicate = existing.filter((pick) => pick.id !== nextPick.id);
        return [...withoutDuplicate, nextPick].sort((a, b) => a.pick_number - b.pick_number);
      });
    };

    const channel = supabase
      .channel(`draft:${draft.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "draft_picks", filter: `draft_id=eq.${draft.id}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          setLivePicks((existing) => existing.filter((pick) => pick.id !== (payload.old as Partial<DraftPick>).id));
          void syncDraftState();
          return;
        }

        mergePick(payload.new as DraftPick);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "drafts", filter: `id=eq.${draft.id}` }, (payload) => {
        if (payload.eventType === "DELETE") return;
        setLiveDraft(payload.new as Draft);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setSyncStatus("live");
          void syncDraftState();
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setSyncStatus("polling");
        }
      });

    void syncDraftState();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [draft.id, isDemo, syncDraftState]);

  useEffect(() => {
    if (isDemo || liveDraft.status === "complete") return;

    const interval = window.setInterval(() => {
      void syncDraftState();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isDemo, liveDraft.status, syncDraftState]);

  useEffect(() => {
    if (!allowedPoolModes.includes(poolMode)) {
      setPoolMode(allowedPoolModes[0] ?? "teams");
    }
  }, [allowedPoolModes, poolMode]);

  const draftedTeamIds = useMemo(() => new Set(livePicks.map((pick) => pick.national_team_id).filter(Boolean)), [livePicks]);
  const draftedPlayerIds = useMemo(() => new Set(livePicks.map((pick) => pick.player_id).filter(Boolean)), [livePicks]);
  const currentTurn = getCurrentTurn(members, liveDraft.round_count, liveDraft.current_pick_number);
  const totalPicks = members.length * liveDraft.round_count;
  const completedPicks = Math.min(livePicks.length, totalPicks);
  const progressPercent = totalPicks ? Math.round((completedPicks / totalPicks) * 100) : 0;
  const order = buildSnakeDraftOrder(members, liveDraft.round_count);
  const upcomingTurns = order.slice(Math.max(0, liveDraft.current_pick_number - 1), liveDraft.current_pick_number + 7);
  const normalizedFilter = filter.toLowerCase();
  const pickStartedAt = liveDraft.updated_at ?? liveDraft.started_at ?? new Date().toISOString();
  const elapsedSeconds = Math.floor((now - new Date(pickStartedAt).getTime()) / 1000);
  const remainingSeconds = liveDraft.status === "active" ? Math.max(0, liveDraft.seconds_per_pick - elapsedSeconds) : liveDraft.seconds_per_pick;
  const isDraftActive = liveDraft.status === "active";
  const isDraftPending = liveDraft.status === "pending";
  const isDraftPaused = liveDraft.status === "paused";
  const isLeagueManager = currentUserId === league.owner_id;
  const isMyTurn = Boolean(currentTurn && currentTurn.member.user_id === currentUserId);
  const canPick = isDraftActive && isMyTurn && !isPending;
  const canDraftPlayers = allowedPoolModes.includes("players");
  const canDraftTeams = allowedPoolModes.includes("teams");

  const availableTeams = useMemo(
    () => teams.filter((team) => !draftedTeamIds.has(team.id) && team.name.toLowerCase().includes(normalizedFilter)),
    [draftedTeamIds, normalizedFilter, teams]
  );
  const availablePlayers = useMemo(
    () =>
      players.filter((player) => {
        const searchText = `${player.name} ${player.position} ${player.club ?? ""} ${player.national_teams?.fifa_code ?? ""}`.toLowerCase();
        return !draftedPlayerIds.has(player.id) && searchText.includes(normalizedFilter);
      }),
    [draftedPlayerIds, normalizedFilter, players]
  );

  const teamsById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);

  function handleStartDraft() {
    setError(null);

    if (isDemo) {
      setLiveDraft((existing) => ({
        ...existing,
        status: "active",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      return;
    }

    startTransition(async () => {
      try {
        const payload = await startDraft(liveDraft.id);
        setLiveDraft(payload.draft as Draft);
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : "Unable to start draft.");
      }
    });
  }

  function handlePauseDraft() {
    setError(null);

    if (!isLeagueManager) {
      setError("Only the league manager can pause the draft.");
      return;
    }

    if (isDemo) {
      setLiveDraft((existing) => ({
        ...existing,
        status: "paused",
        updated_at: new Date().toISOString()
      }));
      return;
    }

    startTransition(async () => {
      try {
        const payload = await pauseDraft(liveDraft.id);
        setLiveDraft(payload.draft as Draft);
      } catch (pauseError) {
        setError(pauseError instanceof Error ? pauseError.message : "Unable to pause draft.");
      }
    });
  }

  function submitPick(input: { draftableType: "team" | "player"; nationalTeamId?: string; playerId?: string }) {
    if (!currentTurn) return;

    if (!isDraftActive) {
      setError("Start the draft before making picks.");
      return;
    }

    if (!isMyTurn) {
      setError("You can only draft during your own turn.");
      return;
    }

    if ((input.draftableType === "player" && !canDraftPlayers) || (input.draftableType === "team" && !canDraftTeams)) {
      setError("This league mode does not allow that pick type.");
      return;
    }

    setError(null);

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
      setLiveDraft((existing) => ({
        ...existing,
        current_pick_number: existing.current_pick_number + 1,
        updated_at: new Date().toISOString()
      }));
      return;
    }

    startTransition(async () => {
      try {
        const payload = await makeDraftPick({
          draftId: liveDraft.id,
          leagueMemberId: currentTurn.member.id,
          draftableType: input.draftableType,
          nationalTeamId: input.nationalTeamId,
          playerId: input.playerId
        });
        setLivePicks((existing) => (existing.some((pick) => pick.id === payload.pick.id) ? existing : [...existing, payload.pick as DraftPick]));
        setLiveDraft(payload.draft as Draft);
      } catch (pickError) {
        setError(pickError instanceof Error ? pickError.message : "Unable to submit pick.");
      }
    });
  }

  return (
    <div className="container space-y-5 py-5">
      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">{liveDraft.status}</Badge>
                {isDemo ? <Badge>Demo mode</Badge> : <Badge>{syncStatus === "live" ? "Live realtime" : "Auto-syncing"}</Badge>}
                <Badge>{league.scoring_mode === "team_pickem" ? "Teams only" : league.scoring_mode === "player_pickem" ? "Players only" : "Combo"}</Badge>
              </div>
              <CardTitle className="text-2xl">{league.name} Draft</CardTitle>
              <CardDescription>
                Pick {liveDraft.current_pick_number} of {totalPicks} - Round {currentTurn?.roundNumber ?? liveDraft.round_count}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2">
              {isDraftPending || isDraftPaused ? (
                <Button className="w-full md:w-auto" disabled={isPending || !isLeagueManager} onClick={handleStartDraft}>
                  <Activity className="h-4 w-4" />
                  {isDraftPaused ? "Resume Draft" : "Start Draft"}
                </Button>
              ) : null}
              {isDraftActive ? (
                <Button className="w-full md:w-auto" variant="secondary" disabled={isPending || !isLeagueManager} onClick={handlePauseDraft}>
                  <Pause className="h-4 w-4" />
                  Pause Draft
                </Button>
              ) : null}
              {!isLeagueManager && (isDraftPending || isDraftPaused || isDraftActive) ? (
                <p className="max-w-sm text-xs text-muted-foreground">Only the league manager can start, pause, or resume the draft.</p>
              ) : null}
              {error ? <p className="max-w-sm text-sm text-accent">{error}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  On Clock
                </div>
                <div className="mt-1 font-semibold">{currentTurn?.member.display_name ?? "Complete"}</div>
                {isDraftActive && currentTurn ? (
                  <div className="text-xs text-muted-foreground">{isMyTurn ? "Your turn" : "Waiting"}</div>
                ) : null}
              </div>
              <div className="rounded-md border bg-background p-3">
                <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Timer
                </div>
                <div className="mt-1 font-mono text-lg font-semibold">{formatClock(remainingSeconds)}</div>
              </div>
              <div className="col-span-2 rounded-md border bg-background p-3 sm:col-span-1">
                <div className="text-xs uppercase text-muted-foreground">Progress</div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{progressPercent}% drafted</div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Next Turns
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {upcomingTurns.map((turn) => (
              <div
                key={turn.pickNumber}
                className="flex min-h-11 items-center justify-between rounded-md border bg-background px-3 text-sm"
              >
                <span className="font-medium">{turn.member.display_name}</span>
                <span className="text-muted-foreground">R{turn.roundNumber} - P{turn.pickNumber}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="min-w-0">
          <CardHeader className="gap-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Available Draft Pool</CardTitle>
              <CardDescription>
                {league.scoring_mode === "team_pickem"
                  ? "Search and draft from remaining national teams."
                  : league.scoring_mode === "player_pickem"
                    ? "Search and draft from remaining players."
                    : "Search and draft from the remaining players or national teams."}
              </CardDescription>
            </div>
            {allowedPoolModes.length > 1 ? (
              <div className="flex rounded-md border bg-background p-1">
                <Button type="button" size="sm" variant={poolMode === "players" ? "secondary" : "ghost"} onClick={() => setPoolMode("players")}>
                  Players
                </Button>
                <Button type="button" size="sm" variant={poolMode === "teams" ? "secondary" : "ghost"} onClick={() => setPoolMode("teams")}>
                  Teams
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search name, team, position, or club" value={filter} onChange={(event) => setFilter(event.target.value)} />
            </div>

            {poolMode === "players" ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Player</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="hidden md:table-cell">Club</TableHead>
                    <TableHead className="text-right">Proj</TableHead>
                    <TableHead className="w-28 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availablePlayers.map((player) => (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium">{player.name}</TableCell>
                      <TableCell>{player.national_teams?.fifa_code ?? "TBD"}</TableCell>
                      <TableCell>{player.position}</TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{player.club ?? "Club TBD"}</TableCell>
                      <TableCell className="text-right">{player.projected_points}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={!canPick} onClick={() => submitPick({ draftableType: "player", playerId: player.id })}>
                          <Check className="h-4 w-4" />
                          Draft
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>National Team</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Confederation</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="w-28 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availableTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">
                        {team.flag_emoji} {team.name}
                      </TableCell>
                      <TableCell>{team.fifa_code}</TableCell>
                      <TableCell>{team.confederation}</TableCell>
                      <TableCell>{team.group_name ?? "TBD"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={!canPick} onClick={() => submitPick({ draftableType: "team", nationalTeamId: team.id })}>
                          <Check className="h-4 w-4" />
                          Draft
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Drafted Rosters</CardTitle>
              <CardDescription>Live roster sidebar by manager.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.map((member) => {
                const memberPicks = livePicks.filter((pick) => pick.league_member_id === member.id);

                return (
                  <div key={member.id} className="rounded-md border bg-background p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="font-medium">{member.display_name}</div>
                      <Badge>#{member.draft_position ?? "-"}</Badge>
                    </div>
                    {memberPicks.length ? (
                      <div className="space-y-2">
                        {memberPicks.map((pick) => {
                          const team = pick.national_team_id ? teamsById.get(pick.national_team_id) : null;
                          const player = pick.player_id ? playersById.get(pick.player_id) : null;

                          return (
                            <div key={pick.id} className="flex items-start gap-2 rounded-md bg-muted p-2 text-sm">
                              {team ? <Shield className="mt-0.5 h-4 w-4 text-primary" /> : <Trophy className="mt-0.5 h-4 w-4 text-primary" />}
                              <div className="min-w-0">
                                <div className="truncate font-medium">{team?.name ?? player?.name ?? "Draft pick"}</div>
                                <div className="text-xs text-muted-foreground">
                                  Pick {pick.pick_number} - {team ? "National team" : `${player?.position ?? "Player"} - ${player?.national_teams?.fifa_code ?? "TBD"}`}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No picks yet.</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </section>
    </div>
  );
}
