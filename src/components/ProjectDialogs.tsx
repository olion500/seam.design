import { useEffect, useState } from "react";
import { Tip } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, type ProjectSummary } from "@/lib/api";
import { saveProject, useSync } from "@/store/persist";
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
          <DialogDescription>최근에 고친 순서</DialogDescription>
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

export function SendToAgentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [waiting, setWaiting] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<{ state: "idle" | "sending" } | { state: "sent"; agentWaiting: boolean } | { state: "error"; message: string }>({ state: "idle" });

  useEffect(() => {
    if (!open) return;
    setState({ state: "idle" });
    setWaiting(null);
    api.repo().then(
      (r) => setWaiting(r.agentWaiting),
      () => setWaiting(null),
    );
  }, [open]);

  const send = async () => {
    setState({ state: "sending" });
    const { project, savedProject } = useEditor.getState();
    if (project !== savedProject) await saveProject(project);
    if (useSync.getState().status !== "repo") {
      setState({ state: "error", message: "레포에 저장하지 못했습니다. seam open 서버를 확인하세요." });
      return;
    }
    try {
      const res = await api.sendToAgent(message);
      setMessage("");
      setState({ state: "sent", agentWaiting: res.agentWaiting });
    } catch (e) {
      setState({ state: "error", message: errorText(e) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>AI에게 보내기</DialogTitle>
          <DialogDescription>요청과 바뀐 토큰·흐름을 저장해서 보냅니다.</DialogDescription>
        </DialogHeader>
        {state.state === "sent" ? (
          <>
            <p className="text-sm">
              {state.agentWaiting ? "보냈습니다. AI가 바로 시작합니다." : "보냈습니다. AI가 기다리기를 시작하면 받습니다."}
            </p>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>닫기</Button>
            </div>
          </>
        ) : (
          <>
            <Tip label={waiting ? "보내면 AI가 바로 시작합니다" : "보내 두면 AI가 기다리기를 시작할 때 받습니다"}>
              <span tabIndex={-1} className="flex items-center gap-2 self-start text-xs text-muted-foreground">
                <span aria-hidden className={waiting ? "size-2 rounded-full bg-brand" : "size-2 rounded-full bg-chip"} />
                {waiting === null ? "확인 중…" : waiting ? "AI 대기 중" : "기다리는 AI 없음"}
              </span>
            </Tip>
            <textarea
              aria-label="AI에게 전할 말"
              placeholder="AI에게 전할 말 (선택)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={10_000}
              rows={4}
              className="w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {state.state === "error" && <p className="text-sm text-destructive">{state.message}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button disabled={state.state === "sending"} onClick={() => void send()}>
                {state.state === "sending" ? "보내는 중…" : "보내기"}
              </Button>
            </div>
          </>
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
          <DialogDescription>지금 상태의 사본입니다. 받은 사람이 고쳐도 원본은 그대로입니다.</DialogDescription>
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
