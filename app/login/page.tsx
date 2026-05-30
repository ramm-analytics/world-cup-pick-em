import Link from "next/link";
import { Mail } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginWithMagicLink } from "@/app/auth/actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;

  return (
    <AppShell>
      <section className="container flex min-h-[calc(100vh-4rem)] items-center justify-center py-10">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Log in</CardTitle>
            <CardDescription>Enter your email and Supabase will send a magic link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={loginWithMagicLink} className="space-y-4">
              <input type="hidden" name="next" value={next ?? "/profile"} />
              <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
              <Button className="w-full">
                <Mail className="h-4 w-4" />
                Send Magic Link
              </Button>
            </form>
            {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
            <p className="mt-5 text-sm text-muted-foreground">
              New here?{" "}
              <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-medium text-primary">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
