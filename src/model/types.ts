export type TokenKind = "color" | "radius" | "space" | "type";

export interface Token {
  name: string;
  kind: TokenKind;
  value: string;
  description?: string;
}

export type ElementKind = "title" | "text" | "field" | "listItem" | "button" | "spacer" | "illustration";

export type ButtonVariant = "primary" | "filled" | "ghost" | "accent";

/** Color props hold a token name, or a raw hex value (which the token rule flags). */
export interface ScreenElement {
  id: string;
  kind: ElementKind;
  name: string;
  label?: string;
  variant?: ButtonVariant;
  fill?: string;
  stroke?: string;
  height?: number;
  size?: number;
}

export interface ScreenSpec {
  align: "stretch" | "center";
  gap: string;
  elements: ScreenElement[];
}

export interface Baseline {
  spec?: ScreenSpec;
  image?: string;
  capturedAt?: string;
}

export interface Variant {
  version: number;
  updatedAt: string;
  spec: ScreenSpec;
}

export interface SourceMapping {
  path: string;
  note: string;
}

export interface Screen {
  id: string;
  name: string;
  position: { x: number; y: number };
  size: { w: number; h: number };
  baseline: Baseline | null;
  variant: Variant | null;
  states: string[];
  sources: SourceMapping[];
  terminal?: boolean;
}

export interface Transition {
  id: string;
  from: string;
  to: string;
  label: string;
  sourceElementId?: string;
  trigger: string;
  condition: string;
  conditional: boolean;
  motionId: string;
}

export type MotionKind = "push" | "fade" | "zoom" | "none";
export type Direction = "left" | "right" | "up" | "down";
export type EasingName = "standard-decel" | "standard" | "emphasized" | "linear";

export interface MotionPreset {
  id: string;
  name: string;
  kind: MotionKind;
  durationMs: number;
  easing: EasingName;
  direction: Direction;
  reduced: { kind: "fade" | "none"; durationMs: number } | null;
}

export type RuleCheck = "single-primary" | "touch-target" | "no-dead-end" | "token-colors" | "reduced-motion";

export interface Rule {
  id: string;
  check: RuleCheck;
  category: string;
  title: string;
  description: string;
  enabled: boolean;
  params?: { minSize?: number };
}

export interface Asset {
  name: string;
  kind: "아이콘" | "일러스트" | "로고";
  screenIds: string[];
}

export interface Project {
  id: string;
  name: string;
  screens: Screen[];
  transitions: Transition[];
  tokens: Token[];
  motions: MotionPreset[];
  rules: Rule[];
  assets: Asset[];
}

export type View = "flow" | "system" | "rules" | "motion";

export type Selection =
  | { kind: "screen"; id: string }
  | { kind: "transition"; id: string }
  | { kind: "token"; id: string }
  | { kind: "motion"; id: string }
  | { kind: "rule"; id: string };
