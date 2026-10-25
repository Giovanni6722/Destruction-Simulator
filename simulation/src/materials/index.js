import { Solid, Powder, Liquid, Gas } from './categories.js';

export class Stone extends Solid {
  static type = 'stone';
  static symbol = '#';
  static color = '#7a7a7a';
  static density = 100;
}

export class Sand extends Powder {
  static type = 'sand';
  static symbol = 's';
  static color = '#e2c275';
  static density = 3;
}

export class Water extends Liquid {
  static type = 'water';
  static symbol = 'w';
  static color = '#3b82f6';
  static density = 1;
}

export class Steam extends Gas {
  static type = 'steam';
  static symbol = 'v';
  static color = '#cbd5e1';
  static density = 0;
  static lifetime = 100;
}

/** Every placeable material, keyed by type. New materials must be added here. */
export const MATERIALS = { stone: Stone, sand: Sand, water: Water, steam: Steam };

export function createPixel(type, ...args) {
  const Material = MATERIALS[type];
  if (!Material) throw new Error(`Unknown material type: ${type}`);
  return new Material(...args);
}
