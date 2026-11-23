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
  /** Fraction of pixels that receive a small color variation. */
  static colorVariationChance = 0.3;
  /** Maximum proportional change applied to a varied pixel's color. */
  static colorVariation = 0.08;
  /** Heavier pixels sink through lighter, non-static ones. */
  static density = 0;
  /** Static pixels never move (stone, walls). */
  static isStatic = false;
  /** Whether this material can be ignited by fire. */
  static flammable = false;
  /** Number of ticks of fire contact needed for ignition. */
  static ignitionDelay = 1;
  /** Optional number of ticks a fire created from this pixel should last. */
  static burnRate = null;
  /** Whether fire should focus on this material instead of igniting all neighbors. */
  static ignitionMode = 'all';

  constructor() {
    this._color = variedColor(
      this.constructor.color,
      this.constructor.colorVariationChance,
      this.constructor.colorVariation,
    );
    // Tick on which this pixel last ran update(); guarantees one update per tick.
    this.lastUpdatedTick = -1;
    this.ignitionTicks = 0;
    this.lastIgnitionTick = -1;
  }

  get type() { return this.constructor.type; }
  get symbol() { return this.constructor.symbol; }
  get color() { return this._color; }
  get density() { return this.constructor.density; }
  get isStatic() { return this.constructor.isStatic; }
  get flammable() { return this.constructor.flammable; }
  get ignitionDelay() { return this.constructor.ignitionDelay; }
  get burnRate() { return this.constructor.burnRate; }
  get ignitionMode() { return this.constructor.ignitionMode; }


  canDisplace(other, rising = false) 
  {
    if (other === null) return true;
    if (other.isStatic) return false;
    return rising ? other.density > this.density : other.density < this.density;
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

let colorSeed = 0x6d2b79f5;

function nextColorRandom() {
  colorSeed = (Math.imul(colorSeed, 1664525) + 1013904223) >>> 0;
  return colorSeed / 0x100000000;
}

function variedColor(baseColor, chance, amount) {
  if (nextColorRandom() >= chance || amount <= 0) return baseColor;

  const factor = 1 + ((nextColorRandom() * 2 - 1) * amount);
  const channels = [1, 3, 5].map((index) => (
    Math.max(0, Math.min(255, Math.round(parseInt(baseColor.slice(index, index + 2), 16) * factor)))
  ));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
