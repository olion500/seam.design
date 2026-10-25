import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow, Field, Section, selectClass } from "@/components/bits";
import { ScreenView } from "@/components/ScreenView";
import { TransitionPlayer } from "@/components/TransitionPlayer";
import { displaySpec } from "@/model/diff";
import { isHex, tokensInSpec } from "@/model/tokens";
import type { Direction, EasingName, MotionKind, MotionPreset, Rule, Token, Transition } from "@/model/types";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import { EASING_LABEL } from "@/lib/transition";
import { LinkButton, ScreenInspector } from "./ScreenInspector";

export function Inspector() {
  const selection = useEditor((s) => s.selection);
  const project = useEditor((s) => s.project);

  let body: React.ReactNode = <EmptyInspector />;
  if (selection?.kind === "screen") {
    const screen = project.screens.find((s) => s.id === selection.id);
    if (screen) body = <ScreenInspector key={screen.id} screen={screen} />;
  } else if (selection?.kind === "transition") {
    const t = project.transitions.find((x) => x.id === selection.id);
    if (t) body = <TransitionInspector key={t.id} transition={t} />;
  } else if (selection?.kind === "token") {
    const t = project.tokens.find((x) => x.name === selection.id);
    if (t) body = <TokenInspector key={t.name} token={t} />;
  } else if (selection?.kind === "motion") {
    const m = project.motions.find((x) => x.id === selection.id);
    if (m) body = <MotionInspector key={m.id} preset={m} />;
  } else if (selection?.kind === "rule") {
    const r = project.rules.find((x) => x.id === selection.id);
    if (r) body = <RuleInspector key={r.id} rule={r} />;
  }

  return (
    <aside aria-label="검사기" className="w-[360px] shrink-0 overflow-y-auto border-l bg-white max-lg:w-[300px]">
      {body}
    </aside>
  );
}

function EmptyInspector() {
  return (
    <div className="flex flex-col gap-2 px-6 py-5">
      <Eyebrow>검사기</Eyebrow>
      <h2 className="text-xl font-bold">선택한 항목 없음</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">화면이나 전이를 선택하면 속성, 규칙, 소스 매핑이 여기에 나옵니다.</p>
    </div>
  );
}

function Header({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
      <div className="flex min-w-0 flex-col gap-2">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="text-xl leading-tight font-bold tracking-tight">{title}</h2>
        {sub && <span className="text-sm leading-relaxed text-muted-foreground">{sub}</span>}
      </div>
      <Button variant="secondary" size="icon" aria-label="검사기 닫기" onClick={() => useEditor.getState().select(null)}>
        <X />
      </Button>
    </div>
  );
}

function TransitionInspector({ transition: t }: { transition: Transition }) {
  const project = useEditor((s) => s.project);
  const ed = useEditor.getState();
  const from = project.screens.find((s) => s.id === t.from);
  const to = project.screens.find((s) => s.id === t.to);
  const preset = project.motions.find((m) => m.id === t.motionId);
  const elements = (from && displaySpec(from)?.elements.filter((e) => e.kind !== "spacer")) ?? [];
  const patch = (p: Partial<Transition>) => ed.updateTransition(t.id, p);

  return (
    <>
      <Header eyebrow="전이" title={`${from?.name ?? "?"} → ${to?.name ?? "끊어진 연결"}`} />
      {from && to && preset && (
        <Section title="전환 재생">
          <TransitionPlayer from={from} to={to} preset={preset} width={150} />
        </Section>
      )}
      <Section title="조건">
        <Field label="이름">
          <Input className="h-9" value={t.label} onChange={(e) => patch({ label: e.target.value })} />
        </Field>
        <Field label="트리거">
          <Input className="h-9" value={t.trigger} onChange={(e) => patch({ trigger: e.target.value })} />
        </Field>
        <Field label="조건">
          <Input className="h-9" placeholder="항상" value={t.condition} onChange={(e) => patch({ condition: e.target.value })} />
        </Field>
        <Field label="출발 요소">
          <select className={selectClass} value={t.sourceElementId ?? ""} onChange={(e) => patch({ sourceElementId: e.target.value || undefined })}>
            <option value="">화면 전체</option>
            {elements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="조건부">
          <input type="checkbox" aria-label="조건부 전이 (점선)" checked={t.conditional} onChange={(e) => patch({ conditional: e.target.checked })} />
        </Field>
      </Section>
      <Section
        title="모션"
        action={
          <LinkButton
            onClick={() => {
              ed.setView("motion");
              ed.select({ kind: "motion", id: t.motionId });
            }}
          >
            모션 보기
          </LinkButton>
        }
      >
        <Field label="프리셋">
          <select className={selectClass} value={t.motionId} onChange={(e) => patch({ motionId: e.target.value })}>
            {project.motions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} · {m.durationMs}ms
              </option>
            ))}
          </select>
        </Field>
        {preset && (
          <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">이징</dt>
            <dd>{EASING_LABEL[preset.easing]}</dd>
            <dt className="text-muted-foreground">모션 줄이기</dt>
            <dd>{preset.reduced ? `${preset.reduced.kind === "fade" ? "페이드" : "즉시"} ${preset.reduced.durationMs}ms` : "그대로"}</dd>
          </dl>
        )}
      </Section>
      <Section title="관리">
        <Button variant="secondary" size="sm" className="self-start" onClick={() => ed.removeTransition(t.id)}>
          <Trash2 /> 전이 삭제
        </Button>
      </Section>
    </>
  );
}

const QUICK = ["#0085E4", "#F9BA0D", "#F8521F", "#7272FB"];

function TokenInspector({ token }: { token: Token }) {
  const project = useEditor((s) => s.project);
  const ed = useEditor.getState();
  const users = project.screens.filter((s) => {
    const spec = displaySpec(s);
    return spec && tokensInSpec(spec).includes(token.name);
  });
  const invalid = token.kind === "color" && !isHex(token.value);

  return (
    <>
      <Header eyebrow="토큰" title={<code className="font-mono">{token.name}</code>} sub={token.description} />
      <Section title="값">
        <div className="flex items-center gap-2">
          {token.kind === "color" && <span aria-hidden className="size-11 shrink-0 rounded-lg border" style={{ background: token.value }} />}
          <Input
            id="token-value"
            aria-label="토큰 값"
            aria-invalid={invalid}
            className="h-11 font-mono"
            value={token.value}
            onChange={(e) => ed.updateToken(token.name, e.target.value)}
          />
          {token.kind === "color" && (
            <input
              type="color"
              aria-label="색 고르기"
              className="size-11 shrink-0 cursor-pointer rounded-lg border bg-white p-1"
              value={isHex(token.value) && token.value.length === 7 ? token.value : "#000000"}
              onChange={(e) => ed.updateToken(token.name, e.target.value.toUpperCase())}
            />
          )}
        </div>
        {invalid && <p className="text-xs text-destructive">#RRGGBB 형식으로 입력하세요</p>}
        {token.kind === "color" && (
          <fieldset aria-label="빠른 선택" className="flex gap-2">
            {QUICK.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className="size-11 rounded-lg border"
                style={{ background: c }}
                onClick={() => ed.updateToken(token.name, c)}
              />
            ))}
          </fieldset>
        )}
      </Section>
      <Section title={`쓰는 화면 ${users.length}`} action={<span className="text-[13px] text-muted-foreground">즉시 갱신</span>}>
        <div className="grid grid-cols-2 gap-3">
          {users.map((s) => (
            <button
              key={s.id}
              type="button"
              className="flex flex-col gap-1.5 text-left"
              onClick={() => {
                ed.setView("flow");
                ed.select({ kind: "screen", id: s.id });
              }}
            >
              <span className="overflow-hidden rounded-lg">
                <ScreenView screen={s} mode="variant" width={140} tokens={project.tokens} />
              </span>
              <span className="text-[13px] font-bold">{s.name}</span>
            </button>
          ))}
        </div>
      </Section>
    </>
  );
}

const KIND_LABEL: Record<MotionKind, string> = { push: "밀어내기", fade: "페이드", zoom: "확대", none: "즉시" };
const DIR_LABEL: Record<Direction, string> = { left: "왼쪽으로", right: "오른쪽으로", up: "위로", down: "아래로" };

function MotionInspector({ preset }: { preset: MotionPreset }) {
  const project = useEditor((s) => s.project);
  const ed = useEditor.getState();
  const patch = (p: Partial<MotionPreset>) => ed.updateMotion(preset.id, p);
  const uses = project.transitions.filter((t) => t.motionId === preset.id);
  const name = (id: string) => project.screens.find((s) => s.id === id)?.name ?? "?";

  return (
    <>
      <Header eyebrow="모션 프리셋" title={preset.name} />
      <Section title="속성">
        <Field label="이름">
          <Input className="h-9" value={preset.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="종류">
          <select className={selectClass} value={preset.kind} onChange={(e) => patch({ kind: e.target.value as MotionKind })}>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="길이 (ms)">
          <Input className="h-9" type="number" min={0} max={2000} step={10} value={preset.durationMs} onChange={(e) => patch({ durationMs: Number(e.target.value) })} />
        </Field>
        <Field label="이징">
          <select className={selectClass} value={preset.easing} onChange={(e) => patch({ easing: e.target.value as EasingName })}>
            {Object.entries(EASING_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </Field>
        {preset.kind === "push" && (
          <Field label="방향">
            <select className={selectClass} value={preset.direction} onChange={(e) => patch({ direction: e.target.value as Direction })}>
              {Object.entries(DIR_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
        )}
      </Section>
      <Section title="모션 줄이기">
        <Field label="대체 동작">
          <select
            className={selectClass}
            value={preset.reduced?.kind ?? ""}
            onChange={(e) => patch({ reduced: e.target.value ? { kind: e.target.value as "fade" | "none", durationMs: preset.reduced?.durationMs ?? 120 } : null })}
          >
            <option value="">없음</option>
            <option value="fade">페이드</option>
            <option value="none">즉시</option>
          </select>
        </Field>
        {preset.reduced?.kind === "fade" && (
          <Field label="길이 (ms)">
            <Input
              className="h-9"
              type="number"
              min={0}
              max={1000}
              step={10}
              value={preset.reduced.durationMs}
              onChange={(e) => patch({ reduced: { kind: "fade", durationMs: Number(e.target.value) } })}
            />
          </Field>
        )}
      </Section>
      <Section title={`쓰는 전이 ${uses.length}`}>
        <ul className="flex flex-col gap-1 text-sm">
          {uses.map((t) => (
            <li key={t.id}>
              <button type="button" className="hover:text-brand" onClick={() => ed.select({ kind: "transition", id: t.id })}>
                {name(t.from)} → {name(t.to)}
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function RuleInspector({ rule }: { rule: Rule }) {
  const { results } = useRuleState();
  const ed = useEditor.getState();
  const result = results.find((r) => r.rule.id === rule.id);
  return (
    <>
      <Header eyebrow={`규칙 · ${rule.category}`} title={rule.title} sub={rule.description} />
      <Section title="설정">
        <Field label="사용">
          <input type="checkbox" aria-label="규칙 사용" checked={rule.enabled} onChange={(e) => ed.updateRule(rule.id, { enabled: e.target.checked })} />
        </Field>
        {rule.check === "touch-target" && (
          <Field label="최소 크기">
            <Input
              className="h-9"
              type="number"
              min={24}
              max={96}
              value={rule.params?.minSize ?? 48}
              onChange={(e) => ed.updateRule(rule.id, { params: { minSize: Number(e.target.value) }, title: `터치 영역 ${e.target.value}px 이상` })}
            />
          </Field>
        )}
      </Section>
      <Section title={`위반 ${result?.violations.length ?? 0}`}>
        {result?.violations.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {result.violations.map((v) => (
              <li key={`${v.screenId ?? v.transitionId}-${v.message}`}>
                <button
                  type="button"
                  className="text-left hover:text-brand"
                  onClick={() => {
                    ed.setView("flow");
                    if (v.screenId) ed.select({ kind: "screen", id: v.screenId });
                    else if (v.transitionId) ed.select({ kind: "transition", id: v.transitionId });
                  }}
                >
                  {v.message}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{rule.enabled ? "모두 통과" : "꺼져 있음"}</p>
        )}
      </Section>
    </>
  );
}
