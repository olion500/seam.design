import { screenChanges } from "./diff";
import { runRules } from "./rules";
import type { Project } from "./types";

const row = (cells: (string | number)[]) => `| ${cells.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`;

export function toMarkdown(project: Project): string {
  const name = (id: string) => project.screens.find((s) => s.id === id)?.name ?? id;
  const motion = (id: string) => project.motions.find((m) => m.id === id);
  const out: string[] = [`# ${project.name} — 디자인 명세`, ""];

  out.push("## 화면", "");
  for (const s of project.screens) {
    out.push(`### ${s.name}${s.variant ? ` (시안 v${s.variant.version})` : " (기준)"}`, "");
    out.push(`- 크기: ${s.size.w} × ${s.size.h}`);
    out.push(`- 기준: ${s.baseline ? (s.baseline.capturedAt ?? "있음") : "기준 이미지 없음"}`);
    if (s.variant) out.push(`- 시안: v${s.variant.version} · ${s.variant.updatedAt}`);
    out.push(`- 상태: ${s.states.join(" · ")}`);
    const changes = screenChanges(s);
    if (changes.length) out.push("- 변경 내역:", ...changes.map((c) => `  - ${c.summary}`));
    if (s.sources.length) out.push("- 소스 매핑:", ...s.sources.map((m) => `  - \`${m.path}\` — ${m.note}`));
    out.push("");
  }

  out.push("## 전이", "", row(["출발", "도착", "트리거", "조건", "모션"]), row(["---", "---", "---", "---", "---"]));
  for (const t of project.transitions) {
    const m = motion(t.motionId);
    out.push(row([name(t.from), name(t.to), t.trigger, t.condition || "-", m ? `${m.name} ${m.durationMs}ms` : "-"]));
  }

  out.push("", "## 토큰", "", row(["이름", "값", "종류"]), row(["---", "---", "---"]));
  for (const t of project.tokens) out.push(row([`\`${t.name}\``, t.value, t.kind]));

  out.push("", "## 모션", "", row(["프리셋", "길이", "이징", "모션 줄이기"]), row(["---", "---", "---", "---"]));
  for (const m of project.motions) {
    out.push(row([m.name, `${m.durationMs}ms`, m.easing, m.reduced ? `${m.reduced.kind} ${m.reduced.durationMs}ms` : "-"]));
  }

  out.push("", "## 규칙", "");
  for (const r of runRules(project)) {
    const status = !r.rule.enabled ? "꺼짐" : r.violations.length ? `위반 ${r.violations.length}` : "통과";
    out.push(`- **${r.rule.title}** — ${status}`, ...r.violations.map((v) => `  - ${v.message}`));
  }
  return out.join("\n") + "\n";
}

export function toJSON(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function parseProject(text: string): Project {
  const data = JSON.parse(text) as Partial<Project>;
  const lists = ["screens", "transitions", "tokens", "motions", "rules", "assets"] as const;
  if (typeof data.id !== "string" || typeof data.name !== "string" || lists.some((k) => !Array.isArray(data[k]))) {
    throw new Error("명세 JSON 형식이 아닙니다");
  }
  return data as Project;
}
