import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { LiveFrame } from "@/components/LiveFrame";
import { ScreenView } from "@/components/ScreenView";
import { StatusBadge, WarnIcon } from "@/components/bits";
import { deviceOf } from "@/model/devices";
import { liveOverrides } from "@/model/tokens";
import { screenChanges } from "@/model/diff";
import { liveStatus, useLiveApp } from "@/lib/liveApp";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

const NODE_SCALE = 0.4;
const SCREEN_RADIUS = 6;
const INTERACTIVE = new Set(["button", "listItem", "text", "field"]);

export const SIDE_HANDLES = [
  { id: "s-right", type: "source", position: Position.Right, style: { top: "45%" } },
  { id: "t-left", type: "target", position: Position.Left, style: { top: "45%" } },
  { id: "s-left", type: "source", position: Position.Left, style: { top: "55%" } },
  { id: "t-right", type: "target", position: Position.Right, style: { top: "55%" } },
  { id: "s-bottom", type: "source", position: Position.Bottom, style: { left: "40%" } },
  { id: "t-top", type: "target", position: Position.Top, style: { left: "40%" } },
  { id: "s-top", type: "source", position: Position.Top, style: { left: "60%" } },
  { id: "t-bottom", type: "target", position: Position.Bottom, style: { left: "60%" } },
] as const;

// What the user drags to start a transition: one dot centred on each side. The side handles above stay hidden and
// only decide where lines attach, offset so lines running both ways between two screens do not overlap.
// Left and right dots sit at the middle of the phone screen, which starts below the 26px name row.
const SCREEN_MIDDLE = { top: "calc(50% + 13px)" };
const DRAG_HANDLES = [
  { id: "drag-right", position: Position.Right, style: SCREEN_MIDDLE },
  { id: "drag-left", position: Position.Left, style: SCREEN_MIDDLE },
  { id: "drag-top", position: Position.Top, style: undefined },
  { id: "drag-bottom", position: Position.Bottom, style: undefined },
] as const;

export const isSideHandle = (id?: string | null) => !!id && (id.startsWith("s-") || id.startsWith("drag-"));

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
  // Screenshots by default; the running app only where it shows something the screenshot cannot.
  const tokensEdited = useEditor((s) => Object.keys(liveOverrides(s.project)).length > 0);
  const zoomed = useEditor((s) => s.liveScreen === data.screenId);
  const appUp = useLiveApp((s) => liveStatus(s, screen?.live?.url) === "up");
  const showLive = appUp && !!screen?.live && (tokensEdited || zoomed);
  const device = deviceOf(useEditor((s) => s.project.device));

  if (!screen) return null;
  const changes = screenChanges(screen);
  const changedIds = new Set(changes.map((c) => c.elementId).filter((x): x is string => !!x));
  const focusId = selected ? changes.find((c) => c.id === focusChange)?.elementId : null;
  const hasVariant = !!screen.variant;
  const frame = showLive ? { w: device.width, h: device.height } : screen.size;
  const thumbW = Math.round(frame.w * NODE_SCALE);
  const thumbH = Math.round((frame.h * thumbW) / frame.w);

  const requests = screen.requests?.length ?? 0;

  return (
    <div className={"relative flex flex-col gap-1.5 transition-transform hover:-translate-y-0.5"} style={{ width: thumbW }}>
      {SIDE_HANDLES.map((h) => (
        <Handle key={h.id} type={h.type} id={h.id} position={h.position} isConnectable={false} className="side-handle" style={h.style} />
      ))}
      {DRAG_HANDLES.map((h) => (
        <Handle key={h.id} type="source" id={h.id} position={h.position} style={h.style} className="drag-handle" title="끌어서 다른 화면에 놓으면 전이 만들기" />
      ))}
      <div className="flex h-5 min-w-0 items-center gap-1.5 text-xs">
        <span className={cn("max-w-[75%] shrink-0 truncate font-medium", selected ? "text-brand" : "text-muted-foreground")}>{screen.name}</span>
        {screen.route && <span className="min-w-0 truncate text-muted-foreground/70">{screen.route}</span>}
        <span className="ml-auto flex shrink-0 gap-1">
          {hasVariant && <StatusBadge variant>시안</StatusBadge>}
          {requests > 0 && <span className="inline-flex h-5 items-center rounded-full bg-change px-2 text-xs font-bold text-white">요청 {requests}</span>}
        </span>
      </div>
      <div
        className={cn(
          "relative overflow-hidden border bg-muted shadow-soft",
          selected && "outline-2 outline-offset-2 outline-brand",
          data.comparing && !selected && "outline-2 outline-offset-2 outline-primary",
        )}
        style={{ width: thumbW, height: thumbH, borderRadius: SCREEN_RADIUS * NODE_SCALE }}
      >
        {showLive && screen.live && (
          <div className={cn("absolute inset-0 z-[1]", zoomed ? "nodrag nowheel nopan" : "pointer-events-none")}>
            <LiveFrame screen={screen} url={screen.live.url} width={thumbW} compact interactive={zoomed} />
          </div>
        )}
        <ScreenView
          screen={screen}
          mode="variant"
          width={thumbW}
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
      {data.warnings.length > 0 && <WarnIcon title={data.warnings.join("\n")} className="absolute top-4 -right-2.5" />}

    </div>
  );
}

export const ScreenNode = memo(ScreenNodeImpl);
