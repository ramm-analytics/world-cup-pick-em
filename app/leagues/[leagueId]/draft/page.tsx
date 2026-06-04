import { AppShell } from "@/components/app-shell";
import { DraftRoom } from "@/components/draft/draft-room";
import { getDraftRoom } from "@/lib/queries";

export default async function DraftPage({ params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  const { league, members, draft, picks, teams, players, currentUserId, isDemo } = await getDraftRoom(leagueId);

  if (!league || !draft) {
    return <AppShell><div className="container py-10">Draft not found.</div></AppShell>;
  }

  return (
    <AppShell>
      <DraftRoom
        league={league}
        members={members}
        draft={draft}
        picks={picks}
        teams={teams}
        players={players}
        currentUserId={currentUserId}
        isDemo={isDemo}
      />
    </AppShell>
  );
}
