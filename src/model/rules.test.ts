import { describe, expect, it } from "vitest";
import { collectWarnings, fixRequests, groupViolations, runRule, runRules } from "./rules";
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

  it("flags text sizes and weights off the type tokens once per screen", () => {
    const text = (label: string, size: number, weight = 400) => el("text", label, 100, 20, { font: { size, weight } });
    const project = {
      ...emptyProject(),
      tokens: [
        { name: "body", kind: "type" as const, value: "18 / 400" },
        { name: "title", kind: "type" as const, value: "36/400" },
      ],
      screens: [captured("HOME", [text("본문", 18), text("제목", 36), text("작은 글", 13), text("또 작은 글", 13), text("굵은 본문", 18, 700)])],
    };
    expect(messages(project, rule("type-scale"))).toEqual(["HOME: 토큰에 없는 글자 13 / 400 (“작은 글” 외 1곳)", "HOME: 토큰에 없는 글자 18 / 700 (“굵은 본문”)"]);
    expect(messages({ ...project, tokens: [] }, rule("type-scale"))).toEqual([]);
  });

  it("counts one cause shared by many screens once, and keeps it off the screens' warning dots", () => {
    const back = (label: string) => el("button", label, 30, 30);
    const project = {
      ...emptyProject(),
      rules: [{ ...rule("touch-target", { minSize: 44 }), id: "t" }],
      screens: [
        captured("A", [back("(tabs), back")]),
        captured("B", [back("(tabs), back")]),
        captured("C", [back("한 잔 준비, back"), el("link", "더 보기", 60, 20)]),
      ],
    };
    const results = runRules(project);
    const problems = groupViolations(results[0].violations);
    expect(problems.map((p) => [p.problem, p.violations.length])).toEqual([
      ["버튼 30×30px", 3],
      ["링크 60×20px", 1],
    ]);
    expect(problems[1].violations[0].elementKey).toBe("link:더 보기");

    // One click asks for the fix on every screen the cause shows up on, and not twice.
    const todo = fixRequests(project, problems[0].violations);
    expect(todo.map((t) => [t.screenId, t.request.elementKey])).toEqual([
      ["A", "button:(tabs), back"],
      ["B", "button:(tabs), back"],
      ["C", "button:한 잔 준비, back"],
    ]);
    expect(todo[0].request.note).toBe("누르는 영역을 가로·세로 44px 이상으로 키워 주세요 (지금 30×30px)");
    project.screens[0].requests = [{ id: "r1", ...todo[0].request }];
    expect(fixRequests(project, problems[0].violations).map((t) => t.screenId)).toEqual(["B", "C"]);
    const dots = collectWarnings(project, results).byScreen;
    expect([...dots.keys()]).toEqual(["C"]);
    expect(dots.get("C")).toEqual(["규칙 위반: C: “더 보기” 60×20px"]);
  });

  it("checks the flow with moves seen in the app, and lists the ones the document lacks", () => {
    const screen = (id: string, route: string, extra: Partial<Screen> = {}): Screen => ({ ...captured(id, []), route, live: { url: `http://app${route}` }, ...extra });
    const move = (id: string, from: string, to: string, label: string) => ({ id, from, to, label, trigger: label, condition: "", conditional: false, motionId: "push" });
    const project: Project = {
      ...emptyProject(),
      screens: [
        screen("HOME", "/", { exploredAt: "확인", appLinks: [{ label: "보관함", elementKey: "tab:보관함", to: "BEANS" }, { label: "추출 준비", to: "PREP" }] }),
        screen("BEANS", "/beans", { exploredAt: "확인", appLinks: [{ label: "홈", to: "HOME" }, { label: "보관함", to: "BEANS" }] }),
        screen("PREP", "/prepare", { exploredAt: "확인", appLinks: [] }),
        screen("LOST", "/lost"),
      ],
      transitions: [move("f1", "HOME", "PREP", "추출 준비"), move("f2", "PREP", "HOME", "닫기")],
    };
    const rules = (check: Rule["check"], params?: Rule["params"]) => runRule(project, rule(check, params)).violations;
    expect(rules("flow-doc").map((v) => [v.problem, v.transition])).toEqual([
      ["문서에 없음: “보관함” → BEANS", { from: "HOME", to: "BEANS", label: "보관함" }],
      ["문서에 없음: “홈” → HOME", { from: "BEANS", to: "HOME", label: "홈" }],
      ["앱에서 못 찾음: “닫기” → HOME", undefined],
    ]);
    // BEANS is only reachable through the app's tab; LOST has no way in or out at all.
    expect(rules("reachable").map((v) => v.screenId)).toEqual(["LOST"]);
    expect(rules("way-back").map((v) => v.screenId)).toEqual(["LOST"]);
    expect(rules("flow-depth", { maxDepth: 0 }).map((v) => v.message)).toEqual(["BEANS: HOME에서 1번 이동", "PREP: HOME에서 1번 이동"]);
    expect(rules("no-dead-end").map((v) => v.screenId)).toEqual(["LOST"]);

    // Without what the app showed, the document alone leaves BEANS out of reach.
    const docOnly = { ...project, screens: project.screens.map((s) => ({ ...s, appLinks: undefined, exploredAt: undefined })) };
    expect(runRule(docOnly, rule("reachable")).violations.map((v) => v.screenId)).toEqual(["BEANS", "LOST"]);
    expect(runRule(docOnly, rule("flow-doc")).violations).toEqual([]);

    // A back control is a way back along every move in, never a move of its own to where a fresh load sent it.
    const withBack: Project = {
      ...project,
      screens: project.screens.map((s) => (s.id === "BEANS" ? { ...s, appLinks: [{ label: "(tabs), back", to: "HOME", back: true }] } : s.id === "PREP" ? { ...s, appLinks: [{ label: "닫기", to: "HOME", back: true }] } : s)),
    };
    expect(runRule(withBack, rule("flow-doc")).violations.map((v) => v.problem)).toEqual(["문서에 없음: “보관함” → BEANS"]);
    expect(runRule(withBack, rule("way-back")).violations.map((v) => v.screenId)).toEqual(["LOST"]);
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
