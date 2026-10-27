import { describe, expect, it } from "vitest";
import { flowPage, screenAreas } from "./areas";
import { emptyProject } from "./seed";
import type { Screen, Transition } from "./types";

const screen = (id: string, name: string, route?: string, area?: string): Screen => ({
  id,
  name,
  route,
  area,
  position: { x: 0, y: 0 },
  size: { w: 402, h: 874 },
  baseline: null,
  variant: null,
  states: [],
  sources: [],
});

describe("screenAreas", () => {
  it("groups screens by the first part of their route, named after the shortest route", () => {
    const areas = screenAreas([
      screen("BEAN", "원두 상세", "/bean/[id]"),
      screen("BEANS", "원두", "/beans"),
      screen("BEAN_EDIT", "원두 추가·수정", "/bean-edit"),
      screen("BREW_A", "타이머 · 준비", "/brew"),
      screen("BREW_B", "타이머 · 완료", "/brew"),
      screen("PRIVACY", "개인정보", "/privacy"),
      screen("LOOSE", "직접 만든 화면"),
    ]);
    expect(Object.fromEntries(areas)).toEqual({ BEAN: "원두", BEANS: "원두", BEAN_EDIT: "원두", BREW_A: "타이머", BREW_B: "타이머" });
  });

  it("lets a name set by hand move a screen into any area, even on its own", () => {
    const areas = screenAreas([
      screen("BEANS", "원두", "/beans"),
      screen("BEAN", "원두 상세", "/bean/[id]", "원두 관리"),
      screen("LOOSE", "직접 만든 화면", undefined, "실험"),
    ]);
    expect(Object.fromEntries(areas)).toEqual({ BEAN: "원두 관리", LOOSE: "실험" });
  });
});

describe("flowPage", () => {
  const line = (id: string, from: string, to: string): Transition => ({ id, from, to, label: id, trigger: "탭", condition: "", conditional: false, motionId: "push" });
  const project = {
    ...emptyProject(),
    screens: [screen("BEANS", "원두", "/beans"), screen("BEAN", "원두 상세", "/bean/[id]"), screen("HOME", "홈", "/"), screen("PREP", "추출 준비", "/prepare")],
    transitions: [line("a", "BEANS", "BEAN"), line("b", "BEAN", "PREP"), line("c", "HOME", "BEANS"), line("d", "HOME", "PREP")],
  };

  it("shows every screen and line on the full flow", () => {
    const page = flowPage(project, null);
    expect(page.screens).toHaveLength(4);
    expect(page.exits).toEqual([]);
    expect(page.transitions).toBe(project.transitions);
  });

  it("shows one area's screens, with lines crossing its edge ending at exit markers", () => {
    const page = flowPage(project, "원두");
    expect(page.screens.map((s) => s.id)).toEqual(["BEANS", "BEAN"]);
    expect(page.exits).toEqual([
      { id: "out:PREP", screenId: "PREP", dir: "out" },
      { id: "in:HOME", screenId: "HOME", dir: "in" },
    ]);
    expect(page.transitions.map((t) => `${t.id}:${t.from}>${t.to}`)).toEqual(["a:BEANS>BEAN", "b:BEAN>out:PREP", "c:in:HOME>BEANS"]);
    expect(Object.keys(page.positions).sort()).toEqual(["BEAN", "BEANS", "in:HOME", "out:PREP"]);
  });

  it("uses the area page's own layout where it has one", () => {
    const page = flowPage({ ...project, areaLayouts: { 원두: { positions: { BEAN: { x: 5, y: 6 } }, routes: {} } } }, "원두");
    expect(page.positions.BEAN).toEqual({ x: 5, y: 6 });
    expect(page.positions.BEANS).toEqual({ x: 0, y: 0 });
  });
});
