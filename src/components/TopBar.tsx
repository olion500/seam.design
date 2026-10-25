import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { parseProject, toJSON, toMarkdown } from "@/model/exportSpec";
import type { View } from "@/model/types";
import { isDirty, useEditor } from "@/store/store";
import { download, pickFile } from "@/lib/files";
import { cn } from "@/lib/utils";
import { SearchDialog } from "./SearchDialog";

const VIEWS: { id: View; label: string }[] = [
  { id: "flow", label: "흐름" },
  { id: "system", label: "디자인 시스템" },
  { id: "rules", label: "규칙" },
  { id: "motion", label: "모션" },
];

export function TopBar() {
  const name = useEditor((s) => s.project.name);
  const view = useEditor((s) => s.view);
  const dirty = useEditor(isDirty);
  const ed = useEditor.getState();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();

  const importJSON = async () => {
    const file = await pickFile("application/json,.json");
    if (!file) return;
    try {
      ed.loadProject(parseProject(await file.text()), false);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <header className="flex min-h-16 w-full flex-wrap items-center gap-x-6 gap-y-3 border-b bg-white px-6 py-2">
      <div className="flex min-w-0 flex-[1_1_240px] items-center gap-3">
        <span className="text-base font-extrabold tracking-tight">명세</span>
        <span aria-hidden className="h-5 w-px bg-border" />
        <input
          aria-label="프로젝트 이름"
          value={name}
          onChange={(e) => ed.renameProject(e.target.value)}
          className="min-w-0 truncate rounded px-1 text-[15px] font-semibold outline-none focus:bg-muted"
          style={{ width: `${Math.max(4, name.length + 2)}ch` }}
        />
        {dirty && (
          <span title="저장 안 됨" className="size-2 shrink-0 rounded-full bg-brand">
            <span className="sr-only">저장 안 됨</span>
          </span>
        )}
        {error && <span className="truncate text-xs text-destructive">{error}</span>}
      </div>

      <nav aria-label="보기 전환" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {VIEWS.map((v) => (
          <a
            key={v.id}
            href={`#/${v.id}`}
            aria-current={view === v.id ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-lg px-4 text-[15px] font-[550] text-muted-foreground",
              view === v.id && "bg-white font-bold text-foreground shadow-soft",
            )}
          >
            {v.label}
          </a>
        ))}
      </nav>

      <div className="flex flex-[1_1_240px] items-center justify-end gap-2">
        <Button variant="secondary" size="icon" aria-label="검색" onClick={() => setSearching(true)}>
          <Search />
        </Button>
        <Button variant="secondary" disabled title="공유 링크는 서버 저장 단계에서 지원합니다">
          공유
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              명세 내보내기 <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>내보내기</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => download(`${name}.md`, toMarkdown(useEditor.getState().project), "text/markdown")}>Markdown 명세</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download(`${name}.json`, toJSON(useEditor.getState().project), "application/json")}>JSON 프로젝트</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>프로젝트</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => void importJSON()}>JSON 가져오기</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ed.newProject()}>새 프로젝트</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ed.loadExample()}>예시 프로젝트 불러오기</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span role="img" aria-label="sanghun oh" title="sanghun oh" className="ml-1 flex size-8 items-center justify-center rounded-full bg-chip text-xs font-bold">
          SO
        </span>
      </div>
      <SearchDialog open={searching} onOpenChange={setSearching} />
    </header>
  );
}
