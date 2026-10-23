import { Pixel } from '../Pixel.js';

/** Never moves and never gets displaced (walls, stone). */
export class Solid extends Pixel {
  static isStatic = true;
}

/** Falls straight down; if blocked, slides diagonally down so it piles up. */
export class Powder extends Pixel {
  update(x, y, world) {
    if (world.tryMove(x, y, x, y + 1)) return;
    // Pick a random diagonal first so piles grow symmetrically.
    const dir = world.random() < 0.5 ? -1 : 1;
    if (world.tryMove(x, y, x + dir, y + 1)) return;
    world.tryMove(x, y, x - dir, y + 1);
  }
}
