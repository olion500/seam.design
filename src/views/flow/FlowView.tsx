import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  MarkerType,
  useNodesState,
  useReactFlow,
  useStore,
  useViewport,
  type NodeChange,
  type OnConnect,
  type OnConnectEnd,
} from "@xyflow/react";
import { CircleHelp, ImagePlus, LoaderCircle, Maximize, Minus, Network, Plus, RefreshCw, SquarePlus, TriangleAlert, WifiOff } from "lucide-react";
import { Tip } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompareDrawer } from "@/components/CompareDrawer";
import { DEFAULT_DEVICE, DEVICES, type DeviceId, deviceSize } from "@/model/devices";
import { screenChanges } from "@/model/diff";
import { liveOverrides } from "@/model/tokens";
import { checkLiveApp, liveStatus, useLiveApp } from "@/lib/liveApp";
import { cn } from "@/lib/utils";
import { useSync } from "@/store/persist";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import type { Transition } from "@/model/types";
import { uploadScreenshot } from "@/store/actions";
import { EmptyState } from "./EmptyState";
import { ScreenNode, edgeHandles, isSideHandle, type ScreenNodeType } from "./ScreenNode";
import { TransitionEdge, type TransitionEdgeType } from "./TransitionEdge";

const nodeTypes = { screen: ScreenNode };
const edgeTypes = { transition: TransitionEdge };

const elementHandle = (id?: string | null) => (id && !isSideHandle(id) ? id : undefined);
const samePoint = (a: { x: number; y: number }, b?: { x: number; y: number }) => !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

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
    // Transitions between the same two screens in the same direction are drawn as one line, named after the first.
    const groups = new Map<string, Transition[]>();
    for (const t of project.transitions) groups.set(`${t.from}>${t.to}`, [...(groups.get(`${t.from}>${t.to}`) ?? []), t]);
    return [...groups.values()].map((group) => {
        const t = group[0];
        const from = project.screens.find((s) => s.id === t.from);
        const to = project.screens.find((s) => s.id === t.to);
        const selected = selection?.kind === "transition" && group.some((x) => x.id === selection.id);
        const label = group.length > 1 ? `${t.label} +${group.length - 1}` : t.label;
        // An arranged route only fits while both screens are still where auto-arrange put them.
        const route = t.route && from && to && samePoint(t.route.from, from.position) && samePoint(t.route.to, to.position) ? t.route.points : undefined;
        return {
          id: t.id,
          type: "transition",
          source: t.from,
          target: t.to,
          ...edgeHandles(from?.position ?? { x: 0, y: 0 }, to?.position ?? { x: 0, y: 0 }),
          selected,
          markerEnd: { type: MarkerType.ArrowClosed, color: selected ? "#0085E4" : "#666666", width: 16, height: 16 },
          data: {
            label,
            conditional: group.every((x) => x.conditional),
            broken: group.some((x) => warnings.brokenTransitions.has(x.id)),
            route,
          },
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
      onNodeDoubleClick={(_, node) => {
        // Zooming in on a screen shows it as the running app, so it can be scrolled and tapped.
        const url = project.screens.find((s) => s.id === node.id)?.live?.url;
        if (url) void checkLiveApp(url);
        useEditor.getState().setLiveScreen(node.id);
        void fitView({ nodes: [{ id: node.id }], padding: { top: "72px", bottom: "20px", x: "5%" }, maxZoom: 2.5, duration: 300 });
      }}
      zoomOnDoubleClick={false}
      onNodeClick={(e, node) => {
        if (e.shiftKey) toggleCompare(node.id);
        else select({ kind: "screen", id: node.id });
      }}
      onEdgeClick={(_, edge) => select({ kind: "transition", id: edge.id })}
      onPaneClick={() => {
        select(null);
        useEditor.getState().setLiveScreen(null);
      }}
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
        <LiveNotice />
        <DevicePicker />
        <ArrangeButton />
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

function ArrangeButton() {
  const { getNodes, fitView } = useReactFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const { autoLayout } = await import("@/lib/autoLayout");
      const { project, arrange } = useEditor.getState();
      const nodes = getNodes().map((n) => ({ id: n.id, width: n.measured?.width ?? 0, height: n.measured?.height ?? 0 }));
      const layout = await autoLayout(nodes, project.transitions);
      arrange(layout.positions, layout.routes);
      requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1, duration: 300 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Tip label={error ? `자동 정렬 실패: ${error}` : "자동 정렬 · 선이 덜 꼬이게 다시 배치"}>
      <Button
        variant="secondary"
        size="icon"
        className={cn("bg-white shadow-soft", error && "text-destructive")}
        aria-label="자동 정렬"
        disabled={busy}
        onClick={() => void run()}
      >
        {busy ? <LoaderCircle className="animate-spin" /> : <Network />}
      </Button>
    </Tip>
  );
}

/** Checks the app only when a screen needs it, and speaks up only when an edited token cannot be shown. */
function LiveNotice() {
  const liveUrl = useEditor((s) => s.project.screens.find((x) => x.live)?.live?.url);
  const tokensEdited = useEditor((s) => Object.keys(liveOverrides(s.project)).length > 0);
  const zoomed = useEditor((s) => s.liveScreen !== null);
  const status = useLiveApp((s) => liveStatus(s, liveUrl));
  useEffect(() => {
    if ((tokensEdited || zoomed) && liveUrl && !status) void checkLiveApp(liveUrl);
  }, [tokensEdited, zoomed, liveUrl, status]);
  if (!liveUrl || !tokensEdited || status !== "down") return null;
  return (
    <Tip label={`${new URL(liveUrl).origin}에 연결할 수 없어 바꾼 토큰을 화면에 보여 줄 수 없습니다. 앱을 켜고 누르면 다시 확인합니다.`}>
      <button
        type="button"
        aria-label="앱 꺼짐, 다시 확인"
        className="inline-flex h-8 items-center gap-1.5 self-center rounded-full bg-warn/30 px-3 text-xs"
        onClick={() => void checkLiveApp(liveUrl)}
      >
        <WifiOff className="size-3.5" /> 앱 꺼짐 <RefreshCw className="size-3.5 text-muted-foreground" />
      </button>
    </Tip>
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
  const flow = useStore((s) => s.domNode);
  // Lets canvas CSS keep handles at the same on-screen size whatever the zoom.
  useEffect(() => {
    flow?.style.setProperty("--flow-inv-zoom", String(1 / zoom));
  }, [flow, zoom]);
  return (
    <fieldset aria-label="확대 축소" className="absolute right-4 bottom-4 z-10 flex items-center gap-1 rounded-lg border bg-white p-1">
      <Button variant="ghost" size="icon" aria-label="축소" onClick={() => zoomOut()}>
        <Minus />
      </Button>
      <output className="min-w-12 text-center text-xs font-bold" aria-label="현재 확대율">
        {Math.round(zoom * 100)}%
      </output>
      <Button variant="ghost" size="icon" aria-label="확대" onClick={() => zoomIn()}>
        <Plus />
      </Button>
      <Tip label="화면에 맞추기">
        <Button
          variant="ghost"
          size="icon"
          aria-label="화면에 맞추기"
          onClick={() => {
            useEditor.getState().setLiveScreen(null);
            void fitView({ padding: 0.15, maxZoom: 1, duration: 300 });
          }}
        >
          <Maximize />
        </Button>
      </Tip>
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
