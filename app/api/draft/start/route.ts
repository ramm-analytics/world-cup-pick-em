import { NextResponse } from "next/server";
import { startDraftSchema } from "@/lib/draft/validators";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const payload = startDraftSchema.safeParse(await request.json());

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const updated = await supabase
    .from("drafts")
    .update({
      status: "active",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", payload.data.draftId)
    .eq("status", "pending")
    .select("*")
    .single();

  if (updated.error) {
    return NextResponse.json({ error: updated.error.message }, { status: 400 });
  }

  return NextResponse.json({ draft: updated.data });
}
