/**
 * Fixed-size 2D storage of cells. (0, 0) is the top-left; y grows downward.
 * Each cell holds a Pixel or null (empty). Contains no simulation logic.
 */
export class Grid {
  constructor(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new RangeError(`Grid dimensions must be positive integers, got ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(null);
  }

  inBounds(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Returns the pixel at (x, y), null if empty, or undefined if out of bounds. */
  get(x, y) {
    return this.inBounds(x, y) ? this.cells[y * this.width + x] : undefined;
  }

  set(x, y, pixel) {
    if (!this.inBounds(x, y)) throw new RangeError(`(${x}, ${y}) is out of bounds`);
    this.cells[y * this.width + x] = pixel;
  }

  swap(x1, y1, x2, y2) {
    const a = this.get(x1, y1);
    this.set(x1, y1, this.get(x2, y2));
    this.set(x2, y2, a);
  }

  /** Number of pixels of each type, e.g. { sand: 3, stone: 5 }. Empty cells are not counted. */
  countByType() {
    const counts = {};
    for (const pixel of this.cells) {
      if (pixel !== null) counts[pixel.type] = (counts[pixel.type] ?? 0) + 1;
    }
    return counts;
  }
}
