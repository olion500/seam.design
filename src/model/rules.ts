import { displaySpec } from "./diff";
import { isHex } from "./tokens";
import type { CapturedElement, Project, Rule, Screen } from "./types";

/** Rules a project can add; an imported app starts with every one that can check captured screens. */
export const RULE_TEMPLATES: Omit<Rule, "id">[] = [
  { check: "single-primary", category: "레이아웃", title: "주요 버튼은 화면당 하나", description: "Primary·Accent 변형은 한 화면에 한 번만 쓴다.", enabled: true },
  { check: "touch-target", category: "접근성", title: "터치 영역 44px 이상", description: "누를 수 있는 요소는 가로·세로 44px 이상.", enabled: true, params: { minSize: 44 } },
  { check: "no-dead-end", category: "흐름", title: "모든 화면에 나가는 전이", description: "마지막 화면을 빼고 막다른 화면이 없어야 한다.", enabled: true },
  { check: "token-colors", category: "토큰", title: "색은 토큰으로만", description: "화면의 모든 색이 디자인 시스템 토큰에 매핑된다.", enabled: true },
  { check: "type-scale", category: "토큰", title: "글자는 타이포 토큰으로만", description: "화면의 모든 글자 크기·굵기가 타이포그래피 토큰 중 하나다.", enabled: true },
  { check: "consistent-buttons", category: "일관성", title: "같은 버튼은 같은 색", description: "이름이 같은 버튼은 모든 화면에서 같은 배경색과 글자색을 쓴다.", enabled: true },
  { check: "reduced-motion", category: "모션", title: "모션 줄이기 대체 동작", description: "이동이 있는 전환은 모두 대체 동작을 가진다.", enabled: true },
];

/** single-primary needs a designed spec (button variants); a screenshot cannot tell which button is the main one. */
export const IMPORT_RULES = RULE_TEMPLATES.filter((r) => r.check !== "single-primary");

export interface Violation {
  screenId?: string;
  transitionId?: string;
  message: string;
  /** Same key = same cause (e.g. one shared header button), so it is counted and fixed once. */
  group?: string;
  /** The problem without the screen name, shown once for the whole group. */
  problem?: string;
  /** The captured element at fault (`CapturedElement.key`), to show it on the screenshot. */
  elementKey?: string;
  /** The off-token color, to show as a swatch. */
  color?: string;
  /** What to ask for, as the note of a change request on `elementKey`. */
  fix?: string;
}

/** Change requests that would fix these violations, leaving out those the screen already has. */
export function fixRequests(project: Project, violations: Violation[]): { screenId: string; request: { elementKey: string; note: string } }[] {
  return violations.flatMap((v) => {
    if (!v.screenId || !v.elementKey || !v.fix) return [];
    const screen = project.screens.find((s) => s.id === v.screenId);
    if (screen?.requests?.some((r) => r.elementKey === v.elementKey && r.note === v.fix)) return [];
    return [{ screenId: v.screenId, request: { elementKey: v.elementKey, note: v.fix } }];
  });
}

/** One cause and every place it shows up. */
export interface Problem {
  problem: string;
  violations: Violation[];
}

/** A cause on this many screens or more is a shared component: shown once in the rules, not as a dot on every screen. */
export const SHARED_SCREENS = 3;

export function groupViolations(violations: Violation[]): Problem[] {
  const groups = new Map<string, Problem>();
  for (const v of violations) {
    const key = v.group ?? `${v.screenId ?? v.transitionId}|${v.message}`;
    const g = groups.get(key);
    if (g) g.violations.push(v);
    else groups.set(key, { problem: v.problem ?? v.message, violations: [v] });
  }
  // Causes that reach the most screens first: fixing them clears the most.
  return [...groups.values()].sort((a, b) => b.violations.length - a.violations.length);
}

const ROLE_NAMES: Record<string, string> = { button: "버튼", link: "링크", tab: "탭", switch: "스위치", checkbox: "체크박스", radio: "선택 버튼", slider: "슬라이더", input: "입력칸", textarea: "입력칸", select: "선택칸" };

export interface RuleResult {
  rule: Rule;
  scope: number;
  scopeLabel: "화면" | "전이";
  violations: Violation[];
}

// Captured controls a finger presses; headings and plain text are not.
const PRESSABLE = new Set(["button", "link", "tab", "switch", "checkbox", "radio", "slider", "input", "textarea", "select"]);

export function runRule(project: Project, rule: Rule): RuleResult {
  const screens = project.screens.flatMap((s) => {
    const spec = displaySpec(s);
    return spec ? [{ s, spec }] : [];
  });
  // Screens imported from the running app have no spec tree, only the controls measured on their screenshot.
  const captured = project.screens.flatMap((s) => (!displaySpec(s) && s.baseline?.elements?.length ? [{ s, elements: s.baseline.elements }] : []));
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
        [
          ...screens.flatMap(({ s, spec }) =>
            spec.elements
              .filter((e) => e.kind === "button" && (e.height ?? 56) < min)
              .map((e) => ({ screenId: s.id, message: `${s.name}: ${e.name} 높이 ${e.height}px` })),
          ),
          ...captured.flatMap(({ s, elements }) =>
            elements
              .filter((e) => PRESSABLE.has(e.role) && Math.min(e.box.w, e.box.h) < min)
              .map((e) => ({
                screenId: s.id,
                elementKey: e.key,
                message: `${s.name}: “${e.label}” ${e.box.w}×${e.box.h}px`,
                // Same kind of control at the same size is one component, whatever its label says.
                group: `${e.role} ${e.box.w}×${e.box.h}`,
                problem: `${ROLE_NAMES[e.role] ?? e.role} ${e.box.w}×${e.box.h}px`,
                fix: `누르는 영역을 가로·세로 ${min}px 이상으로 키워 주세요 (지금 ${e.box.w}×${e.box.h}px)`,
              })),
          ),
        ],
        screens.length + captured.length,
      );
    }
    case "no-dead-end":
      return result(
        project.screens
          .filter((s) => !s.terminal && !s.exitsOutside?.length && !project.transitions.some((t) => t.from === s.id))
          .map((s) => ({ screenId: s.id, message: `${s.name}: 나가는 전이 없음` })),
        project.screens.length,
      );
    case "token-colors": {
      const withVariant = project.screens.flatMap((s) => (s.variant ? [{ s, spec: s.variant.spec }] : []));
      const colorTokens = project.tokens.filter((t) => t.kind === "color");
      const names = new Set(colorTokens.map((t) => t.name));
      const values = new Set(colorTokens.filter((t) => isHex(t.value)).map((t) => t.value.toUpperCase()));
      const measured = values.size ? captured : [];
      return result(
        [
          ...withVariant.flatMap(({ s, spec }) =>
            spec.elements.flatMap((e) =>
              [e.fill, e.stroke]
                .filter((v): v is string => !!v && (isHex(v) || !names.has(v)))
                .map((v) => ({ screenId: s.id, message: `${s.name}: ${e.name} 색 ${v}` })),
            ),
          ),
          // One line per off-token color on a screen, naming where it shows up first.
          ...measured.flatMap(({ s, elements }) => {
            const off = new Map<string, CapturedElement[]>();
            for (const e of elements)
              for (const c of [e.color, e.background]) if (c && !values.has(c.toUpperCase())) off.set(c, [...(off.get(c) ?? []), e]);
            return [...off].map(([c, uses]) => ({
              screenId: s.id,
              elementKey: uses[0].key,
              message: `${s.name}: 토큰에 없는 색 ${c} (“${uses[0].label}”${uses.length > 1 ? ` 외 ${uses.length - 1}곳` : ""})`,
              group: `color ${c.toUpperCase()}`,
              problem: `색 ${c.toUpperCase()}`,
              fix: `색 ${c.toUpperCase()}를 디자인 토큰 색으로 바꿔 주세요${uses.length > 1 ? ` (이 화면 ${uses.length}곳)` : ""}`,
              color: c,
            }));
          }),
        ],
        withVariant.length + measured.length,
      );
    }
    case "type-scale": {
      const scale = new Set(project.tokens.filter((t) => t.kind === "type").map((t) => typeKey(t.value)));
      const measured = scale.size ? captured : [];
      return result(
        measured.flatMap(({ s, elements }) => {
          const off = new Map<string, CapturedElement[]>();
          for (const e of elements) {
            if (!e.font) continue;
            const k = `${e.font.size} / ${e.font.weight}`;
            if (!scale.has(k)) off.set(k, [...(off.get(k) ?? []), e]);
          }
          return [...off].map(([k, uses]) => ({
            screenId: s.id,
            elementKey: uses[0].key,
            message: `${s.name}: 토큰에 없는 글자 ${k} (“${uses[0].label}”${uses.length > 1 ? ` 외 ${uses.length - 1}곳` : ""})`,
            group: `type ${k}`,
            problem: `글자 ${k.replace(" / ", "px · 굵기 ")}`,
            fix: `글자 크기·굵기 ${k}를 타이포그래피 토큰으로 맞춰 주세요${uses.length > 1 ? ` (이 화면 ${uses.length}곳)` : ""}`,
          }));
        }),
        measured.length,
      );
    }
    case "consistent-buttons": {
      const styled = (e: CapturedElement) => e.role === "button" && !!(e.background || e.color);
      const toggles = new Set(captured.flatMap(({ elements }) => pickableLabels(elements.filter(styled))));
      const looks = new Map<string, { s: Screen; key: string; look: string }[]>();
      for (const { s, elements } of captured)
        for (const e of elements)
          if (styled(e) && !toggles.has(e.label)) looks.set(e.label, [...(looks.get(e.label) ?? []), { s, key: e.key, look: lookOf(e) }]);
      return result(
        [...looks].flatMap(([label, uses]) => {
          const counts = new Map<string, number>();
          for (const u of uses) counts.set(u.look, (counts.get(u.look) ?? 0) + 1);
          if (counts.size < 2) return [];
          // The look most screens use is the reference; the others are flagged once per screen.
          const usual = [...counts].sort((a, b) => b[1] - a[1])[0][0];
          const odd = new Map(uses.filter((u) => u.look !== usual).map((u) => [u.s.id, u]));
          return [...odd.values()].map(({ s, key, look }) => ({
            screenId: s.id,
            elementKey: key,
            message: `${s.name}: “${label}” 버튼 ${look}, 다른 곳은 ${usual}`,
            group: `button ${label} ${look}`,
            problem: `${look} (대부분 ${usual})`,
            fix: `다른 화면의 같은 버튼처럼 ${usual}로 맞춰 주세요`,
          }));
        }),
        captured.length,
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

/** "18 / 400", "18/400" and "18" all mean size 18 at weight 400. */
const typeKey = (value: string) => {
  const [size, weight = "400"] = value.split("/").map((v) => v.trim());
  return `${Number(size)} / ${Number(weight)}`;
};

const lookOf = (e: CapturedElement) => `배경 ${e.background ?? "없음"} · 글자 ${e.color ?? "없음"}`;

/**
 * Labels of chips and toggles: three or more narrow, same-height buttons close together (a row, or rows that wrap)
 * in two or more looks on one screen. Their color shows what is picked, so a different color elsewhere is not a
 * mistake. Wide buttons and pairs such as save and cancel are left in, as their looks are meant to stay fixed.
 */
function pickableLabels(buttons: CapturedElement[]): string[] {
  const sorted = buttons.filter((e) => e.box.w < 200).sort((a, b) => a.box.h - b.box.h || a.box.y - b.box.y);
  const out: string[] = [];
  let group: CapturedElement[] = [];
  const flush = () => {
    if (group.length >= 3 && new Set(group.map(lookOf)).size > 1) out.push(...group.map((e) => e.label));
    group = [];
  };
  for (const e of sorted) {
    const last = group.at(-1);
    if (last && (Math.abs(e.box.h - last.box.h) > 2 || e.box.y - last.box.y > e.box.h + 16)) flush();
    group.push(e);
  }
  flush();
  return out;
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
  for (const r of results)
    for (const g of groupViolations(r.violations)) {
      const screens = new Set(g.violations.map((v) => v.screenId));
      if (screens.size >= SHARED_SCREENS) continue;
      for (const v of g.violations) if (v.screenId) push(v.screenId, `규칙 위반: ${v.message}`);
    }

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
