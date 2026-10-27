import { beforeEach, describe, expect, it } from "vitest";
import { screenChanges } from "@/model/diff";
import { seedProject } from "@/model/seed";
import { isDirty, useEditor } from "./store";

const screen = (id: string) => useEditor.getState().project.screens.find((s) => s.id === id)!;

describe("editor store", () => {
  beforeEach(() => {
    useEditor.getState().loadProject(seedProject());
    useEditor.temporal.getState().clear();
  });

  it("creates a variant from the baseline and records element edits as changes", () => {
    const { createVariant, updateVariantElement } = useEditor.getState();
    createVariant("cart");
    expect(screenChanges(screen("cart"))).toEqual([]);
    updateVariantElement("cart", "cta", { label: "구매하기" });
    expect(screenChanges(screen("cart")).map((c) => c.id)).toEqual(["edit:cta"]);
    expect(screen("cart").baseline!.spec!.elements.find((e) => e.id === "cta")!.label).toBe("주문하기");
  });

  it("arranges screens and routes in one undo step, dropping routes the layout did not produce", () => {
    const { project, arrange, updateTransition } = useEditor.getState();
    const [t0, t1] = project.transitions;
    updateTransition(t1.id, { route: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], from: { x: 0, y: 0 }, to: { x: 1, y: 1 } } });
    useEditor.temporal.getState().clear();
    const before = screen("cart").position;
    const route = { points: [{ x: 5, y: 5 }, { x: 5, y: 50 }], from: { x: 0, y: 0 }, to: { x: 0, y: 400 } };
    arrange({ cart: { x: 0, y: 0 } }, { [t0.id]: route });
    const after = useEditor.getState().project;
    expect(after.screens.find((s) => s.id === "cart")!.position).toEqual({ x: 0, y: 0 });
    expect(after.transitions.find((t) => t.id === t0.id)!.route).toEqual(route);
    expect(after.transitions.find((t) => t.id === t1.id)!.route).toBeUndefined();
    useEditor.temporal.getState().undo();
    expect(screen("cart").position).toEqual(before);
    expect(useEditor.getState().project.transitions.find((t) => t.id === t1.id)!.route).toBeDefined();
  });

  it("undoes a token edit and clears the dirty flag", () => {
    useEditor.getState().updateToken("accent", "#7272FB");
    expect(isDirty(useEditor.getState())).toBe(true);
    useEditor.temporal.getState().undo();
    expect(useEditor.getState().project.tokens.find((t) => t.name === "accent")!.value).toBe("#0085E4");
    expect(isDirty(useEditor.getState())).toBe(false);
  });

  it("resizes drawn screens to the chosen device but leaves captured screenshots for recapture", () => {
    const { addScreen, setDevice } = useEditor.getState();
    const shotId = addScreen({ name: "캡처", image: "screens/x.png" });
    setDevice("galaxy");
    expect(useEditor.getState().project.device).toBe("galaxy");
    expect(screen("cart").size).toEqual({ w: 360, h: 780 });
    expect(screen(shotId).size).toEqual({ w: 402, h: 874 });
  });

  it("removes a screen together with its transitions", () => {
    useEditor.getState().removeScreen("payment");
    const { transitions } = useEditor.getState().project;
    expect(transitions.some((t) => t.from === "payment" || t.to === "payment")).toBe(false);
  });
});
