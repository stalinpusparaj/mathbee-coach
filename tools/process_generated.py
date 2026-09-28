#!/usr/bin/env python3
"""Turn raw generated images (art-generated/raw) into app assets.

- sprites: remove the flat magenta background (only colour regions connected to the
  image border, so pink/purple details inside the subject survive), soften the edge,
  remove magenta fringing, trim, resize to <=360 px, save transparent WebP.
- backgrounds / banners: resize (<=1600 px wide) and save WebP.
- writes src/assets/generated.json (id, file, size, kind, alt, provenance).

Requires Python 3 with pillow, numpy, scipy (same as tools/extract_assets.py).
"""
import glob
import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "art-generated", "raw")
OUT = os.path.join(ROOT, "public", "assets", "generated")
MANIFEST = os.path.join(ROOT, "src", "assets", "generated.json")
BRIEF = json.load(open(os.path.join(ROOT, "tools", "art-brief.json")))
BY_ID = {a["id"]: a for a in BRIEF["assets"]}

KEY = np.array([255, 0, 255], dtype=np.float32)
T_IN, T_OUT = 70.0, 150.0  # colour distance: <=T_IN fully background, >=T_OUT fully subject


def key_sprite(img: Image.Image) -> Image.Image:
    # A PNG that already has real transparency (e.g. from ChatGPT) is kept as is, just trimmed.
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        if np.array(rgba)[..., 3].min() < 250:
            bbox = rgba.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
            return rgba.crop(bbox) if bbox else rgba
    rgb = np.array(img.convert("RGB")).astype(np.float32)
    dist = np.sqrt(((rgb - KEY) ** 2).sum(axis=2))
    near = dist < T_OUT
    labels, _ = ndimage.label(near)
    border = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    bg_region = np.isin(labels, list(border))
    alpha = np.clip((dist - T_IN) / (T_OUT - T_IN), 0, 1)
    alpha = np.where(bg_region, alpha, 1.0)
    # despill: pull magenta tint out of semi-transparent edge pixels
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, None) * (1 - alpha)
    rgb[..., 0] = r - spill
    rgb[..., 2] = b - spill
    out = np.dstack([np.clip(rgb, 0, 255), alpha * 255]).astype(np.uint8)
    im = Image.fromarray(out, "RGBA")
    bbox = im.getchannel("A").point(lambda a: 255 if a > 16 else 0).getbbox()
    return im.crop(bbox) if bbox else im


def main():
    os.makedirs(OUT, exist_ok=True)
    records = []
    for path in sorted(glob.glob(os.path.join(RAW, "*"))):
        stem, ext = os.path.splitext(os.path.basename(path))
        if ext.lower() not in (".png", ".jpg", ".jpeg", ".webp") or stem not in BY_ID:
            continue
        a = BY_ID[stem]
        meta_path = os.path.join(RAW, stem + ".json")
        meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
        img = Image.open(path)
        if a["kind"] == "sprite":
            img = key_sprite(img)
            img.thumbnail((360, 360), Image.LANCZOS)
            img.save(os.path.join(OUT, stem + ".webp"), "WEBP", quality=88, method=4)
        else:
            img = img.convert("RGB")
            img.thumbnail((1600, 1600), Image.LANCZOS)
            img.save(os.path.join(OUT, stem + ".webp"), "WEBP", quality=78, method=4)
        records.append({
            "id": stem,
            "file": f"assets/generated/{stem}.webp",
            "width": img.width,
            "height": img.height,
            "kind": a["kind"],
            "alt": a.get("alt", ""),
            "source": f"generated: {meta.get('model', 'unknown model')} ({meta.get('generatedAt', 'unknown date')})",
            "sourceRect": [],
        })
        print(f"ok   {stem} ({a['kind']}, {img.width}x{img.height})")
    with open(MANIFEST, "w") as fh:
        json.dump(records, fh, indent=1)
    print(f"wrote {len(records)} assets to src/assets/generated.json")


if __name__ == "__main__":
    main()
