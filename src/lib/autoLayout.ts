import ElkApi, { type ELK, type ElkNode } from "elkjs/lib/elk-api.js";
import elkWorkerUrl from "elkjs/lib/elk-worker.min.js?url";
import { AREA_PAD } from "@/model/areas";
import type { Point, TransitionRoute } from "@/model/types";

export interface LayoutNode {
  id: string;
  width: number;
  height: number;
  /** Screens of one feature area are kept together inside a box. */
  area?: string;
}

export interface LayoutEdge {
  id: string;
  from: string;
  to: string;
  /** Size of the line's label; the first transition of a line decides it. */
  label?: { text: string; width: number; height: number };
}

export interface Layout {
  positions: Record<string, Point>;
  routes: Record<string, TransitionRoute>;
  crossings: number;
}

// Measured on the coffee flow (27 screens, 57 transitions): top-down layers with orthogonal routes never cross a
// screen, and the best of 10 random starts at thoroughness 30 cut crossings from 22 (hand layout) to 9 in about 0.7s.
const OPTIONS = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.thoroughness": "30",
  "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
  "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
  "elk.spacing.nodeNode": "60",
  "elk.spacing.edgeNode": "30",
  "elk.spacing.edgeEdge": "14",
  "elk.layered.spacing.nodeNodeBetweenLayers": "140",
  "elk.layered.spacing.edgeNodeBetweenLayers": "30",
};

// Areas are nested boxes; lay them out with their screens as one graph and report everything in canvas coordinates.
// Only when there are areas: this mode also changes how a flat graph comes out (wider, one more crossing on coffee).
const NESTED_OPTIONS = {
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.json.shapeCoords": "ROOT",
  "elk.json.edgeCoords": "ROOT",
};

const AREA_OPTIONS = { "elk.padding": `[top=${AREA_PAD.top},left=${AREA_PAD.side},bottom=${AREA_PAD.side},right=${AREA_PAD.side}]` };

const TRIES = 10;

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(den) < 1e-9) return false;
  const u = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const v = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return u > 0 && u < 1 && v > 0 && v < 1;
}

/** Counts the points where two different routes cross each other. */
export function countCrossings(routes: Point[][]) {
  let n = 0;
  for (let i = 0; i < routes.length; i++)
    for (let j = i + 1; j < routes.length; j++)
      for (let a = 0; a < routes[i].length - 1; a++)
        for (let b = 0; b < routes[j].length - 1; b++) if (segmentsCross(routes[i][a], routes[i][a + 1], routes[j][b], routes[j][b + 1])) n++;
  return n;
}

/**
 * Places screens in top-down layers and routes every transition around them, keeping the try with the fewest crossings.
 * Runs in a web worker by default so the editor stays responsive; pass another engine (e.g. the bundled one in tests).
 */
export async function autoLayout(nodes: LayoutNode[], edges: LayoutEdge[], engine?: ELK): Promise<Layout> {
  const elk = engine ?? new ElkApi({ workerUrl: elkWorkerUrl });
  try {
    return await bestLayout(elk, nodes, edges);
  } finally {
    if (!engine) elk.terminateWorker();
  }
}

async function bestLayout(elk: ELK, nodes: LayoutNode[], edges: LayoutEdge[]): Promise<Layout> {
  const ids = new Set(nodes.map((n) => n.id));
  const usable = edges.filter((e) => e.from !== e.to && ids.has(e.from) && ids.has(e.to));
  // Transitions between the same two screens in the same direction share one line, keyed by the first of them.
  const lines = new Map<string, LayoutEdge[]>();
  for (const e of usable) {
    const key = `${e.from}>${e.to}`;
    lines.set(key, [...(lines.get(key) ?? []), e]);
  }
  const byLead = new Map([...lines.values()].map((g) => [g[0].id, g]));
  const areas = new Map<string, LayoutNode[]>();
  for (const n of nodes) if (n.area) areas.set(n.area, [...(areas.get(n.area) ?? []), n]);
  const shape = (n: LayoutNode): ElkNode => ({ id: n.id, width: n.width, height: n.height });
  const children: ElkNode[] = [
    ...nodes.filter((n) => !n.area).map(shape),
    ...[...areas].map(([name, members]) => ({ id: `area:${name}`, layoutOptions: AREA_OPTIONS, children: members.map(shape) })),
  ];
  let best: Layout | null = null;
  for (let seed = 1; seed <= TRIES; seed++) {
    const graph: ElkNode = await elk.layout({
      id: "root",
      layoutOptions: { ...OPTIONS, ...(areas.size > 0 && NESTED_OPTIONS), "elk.randomSeed": String(seed) },
      children,
      edges: [...byLead.values()].map(([e]) => ({
        id: e.id,
        sources: [e.from],
        targets: [e.to],
        labels: e.label ? [{ id: `${e.id}:label`, ...e.label }] : undefined,
      })),
    });
    const placed = (graph.children ?? []).flatMap((c) => (c.id.startsWith("area:") ? (c.children ?? []) : [c]));
    const positions = Object.fromEntries(placed.map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }]));
    const routes: Record<string, TransitionRoute> = {};
    for (const e of graph.edges ?? []) {
      const section = e.sections?.[0];
      const group = byLead.get(e.id);
      if (!section || !group) continue;
      const points = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
      const l = e.labels?.[0];
      const label = l ? { x: (l.x ?? 0) + (l.width ?? 0) / 2, y: (l.y ?? 0) + (l.height ?? 0) / 2 } : undefined;
      for (const t of group) routes[t.id] = { points, ...(label && { label }), from: positions[t.from], to: positions[t.to] };
    }
    const crossings = countCrossings([...byLead.keys()].flatMap((id) => (routes[id] ? [routes[id].points] : [])));
    if (!best || crossings < best.crossings) best = { positions, routes, crossings };
    if (crossings === 0) break;
  }
  return best ?? { positions: {}, routes: {}, crossings: 0 };
}
