import type { Project, Screen, ScreenElement, ScreenSpec } from "./types";

const SIZE = { w: 390, h: 844 };

const spec = (elements: ScreenElement[], gap = "space-sm", align: ScreenSpec["align"] = "stretch"): ScreenSpec => ({
  align,
  gap,
  elements,
});

const clone = <T,>(v: T): T => structuredClone(v);

const cartBase = spec([
  { id: "title", kind: "title", name: "제목", label: "장바구니" },
  { id: "item1", kind: "listItem", name: "상품 1", label: "무선 이어폰 · 89,000원", fill: "paper" },
  { id: "item2", kind: "listItem", name: "상품 2", label: "충전 케이스 · 19,000원", fill: "paper" },
  { id: "sp", kind: "spacer", name: "여백" },
  { id: "cta", kind: "button", name: "주요 버튼", label: "주문하기", variant: "primary", height: 56 },
]);

const shippingBase = spec([
  { id: "title", kind: "title", name: "제목", label: "배송 정보" },
  { id: "name", kind: "field", name: "받는 분", label: "받는 분", fill: "paper", stroke: "hairline" },
  { id: "addr", kind: "field", name: "주소", label: "주소", fill: "paper", stroke: "hairline" },
  { id: "phone", kind: "field", name: "연락처", label: "연락처", fill: "paper", stroke: "hairline" },
  { id: "coupon", kind: "text", name: "쿠폰 링크", label: "쿠폰 적용하기" },
  { id: "sp", kind: "spacer", name: "여백" },
  { id: "cta", kind: "button", name: "주요 버튼", label: "다음", variant: "primary", height: 56 },
]);
const shippingVariant = clone(shippingBase);
shippingVariant.elements[6] = { ...shippingVariant.elements[6], variant: "accent" };

const paymentBase = spec([
  { id: "title", kind: "title", name: "제목", label: "결제 수단" },
  { id: "card", kind: "listItem", name: "결제 수단 목록", label: "신용카드", fill: "paper" },
  { id: "bank", kind: "listItem", name: "계좌이체", label: "계좌이체", fill: "paper" },
  { id: "pay", kind: "listItem", name: "간편결제", label: "간편결제", fill: "paper" },
  { id: "sp", kind: "spacer", name: "여백" },
  { id: "cta", kind: "button", name: "주요 버튼", label: "다음", variant: "primary", height: 56 },
]);
const paymentVariant = clone(paymentBase);
paymentVariant.gap = "space-md";
paymentVariant.elements[1] = { ...paymentVariant.elements[1], stroke: "accent" };
paymentVariant.elements[5] = { ...paymentVariant.elements[5], variant: "accent", label: "결제하기" };

const doneBase = spec(
  [
    { id: "icon", kind: "illustration", name: "완료 아이콘", fill: "hairline", size: 96 },
    { id: "title", kind: "title", name: "제목", label: "주문이 완료됐어요" },
    { id: "desc", kind: "text", name: "안내", label: "주문 번호 20261012-0042" },
    { id: "sp", kind: "spacer", name: "여백" },
    { id: "cta", kind: "button", name: "주요 버튼", label: "확인", variant: "primary", height: 56 },
  ],
  "space-sm",
  "center",
);

const loginBase = spec([
  { id: "title", kind: "title", name: "제목", label: "로그인" },
  { id: "email", kind: "field", name: "이메일", label: "이메일", fill: "paper", stroke: "hairline" },
  { id: "pw", kind: "field", name: "비밀번호", label: "비밀번호", fill: "paper", stroke: "hairline" },
  { id: "sp", kind: "spacer", name: "여백" },
  { id: "cta", kind: "button", name: "주요 버튼", label: "로그인", variant: "primary", height: 56 },
]);

const failBase = spec(
  [
    { id: "icon", kind: "illustration", name: "오류 아이콘", stroke: "primary", size: 96 },
    { id: "title", kind: "title", name: "제목", label: "결제에 실패했어요" },
    { id: "sp", kind: "spacer", name: "여백" },
    { id: "retry", kind: "button", name: "다시 시도", label: "다시 시도", variant: "primary", height: 56 },
    { id: "other", kind: "button", name: "다른 수단", label: "다른 수단", variant: "ghost", height: 56 },
  ],
  "space-sm",
  "center",
);
const failVariant = clone(failBase);
failVariant.elements[3] = { ...failVariant.elements[3], variant: "accent" };
failVariant.elements[4] = { ...failVariant.elements[4], height: 40 };

const screen = (s: Omit<Screen, "size" | "states" | "sources"> & Partial<Screen>): Screen => ({
  size: SIZE,
  states: ["기본"],
  sources: [],
  ...s,
});

const base = (sp: ScreenSpec) => ({ spec: sp, capturedAt: "10월 12일 스크린샷" });

export function seedProject(): Project {
  return {
    id: crypto.randomUUID().slice(0, 8),
    name: "결제 흐름 개편",
    screens: [
      screen({
        id: "cart",
        name: "장바구니",
        position: { x: 0, y: 0 },
        baseline: base(cartBase),
        variant: null,
        sources: [{ path: "src/screens/Cart.tsx", note: "화면 전체" }],
      }),
      screen({
        id: "shipping",
        name: "배송 정보",
        position: { x: 240, y: 0 },
        baseline: base(shippingBase),
        variant: { version: 2, updatedAt: "10월 17일", spec: shippingVariant },
        sources: [{ path: "src/screens/Shipping.tsx", note: "화면 전체" }],
      }),
      screen({
        id: "payment",
        name: "결제 수단",
        position: { x: 480, y: 0 },
        baseline: base(paymentBase),
        variant: { version: 3, updatedAt: "10월 18일", spec: paymentVariant },
        states: ["기본", "로딩", "오류"],
        sources: [
          { path: "src/screens/Payment.tsx", note: "화면 전체" },
          { path: "src/components/PayMethodList.tsx", note: "결제 수단 목록" },
        ],
      }),
      screen({
        id: "done",
        name: "주문 완료",
        position: { x: 720, y: 0 },
        baseline: base(doneBase),
        variant: null,
        terminal: true,
        sources: [{ path: "src/screens/OrderDone.tsx", note: "화면 전체" }],
      }),
      screen({
        id: "login",
        name: "로그인",
        position: { x: 0, y: 420 },
        baseline: base(loginBase),
        variant: null,
        sources: [{ path: "src/screens/Login.tsx", note: "화면 전체" }],
      }),
      screen({
        id: "coupon",
        name: "쿠폰 적용",
        position: { x: 240, y: 420 },
        baseline: null,
        variant: null,
      }),
      screen({
        id: "fail",
        name: "결제 실패",
        position: { x: 480, y: 420 },
        baseline: base(failBase),
        variant: { version: 1, updatedAt: "10월 18일", spec: failVariant },
        sources: [{ path: "src/screens/PaymentFailed.tsx", note: "화면 전체" }],
      }),
    ],
    transitions: [
      { id: "t1", from: "cart", to: "shipping", label: "주문", sourceElementId: "cta", trigger: "“주문하기” 버튼 탭", condition: "로그인 상태", conditional: false, motionId: "push" },
      { id: "t2", from: "shipping", to: "payment", label: "다음", sourceElementId: "cta", trigger: "“다음” 버튼 탭", condition: "필수 입력 완료", conditional: false, motionId: "push" },
      { id: "t3", from: "payment", to: "done", label: "결제 성공", sourceElementId: "cta", trigger: "“결제하기” 버튼 탭", condition: "결제 승인 응답 성공", conditional: false, motionId: "push" },
      { id: "t4", from: "cart", to: "login", label: "비로그인", sourceElementId: "cta", trigger: "“주문하기” 버튼 탭", condition: "로그인 안 됨", conditional: true, motionId: "zoom" },
      { id: "t5", from: "shipping", to: "coupon", label: "쿠폰", sourceElementId: "coupon", trigger: "“쿠폰 적용하기” 탭", condition: "", conditional: false, motionId: "fade" },
      { id: "t6", from: "payment", to: "fail", label: "결제 오류", sourceElementId: "cta", trigger: "“결제하기” 버튼 탭", condition: "결제 승인 응답 실패", conditional: true, motionId: "fade" },
      { id: "t7", from: "coupon", to: "shipping", label: "적용", trigger: "“적용” 버튼 탭", condition: "", conditional: false, motionId: "fade" },
      { id: "t8", from: "fail", to: "payment", label: "다시 시도", sourceElementId: "retry", trigger: "“다시 시도” 버튼 탭", condition: "", conditional: false, motionId: "push" },
    ],
    tokens: [
      { name: "primary", kind: "color", value: "#000000", description: "본문 글자와 기준 주요 버튼" },
      { name: "surface", kind: "color", value: "#F5F5F7", description: "화면 배경" },
      { name: "paper", kind: "color", value: "#FFFFFF", description: "카드와 입력 칸 배경" },
      { name: "accent", kind: "color", value: "#0085E4", description: "링크, 선택 표시, 시안의 주요 버튼" },
      { name: "hairline", kind: "color", value: "#DADCE0", description: "테두리와 구분선" },
      { name: "filled", kind: "color", value: "#F0F0F2", description: "보조 버튼 배경" },
      { name: "radius-xs", kind: "radius", value: "8px", description: "버튼, 입력 칸, 카드 모서리" },
      { name: "space-sm", kind: "space", value: "16px", description: "목록 기본 간격" },
      { name: "space-md", kind: "space", value: "20px", description: "넓은 목록 간격" },
      { name: "button", kind: "type", value: "15 / 550", description: "버튼 글자" },
    ],
    motions: [
      { id: "push", name: "밀어내기", kind: "push", durationMs: 280, easing: "standard-decel", direction: "left", reduced: { kind: "fade", durationMs: 120 } },
      { id: "fade", name: "페이드", kind: "fade", durationMs: 200, easing: "standard", direction: "left", reduced: null },
      { id: "zoom", name: "확대", kind: "zoom", durationMs: 240, easing: "emphasized", direction: "left", reduced: { kind: "fade", durationMs: 120 } },
      { id: "none", name: "즉시", kind: "none", durationMs: 0, easing: "linear", direction: "left", reduced: null },
    ],
    rules: [
      { id: "r1", check: "single-primary", category: "레이아웃", title: "주요 버튼은 화면당 하나", description: "Primary·Accent 변형은 한 화면에 한 번만 쓴다.", enabled: true },
      { id: "r2", check: "touch-target", category: "접근성", title: "터치 영역 48px 이상", description: "누를 수 있는 요소는 가로·세로 48px 이상.", enabled: true, params: { minSize: 48 } },
      { id: "r3", check: "no-dead-end", category: "흐름", title: "모든 화면에 나가는 전이", description: "마지막 화면을 빼고 막다른 화면이 없어야 한다.", enabled: true },
      { id: "r4", check: "token-colors", category: "토큰", title: "색은 토큰으로만", description: "시안의 모든 색이 디자인 시스템 토큰에 매핑된다.", enabled: true },
      { id: "r5", check: "reduced-motion", category: "모션", title: "모션 줄이기 대체 동작", description: "이동이 있는 전환은 모두 대체 동작을 가진다.", enabled: true },
    ],
    assets: [
      { name: "icon-card.svg", kind: "아이콘", screenIds: ["payment", "shipping", "fail"] },
      { name: "icon-check.svg", kind: "아이콘", screenIds: ["done", "payment"] },
      { name: "empty-cart.png", kind: "일러스트", screenIds: ["cart"] },
      { name: "logo-wordmark.svg", kind: "로고", screenIds: ["cart", "shipping", "payment", "done", "login", "coupon", "fail"] },
    ],
  };
}

export function emptyProject(): Project {
  const p = seedProject();
  return { ...p, id: crypto.randomUUID().slice(0, 8), name: "새 프로젝트", screens: [], transitions: [], assets: [] };
}

export function defaultSpec(name: string): ScreenSpec {
  return spec([
    { id: "title", kind: "title", name: "제목", label: name },
    { id: "body", kind: "text", name: "본문", label: "내용을 입력하세요" },
    { id: "sp", kind: "spacer", name: "여백" },
    { id: "cta", kind: "button", name: "주요 버튼", label: "다음", variant: "primary", height: 56 },
  ]);
}
