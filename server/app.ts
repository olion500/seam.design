import { renameSync } from "node:fs";
import { basename, join, normalize } from "node:path";
import { parseProject } from "../src/model/exportSpec";
import {
  type AgentReview,
  type AgentWaiting,
  type Change,
  type ReviewDecision,
  type ReviewState,
  SENT_FILE,
  type SentToAgent,
  type VerifyReport,
  WAITING_FILE,
} from "../src/model/types";
import { type Capture, CaptureError, parseCaptureRequest } from "./capture";
import type { Store } from "./db";

/** Finishes a reviewed round (`seam done`) and returns the archive folder. */
export type Finish = (repoDir: string, force: boolean) => Promise<{ archived: string }>;

interface AppOptions {
  store: Store;
  capture: Capture;
  staticDir?: string;
  repoDir?: string;
  finish?: Finish;
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

async function agentWaiting(seamDir: string) {
  const file = Bun.file(join(seamDir, WAITING_FILE));
  if (!(await file.exists())) return false;
  try {
    process.kill(((await file.json()) as AgentWaiting).pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readSendMessage(req: Request) {
  const body = (await req.json().catch(() => null)) as { message?: unknown } | null;
  const message = body?.message ?? "";
  if (typeof message !== "string" || message.length > 10_000) throw new HttpError(400, "message는 10,000자 이하의 문자열이어야 합니다");
  return message.trim();
}

/** Adds to `.seam/changes/sent.json`; written then renamed so a polling `seam wait` never reads half a file. */
async function writeSent(seamDir: string, text: string, review?: AgentReview) {
  const sent = Bun.file(join(seamDir, SENT_FILE));
  const previous: SentToAgent = (await sent.exists()) ? await sent.json() : { messages: [] };
  const at = new Date().toISOString();
  const next: SentToAgent = { messages: text ? [...previous.messages, { at, text }] : previous.messages, ...((review ?? previous.review) && { review: review ?? previous.review }) };
  const tmp = `${sent.name}.${process.pid}.tmp`;
  await Bun.write(tmp, `${JSON.stringify(next, null, 2)}\n`);
  renameSync(tmp, join(seamDir, SENT_FILE));
  return at;
}

async function readReview(seamDir: string): Promise<ReviewState | null> {
  const dir = join(seamDir, "changes", "pending");
  const changeFile = Bun.file(join(dir, "change.json"));
  if (!(await changeFile.exists())) return null;
  const { changes } = (await changeFile.json()) as { changes: Change[] };
  const verifyFile = Bun.file(join(dir, "verify.json"));
  if (!(await verifyFile.exists())) return { changes, verify: null };
  const report = (await verifyFile.json()) as VerifyReport;
  return { changes, verify: { ...report, after: report.after.map((a) => ({ ...a, file: `changes/pending/after/${basename(a.image)}` })) } };
}

async function readDecisions(req: Request, count: number): Promise<ReviewDecision[]> {
  const body = (await req.json().catch(() => null)) as { decisions?: unknown } | null;
  const list = body?.decisions;
  const valid =
    Array.isArray(list) &&
    list.every(
      (d) =>
        d && typeof d.index === "number" && typeof d.ok === "boolean" && (d.note === undefined || (typeof d.note === "string" && d.note.length <= 2000)),
    );
  if (!valid) throw new HttpError(400, "decisions는 { index, ok, note? } 목록이어야 합니다");
  const decisions = list as ReviewDecision[];
  const indexes = new Set(decisions.map((d) => d.index));
  if (indexes.size !== decisions.length || indexes.size !== count || decisions.some((d) => d.index < 0 || d.index >= count))
    throw new HttpError(400, `변경 ${count}건 모두에 대해 한 번씩 결정해야 합니다`);
  return decisions;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function createApp({ store, capture, staticDir, repoDir, finish }: AppOptions) {
  const seamDir = repoDir ? join(repoDir, ".seam") : undefined;
  async function api(req: Request, path: string[]): Promise<Response> {
    const [resource, id] = path;
    const method = req.method;

    if (resource === "health" && method === "GET") return json({ ok: true });

    if (resource === "repo") {
      if (!seamDir) return fail(404, "레포 모드가 아닙니다");
      const file = Bun.file(join(seamDir, "project.json"));
      if (!id && method === "GET") return json({ root: repoDir, hasProject: await file.exists(), agentWaiting: await agentWaiting(seamDir) });
      if (id === "send" && method === "POST") {
        const at = await writeSent(seamDir, await readSendMessage(req));
        return json({ sentAt: at, agentWaiting: await agentWaiting(seamDir) });
      }
      if (id === "review" && method === "GET") {
        const review = await readReview(seamDir);
        return review ? json(review) : fail(404, "검토할 변경이 없습니다");
      }
      if (id === "review" && method === "POST") {
        const review = await readReview(seamDir);
        if (!review) return fail(404, "검토할 변경이 없습니다");
        if (!review.verify) return fail(409, "아직 확인(seam verify) 결과가 없습니다");
        const decisions = await readDecisions(req, review.changes.length);
        const rejected = decisions.filter((d) => !d.ok).map((d) => ({ ...d, change: review.changes[d.index] }));
        if (rejected.length === 0) {
          if (!finish || !repoDir) return fail(501, "이 서버는 마무리(seam done)를 실행할 수 없습니다");
          let archived: string;
          try {
            ({ archived } = await finish(repoDir, !review.verify.ok));
          } catch (e) {
            return fail(500, `마무리 실패: ${e instanceof Error ? e.message : String(e)}`);
          }
          await writeSent(seamDir, `검토: 모두 승인해서 마무리했습니다 (${archived})`, { approved: true, archived });
          return json({ approved: true, archived, agentWaiting: await agentWaiting(seamDir) });
        }
        const lines = rejected.map((r) => `- #${r.index + 1}${r.note ? `: ${r.note}` : ""}`);
        await writeSent(seamDir, [`검토: ${rejected.length}건 다시 요청`, ...lines].join("\n"), { approved: false, rejected });
        return json({ approved: false, rejected: rejected.length, agentWaiting: await agentWaiting(seamDir) });
      }
      if (id === "project" && method === "GET") return (await file.exists()) ? new Response(file, { headers: { "content-type": "application/json" } }) : fail(404, "seam import를 먼저 실행하세요");
      if (id === "project" && method === "PUT") {
        const project = await readProject(req);
        await Bun.write(file, `${JSON.stringify(project, null, 2)}\n`);
        return json({ updatedAt: Date.now() });
      }
    }

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
    if (seamDir && pathname.startsWith("/repo/")) {
      const file = Bun.file(join(seamDir, normalize(decodeURIComponent(pathname.slice("/repo".length)))));
      return (await file.exists()) ? new Response(file) : fail(404, "Not found");
    }
    if (!pathname.startsWith("/api/")) return serveStatic(pathname);
    try {
      return await api(req, pathname.slice("/api/".length).split("/").filter(Boolean).map(decodeURIComponent));
    } catch (e) {
      if (e instanceof HttpError) return fail(e.status, e.message);
      throw e;
    }
  };
}
