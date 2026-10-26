import type { CSSProperties } from "react";
import type { Project, ScreenSpec, Token } from "./types";

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

export function bridgeVars(tokens: Token[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokenVars(tokens))) vars[key.replace("--tk-", "--")] = String(value);
  return vars;
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

export function validTokenValue(kind: Token["kind"], value: string): boolean {
  if (kind === "color") return isHex(value) && [4, 7, 9].includes(value.length);
  if (kind === "type") return /^\d+(\.\d+)?\s*\/\s*\d+$/.test(value.trim());
  return value.trim() !== "";
}

export function liveOverrides(project: Pick<Project, "tokens" | "source">): Record<string, string> {
  const out: Record<string, string> = {};
  const source = project.source?.tokens ?? {};
  for (const t of project.tokens) {
    const src = source[t.name];
    if (src && src.value !== t.value && validTokenValue(t.kind, t.value)) out[src.path] = t.value;
  }
  return out;
}

export function liveSrc(url: string, overrides: Record<string, string>): string {
  const u = new URL(url, "http://seam.invalid");
  u.searchParams.set("seam-tokens", JSON.stringify(overrides));
  return u.origin === "http://seam.invalid" ? `${u.pathname}${u.search}` : u.href;
}
