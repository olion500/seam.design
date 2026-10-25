import Dexie, { type EntityTable } from "dexie";
import type { Project } from "@/model/types";
import { useEditor } from "./store";

interface StoredProject {
  id: string;
  data: Project;
  updatedAt: number;
}

const db = new Dexie("seam-design") as Dexie & { projects: EntityTable<StoredProject, "id"> };
db.version(1).stores({ projects: "id, updatedAt" });

export async function loadLatest(): Promise<Project | undefined> {
  return (await db.projects.orderBy("updatedAt").last())?.data;
}

export async function saveProject(project: Project) {
  await db.projects.put({ id: project.id, data: project, updatedAt: Date.now() });
  useEditor.getState().markSaved(project);
}

export async function startPersistence() {
  const stored = await loadLatest();
  const editor = useEditor.getState();
  if (stored) editor.loadProject(stored);
  else editor.markSaved(editor.project);
  useEditor.temporal.getState().clear();

  let timer: ReturnType<typeof setTimeout> | undefined;
  useEditor.subscribe((state, prev) => {
    if (state.project === prev.project || state.project === state.savedProject) return;
    clearTimeout(timer);
    timer = setTimeout(() => void saveProject(useEditor.getState().project), 1200);
  });
}
