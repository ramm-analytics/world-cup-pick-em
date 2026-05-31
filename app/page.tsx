import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CreateJoinPanel } from "@/components/league/create-join-panel";
import { Button } from "@/components/ui/button";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  if (code) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=/profile`);
  }

  return (
    <AppShell>
      <section className="container grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:py-16">
        <div className="flex flex-col justify-center">
          <div className="mb-3 text-sm font-medium uppercase tracking-wide text-primary">2026 FIFA World Cup fantasy pick'em</div>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Draft national teams and players in one clean league room.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Create a league, run a live snake draft, and let standings update from match and player scoring as results arrive.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/leagues">
                <Users className="h-4 w-4" />
                Your Leagues
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">
                <CalendarDays className="h-4 w-4" />
                View Profile
              </Link>
            </Button>
          </div>
        </div>

        <CreateJoinPanel />
      </section>
    </AppShell>
  );
}
