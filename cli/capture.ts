import type { CapturedElement } from "../src/model/types";

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
  const push = (el, role) => {
    const r = visible(el);
    if (!r) return;
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

const SETTLE = `new Promise((resolve) => {
  let last = -1, stable = 0, tries = 0;
  const tick = () => {
    const n = (document.getElementById('root') || document.body).innerText.length;
    stable = n > 0 && n === last ? stable + 1 : 0;
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

export function withKeys(raw: Omit<CapturedElement, "key">[]): CapturedElement[] {
  const counts = new Map<string, number>();
  return raw.map((e) => {
    const base = `${e.role}:${e.label}`;
    const n = (counts.get(base) ?? 0) + 1;
    counts.set(base, n);
    return { ...e, key: n === 1 ? base : `${base}#${n}` };
  });
}

export async function openBrowser(viewport: { width: number; height: number }) {
  const chromePath = process.env.SEAM_CHROME_PATH;
  const view = new Bun.WebView({ ...viewport, backend: chromePath ? { type: "chrome", path: chromePath } : "chrome" });
  return {
    async shoot(url: string): Promise<Shot> {
      await view.navigate(url);
      await view.evaluate(SETTLE);
      const elements = withKeys(JSON.parse(String(await view.evaluate(EXTRACT))));
      const size = JSON.parse(String(await view.evaluate("JSON.stringify({ w: innerWidth, h: innerHeight })"))) as Shot["size"];
      const png = new Uint8Array(await (await view.screenshot()).arrayBuffer());
      return { png, elements, size };
    },
    close: () => view.close(),
  };
}
