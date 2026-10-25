import { useEffect, useState } from "react";
import { TransitionPlayer } from "@/components/TransitionPlayer";
import { selectClass } from "@/components/bits";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

export function MotionView() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const select = useEditor.getState().select;
  const presetId = selection?.kind === "motion" ? selection.id : project.motions[0]?.id;
  const preset = project.motions.find((m) => m.id === presetId);
  const uses = project.transitions.filter((t) => t.motionId === presetId);
  const [transitionId, setTransitionId] = useState<string>();
  const [reduced, setReduced] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const transition = project.transitions.find((t) => t.id === transitionId) ?? uses[0] ?? project.transitions[0];
  const from = project.screens.find((s) => s.id === transition?.from);
  const to = project.screens.find((s) => s.id === transition?.to);
  useEffect(() => {
    if (selection?.kind !== "motion" && presetId) select({ kind: "motion", id: presetId });
  }, [selection, presetId, select]);
  const name = (id: string) => project.screens.find((s) => s.id === id)?.name ?? "?";

  return (
    <main aria-label="모션" className="flex min-w-0 flex-1 gap-8 overflow-y-auto bg-muted px-10 pt-8 pb-12 max-xl:flex-col">
      <section aria-label="모션 프리셋" className="flex w-64 shrink-0 flex-col gap-3 max-xl:w-full">
        <h2 className="text-2xl font-extrabold">프리셋</h2>
        <ul className="flex flex-col gap-2 max-xl:flex-row max-xl:flex-wrap">
          {project.motions.map((m) => {
            const count = project.transitions.filter((t) => t.motionId === m.id).length;
            const active = m.id === presetId;
            return (
              <li key={m.id}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    select({ kind: "motion", id: m.id });
                    setTransitionId(undefined);
                    setPlayKey((k) => k + 1);
                  }}
                  className={cn("flex w-full flex-col gap-0.5 rounded-xl bg-white px-4 py-3 text-left", active && "shadow-[inset_0_0_0_2px_var(--brand)]")}
                >
                  <b>{m.name}</b>
                  <span className="text-[13px] text-muted-foreground">
                    {m.durationMs}ms · 전이 {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="전환 재생" className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold">전환 재생</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reduced} onChange={(e) => setReduced(e.target.checked)} />
            모션 줄이기로 미리 보기
          </label>
        </div>
        <div className="flex flex-col gap-4 rounded-xl bg-white p-6">
          <select
            aria-label="재생할 전이"
            className={cn(selectClass, "max-w-sm")}
            value={transition?.id ?? ""}
            onChange={(e) => {
              setTransitionId(e.target.value);
              setPlayKey((k) => k + 1);
            }}
          >
            {project.transitions.map((t) => (
              <option key={t.id} value={t.id}>
                {name(t.from)} → {name(t.to)}
                {t.motionId === presetId ? "" : " (다른 프리셋)"}
              </option>
            ))}
          </select>
          {from && to && preset ? (
            <>
              <div className="flex items-center gap-3 text-sm">
                <b>{from.name}</b> → <b>{to.name}</b>
                <span className="text-muted-foreground">· {preset.name} 프리셋으로 재생</span>
              </div>
              <TransitionPlayer key={`${transition?.id}-${preset.id}-${reduced}`} from={from} to={to} preset={preset} width={220} reduced={reduced} autoPlayKey={playKey} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">재생할 전이가 없습니다. 흐름 보기에서 전이를 만드세요.</p>
          )}
        </div>
      </section>
    </main>
  );
}
