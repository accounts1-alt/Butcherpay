import { supabaseServer } from "@/lib/supabase/server";
import { syncConnection, yesterdayUTC } from "@/lib/connections/syncDispatch";
import type { ConnectionRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Vercel signs cron-triggered requests with this header when CRON_SECRET is
// set. Rejecting anything else keeps this endpoint from being a public,
// unauthenticated way to trigger syncs against every connection's credentials.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseServer();
  const date = yesterdayUTC();

  const { data: connections, error } = await supabase
    .from("connections")
    .select("*")
    .in("type", ["postgres", "rest_api"])
    .neq("status", "disabled");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results = await Promise.all(
    ((connections ?? []) as ConnectionRow[]).map(async (connection) => {
      try {
        await syncConnection(supabase, connection, date);
        return { connection: connection.name, ok: true };
      } catch (err) {
        return {
          connection: connection.name,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    })
  );

  return Response.json({ date, results });
}
