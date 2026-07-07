// The amount/net to use for money-held and lifecycle math: an entry's latest
// adjustment (if any) overrides its original amount, mirroring how
// reconciliation_totals treats corrections. entries.amount/net themselves are
// never mutated (see adjustments table / CLAUDE.md conventions).
export function effectiveNet(
  entry: { amount: number; fee: number },
  latestAdjustment?: { corrected_amount: number } | null
): number {
  const amount = latestAdjustment ? latestAdjustment.corrected_amount : entry.amount;
  return amount - entry.fee;
}
