import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DEVICE, type DeviceId, deviceSize } from "../src/model/devices";
import { seedProject } from "../src/model/seed";
import type { Project, RenderMode, Screen, Transition } from "../src/model/types";
import type { FlowEdge, FlowNode, ParsedToken, RouteFile } from "./parse";

export interface SeamConfig {
  name: string;
  app: { command: string; url: string; device?: DeviceId; render?: RenderMode };
  routes: { type: "expo-router"; dir: string };
  tokens?: { file: string; exports: string[] };
  flows?: { file: string };
  screens?: { include?: string[]; params?: Record<string, Record<string, string>>; states?: Record<string, ScreenState> };
}

/**
 * A screen state with no URL of its own (a later step, a modal, a timer phase): open `open`,
 * then tap each step's button by its accessible name or text. Keyed by the flow node ID.
 */
export interface ScreenState {
  open: string;
  /** The route whose file draws this state, for source mapping. */
  route?: string;
  steps?: { tap: string }[];
}

export const seamDir = (root: string) => join(root, ".seam");
export const configPath = (root: string) => join(seamDir(root), "seam.json");
export const projectPath = (root: string) => join(seamDir(root), "project.json");
export const pendingDir = (root: string) => join(seamDir(root), "changes", "pending");

export async function readJSON<T>(path: string): Promise<T> {
  if (!existsSync(path)) throw new SeamError(`${path} 이(가) 없습니다`);
  return JSON.parse(await Bun.file(path).text()) as T;
}

export async function writeJSON(path: string, data: unknown) {
  mkdirSync(join(path, ".."), { recursive: true });
  await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`);
}

export class SeamError extends Error {}

export const transitionKey = (t: Pick<Transition, "from" | "to" | "label">) => `${t.from}>${t.to}>${t.label}`;

export function concreteRoute(route: string, params: Record<string, string> = {}) {
  return route.replace(/\[([^\]]+)\]/g, (_, k: string) => params[k] ?? `[${k}]`);
}

interface ImportInput {
  config: SeamConfig;
  routes: RouteFile[];
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
  tokens: ParsedToken[];
  tokenFile?: string;
  previous?: Project;
}

export function buildProject({ config, routes, nodes, edges, tokens, tokenFile, previous }: ImportInput): Project {
  const seed = seedProject();
  const include = config.screens?.include;
  const byRoute = new Map<string, FlowNode>();
  for (const n of nodes.values()) if (n.route && !byRoute.has(n.route)) byRoute.set(n.route, n);
  const picked = routes.filter((r) => (include ? include.includes(r.route) : !r.dynamic || config.screens?.params?.[r.route]));
  const prevScreens = new Map(previous?.screens.map((s) => [s.id, s]));
  const device = previous?.device ?? config.app.device ?? DEFAULT_DEVICE;

  const screens: Screen[] = picked.map((r, i) => {
    const derived = r.route === "/" ? "HOME" : r.route.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").toUpperCase();
    // A flow node may name the screen without writing its route (e.g. BEAN_EDIT for /bean-edit).
    const node = byRoute.get(r.route) ?? nodes.get(derived);
    const id = node?.id ?? derived;
    const prev = prevScreens.get(id);
    return {
      id,
      name: prev?.name ?? node?.name ?? r.route,
      route: r.route,
      position: prev?.position ?? { x: (i % 4) * 240, y: Math.floor(i / 4) * 420 },
      size: prev?.size ?? deviceSize(device),
      baseline: prev?.baseline ?? null,
      variant: null,
      states: prev?.states ?? ["기본"],
      sources: [{ path: r.file, note: "화면 전체" }],
      requests: prev?.requests ?? [],
      live: { url: `${config.app.url}${concreteRoute(r.route, config.screens?.params?.[r.route])}` },
    };
  });

  for (const [id, state] of Object.entries(config.screens?.states ?? {})) {
    if (screens.some((s) => s.id === id)) continue;
    const prev = prevScreens.get(id);
    const file = routes.find((r) => r.route === state.route)?.file;
    const i = screens.length;
    screens.push({
      id,
      name: prev?.name ?? nodes.get(id)?.name ?? id,
      route: state.route ?? state.open,
      position: prev?.position ?? { x: (i % 4) * 240, y: Math.floor(i / 4) * 420 },
      size: prev?.size ?? deviceSize(device),
      baseline: prev?.baseline ?? null,
      variant: null,
      states: prev?.states ?? ["기본"],
      sources: file ? [{ path: file, note: "화면 일부" }] : [],
      requests: prev?.requests ?? [],
    });
  }

  const ids = new Set(screens.map((s) => s.id));
  for (const s of screens) {
    const outside = [...new Set(edges.filter((e) => e.from === s.id && !ids.has(e.to)).map((e) => nodes.get(e.to)?.name ?? e.to))];
    s.exitsOutside = outside.length ? outside : undefined;
  }
  const prevTransitions = new Map(previous?.transitions.map((t) => [transitionKey(t), t]));
  const imported: Transition[] = edges
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
    .map((e, i) => prevTransitions.get(transitionKey(e)) ?? {
      id: `f${i + 1}`,
      from: e.from,
      to: e.to,
      label: e.label,
      trigger: e.label,
      condition: "",
      conditional: false,
      motionId: "push",
    });
  const importedKeys = new Set(imported.map(transitionKey));
  const sourceKeys = new Set(previous?.source?.transitions ?? []);
  const userAdded = (previous?.transitions ?? []).filter((t) => !importedKeys.has(transitionKey(t)) && !sourceKeys.has(transitionKey(t)));
  // New edges are numbered by position, so they can collide with ids kept from an earlier import; the first keeps its id.
  const used = new Set<string>();
  let next = 1;
  const transitions = [...imported, ...userAdded].map((t) => {
    if (!used.has(t.id)) {
      used.add(t.id);
      return t;
    }
    while (used.has(`f${next}`) || [...imported, ...userAdded].some((x) => x.id === `f${next}`)) next++;
    used.add(`f${next}`);
    return { ...t, id: `f${next}` };
  });

  const prevTokens = new Map(previous?.tokens.map((t) => [t.name, t.value]));
  const prevSource = previous?.source?.tokens ?? {};
  const projectTokens = tokens.map((t) => {
    const edited = prevTokens.get(t.name);
    const keepEdit = edited !== undefined && prevSource[t.name] && edited !== prevSource[t.name].value;
    return { name: t.name, kind: t.kind, value: keepEdit ? edited : t.value, description: t.path };
  });

  return {
    id: previous?.id ?? crypto.randomUUID().slice(0, 8),
    name: previous?.name ?? config.name,
    screens,
    transitions,
    tokens: projectTokens,
    motions: previous?.motions ?? seed.motions,
    rules: previous?.rules ?? seed.rules.filter((r) => r.check === "no-dead-end" || r.check === "reduced-motion"),
    assets: [],
    device,
    render: previous?.render ?? config.app.render ?? "live",
    source: {
      tokens: Object.fromEntries(tokens.map((t) => [t.name, { path: t.path, value: t.value, file: tokenFile ?? "", line: t.line }])),
      transitions: imported.map(transitionKey),
    },
  };
}
