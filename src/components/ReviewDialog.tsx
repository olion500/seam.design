import { useEffect, useRef, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import { Tip } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, bumpRepoImages, imageSrc } from "@/lib/api";
import { pixelDiff } from "@/lib/pixelDiff";
import { cn } from "@/lib/utils";
import type { Change, Project, ReviewState, VerifyResult } from "@/model/types";
import { refreshReview, saveProject, useSync } from "@/store/persist";
import { useEditor } from "@/store/store";

type Shot = NonNullable<ReviewState["verify"]>["after"][number];
type Decision = { ok?: boolean; note: string };

const STATUS: Record<VerifyResult["status"], { label: string; className: string }> = {
  pass: { label: "통과", className: "bg-emerald-100 text-emerald-800" },
  review: { label: "눈으로 확인", className: "bg-warn/30" },
  fail: { label: "실패", className: "bg-change/15 text-change" },
};

const KIND: Record<Change["kind"], string> = { token: "토큰", element: "화면 요소", transition: "전이" };

function summary(c: Change, name: (id: string) => string) {
  if (c.kind === "token") return `${c.path}  ${c.before} → ${c.after}`;
  if (c.kind === "transition") return `${c.change === "added" ? "추가" : "삭제"}: ${name(c.from)} → ${name(c.to)} · ${c.label}`;
  const target = c.element ? `“${c.element.label}”` : c.area ? "고른 영역" : "화면 전체";
  const what = [c.label ? `문구를 “${c.label}”(으)로` : null, c.note || null].filter(Boolean).join(" · ");
  return `${c.screenName} · ${target}${what ? ` — ${what}` : ""}`;
}

const changeKey = (c: Change) => (c.kind === "element" ? c.requestId : c.kind === "token" ? c.token : `${c.change}:${c.from}>${c.to}>${c.label}`);

const PAIR_W = 180;

type Box = { x: number; y: number; w: number; h: number };

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`이미지를 불러오지 못했습니다: ${src}`));
    img.src = src;
  });

const percent = (ratio: number) => (ratio === 0 ? "없음" : ratio < 0.001 ? "바뀜 곳 0.1% 미만" : `바뀜 곳 ${(ratio * 100).toFixed(1)}%`);

/** Both captures drawn at the same width, top-aligned, with changed pixels painted in the change color. */
function DiffFigure({ before, after, height }: { before: string; after: string; height: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<{ ratio: number } | { error: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    Promise.all([loadImage(before), loadImage(after)])
      .then(([a, b]) => {
        const target = canvas.current;
        if (cancelled || !target) return;
        const w = target.width;
        const h = target.height;
        const pixels = (img: HTMLImageElement) => {
          const ctx = Object.assign(document.createElement("canvas"), { width: w, height: h }).getContext("2d", { willReadFrequently: true });
          if (!ctx) throw new Error("캔버스를 쓸 수 없습니다");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, (img.naturalHeight / img.naturalWidth) * w);
          return ctx.getImageData(0, 0, w, h).data;
        };
        const out = new ImageData(w, h);
        const ratio = pixelDiff(pixels(a), pixels(b), out.data);
        target.getContext("2d")?.putImageData(out, 0, 0);
        setResult({ ratio });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ error: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [before, after]);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-xs text-muted-foreground">
        차이
        {result && "ratio" in result && <span className={cn("ml-1.5", result.ratio > 0 && "font-medium text-change")}>{percent(result.ratio)}</span>}
      </figcaption>
      <div className="relative overflow-hidden rounded-md border bg-white" style={{ width: PAIR_W, height }}>
        <canvas ref={canvas} aria-label="바뀜 곳 강조" width={PAIR_W * 2} height={Math.round(height * 2)} className="size-full" />
        {result && "error" in result && <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted-foreground">{result.error}</span>}
      </div>
    </figure>
  );
}

function Pair({ project, shot, change, version }: { project: Project; shot: Shot; change?: Change; version: string }) {
  const screen = project.screens.find((s) => s.id === shot.id);
  const element = change?.kind === "element" ? change.element : undefined;
  const area = change?.kind === "element" ? change.area : undefined;
  const label = change?.kind === "element" ? change.label : undefined;
  // The element may move or get its new text after the change, so find it again in the after capture.
  // A drawn area has no element to follow, so it marks the same spot on both.
  const afterBox = element ? shot.elements.find((e) => (label && e.label === label) || e.key === element.key)?.box : area;
  const one = (title: string, src: string | undefined, size: { w: number; h: number }, box?: Box) => {
    const scale = PAIR_W / size.w;
    return (
      <figure className="flex flex-col gap-1">
        <figcaption className="text-xs text-muted-foreground">{title}</figcaption>
        <div className="relative overflow-hidden rounded-md border bg-white" style={{ width: PAIR_W, height: size.h * scale }}>
          {src ? (
            <img src={src} alt={`${screen?.name ?? shot.id} ${title}`} className="size-full object-cover object-top" />
          ) : (
            <span className="flex size-full items-center justify-center text-xs text-muted-foreground">없음</span>
          )}
          {box && (
            <span
              aria-hidden
              className="pointer-events-none absolute rounded-sm outline-2 outline-brand"
              style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale }}
            />
          )}
        </div>
      </figure>
    );
  };
  const before = screen?.baseline?.image ? imageSrc(screen.baseline.image) : undefined;
  const after = `/repo/${shot.file}?v=${encodeURIComponent(version)}`;
  return (
    <div className="flex gap-3">
      {one("기준", before, screen?.size ?? shot.size, element?.box ?? area)}
      {one("결과", after, shot.size, afterBox)}
      {before && <DiffFigure before={before} after={after} height={shot.size.h * (PAIR_W / shot.size.w)} />}
    </div>
  );
}

export function ReviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const review = useSync((s) => s.review);
  const project = useEditor((s) => s.project);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [state, setState] = useState<{ step: "edit" | "busy" } | { step: "done"; text: string } | { step: "error"; text: string }>({ step: "edit" });

  const verify = review?.verify;
  useEffect(() => {
    if (!open || !verify) return;
    setState({ step: "edit" });
    setDecisions(Object.fromEntries(verify.results.map((r) => [r.index, { ok: r.status === "pass" ? true : undefined, note: "" }])));
  }, [open, verify]);

  // Finishing archives the round, so the review is gone by the time the result shows.
  if (state.step === "done" || !review || !verify) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>검토</DialogTitle>
            <DialogDescription>{state.step === "done" ? state.text : "검토할 결과가 없습니다."}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button onClick={() => onOpenChange(false)}>닫기</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const name = (id: string) => project.screens.find((s) => s.id === id)?.name ?? id;
  const resultOf = (i: number) => verify.results.find((r) => r.index === i);
  const shotOf = (id: string) => verify.after.find((a) => a.id === id);
  const elementScreens = new Set(review.changes.flatMap((c) => (c.kind === "element" ? [c.screen] : [])));
  const otherShots = review.changes.some((c) => c.kind === "token") ? verify.after.filter((a) => !elementScreens.has(a.id)) : [];
  const counts = { pass: 0, review: 0, fail: 0 };
  for (const r of verify.results) counts[r.status]++;
  const undecided = review.changes.filter((_, i) => decisions[i]?.ok === undefined).length;
  const rejecting = Object.values(decisions).some((d) => d.ok === false);
  const set = (i: number, d: Partial<Decision>) => setDecisions((all) => ({ ...all, [i]: { ...(all[i] ?? { note: "" }), ...d } }));

  const submit = async () => {
    setState({ step: "busy" });
    const { project: current, savedProject } = useEditor.getState();
    if (current !== savedProject) await saveProject(current);
    try {
      const res = await api.decideReview(review.changes.map((_, i) => ({ index: i, ok: decisions[i]?.ok === true, note: decisions[i]?.note.trim() || undefined })));
      if (res.approved) {
        bumpRepoImages();
        useEditor.getState().loadProject(await api.getRepoProject());
        setState({ step: "done", text: "마무리했습니다. 결과 화면이 새 기준이 됐습니다." });
      } else {
        setState({ step: "done", text: res.agentWaiting ? "AI에게 다시 보냈습니다. 바로 고치기 시작합니다." : "AI에게 다시 보냈습니다. AI가 기다리기를 시작하면 받습니다." });
      }
      await refreshReview();
    } catch (e) {
      setState({ step: "error", text: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-4 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>검토</DialogTitle>
          <DialogDescription className="flex flex-wrap gap-1.5">
            {(Object.keys(counts) as VerifyResult["status"][])
              .filter((k) => counts[k])
              .map((k) => (
                <span key={k} className={cn("rounded-full px-2 py-0.5 text-xs", STATUS[k].className)}>
                  {STATUS[k].label} {counts[k]}
                </span>
              ))}
          </DialogDescription>
        </DialogHeader>

            <ol className="-mx-6 flex min-h-0 flex-col gap-3 overflow-y-auto px-6">
              {review.changes.map((c, i) => {
                const r = resultOf(i);
                const d = decisions[i] ?? { note: "" };
                const shot = c.kind === "element" ? shotOf(c.screen) : undefined;
                return (
                  <li key={changeKey(c)} className={cn("flex flex-col gap-3 rounded-lg border p-4", d.ok === false && "border-change/40")}>
                    <div className="flex items-start gap-3 text-sm">
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">{KIND[c.kind]}</span>
                      <span className="min-w-0 flex-1 break-words">{summary(c, name)}</span>
                      {r && (
                        <Tip label={r.detail}>
                          <span tabIndex={-1} className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", STATUS[r.status].className)}>
                            {STATUS[r.status].label}
                          </span>
                        </Tip>
                      )}
                    </div>
                    {shot && <Pair project={project} shot={shot} change={c} version={verify.checkedAt} />}
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant={d.ok === true ? "default" : "secondary"} aria-pressed={d.ok === true} onClick={() => set(i, { ok: true })}>
                        <Check /> 승인
                      </Button>
                      <Button size="sm" variant={d.ok === false ? "default" : "secondary"} aria-pressed={d.ok === false} onClick={() => set(i, { ok: false })}>
                        <RotateCcw /> 다시 요청
                      </Button>
                    </div>
                    {d.ok === false && (
                      <textarea
                        aria-label={`${i + 1}번 다시 요청 메모`}
                        rows={2}
                        placeholder="무엇이 다른가요? (선택)"
                        className="w-full resize-y rounded-lg border border-input px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        value={d.note}
                        onChange={(e) => set(i, { note: e.target.value })}
                      />
                    )}
                  </li>
                );
              })}
              {otherShots.length > 0 && (
                <li className="flex flex-col gap-3 rounded-lg border p-4">
                  <span className="text-sm font-bold">토큰이 바뀐 화면</span>
                  <div className="flex flex-wrap gap-6">
                    {otherShots.map((s) => (
                      <div key={s.id} className="flex flex-col gap-1.5">
                        <span className="text-xs font-medium">{name(s.id)}</span>
                        <Pair project={project} shot={s} version={verify.checkedAt} />
                      </div>
                    ))}
                  </div>
                </li>
              )}
            </ol>
            {state.step === "error" && <p className="text-sm text-destructive">{state.text}</p>}
            <div className="flex items-center justify-end gap-3">
              {undecided > 0 && <span className="text-xs text-muted-foreground">남은 판단 {undecided}</span>}
              <Button disabled={undecided > 0 || state.step === "busy"} onClick={() => void submit()}>
                {state.step === "busy" ? "처리 중…" : rejecting ? "다시 요청 보내기" : "승인하고 마무리"}
              </Button>
            </div>
      </DialogContent>
    </Dialog>
  );
}
