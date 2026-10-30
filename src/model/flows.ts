import type { Project, Screen } from "./types";

/** A move the running app makes (found by `seam explore`), with every control that makes it. */
export interface AppEdge {
  from: string;
  to: string;
  labels: string[];
  elementKey?: string;
}

const pair = (from: string, to: string) => `${from}>${to}`;

/** Names of back and close controls, and of documented moves that return to the screen before. */
export const BACK_LABEL = /(^|,\s*)back$|뒤로|닫기|취소/i;

/** Moves seen in the app between screens of the project, one per pair of screens. */
export function appEdges(project: Project): AppEdge[] {
  const ids = new Set(project.screens.map((s) => s.id));
  const edges = new Map<string, AppEdge>();
  for (const s of project.screens)
    for (const l of s.appLinks ?? []) {
      if (l.back || !ids.has(l.to) || l.to === s.id) continue;
      const key = pair(s.id, l.to);
      const e = edges.get(key);
      if (e) {
        if (!e.labels.includes(l.label)) e.labels.push(l.label);
      } else edges.set(key, { from: s.id, to: l.to, labels: [l.label], elementKey: l.elementKey });
    }
  return [...edges.values()];
}

/** App moves the flow document (the project's transitions) does not have. */
export function undocumented(project: Project): AppEdge[] {
  const documented = new Set(project.transitions.map((t) => pair(t.from, t.to)));
  return appEdges(project).filter((e) => !documented.has(pair(e.from, e.to)));
}

/**
 * Documented moves out of a screen whose controls were all pressed (`exploredAt`) that no control made. They may still
 * happen after typing or swiping, so they are worth a look rather than certainly wrong.
 */
export function unconfirmed(project: Project) {
  const app = new Set(appEdges(project).map((e) => pair(e.from, e.to)));
  const back = backScreens(project);
  const explored = new Set(project.screens.filter((s) => s.exploredAt).map((s) => s.id));
  // States have no URL of their own, so pressing cannot show a move into one.
  const addressed = new Set(project.screens.filter((s) => s.live?.url).map((s) => s.id));
  return project.transitions.filter(
    (t) => explored.has(t.from) && addressed.has(t.to) && !app.has(pair(t.from, t.to)) && !(back.has(t.from) && BACK_LABEL.test(t.label)),
  );
}

const backScreens = (project: Project) => new Set(project.screens.filter((s) => s.appLinks?.some((l) => l.back)).map((s) => s.id));

/** Where a person starts: the screen at `/`, else the first one. */
export function startScreen(project: Project): Screen | undefined {
  return project.screens.find((s) => s.route === "/") ?? project.screens[0];
}

/** Every way to move on, documented or seen in the app. */
export function flowGraph(project: Project): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>(project.screens.map((s) => [s.id, new Set<string>()]));
  for (const t of project.transitions) out.get(t.from)?.add(t.to);
  for (const e of appEdges(project)) out.get(e.from)?.add(e.to);
  // A back control returns along every move that leads into its screen.
  const back = backScreens(project);
  for (const [from, tos] of [...out].map(([k, v]) => [k, [...v]] as const)) for (const to of tos) if (back.has(to)) out.get(to)?.add(from);
  return out;
}

/** Fewest moves from `start` to each screen it reaches. */
export function distances(graph: Map<string, Set<string>>, start: string): Map<string, number> {
  const d = new Map([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const at = queue.shift() as string;
    for (const next of graph.get(at) ?? [])
      if (!d.has(next)) {
        d.set(next, (d.get(at) ?? 0) + 1);
        queue.push(next);
      }
  }
  return d;
}

export function reversed(graph: Map<string, Set<string>>): Map<string, Set<string>> {
  const back = new Map<string, Set<string>>([...graph.keys()].map((k) => [k, new Set<string>()]));
  for (const [from, tos] of graph) for (const to of tos) back.get(to)?.add(from);
  return back;
}
