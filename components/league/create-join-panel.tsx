"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CreateJoinPanel() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(endpoint: string, payload: Record<string, FormDataEntryValue>) {
    setError(null);
    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Request failed.");
        return;
      }

      router.push(`/leagues/${data.league.id}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create or Join</CardTitle>
        <CardDescription>Requires Supabase Auth when connected.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            submit("/api/leagues", {
              name: form.get("name") ?? "",
              displayName: form.get("displayName") ?? "",
              maxMembers: form.get("maxMembers") ?? "8"
            });
          }}
        >
          <Input name="displayName" placeholder="Your display name" />
          <Input name="name" placeholder="League name" />
          <Input name="maxMembers" type="number" min={2} max={16} defaultValue={8} />
          <Button className="w-full" disabled={isPending}>
            <Plus className="h-4 w-4" />
            Create League
          </Button>
        </form>

        <form
          className="grid grid-cols-[1fr_auto] gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            submit("/api/leagues/join", {
              inviteCode: form.get("inviteCode") ?? "",
              displayName: form.get("joinDisplayName") ?? ""
            });
          }}
        >
          <Input name="joinDisplayName" placeholder="Name" />
          <Input name="inviteCode" placeholder="Invite code" defaultValue="WC2026" />
          <Button className="col-span-2" variant="secondary" disabled={isPending}>
            Join League
          </Button>
        </form>

        {error ? <p className="text-sm text-accent">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
