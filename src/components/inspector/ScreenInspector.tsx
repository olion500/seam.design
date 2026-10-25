import { useState } from "react";
import { ArrowRight, Check, ImagePlus, Trash2, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eyebrow, Field, Section, StatusBadge, selectClass } from "@/components/bits";
import { screenChanges } from "@/model/diff";
import { tokensInSpec } from "@/model/tokens";
import type { ButtonVariant, Screen, ScreenElement, ScreenSpec } from "@/model/types";
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

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Eyebrow>화면</Eyebrow>
          <input
            aria-label="화면 이름"
            value={screen.name}
            onChange={(e) => ed.updateScreen(screen.id, { name: e.target.value })}
            className="-mx-1 rounded px-1 text-xl font-bold tracking-tight outline-none focus:bg-muted"
          />
          <div className="flex items-center gap-1.5">
            <StatusBadge variant={!!screen.variant}>{screen.variant ? `시안 v${screen.variant.version}` : "기준"}</StatusBadge>
            {screen.variant && <span className="text-[13px] text-muted-foreground">기준 대비 변경 {changes.length}건</span>}
          </div>
        </div>
        <Button variant="secondary" size="icon" aria-label="검사기 닫기" onClick={() => ed.select(null)}>
          <X />
        </Button>
      </div>

      <Section title="속성">
        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2.5 text-sm">
          <dt className="text-muted-foreground">크기</dt>
          <dd>
            {screen.size.w} × {screen.size.h}
          </dd>
          <dt className="text-muted-foreground">기준</dt>
          <dd className="flex items-center gap-2">
            {screen.baseline ? screen.baseline.capturedAt ?? "있음" : "기준 이미지 없음"}
            <button type="button" className="text-brand" onClick={() => void uploadBaseline(screen.id)} aria-label="기준 스크린샷 올리기">
              <ImagePlus className="size-4" />
            </button>
          </dd>
          <dt className="text-muted-foreground">시안</dt>
          <dd>
            {screen.variant ? (
              `v${screen.variant.version} · ${screen.variant.updatedAt}`
            ) : (
              <Button size="sm" variant="brand" onClick={() => ed.createVariant(screen.id)}>
                시안 만들기
              </Button>
            )}
          </dd>
          <dt className="text-muted-foreground">상태</dt>
          <dd>
            <Input
              aria-label="화면 상태"
              className="h-8"
              defaultValue={screen.states.join(" · ")}
              onBlur={(e) => ed.updateScreen(screen.id, { states: e.target.value.split(/[·,]/).map((x) => x.trim()).filter(Boolean) })}
            />
          </dd>
          <dt className="text-muted-foreground">마지막 화면</dt>
          <dd>
            <input type="checkbox" aria-label="마지막 화면" checked={!!screen.terminal} onChange={(e) => ed.updateScreen(screen.id, { terminal: e.target.checked })} />
          </dd>
        </dl>
      </Section>

      {screen.variant && (
        <Section title="변경 내역">
          {changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">기준과 같습니다. 아래 요소를 바꾸면 여기에 나옵니다.</p>
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
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground">없음. 화면 속 요소를 다른 화면으로 끌어 만드세요.</p>
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

      <Section title="관리">
        <div className="flex flex-wrap gap-2">
          {screen.variant && (
            <Button variant="secondary" size="sm" onClick={() => ed.discardVariant(screen.id)}>
              시안 버리기
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => ed.removeScreen(screen.id)}>
            <Trash2 /> 화면 삭제
          </Button>
        </div>
      </Section>
    </>
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
          <Input className="h-9" value={el.label} onChange={(e) => patch({ label: e.target.value })} />
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
            <Input className="h-9" type="number" min={24} max={96} value={el.height ?? 56} onChange={(e) => patch({ height: Number(e.target.value) })} />
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
  const [path, setPath] = useState("");
  const [note, setNote] = useState("");
  const add = () => {
    if (!path.trim()) return;
    ed.setSources(screen.id, [...screen.sources, { path: path.trim(), note: note.trim() || "화면 일부" }]);
    setPath("");
    setNote("");
  };
  return (
    <Section title="소스 매핑">
      <ul className="flex flex-col gap-2 text-[13px]">
        {screen.sources.map((m, i) => (
          <li key={`${m.path}|${m.note}`} className="group flex items-start gap-2 rounded-lg bg-muted px-2.5 py-2">
            <span className="flex flex-1 flex-col gap-0.5">
              <code className="font-mono">{m.path}</code>
              <span className="text-muted-foreground">{m.note}</span>
            </span>
            <button
              type="button"
              aria-label={`${m.path} 매핑 삭제`}
              className="text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
              onClick={() => ed.setSources(screen.id, screen.sources.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
            </button>
          </li>
        ))}
        {tokens.length > 0 && (
          <li className="flex flex-col gap-0.5 rounded-lg bg-muted px-2.5 py-2">
            <code className="font-mono">{tokens.join(" · ")}</code>
            <span className="text-muted-foreground">쓰는 토큰</span>
          </li>
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input aria-label="소스 경로" placeholder="src/screens/…" className="h-9 font-mono text-[13px]" value={path} onChange={(e) => setPath(e.target.value)} />
        <Input aria-label="매핑 설명" placeholder="설명" className="h-9 w-24" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" size="sm" variant="secondary" className="h-9">
          추가
        </Button>
      </form>
    </Section>
  );
}

export function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-[550] hover:text-brand">
      {children}
    </button>
  );
}
