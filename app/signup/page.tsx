import Link from "next/link";
import { Mail, UserPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { signupWithMagicLink, signupWithPassword } from "@/app/auth/actions";

export default async function SignupPage({
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
            <CardTitle>Sign up</CardTitle>
            <CardDescription>Create your manager profile with a password or magic link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={signupWithPassword} className="space-y-4">
              <input type="hidden" name="next" value={next ?? "/profile"} />
              <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
              <Input name="username" placeholder="username" autoComplete="username" required />
              <Input name="name" placeholder="Name" autoComplete="name" required />
              <Input name="password" type="password" placeholder="Password" autoComplete="new-password" minLength={8} required />
              <Input name="confirmPassword" type="password" placeholder="Confirm password" autoComplete="new-password" minLength={8} required />
              <Button className="w-full">
                <UserPlus className="h-4 w-4" />
                Create Account
              </Button>
            </form>

            <div className="border-t pt-5">
              <div className="mb-3">
                <h2 className="text-sm font-medium">Create with a magic link</h2>
                <p className="text-xs text-muted-foreground">Supabase will email a one-time sign-up link.</p>
              </div>
              <form action={signupWithMagicLink} className="space-y-4">
                <input type="hidden" name="next" value={next ?? "/profile"} />
                <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
                <Input name="username" placeholder="username" autoComplete="username" required />
                <Input name="name" placeholder="Name" autoComplete="name" required />
                <Button className="w-full">
                  <Mail className="h-4 w-4" />
                  Send Sign-up Link
                </Button>
              </form>
            </div>
            {message ? <p className="mt-4 text-sm text-muted-foreground">{message}</p> : null}
            <p className="mt-5 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-primary">
                Log in
              </Link>
            </p>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
