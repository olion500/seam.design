import type { DeviceId } from "./devices";

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

/** A rectangle in screen (CSS px) coordinates of the baseline capture. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CapturedElement {
  key: string;
  role: string;
  label: string;
  box: Box;
}

export interface Baseline {
  spec?: ScreenSpec;
  image?: string;
  capturedAt?: string;
  url?: string;
  elements?: CapturedElement[];
  device?: DeviceId;
}

export interface ChangeRequest {
  id: string;
  elementKey?: string;
  /** A region drawn on the baseline screenshot, for requests not tied to one element. */
  area?: Box;
  label?: string;
  note: string;
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
  live?: { url: string };
  route?: string;
  /** Feature area set by hand; without it the area comes from the route (see `screenAreas`). */
  area?: string;
  requests?: ChangeRequest[];
  exitsOutside?: string[];
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A path laid out by auto-arrange, in canvas coordinates. `from` and `to` are where the two screens stood at the
 * time; once either screen moves the route no longer fits and the editor draws a plain curve instead.
 */
export interface TransitionRoute {
  points: Point[];
  /** Centre of the space the layout left for the line's label. */
  label?: Point;
  from: Point;
  to: Point;
}

export interface Transition {
  id: string;
  route?: TransitionRoute;
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
  source?: ProjectSource;
  device?: DeviceId;
}

export interface TokenSource {
  path: string;
  value: string;
  file: string;
  line: number;
}

export interface ProjectSource {
  tokens: Record<string, TokenSource>;
  transitions: string[];
}

/** One pending change in `.seam/changes/pending/change.json` (written by `seam changes`). */
export interface TokenChange {
  kind: "token";
  token: string;
  path: string;
  file: string;
  line: number;
  before: string;
  after: string;
}

export interface ElementChange {
  kind: "element";
  screen: string;
  screenName: string;
  route?: string;
  sources: string[];
  baselineImage?: string;
  element?: { key: string; role: string; label: string; box: Box };
  area?: Box;
  label?: string;
  note: string;
  requestId: string;
}

export interface TransitionChange {
  kind: "transition";
  change: "added" | "removed";
  from: string;
  to: string;
  label: string;
  trigger: string;
  condition: string;
}

export type Change = TokenChange | ElementChange | TransitionChange;

/** `.seam/changes/pending/verify.json`, written by `seam verify`. */
export interface VerifyResult {
  index: number;
  kind: Change["kind"];
  status: "pass" | "fail" | "review";
  detail: string;
}

export interface VerifyShot {
  id: string;
  url: string;
  /** Absolute path as written by the CLI. */
  image: string;
  elements: CapturedElement[];
  size: { w: number; h: number };
}

export interface VerifyReport {
  checkedAt: string;
  ok: boolean;
  results: VerifyResult[];
  after: VerifyShot[];
}

/** What the editor shows for review: verify shots carry `.seam`-relative image paths. */
export interface ReviewState {
  changes: Change[];
  verify: (Omit<VerifyReport, "after"> & { after: (VerifyShot & { file: string })[] }) | null;
}

/** The user's call on one change after looking at the result. */
export interface ReviewDecision {
  index: number;
  ok: boolean;
  note?: string;
}

/** Review outcome handed to the agent through `seam wait`. */
export interface AgentReview {
  approved: boolean;
  /** Archive folder when the editor finished the round (`seam done`). */
  archived?: string;
  /** Changes sent back, each with the user's note. */
  rejected?: (ReviewDecision & { change?: Change })[];
}

/** Hand-off between the editor (server) and `seam wait` (CLI), relative to `.seam/`. */
export const SENT_FILE = "changes/sent.json";
export const WAITING_FILE = "changes/waiting.json";

/** `.seam/changes/sent.json`: the user pressed send; messages pile up until an agent picks them up. */
export interface SentToAgent {
  messages: { at: string; text: string }[];
  review?: AgentReview;
}

/** `.seam/changes/waiting.json`: a `seam wait` process is listening. */
export interface AgentWaiting {
  pid: number;
  since: string;
}

export type View = "flow" | "system" | "rules" | "motion";

export type Selection =
  | { kind: "screen"; id: string }
  | { kind: "transition"; id: string }
  | { kind: "token"; id: string }
  | { kind: "motion"; id: string }
  | { kind: "rule"; id: string };
