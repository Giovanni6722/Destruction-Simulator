import { Grid } from './Grid.js';
import { createRandom } from './random.js';

export class World {
  constructor(width, height, { seed = Date.now() } = {}) {
    this.grid = new Grid(width, height);
    this.tick = 0;
    this.random = createRandom(seed);
    // Set by tryMove when it displaces a pixel that hasn't updated this tick.
    this.displacedPending = false;
  }

  get width() { return this.grid.width; }
  get height() { return this.grid.height; }

  get(x, y) { return this.grid.get(x, y); }
  set(x, y, pixel) { this.grid.set(x, y, pixel); }
  isEmpty(x, y) { return this.grid.get(x, y) === null; }

  /** Advances the whole world by one tick. */
  step() {
    this.tick++;
    do {
      this.displacedPending = false;
      this.scan();
    } while (this.displacedPending);
  }

  /** Updates, bottom row first, every pixel that hasn't updated this tick. */
  scan() {
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
   * by movement and static pixels can never be moved. Upward moves only swap a
   * lighter pixel past a heavier one (see Pixel.canDisplace).
   * @returns {boolean} whether the move happened
   */
  tryMove(x, y, tx, ty) {
    if (!this.grid.inBounds(tx, ty)) return false;
    const pixel = this.grid.get(x, y);
    if (!pixel || pixel.isStatic) return false;
    const other = this.grid.get(tx, ty);
    if (!pixel.canDisplace(other, ty < y)) return false;
    if (other && other.lastUpdatedTick !== this.tick) this.displacedPending = true;
    this.grid.swap(x, y, tx, ty);
    return true;
  }
}
