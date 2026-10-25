import { BaseEdge, EdgeLabelRenderer, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";

export type TransitionEdgeType = Edge<{ label: string; conditional: boolean; broken: boolean }, "transition">;

export function TransitionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected, markerEnd }: EdgeProps<TransitionEdgeType>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const color = selected ? "var(--brand)" : data?.broken ? "var(--warn)" : "#666";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{ stroke: color, strokeWidth: selected ? 2.5 : 2, strokeDasharray: data?.conditional ? "6 6" : undefined }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded whitespace-nowrap bg-canvas px-1.5 text-[13px] leading-4 text-muted-foreground"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, color: selected ? "var(--brand)" : undefined }}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
