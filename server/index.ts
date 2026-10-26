import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp, type Finish } from "./app";
import { captureWithChrome } from "./capture";
import { Store } from "./db";

const root = join(import.meta.dir, "..");
const dataDir = process.env.SEAM_DATA_DIR ?? join(root, "data");
mkdirSync(dataDir, { recursive: true });

// Approving a review runs the same `seam done` the agent would, so the CLI stays the only writer of baselines.
const finish: Finish = async (repoDir, force) => {
  const proc = Bun.spawn(["bun", join(root, "cli", "seam.ts"), "done", "--repo", repoDir, ...(force ? ["--force"] : [])], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = [await new Response(proc.stdout).text(), await new Response(proc.stderr).text(), await proc.exited];
  const result = JSON.parse(out || "{}") as { archived?: string; error?: string };
  if (code !== 0 || !result.archived) throw new Error(result.error ?? (err.trim() || `seam done 종료 코드 ${code}`));
  return { archived: result.archived };
};

const handle = createApp({
  store: new Store(join(dataDir, "seam.db")),
  capture: captureWithChrome,
  staticDir: process.env.NODE_ENV === "production" ? join(root, "dist") : undefined,
  repoDir: process.env.SEAM_REPO,
  finish,
});

const server = Bun.serve({ port: Number(process.env.PORT ?? 5180), fetch: handle, maxRequestBodySize: 64 * 1024 * 1024 });
console.log(`seam server on ${server.url}`);
