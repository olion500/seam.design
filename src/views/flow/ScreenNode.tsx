import { memo, useState } from "react";
import { Handle, NodeToolbar, Position, type Node, type NodeProps } from "@xyflow/react";
import { ScreenView } from "@/components/ScreenView";
import { StatusBadge, WarnIcon } from "@/components/bits";
import { screenChanges } from "@/model/diff";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";
import { keepPreview, leaveNode, usePreview } from "./preview";

export const NODE_WIDTH = 160;
const THUMB = NODE_WIDTH - 16;
const INTERACTIVE = new Set(["button", "listItem", "text", "field"]);

const SIDE_HANDLES = [
  { id: "s-right", type: "source", position: Position.Right, style: { top: "45%" } },
  { id: "t-left", type: "target", position: Position.Left, style: { top: "45%" } },
  { id: "s-left", type: "source", position: Position.Left, style: { top: "55%" } },
  { id: "t-right", type: "target", position: Position.Right, style: { top: "55%" } },
  { id: "s-bottom", type: "source", position: Position.Bottom, style: { left: "40%" } },
  { id: "t-top", type: "target", position: Position.Top, style: { left: "40%" } },
  { id: "s-top", type: "source", position: Position.Top, style: { left: "60%" } },
  { id: "t-bottom", type: "target", position: Position.Bottom, style: { left: "60%" } },
] as const;

export function edgeHandles(from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? { sourceHandle: "s-bottom", targetHandle: "t-top" } : { sourceHandle: "s-top", targetHandle: "t-bottom" };
  return dx >= 0 ? { sourceHandle: "s-right", targetHandle: "t-left" } : { sourceHandle: "s-left", targetHandle: "t-right" };
}

export type ScreenNodeType = Node<{ screenId: string; warnings: string[]; comparing: boolean }, "screen">;

function ScreenNodeImpl({ data, selected }: NodeProps<ScreenNodeType>) {
  const screen = useEditor((s) => s.project.screens.find((x) => x.id === data.screenId));
  const tokens = useEditor((s) => s.project.tokens);
  const focusChange = useEditor((s) => s.focusChange);
  const hover = usePreview((s) => s.id === data.screenId);
  const [previewMode, setPreviewMode] = useState<"baseline" | "variant">("baseline");

  if (!screen) return null;
  const changes = screenChanges(screen);
  const changedIds = new Set(changes.map((c) => c.elementId).filter((x): x is string => !!x));
  const focusId = selected ? changes.find((c) => c.id === focusChange)?.elementId : null;
  const hasVariant = !!screen.variant;

  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 rounded-lg border bg-white p-2 shadow-soft transition-transform",
        selected && "border-2 border-brand p-[7px] shadow-[0_0_0_4px_rgb(0_133_228/0.16)]",
        data.comparing && !selected && "border-primary",
        hover && "-translate-y-0.5",
      )}
      style={{ width: NODE_WIDTH }}
    >
      {SIDE_HANDLES.map((h) => (
        <Handle key={h.id} type={h.type} id={h.id} position={h.position} isConnectable={h.type === "source"} className="side-handle" style={h.style} />
      ))}
      <div className="overflow-hidden rounded bg-muted">
        <ScreenView
          screen={screen}
          mode="variant"
          width={THUMB}
          tokens={tokens}
          changedIds={changedIds}
          layoutChanged={changes.some((c) => c.elementId === null)}
          focusId={focusId}
          overlay={(el) =>
            INTERACTIVE.has(el.kind) ? (
              <Handle
                type="source"
                id={el.id}
                position={Position.Right}
                title={`${el.name}: 다른 화면으로 끌어 전이 만들기`}
                className="el-handle"
              />
            ) : null
          }
        />
      </div>
      <div className="flex h-6 items-center justify-between gap-1.5">
        <span className="truncate text-[13px] font-bold">{screen.name}</span>
        <StatusBadge variant={hasVariant} />
      </div>
      {data.warnings.length > 0 && <WarnIcon title={data.warnings.join("\n")} className="absolute -top-2.5 -right-2.5" />}

      <NodeToolbar
        isVisible={hover}
        position={Position.Right}
        offset={16}
        onMouseEnter={keepPreview}
        onMouseLeave={leaveNode}
        aria-label={`${screen.name} 미리 보기`}
      >
        <div className="flex w-[232px] flex-col gap-2.5 rounded-xl bg-white p-3 shadow-pop">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold">{screen.name}</span>
            <span className="text-xs text-muted-foreground">미리 보기</span>
          </div>
          <fieldset aria-label="기준 또는 시안 보기" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["baseline", "variant"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={previewMode === m}
                disabled={m === "variant" && !hasVariant}
                onClick={() => setPreviewMode(m)}
                className={cn(
                  "h-9 rounded-md text-sm text-muted-foreground disabled:opacity-40",
                  previewMode === m && "bg-white font-bold text-foreground shadow-soft",
                )}
              >
                {m === "baseline" ? "기준" : "시안"}
              </button>
            ))}
          </fieldset>
          <div className="overflow-hidden rounded-md">
            <ScreenView screen={screen} mode={previewMode} width={208} tokens={tokens} />
          </div>
          <span className="text-xs text-muted-foreground">
            {previewMode === "variant" && screen.variant
              ? `시안 v${screen.variant.version} · ${screen.variant.updatedAt}`
              : screen.baseline
                ? `기준 · ${screen.baseline.capturedAt ?? ""}`
                : "기준 이미지 없음"}
          </span>
        </div>
      </NodeToolbar>
    </div>
  );
}

export const ScreenNode = memo(ScreenNodeImpl);
