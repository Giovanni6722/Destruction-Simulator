const BACKGROUND = '#0b0d12';
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Returns draw(world), which paints one canvas pixel per cell through a single ImageData. */
export function createRenderer(ctx, width, height) {
  const image = ctx.createImageData(width, height);
  const background = rgb(BACKGROUND);
  const colors = new Map();
  const colorOf = (pixel) => {
    if (!colors.has(pixel.type)) colors.set(pixel.type, rgb(pixel.color));
    return colors.get(pixel.type);
  };

  return (world) => {
    world.grid.cells.forEach((pixel, i) => {
      const [r, g, b] = pixel ? colorOf(pixel) : background;
      image.data.set([r, g, b, 255], i * 4);
    });
    ctx.putImageData(image, 0, 0);
  };
}
