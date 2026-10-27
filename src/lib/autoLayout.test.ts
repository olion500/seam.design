import ELK from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";
import { autoLayout, countCrossings } from "./autoLayout";

const W = 160;
const H = 370;
const nodes = ["HOME", "LIST", "DETAIL", "EDIT", "PREP", "BREW"].map((id) => ({ id, width: W, height: H }));
const edges = [
  { id: "a", from: "HOME", to: "LIST" },
  { id: "a2", from: "HOME", to: "LIST" },
  { id: "b", from: "LIST", to: "DETAIL" },
  { id: "c", from: "DETAIL", to: "EDIT" },
  { id: "d", from: "EDIT", to: "DETAIL" },
  { id: "e", from: "DETAIL", to: "PREP" },
  { id: "f", from: "HOME", to: "PREP" },
  { id: "g", from: "PREP", to: "BREW" },
  { id: "h", from: "BREW", to: "HOME" },
  { id: "self", from: "HOME", to: "HOME" },
];

describe("autoLayout", () => {
  it("places every screen without overlaps and routes each transition from its source to its target", async () => {
    const { positions, routes } = await autoLayout(nodes, edges, new ELK());
    expect(Object.keys(positions).sort()).toEqual(nodes.map((n) => n.id).sort());
    const placed = Object.values(positions);
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) expect(Math.abs(placed[i].x - placed[j].x) >= W || Math.abs(placed[i].y - placed[j].y) >= H).toBe(true);

    expect(Object.keys(routes).sort()).toEqual(["a", "a2", "b", "c", "d", "e", "f", "g", "h"]);
    // Transitions between the same two screens share one line.
    expect(routes.a2.points).toEqual(routes.a.points);
    const onBorder = (p: { x: number; y: number }, id: string) => {
      const n = positions[id];
      const within = p.x >= n.x - 1 && p.x <= n.x + W + 1 && p.y >= n.y - 1 && p.y <= n.y + H + 1;
      const edge = [n.x, n.x + W].some((x) => Math.abs(p.x - x) < 1) || [n.y, n.y + H].some((y) => Math.abs(p.y - y) < 1);
      return within && edge;
    };
    for (const e of edges.filter((x) => x.from !== x.to)) {
      const r = routes[e.id];
      expect(onBorder(r.points[0], e.from)).toBe(true);
      expect(onBorder(r.points.at(-1)!, e.to)).toBe(true);
      expect(r.from).toEqual(positions[e.from]);
      expect(r.to).toEqual(positions[e.to]);
    }
  });
});

describe("countCrossings", () => {
  it("counts each point where two routes cross, and not routes that only meet at an end", () => {
    const cross = [
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
      [{ x: 0, y: 10 }, { x: 10, y: 0 }],
    ];
    expect(countCrossings(cross)).toBe(1);
    expect(countCrossings([...cross, [{ x: 5, y: -5 }, { x: 5, y: 20 }]])).toBe(3);
    expect(countCrossings([[{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 10, y: 0 }, { x: 10, y: 10 }]])).toBe(0);
  });
});
