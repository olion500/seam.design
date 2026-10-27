import { beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, watch, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project } from "../src/model/types";
import { createApp } from "../server/app";
import { Store } from "../server/db";
import { withKeys } from "./capture";
import { pendingChanges } from "./changes";
import { expoRoutes, mermaidFlows, tokensFromModule } from "./parse";

const CLI = join(import.meta.dir, "seam.ts");

const FLOWS = `# map

\`\`\`mermaid
flowchart TD
  HOME["HOME · 홈 /"]
  PREP1["PREP1 · 추출 준비 /prepare"]
  BEAN["BEAN · 원두 상세 /bean/[id]"]
  HOME -->|추출 준비| PREP1
  HOME -->|개발 화면| DEV
  BEAN -->|이 원두로 추출 준비| PREP1
  DIRECT -->|개발 URL| DEV["UI_LAB / UI_AUDIT"]
\`\`\`

\`\`\`mermaid
flowchart LR
  PREP1["PREP1 · 원두·장비"] -->|취소| HOME["HOME"]
  PREP1 -->|레시피 고르기| PREP2["PREP2 · 레시피"]
\`\`\`
`;

const THEME = `import { Platform, type TextStyle } from 'react-native';
export const colors = { background: '#F8F6EE', primary: '#657852' };
export const fonts = { body: 'Gaegu' };
export const typography = {
  title: { fontFamily: fonts.body, fontSize: 38, fontWeight: '400' },
} satisfies Record<string, TextStyle>;
if (__DEV__ && Platform.OS === 'web') colors.primary = '#000000';
`;

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "seam-cli-"));
  for (const f of ["mobile/src/app/(tabs)/index.tsx", "mobile/src/app/(tabs)/_layout.tsx", "mobile/src/app/prepare.tsx", "mobile/src/app/bean/[id].tsx", "mobile/src/app/+not-found.tsx"]) {
    mkdirSync(join(root, f, ".."), { recursive: true });
    writeFileSync(join(root, f), "export default function X() { return null; }\n");
  }
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/user-flows.md"), FLOWS);
  writeFileSync(join(root, "mobile/src/theme.ts"), THEME);
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "coffee-fixture", packageManager: "pnpm@11", scripts: { "mobile:web": "x" } }));
  return root;
}

async function seam(root: string, ...args: string[]) {
  const p = Bun.spawn(["bun", CLI, ...args, "--repo", root], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = [await new Response(p.stdout).text(), await new Response(p.stderr).text(), await p.exited];
  if (code !== 0 && !out.includes('"error"')) throw new Error(err || out);
  return { code, json: JSON.parse(out) };
}

const readProject = async (root: string) => (await Bun.file(join(root, ".seam/project.json")).json()) as Project;
const writeProject = (root: string, p: Project) => Bun.write(join(root, ".seam/project.json"), JSON.stringify(p));

describe("parsers", () => {
  it("maps Expo Router files to routes, skipping layouts and groups", () => {
    const root = fixture();
    expect(expoRoutes(root, "mobile/src/app").map((r) => [r.route, r.dynamic])).toEqual([
      ["/", false],
      ["/bean/[id]", true],
      ["/prepare", false],
    ]);
  });

  it("reads nodes with routes and deduplicated edges across mermaid blocks", () => {
    const { nodes, edges } = mermaidFlows(FLOWS);
    expect(nodes.get("PREP1")).toEqual({ id: "PREP1", name: "추출 준비", route: "/prepare" });
    expect(nodes.get("HOME")?.route).toBe("/");
    expect(nodes.get("DEV")?.route).toBeUndefined();
    expect(edges).toEqual([
      { from: "HOME", to: "PREP1", label: "추출 준비" },
      { from: "HOME", to: "DEV", label: "개발 화면" },
      { from: "BEAN", to: "PREP1", label: "이 원두로 추출 준비" },
      { from: "DIRECT", to: "DEV", label: "개발 URL" },
      { from: "PREP1", to: "HOME", label: "취소" },
      { from: "PREP1", to: "PREP2", label: "레시피 고르기" },
    ]);
  });

  it("turns hex colors and type styles into tokens with source lines", () => {
    const mod = { colors: { background: "#F8F6EE", primary: "#657852" }, fonts: { body: "Gaegu" }, typography: { title: { fontSize: 38, fontWeight: "400" } } };
    expect(tokensFromModule(mod, ["colors", "fonts", "typography"], THEME)).toEqual([
      { name: "colors-background", path: "colors.background", kind: "color", value: "#F8F6EE", line: 2 },
      { name: "colors-primary", path: "colors.primary", kind: "color", value: "#657852", line: 2 },
      { name: "typography-title", path: "typography.title", kind: "type", value: "38 / 400", line: 5 },
    ]);
  });

  it("gives duplicate element labels unique keys", () => {
    const box = { x: 0, y: 0, w: 10, h: 10 };
    expect(withKeys([{ role: "button", label: "추가", box }, { role: "button", label: "추가", box }]).map((e) => e.key)).toEqual(["button:추가", "button:추가#2"]);
  });
});

describe("seam CLI round trip", () => {
  let root: string;
  beforeEach(async () => {
    root = fixture();
    await seam(root, "init");
    await seam(root, "import");
  });

  it("detects the config and imports screens, flows and tokens", async () => {
    const config = await Bun.file(join(root, ".seam/seam.json")).json();
    expect(config.app.command).toBe("pnpm mobile:web");
    expect(config.app.device).toBe("iphone");
    expect(config.app.render).toBe("live");
    expect(config.tokens).toEqual({ file: "mobile/src/theme.ts", exports: ["colors", "fonts", "typography"] });
    const p = await readProject(root);
    expect(p.screens.map((s) => s.id)).toEqual(["HOME", "PREP1"]);
    expect(p.device).toBe("iphone");
    expect(p.render).toBe("live");
    expect(p.screens[0].size).toEqual({ w: 402, h: 874 });
    expect(p.transitions.map((t) => `${t.from}>${t.to}`)).toEqual(["HOME>PREP1", "PREP1>HOME"]);
    expect(p.screens.find((s) => s.id === "HOME")?.exitsOutside).toEqual(["UI_LAB / UI_AUDIT"]);
    expect(pendingChanges(p)).toEqual([]);
  });

  it("imports states without a URL from screens.states, with the route's file as source and no live URL", async () => {
    const configFile = join(root, ".seam/seam.json");
    const config = await Bun.file(configFile).json();
    config.screens.states = { PREP2: { open: "/prepare", route: "/prepare", steps: [{ tap: "레시피 고르기" }] } };
    await Bun.write(configFile, JSON.stringify(config));
    await seam(root, "import");

    const p = await readProject(root);
    const state = p.screens.find((s) => s.id === "PREP2");
    expect(state).toMatchObject({ name: "레시피", route: "/prepare", sources: [{ path: "mobile/src/app/prepare.tsx" }] });
    expect(state?.live).toBeUndefined();
    expect(p.transitions.map((t) => `${t.from}>${t.to}`)).toContain("PREP1>PREP2");
  });

  it("reports token, element and transition edits, and verify fails until the code changes", async () => {
    const p = await readProject(root);
    p.tokens.find((t) => t.name === "colors-primary")!.value = "#496238";
    p.screens[0].requests = [{ id: "r1", note: "버튼을 더 크게" }];
    p.transitions = p.transitions.filter((t) => t.label !== "취소");
    await writeProject(root, p);

    const { json } = await seam(root, "changes");
    expect(json.changes.map((c: { kind: string }) => c.kind)).toEqual(["token", "element", "transition"]);
    expect(json.changes[0]).toMatchObject({ file: "mobile/src/theme.ts", line: 2, before: "#657852", after: "#496238" });
    expect(await Bun.file(join(root, ".seam/changes/pending/README.md")).text()).toContain("`colors.primary`");

    const failed = await seam(root, "verify", "--no-capture");
    expect(failed.json.results.map((r: { status: string }) => r.status)).toEqual(["fail", "review", "fail"]);
    expect((await seam(root, "done")).json.error).toBeDefined();

    writeFileSync(join(root, "mobile/src/theme.ts"), THEME.replace("#657852", "#496238"));
    writeFileSync(join(root, "docs/user-flows.md"), FLOWS.replace(/\n {2}PREP1\["PREP1 · 원두·장비"\] -->\|취소\| HOME\["HOME"\]/, ""));
    const passed = await seam(root, "verify", "--no-capture");
    expect(passed.json.ok).toBe(true);

    const done = await seam(root, "done");
    expect(done.json.remaining).toBe(0);
    expect(existsSync(join(root, ".seam/changes/pending"))).toBe(false);
    const after = await readProject(root);
    expect(after.source?.tokens["colors-primary"].value).toBe("#496238");
    expect(after.screens[0].requests).toEqual([]);
  });

  it("carries an area drawn on the screenshot into the change set, and verify leaves it for review", async () => {
    const p = await readProject(root);
    p.screens[0].requests = [{ id: "r2", area: { x: 10, y: 20, w: 100, h: 40 }, note: "여백을 넓게" }];
    await writeProject(root, p);

    const { json } = await seam(root, "changes");
    expect(json.changes).toHaveLength(1);
    expect(json.changes[0]).toMatchObject({ kind: "element", requestId: "r2", area: { x: 10, y: 20, w: 100, h: 40 } });
    expect(json.changes[0].element).toBeUndefined();
    const verified = await seam(root, "verify", "--no-capture");
    expect(verified.json.results.map((r: { status: string }) => r.status)).toEqual(["review"]);
  });

  it("seam wait returns what the editor sent, before or while it waits, and times out otherwise", async () => {
    const app = createApp({ store: new Store(":memory:"), capture: async () => "", repoDir: root });
    const send = (message: string) => app(new Request("http://test/api/repo/send", { method: "POST", body: JSON.stringify({ message }) }));
    const p = await readProject(root);
    p.screens[0].requests = [{ id: "r1", note: "버튼을 더 크게" }];
    await writeProject(root, p);

    const idle = await seam(root, "wait", "--timeout", "0.2");
    expect(idle.json).toMatchObject({ sent: false, timedOut: true });
    expect(existsSync(join(root, ".seam/changes/waiting.json"))).toBe(false);

    await send("먼저 보낸 말");
    const early = await seam(root, "wait", "--timeout", "5");
    expect(early.json).toMatchObject({ sent: true, count: 1, messages: [{ text: "먼저 보낸 말" }] });
    expect(early.json.changes[0]).toMatchObject({ kind: "element", note: "버튼을 더 크게" });
    expect(existsSync(join(root, ".seam/changes/sent.json"))).toBe(false);

    const changesDir = join(root, ".seam/changes");
    const listening = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("seam wait did not start waiting")), 5000);
      const w = watch(changesDir, (_, file) => {
        if (file === "waiting.json" && existsSync(join(changesDir, file))) {
          clearTimeout(timer);
          w.close();
          resolve();
        }
      });
    });
    const later = seam(root, "wait", "--timeout", "10");
    await listening;
    expect(await (await app(new Request("http://test/api/repo"))).json()).toMatchObject({ agentWaiting: true });
    await send("");
    expect((await later).json).toMatchObject({ sent: true, messages: [], count: 1 });

    const review = { approved: false, rejected: [{ index: 0, ok: false, note: "아직 작음" }] };
    writeFileSync(join(root, ".seam/changes/sent.json"), JSON.stringify({ messages: [{ at: "t", text: "검토: 1건 다시 요청" }], review }));
    expect((await seam(root, "wait", "--timeout", "5")).json).toMatchObject({ sent: true, review, count: 1 });
  });

  it("reports missing configured paths as a JSON error", async () => {
    const config = await Bun.file(join(root, ".seam/seam.json")).json();
    config.routes.dir = "app-missing";
    writeFileSync(join(root, ".seam/seam.json"), JSON.stringify(config));
    const { code, json } = await seam(root, "import");
    expect(code).toBe(1);
    expect(json.error).toContain("routes.dir=app-missing");
  });

  it("installs the skill with an absolute CLI path for both agents", async () => {
    const { json } = await seam(root, "skill", "install");
    expect(json.installed).toHaveLength(2);
    const body = await Bun.file(join(root, ".claude/skills/seam/SKILL.md")).text();
    expect(body).toContain(`bun ${CLI}`);
    expect(body).not.toContain("{{SEAM}}");
  });
});
