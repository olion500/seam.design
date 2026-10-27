#!/usr/bin/env bun
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DEFAULT_DEVICE, DEVICES, type DeviceId, deviceOf } from "../src/model/devices";
import { type AgentWaiting, type Project, SENT_FILE, type SentToAgent, type VerifyReport, type VerifyResult, WAITING_FILE } from "../src/model/types";
import { openBrowser } from "./capture";
import { type Change, changeMarkdown, pendingChanges } from "./changes";
import { expoRoutes, loadTokens, mermaidFlows } from "./parse";
import {
  buildProject,
  concreteRoute,
  configPath,
  pendingDir,
  projectPath,
  readJSON,
  type SeamConfig,
  SeamError,
  seamDir,
  transitionKey,
  writeJSON,
} from "./repo";

const SEAM_ROOT = resolve(import.meta.dir, "..");

const HELP = `seam — 디자인 명세 편집기 CLI (AI 에이전트용, 결과는 JSON)

  seam init [--force]          .seam/seam.json 초안 생성 (값은 직접 확인·수정)
  seam import                  화면 경로, 흐름 문서, 토큰을 읽어 .seam/project.json 생성/갱신
  seam capture [화면ID...] [--device iphone|galaxy]
                               앱을 열어 기준 스크린샷과 화면 요소 저장 (앱이 떠 있어야 함)
                               기기: iphone = iPhone 18 Pro 402×874 (기본), galaxy = Galaxy S26 360×780
  seam open [--port 5190]      이 레포의 .seam/을 연 편집기 서버 실행
  seam changes                 기준 대비 변경 묶음을 .seam/changes/pending/에 쓰고 출력
  seam wait [--timeout 초]     편집기의 'AI에게 보내기'를 기다렸다가 보낸 말과 변경 묶음을 출력
                               (기본: 끝없이 기다림, 시간이 다 되면 timedOut: true)
  seam verify [--no-capture]   코드 반영 결과 확인 (토큰 값, 문구, 흐름 문서, 다시 캡처)
  seam done [--force]          확인된 변경을 새 기준으로 올리고 묶음을 보관
  seam skill install [--dir D] 대상 레포에 seam 스킬 설치 (.claude/skills, .agents/skills)

공통: --repo <경로> (기본: 현재 폴더)`;

type Args = { _: string[]; flags: Record<string, string | true> };

function parseArgs(argv: string[]): Args {
  const out: Args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) out._.push(a);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out.flags[a.slice(2)] = argv[++i];
    else out.flags[a.slice(2)] = true;
  }
  return out;
}

const print = (data: unknown) => console.log(JSON.stringify(data, null, 2));
const today = () => new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

async function detectConfig(root: string): Promise<SeamConfig> {
  const pkgPath = join(root, "package.json");
  const pkg = existsSync(pkgPath) ? ((await Bun.file(pkgPath).json()) as { name?: string; scripts?: Record<string, string>; packageManager?: string }) : {};
  const pm = pkg.packageManager?.split("@")[0] ?? (existsSync(join(root, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(root, "bun.lock")) ? "bun" : "npm");
  const scripts = Object.keys(pkg.scripts ?? {});
  const webScript = scripts.find((s) => s === "mobile:web") ?? scripts.find((s) => /web/.test(s) && !/build|export/.test(s)) ?? "dev";
  const routesDir = ["mobile/src/app", "src/app", "app"].find((d) => existsSync(join(root, d))) ?? "src/app";
  const tokenFile = ["mobile/src/theme.ts", "src/theme.ts", "theme.ts", "src/styles/theme.ts"].find((f) => existsSync(join(root, f)));
  const exportsFound = tokenFile ? [...(await Bun.file(join(root, tokenFile)).text()).matchAll(/export const (\w+)\s*=/g)].map((m) => m[1]) : [];
  const flowFile = ["docs/user-flows.md"].find((f) => existsSync(join(root, f)));
  return {
    name: pkg.name ?? root.split("/").pop() ?? "app",
    app: { command: pm === "npm" ? `npm run ${webScript}` : `${pm} ${webScript === "dev" && pm === "bun" ? "run dev" : webScript}`, url: "http://localhost:8081", device: DEFAULT_DEVICE, render: "live" },
    routes: { type: "expo-router", dir: routesDir },
    ...(tokenFile && { tokens: { file: tokenFile, exports: exportsFound } }),
    ...(flowFile && { flows: { file: flowFile } }),
    screens: { params: {} },
  };
}

async function importProject(root: string, previous?: Project): Promise<Project> {
  const config = await readJSON<SeamConfig>(configPath(root));
  const missing = [
    ["routes.dir", config.routes.dir],
    ["tokens.file", config.tokens?.file],
    ["flows.file", config.flows?.file],
  ].filter(([, path]) => path && !existsSync(join(root, path)));
  if (missing.length) throw new SeamError(`.seam/seam.json의 경로가 레포에 없습니다: ${missing.map(([k, p]) => `${k}=${p}`).join(", ")}`);
  const routes = expoRoutes(root, config.routes.dir);
  const flows = config.flows ? mermaidFlows(await Bun.file(join(root, config.flows.file)).text()) : { nodes: new Map(), edges: [] };
  const tokens = config.tokens ? await loadTokens(join(root, config.tokens.file), config.tokens.exports) : [];
  return buildProject({ config, routes, nodes: flows.nodes, edges: flows.edges, tokens, tokenFile: config.tokens?.file, previous });
}

async function appReachable(config: SeamConfig) {
  try {
    await fetch(config.app.url, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new SeamError(`앱(${config.app.url})에 연결할 수 없습니다. 먼저 '${config.app.command}'로 앱을 실행하세요.`);
  }
}

async function captureScreens(root: string, project: Project, ids: string[], outDir: string) {
  const config = await readJSON<SeamConfig>(configPath(root));
  await appReachable(config);
  const browser = await openBrowser(deviceOf(project.device));
  const results: { id: string; url: string; image: string; elements: number; shot: Awaited<ReturnType<typeof browser.shoot>> }[] = [];
  try {
    for (const id of ids) {
      const screen = project.screens.find((s) => s.id === id);
      if (!screen?.route) throw new SeamError(`화면 ${id}이(가) 없거나 경로가 없습니다`);
      const state = config.screens?.states?.[id];
      const url = `${config.app.url}${state ? state.open : concreteRoute(screen.route, config.screens?.params?.[screen.route])}`;
      const shot = await browser.shoot(url, state?.steps);
      mkdirSync(outDir, { recursive: true });
      const image = join(outDir, `${id}.png`);
      await Bun.write(image, shot.png);
      results.push({ id, url, image, elements: shot.elements.length, shot });
    }
  } finally {
    browser.close();
  }
  return results;
}

async function cmdInit(root: string, args: Args) {
  if (existsSync(configPath(root)) && !args.flags.force) throw new SeamError(".seam/seam.json이 이미 있습니다 (덮어쓰려면 --force)");
  const config = await detectConfig(root);
  await writeJSON(configPath(root), config);
  await Bun.write(join(seamDir(root), ".gitignore"), `changes/pending/after/\n${SENT_FILE}\n${WAITING_FILE}\n`);
  print({ created: ".seam/seam.json", config, next: "값을 확인·수정한 뒤 'seam import'" });
}

async function cmdImport(root: string) {
  const previous = existsSync(projectPath(root)) ? await readJSON<Project>(projectPath(root)) : undefined;
  const project = await importProject(root, previous);
  await writeJSON(projectPath(root), project);
  print({
    project: ".seam/project.json",
    screens: project.screens.map((s) => ({ id: s.id, name: s.name, route: s.route, captured: !!s.baseline })),
    transitions: project.transitions.length,
    tokens: project.tokens.length,
    next: "앱을 실행하고 'seam capture'",
  });
}

async function cmdCapture(root: string, args: Args) {
  const project = await readJSON<Project>(projectPath(root));
  if (typeof args.flags.device === "string") {
    if (!(args.flags.device in DEVICES)) throw new SeamError(`기기는 ${Object.keys(DEVICES).join(", ")} 중 하나여야 합니다`);
    project.device = args.flags.device as DeviceId;
  }
  const ids = args._.length ? args._ : project.screens.map((s) => s.id);
  const results = await captureScreens(root, project, ids, join(seamDir(root), "screens"));
  for (const r of results) {
    const screen = project.screens.find((s) => s.id === r.id);
    if (!screen) continue;
    screen.baseline = { image: `screens/${r.id}.png`, elements: r.shot.elements, url: r.url, capturedAt: `${today()} 캡처`, device: project.device };
    screen.size = r.shot.size;
  }
  await writeJSON(projectPath(root), project);
  print({ device: deviceOf(project.device).name, captured: results.map(({ id, url, image, elements, shot }) => ({ id, url, image, elements, size: shot.size })) });
}

async function cmdOpen(root: string, args: Args) {
  const port = String(args.flags.port ?? 5190);
  if (!existsSync(join(SEAM_ROOT, "dist", "index.html"))) {
    const build = Bun.spawnSync(["bun", "run", "build"], { cwd: SEAM_ROOT, stdout: "inherit", stderr: "inherit" });
    if (build.exitCode !== 0) throw new SeamError("편집기 빌드에 실패했습니다");
  }
  print({ url: `http://localhost:${port}/`, repo: root, stop: "Ctrl+C" });
  const server = Bun.spawn(["bun", join(SEAM_ROOT, "server", "index.ts")], {
    env: { ...process.env, NODE_ENV: "production", PORT: port, SEAM_REPO: root },
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exitCode = await server.exited;
}

async function writePending(root: string) {
  const project = await readJSON<Project>(projectPath(root));
  const changes = pendingChanges(project);
  const dir = pendingDir(root);
  if (changes.length === 0) {
    rmSync(dir, { recursive: true, force: true });
    return { count: 0, changes: [] };
  }
  await writeJSON(join(dir, "change.json"), { project: project.name, createdAt: new Date().toISOString(), changes });
  await Bun.write(join(dir, "README.md"), changeMarkdown(project, changes));
  rmSync(join(dir, "verify.json"), { force: true });
  return { count: changes.length, dir: ".seam/changes/pending", readme: ".seam/changes/pending/README.md", changes };
}

async function cmdChanges(root: string) {
  print(await writePending(root));
}

async function cmdWait(root: string, args: Args) {
  const timeout = args.flags.timeout === undefined ? 0 : Number(args.flags.timeout);
  if (!Number.isFinite(timeout) || timeout < 0) throw new SeamError("--timeout은 0 이상의 초여야 합니다 (0 = 끝없이)");
  await readJSON<Project>(projectPath(root));
  const sent = join(seamDir(root), SENT_FILE);
  const waiting = join(seamDir(root), WAITING_FILE);
  const deadline = timeout ? Date.now() + timeout * 1000 : Number.POSITIVE_INFINITY;
  const mark: AgentWaiting = { pid: process.pid, since: new Date().toISOString() };
  await writeJSON(waiting, mark);
  try {
    while (!existsSync(sent)) {
      if (Date.now() >= deadline) {
        print({ sent: false, timedOut: true, next: "아직 보낸 것이 없습니다. 다시 'seam wait'" });
        return;
      }
      await Bun.sleep(500);
    }
  } finally {
    rmSync(waiting, { force: true });
  }
  const { messages, review } = await readJSON<SentToAgent>(sent);
  rmSync(sent);
  print({ sent: true, messages, ...(review && { review }), ...(await writePending(root)) });
}

async function cmdVerify(root: string, args: Args) {
  const dir = pendingDir(root);
  const { changes } = await readJSON<{ changes: Change[] }>(join(dir, "change.json"));
  const project = await readJSON<Project>(projectPath(root));
  const config = await readJSON<SeamConfig>(configPath(root));
  const results: VerifyResult[] = [];

  const tokens = config.tokens ? await loadTokens(join(root, config.tokens.file), config.tokens.exports) : [];
  const flows = config.flows ? mermaidFlows(await Bun.file(join(root, config.flows.file)).text()) : { nodes: new Map(), edges: [] };
  const flowKeys = new Set(flows.edges.map(transitionKey));

  const touched = new Set(changes.flatMap((c) => (c.kind === "element" ? [c.screen] : [])));
  if (changes.some((c) => c.kind === "token")) for (const s of project.screens) if (s.route) touched.add(s.id);
  const shots = touched.size && !args.flags["no-capture"] ? await captureScreens(root, project, [...touched], join(dir, "after")) : [];
  const shotOf = new Map(shots.map((s) => [s.id, s]));

  changes.forEach((c, index) => {
    if (c.kind === "token") {
      const now = tokens.find((t) => t.name === c.token);
      const ok = !!now && now.value.toLowerCase() === c.after.toLowerCase();
      results.push({ index, kind: c.kind, status: ok ? "pass" : "fail", detail: `${c.path} = ${now?.value ?? "없음"} (목표 ${c.after})` });
    } else if (c.kind === "transition") {
      const has = flowKeys.has(transitionKey(c));
      const ok = c.change === "added" ? has : !has;
      results.push({ index, kind: c.kind, status: ok ? "pass" : "fail", detail: `흐름 문서에 ${c.from} → ${c.to} “${c.label}” ${has ? "있음" : "없음"}` });
    } else {
      const shot = shotOf.get(c.screen);
      if (c.label && shot) {
        const found = !!shot?.shot.elements.some((e) => e.label === c.label);
        results.push({ index, kind: c.kind, status: found ? "pass" : "fail", detail: `${c.screenName} 화면에서 “${c.label}” ${found ? "찾음" : "못 찾음"}` });
      } else {
        results.push({
          index,
          kind: c.kind,
          status: "review",
          detail: shot ? `기준(${c.baselineImage})과 결과(${shot.image})를 눈으로 비교해 판단` : "캡처하지 않아 확인 못 함. 앱을 띄우고 --no-capture 없이 다시 verify",
        });
      }
    }
  });

  const report: VerifyReport = {
    checkedAt: new Date().toISOString(),
    ok: results.every((r) => r.status !== "fail"),
    results,
    after: shots.map((s) => ({ id: s.id, url: s.url, image: s.image, elements: s.shot.elements, size: s.shot.size })),
  };
  await writeJSON(join(dir, "verify.json"), report);
  print(report);
}

async function cmdDone(root: string, args: Args) {
  const dir = pendingDir(root);
  const report = await readJSON<VerifyReport>(join(dir, "verify.json"));
  if (!report.ok && !args.flags.force) throw new SeamError("verify에 실패한 항목이 있습니다. 고친 뒤 다시 'seam verify' (무시하려면 --force)");
  const { changes } = await readJSON<{ changes: Change[] }>(join(dir, "change.json"));
  const project = await readJSON<Project>(projectPath(root));
  const doneRequests = new Set(changes.flatMap((c) => (c.kind === "element" ? [c.requestId] : [])));
  const after = new Map(report.after.map((a) => [a.id, a]));

  for (const s of project.screens) {
    s.requests = (s.requests ?? []).filter((r) => !doneRequests.has(r.id));
    const shot = after.get(s.id);
    if (shot && existsSync(shot.image)) {
      mkdirSync(join(seamDir(root), "screens"), { recursive: true });
      cpSync(shot.image, join(seamDir(root), "screens", `${s.id}.png`));
      s.baseline = { image: `screens/${s.id}.png`, elements: shot.elements, url: shot.url, capturedAt: `${today()} 캡처`, device: project.device };
      s.size = shot.size;
    }
  }
  const refreshed = await importProject(root, project);
  await writeJSON(projectPath(root), refreshed);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const archive = join(seamDir(root), "changes", stamp);
  rmSync(join(dir, "after"), { recursive: true, force: true });
  renameSync(dir, archive);
  print({ archived: `.seam/changes/${stamp}`, remaining: pendingChanges(refreshed).length });
}

async function cmdSkill(root: string, args: Args) {
  if (args._[0] !== "install") throw new SeamError("사용법: seam skill install [--dir 대상레포]");
  const target = resolve(String(args.flags.dir ?? root));
  const template = await Bun.file(join(SEAM_ROOT, "skill", "seam", "SKILL.md")).text();
  const body = template.replaceAll("{{SEAM}}", `bun ${join(SEAM_ROOT, "cli", "seam.ts")}`);
  const written: string[] = [];
  for (const base of [".claude/skills/seam", ".agents/skills/seam"]) {
    const path = join(target, base, "SKILL.md");
    mkdirSync(dirname(path), { recursive: true });
    await Bun.write(path, body);
    written.push(path);
  }
  print({ installed: written });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command, ...rest] = args._;
  args._ = rest;
  const root = resolve(String(args.flags.repo ?? process.cwd()));
  switch (command) {
    case "init":
      return cmdInit(root, args);
    case "import":
      return cmdImport(root);
    case "capture":
      return cmdCapture(root, args);
    case "open":
      return cmdOpen(root, args);
    case "changes":
      return cmdChanges(root);
    case "wait":
      return cmdWait(root, args);
    case "verify":
      return cmdVerify(root, args);
    case "done":
      return cmdDone(root, args);
    case "skill":
      return cmdSkill(root, args);
    default:
      console.log(HELP);
      if (command && command !== "help") process.exitCode = 1;
  }
}

main().catch((e) => {
  if (e instanceof SeamError) {
    print({ error: e.message });
    process.exitCode = 1;
  } else throw e;
});

