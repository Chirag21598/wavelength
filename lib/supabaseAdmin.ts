import { createClient } from "@supabase/supabase-js";

// Server-side only client. Uses the service-role key, which bypasses
// Row Level Security — never import this file from a 'use client' component.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.warn(
    "[supabaseAdmin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. " +
      "API routes that touch the database will fail until these are configured."
  );
}

export const supabaseAdmin = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  serviceRoleKey ?? "placeholder",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
