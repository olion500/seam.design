import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatusBadge({ variant, children, className }: { variant: boolean; children?: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-xs font-bold text-black",
        variant ? "bg-brand" : "bg-chip",
        className,
      )}
    >
      {children ?? (variant ? "시안" : "기준")}
    </span>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3 border-b px-6 py-5 last:border-b-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-bold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="text-sm font-bold tracking-wider text-muted-foreground">{children}</span>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[88px_1fr] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function WarnIcon({ title, className }: { title: string; className?: string }) {
  return (
    <span
      title={title}
      className={cn("flex size-6 items-center justify-center rounded-full bg-warn shadow-[0_0_0_2px_#fff]", className)}
    >
      <AlertTriangle className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">{title}</span>
    </span>
  );
}

export const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
