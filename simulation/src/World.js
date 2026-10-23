import { Grid } from './Grid.js';
import { createRandom } from './random.js';

/**
 * Owns the grid and advances the simulation one tick at a time.
 *
 * Unlike Conway's Game of Life, pixels here move, so a pure double buffer would
 * let two pixels claim the same empty cell. Instead step() updates in place,
 * bottom row first, and stamps each pixel with the tick it last ran so nothing
 * is updated twice in one tick (e.g. a rising gas entering an unvisited row).
 */
export class World {
  constructor(width, height, { seed = Date.now() } = {}) {
    this.grid = new Grid(width, height);
    this.tick = 0;
    this.random = createRandom(seed);
  }

  get width() { return this.grid.width; }
  get height() { return this.grid.height; }

  get(x, y) { return this.grid.get(x, y); }
  set(x, y, pixel) { this.grid.set(x, y, pixel); }
  isEmpty(x, y) { return this.grid.get(x, y) === null; }

  /** Advances the whole world by one tick. */
  step() {
    this.tick++;
    const { width, height } = this.grid;
    // Alternate horizontal scan direction each tick so nothing drifts to one side.
    const leftToRight = this.tick % 2 === 0;

    for (let y = height - 1; y >= 0; y--) {
      for (let i = 0; i < width; i++) {
        const x = leftToRight ? i : width - 1 - i;
        const pixel = this.grid.get(x, y);
        if (pixel === null || pixel.lastUpdatedTick === this.tick) continue;
        pixel.lastUpdatedTick = this.tick;
        pixel.update(x, y, this);
      }
    }
  }

  /**
   * Moves the pixel at (x, y) to (tx, ty), swapping with whatever is there.
   * This is the only way pixels move, so pixels are never created or destroyed
   * by movement and static pixels can never be moved.
   * @returns {boolean} whether the move happened
   */
  tryMove(x, y, tx, ty) {
    if (!this.grid.inBounds(tx, ty)) return false;
    const pixel = this.grid.get(x, y);
    if (!pixel || pixel.isStatic) return false;
    if (!pixel.canDisplace(this.grid.get(tx, ty))) return false;
    this.grid.swap(x, y, tx, ty);
    return true;
  }
}
