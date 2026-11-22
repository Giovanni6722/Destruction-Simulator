"""Grid size and material colors, mirrored from the JavaScript simulation.

test_materials.py checks these values against the JS sources so the two
sides cannot drift apart silently.
"""

GRID_WIDTH = 120  # frontend/src/main.js
GRID_HEIGHT = 90  # frontend/src/main.js
BACKGROUND = "#0b0d12"  # frontend/src/renderer.js

# simulation/src/materials/index.js
COLORS = {
    "stone": "#7a7a7a",
    "sand": "#e2c275",
    "water": "#3b82f6",
    "oil": "#a16207",
    "steam": "#cbd5e1",
    "fire": "#f97316",
    "plant": "#22c55e",
}
