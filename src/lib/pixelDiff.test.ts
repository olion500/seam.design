import { describe, expect, it } from "vitest";
import { pixelDiff } from "./pixelDiff";

const image = (pixels: number[][]) => new Uint8ClampedArray(pixels.flat());

describe("pixelDiff", () => {
  it("finds no change between identical images and paints nothing in the change color", () => {
    const a = image([[10, 20, 30, 255], [200, 200, 200, 255]]);
    const out = new Uint8ClampedArray(a.length);
    expect(pixelDiff(a, a.slice(), out)).toBe(0);
    expect(out[0]).not.toBe(248);
  });

  it("counts only pixels that moved past the threshold and marks them", () => {
    const before = image([[0, 0, 0, 255], [100, 100, 100, 255], [50, 50, 50, 255], [0, 0, 0, 255]]);
    const after = image([[0, 0, 0, 255], [100, 180, 100, 255], [60, 50, 50, 255], [0, 0, 0, 255]]);
    const out = new Uint8ClampedArray(before.length);
    expect(pixelDiff(before, after, out)).toBe(0.25);
    expect([...out.slice(4, 8)]).toEqual([248, 82, 31, 255]);
    expect(out[8]).not.toBe(248);
  });
});
