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
