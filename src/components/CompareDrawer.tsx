import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScreenView } from "@/components/ScreenView";
import { StatusBadge } from "@/components/bits";
import { TransitionPlayer } from "@/components/TransitionPlayer";
import { screenChanges } from "@/model/diff";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

const W = 120;

export function CompareDrawer() {
  const project = useEditor((s) => s.project);
  const compareIds = useEditor((s) => s.compareIds);
  const { clearCompare, toggleCompare, select } = useEditor.getState();
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [opacity, setOpacity] = useState(60);

  const screens = compareIds.map((id) => project.screens.find((s) => s.id === id)).filter((s) => !!s);
  const between = project.transitions.filter((t) => compareIds.includes(t.from) && compareIds.includes(t.to));

  return (
    <section aria-label="비교 서랍" className="z-20 flex max-h-[60%] flex-col border-t bg-white shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.2)]">
      <header className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
        <h2 className="text-base font-bold">비교</h2>
        <span className="text-sm text-muted-foreground">
          {screens.map((s) => s.name).join(" · ")} · 전이 {between.length}개
        </span>
        <fieldset aria-label="비교 방식" className="ml-auto flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["side", "나란히"],
              ["overlay", "겹쳐 보기"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn("h-8 rounded-md px-3 text-sm text-muted-foreground", mode === m && "bg-white font-bold text-foreground shadow-soft")}
            >
              {label}
            </button>
          ))}
        </fieldset>
        {mode === "overlay" && (
          <div className="flex items-center gap-3 text-sm">
            <span aria-hidden>시안 투명도</span>
            <Slider aria-label="시안 투명도" className="w-32" value={[opacity]} max={100} step={1} onValueChange={([v]) => setOpacity(v)} />
            <span className="w-10 text-right font-bold tabular-nums">{opacity}%</span>
          </div>
        )}
        <Button variant="secondary" size="icon" aria-label="비교 닫기" onClick={clearCompare}>
          <X />
        </Button>
      </header>
      <div className="flex gap-8 overflow-auto px-6 py-4">
        {screens.map((s) => (
          <div key={s.id} className="flex shrink-0 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button type="button" className="text-sm font-bold hover:text-brand" onClick={() => select({ kind: "screen", id: s.id })}>
                {s.name}
              </button>
              <StatusBadge variant={!!s.variant} />
              {s.variant && <span className="text-xs text-muted-foreground">변경 {screenChanges(s).length}건</span>}
              <button type="button" aria-label={`${s.name} 비교에서 빼기`} className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => toggleCompare(s.id)}>
                <X className="size-4" />
              </button>
            </div>
            {mode === "side" ? (
              <div className="flex gap-2">
                <Labeled label="기준">
                  <ScreenView screen={s} mode="baseline" width={W} tokens={project.tokens} />
                </Labeled>
                {s.variant && (
                  <Labeled label="시안">
                    <ScreenView screen={s} mode="variant" width={W} tokens={project.tokens} changedIds={new Set(screenChanges(s).map((c) => c.elementId ?? ""))} />
                  </Labeled>
                )}
              </div>
            ) : (
              <Labeled label={s.variant ? "기준 + 시안 (위에 겹침)" : "기준 (시안 없음)"}>
                <div className="relative" style={{ width: W * 1.4 }}>
                  <ScreenView screen={s} mode="baseline" width={W * 1.4} tokens={project.tokens} />
                  {s.variant && (
                    <div className="absolute inset-0" style={{ opacity: opacity / 100 }}>
                      <ScreenView screen={s} mode="variant" width={W * 1.4} tokens={project.tokens} />
                    </div>
                  )}
                </div>
              </Labeled>
            )}
          </div>
        ))}
        {between.map((t) => {
          const from = project.screens.find((s) => s.id === t.from);
          const to = project.screens.find((s) => s.id === t.to);
          const preset = project.motions.find((m) => m.id === t.motionId);
          if (!from || !to) return null;
          return (
            <div key={t.id} className="flex shrink-0 flex-col gap-2 border-l pl-8">
              <button type="button" className="text-left text-sm font-bold hover:text-brand" onClick={() => select({ kind: "transition", id: t.id })}>
                전이 · {from.name} → {to.name}
              </button>
              <span className="text-xs text-muted-foreground">
                {t.trigger}
                {t.condition && ` · ${t.condition}`}
              </span>
              {preset && <TransitionPlayer from={from} to={to} preset={preset} width={W} />}
            </div>
          );
        })}
      </div>
      {mode === "overlay" && <p className="px-6 pb-3 text-xs text-muted-foreground">슬라이더를 0%로 내리면 기준만, 100%로 올리면 시안만 보입니다.</p>}
    </section>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="overflow-hidden rounded-md border">{children}</div>
    </div>
  );
}
