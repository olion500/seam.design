import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, type ProjectSummary } from "@/lib/api";
import { useEditor } from "@/store/store";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error"; message: string };
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function OpenProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [list, setList] = useState<Load<ProjectSummary[]>>({ state: "loading" });

  useEffect(() => {
    if (!open) return;
    setList({ state: "loading" });
    api.listProjects().then(
      (data) => setList({ state: "ok", data }),
      (e) => setList({ state: "error", message: errorText(e) }),
    );
  }, [open]);

  const openProject = async (id: string) => {
    try {
      useEditor.getState().loadProject(await api.getProject(id));
      onOpenChange(false);
    } catch (e) {
      setList({ state: "error", message: errorText(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>서버 프로젝트 열기</DialogTitle>
          <DialogDescription>서버에 저장된 명세 목록입니다. 최근에 고친 순서로 보여 줍니다.</DialogDescription>
        </DialogHeader>
        {list.state === "loading" && <p className="text-sm text-muted-foreground">불러오는 중…</p>}
        {list.state === "error" && <p className="text-sm text-destructive">{list.message}</p>}
        {list.state === "ok" && (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {list.data.length === 0 && <li className="text-sm text-muted-foreground">저장된 프로젝트가 없습니다</li>}
            {list.data.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted"
                  onClick={() => void openProject(p.id)}
                >
                  <b>{p.name}</b>
                  <span className="text-xs text-muted-foreground">{new Date(p.updatedAt).toLocaleString("ko-KR")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ShareDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [link, setLink] = useState<Load<string>>({ state: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLink({ state: "loading" });
    setCopied(false);
    api.createShare(useEditor.getState().project).then(
      ({ id }) => setLink({ state: "ok", data: `${location.origin}${location.pathname}#/share/${id}` }),
      (e) => setLink({ state: "error", message: errorText(e) }),
    );
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>공유 링크</DialogTitle>
          <DialogDescription>지금 상태의 사본을 링크로 만듭니다. 받은 사람이 고쳐도 원본은 바뀌지 않습니다.</DialogDescription>
        </DialogHeader>
        {link.state === "loading" && <p className="text-sm text-muted-foreground">링크 만드는 중…</p>}
        {link.state === "error" && <p className="text-sm text-destructive">{link.message}</p>}
        {link.state === "ok" && (
          <div className="flex gap-2">
            <Input readOnly aria-label="공유 링크" value={link.data} onFocus={(e) => e.target.select()} />
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(link.data);
                setCopied(true);
              }}
            >
              {copied ? "복사됨" : "복사"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
