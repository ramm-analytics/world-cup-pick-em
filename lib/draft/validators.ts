import { z } from "zod";

export const draftPickSchema = z.object({
  draftId: z.string().uuid(),
  leagueMemberId: z.string().uuid(),
  draftableType: z.enum(["team", "player"]),
  nationalTeamId: z.string().uuid().optional(),
  playerId: z.string().uuid().optional()
}).refine(
  (value) =>
    (value.draftableType === "team" && value.nationalTeamId && !value.playerId) ||
    (value.draftableType === "player" && value.playerId && !value.nationalTeamId),
  "Pick must contain exactly one draftable id matching its type."
);

export const startDraftSchema = z.object({
  draftId: z.string().uuid()
});

export const pauseDraftSchema = z.object({
  draftId: z.string().uuid()
});
