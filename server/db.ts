import { Database } from "bun:sqlite";
import type { Project } from "../src/model/types";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

export class Store {
  readonly db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true, strict: true });
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run(`CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    this.db.run(`CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`);
  }

  listProjects(): ProjectSummary[] {
    return this.db
      .query<ProjectSummary, []>("SELECT id, name, updated_at AS updatedAt FROM projects ORDER BY updated_at DESC")
      .all();
  }

  getProject(id: string): Project | null {
    const row = this.db.query<{ data: string }, [string]>("SELECT data FROM projects WHERE id = ?").get(id);
    return row ? (JSON.parse(row.data) as Project) : null;
  }

  putProject(project: Project): number {
    const updatedAt = Date.now();
    this.db
      .query(
        `INSERT INTO projects (id, name, data, updated_at) VALUES ($id, $name, $data, $updatedAt)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run({ id: project.id, name: project.name, data: JSON.stringify(project), updatedAt });
    return updatedAt;
  }

  deleteProject(id: string): boolean {
    return this.db.query("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  }

  createShare(project: Project): string {
    const id = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    this.db
      .query("INSERT INTO shares (id, project_id, data, created_at) VALUES (?, ?, ?, ?)")
      .run(id, project.id, JSON.stringify(project), Date.now());
    return id;
  }

  getShare(id: string): Project | null {
    const row = this.db.query<{ data: string }, [string]>("SELECT data FROM shares WHERE id = ?").get(id);
    return row ? (JSON.parse(row.data) as Project) : null;
  }
}
