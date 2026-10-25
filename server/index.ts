import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "./app";
import { captureWithChrome } from "./capture";
import { Store } from "./db";

const root = join(import.meta.dir, "..");
const dataDir = process.env.SEAM_DATA_DIR ?? join(root, "data");
mkdirSync(dataDir, { recursive: true });

const handle = createApp({
  store: new Store(join(dataDir, "seam.db")),
  capture: captureWithChrome,
  staticDir: process.env.NODE_ENV === "production" ? join(root, "dist") : undefined,
  repoDir: process.env.SEAM_REPO,
});

const server = Bun.serve({ port: Number(process.env.PORT ?? 5180), fetch: handle, maxRequestBodySize: 64 * 1024 * 1024 });
console.log(`seam server on ${server.url}`);
