export type DeviceId = "iphone" | "galaxy";

export interface Device {
  id: DeviceId;
  name: string;
  width: number;
  height: number;
  pixelRatio: number;
}

export const DEVICES: Record<DeviceId, Device> = {
  iphone: { id: "iphone", name: "iPhone 18 Pro", width: 402, height: 874, pixelRatio: 3 },
  galaxy: { id: "galaxy", name: "Galaxy S26", width: 360, height: 780, pixelRatio: 3 },
};

export const DEFAULT_DEVICE: DeviceId = "iphone";

export const deviceOf = (id: string | undefined): Device => DEVICES[id as DeviceId] ?? DEVICES[DEFAULT_DEVICE];

export const deviceSize = (id: string | undefined) => {
  const d = deviceOf(id);
  return { w: d.width, h: d.height };
};
