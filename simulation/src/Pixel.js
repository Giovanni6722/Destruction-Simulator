/**
 * Base class for anything that can occupy a cell on the grid.
 *
 * Material-wide properties (type, color, density...) are static fields, so all
 * sand shares one definition. Per-particle state (e.g. a fire's remaining
 * lifetime) lives on the instance. Subclasses add behavior by overriding
 * update().
 *
 * Empty cells are represented by null, not by a Pixel.
 */
export class Pixel {
  /** Unique key used for serialization and the material registry. */
  static type = 'pixel';
  /** Single character used when printing grids (tests and debugging). */
  static symbol = '?';
  static color = '#ff00ff';
  /** Heavier pixels sink through lighter, non-static ones. */
  static density = 0;
  /** Static pixels never move (stone, walls). */
  static isStatic = false;

  constructor() {
    // Tick on which this pixel last ran update(); guarantees one update per tick.
    this.lastUpdatedTick = -1;
  }

  get type() { return this.constructor.type; }
  get symbol() { return this.constructor.symbol; }
  get color() { return this.constructor.color; }
  get density() { return this.constructor.density; }
  get isStatic() { return this.constructor.isStatic; }

  /** Whether this pixel may move into a cell holding `other` (null = empty). */
  canDisplace(other) {
    if (other === null) return true;
    return !other.isStatic && other.density < this.density;
  }

  /**
   * Called at most once per tick by World.step().
   * @param {number} x
   * @param {number} y
   * @param {import('./World.js').World} world
   */
  // eslint-disable-next-line no-unused-vars
  update(x, y, world) {}
}
