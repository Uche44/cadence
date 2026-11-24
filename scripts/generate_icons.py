"""Generate the installable-app icon set.

Run from the repository root:

    backend/.venv/bin/python scripts/generate_icons.py

The mark is built from the same palette as the UI: periwinkle canvas, an
obsidian pebble, and a mint pill. Maskable variants keep the artwork inside the
central safe zone so Android's adaptive masks never crop the mark.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "icons"

SUPERSAMPLE = 4

CANVAS = (244, 243, 255)
INK = (15, 23, 42)
LAVENDER = (221, 214, 254)
MINT = (187, 247, 208)
APRICOT = (254, 215, 170)
SKY = (186, 230, 253)


def _compose(size: int, inset: float) -> Image.Image:
    """Draw the mark at a supersampled resolution, then downscale for clean edges."""
    canvas = size * SUPERSAMPLE
    image = Image.new("RGBA", (canvas, canvas), (*CANVAS, 255))
    draw = ImageDraw.Draw(image)

    pad = canvas * inset
    width = canvas - 2 * pad

    # Periwinkle-to-sky wash behind the pebbles.
    draw.ellipse(
        (pad + 0.02 * width, pad + 0.06 * width, pad + 0.98 * width, pad + 1.02 * width),
        fill=SKY,
    )
    draw.ellipse(
        (pad + 0.08 * width, pad + 0.12 * width, pad + 0.92 * width, pad + 0.96 * width),
        fill=LAVENDER,
    )
    # Apricot sphere, upper right.
    draw.ellipse(
        (pad + 0.56 * width, pad + 0.08 * width, pad + 0.94 * width, pad + 0.46 * width),
        fill=APRICOT,
    )
    # Obsidian pebble, the anchor.
    draw.ellipse(
        (pad + 0.30 * width, pad + 0.34 * width, pad + 0.88 * width, pad + 0.92 * width),
        fill=INK,
    )

    # Mint pill, rotated, sitting over the pebble's shoulder.
    pill = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    pill_draw = ImageDraw.Draw(pill)
    pill_draw.rounded_rectangle(
        (pad + 0.08 * width, pad + 0.48 * width, pad + 0.54 * width, pad + 0.72 * width),
        radius=int(0.12 * width),
        fill=(*MINT, 255),
    )
    pill = pill.rotate(
        -24,
        resample=Image.BICUBIC,
        center=(pad + 0.31 * width, pad + 0.60 * width),
    )
    image.alpha_composite(pill)

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = [
        ("icon-192.png", 192, 0.10),
        ("icon-512.png", 512, 0.10),
        ("icon-maskable-512.png", 512, 0.24),
        ("apple-touch-icon.png", 180, 0.10),
    ]

    for name, size, inset in targets:
        _compose(size, inset).save(OUTPUT_DIR / name, format="PNG", optimize=True)
        print(f"wrote {OUTPUT_DIR / name} ({size}x{size})")


if __name__ == "__main__":
    main()
