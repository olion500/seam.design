import { create } from "zustand";
import { current } from "immer";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import { defaultSpec, emptyProject, seedProject } from "@/model/seed";
import type { ChangeRequest, MotionPreset, Project, Rule, Screen, ScreenElement, Selection, SourceMapping, Transition, View } from "@/model/types";

const newId = () => crypto.randomUUID().slice(0, 8);
const today = () => new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

export interface EditorState {
  project: Project;
  savedProject: Project | null;
  view: View;
  selection: Selection | null;
  compareIds: string[];
  focusChange: string | null;

  setView: (view: View) => void;
  select: (selection: Selection | null) => void;
  toggleCompare: (screenId: string) => void;
  clearCompare: () => void;
  setFocusChange: (id: string | null) => void;

  loadProject: (project: Project, saved?: boolean) => void;
  newProject: () => void;
  loadExample: () => void;
  markSaved: (project: Project) => void;
  renameProject: (name: string) => void;

  addScreen: (input?: { name?: string; image?: string; url?: string; position?: { x: number; y: number } }) => string;
  updateScreen: (id: string, patch: Partial<Pick<Screen, "name" | "terminal" | "states" | "position">>) => void;
  moveScreen: (id: string, position: { x: number; y: number }) => void;
  setBaselineImage: (id: string, image: string, url?: string) => void;
  setLiveUrl: (id: string, url: string | undefined) => void;
  createVariant: (id: string) => void;
  discardVariant: (id: string) => void;
  updateVariantElement: (screenId: string, elementId: string, patch: Partial<ScreenElement>) => void;
  setVariantGap: (screenId: string, gap: string) => void;
  setSources: (screenId: string, sources: SourceMapping[]) => void;
  removeScreen: (id: string) => void;
  addRequest: (screenId: string, request: Omit<ChangeRequest, "id">) => void;
  removeRequest: (screenId: string, requestId: string) => void;

  addTransition: (t: Pick<Transition, "from" | "to"> & Partial<Transition>) => string;
  updateTransition: (id: string, patch: Partial<Transition>) => void;
  removeTransition: (id: string) => void;

  updateToken: (name: string, value: string) => void;
  updateMotion: (id: string, patch: Partial<MotionPreset>) => void;
  updateRule: (id: string, patch: Partial<Rule>) => void;
  addRule: (rule: Omit<Rule, "id">) => void;
}

export const useEditor = create<EditorState>()(
  temporal(
    immer((set, get) => ({
      project: seedProject(),
      savedProject: null,
      view: "flow",
      selection: null,
      compareIds: [],
      focusChange: null,

      setView: (view) => set({ view, selection: null }),
      select: (selection) => set({ selection, focusChange: null }),
      toggleCompare: (screenId) =>
        set((s) => {
          s.compareIds = s.compareIds.includes(screenId) ? s.compareIds.filter((id) => id !== screenId) : [...s.compareIds, screenId];
        }),
      clearCompare: () => set({ compareIds: [] }),
      setFocusChange: (focusChange) => set({ focusChange }),

      loadProject: (project, saved = true) =>
        set({ project, savedProject: saved ? project : null, selection: null, compareIds: [], focusChange: null }),
      newProject: () => get().loadProject(emptyProject(), false),
      loadExample: () => get().loadProject(seedProject(), false),
      markSaved: (project) => set({ savedProject: project }),
      renameProject: (name) =>
        set((s) => {
          s.project.name = name;
        }),

      addScreen: (input = {}) => {
        const id = newId();
        set((s) => {
          const n = s.project.screens.length;
          const name = input.name ?? `화면 ${n + 1}`;
          s.project.screens.push({
            id,
            name,
            position: input.position ?? { x: (n % 4) * 240, y: Math.floor(n / 4) * 420 },
            size: { w: 390, h: 844 },
            baseline: input.image
              ? { image: input.image, url: input.url, capturedAt: `${today()} ${input.url ? "캡처" : "스크린샷"}` }
              : { spec: defaultSpec(name), capturedAt: "직접 작성" },
            variant: null,
            states: ["기본"],
            sources: [],
          });
          s.selection = { kind: "screen", id };
        });
        return id;
      },
      updateScreen: (id, patch) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === id);
          if (screen) Object.assign(screen, patch);
        }),
      moveScreen: (id, position) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === id);
          if (screen) screen.position = position;
        }),
      setBaselineImage: (id, image, url) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === id);
          if (screen) screen.baseline = { ...screen.baseline, image, url, capturedAt: `${today()} ${url ? "캡처" : "스크린샷"}` };
        }),
      setLiveUrl: (id, url) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === id);
          if (screen) screen.live = url ? { url } : undefined;
        }),
      createVariant: (id) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === id);
          if (!screen || screen.variant) return;
          const spec = screen.baseline?.spec ? structuredClone(current(screen.baseline.spec)) : defaultSpec(screen.name);
          if (!screen.baseline?.spec) screen.baseline = { ...screen.baseline, spec: structuredClone(spec) };
          screen.variant = { version: 1, updatedAt: today(), spec };
        }),
      discardVariant: (id) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === id);
          if (screen) screen.variant = null;
        }),
      updateVariantElement: (screenId, elementId, patch) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === screenId);
          const el = screen?.variant?.spec.elements.find((e) => e.id === elementId);
          if (!screen?.variant || !el) return;
          Object.assign(el, patch);
          screen.variant.updatedAt = today();
        }),
      setVariantGap: (screenId, gap) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === screenId);
          if (screen?.variant) screen.variant.spec.gap = gap;
        }),
      setSources: (screenId, sources) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === screenId);
          if (screen) screen.sources = sources;
        }),
      removeScreen: (id) =>
        set((s) => {
          s.project.screens = s.project.screens.filter((x) => x.id !== id);
          s.project.transitions = s.project.transitions.filter((t) => t.from !== id && t.to !== id);
          s.compareIds = s.compareIds.filter((x) => x !== id);
          if (s.selection?.id === id) s.selection = null;
        }),

      addRequest: (screenId, request) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === screenId);
          if (screen) screen.requests = [...(screen.requests ?? []), { ...request, id: newId() }];
        }),
      removeRequest: (screenId, requestId) =>
        set((s) => {
          const screen = s.project.screens.find((x) => x.id === screenId);
          if (screen) screen.requests = (screen.requests ?? []).filter((r) => r.id !== requestId);
        }),

      addTransition: (t) => {
        const id = newId();
        set((s) => {
          s.project.transitions.push({
            label: "새 전이",
            trigger: "탭",
            condition: "",
            conditional: false,
            motionId: s.project.motions[0]?.id ?? "none",
            ...t,
            id,
          });
          s.selection = { kind: "transition", id };
        });
        return id;
      },
      updateTransition: (id, patch) =>
        set((s) => {
          const t = s.project.transitions.find((x) => x.id === id);
          if (t) Object.assign(t, patch);
        }),
      removeTransition: (id) =>
        set((s) => {
          s.project.transitions = s.project.transitions.filter((t) => t.id !== id);
          if (s.selection?.id === id) s.selection = null;
        }),

      updateToken: (name, value) =>
        set((s) => {
          const t = s.project.tokens.find((x) => x.name === name);
          if (t) t.value = value;
        }),
      updateMotion: (id, patch) =>
        set((s) => {
          const m = s.project.motions.find((x) => x.id === id);
          if (m) Object.assign(m, patch);
        }),
      updateRule: (id, patch) =>
        set((s) => {
          const r = s.project.rules.find((x) => x.id === id);
          if (r) Object.assign(r, patch);
        }),
      addRule: (rule) =>
        set((s) => {
          s.project.rules.push({ ...rule, id: newId() });
        }),
    })),
    {
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
      limit: 100,
    },
  ),
);

export const isDirty = (s: EditorState) => s.project !== s.savedProject;
export const undo = () => useEditor.temporal.getState().undo();
export const redo = () => useEditor.temporal.getState().redo();
