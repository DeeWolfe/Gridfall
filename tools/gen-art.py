#!/usr/bin/env python3
"""Card art pipeline: art/sources/<cardId>.(png|jpg|jpeg|webp) -> src/content/card-art.js.

Drop an image named after a card id into art/sources/ and run `npm run gen:art`.
For each source this tool:

  1. crops to the artwork (the bounding box of non-near-white content, padded,
     squared) — so a screenshot with margins works as well as a clean export;
  2. removes the white background: a flood fill from the borders, so whites
     INSIDE the artwork (eyes, highlights, uniforms) survive; the alpha edge is
     feathered a pixel so anime linework keeps its softness on the dark frames;
  3. downscales to card resolution and embeds as a data URI (WebP where Pillow
     supports it, PNG otherwise).

Dev-only tool: it needs Pillow (`pip install pillow`). The game itself remains
zero-dependency — the output is a plain generated module, committed like the
content modules.
"""
import base64
import io
import json
import sys
from collections import deque
from pathlib import Path

try:
    from PIL import Image, ImageFilter, ImageOps
except ImportError:
    sys.exit("gen-art needs Pillow: pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "art" / "sources"
OUT = ROOT / "src" / "content" / "card-art.js"
SIZE = 384                 # longest edge of the embedded art
WHITE = 235                # min(r,g,b) at or above this counts as background
PAD = 0.02                 # crop margin, as a fraction of the art's size


def content_bbox(im):
    """Bounding box of everything that is not near-white."""
    gray = im.convert("RGB")
    px = gray.load()
    w, h = gray.size
    left, top, right, bottom = w, h, 0, 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if min(r, g, b) < WHITE:
                if x < left:
                    left = x
                if x > right:
                    right = x
                if y < top:
                    top = y
                if y > bottom:
                    bottom = y
    if right <= left or bottom <= top:
        return None
    return left, top, right + 1, bottom + 1


def square_crop(im):
    """Crop to the artwork, pad a little, and square the frame."""
    box = content_bbox(im)
    if not box:
        return im
    left, top, right, bottom = box
    w, h = im.size
    pad = int(max(right - left, bottom - top) * PAD)
    left, top = max(0, left - pad), max(0, top - pad)
    right, bottom = min(w, right + pad), min(h, bottom + pad)

    # Square it around the content, clamped to the image.
    side = max(right - left, bottom - top)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    half = side // 2
    left = max(0, min(cx - half, w - side))
    top = max(0, min(cy - half, h - side))
    return im.crop((left, top, min(w, left + side), min(h, top + side)))


def strip_background(im):
    """Flood-fill the border-connected white away; feather the alpha edge."""
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    keep = bytearray([255]) * (w * h)

    queue = deque()
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        i = y * w + x
        if not keep[i]:
            continue
        r, g, b = px[x, y]
        if min(r, g, b) < WHITE:
            continue
        keep[i] = 0
        if x > 0:
            queue.append((x - 1, y))
        if x < w - 1:
            queue.append((x + 1, y))
        if y > 0:
            queue.append((x, y - 1))
        if y < h - 1:
            queue.append((x, y + 1))

    alpha = Image.frombytes("L", (w, h), bytes(keep))
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.1))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


def encode(im):
    """Smallest of WebP and PNG, as a data URI."""
    best = None
    for fmt, mime, kwargs in (("WEBP", "image/webp", {"quality": 82, "method": 6}),
                              ("PNG", "image/png", {"optimize": True})):
        buf = io.BytesIO()
        try:
            im.save(buf, fmt, **kwargs)
        except (KeyError, OSError):
            continue
        data = buf.getvalue()
        if best is None or len(data) < len(best[0]):
            best = (data, mime)
    data, mime = best
    return f"data:{mime};base64,{base64.b64encode(data).decode()}", len(data)


def main():
    cards = json.loads((ROOT / "reference" / "gridfall-data.json").read_text())["cards"]
    SOURCES.mkdir(parents=True, exist_ok=True)

    entries = {}
    for path in sorted(SOURCES.iterdir()):
        if path.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
            continue
        card_id = path.stem
        if card_id not in cards:
            sys.exit(f"art/sources/{path.name}: no card is named '{card_id}'")

        im = ImageOps.exif_transpose(Image.open(path))
        im = square_crop(im)
        im = strip_background(im)
        im.thumbnail((SIZE, SIZE), Image.LANCZOS)
        uri, size = encode(im)
        entries[card_id] = uri
        print(f"  {card_id}: {im.size[0]}x{im.size[1]}, {size // 1024}KB embedded")

    body = ",\n".join(f"  {k}: {json.dumps(v)}" for k, v in sorted(entries.items()))
    OUT.write_text(
        "// GENERATED by tools/gen-art.py from art/sources/.\n"
        "// Drop an image named <cardId>.png/jpg there and run `npm run gen:art` —\n"
        "// do not edit this file by hand. Cards without an entry fall back to\n"
        "// their procedural sigil.\n\n"
        "export const CARD_ART = {\n" + body + ("\n" if body else "") + "};\n"
    )
    print(f"wrote src/content/card-art.js — {len(entries)} card{'s' if len(entries) != 1 else ''}")


if __name__ == "__main__":
    main()
