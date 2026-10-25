import type { Project } from "@/model/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "서버에 연결할 수 없습니다");
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, detail?.error ?? (res.status >= 500 ? "서버에 연결할 수 없습니다" : res.statusText));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const imageSrc = (image: string) => (/^(data:|https?:|\/)/.test(image) ? image : `/repo/${image}`);

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export const api = {
  listProjects: () => request<ProjectSummary[]>("GET", "/projects"),
  getProject: (id: string) => request<Project>("GET", `/projects/${encodeURIComponent(id)}`),
  putProject: (project: Project) => request<{ updatedAt: number }>("PUT", `/projects/${encodeURIComponent(project.id)}`, project),
  createShare: (project: Project) => request<{ id: string }>("POST", "/shares", project),
  getShare: (id: string) => request<Project>("GET", `/shares/${encodeURIComponent(id)}`),
  repo: () => request<{ root: string; hasProject: boolean }>("GET", "/repo"),
  getRepoProject: () => request<Project>("GET", "/repo/project"),
  putRepoProject: (project: Project) => request<{ updatedAt: number }>("PUT", "/repo/project", project),
  capture: (url: string, width: number, height: number) => request<{ image: string; url: string }>("POST", "/capture", { url, width, height }),
};
