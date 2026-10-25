import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { TokenKind } from "../src/model/types";

export interface RouteFile {
  route: string;
  file: string;
  dynamic: boolean;
}

const SKIP = /^(_layout|\+not-found|\+html|\+native-intent)\./;

export function expoRoutes(root: string, dir: string): RouteFile[] {
  const base = join(root, dir);
  const out: RouteFile[] = [];
  const walk = (abs: string) => {
    for (const name of readdirSync(abs).sort()) {
      const path = join(abs, name);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }
      if (!/\.(tsx|ts|jsx|js)$/.test(name) || SKIP.test(name) || /\.(native|ios|android|web)\.\w+$/.test(name)) continue;
      const parts = relative(base, path)
        .replace(/\.\w+$/, "")
        .split(/[\\/]/)
        .filter((p) => !/^\(.*\)$/.test(p));
      if (parts.at(-1) === "index") parts.pop();
      const route = `/${parts.join("/")}`;
      out.push({ route, file: relative(root, path).replaceAll("\\", "/"), dynamic: /\[.+\]/.test(route) });
    }
  };
  walk(base);
  return out;
}

export interface FlowNode {
  id: string;
  name: string;
  route?: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
}

const NODE = /\b([A-Z][A-Z0-9_]*)\["([^"]*)"\]/g;
const EDGE = /\b([A-Z][A-Z0-9_]*)(?:\["[^"]*"\])?\s*-->\s*(?:\|([^|]*)\|\s*)?([A-Z][A-Z0-9_]*)/g;

export function mermaidFlows(markdown: string): { nodes: Map<string, FlowNode>; edges: FlowEdge[] } {
  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];
  const seen = new Set<string>();
  for (const block of markdown.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    const body = block[1];
    for (const m of body.matchAll(NODE)) {
      const [id, label] = [m[1], m[2]];
      const route = /(?:^|\s)(\/[\w\-[\]/]*)(?=$|,)/.exec(label)?.[1];
      const name = label.replace(new RegExp(`^${id}\\s*·\\s*`), "").replace(/\s+\/[\w\-[\]/]*(?=$|,).*$/, "").trim() || id;
      const prev = nodes.get(id);
      if (!prev || (!prev.route && route)) nodes.set(id, { id, name, route: route ?? prev?.route });
    }
    for (const line of body.split("\n")) {
      for (const m of line.matchAll(EDGE)) {
        const edge = { from: m[1], to: m[3], label: (m[2] ?? "").trim() };
        const key = `${edge.from}>${edge.to}>${edge.label}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push(edge);
        }
      }
    }
  }
  return { nodes, edges };
}

export interface ParsedToken {
  name: string;
  path: string;
  kind: TokenKind;
  value: string;
  line: number;
}

const HEX = /^#[0-9a-f]{3,8}$/i;

export function tokensFromModule(mod: Record<string, unknown>, exports: string[], sourceText: string): ParsedToken[] {
  const lines = sourceText.split("\n");
  const lineOf = (group: string, key: string) => {
    const start = Math.max(
      0,
      lines.findIndex((l) => new RegExp(`export const ${group}\\b`).test(l)),
    );
    const re = new RegExp(`\\b${key}\\s*:`);
    const i = lines.findIndex((l, n) => n >= start && re.test(l));
    return (i === -1 ? start : i) + 1;
  };
  const out: ParsedToken[] = [];
  for (const group of exports) {
    const obj = mod[group];
    if (!obj || typeof obj !== "object") continue;
    for (const [key, raw] of Object.entries(obj as Record<string, unknown>)) {
      const path = `${group}.${key}`;
      const name = `${group}-${key}`;
      if (typeof raw === "string" && HEX.test(raw)) out.push({ name, path, kind: "color", value: raw, line: lineOf(group, key) });
      else if (raw && typeof raw === "object" && "fontSize" in raw) {
        const t = raw as { fontSize: number; fontWeight?: string | number };
        out.push({ name, path, kind: "type", value: `${t.fontSize} / ${t.fontWeight ?? 400}`, line: lineOf(group, key) });
      }
    }
  }
  return out;
}

export async function loadTokens(file: string, exports: string[]): Promise<ParsedToken[]> {
  const mod = (await import(`${file}?v=${Date.now()}`)) as Record<string, unknown>;
  return tokensFromModule(mod, exports, await Bun.file(file).text());
}
