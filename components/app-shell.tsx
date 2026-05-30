import Link from "next/link";
import { LogOut, Trophy } from "lucide-react";
import { logout } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function AppShell({ children }: { children: React.ReactNode }) {
  let isSignedIn = false;

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    isSignedIn = Boolean(user);
  }

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>World Cup Pick'em</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/leagues/11111111-1111-4111-8111-111111111111">League</Link>
            </Button>
            {isSignedIn ? (
              <>
                <Button asChild size="sm">
                  <Link href="/leagues/11111111-1111-4111-8111-111111111111/draft">Draft</Link>
                </Button>
                <form action={logout}>
                  <Button type="submit" variant="ghost" size="sm" aria-label="Log out">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">Log in</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
