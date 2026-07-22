// One-off: clean the raw sticker PNGs for the hero.
//  1. Flood the background to transparent (already-transparent + an opaque
//     backdrop colour sampled from the corners).
//  2. From that background frontier, eat only a SHALLOW ring of near-black
//     die-cut outline (depth-limited + saturation-guarded) so it can't tunnel
//     into holographic / coloured fills or interior features (eyes, smile).
// Outputs sticker-01.png … in public/stickers.
//
//   node scripts/process-stickers.mjs
import sharp from "sharp";
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "public/stickers";
const WORK = 640; // processing resolution
const FINAL = 384; // exported size (renders ~50px, so plenty sharp)
const BG_TOL = 42; // opaque backdrop colour tolerance
const DARK_LUM = 60; // outline is near-black
const DARK_SAT = 0.32; // …and near-grey (protects saturated fills)
const MAX_DARK_DEPTH = 26; // how far the black ring may be eaten (px @ WORK)

const sources = readdirSync(DIR)
  .filter((f) => /^ChatGPT.*\.png$/i.test(f))
  .sort();

for (let idx = 0; idx < sources.length; idx += 1) {
  const { data, info } = await sharp(join(DIR, sources[idx]))
    .ensureAlpha()
    .resize({ width: WORK, height: WORK, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: W, height: H, channels: C } = info;

  // Sample an opaque backdrop colour from the border pixels (if any).
  let sr = 0;
  let sg = 0;
  let sb = 0;
  let sn = 0;
  const sampleBorder = (x, y) => {
    const i = (y * W + x) * C;
    if (data[i + 3] > 200) {
      sr += data[i];
      sg += data[i + 1];
      sb += data[i + 2];
      sn += 1;
    }
  };
  for (let x = 0; x < W; x += 1) {
    sampleBorder(x, 0);
    sampleBorder(x, H - 1);
  }
  for (let y = 0; y < H; y += 1) {
    sampleBorder(0, y);
    sampleBorder(W - 1, y);
  }
  const bgOpaque = sn > W; // a decent chunk of the border is opaque
  const br = bgOpaque ? sr / sn : 0;
  const bg = bgOpaque ? sg / sn : 0;
  const bb = bgOpaque ? sb / sn : 0;

  const lumAt = (i) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const satAt = (i) => {
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    return max === 0 ? 0 : (max - min) / max;
  };
  const isBg = (i) => {
    if (data[i + 3] < 25) return true;
    return (
      bgOpaque &&
      Math.abs(data[i] - br) < BG_TOL &&
      Math.abs(data[i + 1] - bg) < BG_TOL &&
      Math.abs(data[i + 2] - bb) < BG_TOL
    );
  };
  const isOutline = (i) => lumAt(i) < DARK_LUM && satAt(i) < DARK_SAT;

  // BFS carrying a "dark depth"; background resets it to 0, dark increments it.
  const visited = new Uint8Array(W * H);
  const queue = [];
  const depths = [];
  const consider = (x, y, depth) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (visited[p]) return;
    const i = p * C;
    if (isBg(i)) {
      visited[p] = 1;
      queue.push(p);
      depths.push(0);
    } else if (isOutline(i) && depth < MAX_DARK_DEPTH) {
      visited[p] = 1;
      queue.push(p);
      depths.push(depth + 1);
    }
  };
  for (let x = 0; x < W; x += 1) {
    consider(x, 0, 0);
    consider(x, H - 1, 0);
  }
  for (let y = 0; y < H; y += 1) {
    consider(0, y, 0);
    consider(W - 1, y, 0);
  }
  let head = 0;
  while (head < queue.length) {
    const p = queue[head];
    const depth = depths[head];
    head += 1;
    data[p * C + 3] = 0;
    const x = p % W;
    const y = (p / W) | 0;
    consider(x + 1, y, depth);
    consider(x - 1, y, depth);
    consider(x, y + 1, depth);
    consider(x, y - 1, depth);
  }

  const out = await sharp(data, { raw: { width: W, height: H, channels: C } })
    .png()
    .trim({ threshold: 12 })
    .resize({ width: FINAL, height: FINAL, fit: "inside" })
    .toBuffer();

  const name = `sticker-${String(idx + 1).padStart(2, "0")}.png`;
  writeFileSync(join(DIR, name), out);
  console.log("wrote", name, "bgOpaque:", bgOpaque);
}
