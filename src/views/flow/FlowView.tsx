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
import { CircleHelp, ImagePlus, Minus, Plus, RefreshCw, SquarePlus, TriangleAlert, WifiOff } from "lucide-react";
import { Tip } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompareDrawer } from "@/components/CompareDrawer";
import { DEFAULT_DEVICE, DEVICES, type DeviceId, deviceSize } from "@/model/devices";
import { screenChanges } from "@/model/diff";
import { checkLiveApp, liveStatus, useLiveApp } from "@/lib/liveApp";
import { cn } from "@/lib/utils";
import { useSync } from "@/store/persist";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import { uploadScreenshot } from "@/store/actions";
import { EmptyState } from "./EmptyState";
import { ScreenNode, edgeHandles, type ScreenNodeType } from "./ScreenNode";
import { TransitionEdge, type TransitionEdgeType } from "./TransitionEdge";

const nodeTypes = { screen: ScreenNode };
const edgeTypes = { transition: TransitionEdge };

const elementHandle = (id?: string | null) => (id && !id.startsWith("s-") ? id : undefined);

function Canvas() {
  const { fitView } = useReactFlow();
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

  const edges = useMemo<TransitionEdgeType[]>(() => {
    const groups = new Map<string, string[]>();
    for (const t of project.transitions) groups.set(`${t.from}>${t.to}`, [...(groups.get(`${t.from}>${t.to}`) ?? []), t.id]);
    return project.transitions.map((t) => {
        const group = groups.get(`${t.from}>${t.to}`) ?? [t.id];
        const offset = (group.indexOf(t.id) - (group.length - 1) / 2) * 28;
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
          data: { label: t.label, conditional: t.conditional, broken: warnings.brokenTransitions.has(t.id), offset },
        };
      });
  }, [project.transitions, project.screens, selection, warnings]);

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
      onNodeDragStop={(_, node) => moveScreen(node.id, node.position)}
      onNodeDoubleClick={(_, node) =>
        void fitView({ nodes: [{ id: node.id }], padding: { top: "72px", bottom: "20px", x: "5%" }, maxZoom: 2.5, duration: 300 })
      }
      zoomOnDoubleClick={false}
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
      maxZoom={2.5}
      className="canvas-dots"
    >
      <div className="pointer-events-none absolute top-5 left-6 z-10 text-xs font-medium text-muted-foreground max-md:hidden">
        {project.name} · 화면 {project.screens.length}
      </div>
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex max-w-[calc(100%-220px)] flex-wrap justify-end gap-2 whitespace-nowrap *:pointer-events-auto max-md:left-4 max-md:max-w-none">
        <RenderPicker />
        <DevicePicker />
        <Tip label="빈 화면 추가">
          <Button variant="secondary" size="icon" className="bg-white shadow-soft" aria-label="화면 추가" onClick={() => useEditor.getState().addScreen()}>
            <SquarePlus />
          </Button>
        </Tip>
        <Tip label="스크린샷으로 화면 추가">
          <Button variant="secondary" size="icon" className="bg-white shadow-soft" aria-label="스크린샷 올리기" onClick={() => void uploadScreenshot()}>
            <ImagePlus />
          </Button>
        </Tip>
      </div>
      <Hints comparing={compareIds.length} />
      <ZoomControls />
    </ReactFlow>
  );
}

function RenderPicker() {
  const render = useEditor((s) => s.project.render ?? "capture");
  const liveUrl = useEditor((s) => s.project.screens.find((x) => x.live)?.live?.url);
  const status = useLiveApp((s) => liveStatus(s, liveUrl));
  useEffect(() => {
    if (render === "live" && liveUrl && !status) void checkLiveApp(liveUrl);
  }, [render, liveUrl, status]);
  if (!liveUrl) return null;
  return (
    <div className="flex items-center gap-2">
      {render === "live" && status === "down" && (
        <Tip label={`${new URL(liveUrl).origin}에 연결할 수 없어 스크린샷을 보여 줍니다. 앱을 켜고 누르면 다시 확인합니다.`}>
          <button
            type="button"
            aria-label="앱 꺼짐, 다시 확인"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-warn/30 px-3 text-xs"
            onClick={() => void checkLiveApp(liveUrl)}
          >
            <WifiOff className="size-3.5" /> 앱 꺼짐 <RefreshCw className="size-3.5 text-muted-foreground" />
          </button>
        </Tip>
      )}
      <fieldset aria-label="렌더 방식" className="flex gap-1 rounded-lg bg-white p-1 shadow-soft">
        {(
          [
            ["live", "라이브"],
            ["capture", "스크린샷"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            aria-pressed={render === mode}
            onClick={() => useEditor.getState().setRender(mode)}
            className={cn("h-8 rounded-md px-3 text-sm text-muted-foreground", render === mode && "bg-muted font-bold text-foreground")}
          >
            {label}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

function DevicePicker() {
  const device = useEditor((s) => s.project.device ?? DEFAULT_DEVICE);
  const stale = useEditor((s) => {
    const size = deviceSize(s.project.device);
    return s.project.screens.filter((x) => x.baseline?.image && (x.size.w !== size.w || x.size.h !== size.h)).length;
  });
  // Only warn while the canvas shows screenshots; live screens already render at the device size.
  const showingShots = useEditor((s) => (s.project.render ?? "capture") !== "live" || !s.project.screens.some((x) => x.live));
  const repo = useSync((s) => s.repo);
  return (
    <div className="flex items-center gap-2">
      {stale > 0 && showingShots && (
        <Tip label={`기준 스크린샷 ${stale}개가 다른 기기 크기로 찍혔습니다. ${repo ? "seam capture로 다시 찍으세요." : "이 크기로 다시 올리세요."}`}>
          <button type="button" className="inline-flex h-8 cursor-default items-center gap-1.5 rounded-full bg-warn/30 px-3 text-xs">
            <TriangleAlert className="size-3.5" /> 크기 다름 {stale}
          </button>
        </Tip>
      )}
      <select
        aria-label="기기 크기"
        className="h-10 rounded-lg border-0 bg-white px-3 text-sm font-medium shadow-soft outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

const HINTS: [string, string][] = [
  ["Shift + 클릭", "두 화면 비교"],
  ["더블클릭", "그 화면으로 크게 보기"],
  ["확대율 누르기", "전체 보기"],
  ["요소를 다른 화면으로 끌기", "전이 만들기"],
];

function Hints({ comparing }: { comparing: number }) {
  return (
    <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2">
      <Popover>
        <Tip label="사용법">
          <PopoverTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full border bg-white" aria-label="사용법">
              <CircleHelp />
            </Button>
          </PopoverTrigger>
        </Tip>
        <PopoverContent side="top" align="start" className="w-auto p-3">
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-2 text-xs">
            {HINTS.map(([how, what]) => (
              <div key={how} className="contents">
                <dt className="font-bold">{how}</dt>
                <dd className="text-muted-foreground">{what}</dd>
              </div>
            ))}
          </dl>
        </PopoverContent>
      </Popover>
      {comparing === 1 && (
        <span className="inline-flex h-8 items-center rounded-full border bg-white px-3 text-xs font-bold text-brand">비교: 화면 하나 더 Shift + 클릭</span>
      )}
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
      <button type="button" className="min-w-12 text-center text-xs font-bold" title="화면에 맞추기" onClick={() => void fitView({ padding: 0.15, maxZoom: 1, duration: 300 })}>
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
