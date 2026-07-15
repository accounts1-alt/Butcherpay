import { supabaseServer } from "@/lib/supabase/server";
import { isPosFieldMapping } from "@/lib/posSync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionForm, type ConnectionFormInitial } from "../../ConnectionForm";
import { updateConnection } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditConnectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = supabaseServer();
  const { data: connection, error } = await supabase
    .from("connections")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);

  const config = connection.config as Record<string, unknown>;
  const mapping = isPosFieldMapping(connection.field_mapping) ? connection.field_mapping : null;

  const initial: ConnectionFormInitial = {
    connectionId: connection.id,
    name: connection.name,
    type: connection.type,
    location: typeof config.location === "string" ? config.location : undefined,
    query: typeof config.query === "string" ? config.query : undefined,
    hasSecretKey: typeof config.secret_key === "string" && config.secret_key.length > 0,
    hasConnectionString:
      typeof config.connection_string === "string" && config.connection_string.length > 0,
    date_col: mapping?.date,
    location_col: mapping?.location,
    method_col: mapping?.payment_method,
    total_col: mapping?.total,
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit connection</h1>
        <p className="text-sm text-muted-foreground mt-1">{connection.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <ConnectionForm action={updateConnection} submitLabel="Save changes" initial={initial} />
        </CardContent>
      </Card>
    </div>
  );
}
