"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function redirectWithMessage(path: string, message: string) {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function getSafeNext(formData: FormData, fallback = "/profile") {
  const next = cleanString(formData.get("next"));
  return next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

function friendlyAuthError(error: { message: string }) {
  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "That email and password combination was not recognized.";
  }

  if (message.includes("email not confirmed")) {
    return "This account still requires email confirmation. For testing without confirmation emails, disable Confirm email in Supabase Auth Email provider settings.";
  }

  if (message.includes("already registered") || message.includes("already been registered")) {
    return "An account already exists for that email. Try logging in instead.";
  }

  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Please wait a few minutes before trying again.";
  }

  if (message.includes("password")) {
    return "Please choose a stronger password and try again.";
  }

  return "Something went wrong. Please try again.";
}

async function getRequestOrigin() {
  if (env.appUrl) {
    return env.appUrl.replace(/\/$/, "");
  }

  const headerStore = await headers();
  const origin = headerStore.get("origin");

  if (origin) {
    return origin.replace(/\/$/, "");
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");

  if (!host) {
    throw new Error("Could not determine app URL for auth redirect.");
  }

  return `${protocol}://${host}`;
}

async function ensureProfile(userId: string, username: string | null, name: string) {
  const supabase = await createSupabaseServerClient();
  const profile = await supabase.from("profiles").upsert({
    id: userId,
    username,
    name
  });

  if (profile.error) {
    console.error("Profile upsert failed", { error: profile.error.message });
  }
}

export async function loginWithMagicLink(formData: FormData) {
  const email = cleanString(formData.get("email")).toLowerCase();
  const next = getSafeNext(formData);

  if (!email) {
    redirectWithMessage("/login", "Enter your email address.");
  }

  const origin = await getRequestOrigin();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    console.error("Magic link login failed", { error: error.message });
    redirectWithMessage("/login", friendlyAuthError(error));
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

  const origin = await getRequestOrigin();
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
    console.error("Magic link signup failed", { error: error.message });
    redirectWithMessage("/signup", friendlyAuthError(error));
  }

  redirectWithMessage("/signup", "Check your email to finish creating your account.");
}

export async function loginWithPassword(formData: FormData) {
  const email = cleanString(formData.get("email")).toLowerCase();
  const password = cleanString(formData.get("password"));
  const next = getSafeNext(formData);

  if (!email || !password) {
    redirectWithMessage("/login", "Email and password are required.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error("Password login failed", { error: error.message });
    redirectWithMessage("/login", friendlyAuthError(error));
  }

  redirect(next);
}

export async function signupWithPassword(formData: FormData) {
  const email = cleanString(formData.get("email")).toLowerCase();
  const username = cleanString(formData.get("username")).toLowerCase();
  const name = cleanString(formData.get("name"));
  const password = cleanString(formData.get("password"));
  const confirmPassword = cleanString(formData.get("confirmPassword"));
  const next = getSafeNext(formData);

  if (!email || !username || !name || !password || !confirmPassword) {
    redirectWithMessage("/signup", "Email, username, name, and password are required.");
  }

  if (password.length < 8) {
    redirectWithMessage("/signup", "Password must be at least 8 characters.");
  }

  if (password !== confirmPassword) {
    redirectWithMessage("/signup", "Passwords do not match.");
  }

  const origin = await getRequestOrigin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        username,
        name
      }
    }
  });

  if (error) {
    console.error("Password signup failed", { error: error.message });
    redirectWithMessage("/signup", friendlyAuthError(error));
  }

  if (data.user && data.session) {
    await ensureProfile(data.user.id, username, name);
    redirect(next);
  }

  redirectWithMessage(
    "/login",
    "Account created, but Supabase email confirmation is still enabled. Disable Confirm email in Supabase Auth Email provider settings to let test users log in immediately."
  );
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
