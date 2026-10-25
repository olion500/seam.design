import type { CSSProperties } from "react";
import type { EasingName, MotionPreset } from "@/model/types";

const CURVES: Record<EasingName, [number, number, number, number]> = {
  "standard-decel": [0, 0, 0.2, 1],
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1],
  linear: [0, 0, 1, 1],
};

export const EASING_LABEL: Record<EasingName, string> = {
  "standard-decel": "표준 감속",
  standard: "표준",
  emphasized: "강조",
  linear: "선형",
};

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < x) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

export const ease = (name: EasingName, t: number) => bezier(...CURVES[name])(t);

export interface EffectiveMotion {
  kind: MotionPreset["kind"];
  durationMs: number;
  easing: EasingName;
  direction: MotionPreset["direction"];
}

export function effectiveMotion(preset: MotionPreset, reduced: boolean): EffectiveMotion {
  if (!reduced || preset.kind === "fade" || preset.kind === "none") return preset;
  const fallback = preset.reduced ?? { kind: "none" as const, durationMs: 0 };
  return { kind: fallback.kind, durationMs: fallback.durationMs, easing: "standard", direction: preset.direction };
}

const OFFSET: Record<MotionPreset["direction"], [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

export function frameStyles(motion: EffectiveMotion, progress: number): { from: CSSProperties; to: CSSProperties } {
  const p = ease(motion.easing, progress);
  switch (motion.kind) {
    case "push": {
      const [dx, dy] = OFFSET[motion.direction];
      return {
        from: { transform: `translate(${dx * p * 100}%, ${dy * p * 100}%)` },
        to: { transform: `translate(${-dx * (1 - p) * 100}%, ${-dy * (1 - p) * 100}%)` },
      };
    }
    case "fade":
      return { from: { opacity: 1 - p }, to: { opacity: p } };
    case "zoom":
      return { from: { opacity: 1 - p * 0.5 }, to: { opacity: p, transform: `scale(${0.88 + 0.12 * p})` } };
    case "none":
      return progress >= 1 ? { from: { opacity: 0 }, to: { opacity: 1 } } : { from: { opacity: 1 }, to: { opacity: 0 } };
  }
}
