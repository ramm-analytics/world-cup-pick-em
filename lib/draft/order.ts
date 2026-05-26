import type { LeagueMember } from "@/types/database";

export interface DraftTurn {
  pickNumber: number;
  roundNumber: number;
  member: LeagueMember;
}

export function buildSnakeDraftOrder(members: LeagueMember[], roundCount: number): DraftTurn[] {
  const orderedMembers = [...members]
    .filter((member): member is LeagueMember & { draft_position: number } => member.draft_position !== null)
    .sort((a, b) => a.draft_position - b.draft_position);

  return Array.from({ length: roundCount }).flatMap((_, roundIndex) => {
    const roundNumber = roundIndex + 1;
    const roundMembers = roundNumber % 2 === 1 ? orderedMembers : [...orderedMembers].reverse();

    return roundMembers.map((member, memberIndex) => ({
      pickNumber: roundIndex * orderedMembers.length + memberIndex + 1,
      roundNumber,
      member
    }));
  });
}

export function getCurrentTurn(members: LeagueMember[], roundCount: number, currentPickNumber: number) {
  return buildSnakeDraftOrder(members, roundCount).find((turn) => turn.pickNumber === currentPickNumber) ?? null;
}
