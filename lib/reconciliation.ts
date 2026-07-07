export type ReconciliationResult = {
  posTotal: number;
  recordedTotal: number;
  gap: number;
  matched: boolean;
};

// Single source of truth for the pos_total/recorded_total -> gap/matched
// arithmetic, shared by the dashboard cells and the transaction detail page
// so the two never drift apart.
export function reconcile(posTotal: number, recordedTotal: number): ReconciliationResult {
  const gap = round2(posTotal - recordedTotal);
  return {
    posTotal,
    recordedTotal,
    gap,
    matched: gap === 0,
  };
}

// Guards against floating point noise (e.g. 0.1 + 0.2) showing up as a
// non-zero gap for amounts that are actually equal.
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
