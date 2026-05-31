import { z } from "zod";

export const createLeagueSchema = z.object({
  name: z.string().min(3).max(80),
  maxMembers: z.coerce.number().int().min(2).max(16).default(8)
});

export const joinLeagueSchema = z.object({
  inviteCode: z.string().min(4).max(16).transform((value) => value.toUpperCase())
});
