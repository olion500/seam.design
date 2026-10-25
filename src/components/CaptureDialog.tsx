import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { deviceOf } from "@/model/devices";
import { useEditor } from "@/store/store";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialUrl?: string;
  onCaptured: (image: string, url: string) => void;
}

export function CaptureDialog({ open, onOpenChange, initialUrl = "", onCaptured }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const device = deviceOf(useEditor((s) => s.project.device));
  const [width, setWidth] = useState(device.width);
  const [height, setHeight] = useState(device.height);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.capture(url.trim(), width, height);
      onCaptured(result.image, result.url);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>URL에서 캡처</DialogTitle>
          <DialogDescription>서버의 헤드리스 브라우저로 페이지를 열어 기준 스크린샷을 찍습니다.</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Input autoFocus aria-label="캡처할 URL" placeholder="http://localhost:5173/checkout" value={url} onChange={(e) => setUrl(e.target.value)} />
          <div className="flex items-center gap-2 text-sm">
            <Input aria-label="너비" type="number" className="w-24" value={width} onChange={(e) => setWidth(Number(e.target.value))} />×
            <Input aria-label="높이" type="number" className="w-24" value={height} onChange={(e) => setHeight(Number(e.target.value))} />
            <span className="text-muted-foreground">px</span>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || !url.trim()}>
              {busy ? "캡처 중…" : "캡처"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
