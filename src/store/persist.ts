import Dexie, { type EntityTable } from "dexie";
import { create } from "zustand";
import { api } from "@/lib/api";
import type { Project } from "@/model/types";
import { useEditor } from "./store";

interface StoredProject {
  id: string;
  data: Project;
  updatedAt: number;
}

const db = new Dexie("seam-design") as Dexie & { projects: EntityTable<StoredProject, "id"> };
db.version(1).stores({ projects: "id, updatedAt" });

export type SyncStatus = "idle" | "saving" | "server" | "repo" | "local-only";

export const useSync = create<{ status: SyncStatus; notice: string | null; repo: string | null }>(() => ({ status: "idle", notice: null, repo: null }));

export async function loadLatest(): Promise<Project | undefined> {
  return (await db.projects.orderBy("updatedAt").last())?.data;
}

export async function saveProject(project: Project) {
  useSync.setState({ status: "saving" });
  await db.projects.put({ id: project.id, data: project, updatedAt: Date.now() });
  useEditor.getState().markSaved(project);
  try {
    if (useSync.getState().repo && project.source) {
      await api.putRepoProject(project);
      useSync.setState({ status: "repo" });
      return;
    }
    await api.putProject(project);
    useSync.setState({ status: "server" });
  } catch {
    useSync.setState({ status: "local-only" });
  }
}

const SHARE_HASH = /^#\/share\/([\w-]+)$/;

async function openSharedProject(shareId: string): Promise<Project | null> {
  try {
    const snapshot = await api.getShare(shareId);
    return { ...snapshot, id: crypto.randomUUID().slice(0, 8), name: `${snapshot.name} (공유본)` };
  } catch (e) {
    useSync.setState({ notice: `공유 링크를 열 수 없습니다: ${e instanceof Error ? e.message : String(e)}` });
    return null;
  }
}

export async function startPersistence() {
  const editor = useEditor.getState();
  const shareId = SHARE_HASH.exec(location.hash)?.[1];
  const shared = shareId ? await openSharedProject(shareId) : null;
  if (shareId) history.replaceState(null, "", "#/flow");

  const repo = shared ? null : await api.repo().catch(() => null);
  const repoProject = repo?.hasProject ? await api.getRepoProject().catch(() => null) : null;
  if (repo) useSync.setState({ repo: repo.root });

  if (repoProject) {
    editor.loadProject(repoProject);
    useSync.setState({ status: "repo", notice: `${repo?.root}의 .seam/을 열었습니다. 고친 내용은 그 레포에 저장됩니다.` });
  } else if (shared) {
    editor.loadProject(shared, false);
    useSync.setState({ notice: "공유받은 명세의 사본을 열었습니다. 고쳐도 원본은 바뀌지 않습니다." });
  } else {
    const stored = await loadLatest();
    if (stored) editor.loadProject(stored);
    else editor.markSaved(editor.project);
  }
  useEditor.temporal.getState().clear();

  let timer: ReturnType<typeof setTimeout> | undefined;
  useEditor.subscribe((state, prev) => {
    if (state.project === prev.project || state.project === state.savedProject) return;
    clearTimeout(timer);
    timer = setTimeout(() => void saveProject(useEditor.getState().project), 1200);
  });
  if (shared) void saveProject(shared);
}
