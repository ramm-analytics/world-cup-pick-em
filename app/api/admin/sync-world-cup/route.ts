import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { syncWorldCupData } from "@/lib/ingestion/sync-world-cup";
import type { SyncMode } from "@/lib/ingestion/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const syncModes = new Set<SyncMode>(["baseline", "api-football-lite", "api-football-full", "results", "all"]);

export async function POST(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const mode = typeof body.mode === "string" ? body.mode : "baseline";

  return runSync(mode);
}

export async function GET(request: Request) {
  const authError = authorize(request);
  if (authError) return authError;

  const mode = new URL(request.url).searchParams.get("mode") ?? "results";
  return runSync(mode);
}

function authorize(request: Request) {
  if (!env.cronSecret) {
    return NextResponse.json({ error: "Missing CRON_SECRET." }, { status: 500 });
  }

  const expectedAuthorization = `Bearer ${env.cronSecret}`;
  if (request.headers.get("authorization") !== expectedAuthorization) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

async function runSync(mode: string) {
  if (!syncModes.has(mode as SyncMode)) {
    return NextResponse.json({ error: "Invalid sync mode." }, { status: 400 });
  }

  const results = await syncWorldCupData(mode as SyncMode);
  const status = results.some((result) => result.status === "failed") ? 207 : 200;

  return NextResponse.json({ results }, { status });
}
