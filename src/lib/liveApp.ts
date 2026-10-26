import { create } from "zustand";

type Status = "checking" | "up" | "down";

export const useLiveApp = create<Record<string, Status>>(() => ({}));

export async function checkLiveApp(url: string) {
  const origin = new URL(url, location.href).origin;
  useLiveApp.setState({ [origin]: "checking" });
  try {
    await fetch(origin, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
    useLiveApp.setState({ [origin]: "up" });
  } catch {
    useLiveApp.setState({ [origin]: "down" });
  }
}

export const liveStatus = (state: Record<string, Status>, url: string | undefined): Status | undefined =>
  url ? state[new URL(url, location.href).origin] : undefined;
