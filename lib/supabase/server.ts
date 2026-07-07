import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client, used only from Server Components / Server Actions /
// Route Handlers. The key never reaches the browser bundle because nothing
// client-side imports this module (enforced by the "server-only" import).
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)"
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false },
  });
}
