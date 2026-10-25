import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Rule } from "@/model/types";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

const TEMPLATES: Omit<Rule, "id">[] = [
  { check: "single-primary", category: "레이아웃", title: "주요 버튼은 화면당 하나", description: "Primary·Accent 변형은 한 화면에 한 번만 쓴다.", enabled: true },
  { check: "touch-target", category: "접근성", title: "터치 영역 44px 이상", description: "누를 수 있는 요소는 가로·세로 44px 이상.", enabled: true, params: { minSize: 44 } },
  { check: "no-dead-end", category: "흐름", title: "모든 화면에 나가는 전이", description: "마지막 화면을 빼고 막다른 화면이 없어야 한다.", enabled: true },
  { check: "token-colors", category: "토큰", title: "색은 토큰으로만", description: "시안의 모든 색이 디자인 시스템 토큰에 매핑된다.", enabled: true },
  { check: "reduced-motion", category: "모션", title: "모션 줄이기 대체 동작", description: "이동이 있는 전환은 모두 대체 동작을 가진다.", enabled: true },
];

export function RulesView() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const { select, addRule, updateRule } = useEditor.getState();
  const { results } = useRuleState();
  const [adding, setAdding] = useState(false);
  const total = results.reduce((n, r) => n + r.violations.length, 0);
  const screenName = (id?: string) => project.screens.find((s) => s.id === id)?.name;

  return (
    <main aria-label="규칙" className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto bg-muted px-10 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-extrabold">규칙 {project.rules.length}</h2>
          <span className="text-sm text-muted-foreground">
            위반 {total}건 · 화면 {project.screens.length}개 검사
          </span>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus /> 규칙 추가
        </Button>
      </div>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {results.map(({ rule, violations, scope, scopeLabel }) => {
          const active = selection?.kind === "rule" && selection.id === rule.id;
          const where = [...new Set(violations.map((v) => screenName(v.screenId) ?? v.message.split(":")[0]))].join(", ");
          return (
            <li key={rule.id}>
              <article
                className={cn(
                  "relative flex h-full flex-col gap-3 rounded-xl bg-white p-5 text-left focus-within:ring-[3px] focus-within:ring-ring/50",
                  active && "shadow-[inset_0_0_0_2px_var(--brand)]",
                  !rule.enabled && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                  <span className="font-bold">{rule.category}</span>
                  <span>
                    연결 {scopeLabel} {scope}
                  </span>
                </div>
                <h3 className="text-lg font-bold tracking-tight">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => select({ kind: "rule", id: rule.id })}
                    className="text-left outline-none after:absolute after:inset-0 after:rounded-xl"
                  >
                    {rule.title}
                  </button>
                </h3>
                <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{rule.description}</p>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex h-7 items-center rounded-full px-3 text-[13px] font-bold",
                      !rule.enabled ? "bg-chip" : violations.length ? "bg-warn" : "bg-muted",
                    )}
                  >
                    {!rule.enabled ? "꺼짐" : violations.length ? `위반 ${violations.length} · ${where}` : "모두 통과"}
                  </span>
                  <label className="relative z-10 flex items-center gap-1.5 text-[13px]">
                    <input type="checkbox" checked={rule.enabled} onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })} />
                    사용
                  </label>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>규칙 추가</DialogTitle>
            <DialogDescription>검사 방식을 고르면 지금 프로젝트에 바로 적용됩니다.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {TEMPLATES.map((t) => (
              <li key={t.title}>
                <button
                  type="button"
                  className="flex w-full flex-col gap-1 rounded-lg bg-muted px-4 py-3 text-left hover:bg-accent"
                  onClick={() => {
                    addRule(t);
                    setAdding(false);
                  }}
                >
                  <span className="text-xs font-bold text-muted-foreground">{t.category}</span>
                  <span className="font-bold">{t.title}</span>
                  <span className="text-sm text-muted-foreground">{t.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </main>
  );
}
