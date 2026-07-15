"use client";

import { Button } from "@/components/ui/button";
import { deleteConnection } from "./actions";

export function DeleteConnectionButton({ connectionId, name }: { connectionId: string; name: string }) {
  return (
    <form
      action={deleteConnection}
      onSubmit={(e) => {
        if (!confirm(`Delete the "${name}" connection? Historical POS totals it produced are kept.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="connection_id" value={connectionId} />
      <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10">
        Delete
      </Button>
    </form>
  );
}
