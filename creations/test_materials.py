"""Keep creations/materials.py in sync with the JavaScript sources.

If a material is added or recolored in JS, these tests fail until
materials.py is updated to match.
"""

import re
from pathlib import Path

from django.test import SimpleTestCase

from creations import materials

ROOT = Path(__file__).resolve().parent.parent
MATERIALS_JS = ROOT / "simulation" / "src" / "materials" / "index.js"
RENDERER_JS = ROOT / "frontend" / "src" / "renderer.js"
MAIN_JS = ROOT / "frontend" / "src" / "main.js"

CLASS_RE = re.compile(r"export class \w+ extends \w+ \{(.*?)\n\}", re.DOTALL)
TYPE_RE = re.compile(r"static type = '([^']+)'")
COLOR_RE = re.compile(r"static color = '([^']+)'")


def js_colors():
    """Return {type: color} for every material class in index.js."""
    source = MATERIALS_JS.read_text(encoding="utf-8")
    colors = {}
    for body in CLASS_RE.findall(source):
        type_match = TYPE_RE.search(body)
        color_match = COLOR_RE.search(body)
        if type_match and color_match:
            colors[type_match.group(1)] = color_match.group(1)
    return colors


def js_const(path, name):
    match = re.search(rf"const {name} = '?([^';]+)'?;", path.read_text(encoding="utf-8"))
    if match is None:
        raise AssertionError(f"{name} not found in {path}")
    return match.group(1)


class MaterialsSyncTests(SimpleTestCase):
    def test_colors_match_js(self):
        found = js_colors()
        self.assertTrue(found, f"No materials parsed from {MATERIALS_JS}")
        self.assertEqual(
            materials.COLORS,
            found,
            "creations/materials.py COLORS is out of sync with "
            "simulation/src/materials/index.js",
        )

    def test_background_matches_renderer(self):
        self.assertEqual(materials.BACKGROUND, js_const(RENDERER_JS, "BACKGROUND"))

    def test_grid_size_matches_main(self):
        self.assertEqual(materials.GRID_WIDTH, int(js_const(MAIN_JS, "WIDTH")))
        self.assertEqual(materials.GRID_HEIGHT, int(js_const(MAIN_JS, "HEIGHT")))
