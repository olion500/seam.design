import { describe, expect, it } from "vitest";
import { screenAreas } from "./areas";
import type { Screen } from "./types";

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
