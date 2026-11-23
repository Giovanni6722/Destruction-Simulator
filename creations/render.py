"""Render a saved scene to a PNG so the moderation LLM can see it."""

import io

from PIL import Image

from .materials import BACKGROUND, COLORS

SCALE = 4


def _rgb(hex_color):
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i + 2], 16) for i in (0, 2, 4))


_BACKGROUND = _rgb(BACKGROUND)
_PALETTE = {material: _rgb(color) for material, color in COLORS.items()}


def render_png(simulation_data, scale=SCALE):
    """Return PNG bytes for a scene that has passed validate_simulation_data.

    NEAREST scaling keeps hard pixel edges, so small drawn letters stay
    readable instead of blurring.
    """
    width, height = simulation_data["width"], simulation_data["height"]
    image = Image.new("RGB", (width, height))
    image.putdata([_PALETTE[c] if c else _BACKGROUND
                   for c in simulation_data["cells"]])
    image = image.resize((width * scale, height * scale), Image.NEAREST)
    buffer = io.BytesIO()
    image.save(buffer, "PNG")
    return buffer.getvalue()
