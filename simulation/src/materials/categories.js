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

/** Falls straight down; once it hits the bottom, it will level out */
export class Liquid extends Pixel {
  update(x, y, world) {
    if (world.tryMove(x, y, x, y + 1)) return;
    const dir = world.random() < 0.5 ? -1 : 1;
    if (world.tryMove(x, y, x + dir, y + 1)) return;
    if (world.tryMove(x, y, x - dir, y + 1)) return;
    if (world.tryMove(x, y, x + dir, y)) return;
    world.tryMove(x, y, x - dir, y);
  }
}

/** Rises, spreads sideways when blocked, and dissipates after a finite lifetime. */
export class Gas extends Pixel {
  static lifetime = 100;

  constructor(lifetime) {
    super();
    this.lifetime = lifetime === undefined ? this.constructor.lifetime : lifetime;
    if (!Number.isInteger(this.lifetime) || this.lifetime < 0) {
      throw new RangeError('Gas lifetime must be a non-negative integer');
    }
    this.age = 0;
  }

  update(x, y, world) {
    this.age++;
    if (this.age >= this.lifetime) {
      world.set(x, y, null);
      return;
    }

    if (world.tryMove(x, y, x, y - 1)) return;
    const dir = world.random() < 0.5 ? -1 : 1;
    if (world.tryMove(x, y, x + dir, y - 1)) return;
    if (world.tryMove(x, y, x - dir, y - 1)) return;
    if (world.tryMove(x, y, x + dir, y)) return;
    world.tryMove(x, y, x - dir, y);
  }
}
