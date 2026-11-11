import { Solid, Powder, Liquid, Gas, Fire as FireCategory } from './categories.js';

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

export class Oil extends Liquid {
  static type = 'oil';
  static symbol = 'o';
  static color = '#a16207';
  static density = 0.5;
  static flammable = true;
  static ignitionDelay = 2;

  canDisplace(other, rising = false) {
    if (other?.type === 'fire') return false;
    return super.canDisplace(other, rising);
  }
}

export class Steam extends Gas {
  static type = 'steam';
  static symbol = 'v';
  static color = '#cbd5e1';
  static density = 0;
  static lifetime = 100;
}

export class Fire extends FireCategory {
  static type = 'fire';
  static symbol = 'f';
  static color = '#f97316';
  static density = 0;
  static lifetime = 50;

  canDisplace(other, rising = false) {
    if (other?.flammable) return false;
    return super.canDisplace(other, rising);
  }

  update(x, y, world) {
    const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    for (const [dx, dy] of neighbors) {
      const waterX = x + dx;
      const waterY = y + dy;
      if (world.get(waterX, waterY)?.type !== 'water') continue;

      world.set(waterX, waterY, new Steam());
      world.set(x, y, null);
      return;
    }

    for (const [dx, dy] of neighbors) {
      const fuelX = x + dx;
      const fuelY = y + dy;
      const fuel = world.get(fuelX, fuelY);
      if (!fuel?.flammable) continue;

      if (fuel.lastIgnitionTick !== world.tick) {
        fuel.ignitionTicks++;
        fuel.lastIgnitionTick = world.tick;
      }
      if (fuel.ignitionTicks < fuel.ignitionDelay) continue;

      world.set(fuelX, fuelY, new Fire());
    }

    super.update(x, y, world);
  }
}

/** Every placeable material, keyed by type. New materials must be added here. */
export const MATERIALS = { stone: Stone, sand: Sand, water: Water, oil: Oil, steam: Steam, fire: Fire };

export function createPixel(type, ...args) {
  const Material = MATERIALS[type];
  if (!Material) throw new Error(`Unknown material type: ${type}`);
  return new Material(...args);
}
