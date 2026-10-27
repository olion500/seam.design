import type { Point, Project, Screen, Transition, TransitionRoute } from "./types";

/** Room around an area's screens: its name sits in the top band. Auto-arrange leaves the same room. */
export const AREA_PAD = { top: 40, side: 24 };

// "/beans", "/bean/[id]" and "/bean-edit" all belong to "bean"; "/" and its states stay together.
const routeKey = (route: string) => {
  const first = route.split("/").find(Boolean);
  return first ? first.split("-")[0].replace(/s$/, "") : "/";
};

/**
 * The feature area of each screen that has one: the name set in the inspector, or else screens whose routes share a
 * first segment, named after the screen with the shortest route. An automatic area needs at least two screens.
 */
export function screenAreas(screens: Screen[]): Map<string, string> {
  const groups = new Map<string, Screen[]>();
  for (const s of screens) if (!s.area && s.route) groups.set(routeKey(s.route), [...(groups.get(routeKey(s.route)) ?? []), s]);
  const areas = new Map<string, string>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const lead = [...group].sort((a, b) => (a.route?.length ?? 0) - (b.route?.length ?? 0))[0];
    const name = lead.name.split(" · ")[0].trim();
    for (const s of group) areas.set(s.id, name);
  }
  for (const s of screens) if (s.area) areas.set(s.id, s.area);
  return areas;
}

/** A screen outside the page that a line leaves for (`out`) or comes from (`in`), drawn as a small marker. */
export interface Exit {
  id: string;
  screenId: string;
  dir: "in" | "out";
}

/** What one flow page shows: all screens, or one area's screens plus markers for lines crossing its edge. */
export interface FlowPage {
  screens: Screen[];
  exits: Exit[];
  /** Lines on the page, with ends outside the area pointing at their exit marker. */
  transitions: Transition[];
  positions: Record<string, Point>;
  routes: Record<string, TransitionRoute | undefined>;
}

export const exitScreenId = (nodeId: string) => nodeId.replace(/^(in|out):/, "");

export function flowPage(project: Project, area: string | null): FlowPage {
  if (!area) {
    return {
      screens: project.screens,
      exits: [],
      transitions: project.transitions,
      positions: Object.fromEntries(project.screens.map((s) => [s.id, s.position])),
      routes: Object.fromEntries(project.transitions.map((t) => [t.id, t.route])),
    };
  }
  const areaOf = screenAreas(project.screens);
  const screens = project.screens.filter((s) => areaOf.get(s.id) === area);
  const inside = new Set(screens.map((s) => s.id));
  const exits = new Map<string, Exit>();
  const transitions: Transition[] = [];
  const near = new Map<string, string>();
  for (const t of project.transitions) {
    const from = inside.has(t.from);
    const to = inside.has(t.to);
    if (from && to) transitions.push(t);
    if (from === to) continue;
    const exit: Exit = from ? { id: `out:${t.to}`, screenId: t.to, dir: "out" } : { id: `in:${t.from}`, screenId: t.from, dir: "in" };
    exits.set(exit.id, exit);
    near.set(exit.id, from ? t.from : t.to);
    transitions.push(from ? { ...t, to: exit.id } : { ...t, from: exit.id });
  }
  // The page keeps its own layout; anything not placed there yet starts beside where it sits on the full flow.
  const layout = project.areaLayouts?.[area];
  const positions: Record<string, Point> = {};
  for (const s of screens) positions[s.id] = layout?.positions[s.id] ?? s.position;
  for (const e of exits.values()) {
    const anchor = positions[near.get(e.id) ?? ""] ?? { x: 0, y: 0 };
    positions[e.id] = layout?.positions[e.id] ?? { x: anchor.x + (e.dir === "out" ? 220 : -220), y: anchor.y };
  }
  return { screens, exits: [...exits.values()], transitions, positions, routes: layout?.routes ?? {} };
}
