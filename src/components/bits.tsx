import type { KeyboardEvent, ReactNode } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Hover/focus tooltip for icon buttons and short chips; the longer explanation lives here instead of on screen. */
export function Tip({ label, children, side }: { label: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-64 text-center leading-relaxed">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

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

const propLabel = "text-xs font-medium text-muted-foreground";

/** Input that reads as plain text until hovered or focused, so the panel looks read-only but edits in place. */
export const quietInput =
  "-mx-2 w-[calc(100%+1rem)] border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-ring focus-visible:bg-white";

/** Enter finishes an in-place edit: leave the field so blur handlers apply it. Ignored while an IME (Korean) is composing. */
export function blurOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter" && !e.nativeEvent.isComposing) e.currentTarget.blur();
}

/** "+" for a section header: opens that section's add form. */
export function AddButton({ label, open, onClick }: { label: string; open: boolean; onClick: () => void }) {
  return (
    <Tip label={label}>
      <Button
        variant={open ? "secondary" : "ghost"}
        size="icon"
        aria-label={label}
        aria-expanded={open}
        className="-my-1 size-8"
        onClick={onClick}
      >
        <Plus className={open ? "rotate-45 transition-transform" : "transition-transform"} />
      </Button>
    </Tip>
  );
}

/** An editable property: small name on top, the control below at full width. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className={propLabel}>{label}</span>
      {children}
    </label>
  );
}

/** A read-only property in the same stacked shape as `Field`. */
export function Prop({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className={propLabel}>{label}</span>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** A yes/no property: checkbox and its name on one line. */
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-4 accent-black" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
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
