import { openDeviceView } from "../cli/capture";
import { DEVICES } from "../src/model/devices";

export interface CaptureRequest {
  url: string;
  width: number;
  height: number;
}

export type Capture = (req: CaptureRequest) => Promise<string>;

export class CaptureError extends Error {}

export function parseCaptureRequest(body: unknown): CaptureRequest {
  const { url, width = DEVICES.iphone.width, height = DEVICES.iphone.height } = (body ?? {}) as Partial<CaptureRequest>;
  let parsed: URL;
  try {
    parsed = new URL(String(url));
  } catch {
    throw new CaptureError("올바른 URL이 아닙니다");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new CaptureError("http 또는 https URL만 캡처할 수 있습니다");
  const size = (n: unknown) => (Number.isInteger(n) && (n as number) >= 200 && (n as number) <= 2400 ? (n as number) : null);
  const w = size(width);
  const h = size(height);
  if (!w || !h) throw new CaptureError("크기는 200~2400px 정수여야 합니다");
  return { url: parsed.href, width: w, height: h };
}

export const captureWithChrome: Capture = async ({ url, width, height }) => {
  const view = await openDeviceView(width, height);
  try {
    await view.navigate(url);
    await view.evaluate("document.fonts.ready.then(() => true)");
    const png = await view.screenshot();
    return `data:image/png;base64,${Buffer.from(await png.arrayBuffer()).toString("base64")}`;
  } finally {
    view.close();
  }
};
