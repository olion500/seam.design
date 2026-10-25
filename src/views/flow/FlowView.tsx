import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  useNodesState,
  useReactFlow,
  useViewport,
  type NodeChange,
  type OnConnect,
  type OnConnectEnd,
} from "@xyflow/react";
import { ImagePlus, Minus, Plus, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompareDrawer } from "@/components/CompareDrawer";
import { DEFAULT_DEVICE, DEVICES, type DeviceId, deviceSize } from "@/model/devices";
import { screenChanges } from "@/model/diff";
import { useSync } from "@/store/persist";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import { uploadScreenshot } from "@/store/actions";
import { EmptyState } from "./EmptyState";
import { closePreview, hoverNode, leaveNode } from "./preview";
import { ScreenNode, edgeHandles, type ScreenNodeType } from "./ScreenNode";
import { TransitionEdge, type TransitionEdgeType } from "./TransitionEdge";

const nodeTypes = { screen: ScreenNode };
const edgeTypes = { transition: TransitionEdge };

const elementHandle = (id?: string | null) => (id && !id.startsWith("s-") ? id : undefined);

function Canvas() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const compareIds = useEditor((s) => s.compareIds);
  const { select, toggleCompare, moveScreen, addTransition } = useEditor.getState();
  const { warnings } = useRuleState();
  const [nodes, setNodes, onNodesChange] = useNodesState<ScreenNodeType>([]);

  useEffect(() => {
    setNodes(
      project.screens.map((s) => {
        const selected = selection?.kind === "screen" && selection.id === s.id;
        const nodeWarnings = warnings.byScreen.get(s.id) ?? [];
        const changes = screenChanges(s).length;
        return {
          id: s.id,
          type: "screen",
          position: s.position,
          selected,
          ariaLabel: [
            `${s.name} 화면`,
            s.variant ? "시안" : "기준",
            changes ? `변경 ${changes}건` : null,
            nodeWarnings.length ? `경고: ${nodeWarnings.join(", ")}` : null,
            selected ? "선택됨" : null,
          ]
            .filter(Boolean)
            .join(", "),
          data: { screenId: s.id, warnings: nodeWarnings, comparing: compareIds.includes(s.id) },
        };
      }),
    );
  }, [project.screens, selection, warnings, compareIds, setNodes]);

  const edges = useMemo<TransitionEdgeType[]>(
    () =>
      project.transitions.map((t) => {
        const from = project.screens.find((s) => s.id === t.from);
        const to = project.screens.find((s) => s.id === t.to);
        const selected = selection?.kind === "transition" && selection.id === t.id;
        return {
          id: t.id,
          type: "transition",
          source: t.from,
          target: t.to,
          ...edgeHandles(from?.position ?? { x: 0, y: 0 }, to?.position ?? { x: 0, y: 0 }),
          selected,
          markerEnd: { type: MarkerType.ArrowClosed, color: selected ? "#0085E4" : "#666666", width: 16, height: 16 },
          data: { label: t.label, conditional: t.conditional, broken: warnings.brokenTransitions.has(t.id) },
        };
      }),
    [project.transitions, project.screens, selection, warnings],
  );

  const onChange = useCallback(
    (changes: NodeChange<ScreenNodeType>[]) => onNodesChange(changes.filter((c) => c.type === "position" || c.type === "dimensions")),
    [onNodesChange],
  );

  const onConnect: OnConnect = (c) => {
    if (!c.source || !c.target || c.source === c.target) return;
    addTransition({ from: c.source, to: c.target, sourceElementId: elementHandle(c.sourceHandle) });
  };

  const onConnectEnd: OnConnectEnd = (event, state) => {
    if (state.isValid || !state.fromNode) return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    const target = document.elementFromPoint(point.clientX, point.clientY)?.closest(".react-flow__node")?.getAttribute("data-id");
    if (!target || target === state.fromNode.id) return;
    addTransition({ from: state.fromNode.id, to: target, sourceElementId: elementHandle(state.fromHandle?.id) });
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onChange}
      onNodeDragStart={closePreview}
      onNodeDragStop={(_, node) => moveScreen(node.id, node.position)}
      onNodeMouseEnter={(_, node) => hoverNode(node.id)}
      onNodeMouseLeave={leaveNode}
      onMoveStart={closePreview}
      onNodeClick={(e, node) => {
        if (e.shiftKey) toggleCompare(node.id);
        else select({ kind: "screen", id: node.id });
      }}
      onEdgeClick={(_, edge) => select({ kind: "transition", id: edge.id })}
      onPaneClick={() => select(null)}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      isValidConnection={(c) => c.source !== c.target}
      connectionRadius={36}
      deleteKeyCode={null}
      selectionKeyCode={null}
      multiSelectionKeyCode={null}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={2}
      className="canvas-dots"
    >
      <div className="pointer-events-none absolute top-5 left-6 z-10 text-sm font-bold tracking-wider text-muted-foreground">
        {project.name} · 화면 {project.screens.length}
      </div>
      <div className="absolute top-4 right-4 z-10 flex flex-wrap justify-end gap-2">
        <DevicePicker />
        <Button variant="secondary" className="bg-white shadow-soft" onClick={() => useEditor.getState().addScreen()}>
          <SquarePlus /> 화면 추가
        </Button>
        <Button variant="secondary" className="bg-white shadow-soft" onClick={() => void uploadScreenshot()}>
          <ImagePlus /> 스크린샷 올리기
        </Button>
      </div>
      <Hints comparing={compareIds.length} />
      <ZoomControls />
    </ReactFlow>
  );
}

function DevicePicker() {
  const device = useEditor((s) => s.project.device ?? DEFAULT_DEVICE);
  const stale = useEditor((s) => {
    const size = deviceSize(s.project.device);
    return s.project.screens.filter((x) => x.baseline?.image && (x.size.w !== size.w || x.size.h !== size.h)).length;
  });
  const repo = useSync((s) => s.repo);
  return (
    <div className="flex items-center gap-2">
      {stale > 0 && (
        <span className="rounded-full bg-warn/30 px-3 py-1.5 text-[13px]" title={repo ? "AI에게 “seam으로 다시 캡처해 줘”라고 하거나 seam capture를 실행하세요" : "이 기기 크기로 스크린샷을 다시 올리세요"}>
          기준 스크린샷 {stale}개는 다른 기기 크기 · {repo ? "seam capture로 다시 찍기" : "다시 올리기"}
        </span>
      )}
      <select
        aria-label="기기 크기"
        className="h-10 rounded-lg border-0 bg-white px-3 text-sm font-[550] shadow-soft outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={device}
        onChange={(e) => useEditor.getState().setDevice(e.target.value as DeviceId)}
      >
        {Object.values(DEVICES).map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} · {d.width}×{d.height}
          </option>
        ))}
      </select>
    </div>
  );
}

function Hints({ comparing }: { comparing: number }) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-200px)] flex-wrap gap-2">
      <span className="inline-flex h-8 items-center gap-2 rounded-full border bg-white px-3 text-[13px]">
        <kbd className="rounded bg-chip px-1.5 text-xs font-bold">Shift</kbd>+클릭으로 화면 비교
        {comparing === 1 && <b className="text-brand">· 1개 선택됨, 하나 더</b>}
      </span>
      <span className="inline-flex h-8 items-center rounded-full border bg-white px-3 text-[13px]">화면 속 요소를 다른 노드로 끌면 전이 생성</span>
    </div>
  );
}

function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <fieldset aria-label="확대 축소" className="absolute right-4 bottom-4 z-10 flex items-center gap-1 rounded-lg border bg-white p-1">
      <Button variant="ghost" size="icon" aria-label="축소" onClick={() => zoomOut()}>
        <Minus />
      </Button>
      <button type="button" className="min-w-12 text-center text-[13px] font-bold" title="화면에 맞추기" onClick={() => fitView({ padding: 0.15 })}>
        {Math.round(zoom * 100)}%
      </button>
      <Button variant="ghost" size="icon" aria-label="확대" onClick={() => zoomIn()}>
        <Plus />
      </Button>
    </fieldset>
  );
}

export function FlowView() {
  const empty = useEditor((s) => s.project.screens.length === 0);
  const comparing = useEditor((s) => s.compareIds.length >= 2);
  return (
    <main aria-label="흐름 캔버스" className="relative flex min-w-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {empty ? (
          <EmptyState />
        ) : (
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        )}
      </div>
      {comparing && <CompareDrawer />}
    </main>
  );
}
