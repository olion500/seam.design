import { useCallback, useEffect, useRef, useState } from "react";
import { bridgeVars } from "@/model/tokens";
import type { Screen } from "@/model/types";
import { useEditor } from "@/store/store";

export function LiveFrame({ screen, url, width }: { screen: Screen; url: string; width: number }) {
  const tokens = useEditor((s) => s.project.tokens);
  const frame = useRef<HTMLIFrameElement>(null);
  const [connected, setConnected] = useState(false);
  const scale = width / screen.size.w;

  const push = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "seam:tokens", vars: bridgeVars(tokens) }, "*");
  }, [tokens]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.type !== "seam:ready") return;
      setConnected(true);
      push();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [push]);

  useEffect(push, [push]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-md border bg-white" style={{ width, height: screen.size.h * scale }}>
        <iframe
          ref={frame}
          src={url}
          title={`${screen.name} 라이브 시안`}
          onLoad={push}
          style={{ width: screen.size.w, height: screen.size.h, border: 0, transform: `scale(${scale})`, transformOrigin: "0 0" }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{connected ? "브리지 연결됨 · 토큰을 바꾸면 바로 반영" : "브리지 없음 · 앱에 seam-bridge.js를 넣으면 토큰이 반영됩니다"}</span>
    </div>
  );
}
