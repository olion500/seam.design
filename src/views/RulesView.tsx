import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RULE_TEMPLATES } from "@/model/rules";
import { useRuleState } from "@/store/derived";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

export function RulesView() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const { select, addRule, updateRule } = useEditor.getState();
  const { results } = useRuleState();
  const [adding, setAdding] = useState(false);
  const total = results.reduce((n, r) => n + r.violations.length, 0);
  const screenName = (id?: string) => project.screens.find((s) => s.id === id)?.name;
  const addable = RULE_TEMPLATES.filter((t) => !project.rules.some((r) => r.check === t.check));

  return (
    <main aria-label="규칙" className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto bg-muted px-10 pt-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">규칙 {project.rules.length}</h2>
          <span className="text-sm text-muted-foreground">
            위반 {total}건 · 화면 {project.screens.length}개 검사
          </span>
        </div>
        {addable.length > 0 && (
          <Button onClick={() => setAdding(true)}>
            <Plus /> 규칙 추가
          </Button>
        )}
      </div>

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
        {results.map(({ rule, violations, scope, scopeLabel }) => {
          const active = selection?.kind === "rule" && selection.id === rule.id;
          const names = [...new Set(violations.map((v) => screenName(v.screenId) ?? v.message.split(":")[0]))];
          const where = names.length > 3 ? `${names.slice(0, 3).join(", ")} 외 ${names.length - 3}곳` : names.join(", ");
          return (
            <li key={rule.id}>
              <article
                className={cn(
                  "relative flex h-full flex-col gap-3 rounded-xl bg-white p-5 text-left focus-within:ring-[3px] focus-within:ring-ring/50",
                  active && "shadow-[inset_0_0_0_2px_var(--brand)]",
                  !rule.enabled && "opacity-60",
                )}
              >
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-bold">{rule.category}</span>
                  <span>
                    연결 {scopeLabel} {scope}
                  </span>
                </div>
                <h3 className="text-base font-bold">
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
                      "inline-flex h-7 min-w-0 items-center truncate rounded-full px-3 text-xs font-bold",
                      !rule.enabled ? "bg-chip" : violations.length ? "bg-warn" : "bg-muted",
                    )}
                  >
                    {!rule.enabled ? "꺼짐" : violations.length ? `위반 ${violations.length} · ${where}` : "모두 통과"}
                  </span>
                  <label className="relative z-10 flex shrink-0 items-center gap-1.5 text-xs">
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
            <DialogDescription>고르면 바로 적용됩니다.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-2">
            {addable.map((t) => (
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
