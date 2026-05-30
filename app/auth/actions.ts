"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getSafeNext(formData: FormData) {
  const next = cleanString(formData.get("next"));
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function loginWithMagicLink(formData: FormData) {
  const email = cleanString(formData.get("email")).toLowerCase();
  const next = getSafeNext(formData);

  if (!email) {
    redirectWithMessage("/login", "Enter your email address.");
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    redirectWithMessage("/login", error.message);
  }

  redirectWithMessage("/login", "Check your email for a sign-in link.");
}

export async function signupWithMagicLink(formData: FormData) {
  const email = cleanString(formData.get("email")).toLowerCase();
  const username = cleanString(formData.get("username")).toLowerCase();
  const name = cleanString(formData.get("name"));
  const next = getSafeNext(formData);

  if (!email || !username || !name) {
    redirectWithMessage("/signup", "Email, username, and name are required.");
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        username,
        name
      }
    }
  });

  if (error) {
    redirectWithMessage("/signup", error.message);
  }

  redirectWithMessage("/signup", "Check your email to finish creating your account.");
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
