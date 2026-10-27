import type { Node, NodeProps } from "@xyflow/react";

export type AreaNodeType = Node<{ name: string }, "area">;

/** A feature area behind its screens; it follows them and cannot be picked or moved itself. */
export function AreaNode({ data }: NodeProps<AreaNodeType>) {
  return (
    <div className="relative size-full rounded-2xl border bg-foreground/[0.03]">
      <span className="absolute top-3 left-5 text-sm font-bold text-muted-foreground">{data.name}</span>
    </div>
  );
}
