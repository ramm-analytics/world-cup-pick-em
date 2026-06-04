import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { recalculateLeagueScores } from "@/lib/scoring/engine";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  const leagueId = new URL(request.url).searchParams.get("leagueId");
  return recalculate(leagueId);
}

export async function POST(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const leagueId = typeof body.leagueId === "string" ? body.leagueId : null;
  return recalculate(leagueId);
}

function authorize(request: Request) {
  if (!env.cronSecret) {
    return NextResponse.json({ error: "Missing CRON_SECRET." }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

async function recalculate(leagueId: string | null) {
  let leagueIds: string[];

  try {
    leagueIds = leagueId ? [leagueId] : await getAllLeagueIds();
  } catch {
    return NextResponse.json({ error: "Could not load leagues for scoring recalculation." }, { status: 500 });
  }

  const results = [];

  for (const id of leagueIds) {
    try {
      const result = await recalculateLeagueScores(id);
      results.push({ leagueId: id, status: "success", ...result });
    } catch {
      results.push({ leagueId: id, status: "failed" });
    }
  }

  const status = results.some((result) => result.status === "failed") ? 207 : 200;
  return NextResponse.json({ results }, { status });
}

async function getAllLeagueIds() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("leagues").select("id").order("created_at");

  if (error) {
    throw error;
  }

  return (data ?? []).map((league) => league.id);
}
