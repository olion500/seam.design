import { join, normalize } from "node:path";
import { parseProject } from "../src/model/exportSpec";
import { type Capture, CaptureError, parseCaptureRequest } from "./capture";
import type { Store } from "./db";

interface AppOptions {
  store: Store;
  capture: Capture;
  staticDir?: string;
}

const json = (data: unknown, status = 200) => Response.json(data, { status });
const fail = (status: number, message: string) => json({ error: message }, status);

async function readProject(req: Request) {
  try {
    return parseProject(await req.text());
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "잘못된 요청");
  }
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApp({ store, capture, staticDir }: AppOptions) {
  async function api(req: Request, path: string[]): Promise<Response> {
    const [resource, id] = path;
    const method = req.method;

    if (resource === "health" && method === "GET") return json({ ok: true });

    if (resource === "projects") {
      if (!id && method === "GET") return json(store.listProjects());
      if (id && method === "GET") {
        const project = store.getProject(id);
        return project ? json(project) : fail(404, "프로젝트가 없습니다");
      }
      if (id && method === "PUT") {
        const project = await readProject(req);
        if (project.id !== id) return fail(400, "주소의 id와 프로젝트 id가 다릅니다");
        return json({ id, updatedAt: store.putProject(project) });
      }
      if (id && method === "DELETE") return store.deleteProject(id) ? new Response(null, { status: 204 }) : fail(404, "프로젝트가 없습니다");
    }

    if (resource === "shares") {
      if (!id && method === "POST") return json({ id: store.createShare(await readProject(req)) }, 201);
      if (id && method === "GET") {
        const project = store.getShare(id);
        return project ? json(project) : fail(404, "공유 링크가 없거나 만료됐습니다");
      }
    }

    if (resource === "capture" && !id && method === "POST") {
      try {
        const request = parseCaptureRequest(await req.json().catch(() => null));
        return json({ image: await capture(request), url: request.url });
      } catch (e) {
        if (e instanceof CaptureError) return fail(400, e.message);
        return fail(502, `캡처 실패: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return fail(404, "없는 API입니다");
  }

  async function serveStatic(pathname: string): Promise<Response> {
    if (!staticDir) return fail(404, "Not found");
    const safe = normalize(pathname);
    const file = Bun.file(join(staticDir, safe));
    if (safe !== "/" && (await file.exists())) return new Response(file);
    return new Response(Bun.file(join(staticDir, "index.html")));
  }

  return async function handle(req: Request): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (!pathname.startsWith("/api/")) return serveStatic(pathname);
    try {
      return await api(req, pathname.slice("/api/".length).split("/").filter(Boolean).map(decodeURIComponent));
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      throw e;
    }
  };
}
