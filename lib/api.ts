import type { DraftableType } from "@/types/database";

interface MakePickInput {
  draftId: string;
  leagueMemberId: string;
  draftableType: DraftableType;
  nationalTeamId?: string;
  playerId?: string;
}

export async function makeDraftPick(input: MakePickInput) {
  const response = await fetch("/api/draft/pick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Unable to submit pick." }));
    throw new Error(payload.error ?? "Unable to submit pick.");
  }

  return response.json();
}
