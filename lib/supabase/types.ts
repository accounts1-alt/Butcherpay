// Hand-written types mirroring supabase/migrations/*.sql. Keep in sync with the schema.

export type PaymentMethodRow = {
  id: string;
  name: string;
  lifecycle_stages: string[];
  active: boolean;
};

export type MerchantRow = {
  id: string;
  payment_method_id: string;
  name: string;
  fee_type: "percent" | "fixed" | "none";
  fee_value: number;
  active: boolean;
};

export type EntryDirection = "in" | "out";

export type EntryType =
  | "sale"
  | "refund_received"
  | "bill_paid"
  | "loan_drawdown"
  | "owner_transfer"
  | "other";

export type EntryRow = {
  id: string;
  reference: number;
  date: string;
  location: string;
  direction: EntryDirection;
  type: EntryType;
  reconciles_against_pos: boolean;
  payment_method_id: string;
  merchant_id: string | null;
  amount: number;
  fee: number;
  net: number;
  lifecycle_status: string;
  posted_at: string | null;
  banked_at: string | null;
  notes: string | null;
  created_at: string;
};

export type AdjustmentRow = {
  id: string;
  entry_id: string;
  original_amount: number;
  corrected_amount: number;
  reason: string;
  adjusted_at: string;
};

export type ConnectionType = "postgres" | "rest_api" | "csv" | "webhook";
export type ConnectionStatus = "healthy" | "failing" | "disabled";

export type ConnectionRow = {
  id: string;
  name: string;
  type: ConnectionType;
  config: Record<string, unknown>;
  field_mapping: Record<string, unknown>;
  sync_schedule: string | null;
  last_synced_at: string | null;
  status: ConnectionStatus;
  last_error: string | null;
};

export type PosDailyTotalRow = {
  id: string;
  connection_id: string | null;
  date: string;
  location: string;
  payment_method_id: string;
  total: number;
  synced_at: string;
};

export type ReconciliationTotalRow = {
  date: string;
  location: string;
  payment_method_id: string;
  pos_total: number;
  recorded_total: number;
};

export type Database = {
  public: {
    Tables: {
      payment_methods: {
        Row: PaymentMethodRow;
        Insert: Partial<PaymentMethodRow> & { name: string; lifecycle_stages: string[] };
        Update: Partial<PaymentMethodRow>;
        Relationships: [];
      };
      merchants: {
        Row: MerchantRow;
        Insert: Partial<MerchantRow> & { payment_method_id: string; name: string };
        Update: Partial<MerchantRow>;
        Relationships: [];
      };
      entries: {
        Row: EntryRow;
        Insert: Partial<EntryRow> & {
          date: string;
          location: string;
          direction: EntryDirection;
          type: EntryType;
          payment_method_id: string;
          amount: number;
          lifecycle_status: string;
        };
        Update: Partial<EntryRow>;
        Relationships: [];
      };
      adjustments: {
        Row: AdjustmentRow;
        Insert: Partial<AdjustmentRow> & {
          entry_id: string;
          original_amount: number;
          corrected_amount: number;
          reason: string;
        };
        Update: Partial<AdjustmentRow>;
        Relationships: [];
      };
      connections: {
        Row: ConnectionRow;
        Insert: Partial<ConnectionRow> & {
          name: string;
          type: ConnectionType;
          config: Record<string, unknown>;
          field_mapping: Record<string, unknown>;
        };
        Update: Partial<ConnectionRow>;
        Relationships: [];
      };
      pos_daily_totals: {
        Row: PosDailyTotalRow;
        Insert: Partial<PosDailyTotalRow> & {
          date: string;
          location: string;
          payment_method_id: string;
          total: number;
        };
        Update: Partial<PosDailyTotalRow>;
        Relationships: [];
      };
    };
    Views: {
      reconciliation_totals: {
        Row: ReconciliationTotalRow;
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
};
