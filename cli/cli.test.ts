import { beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Project } from "../src/model/types";
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
  BEAN -->|이 원두로 추출 준비| PREP1
  DIRECT -->|개발 URL| DEV["UI_LAB / UI_AUDIT"]
\`\`\`

\`\`\`mermaid
flowchart LR
  PREP1["PREP1 · 원두·장비"] -->|취소| HOME["HOME"]
\`\`\`
`;

const THEME = `import type { TextStyle } from 'react-native';
export const colors = { background: '#F8F6EE', primary: '#657852' };
export const fonts = { body: 'Gaegu' };
export const typography = {
  title: { fontFamily: fonts.body, fontSize: 38, fontWeight: '400' },
} satisfies Record<string, TextStyle>;
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
      { from: "BEAN", to: "PREP1", label: "이 원두로 추출 준비" },
      { from: "DIRECT", to: "DEV", label: "개발 URL" },
      { from: "PREP1", to: "HOME", label: "취소" },
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
    expect(config.tokens).toEqual({ file: "mobile/src/theme.ts", exports: ["colors", "fonts", "typography"] });
    const p = await readProject(root);
    expect(p.screens.map((s) => s.id)).toEqual(["HOME", "PREP1"]);
    expect(p.transitions.map((t) => `${t.from}>${t.to}`)).toEqual(["HOME>PREP1", "PREP1>HOME"]);
    expect(pendingChanges(p)).toEqual([]);
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

  it("installs the skill with an absolute CLI path for both agents", async () => {
    const { json } = await seam(root, "skill", "install");
    expect(json.installed).toHaveLength(2);
    const body = await Bun.file(join(root, ".claude/skills/seam/SKILL.md")).text();
    expect(body).toContain(`bun ${CLI}`);
    expect(body).not.toContain("{{SEAM}}");
  });
});
