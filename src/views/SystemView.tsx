import { Image, Shapes, Type } from "lucide-react";
import { displaySpec } from "@/model/diff";
import { tokenVars, tokensInSpec } from "@/model/tokens";
import type { ButtonVariant, TokenKind } from "@/model/types";
import { useEditor } from "@/store/store";
import { cn } from "@/lib/utils";

const KIND: Record<TokenKind, string> = { color: "색", radius: "모서리", space: "간격", type: "글자" };
const VARIANTS: { variant: ButtonVariant; title: string; label: string }[] = [
  { variant: "primary", title: "Primary", label: "결제하기" },
  { variant: "filled", title: "Filled", label: "취소" },
  { variant: "ghost", title: "Ghost", label: "다른 수단" },
  { variant: "accent", title: "Accent · 시안", label: "결제하기" },
];

export function SystemView() {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const select = useEditor.getState().select;
  const usage = (name: string) =>
    project.screens.filter((s) => {
      const spec = displaySpec(s);
      return spec && tokensInSpec(spec).includes(name);
    }).length;
  const usedVariants = new Set(project.screens.flatMap((s) => (displaySpec(s)?.elements ?? []).map((e) => e.variant)));

  return (
    <main aria-label="디자인 시스템" className="flex min-w-0 flex-1 flex-col gap-10 overflow-y-auto bg-muted px-10 pt-8 pb-12">
      <nav aria-label="구역" className="flex flex-wrap gap-2">
        {[
          ["#tokens", `토큰 ${project.tokens.length}`],
          ["#components", `컴포넌트 ${VARIANTS.length}`],
          ["#assets", `에셋 ${project.assets.length}`],
        ].map(([href, label], i) => (
          <a
            key={href}
            href={href}
            className={cn("inline-flex h-9 items-center rounded-full px-3.5 text-sm font-[550]", i === 0 ? "bg-black text-white" : "bg-white")}
          >
            {label}
          </a>
        ))}
      </nav>

      <section id="tokens" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-extrabold">토큰</h2>
          <span className="text-sm text-muted-foreground">값을 바꾸면 그 토큰을 쓰는 시안이 바로 갱신됩니다</span>
        </div>
        <div className="overflow-x-auto bg-white">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="border-b px-4 py-3 font-[550]">이름</th>
                <th scope="col" className="border-b px-4 py-3 font-[550]">값</th>
                <th scope="col" className="border-b px-4 py-3 font-[550]">종류</th>
                <th scope="col" className="border-b px-4 py-3 text-right font-[550]">쓰는 화면</th>
              </tr>
            </thead>
            <tbody>
              {project.tokens.map((t) => {
                const active = selection?.kind === "token" && selection.id === t.name;
                return (
                  <tr
                    key={t.name}
                    tabIndex={0}
                    aria-selected={active}
                    onClick={() => select({ kind: "token", id: t.name })}
                    onKeyDown={(e) => e.key === "Enter" && select({ kind: "token", id: t.name })}
                    className={cn("cursor-pointer hover:bg-muted/50", active && "bg-brand/8 shadow-[inset_2px_0_0_var(--brand)]")}
                  >
                    <td className="border-b px-4 py-3">
                      <code className={cn("font-mono text-[13px]", active && "font-bold")}>{t.name}</code>
                    </td>
                    <td className="border-b px-4 py-3">
                      <span className="inline-flex items-center gap-2">
                        {t.kind === "color" && <span aria-hidden className="size-5 rounded border" style={{ background: t.value }} />}
                        {t.value}
                      </span>
                    </td>
                    <td className="border-b px-4 py-3">{KIND[t.kind]}</td>
                    <td className={cn("border-b px-4 py-3 text-right", active && "font-bold")}>{usage(t.name)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="components" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-2xl font-extrabold">컴포넌트 변형</h2>
          <span className="text-sm text-muted-foreground">Button · 변형 4 × 상태 3</span>
        </div>
        <div className="grid grid-cols-4 gap-4 overflow-x-auto max-xl:grid-cols-2" style={tokenVars(project.tokens)}>
          {VARIANTS.map((v) => (
            <div
              key={v.variant}
              className={cn("flex min-w-[140px] flex-col gap-3 bg-white px-4 py-5", v.variant === "accent" && "bg-brand/8 shadow-[inset_0_0_0_2px_var(--brand)]")}
            >
              <span className="flex items-center justify-between text-[13px] font-bold">
                {v.title}
                {!usedVariants.has(v.variant) && <span className="font-normal text-muted-foreground">미사용</span>}
              </span>
              {(["기본", "hover", "비활성"] as const).map((state) => (
                <span key={state} className={cn("flex", state === "hover" && "-translate-y-0.5", state === "비활성" && "opacity-40")}>
                  <DemoButton variant={v.variant}>{state === "기본" ? v.label : state}</DemoButton>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section id="assets" className="flex flex-col gap-4">
        <h2 className="text-2xl font-extrabold">에셋</h2>
        <ul className="grid grid-cols-4 gap-3 max-xl:grid-cols-2">
          {project.assets.map((a) => (
            <li key={a.name} className="flex min-w-0 items-center gap-3 rounded-xl bg-white p-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                {a.kind === "아이콘" ? <Shapes className="size-5" /> : a.kind === "로고" ? <Type className="size-5" /> : <Image className="size-5" />}
              </span>
              <span className="flex min-w-0 flex-col text-[13px]">
                <b className="truncate">{a.name}</b>
                <span className="text-muted-foreground">
                  {a.kind} · {a.screenIds.length}화면
                </span>
              </span>
            </li>
          ))}
          {project.assets.length === 0 && <li className="text-sm text-muted-foreground">에셋이 없습니다</li>}
        </ul>
      </section>
    </main>
  );
}

function DemoButton({ variant, children }: { variant: ButtonVariant; children: React.ReactNode }) {
  const style: React.CSSProperties = {
    height: 40,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--tk-radius-xs)",
    fontSize: "var(--tk-button-size)",
    fontWeight: "var(--tk-button-weight)" as React.CSSProperties["fontWeight"],
    ...(variant === "primary" && { background: "var(--tk-primary)", color: "#fff" }),
    ...(variant === "filled" && { background: "var(--tk-filled)" }),
    ...(variant === "ghost" && { border: "1px solid var(--tk-primary)" }),
    ...(variant === "accent" && { background: "var(--tk-accent)", color: "#000" }),
  };
  return <span style={style}>{children}</span>;
}
