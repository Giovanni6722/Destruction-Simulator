import { Solid, Powder } from './categories.js';

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

/** Every placeable material, keyed by type. New materials must be added here. */
export const MATERIALS = { stone: Stone, sand: Sand };

export function createPixel(type) {
  const Material = MATERIALS[type];
  if (!Material) throw new Error(`Unknown material type: ${type}`);
  return new Material();
}
