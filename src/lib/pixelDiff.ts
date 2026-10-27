const CHANGE_TOKEN_RGB = [248, 82, 31] as const;

/**
 * Compares two RGBA images of the same size and paints `out`: changed pixels in the change color,
 * the rest as a faded gray copy of `after` so the changes stand out. Returns the share of changed pixels (0..1).
 * A pixel counts as changed when any color channel moves by more than `threshold`, which ignores anti-aliasing noise.
 */
export function pixelDiff(before: Uint8ClampedArray, after: Uint8ClampedArray, out: Uint8ClampedArray, threshold = 40): number {
  let changed = 0;
  for (let i = 0; i < after.length; i += 4) {
    const moved = Math.max(Math.abs(before[i] - after[i]), Math.abs(before[i + 1] - after[i + 1]), Math.abs(before[i + 2] - after[i + 2]));
    if (moved > threshold) {
      changed++;
      out[i] = CHANGE_TOKEN_RGB[0];
      out[i + 1] = CHANGE_TOKEN_RGB[1];
      out[i + 2] = CHANGE_TOKEN_RGB[2];
    } else {
      const gray = 0.3 * after[i] + 0.59 * after[i + 1] + 0.11 * after[i + 2];
      const faded = 0.25 * gray + 0.75 * 255;
      out[i] = faded;
      out[i + 1] = faded;
      out[i + 2] = faded;
    }
    out[i + 3] = 255;
  }
  return after.length ? changed / (after.length / 4) : 0;
}
