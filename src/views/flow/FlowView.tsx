import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { CircleHelp, Group, ImagePlus, LoaderCircle, Maximize, Minus, Network, Plus, RefreshCw, SquarePlus, TriangleAlert, WifiOff } from "lucide-react";
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
import { type EditorState, useEditor } from "@/store/store";
import { lineLabel, transitionLines } from "@/model/lines";
import { AREA_PAD, exitScreenId, flowPage, screenAreas } from "@/model/areas";
import { uploadScreenshot } from "@/store/actions";
import { AreaNode, type AreaNodeType } from "./AreaNode";
import { EmptyState } from "./EmptyState";
import { ExitNode, type ExitNodeType } from "./ExitNode";
import { ScreenNode, edgeHandles, isSideHandle, type ScreenNodeType } from "./ScreenNode";
import { TransitionEdge, type TransitionEdgeType } from "./TransitionEdge";

const nodeTypes = { screen: ScreenNode, area: AreaNode, exit: ExitNode };

type PageNode = ScreenNodeType | ExitNodeType;
type FlowNode = PageNode | AreaNodeType;

/** The area page that is open, or null for the full flow (also when the area is gone, e.g. renamed). */
const openPage = (s: EditorState) => (s.areaPage && [...screenAreas(s.project.screens).values()].includes(s.areaPage) ? s.areaPage : null);

/** Opens the page a screen lives on (its area, or the full flow) with that screen selected. */
function goToScreen(screenId: string) {
  const { project, setAreaPage, select } = useEditor.getState();
  setAreaPage(screenAreas(project.screens).get(screenId) ?? null);
  select({ kind: "screen", id: screenId });
}
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
  const [nodes, setNodes, onNodesChange] = useNodesState<PageNode>([]);
  const page = useEditor(openPage);
  const flow = useMemo(() => flowPage(project, page), [project, page]);

  useEffect(() => {
    const areaOf = screenAreas(project.screens);
    const exits: ExitNodeType[] = flow.exits.map((e) => ({
      id: e.id,
      type: "exit",
      position: flow.positions[e.id],
      selectable: false,
      ariaLabel: `${project.screens.find((s) => s.id === e.screenId)?.name ?? "끊어진 연결"} 화면으로 가기`,
      data: { name: project.screens.find((s) => s.id === e.screenId)?.name ?? "끊어진 연결", area: areaOf.get(e.screenId), dir: e.dir },
    }));
    setNodes([
      ...flow.screens.map((s): ScreenNodeType => {
        const selected = selection?.kind === "screen" && selection.id === s.id;
        const nodeWarnings = warnings.byScreen.get(s.id) ?? [];
        const changes = screenChanges(s).length;
        return {
          id: s.id,
          type: "screen",
          position: flow.positions[s.id],
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
      ...exits,
    ]);
  }, [flow, project.screens, selection, warnings, compareIds, setNodes]);

  // Fit each page once its nodes are on the canvas; an area page that was never laid out gets auto-arranged first.
  const { run: arrangePage } = useArrange();
  const fitted = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (fitted.current === page) return;
    const ids = new Set([...flow.screens.map((s) => s.id), ...flow.exits.map((e) => e.id)]);
    const ready = nodes.length === ids.size && nodes.every((n) => ids.has(n.id) && n.measured?.width);
    if (!ready) return;
    fitted.current = page;
    const unplaced = page && nodes.some((n) => !project.areaLayouts?.[page]?.positions[n.id]);
    if (unplaced) void arrangePage();
    else void fitView({ padding: 0.15, maxZoom: 1, duration: 300 });
  }, [page, flow, nodes, project.areaLayouts, arrangePage, fitView]);

  // Area boxes are worked out from where the screens are right now, so they follow a screen being dragged.
  const showAreas = useEditor((s) => s.showAreas);
  const areaNodes = useMemo<AreaNodeType[]>(() => {
    if (!showAreas || page) return [];
    const areaOf = screenAreas(project.screens);
    const members = new Map<string, PageNode[]>();
    for (const n of nodes) {
      const area = areaOf.get(n.id);
      if (area && n.measured?.width) members.set(area, [...(members.get(area) ?? []), n]);
    }
    return [...members].map(([name, ms]) => {
      const x = Math.min(...ms.map((n) => n.position.x)) - AREA_PAD.side;
      const y = Math.min(...ms.map((n) => n.position.y)) - AREA_PAD.top;
      const right = Math.max(...ms.map((n) => n.position.x + (n.measured?.width ?? 0))) + AREA_PAD.side;
      const bottom = Math.max(...ms.map((n) => n.position.y + (n.measured?.height ?? 0))) + AREA_PAD.side;
      return {
        id: `area:${name}`,
        type: "area",
        position: { x, y },
        width: right - x,
        height: bottom - y,
        data: { name },
        draggable: false,
        selectable: false,
        focusable: false,
        zIndex: -1,
        style: { pointerEvents: "none" },
      };
    });
  }, [nodes, project.screens, showAreas, page]);

  const edges = useMemo<TransitionEdgeType[]>(() => {
    return transitionLines(flow.transitions).map((group) => {
        const t = group[0];
        const from = flow.positions[t.from];
        const to = flow.positions[t.to];
        const selected = selection?.kind === "transition" && group.some((x) => x.id === selection.id);
        const label = lineLabel(group);
        // An arranged route only fits while both ends are still where auto-arrange put them.
        const route = flow.routes[t.id];
        const arranged = route && from && to && samePoint(route.from, from) && samePoint(route.to, to) ? route : undefined;
        return {
          id: t.id,
          type: "transition",
          source: t.from,
          target: t.to,
          ...edgeHandles(from ?? { x: 0, y: 0 }, to ?? { x: 0, y: 0 }),
          selected,
          markerEnd: { type: MarkerType.ArrowClosed, color: selected ? "#0085E4" : "#666666", width: 16, height: 16 },
          data: {
            label,
            conditional: group.every((x) => x.conditional),
            broken: group.some((x) => warnings.brokenTransitions.has(x.id)),
            route: arranged?.points,
            labelAt: arranged?.label,
          },
        };
      });
  }, [flow, selection, warnings]);

  const onChange = useCallback(
    (changes: NodeChange<FlowNode>[]) =>
      onNodesChange(
        changes.filter((c): c is NodeChange<PageNode> => (c.type === "position" || c.type === "dimensions") && !c.id.startsWith("area:")),
      ),
    [onNodesChange],
  );

  const onConnect: OnConnect = (c) => {
    if (!c.source || !c.target || c.source === c.target) return;
    addTransition({ from: c.source, to: exitScreenId(c.target), sourceElementId: elementHandle(c.sourceHandle) });
  };

  const onConnectEnd: OnConnectEnd = (event, state) => {
    if (state.isValid || !state.fromNode) return;
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    const target = document.elementFromPoint(point.clientX, point.clientY)?.closest(".react-flow__node")?.getAttribute("data-id");
    if (!target || target === state.fromNode.id || target.startsWith("area:")) return;
    addTransition({ from: state.fromNode.id, to: exitScreenId(target), sourceElementId: elementHandle(state.fromHandle?.id) });
  };

  return (
    <ReactFlow
      nodes={[...areaNodes, ...nodes] as FlowNode[]}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onChange}
      onNodeDragStop={(_, node) => moveScreen(node.id, node.position, page ?? undefined)}
      onNodeDoubleClick={(_, node) => {
        if (node.type !== "screen") return;
        // Zooming in on a screen shows it as the running app, so it can be scrolled and tapped.
        const url = project.screens.find((s) => s.id === node.id)?.live?.url;
        if (url) void checkLiveApp(url);
        useEditor.getState().setLiveScreen(node.id);
        void fitView({ nodes: [{ id: node.id }], padding: { top: "72px", bottom: "20px", x: "5%" }, maxZoom: 2.5, duration: 300 });
      }}
      zoomOnDoubleClick={false}
      onNodeClick={(e, node) => {
        if (node.type === "exit") goToScreen(exitScreenId(node.id));
        if (node.type !== "screen") return;
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
      <PageTabs page={page} />
      <div className="pointer-events-none absolute top-4 right-4 z-10 flex max-w-[calc(100%-220px)] flex-wrap justify-end gap-2 whitespace-nowrap *:pointer-events-auto max-md:left-4 max-md:max-w-none">
        <LiveNotice />
        <DevicePicker />
        <AreasButton />
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

/** Shows or hides area boxes; auto-arrange follows what is shown. */
function AreasButton() {
  const show = useEditor((s) => s.showAreas);
  const hasAreas = useEditor((s) => screenAreas(s.project.screens).size > 0);
  const onAreaPage = useEditor((s) => openPage(s) !== null);
  if (!hasAreas || onAreaPage) return null;
  return (
    <Tip label={show ? "영역 숨기기 · 자동 정렬도 영역을 무시" : "영역 보기 · 자동 정렬도 영역끼리 모음"}>
      <Button
        variant="secondary"
        size="icon"
        className={cn("bg-white shadow-soft", show && "bg-brand/10 text-brand hover:bg-brand/15")}
        aria-label="영역 보기"
        aria-pressed={show}
        onClick={() => useEditor.getState().setShowAreas(!show)}
      >
        <Group />
      </Button>
    </Tip>
  );
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** The on-canvas size of an edge label (text-xs, px-1.5, leading-4), so the layout can leave room for it. */
function labelSize(text: string) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return { text, width: text.length * 12 + 12, height: 16 };
  measureCtx.font = `12px ${getComputedStyle(document.body).fontFamily}`;
  return { text, width: Math.ceil(measureCtx.measureText(text).width) + 12, height: 16 };
}

/** Auto-arranges the open page: the full flow (by area while areas are shown) or one area's page and its exits. */
function useArrange() {
  const { getNodes, fitView } = useReactFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { autoLayout } = await import("@/lib/autoLayout");
      const state = useEditor.getState();
      const page = openPage(state);
      const flow = flowPage(state.project, page);
      const areaOf = state.showAreas && !page ? screenAreas(state.project.screens) : new Map<string, string>();
      const nodes = getNodes()
        .filter((n) => n.type === "screen" || n.type === "exit")
        .map((n) => ({ id: n.id, width: n.measured?.width ?? 0, height: n.measured?.height ?? 0, area: areaOf.get(n.id) }));
      const edges = transitionLines(flow.transitions).flatMap((line) => {
        const label = lineLabel(line);
        return line.map((t) => ({ id: t.id, from: t.from, to: t.to, label: label ? labelSize(label) : undefined }));
      });
      const layout = await autoLayout(nodes, edges);
      state.arrange(layout.positions, layout.routes, page ?? undefined);
      requestAnimationFrame(() => void fitView({ padding: 0.15, maxZoom: 1, duration: 300 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [getNodes, fitView]);
  return { run, busy, error };
}

/** The full flow and one page per feature area; each tab is a link, so pages work with back and forward. */
function PageTabs({ page }: { page: string | null }) {
  const screens = useEditor((s) => s.project.screens);
  const counts = new Map<string, number>();
  for (const area of screenAreas(screens).values()) counts.set(area, (counts.get(area) ?? 0) + 1);
  const tab = (href: string, label: string, count: number, active: boolean) => (
    <a
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {label}
      <span className="text-xs text-muted-foreground">{count}</span>
    </a>
  );
  return (
    <nav
      aria-label="흐름 페이지"
      className="absolute top-4 left-4 z-10 flex max-w-[calc(100%-560px)] gap-1 overflow-x-auto rounded-lg bg-white p-1 shadow-soft max-md:top-16 max-md:right-4 max-md:max-w-none"
    >
      {tab("#/flow", "전체", screens.length, !page)}
      {[...counts].map(([area, n]) => tab(`#/flow/${encodeURIComponent(area)}`, area, n, page === area))}
    </nav>
  );
}

function ArrangeButton() {
  const { run, busy, error } = useArrange();
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
