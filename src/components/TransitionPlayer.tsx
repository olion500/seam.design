import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScreenView } from "@/components/ScreenView";
import { effectiveMotion, frameStyles } from "@/lib/transition";
import { useEditor } from "@/store/store";
import type { MotionPreset, Screen } from "@/model/types";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

interface Props {
  from: Screen;
  to: Screen;
  preset: MotionPreset;
  width?: number;
  reduced?: boolean;
  autoPlayKey?: number;
}

export function TransitionPlayer({ from, to, preset, width = 150, reduced: forced, autoPlayKey }: Props) {
  const tokens = useEditor((s) => s.project.tokens);
  const systemReduced = usePrefersReducedMotion();
  const motion = effectiveMotion(preset, forced ?? systemReduced);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  const play = () => {
    cancelAnimationFrame(raf.current);
    if (motion.durationMs === 0) {
      setProgress(1);
      return;
    }
    const start = performance.now();
    setPlaying(true);
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / motion.durationMs);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const playRef = useRef(play);
  playRef.current = play;
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  useEffect(() => {
    if (autoPlayKey) playRef.current();
  }, [autoPlayKey]);

  const frames = frameStyles(motion, progress);
  const height = (from.size.h / from.size.w) * width;
  const ms = Math.round(progress * motion.durationMs);

  return (
    <div className="flex flex-col gap-3">
      <div role="img" className="relative overflow-hidden rounded-lg bg-muted" style={{ width, height }} aria-label={`${from.name}에서 ${to.name}로 전환`}>
        <div className="absolute inset-0" style={frames.from}>
          <ScreenView screen={from} mode="variant" width={width} tokens={tokens} />
        </div>
        <div className="absolute inset-0" style={frames.to}>
          <ScreenView screen={to} mode="variant" width={width} tokens={tokens} />
        </div>
      </div>
      <div className="flex items-center gap-3" style={{ width: Math.max(width, 320) }}>
        <Button size="icon" variant="secondary" aria-label={playing ? "재생 중" : "전환 재생"} onClick={play}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Slider
          aria-label="재생 위치"
          value={[progress * 100]}
          max={100}
          step={1}
          onValueChange={([v]) => {
            cancelAnimationFrame(raf.current);
            setPlaying(false);
            setProgress(v / 100);
          }}
          className="flex-1"
        />
        <span className="w-24 text-right text-xs tabular-nums text-muted-foreground">
          {ms} / {motion.durationMs}ms
        </span>
      </div>
      {motion.kind !== preset.kind && <span className="text-xs text-muted-foreground">모션 줄이기: {motion.kind === "fade" ? `페이드 ${motion.durationMs}ms` : "즉시"}로 대체</span>}
    </div>
  );
}
