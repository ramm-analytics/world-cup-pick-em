import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?message=Missing auth callback code.", requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(`/login?message=${encodeURIComponent(error.message)}`, requestUrl.origin));
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const username = typeof user.user_metadata.username === "string" ? user.user_metadata.username : null;
    const displayName =
      typeof user.user_metadata.display_name === "string"
        ? user.user_metadata.display_name
        : user.email?.split("@")[0] ?? "Manager";

    const profile = await supabase.from("profiles").upsert({
      id: user.id,
      username,
      display_name: displayName
    });

    if (profile.error) {
      const message = encodeURIComponent(`Could not create profile: ${profile.error.message}`);
      return NextResponse.redirect(new URL(`/login?message=${message}`, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
