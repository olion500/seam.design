import { useState } from "react";
import { Cloud, CloudOff, Ellipsis, FolderGit2, Search, Send, Share2 } from "lucide-react";
import { Tip, blurOnEnter } from "@/components/bits";
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
import { useSync } from "@/store/persist";
import { isDirty, useEditor } from "@/store/store";
import { download, pickFile } from "@/lib/files";
import { cn } from "@/lib/utils";
import { OpenProjectDialog, SendToAgentDialog, ShareDialog } from "./ProjectDialogs";
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
  const sync = useSync();
  const [searching, setSearching] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
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
        <span className="text-base font-bold">명세</span>
        <span aria-hidden className="h-5 w-px bg-border" />
        <input
          aria-label="프로젝트 이름"
          onKeyDown={blurOnEnter}
          value={name}
          onChange={(e) => ed.renameProject(e.target.value)}
          className="min-w-0 truncate rounded px-1 text-base font-bold outline-none focus:bg-muted"
          style={{ width: `${Math.max(4, name.length + 2)}ch` }}
        />
        {dirty && (
          <span title="저장 안 됨" className="size-2 shrink-0 rounded-full bg-brand">
            <span className="sr-only">저장 안 됨</span>
          </span>
        )}
        {sync.repo ? (
          <Tip label={`${sync.repo}/.seam/에 저장${dirty ? "합니다" : "됨"}`}>
            <span tabIndex={-1} className="inline-flex min-w-0 shrink items-center gap-1 text-xs text-muted-foreground">
              <FolderGit2 className="size-3.5 shrink-0" />
              <span className="truncate">{sync.repo.split("/").pop()}</span>
            </span>
          </Tip>
        ) : (
          !dirty &&
          (sync.status === "local-only" || sync.status === "server") && (
            <Tip label={sync.status === "server" ? "서버에 저장됨" : "서버에 연결하지 못해 이 브라우저에만 저장했습니다"}>
              <span tabIndex={-1} className={cn("shrink-0", sync.status === "server" ? "text-muted-foreground" : "text-warn")}>
                {sync.status === "server" ? <Cloud className="size-4" aria-label="서버에 저장됨" /> : <CloudOff className="size-4" aria-label="로컬에만 저장됨" />}
              </span>
            </Tip>
          )
        )}
        {(error ?? sync.notice) && (
          <button
            type="button"
            className={cn("truncate text-xs", error ? "text-destructive" : "text-brand")}
            title="닫기"
            onClick={() => {
              setError(undefined);
              useSync.setState({ notice: null });
            }}
          >
            {error ?? sync.notice}
          </button>
        )}
      </div>

      <nav aria-label="보기 전환" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {[...VIEWS, ...(sync.repo ? [{ id: "review" as const, label: "검토" }] : [])].map((v) => (
          <a
            key={v.id}
            href={`#/${v.id}`}
            aria-current={view === v.id ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-muted-foreground",
              view === v.id && "bg-white text-foreground shadow-soft",
            )}
          >
            {v.label}
            {v.id === "review" && sync.review?.verify && (
              <span className="ml-1.5 rounded-full bg-change px-1.5 text-xs font-bold text-white">
                {sync.review.changes.length}
              </span>
            )}
          </a>
        ))}
      </nav>

      <div className="flex flex-[1_1_240px] items-center justify-end gap-2">
        <Tip label="검색">
          <Button variant="secondary" size="icon" aria-label="검색" onClick={() => setSearching(true)}>
            <Search />
          </Button>
        </Tip>
        <Tip label="공유 링크 만들기">
          <Button variant="secondary" size="icon" aria-label="공유" onClick={() => setSharing(true)}>
            <Share2 />
          </Button>
        </Tip>
        <DropdownMenu>
          <Tip label="내보내기 · 프로젝트">
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" aria-label="내보내기와 프로젝트 메뉴">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>내보내기</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => download(`${name}.md`, toMarkdown(useEditor.getState().project), "text/markdown")}>Markdown 명세</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download(`${name}.json`, toJSON(useEditor.getState().project), "application/json")}>JSON 프로젝트</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>프로젝트</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setOpening(true)}>서버 프로젝트 열기</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void importJSON()}>JSON 가져오기</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ed.newProject()}>새 프로젝트</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => ed.loadExample()}>예시 프로젝트 불러오기</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {sync.repo && (
          <Button onClick={() => setSending(true)}>
            <Send /> AI에게 보내기
          </Button>
        )}
        <span role="img" aria-label="sanghun oh" title="sanghun oh" className="ml-1 flex size-8 items-center justify-center rounded-full bg-chip text-xs font-bold">
          SO
        </span>
      </div>
      <SearchDialog open={searching} onOpenChange={setSearching} />
      <ShareDialog open={sharing} onOpenChange={setSharing} />
      <OpenProjectDialog open={opening} onOpenChange={setOpening} />
      <SendToAgentDialog open={sending} onOpenChange={setSending} />
    </header>
  );
}
