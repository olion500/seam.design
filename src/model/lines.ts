import type { Transition } from "./types";

/** Transitions between the same two screens in the same direction, which the canvas draws as one line. */
export function transitionLines(transitions: Transition[]): Transition[][] {
  const lines = new Map<string, Transition[]>();
  for (const t of transitions) {
    const key = `${t.from}>${t.to}`;
    lines.set(key, [...(lines.get(key) ?? []), t]);
  }
  return [...lines.values()];
}

/** A line is named after its first transition, with a count of the others. */
export const lineLabel = (line: Transition[]) => (line.length > 1 ? `${line[0].label} +${line.length - 1}` : line[0].label);
