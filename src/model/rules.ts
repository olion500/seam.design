import { displaySpec } from "./diff";
import { isHex } from "./tokens";
import type { Project, Rule } from "./types";

export interface Violation {
  screenId?: string;
  transitionId?: string;
  message: string;
}

export interface RuleResult {
  rule: Rule;
  scope: number;
  scopeLabel: "화면" | "전이";
  violations: Violation[];
}

export function runRule(project: Project, rule: Rule): RuleResult {
  const screens = project.screens.flatMap((s) => {
    const spec = displaySpec(s);
    return spec ? [{ s, spec }] : [];
  });
  const result = (violations: Violation[], scope = screens.length, scopeLabel: RuleResult["scopeLabel"] = "화면"): RuleResult => ({
    rule,
    scope,
    scopeLabel,
    violations: rule.enabled ? violations : [],
  });

  switch (rule.check) {
    case "single-primary":
      return result(
        screens.flatMap(({ s, spec }) => {
          const n = spec.elements.filter((e) => e.kind === "button" && (e.variant === "primary" || e.variant === "accent")).length;
          return n > 1 ? [{ screenId: s.id, message: `${s.name}: 주요 버튼 ${n}개` }] : [];
        }),
      );
    case "touch-target": {
      const min = rule.params?.minSize ?? 48;
      return result(
        screens.flatMap(({ s, spec }) =>
          spec.elements
            .filter((e) => e.kind === "button" && (e.height ?? 56) < min)
            .map((e) => ({ screenId: s.id, message: `${s.name}: ${e.name} 높이 ${e.height}px` })),
        ),
      );
    }
    case "no-dead-end":
      return result(
        project.screens
          .filter((s) => !s.terminal && !project.transitions.some((t) => t.from === s.id))
          .map((s) => ({ screenId: s.id, message: `${s.name}: 나가는 전이 없음` })),
        project.screens.length,
      );
    case "token-colors": {
      const withVariant = project.screens.flatMap((s) => (s.variant ? [{ s, spec: s.variant.spec }] : []));
      const names = new Set(project.tokens.filter((t) => t.kind === "color").map((t) => t.name));
      return result(
        withVariant.flatMap(({ s, spec }) =>
          spec.elements.flatMap((e) =>
            [e.fill, e.stroke]
              .filter((v): v is string => !!v && (isHex(v) || !names.has(v)))
              .map((v) => ({ screenId: s.id, message: `${s.name}: ${e.name} 색 ${v}` })),
          ),
        ),
        withVariant.length,
      );
    }
    case "reduced-motion": {
      const moving = new Set(project.motions.filter((m) => (m.kind === "push" || m.kind === "zoom") && !m.reduced).map((m) => m.id));
      return result(
        project.transitions
          .filter((t) => moving.has(t.motionId))
          .map((t) => ({ transitionId: t.id, message: `${t.label}: 대체 동작 없음` })),
        project.transitions.length,
        "전이",
      );
    }
  }
}

export function runRules(project: Project): RuleResult[] {
  return project.rules.map((r) => runRule(project, r));
}

export interface Warnings {
  byScreen: Map<string, string[]>;
  brokenTransitions: Set<string>;
}

export function collectWarnings(project: Project, results: RuleResult[]): Warnings {
  const byScreen = new Map<string, string[]>();
  const push = (id: string, msg: string) => byScreen.set(id, [...(byScreen.get(id) ?? []), msg]);
  for (const r of results) for (const v of r.violations) if (v.screenId) push(v.screenId, `규칙 위반: ${v.message}`);

  const ids = new Set(project.screens.map((s) => s.id));
  const brokenTransitions = new Set<string>();
  for (const t of project.transitions) {
    const from = project.screens.find((s) => s.id === t.from);
    const spec = from && displaySpec(from);
    const missingElement = t.sourceElementId && spec && !spec.elements.some((e) => e.id === t.sourceElementId);
    if (!ids.has(t.from) || !ids.has(t.to) || missingElement) {
      brokenTransitions.add(t.id);
      if (from) push(from.id, `끊어진 연결: ${t.label}`);
    }
  }
  return { byScreen, brokenTransitions };
}
