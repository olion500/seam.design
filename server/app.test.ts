import { beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { seedProject } from "../src/model/seed";
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

    expect(await (await call("GET", "/api/repo")).json()).toEqual({ root: repo, hasProject: false });
    expect((await call("GET", "/api/repo/project")).status).toBe(404);
    const project = seedProject();
    expect((await call("PUT", "/api/repo/project", project)).status).toBe(200);
    expect(await (await call("GET", "/api/repo/project")).json()).toEqual(project);

    expect(await (await call("GET", "/repo/screens/HOME.png")).text()).toBe("png");
    expect((await call("GET", "/repo/%2E%2E/secret.txt")).status).toBe(404);
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
