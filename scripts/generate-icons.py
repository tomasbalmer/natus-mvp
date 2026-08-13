"""Generate the home-screen icons from the mark in public/favicon.svg.

Drawn rather than rasterised: the mark is two concentric rings on the brand
green, and PIL renders that crisply at any size with no dependency on a
converter being installed. If a real brand mark ever replaces the stand-in,
this script is the thing to replace with a proper export.

Three shapes, for three different things the platforms do:

  icon-192 / icon-512   Android and Chrome. Rounded corners drawn in, because
                        nothing rounds them for us.
  icon-maskable-512     Android may crop this to a circle, so the ring sits
                        inside the central 80% safe zone with the background
                        bled to the edges.
  apple-touch-icon      iOS applies its own rounded corners. A square with no
                        corners of its own, or the two roundings compound into
                        dark notches.

    python3 scripts/generate-icons.py
"""
from PIL import Image, ImageDraw

GREEN = (28, 56, 41)      # #1C3829
CREAM = (232, 220, 200)   # #E8DCC8
SS = 8                    # supersampling factor, for smooth curves


def blend(fg, bg, alpha):
    """PIL's arc has no opacity, so the stroke colour is pre-blended."""
    return tuple(round(f * alpha + b * (1 - alpha)) for f, b in zip(fg, bg))


def draw(size, *, corner_radius_ratio, ring_scale):
    """One icon. Geometry is expressed as ratios of the canvas so the three
    variants differ only in their arguments."""
    n = size * SS
    img = Image.new("RGB", (n, n), GREEN)
    d = ImageDraw.Draw(img)

    if corner_radius_ratio > 0:
        # Rounded corners are drawn by masking, since the canvas is opaque.
        mask = Image.new("L", (n, n), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            (0, 0, n - 1, n - 1), radius=int(n * corner_radius_ratio), fill=255
        )
        base = Image.new("RGB", (n, n), (0, 0, 0))
        base.paste(img, (0, 0), mask)
        img = base
        d = ImageDraw.Draw(img)

    c = n / 2
    outer_r = n * 0.297 * ring_scale   # 9.5/32 in the source
    inner_r = n * 0.1875 * ring_scale  # 6/32
    outer_w = max(1, int(n * 0.0375 * ring_scale))  # 1.2/32
    inner_w = max(1, int(n * 0.03125 * ring_scale))  # 1/32

    d.ellipse(
        (c - outer_r, c - outer_r, c + outer_r, c + outer_r),
        outline=blend(CREAM, GREEN, 0.85),
        width=outer_w,
    )
    d.ellipse(
        (c - inner_r, c - inner_r, c + inner_r, c + inner_r),
        outline=blend(CREAM, GREEN, 0.40),
        width=inner_w,
    )

    return img.resize((size, size), Image.LANCZOS)


OUTPUTS = [
    # Android / Chrome. Corners drawn in.
    ("public/icon-192.png", 192, 7 / 32, 1.0),
    ("public/icon-512.png", 512, 7 / 32, 1.0),
    # Maskable: square to the edge, ring shrunk into the safe zone.
    ("public/icon-maskable-512.png", 512, 0, 0.72),
    # iOS rounds this itself, so no corners here.
    ("public/apple-touch-icon.png", 180, 0, 1.0),
]

for path, size, radius, scale in OUTPUTS:
    draw(size, corner_radius_ratio=radius, ring_scale=scale).save(path)
    print(f"  {path}  {size}x{size}")
