import { describe, expect, it } from "vitest";
import { runRule } from "./rules";
import { emptyProject } from "./seed";
import type { CapturedElement, Project, Rule, Screen } from "./types";

const el = (role: string, label: string, w: number, h: number, style: Partial<CapturedElement> = {}): CapturedElement => ({
  key: `${role}:${label}`,
  role,
  label,
  box: { x: 0, y: 0, w, h },
  ...style,
});

const captured = (id: string, elements: CapturedElement[]): Screen => ({
  id,
  name: id,
  position: { x: 0, y: 0 },
  size: { w: 402, h: 874 },
  baseline: { image: `screens/${id}.png`, elements },
  variant: null,
  states: [],
  sources: [],
});

const rule = (check: Rule["check"], params?: Rule["params"]): Rule => ({ id: "r", check, category: "", title: "", description: "", enabled: true, params });
const messages = (project: Project, r: Rule) => runRule(project, r).violations.map((v) => v.message);

describe("rules on screens captured from the app", () => {
  it("flags pressable controls smaller than the touch size, not text or headings", () => {
    const project = {
      ...emptyProject(),
      screens: [captured("HOME", [el("button", "저장", 120, 48), el("link", "더 보기", 60, 20), el("tab", "홈", 40, 56), el("text", "작은 글", 30, 12)])],
    };
    expect(messages(project, rule("touch-target", { minSize: 44 }))).toEqual(["HOME: “더 보기” 60×20px", "HOME: “홈” 40×56px"]);
    expect(runRule(project, rule("touch-target")).scope).toBe(1);
  });
});
