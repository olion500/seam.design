import { describe, expect, it } from "vitest";
import { ease, effectiveMotion, frameStyles } from "@/lib/transition";
import { diffSpecs, screenChanges } from "./diff";
import { parseProject, toJSON, toMarkdown } from "./exportSpec";
import { collectWarnings, runRules } from "./rules";
import { seedProject } from "./seed";

const byCheck = (p = seedProject()) => Object.fromEntries(runRules(p).map((r) => [r.rule.check, r]));

describe("diff", () => {
  it("reports the three seeded changes on the payment variant", () => {
    const payment = seedProject().screens.find((s) => s.id === "payment")!;
    expect(screenChanges(payment).map((c) => c.id)).toEqual(["layout:gap", "edit:card", "edit:cta"]);
  });

  it("detects added and removed elements", () => {
    const base = { align: "stretch" as const, gap: "space-sm", elements: [{ id: "a", kind: "text" as const, name: "A" }] };
    const next = { ...base, elements: [{ id: "b", kind: "text" as const, name: "B" }] };
    expect(diffSpecs(base, next).map((c) => c.id)).toEqual(["add:b", "remove:a"]);
  });
});

describe("rules", () => {
  it("flags the seeded touch-target and dead-end violations only", () => {
    const r = byCheck();
    expect(r["touch-target"].violations.map((v) => v.screenId)).toEqual(["fail"]);
    expect(r["no-dead-end"].violations.map((v) => v.screenId)).toEqual(["login"]);
    expect(r["single-primary"].violations).toHaveLength(0);
    expect(r["token-colors"].violations).toHaveLength(0);
    expect(r["reduced-motion"].violations).toHaveLength(0);
  });

  it("flags raw hex colors in a variant", () => {
    const p = seedProject();
    p.screens.find((s) => s.id === "payment")!.variant!.spec.elements[1].stroke = "#FF0000";
    expect(byCheck(p)["token-colors"].violations).toHaveLength(1);
  });

  it("flags moving presets without a reduced-motion fallback", () => {
    const p = seedProject();
    p.motions.find((m) => m.id === "push")!.reduced = null;
    expect(byCheck(p)["reduced-motion"].violations.length).toBe(p.transitions.filter((t) => t.motionId === "push").length);
  });

  it("returns no violations for a disabled rule", () => {
    const p = seedProject();
    p.rules.forEach((r) => (r.enabled = false));
    expect(runRules(p).every((r) => r.violations.length === 0)).toBe(true);
  });

  it("marks transitions whose source element is gone as broken", () => {
    const p = seedProject();
    p.transitions[0].sourceElementId = "missing";
    const w = collectWarnings(p, runRules(p));
    expect([...w.brokenTransitions]).toEqual([p.transitions[0].id]);
    expect(w.byScreen.get("cart")?.some((m) => m.startsWith("끊어진 연결"))).toBe(true);
  });
});

describe("export", () => {
  it("round-trips JSON and rejects non-project JSON", () => {
    const p = seedProject();
    expect(parseProject(toJSON(p))).toEqual(p);
    expect(() => parseProject('{"a":1}')).toThrow();
  });

  it("writes every screen and transition into the markdown spec", () => {
    const p = seedProject();
    const md = toMarkdown(p);
    for (const s of p.screens) expect(md).toContain(`### ${s.name}`);
    expect(md.match(/^\| (장바구니|배송 정보|결제 수단|쿠폰 적용|결제 실패) \|/gm)).toHaveLength(p.transitions.length);
  });
});

describe("transition frames", () => {
  it("eases from 0 to 1", () => {
    expect(ease("standard-decel", 0)).toBe(0);
    expect(ease("standard-decel", 1)).toBe(1);
    expect(ease("standard-decel", 0.5)).toBeGreaterThan(0.5);
  });

  it("pushes the outgoing screen fully off to the left at the end", () => {
    const push = seedProject().motions.find((m) => m.id === "push")!;
    expect(frameStyles(effectiveMotion(push, false), 1).from.transform).toBe("translate(-100%, 0%)");
  });

  it("uses the reduced-motion fallback when asked", () => {
    const push = seedProject().motions.find((m) => m.id === "push")!;
    expect(effectiveMotion(push, true)).toMatchObject({ kind: "fade", durationMs: 120 });
  });
});
