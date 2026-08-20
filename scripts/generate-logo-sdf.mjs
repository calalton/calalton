// Reproducible hero-mask pipeline:
//   node scripts/generate-logo-sdf.mjs
// Converts the white-on-black source logo into a signed-distance texture for
// smooth circle-to-letter morphing in the hero shader.
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const input = resolve(root, "public/calaltonlogo.png");
const output = resolve(root, "public/media/calalton-logo-sdf.png");
const metadataOutput = resolve(
  root,
  "src/features/home/components/HeroGlass2D/logo-sdf-metadata.ts",
);

const SOURCE_CROP = {
  left: 338,
  top: 125,
  width: 812,
  height: 838,
};
const OUTPUT_WIDTH = 1024;
// Small spread keeps the encoded field a near-sharp edge (like Podium's shape
// texture) so the hero's smoothstep(-1,1) fade stays subtle instead of a heavy
// blur, while still leaving enough gradient for the ball->letters morph.
const SDF_SPREAD = 20;
// Compute the field at this multiple of the output grid, then average down, so
// the baked contour is sub-pixel smooth instead of locked to the output pixels.
const SUPERSAMPLE = 4;

const {
  data: grayscale,
  info: { width, height },
} = await sharp(input)
  .extract(SOURCE_CROP)
  .resize({ width: OUTPUT_WIDTH * SUPERSAMPLE, kernel: sharp.kernel.lanczos3 })
  .grayscale()
  .raw()
  .toBuffer({ resolveWithObject: true });

const pixelCount = width * height;
const far = width * width + height * height;

function distanceTransform(features) {
  const firstPass = new Float64Array(pixelCount);
  const result = new Float64Array(pixelCount);
  const maxLength = Math.max(width, height);
  const source = new Float64Array(maxLength);
  const transformed = new Float64Array(maxLength);
  const locations = new Int32Array(maxLength);
  const boundaries = new Float64Array(maxLength + 1);

  const transformLine = (length) => {
    let envelopeIndex = 0;
    locations[0] = 0;
    boundaries[0] = -Infinity;
    boundaries[1] = Infinity;

    for (let position = 1; position < length; position += 1) {
      let intersection =
        (source[position] +
          position * position -
          (source[locations[envelopeIndex]] +
            locations[envelopeIndex] * locations[envelopeIndex])) /
        (2 * position - 2 * locations[envelopeIndex]);

      while (intersection <= boundaries[envelopeIndex]) {
        envelopeIndex -= 1;
        intersection =
          (source[position] +
            position * position -
            (source[locations[envelopeIndex]] +
              locations[envelopeIndex] * locations[envelopeIndex])) /
          (2 * position - 2 * locations[envelopeIndex]);
      }

      envelopeIndex += 1;
      locations[envelopeIndex] = position;
      boundaries[envelopeIndex] = intersection;
      boundaries[envelopeIndex + 1] = Infinity;
    }

    envelopeIndex = 0;
    for (let position = 0; position < length; position += 1) {
      while (boundaries[envelopeIndex + 1] < position) {
        envelopeIndex += 1;
      }
      const delta = position - locations[envelopeIndex];
      transformed[position] = delta * delta + source[locations[envelopeIndex]];
    }
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      source[x] = features[y * width + x] ? 0 : far;
    }
    transformLine(width);
    for (let x = 0; x < width; x += 1) {
      firstPass[y * width + x] = transformed[x];
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      source[y] = firstPass[y * width + x];
    }
    transformLine(height);
    for (let y = 0; y < height; y += 1) {
      result[y * width + x] = transformed[y];
    }
  }

  return result;
}

const inside = new Uint8Array(pixelCount);
const outside = new Uint8Array(pixelCount);
for (let index = 0; index < pixelCount; index += 1) {
  const isInside = grayscale[index] >= 128;
  inside[index] = isInside ? 1 : 0;
  outside[index] = isInside ? 0 : 1;
}

const distanceToInside = distanceTransform(inside);
const distanceToOutside = distanceTransform(outside);

// Average each SUPERSAMPLE x SUPERSAMPLE block of signed distances (in hi-res
// pixels) and rescale to output-pixel units for a smooth, compact field.
const outWidth = Math.round(width / SUPERSAMPLE);
const outHeight = Math.round(height / SUPERSAMPLE);
const encoded = Buffer.allocUnsafe(outWidth * outHeight);

for (let oy = 0; oy < outHeight; oy += 1) {
  for (let ox = 0; ox < outWidth; ox += 1) {
    let sum = 0;
    let count = 0;
    for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
      const hy = oy * SUPERSAMPLE + sy;
      if (hy >= height) continue;
      for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
        const hx = ox * SUPERSAMPLE + sx;
        if (hx >= width) continue;
        const index = hy * width + hx;
        sum += inside[index]
          ? Math.sqrt(distanceToOutside[index])
          : -Math.sqrt(distanceToInside[index]);
        count += 1;
      }
    }
    const signedDistance = sum / count / SUPERSAMPLE;
    const normalized = Math.max(
      0,
      Math.min(1, 0.5 + signedDistance / (SDF_SPREAD * 2)),
    );
    encoded[oy * outWidth + ox] = Math.round(normalized * 255);
  }
}

await sharp(encoded, {
  raw: { width: outWidth, height: outHeight, channels: 1 },
})
  .png({ compressionLevel: 9, palette: false })
  .toFile(output);

await writeFile(
  metadataOutput,
  `// AUTO-GENERATED by scripts/generate-logo-sdf.mjs. Do not edit by hand.\n` +
    `export const LOGO_SDF_WIDTH = ${outWidth} as const;\n` +
    `export const LOGO_SDF_HEIGHT = ${outHeight} as const;\n` +
    `export const LOGO_SDF_SPREAD = ${SDF_SPREAD} as const;\n`,
  "utf8",
);

console.log(
  `generated ${outWidth}x${outHeight} signed-distance mask -> ${output} and metadata`,
);
