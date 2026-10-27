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

  it("flags each color off the token palette once per screen, naming where it shows up", () => {
    const project = {
      ...emptyProject(),
      tokens: [
        { name: "primary", kind: "color" as const, value: "#657852" },
        { name: "ink", kind: "color" as const, value: "#343c2e" },
      ],
      screens: [
        captured("HOME", [
          el("button", "저장", 120, 48, { background: "#657852", color: "#FFFFFF" }),
          el("text", "제목", 100, 20, { color: "#343C2E" }),
          el("link", "더 보기", 60, 48, { color: "#FFFFFF" }),
        ]),
      ],
    };
    expect(messages(project, rule("token-colors"))).toEqual(["HOME: 토큰에 없는 색 #FFFFFF (“저장” 외 1곳)"]);
    expect(messages({ ...project, tokens: [] }, rule("token-colors"))).toEqual([]);
  });

  it("flags a button that looks different from the same button on most screens", () => {
    const save = (look: Partial<CapturedElement>) => el("button", "저장", 120, 48, look);
    const project = {
      ...emptyProject(),
      screens: [
        captured("A", [save({ background: "#657852", color: "#FFFFFF" })]),
        captured("B", [save({ background: "#657852", color: "#FFFFFF" })]),
        captured("C", [save({ background: "#C0392B", color: "#FFFFFF" }), el("button", "취소", 120, 48, { color: "#343C2E" })]),
      ],
    };
    expect(messages(project, rule("consistent-buttons"))).toEqual(["C: “저장” 버튼 배경 #C0392B · 글자 #FFFFFF, 다른 곳은 배경 #657852 · 글자 #FFFFFF"]);
  });

  it("leaves out chips whose color shows what is picked", () => {
    const chip = (label: string, x: number, y: number, picked: boolean) => ({
      ...el("button", label, 80, 36, { background: picked ? "#E9EDDF" : "#FFFDF6" }),
      box: { x, y, w: 80, h: 36 },
    });
    const project = {
      ...emptyProject(),
      screens: [
        captured("NEW", [chip("산뜻해요", 0, 400, false), chip("향긋해요", 90, 400, false), chip("쌉쌀해요", 0, 444, false)]),
        captured("EDIT", [chip("산뜻해요", 0, 400, true), chip("향긋해요", 90, 400, true), chip("쌉쌀해요", 0, 444, false)]),
      ],
    };
    expect(messages(project, rule("consistent-buttons"))).toEqual([]);
  });
});
