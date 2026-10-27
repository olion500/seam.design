import type { Device } from "../src/model/devices";
import type { CapturedElement } from "../src/model/types";
import { SeamError } from "./repo";

const EXTRACT = `(() => {
  const sel = 'button,a[href],input,textarea,select,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=radio],[role=slider],[role=heading],h1,h2,h3';
  const vw = innerWidth, vh = innerHeight;
  const seen = new Set();
  const out = [];
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) return null;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return null;
    return r;
  };
  // Skip controls covered by something else, e.g. the screen under a modal or a stacked screen.
  const onTop = (el, r) => {
    const x = Math.min(Math.max(r.x + r.width / 2, 0), vw - 1), y = Math.min(Math.max(r.y + r.height / 2, 0), vh - 1);
    const hit = document.elementFromPoint(x, y);
    return !!hit && (el.contains(hit) || hit.contains(el));
  };
  const push = (el, role) => {
    const r = visible(el);
    if (!r || !onTop(el, r)) return;
    const label = (el.getAttribute('aria-label') || el.innerText || el.value || el.getAttribute('placeholder') || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    if (!label) return;
    out.push({ role, label, box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } });
  };
  for (const el of document.querySelectorAll(sel)) {
    if ([...seen].some((s) => s.contains(el))) continue;
    seen.add(el);
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role') || ({ a: 'link', h1: 'heading', h2: 'heading', h3: 'heading' })[tag] || tag;
    push(el, role);
  }
  for (const el of document.querySelectorAll('[dir=auto]')) {
    if ([...seen].some((s) => s.contains(el))) continue;
    if ([...el.childNodes].some((n) => n.nodeType === 1)) continue;
    push(el, 'text');
  }
  return JSON.stringify(out);
})()`;

// Waits until the text and the position of every control stop changing, so screen transitions and modals have finished.
const SETTLE = `new Promise((resolve) => {
  let last = '', stable = 0, tries = 0;
  const tick = () => {
    const root = document.getElementById('root') || document.body;
    const boxes = [...root.querySelectorAll('button,[role=button],[role=dialog]')].slice(0, 80).map((el) => { const r = el.getBoundingClientRect(); return Math.round(r.x) + ',' + Math.round(r.y); }).join(';');
    const n = root.innerText.length + '|' + boxes;
    stable = root.innerText.length > 0 && n === last ? stable + 1 : 0;
    last = n;
    if (stable >= 3 || ++tries > 60) document.fonts.ready.then(() => resolve(n));
    else setTimeout(tick, 250);
  };
  tick();
})`;

export interface Shot {
  png: Uint8Array;
  elements: CapturedElement[];
  size: { w: number; h: number };
}

/** Finds a visible control by exact (then partial) accessible name or text, scrolls it into view and returns its center. */
const FIND = (name: string) => `(() => {
  const want = ${JSON.stringify(name)};
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const all = [...document.querySelectorAll('button,a[href],[role=button],[role=link],[role=tab],[role=radio],[role=checkbox],[role=switch]')];
  const shown = all.filter((el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'; });
  const names = (el) => [norm(el.getAttribute('aria-label')), norm(el.innerText)];
  const el = shown.find((e) => names(e).includes(want)) || shown.find((e) => names(e).some((n) => n.includes(want)));
  if (!el) return null;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
})()`;

export function withKeys(raw: Omit<CapturedElement, "key">[]): CapturedElement[] {
  const counts = new Map<string, number>();
  return raw.map((e) => {
    const base = `${e.role}:${e.label}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return { ...e, key: n === 1 ? base : `${base}#${n}` };
  });
}

export async function openDeviceView(width: number, height: number, pixelRatio = 2) {
  const chromePath = process.env.SEAM_CHROME_PATH;
  const view = new Bun.WebView({ width, height, backend: chromePath ? { type: "chrome", path: chromePath } : "chrome" });
  await view.navigate("about:blank");
  await view.cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: pixelRatio, mobile: true });
  await view.cdp("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await view.cdp("Emulation.setScrollbarsHidden", { hidden: true });
  return view;
}

export async function openBrowser(device: Device) {
  const view = await openDeviceView(device.width, device.height);
  return {
    /** Opens `url` with the app's saved data cleared, so each screen starts from the app's own first-run data, then taps `steps` in order. */
    async shoot(url: string, steps: { tap: string }[] = []): Promise<Shot> {
      await view.cdp("Storage.clearDataForOrigin", { origin: new URL(url).origin, storageTypes: "local_storage,indexeddb,session_storage" });
      await view.navigate(url);
      await view.evaluate(SETTLE);
      for (const step of steps) {
        const at = await view.evaluate(FIND(step.tap));
        if (!at) throw new SeamError(`${url}에서 '${step.tap}' 버튼을 찾지 못했습니다. seam.json의 screens.states 단계를 확인하세요`);
        const { x, y } = JSON.parse(String(at)) as { x: number; y: number };
        await view.cdp("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
        await view.cdp("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await view.evaluate(SETTLE);
      }
      const elements = withKeys(JSON.parse(String(await view.evaluate(EXTRACT))));
      const size = JSON.parse(String(await view.evaluate("JSON.stringify({ w: innerWidth, h: innerHeight })"))) as Shot["size"];
      const png = new Uint8Array(await (await view.screenshot()).arrayBuffer());
      return { png, elements, size };
    },
    close: () => view.close(),
  };
}
