"""Prepare the reference artwork for use in the app.

The 3D composition ships as a 1024x1024 RGBA image with a transparent
background and a lot of empty margin. This crops to the artwork and downscales
it, preserving the alpha channel exactly. If a future export arrives flattened
onto white, the background is keyed out instead.

Run from the repository root:

    backend/.venv/bin/python scripts/prepare_assets.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[1]
SOURCE = REPO_ROOT / "design_reference" / "playful_3d_cadence_composition" / "screen.png"
TARGET = REPO_ROOT / "frontend" / "src" / "assets" / "cadence-pebbles.png"

OPAQUE = 243
FULLY_WHITE = 252


def alpha_for(pixel: tuple[int, ...]) -> int:
    whiteness = max(pixel[:3])
    if whiteness >= FULLY_WHITE:
        return 0
    if whiteness <= OPAQUE:
        return 255
    return round(255 * (FULLY_WHITE - whiteness) / (FULLY_WHITE - OPAQUE))


def key_out_white(image: Image.Image) -> Image.Image:
    """Turn a flat white background into transparency, keeping the artwork."""
    rgb = image.convert("RGB")
    output = rgb.convert("RGBA")
    source_pixels = rgb.load()
    target_pixels = output.load()
    assert source_pixels is not None and target_pixels is not None

    width, height = rgb.size
    for y in range(height):
        for x in range(width):
            pixel = source_pixels[x, y]
            target_pixels[x, y] = (*pixel, alpha_for(pixel))

    return output


def main() -> None:
    image = Image.open(SOURCE)

    if image.mode == "RGBA" and image.getchannel("A").getextrema()[0] == 0:
        artwork = image
    else:
        artwork = key_out_white(image)

    bounds = artwork.getbbox() or (0, 0, artwork.size[0], artwork.size[1])
    artwork = artwork.crop(bounds)
    artwork.thumbnail((512, 512), Image.LANCZOS)
    artwork.save(TARGET, format="PNG", optimize=True)

    print(f"wrote {TARGET} ({artwork.size[0]}x{artwork.size[1]}, mode {artwork.mode})")


if __name__ == "__main__":
    main()
