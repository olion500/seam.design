import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import type { Point } from "@/model/types";

export type TransitionEdgeType = Edge<
  {
    label: string;
    conditional: boolean;
    broken: boolean;
    route?: Point[];
    labelAt?: Point;
    /** A move seen in the running app that the flow document lacks; its label writes it into the document. */
    onAddToDoc?: () => void;
  },
  "transition"
>;

const CORNER = 10;

/** An orthogonal route with rounded corners, and the middle of its longest segment for the label. */
export function routePath(points: Point[]): [string, number, number] {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [prev, p, next] = [points[i - 1], points[i], points[i + 1]];
    const before = Math.hypot(prev.x - p.x, prev.y - p.y);
    const after = Math.hypot(next.x - p.x, next.y - p.y);
    const r = Math.min(CORNER, before / 2, after / 2);
    const a = { x: p.x + ((prev.x - p.x) / before) * r, y: p.y + ((prev.y - p.y) / before) * r };
    const b = { x: p.x + ((next.x - p.x) / after) * r, y: p.y + ((next.y - p.y) / after) * r };
    d += ` L ${a.x} ${a.y} Q ${p.x} ${p.y} ${b.x} ${b.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  let mid = { x: (points[0].x + last.x) / 2, y: (points[0].y + last.y) / 2 };
  let longest = -1;
  for (let i = 0; i < points.length - 1; i++) {
    const len = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    if (len > longest) {
      longest = len;
      mid = { x: (points[i].x + points[i + 1].x) / 2, y: (points[i].y + points[i + 1].y) / 2 };
    }
  }
  return [d, mid.x, mid.y];
}

export function TransitionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<TransitionEdgeType>) {
  const [path, midX, midY] =
    data?.route && data.route.length > 1
      ? routePath(data.route)
      : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  // Auto-arrange leaves room for the label; elsewhere it sits in the middle of the line.
  const [labelX, labelY] = data?.route && data.labelAt ? [data.labelAt.x, data.labelAt.y] : [midX, midY];
  const app = !!data?.onAddToDoc;
  const color = selected ? "var(--brand)" : data?.broken ? "var(--warn)" : app ? "#A0A4AB" : "#666";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{ stroke: color, strokeWidth: selected ? 2.5 : app ? 1.5 : 2, strokeDasharray: app ? "2 5" : data?.conditional ? "6 6" : undefined }}
      />
      {data?.onAddToDoc && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title="앱에만 있는 이동 · 눌러서 흐름 문서에 추가"
            aria-label={`${data.label} 문서에 추가`}
            onClick={data.onAddToDoc}
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-0.5 rounded-full border border-dashed border-[#A0A4AB] bg-canvas px-1.5 text-xs leading-4 whitespace-nowrap text-muted-foreground hover:border-brand hover:text-brand"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <Plus className="size-3" />
            {data.label}
          </button>
        </EdgeLabelRenderer>
      )}
      {data?.label && !data.onAddToDoc && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded whitespace-nowrap bg-canvas px-1.5 text-xs leading-4 text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, color: selected ? "var(--brand)" : undefined }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
