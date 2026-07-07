export function nextLifecycleStage(stages: string[], current: string): string | null {
  const index = stages.indexOf(current);
  if (index === -1 || index === stages.length - 1) return null;
  return stages[index + 1];
}
