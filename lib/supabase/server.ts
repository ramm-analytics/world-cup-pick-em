import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "@/types/database";
import type { CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function createSupabaseServerClient(): Promise<SupabaseClient<Database, "public", "public", Database["public"]>> {
  const cookieStore = await cookies();

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  return createServerClient<Database, "public", Database["public"]>(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot always write cookies; middleware or route handlers will refresh sessions.
        }
      }
    }
  }) as unknown as SupabaseClient<Database, "public", "public", Database["public"]>;
}

export function createSupabaseAdminClient() {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for server mutation routes.");
  }

  return createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}
