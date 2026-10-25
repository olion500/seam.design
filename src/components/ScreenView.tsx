import type { CSSProperties, ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { colorRef, lengthRef, tokenVars } from "@/model/tokens";
import type { Screen, ScreenElement, ScreenSpec, Token } from "@/model/types";
import { cn } from "@/lib/utils";

interface SpecViewProps {
  spec: ScreenSpec;
  tokens: Token[];
  width: number;
  size?: { w: number; h: number };
  changedIds?: Set<string>;
  layoutChanged?: boolean;
  focusId?: string | null;
  overlay?: (el: ScreenElement) => ReactNode;
}

const buttonStyle = (el: ScreenElement): CSSProperties => {
  const base: CSSProperties = {
    height: el.height ?? 56,
    borderRadius: "var(--tk-radius-xs)",
    fontSize: "var(--tk-button-size)",
    fontWeight: "var(--tk-button-weight)" as CSSProperties["fontWeight"],
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  };
  switch (el.variant) {
    case "accent":
      return { ...base, background: "var(--tk-accent)", color: "#000" };
    case "filled":
      return { ...base, background: "var(--tk-filled)" };
    case "ghost":
      return { ...base, border: "1px solid var(--tk-primary)" };
    default:
      return { ...base, background: "var(--tk-primary)", color: "#fff" };
  }
};

function Element({ el, center }: { el: ScreenElement; center: boolean }) {
  const text: CSSProperties = { textAlign: center ? "center" : "left" };
  switch (el.kind) {
    case "title":
      return <div style={{ ...text, fontSize: 26, fontWeight: 700, letterSpacing: -0.4 }}>{el.label}</div>;
    case "text":
      return <div style={{ ...text, fontSize: 16, color: "rgb(0 0 0 / 0.6)" }}>{el.label}</div>;
    case "field":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignSelf: "stretch" }}>
          <span style={{ fontSize: 14, color: "rgb(0 0 0 / 0.6)" }}>{el.label}</span>
          <span
            style={{
              height: el.height ?? 52,
              background: colorRef(el.fill),
              border: `1px solid ${colorRef(el.stroke) ?? "transparent"}`,
              borderRadius: "var(--tk-radius-xs)",
            }}
          />
        </div>
      );
    case "listItem":
      return (
        <div
          style={{
            height: el.height ?? 64,
            alignSelf: "stretch",
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            background: colorRef(el.fill),
            border: `2px solid ${colorRef(el.stroke) ?? "transparent"}`,
            borderRadius: "var(--tk-radius-xs)",
            fontSize: 17,
            fontWeight: 600,
          }}
        >
          <span style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${colorRef(el.stroke) ?? "var(--tk-hairline)"}` }} />
          {el.label}
        </div>
      );
    case "button":
      return <div style={buttonStyle(el)}>{el.label}</div>;
    case "spacer":
      return <div style={{ flex: 1 }} />;
    case "illustration":
      return (
        <div
          style={{
            width: el.size ?? 96,
            height: el.size ?? 96,
            borderRadius: 999,
            background: colorRef(el.fill),
            border: el.stroke ? `8px solid ${colorRef(el.stroke)}` : undefined,
            boxSizing: "border-box",
          }}
        />
      );
  }
}

export function SpecView({ spec, tokens, width, size = { w: 390, h: 844 }, changedIds, layoutChanged, focusId, overlay }: SpecViewProps) {
  const scale = width / size.w;
  const dot = 8 / scale;
  const center = spec.align === "center";
  return (
    <div style={{ width, height: size.h * scale, overflow: "hidden", position: "relative" }}>
      <div
        style={{
          ...tokenVars(tokens),
          width: size.w,
          height: size.h,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          boxSizing: "border-box",
          padding: "64px 24px 32px",
          display: "flex",
          flexDirection: "column",
          alignItems: center ? "center" : "stretch",
          gap: lengthRef(spec.gap),
          background: "var(--tk-surface)",
          color: "var(--tk-primary)",
          fontFamily: "var(--font-sans)",
          position: "relative",
        }}
      >
        {layoutChanged && <ChangeDot size={dot} style={{ right: 12, top: 12 }} />}
        {spec.elements.map((el) => (
          <div
            key={el.id}
            data-element-id={el.id}
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: center ? "center" : "stretch",
              flex: el.kind === "spacer" ? 1 : undefined,
              alignSelf: el.kind === "button" || el.kind === "field" || el.kind === "listItem" ? "stretch" : undefined,
              outline: focusId === el.id ? `${3 / scale}px solid var(--brand)` : undefined,
              outlineOffset: 4 / scale,
              borderRadius: 4,
            }}
          >
            <Element el={el} center={center} />
            {changedIds?.has(el.id) && <ChangeDot size={dot} style={{ right: -dot / 2, top: -dot / 2 }} />}
            {overlay?.(el)}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangeDot({ size, style }: { size: number; style: CSSProperties }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: 999,
        background: "var(--change)",
        boxShadow: `0 0 0 ${size / 4}px #fff`,
        zIndex: 2,
        ...style,
      }}
    />
  );
}

export function NoBaseline({ className, compact, style }: { className?: string; compact?: boolean; style?: CSSProperties }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 bg-chip text-center text-muted-foreground", className)} style={style}>
      <ImageIcon className={compact ? "size-6" : "size-8"} strokeWidth={1.5} />
      <span className="text-xs">기준 이미지 없음</span>
    </div>
  );
}

interface ScreenViewProps extends Omit<SpecViewProps, "spec" | "size"> {
  screen: Screen;
  mode: "baseline" | "variant";
  className?: string;
}

export function ScreenView({ screen, mode, width, className, ...rest }: ScreenViewProps) {
  const height = (screen.size.h / screen.size.w) * width;
  const variantSpec = mode === "variant" ? screen.variant?.spec : undefined;
  if (!variantSpec && screen.baseline?.image) {
    return <img src={screen.baseline.image} alt={`${screen.name} 기준`} className={cn("object-cover object-top", className)} style={{ width, height }} />;
  }
  const spec = variantSpec ?? screen.baseline?.spec;
  if (!spec) return <NoBaseline className={className} compact={width < 200} style={{ width, height }} />;
  return (
    <div className={className}>
      <SpecView spec={spec} width={width} size={screen.size} {...rest} />
    </div>
  );
}
