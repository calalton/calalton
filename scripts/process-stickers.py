# Clean the raw sticker PNGs for the hero using ML background removal.
#
# ChatGPT bakes its "transparency" checkerboard into the PNG as real grey
# pixels, so a colour flood-fill can't tell the background from the light
# fills inside the artwork and tunnels into it. rembg (U^2-Net salient-object
# segmentation) understands the *subject* instead of the colour, so it lifts
# the whole sticker cleanly, holographic fills and interior features intact.
#
#   python3 -m venv .venv-rembg
#   source .venv-rembg/bin/activate
#   pip install "rembg" onnxruntime pillow numpy
#   python scripts/process-stickers.py
import io
import os
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove
from scipy import ndimage

RAW_DIR = Path("public/stickers/_raw")
OUT_DIR = Path("public/stickers")
FINAL = 384          # exported size
ALPHA_CUTOFF = 12    # alpha below this is treated as fully transparent for trim

# isnet-general-use gives cleaner edges than the default u2net for line-art.
session = new_session("isnet-general-use")


def solid_mask(raw: bytes) -> Image.Image:
    """Return a clean binary alpha for the whole sticker.

    rembg reliably finds the coloured artwork + dark outline but treats
    enclosed light regions (the pen-nib holographic fill, the mushroom cap,
    smiley eyes) as background, punching holes. We therefore take the raw
    mask, fill every interior hole so those regions become solid, keep only
    the largest blob (drops stray specks), and dilate a touch to recover the
    near-white die-cut border that colour-matches the background.

    Real die-cut holes (e.g. the pen-nib centre) are then re-opened: a filled
    hole is punched back out only when it is small AND its original colour
    matches the background — so genuine holes go transparent while black
    features (eyes) and the large holographic fill stay solid.
    """
    m = remove(raw, session=session, only_mask=True, post_process_mask=False)
    mask = np.array(Image.open(io.BytesIO(m)).convert("L"))
    rgb = np.array(Image.open(io.BytesIO(raw)).convert("RGB").resize(
        (mask.shape[1], mask.shape[0]), Image.LANCZOS
    ))
    binary = mask > 30

    filled = ndimage.binary_fill_holes(binary)

    # Identify genuine die-cut holes to punch back out. A true hole (the
    # pen-nib centre) is small, background-coloured, AND ringed by the dark
    # die-cut outline — unlike white specular glints, which sit small and
    # background-coloured but are surrounded by coloured/light fill.
    reopen = np.zeros_like(binary)
    holes = filled & ~binary
    if holes.any():
        k = 8
        corners = np.concatenate([
            rgb[:k, :k].reshape(-1, 3), rgb[:k, -k:].reshape(-1, 3),
            rgb[-k:, :k].reshape(-1, 3), rgb[-k:, -k:].reshape(-1, 3),
        ])
        bg = np.median(corners, axis=0)
        lum = rgb @ np.array([0.299, 0.587, 0.114])
        labels_h, n_h = ndimage.label(holes)
        total = float(binary.sum())
        for h in range(1, n_h + 1):
            comp = labels_h == h
            if comp.sum() > 0.08 * total:  # large hole (holo fill) → keep solid
                continue
            med = np.median(rgb[comp], axis=0)
            if np.linalg.norm(med - bg) >= 45:  # not background-coloured
                continue
            ring = ndimage.binary_dilation(comp, iterations=6) & ~comp
            if ring.any() and np.median(lum[ring]) < 70:  # ringed by dark outline
                reopen |= comp

    binary = filled
    # keep the largest connected component only
    labels, n = ndimage.label(binary)
    if n > 1:
        sizes = ndimage.sum(binary, labels, range(1, n + 1))
        binary = labels == (int(np.argmax(sizes)) + 1)

    # bridge grunge gaps, then grow slightly to catch the white border
    binary = ndimage.binary_closing(binary, iterations=4)
    binary = ndimage.binary_fill_holes(binary)
    binary = ndimage.binary_dilation(binary, iterations=3)

    # punch genuine die-cut holes back out
    binary = binary & ~reopen

    alpha = np.where(binary, 255, 0).astype(np.uint8)
    img = Image.fromarray(alpha, mode="L")
    # soften the hard edge by 1px for clean anti-aliasing
    return img.filter(ImageFilter.GaussianBlur(1.0))


def trim_to_content(img: Image.Image) -> Image.Image:
    """Crop to the alpha bounding box so the sticker fills the frame."""
    alpha = np.array(img.getchannel("A"))
    ys, xs = np.where(alpha > ALPHA_CUTOFF)
    if len(xs) == 0:
        return img
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    return img.crop((x0, y0, x1, y1))


def fit_square(img: Image.Image, size: int) -> Image.Image:
    """Scale to fit inside a transparent square canvas, centred."""
    img.thumbnail((size, size), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


sources = sorted(p for p in RAW_DIR.iterdir() if p.suffix.lower() == ".png")

for idx, src in enumerate(sources, start=1):
    with open(src, "rb") as fh:
        raw = fh.read()

    rgb = Image.open(io.BytesIO(raw)).convert("RGB")
    alpha = solid_mask(raw).resize(rgb.size, Image.LANCZOS)
    img = rgb.convert("RGBA")
    img.putalpha(alpha)

    img = trim_to_content(img)
    img = fit_square(img, FINAL)

    name = f"sticker-{idx:02d}.png"
    img.save(OUT_DIR / name, optimize=True)
    print("wrote", name)

print("done ->", OUT_DIR)

