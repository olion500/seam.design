import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { deviceSize } from "@/model/devices";
import { bridgeVars, liveOverrides, liveSrc } from "@/model/tokens";
import type { Screen } from "@/model/types";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

interface Props {
  screen: Screen;
  url: string;
  width: number;
  compact?: boolean;
  interactive?: boolean;
}

export function LiveFrame({ screen, url, width, compact = false, interactive = true }: Props) {
  const tokens = useEditor((s) => s.project.tokens);
  const source = useEditor((s) => s.project.source);
  const size = deviceSize(useEditor((s) => s.project.device));
  const frame = useRef<HTMLIFrameElement>(null);
  const [connected, setConnected] = useState(false);
  const scale = width / size.w;
  const src = useDeferredValue(liveSrc(url, liveOverrides({ tokens, source })));

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
      <div className={cn("overflow-hidden bg-white", compact ? "rounded" : "rounded-md border")} style={{ width, height: size.h * scale }}>
        <iframe
          ref={frame}
          src={src}
          title={`${screen.name} 라이브 시안`}
          loading="lazy"
          tabIndex={interactive ? undefined : -1}
          onLoad={push}
          style={{
            width: size.w,
            height: size.h,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            pointerEvents: interactive ? undefined : "none",
          }}
        />
      </div>
      {!compact && (
        <span className="text-xs text-muted-foreground">
          {connected
            ? "브리지 연결됨 · 토큰을 바꾸면 바로 반영"
            : source
              ? "실행 중인 앱 · 토큰을 바꾸면 seam-tokens 주소로 다시 불러옵니다"
              : "브리지 없음 · 앱에 seam-bridge.js를 넣으면 토큰이 반영됩니다"}
        </span>
      )}
    </div>
  );
}
