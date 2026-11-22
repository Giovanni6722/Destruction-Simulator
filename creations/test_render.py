import io

from django.test import SimpleTestCase
from PIL import Image

from creations.render import _BACKGROUND, _PALETTE, render_png

PNG_HEADER = b"\x89PNG\r\n\x1a\n"


def tiny_scene():
    """2x2 grid: sand, empty / fire, stone."""
    return {"width": 2, "height": 2, "cells": ["sand", None, "fire", "stone"]}


def open_png(data):
    return Image.open(io.BytesIO(data)).convert("RGB")


class RenderTests(SimpleTestCase):
    def test_output_is_png(self):
        self.assertTrue(render_png(tiny_scene()).startswith(PNG_HEADER))

    def test_exact_pixel_colors(self):
        image = open_png(render_png(tiny_scene(), scale=1))
        self.assertEqual(image.size, (2, 2))
        self.assertEqual(image.getpixel((0, 0)), _PALETTE["sand"])
        self.assertEqual(image.getpixel((1, 0)), _BACKGROUND)
        self.assertEqual(image.getpixel((0, 1)), _PALETTE["fire"])
        self.assertEqual(image.getpixel((1, 1)), _PALETTE["stone"])

    def test_scaling_keeps_edges_sharp(self):
        image = open_png(render_png(tiny_scene(), scale=4))
        self.assertEqual(image.size, (8, 8))
        # Pixels on both sides of the cell boundary keep their exact colors.
        self.assertEqual(image.getpixel((3, 0)), _PALETTE["sand"])
        self.assertEqual(image.getpixel((4, 0)), _BACKGROUND)
        self.assertEqual(image.getpixel((3, 4)), _PALETTE["fire"])
        self.assertEqual(image.getpixel((4, 4)), _PALETTE["stone"])
        colors = {color for _, color in image.getcolors()}
        self.assertEqual(len(colors), 4)
