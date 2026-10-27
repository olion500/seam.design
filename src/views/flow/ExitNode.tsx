import { Handle, type Node, type NodeProps } from "@xyflow/react";
import { ArrowRight } from "lucide-react";
import { SIDE_HANDLES } from "./ScreenNode";

export type ExitNodeType = Node<{ name: string; area?: string; dir: "in" | "out" }, "exit">;

/** A screen outside the area page that a line goes to or comes from; clicking it opens the page where that screen is. */
export function ExitNode({ data }: NodeProps<ExitNodeType>) {
  const arrow = <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />;
  return (
    <div className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border bg-white px-3 py-1.5 text-xs shadow-soft hover:border-brand hover:text-brand">
      {SIDE_HANDLES.map((h) => (
        <Handle key={h.id} type={h.type} id={h.id} position={h.position} isConnectable={false} className="side-handle" />
      ))}
      {data.dir === "out" && arrow}
      <span className="font-medium">{data.name}</span>
      {data.area && data.area !== data.name && <span className="text-muted-foreground">{data.area}</span>}
      {data.dir === "in" && arrow}
    </div>
  );
}
