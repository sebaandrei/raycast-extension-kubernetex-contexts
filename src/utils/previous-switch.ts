export type PreviousSwitchResult =
  | { kind: "none" }
  | { kind: "missing"; previous: string }
  | { kind: "same"; name: string }
  | { kind: "switch"; target: string };

export interface PreviousSwitchInput {
  previous: string | null | undefined;
  current: string | null | undefined;
  available: readonly string[];
}

export function resolvePreviousSwitch({ previous, current, available }: PreviousSwitchInput): PreviousSwitchResult {
  if (!previous) return { kind: "none" };
  if (!available.includes(previous)) return { kind: "missing", previous };
  if (previous === current) return { kind: "same", name: previous };
  return { kind: "switch", target: previous };
}
