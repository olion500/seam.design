import type { Project } from "../src/model/types";
import { transitionKey } from "./repo";

export interface TokenChange {
  kind: "token";
  token: string;
  path: string;
  file: string;
  line: number;
  before: string;
  after: string;
}

export interface ElementChange {
  kind: "element";
  screen: string;
  screenName: string;
  route?: string;
  sources: string[];
  baselineImage?: string;
  element?: { key: string; role: string; label: string; box: { x: number; y: number; w: number; h: number } };
  label?: string;
  note: string;
  requestId: string;
}

export interface TransitionChange {
  kind: "transition";
  change: "added" | "removed";
  from: string;
  to: string;
  label: string;
  trigger: string;
  condition: string;
}

export type Change = TokenChange | ElementChange | TransitionChange;

export function pendingChanges(project: Project): Change[] {
  const source = project.source ?? { tokens: {}, transitions: [] };
  const out: Change[] = [];

  for (const t of project.tokens) {
    const src = source.tokens[t.name];
    if (src && src.value !== t.value) out.push({ kind: "token", token: t.name, path: src.path, file: src.file, line: src.line, before: src.value, after: t.value });
  }

  for (const s of project.screens) {
    for (const r of s.requests ?? []) {
      const el = s.baseline?.elements?.find((e) => e.key === r.elementKey);
      out.push({
        kind: "element",
        screen: s.id,
        screenName: s.name,
        route: s.route,
        sources: s.sources.map((m) => m.path),
        baselineImage: s.baseline?.image ? `.seam/${s.baseline.image}` : undefined,
        element: el,
        label: r.label,
        note: r.note,
        requestId: r.id,
      });
    }
  }

  const current = new Map(project.transitions.map((t) => [transitionKey(t), t]));
  const original = new Set(source.transitions);
  for (const [key, t] of current) {
    if (!original.has(key)) out.push({ kind: "transition", change: "added", from: t.from, to: t.to, label: t.label, trigger: t.trigger, condition: t.condition });
  }
  for (const key of original) {
    if (current.has(key)) continue;
    const [from, to, label] = key.split(">");
    out.push({ kind: "transition", change: "removed", from, to, label, trigger: "", condition: "" });
  }
  return out;
}

export function changeMarkdown(project: Project, changes: Change[]): string {
  const name = (id: string) => project.screens.find((s) => s.id === id)?.name ?? id;
  const lines = [`# seam 변경 묶음 — ${project.name}`, "", `변경 ${changes.length}건. 기계용 목록은 같은 폴더의 \`change.json\`.`, ""];
  const tokens = changes.filter((c): c is TokenChange => c.kind === "token");
  const elements = changes.filter((c): c is ElementChange => c.kind === "element");
  const transitions = changes.filter((c): c is TransitionChange => c.kind === "transition");
  if (tokens.length) {
    lines.push("## 토큰", "");
    for (const c of tokens) lines.push(`- \`${c.path}\` (${c.file}:${c.line}): \`${c.before}\` → \`${c.after}\``);
    lines.push("");
  }
  if (elements.length) {
    lines.push("## 화면 요소", "");
    for (const c of elements) {
      const target = c.element ? `${c.element.role} “${c.element.label}”` : "화면 전체";
      const what = [c.label !== undefined && c.label !== "" ? `문구를 “${c.label}”(으)로` : null, c.note || null].filter(Boolean).join(" · ");
      lines.push(`- **${c.screenName}** (${c.route ?? "?"}, ${c.sources.join(", ")}) — ${target}: ${what}`);
    }
    lines.push("");
  }
  if (transitions.length) {
    lines.push("## 전이", "");
    for (const c of transitions) lines.push(`- ${c.change === "added" ? "추가" : "삭제"}: ${name(c.from)} → ${name(c.to)} · ${c.label}${c.condition ? ` (조건: ${c.condition})` : ""}`);
    lines.push("");
  }
  return lines.join("\n");
}
