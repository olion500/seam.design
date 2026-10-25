import type { Screen, ScreenElement, ScreenSpec } from "./types";

export interface Change {
  id: string;
  elementId: string | null;
  summary: string;
}

const PROPS: { key: keyof ScreenElement; label: string }[] = [
  { key: "label", label: "문구" },
  { key: "variant", label: "변형" },
  { key: "fill", label: "배경" },
  { key: "stroke", label: "테두리" },
  { key: "height", label: "높이" },
  { key: "size", label: "크기" },
];

const show = (v: unknown) => (v === undefined || v === "" ? "없음" : typeof v === "string" && /[\s가-힣]/.test(v) ? `“${v}”` : String(v));

export function diffSpecs(base: ScreenSpec, next: ScreenSpec): Change[] {
  const changes: Change[] = [];
  if (base.gap !== next.gap) changes.push({ id: "layout:gap", elementId: null, summary: `목록 간격 ${base.gap} → ${next.gap}` });
  if (base.align !== next.align) changes.push({ id: "layout:align", elementId: null, summary: `정렬 ${base.align} → ${next.align}` });

  const before = new Map(base.elements.map((e) => [e.id, e]));
  const after = new Set(next.elements.map((e) => e.id));
  for (const el of next.elements) {
    const old = before.get(el.id);
    if (!old) {
      changes.push({ id: `add:${el.id}`, elementId: el.id, summary: `${el.name} 추가` });
      continue;
    }
    const parts = PROPS.filter((p) => old[p.key] !== el[p.key]).map((p) => `${p.label} ${show(old[p.key])} → ${show(el[p.key])}`);
    if (parts.length) changes.push({ id: `edit:${el.id}`, elementId: el.id, summary: `${el.name}: ${parts.join(", ")}` });
  }
  for (const old of base.elements) {
    if (!after.has(old.id)) changes.push({ id: `remove:${old.id}`, elementId: null, summary: `${old.name} 삭제` });
  }
  return changes;
}

export function screenChanges(screen: Screen): Change[] {
  const requests = (screen.requests ?? []).map((r) => {
    const el = screen.baseline?.elements?.find((e) => e.key === r.elementKey);
    const what = [r.label ? `문구 “${r.label}”` : null, r.note || null].filter(Boolean).join(" · ");
    return { id: `request:${r.id}`, elementId: r.elementKey ?? null, summary: `${el ? el.label : "화면 전체"}: ${what}` };
  });
  if (!screen.variant || !screen.baseline?.spec) return requests;
  return [...diffSpecs(screen.baseline.spec, screen.variant.spec), ...requests];
}

export function displaySpec(screen: Screen, mode: "baseline" | "variant" = "variant"): ScreenSpec | undefined {
  if (mode === "variant" && screen.variant) return screen.variant.spec;
  return screen.baseline?.spec;
}
