import type { CSSProperties } from "react";
import type { ScreenSpec, Token } from "./types";

export const isHex = (v: string) => /^#[0-9a-f]{3,8}$/i.test(v);

export function tokenVars(tokens: Token[]): CSSProperties {
  const vars: Record<string, string> = {};
  for (const t of tokens) {
    if (t.kind === "type") {
      const [size, weight] = t.value.split("/").map((s) => s.trim());
      vars[`--tk-${t.name}-size`] = `${size}px`;
      vars[`--tk-${t.name}-weight`] = weight ?? "400";
    } else {
      vars[`--tk-${t.name}`] = t.value;
    }
  }
  return vars as CSSProperties;
}

export function colorRef(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return isHex(value) ? value : `var(--tk-${value})`;
}

export function lengthRef(value: string): string {
  return /^\d+(px)?$/.test(value) ? `${parseInt(value, 10)}px` : `var(--tk-${value})`;
}

export function tokensInSpec(spec: ScreenSpec): string[] {
  const used = new Set<string>(["surface", "primary"]);
  if (!/^\d/.test(spec.gap)) used.add(spec.gap);
  for (const el of spec.elements) {
    for (const v of [el.fill, el.stroke]) if (v && !isHex(v)) used.add(v);
    if (el.kind === "button") {
      used.add("button");
      used.add("radius-xs");
      if (el.variant === "accent") used.add("accent");
      if (el.variant === "primary") used.add("primary");
    }
    if (el.kind === "field" || el.kind === "listItem") used.add("radius-xs");
  }
  return [...used];
}
