import Link from "next/link";
import { KeyRound, Mail } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { loginWithMagicLink, loginWithPassword } from "@/app/auth/actions";

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
            <CardDescription>Log in with your password or request a magic link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={loginWithPassword} className="space-y-4">
              <input type="hidden" name="next" value={next ?? "/profile"} />
              <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
              <Input name="password" type="password" placeholder="Password" autoComplete="current-password" required />
              <Button className="w-full">
                <KeyRound className="h-4 w-4" />
                Log In
              </Button>
            </form>

            <div className="border-t pt-5">
              <div className="mb-3">
                <h2 className="text-sm font-medium">Email me a magic link</h2>
                <p className="text-xs text-muted-foreground">Use this if you prefer a one-time email sign-in link.</p>
              </div>
              <form action={loginWithMagicLink} className="space-y-4">
              <input type="hidden" name="next" value={next ?? "/profile"} />
              <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
              <Button className="w-full">
                <Mail className="h-4 w-4" />
                Send Magic Link
              </Button>
              </form>
            </div>
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
