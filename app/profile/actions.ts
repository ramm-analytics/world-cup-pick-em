"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function redirectWithMessage(message: string) {
  redirect(`/profile?message=${encodeURIComponent(message)}`);
}

export async function updateProfile(formData: FormData) {
  const name = cleanString(formData.get("name"));
  const username = cleanString(formData.get("username")).toLowerCase();

  if (!name || !username) {
    redirectWithMessage("Name and username are required.");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/profile");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      name,
      username
    })
    .eq("id", user.id);

  if (error) {
    const isDuplicateUsername = error.code === "23505";
    redirectWithMessage(isDuplicateUsername ? "That username is already taken." : error.message);
  }

  redirectWithMessage("Profile updated.");
}
