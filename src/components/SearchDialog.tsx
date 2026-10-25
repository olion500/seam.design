import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Selection, View } from "@/model/types";
import { useEditor } from "@/store/store";

interface Hit {
  key: string;
  group: string;
  label: string;
  view: View;
  selection: Selection;
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const project = useEditor((s) => s.project);
  const [q, setQ] = useState("");
  const all: Hit[] = [
    ...project.screens.map((s) => ({ key: `s${s.id}`, group: "화면", label: s.name, view: "flow" as const, selection: { kind: "screen", id: s.id } as const })),
    ...project.tokens.map((t) => ({ key: `k${t.name}`, group: "토큰", label: `${t.name} · ${t.value}`, view: "system" as const, selection: { kind: "token", id: t.name } as const })),
    ...project.rules.map((r) => ({ key: `r${r.id}`, group: "규칙", label: r.title, view: "rules" as const, selection: { kind: "rule", id: r.id } as const })),
    ...project.motions.map((m) => ({ key: `m${m.id}`, group: "모션", label: m.name, view: "motion" as const, selection: { kind: "motion", id: m.id } as const })),
  ];
  const hits = all.filter((h) => h.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 12);
  const go = (h: Hit) => {
    location.hash = `#/${h.view}`;
    const ed = useEditor.getState();
    ed.setView(h.view);
    ed.select(h.selection);
    onOpenChange(false);
    setQ("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-4">
        <DialogTitle className="sr-only">검색</DialogTitle>
        <Input
          autoFocus
          placeholder="화면, 토큰, 규칙, 모션 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && hits[0] && go(hits[0])}
        />
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {hits.map((h) => (
            <li key={h.key}>
              <button type="button" className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-muted" onClick={() => go(h)}>
                <span className="w-10 text-xs text-muted-foreground">{h.group}</span>
                {h.label}
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="px-2 py-2 text-sm text-muted-foreground">결과 없음</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
