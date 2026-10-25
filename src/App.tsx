import { lazy, Suspense, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopBar } from "@/components/TopBar";
import { Inspector } from "@/components/inspector/Inspector";
import type { View } from "@/model/types";
import { saveProject } from "@/store/persist";
import { redo, undo, useEditor } from "@/store/store";
import { FlowView } from "@/views/flow/FlowView";

const SystemView = lazy(() => import("@/views/SystemView").then((m) => ({ default: m.SystemView })));
const RulesView = lazy(() => import("@/views/RulesView").then((m) => ({ default: m.RulesView })));
const MotionView = lazy(() => import("@/views/MotionView").then((m) => ({ default: m.MotionView })));

const VIEWS: View[] = ["flow", "system", "rules", "motion"];
const viewFromHash = (): View => {
  const v = location.hash.replace("#/", "") as View;
  return VIEWS.includes(v) ? v : "flow";
};

function useHashView() {
  useEffect(() => {
    const sync = () => {
      const v = viewFromHash();
      if (useEditor.getState().view !== v) useEditor.getState().setView(v);
    };
    sync();
    window.addEventListener("hashchange", sync);
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.view !== prev.view && viewFromHash() !== s.view) location.hash = `#/${s.view}`;
    });
    return () => {
      window.removeEventListener("hashchange", sync);
      unsub();
    };
  }, []);
}

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveProject(useEditor.getState().project);
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        const { selection, removeScreen, removeTransition, view } = useEditor.getState();
        if (view !== "flow") return;
        if (selection?.kind === "screen") removeScreen(selection.id);
        if (selection?.kind === "transition") removeTransition(selection.id);
      } else if (e.key === "Escape") {
        useEditor.getState().select(null);
        useEditor.getState().clearCompare();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

export function App() {
  const view = useEditor((s) => s.view);
  useHashView();
  useShortcuts();
  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        <TopBar />
        <div className="relative flex min-h-0 flex-1">
          {view === "flow" && <FlowView />}
          <Suspense fallback={<div className="flex-1 bg-muted" />}>
            {view === "system" && <SystemView />}
            {view === "rules" && <RulesView />}
            {view === "motion" && <MotionView />}
          </Suspense>
          <Inspector />
        </div>
      </div>
    </TooltipProvider>
  );
}
