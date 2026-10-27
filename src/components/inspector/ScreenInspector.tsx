import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ExternalLink, Globe, ImagePlus, MousePointerClick, SquareDashed, Trash2, TriangleAlert, X } from "lucide-react";
import { CaptureDialog } from "@/components/CaptureDialog";
import { ScreenView } from "@/components/ScreenView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddButton, Eyebrow, Field, Prop, Section, StatusBadge, Tip, Toggle, blurOnEnter, quietInput, selectClass } from "@/components/bits";
import { deviceOf } from "@/model/devices";
import { screenChanges } from "@/model/diff";
import { tokensInSpec } from "@/model/tokens";
import type { Box, ButtonVariant, CapturedElement, Screen, ScreenElement, ScreenSpec } from "@/model/types";
import { imageSrc } from "@/lib/api";
import { uploadBaseline } from "@/store/actions";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

export function ScreenInspector({ screen }: { screen: Screen }) {
  const project = useEditor((s) => s.project);
  const focusChange = useEditor((s) => s.focusChange);
  const ed = useEditor.getState();
  const { results } = useRuleState();
  const changes = screenChanges(screen);
  const outgoing = project.transitions.filter((t) => t.from === screen.id);
  const spec = screen.variant?.spec ?? screen.baseline?.spec;
  const screenRules = results.filter((r) => r.rule.enabled && r.scopeLabel === "화면");
  const [capturing, setCapturing] = useState(false);
  const device = deviceOf(project.device);
  const imported = !!screen.route && !screen.baseline?.spec;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Eyebrow>화면</Eyebrow>
          <input
            aria-label="화면 이름"
            onKeyDown={blurOnEnter}
            value={screen.name}
            onChange={(e) => ed.updateScreen(screen.id, { name: e.target.value })}
            className="-mx-1 rounded px-1 text-xl font-bold outline-none focus:bg-muted"
          />
          {(screen.variant || !!screen.requests?.length) && (
            <div className="flex items-center gap-1.5">
              {screen.variant && <StatusBadge variant>시안 v{screen.variant.version}</StatusBadge>}
              {!screen.variant && <span className="inline-flex h-5 items-center rounded-full bg-change px-2 text-xs font-bold text-white">요청 {screen.requests?.length}</span>}
              <span className="text-xs text-muted-foreground">기준 대비 변경 {changes.length}건</span>
            </div>
          )}
        </div>
        <HeaderActions onDelete={() => ed.removeScreen(screen.id)} deleteLabel="화면 삭제" />
      </div>

      {screen.baseline?.elements && <RequestEditor screen={screen} />}

      <Section title="속성">
        <div className="grid grid-cols-2 gap-4">
          <Prop label="크기">
            {device.width} × {device.height}
            <span className="block text-xs text-muted-foreground">{device.name}</span>
          </Prop>
          <Prop label="기준">
            <span className="flex items-center gap-1.5">
              {screen.baseline ? screen.baseline.capturedAt ?? "있음" : "없음"}
              <button type="button" className="text-muted-foreground hover:text-brand" onClick={() => void uploadBaseline(screen.id)} aria-label="기준 스크린샷 올리기" title="스크린샷 올리기">
                <ImagePlus className="size-4" />
              </button>
              <button type="button" className="text-muted-foreground hover:text-brand" onClick={() => setCapturing(true)} aria-label="URL에서 기준 캡처" title="주소에서 캡처">
                <Globe className="size-4" />
              </button>
            </span>
          </Prop>
        </div>
        {!imported && (
          <Prop label="시안">
            {screen.variant ? (
              `v${screen.variant.version} · ${screen.variant.updatedAt}`
            ) : (
              <Button size="sm" variant="brand" onClick={() => ed.createVariant(screen.id)}>
                시안 만들기
              </Button>
            )}
          </Prop>
        )}
        <Field label="앱 주소">
          <AppUrl key={screen.live?.url ?? ""} screen={screen} />
        </Field>
        <Field label="상태">
          <Input
            aria-label="화면 상태"
            onKeyDown={blurOnEnter}
            className={cn("h-9", quietInput)}
            defaultValue={screen.states.join(" · ")}
            onBlur={(e) => ed.updateScreen(screen.id, { states: e.target.value.split(/[·,]/).map((x) => x.trim()).filter(Boolean) })}
          />
        </Field>
        <Toggle label="마지막 화면" checked={!!screen.terminal} onChange={(v) => ed.updateScreen(screen.id, { terminal: v })} />
      </Section>

      {screen.variant && (
        <Section title="변경 내역">
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">기준과 같음</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {changes.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => ed.setFocusChange(focusChange === c.id ? null : c.id)}
                    className={cn("flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left", focusChange === c.id ? "bg-muted" : "hover:bg-muted/60")}
                  >
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-change" />
                    {c.summary}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {screen.variant && <VariantEditor screen={screen} spec={screen.variant.spec} />}

      <CaptureDialog
        open={capturing}
        onOpenChange={setCapturing}
        initialUrl={screen.baseline?.url ?? screen.live?.url ?? ""}
        onCaptured={(image, url) => ed.setBaselineImage(screen.id, image, url)}
      />

      {screenRules.length > 0 && spec && (
        <Section title="규칙" action={<LinkButton onClick={() => ed.setView("rules")}>규칙 보기</LinkButton>}>
          <ul className="flex flex-col gap-2 text-sm">
            {screenRules.map((r) => {
              const v = r.violations.filter((x) => x.screenId === screen.id);
              return (
                <li key={r.rule.id} className="flex items-center gap-2.5">
                  {v.length ? <TriangleAlert className="size-4 text-warn" /> : <Check className="size-4" strokeWidth={2.5} />}
                  <span className="flex-1">{r.rule.title}</span>
                  <span className={v.length ? "font-bold" : "text-muted-foreground"}>{v.length ? `위반 ${v.length}` : "통과"}</span>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      <SourcesEditor screen={screen} tokens={spec ? tokensInSpec(spec) : []} />

      <Section title="나가는 전이">
        {screen.exitsOutside?.length ? (
          <Tip label={screen.exitsOutside.join(", ")}>
            <span tabIndex={-1} className="self-start text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
              가져오지 않은 화면 {screen.exitsOutside.length}곳으로도 나감
            </span>
          </Tip>
        ) : null}
        {outgoing.length === 0 ? (
          !screen.exitsOutside?.length &&
          <p className="text-sm text-muted-foreground">없음</p>
        ) : (
          outgoing.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => ed.select({ kind: "transition", id: t.id })}
              className="flex min-h-12 items-center gap-3 rounded-xl bg-muted px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <ArrowRight className="size-4" />
              <span className="flex-1">
                <b>{project.screens.find((s) => s.id === t.to)?.name ?? "끊어진 연결"}</b> · {t.label}
              </span>
              <span className="text-muted-foreground">{project.motions.find((m) => m.id === t.motionId)?.name}</span>
            </button>
          ))
        )}
      </Section>

      {screen.variant && (
        <Section title="시안">
          <Button variant="secondary" size="sm" className="self-start" onClick={() => ed.discardVariant(screen.id)}>
            <Trash2 /> 시안 버리기
          </Button>
        </Section>
      )}
    </>
  );
}

function RequestEditor({ screen }: { screen: Screen }) {
  const tokens = useEditor((s) => s.project.tokens);
  const ed = useEditor.getState();
  const elements = screen.baseline?.elements ?? [];
  const [composing, setComposing] = useState(false);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (composing) noteRef.current?.focus();
  }, [composing]);
  const [elementKey, setElementKey] = useState("");
  const [area, setArea] = useState<Box | null>(null);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const requests = screen.requests ?? [];
  const name = (r: { elementKey?: string; area?: Box }) => elements.find((e) => e.key === r.elementKey)?.label ?? (r.area ? "고른 영역" : "화면 전체");
  const picked = elements.find((e) => e.key === elementKey);
  const canAdd = !!label.trim() || !!note.trim();

  const close = () => {
    setComposing(false);
    setElementKey("");
    setArea(null);
    setLabel("");
    setNote("");
  };
  const pick = (key: string) => {
    setElementKey(key);
    setArea(null);
    if (key) setComposing(true);
  };
  const pickArea = (box: Box) => {
    setArea(box);
    setElementKey("");
    setLabel("");
    setComposing(true);
    noteRef.current?.focus();
  };
  const submit = () => {
    if (!canAdd) return;
    ed.addRequest(screen.id, { elementKey: elementKey || undefined, area: area ?? undefined, label: label.trim() || undefined, note: note.trim() });
    close();
  };

  return (
    <Section
      title={`변경 요청 ${requests.length}`}
      action={<AddButton label={composing ? "닫기" : "요청 추가 · 화면에서 요소를 누르거나 영역을 끌어도 됩니다"} open={composing} onClick={() => (composing ? close() : setComposing(true))} />}
    >
      {screen.baseline?.image ? (
        <PickShot screen={screen} picked={elementKey} area={area} onPick={pick} onArea={pickArea} />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <ScreenView screen={screen} mode="baseline" width={200} tokens={tokens} focusId={elementKey || null} />
        </div>
      )}
      {composing && (
        <form
          className="flex flex-col gap-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        >
          <div className="flex items-center gap-2 text-sm">
            {picked ? (
              <>
                <span className="shrink-0 text-muted-foreground">{ROLE_NAMES[picked.role] ?? picked.role}</span>
                <b className="min-w-0 flex-1 truncate">{picked.label}</b>
                <Tip label="화면 전체로">
                  <button type="button" aria-label="요소 선택 해제" className="text-muted-foreground hover:text-foreground" onClick={() => setElementKey("")}>
                    <X className="size-4" />
                  </button>
                </Tip>
              </>
            ) : area ? (
              <>
                <SquareDashed className="size-4 shrink-0 text-brand" />
                <b className="min-w-0 flex-1">고른 영역</b>
                <Tip label="화면 전체로">
                  <button type="button" aria-label="영역 선택 해제" className="text-muted-foreground hover:text-foreground" onClick={() => setArea(null)}>
                    <X className="size-4" />
                  </button>
                </Tip>
              </>
            ) : (
              <Tip label="위 화면에서 요소를 누르거나 영역을 끌면 그곳만 고릅니다">
                <span tabIndex={-1} className="flex items-center gap-1.5 text-muted-foreground">
                  <MousePointerClick className="size-4" /> 화면 전체
                </span>
              </Tip>
            )}
          </div>
          {picked && (
            <Input aria-label="바꿀 문구" className="h-9" placeholder={`바꿀 문구 (지금: ${picked.label})`} value={label} onChange={(e) => setLabel(e.target.value)} />
          )}
          <textarea
            aria-label="변경 메모"
            ref={noteRef}
            rows={2}
            placeholder={picked ? "메모 · 예: 더 크게, 색을 연하게" : "메모 · 예: 간격을 넓게"}
            className="w-full resize-y rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              취소
            </Button>
            <Button type="submit" size="sm" disabled={!canAdd}>
              추가
            </Button>
          </div>
        </form>
      )}
      {requests.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {requests.map((r) => (
            <li key={r.id} className="group flex items-start gap-2 rounded-lg bg-muted px-2.5 py-2">
              <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-change" />
              <span className="flex-1">
                <b>{name(r)}</b>
                {r.label && ` → “${r.label}”`}
                {r.note && <span className="block text-muted-foreground">{r.note}</span>}
              </span>
              <button
                type="button"
                aria-label="요청 삭제"
                className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
                onClick={() => ed.removeRequest(screen.id, r.id)}
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const PICK_WIDTH = 200;
const ROLE_NAMES: Record<string, string> = { button: "버튼", link: "링크", heading: "제목", textbox: "입력칸", img: "이미지", text: "글자", tab: "탭", radio: "선택지", checkbox: "체크박스" };

/** Smallest drag, in shot pixels, that counts as drawing an area rather than a click. */
const DRAG_MIN = 6;

/**
 * Baseline screenshot whose captured elements can be clicked to pick one, or dragged across to draw an area.
 * Smaller boxes sit on top of their containers.
 */
function PickShot({ screen, picked, area, onPick, onArea }: { screen: Screen; picked: string; area: Box | null; onPick: (key: string) => void; onArea: (box: Box) => void }) {
  const scale = PICK_WIDTH / screen.size.w;
  const frame = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<Box | null>(null);
  // A finished drag must not also count as a click on the element under the pointer.
  const dragged = useRef(false);
  const css = (b: Box) => ({ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale });
  const box = (e: CapturedElement) => css(e.box);
  const elements = (screen.baseline?.elements ?? []).filter((e) => e.box.w > 0 && e.box.h > 0).sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  const requested = new Set((screen.requests ?? []).map((r) => r.elementKey));
  const areas = (screen.requests ?? []).flatMap((r) => (r.area ? [r.area] : []));

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || !frame.current) return;
    const rect = frame.current.getBoundingClientRect();
    const at = (ev: PointerEvent | React.PointerEvent) => ({
      x: Math.min(Math.max(ev.clientX - rect.left, 0), rect.width),
      y: Math.min(Math.max(ev.clientY - rect.top, 0), rect.height),
    });
    const start = at(e);
    dragged.current = false;
    const toBox = (end: { x: number; y: number }): Box => ({
      x: Math.round(Math.min(start.x, end.x) / scale),
      y: Math.round(Math.min(start.y, end.y) / scale),
      w: Math.round(Math.abs(end.x - start.x) / scale),
      h: Math.round(Math.abs(end.y - start.y) / scale),
    });
    const move = (ev: PointerEvent) => {
      const end = at(ev);
      if (!dragged.current && Math.hypot(end.x - start.x, end.y - start.y) < DRAG_MIN) return;
      dragged.current = true;
      setDrawing(toBox(end));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrawing(null);
      if (dragged.current) onArea(toBox(at(ev)));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex justify-center rounded-lg bg-muted py-4">
      <div
        ref={frame}
        className="relative cursor-crosshair touch-none select-none overflow-hidden rounded-md bg-white shadow-soft"
        style={{ width: PICK_WIDTH, height: screen.size.h * scale }}
        onPointerDown={startDrag}
        onClickCapture={(e) => {
          if (!dragged.current) return;
          dragged.current = false;
          e.stopPropagation();
        }}
      >
        <img src={imageSrc(screen.baseline?.image ?? "")} alt={`${screen.name} 기준`} draggable={false} className="size-full object-cover object-top" />
        {elements.map((e) => (
          <button
            key={e.key}
            type="button"
            title={`${e.role} · ${e.label}`}
            aria-label={`${e.label} 고르기`}
            aria-pressed={picked === e.key}
            onClick={() => onPick(picked === e.key ? "" : e.key)}
            className={cn("absolute rounded-[3px] hover:bg-brand/10 hover:outline-2 hover:outline-brand/60", picked === e.key && "bg-brand/15 outline-2 outline-brand")}
            style={box(e)}
          />
        ))}
        {elements
          .filter((e) => requested.has(e.key))
          .map((e) => (
            <span
              key={`dot-${e.key}`}
              aria-hidden
              className="pointer-events-none absolute size-2 rounded-full bg-change shadow-[0_0_0_2px_#fff]"
              style={{ left: box(e).left + box(e).width - 4, top: box(e).top - 4 }}
            />
          ))}
        {areas.map((a) => (
          <span key={`area-${a.x}-${a.y}-${a.w}-${a.h}`} aria-hidden className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-change" style={css(a)} />
        ))}
        {(drawing ?? area) && (
          <span
            data-testid="area-selection"
            aria-hidden
            className="pointer-events-none absolute rounded-[3px] border-2 border-dashed border-brand bg-brand/10"
            style={css((drawing ?? area) as Box)}
          />
        )}
      </div>
    </div>
  );
}

function AppUrl({ screen }: { screen: Screen }) {
  const [url, setUrl] = useState(screen.live?.url ?? "");
  const apply = () => useEditor.getState().setLiveUrl(screen.id, url.trim() || undefined);
  return (
    <div className="flex items-center gap-1.5">
      <Input
        aria-label="앱 주소"
        placeholder="http://localhost:5173/checkout"
        className={cn("h-9 min-w-0", quietInput)}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={apply}
        onKeyDown={blurOnEnter}
      />
      {screen.live?.url && (
        <a href={screen.live.url} target="_blank" rel="noreferrer" aria-label="앱 주소를 새 탭에서 열기" className="shrink-0 text-muted-foreground hover:text-brand">
          <ExternalLink className="size-4" />
        </a>
      )}
    </div>
  );
}

function VariantEditor({ screen, spec }: { screen: Screen; spec: ScreenSpec }) {
  const tokens = useEditor((s) => s.project.tokens);
  const ed = useEditor.getState();
  const elements = spec.elements.filter((e) => e.kind !== "spacer");
  const [elementId, setElementId] = useState(elements[0]?.id);
  const el = elements.find((e) => e.id === elementId) ?? elements[0];
  const colors = tokens.filter((t) => t.kind === "color");
  const spaces = tokens.filter((t) => t.kind === "space");
  const patch = (p: Partial<ScreenElement>) => el && ed.updateVariantElement(screen.id, el.id, p);

  const colorSelect = (key: "fill" | "stroke", label: string) => (
    <Field label={label}>
      <select className={selectClass} value={el?.[key] ?? ""} onChange={(e) => patch({ [key]: e.target.value || undefined })}>
        <option value="">없음</option>
        {colors.map((t) => (
          <option key={t.name} value={t.name}>
            {t.name} · {t.value}
          </option>
        ))}
        {el?.[key] && !colors.some((t) => t.name === el[key]) && <option value={el[key]}>{el[key]} (토큰 아님)</option>}
      </select>
    </Field>
  );

  return (
    <Section title="시안 편집">
      <Field label="목록 간격">
        <select className={selectClass} value={spec.gap} onChange={(e) => ed.setVariantGap(screen.id, e.target.value)}>
          {spaces.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} · {t.value}
            </option>
          ))}
        </select>
      </Field>
      <Field label="요소">
        <select className={selectClass} value={el?.id} onChange={(e) => setElementId(e.target.value)}>
          {elements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      {el && el.label !== undefined && (
        <Field label="문구">
          <Input className={cn("h-9", quietInput)} onKeyDown={blurOnEnter} value={el.label} onChange={(e) => patch({ label: e.target.value })} />
        </Field>
      )}
      {el?.kind === "button" && (
        <>
          <Field label="변형">
            <select className={selectClass} value={el.variant} onChange={(e) => patch({ variant: e.target.value as ButtonVariant })}>
              {(["primary", "accent", "filled", "ghost"] as const).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="높이">
            <Input className={cn("h-9", quietInput)} onKeyDown={blurOnEnter} type="number" min={24} max={96} value={el.height ?? 56} onChange={(e) => patch({ height: Number(e.target.value) })} />
          </Field>
        </>
      )}
      {el && (el.kind === "field" || el.kind === "listItem" || el.kind === "illustration") && (
        <>
          {colorSelect("fill", "배경")}
          {colorSelect("stroke", "테두리")}
        </>
      )}
    </Section>
  );
}

function SourcesEditor({ screen, tokens }: { screen: Screen; tokens: string[] }) {
  const ed = useEditor.getState();
  // A new row being typed, Figma-style: "+" adds it straight to the list, Enter or leaving the row keeps it.
  const [draft, setDraft] = useState<{ path: string; note: string } | null>(null);
  const pathRef = useRef<HTMLInputElement>(null);
  // Enter and the row losing focus can both fire for one draft; only the first one may add it.
  const settled = useRef(false);
  const open = draft !== null;
  useEffect(() => {
    if (!open) return;
    settled.current = false;
    pathRef.current?.focus();
  }, [open]);
  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    if (draft?.path.trim()) ed.setSources(screen.id, [...screen.sources, { path: draft.path.trim(), note: draft.note.trim() || "화면 일부" }]);
    setDraft(null);
  };
  const cancel = () => {
    settled.current = true;
    setDraft(null);
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter") commit();
    if (e.key === "Escape") cancel();
  };
  return (
    <Section
      title="소스 매핑"
      action={<AddButton label={open ? "닫기" : "소스 파일 추가"} open={open} onClick={() => (open ? cancel() : setDraft({ path: "", note: "" }))} />}
    >
      <ul className="flex flex-col gap-2 text-xs">
        {screen.sources.map((m, i) => (
          <li key={`${m.path}|${m.note}`} className="group flex items-start gap-2 rounded-lg bg-muted px-2.5 py-2">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="break-all">{m.path}</span>
              <span className="text-muted-foreground">{m.note}</span>
            </span>
            <button
              type="button"
              aria-label={`${m.path} 매핑 삭제`}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground focus:opacity-100"
              onClick={() => ed.setSources(screen.id, screen.sources.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {draft && (
          <li
            className="flex flex-col gap-0.5 rounded-lg bg-muted px-2.5 py-1.5 ring-2 ring-brand/40"
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) commit();
            }}
          >
            <input
              ref={pathRef}
              aria-label="소스 경로"
              placeholder="src/screens/Checkout.tsx"
              className="bg-transparent outline-none placeholder:text-muted-foreground/70"
              value={draft.path}
              onChange={(e) => setDraft({ ...draft, path: e.target.value })}
              onKeyDown={onKey}
            />
            <input
              aria-label="매핑 설명"
              placeholder="설명 (선택)"
              className="bg-transparent text-muted-foreground outline-none placeholder:text-muted-foreground/70"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              onKeyDown={onKey}
            />
          </li>
        )}
        {tokens.length > 0 && (
          <li className="flex flex-col gap-0.5 rounded-lg bg-muted px-2.5 py-2">
            <span>{tokens.join(" · ")}</span>
            <span className="text-muted-foreground">쓰는 토큰</span>
          </li>
        )}
      </ul>
    </Section>
  );
}

/** Delete (optional) and close buttons for the top right of every inspector. */
export function HeaderActions({ onDelete, deleteLabel }: { onDelete?: () => void; deleteLabel: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      {onDelete && (
        <Tip label={deleteLabel}>
          <Button variant="ghost" size="icon" aria-label={deleteLabel} className="text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 />
          </Button>
        </Tip>
      )}
      <Tip label="닫기">
        <Button variant="secondary" size="icon" aria-label="검사기 닫기" onClick={() => useEditor.getState().select(null)}>
          <X />
        </Button>
      </Tip>
    </div>
  );
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-medium hover:text-brand">
      {children}
    </button>
  );
}
