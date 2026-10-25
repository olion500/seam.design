import { create } from "zustand";

const OPEN_DELAY = 350;
const CLOSE_DELAY = 160;

interface PreviewState {
  id: string | null;
}

export const usePreview = create<PreviewState>(() => ({ id: null }));

let timer: ReturnType<typeof setTimeout> | undefined;

export function hoverNode(id: string) {
  clearTimeout(timer);
  if (usePreview.getState().id === id) return;
  const delay = usePreview.getState().id ? 0 : OPEN_DELAY;
  timer = setTimeout(() => usePreview.setState({ id }), delay);
}

export function keepPreview() {
  clearTimeout(timer);
}

export function leaveNode() {
  clearTimeout(timer);
  timer = setTimeout(() => usePreview.setState({ id: null }), CLOSE_DELAY);
}

export function closePreview() {
  clearTimeout(timer);
  usePreview.setState({ id: null });
}
