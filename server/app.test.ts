import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedProject } from "../src/model/seed";
import type { Change, ReviewState, SentToAgent } from "../src/model/types";
import { createApp } from "./app";
import type { CaptureRequest } from "./capture";
import { Store } from "./db";

let handle: ReturnType<typeof createApp>;
let captured: CaptureRequest[];

const call = (method: string, path: string, body?: unknown) =>
  handle(new Request(`http://test${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }));

beforeEach(() => {
  captured = [];
  const staticDir = mkdtempSync(join(tmpdir(), "seam-static-"));
  writeFileSync(join(staticDir, "index.html"), "<!doctype html><title>app</title>");
  handle = createApp({
    store: new Store(":memory:"),
    capture: async (req) => {
      captured.push(req);
      return "data:image/png;base64,AAAA";
    },
    staticDir,
  });
});

describe("projects API", () => {
  it("saves, lists, loads and deletes a project", async () => {
    const project = seedProject();
    expect((await call("PUT", `/api/projects/${project.id}`, project)).status).toBe(200);

    const list = (await (await call("GET", "/api/projects")).json()) as { id: string; name: string }[];
    expect(list.map((p) => [p.id, p.name])).toEqual([[project.id, project.name]]);
    expect(await (await call("GET", `/api/projects/${project.id}`)).json()).toEqual(project);

    expect((await call("DELETE", `/api/projects/${project.id}`)).status).toBe(204);
    expect((await call("GET", `/api/projects/${project.id}`)).status).toBe(404);
  });

  it("rejects bodies that are not projects or whose id mismatches the path", async () => {
    expect((await call("PUT", "/api/projects/demo", { hello: 1 })).status).toBe(400);
    expect((await call("PUT", "/api/projects/other", seedProject())).status).toBe(400);
  });
});

describe("shares API", () => {
  it("returns a snapshot that later edits do not change", async () => {
    const project = seedProject();
    const { id } = (await (await call("POST", "/api/shares", project)).json()) as { id: string };
    await call("PUT", `/api/projects/${project.id}`, { ...project, name: "바뀐 이름" });
    const shared = (await (await call("GET", `/api/shares/${id}`)).json()) as { name: string };
    expect(shared.name).toBe(project.name);
    expect((await call("GET", "/api/shares/missing")).status).toBe(404);
  });
});

describe("capture API", () => {
  it("passes a validated request to the capturer", async () => {
    const res = await call("POST", "/api/capture", { url: "http://localhost:5173/checkout", width: 390, height: 844 });
    expect(await res.json()).toEqual({ image: "data:image/png;base64,AAAA", url: "http://localhost:5173/checkout" });
    expect(captured).toEqual([{ url: "http://localhost:5173/checkout", width: 390, height: 844 }]);
  });

  it("rejects non-http URLs and odd sizes without capturing", async () => {
    expect((await call("POST", "/api/capture", { url: "file:///etc/passwd" })).status).toBe(400);
    expect((await call("POST", "/api/capture", { url: "https://example.com", width: 10 })).status).toBe(400);
    expect(captured).toEqual([]);
  });
});

describe("repo mode", () => {
  it("reads and writes .seam/project.json and serves .seam files only", async () => {
    const repo = mkdtempSync(join(tmpdir(), "seam-repo-"));
    mkdirSync(join(repo, ".seam", "screens"), { recursive: true });
    writeFileSync(join(repo, ".seam", "screens", "HOME.png"), "png");
    writeFileSync(join(repo, "secret.txt"), "secret");
    handle = createApp({ store: new Store(":memory:"), capture: async () => "", repoDir: repo });

    expect(await (await call("GET", "/api/repo")).json()).toEqual({ root: repo, hasProject: false, agentWaiting: false });
    expect((await call("GET", "/api/repo/project")).status).toBe(404);
    const project = seedProject();
    expect((await call("PUT", "/api/repo/project", project)).status).toBe(200);
    expect(await (await call("GET", "/api/repo/project")).json()).toEqual(project);

    expect(await (await call("GET", "/repo/screens/HOME.png")).text()).toBe("png");
    expect((await call("GET", "/repo/%2E%2E/secret.txt")).status).toBe(404);
  });

  it("collects sent messages for seam wait and reports whether an agent is waiting", async () => {
    const repo = mkdtempSync(join(tmpdir(), "seam-repo-"));
    handle = createApp({ store: new Store(":memory:"), capture: async () => "", repoDir: repo });
    const sent = () => Bun.file(join(repo, ".seam/changes/sent.json")).json();

    expect(await (await call("POST", "/api/repo/send", {})).json()).toMatchObject({ agentWaiting: false });
    expect(await sent()).toEqual({ messages: [] });
    await call("POST", "/api/repo/send", { message: "  버튼 먼저  " });
    await call("POST", "/api/repo/send", { message: "그다음 문구" });
    expect(((await sent()) as { messages: { text: string }[] }).messages.map((m) => m.text)).toEqual(["버튼 먼저", "그다음 문구"]);
    expect((await call("POST", "/api/repo/send", { message: 1 })).status).toBe(400);

    const waiting = join(repo, ".seam/changes/waiting.json");
    writeFileSync(waiting, JSON.stringify({ pid: process.pid, since: "now" }));
    expect(await (await call("GET", "/api/repo")).json()).toMatchObject({ agentWaiting: true });
    const dead = Bun.spawn(["true"]);
    await dead.exited;
    writeFileSync(waiting, JSON.stringify({ pid: dead.pid, since: "now" }));
    expect(await (await call("GET", "/api/repo")).json()).toMatchObject({ agentWaiting: false });
  });

  it("shows the pending round for review and takes approve or send-back decisions", async () => {
    const repo = mkdtempSync(join(tmpdir(), "seam-repo-"));
    const finished: { repoDir: string; force: boolean }[] = [];
    handle = createApp({
      store: new Store(":memory:"),
      capture: async () => "",
      repoDir: repo,
      finish: async (repoDir, force) => {
        finished.push({ repoDir, force });
        return { archived: ".seam/changes/2026-10-27T00-00-00" };
      },
    });
    const pending = join(repo, ".seam/changes/pending");
    const sent = async () => (await Bun.file(join(repo, ".seam/changes/sent.json")).json()) as SentToAgent;
    const changes: Change[] = [
      { kind: "token", token: "colors-primary", path: "colors.primary", file: "theme.ts", line: 2, before: "#000", after: "#111" },
      { kind: "element", screen: "HOME", screenName: "홈", sources: [], note: "더 크게", requestId: "r1" },
    ];

    expect((await call("GET", "/api/repo/review")).status).toBe(404);
    mkdirSync(pending, { recursive: true });
    writeFileSync(join(pending, "change.json"), JSON.stringify({ changes }));
    expect(await (await call("GET", "/api/repo/review")).json()).toEqual({ changes, verify: null });
    expect((await call("POST", "/api/repo/review", { decisions: [] })).status).toBe(409);

    const shot = { id: "HOME", url: "http://x/", image: join(pending, "after", "HOME.png"), elements: [], size: { w: 402, h: 874 } };
    writeFileSync(join(pending, "verify.json"), JSON.stringify({ checkedAt: "t", ok: false, results: [], after: [shot] }));
    const review = (await (await call("GET", "/api/repo/review")).json()) as ReviewState;
    expect(review.verify?.after[0].file).toBe("changes/pending/after/HOME.png");

    expect((await call("POST", "/api/repo/review", { decisions: [{ index: 0, ok: true }] })).status).toBe(400);
    const back = await call("POST", "/api/repo/review", { decisions: [{ index: 0, ok: true }, { index: 1, ok: false, note: "아직 작음" }] });
    expect(await back.json()).toMatchObject({ approved: false, rejected: 1 });
    expect((await sent()).review).toEqual({ approved: false, rejected: [{ index: 1, ok: false, note: "아직 작음", change: changes[1] }] });
    expect(finished).toEqual([]);

    const done = await call("POST", "/api/repo/review", { decisions: [{ index: 0, ok: true }, { index: 1, ok: true }] });
    expect(await done.json()).toMatchObject({ approved: true, archived: ".seam/changes/2026-10-27T00-00-00" });
    expect(finished).toEqual([{ repoDir: repo, force: true }]);
    expect((await sent()).review).toEqual({ approved: true, archived: ".seam/changes/2026-10-27T00-00-00" });
  });

  it("is off without a repo", async () => {
    expect((await call("GET", "/api/repo")).status).toBe(404);
  });
});

describe("static files", () => {
  it("falls back to index.html and never escapes the static dir", async () => {
    for (const path of ["/", "/some/route", "/../../etc/passwd"]) {
      expect(await (await call("GET", path)).text()).toContain("<title>app</title>");
    }
  });
});
