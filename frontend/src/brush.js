import { createPixel } from '../../simulation/src/materials/index.js';

/** Pseudo-material that clears cells instead of placing a pixel. */
export const ERASE = 'erase';

/** Cell offsets covered by a brush stamp. Size 1 is one cell; each size adds a ring. */
export function brushOffsets(size) {
  const radius = size - 1;
  const offsets = [];
  for (let dy = 0 - radius; dy <= radius; dy++) {
    for (let dx = 0 - radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius + 0.5) offsets.push([dx, dy]);
    }
  }
  return offsets;
}

/** Every cell on the straight line between two cells, ends included (Bresenham). */
export function lineCells(x0, y0, x1, y1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let x = x0, y = y0; ; ) {
    cells.push([x, y]);
    if (x === x1 && y === y1) return cells;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

/** Paints one stamp at (cx, cy). Materials only fill empty cells; ERASE clears any cell. */
export function paintAt(world, cx, cy, material, size) {
  for (const [dx, dy] of brushOffsets(size)) {
    const x = cx + dx;
    const y = cy + dy;
    if (!world.grid.inBounds(x, y)) continue;
    if (material === ERASE) world.set(x, y, null);
    else if (world.isEmpty(x, y)) world.set(x, y, createPixel(material));
  }
}

/** Stamps along the line between two cells so fast drags leave no gaps. */
export function paintLine(world, [x0, y0], [x1, y1], material, size) {
  for (const [x, y] of lineCells(x0, y0, x1, y1)) paintAt(world, x, y, material, size);
}
