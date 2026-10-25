import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_DEVICE, type DeviceId, deviceSize } from "../src/model/devices";
import { seedProject } from "../src/model/seed";
import type { Project, Screen, Transition } from "../src/model/types";
import type { FlowEdge, FlowNode, ParsedToken, RouteFile } from "./parse";

export interface SeamConfig {
  name: string;
  app: { command: string; url: string; device?: DeviceId };
  routes: { type: "expo-router"; dir: string };
  tokens?: { file: string; exports: string[] };
  flows?: { file: string };
  screens?: { include?: string[]; params?: Record<string, Record<string, string>> };
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
    const node = byRoute.get(r.route);
    const id = node?.id ?? (r.route === "/" ? "HOME" : r.route.replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").toUpperCase());
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

  const ids = new Set(screens.map((s) => s.id));
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
    transitions: [...imported, ...userAdded],
    tokens: projectTokens,
    motions: previous?.motions ?? seed.motions,
    rules: previous?.rules ?? seed.rules.filter((r) => r.check === "no-dead-end" || r.check === "reduced-motion"),
    assets: [],
    device,
    source: {
      tokens: Object.fromEntries(tokens.map((t) => [t.name, { path: t.path, value: t.value, file: tokenFile ?? "", line: t.line }])),
      transitions: imported.map(transitionKey),
    },
  };
}
