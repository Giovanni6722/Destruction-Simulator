import { Solid, Powder, Liquid, Gas, Fire as FireCategory } from './categories.js';
import { Pixel } from '../Pixel.js';

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

export class Plant extends Pixel {
  static type = 'plant';
  static symbol = 'p';
  static color = '#22c55e';
  static density = 2;
  static flammable = true;
  static ignitionDelay = 2;
  static ignitionMode = 'focused';
  // Lower values make each burning plant cell disappear sooner.
  static burnRate = 18;
  static growthDirection = [0, 1];
  static waterRequired = 1;

  constructor(options = {}) {
    super();
    const {
      burnRate = this.constructor.burnRate,
      growthDirection = this.constructor.growthDirection,
      waterRequired = this.constructor.waterRequired,
    } = options;
    if (!Number.isInteger(burnRate) || burnRate <= 0) {
      throw new RangeError('Plant burnRate must be a positive integer');
    }
    if (!Array.isArray(growthDirection) || growthDirection.length !== 2
      || !growthDirection.every(Number.isInteger)
      || growthDirection.every((value) => value === 0)) {
      throw new RangeError('Plant growthDirection must be a non-zero integer pair');
    }
    if (!Number.isInteger(waterRequired) || waterRequired <= 0) {
      throw new RangeError('Plant waterRequired must be a positive integer');
    }
    this._burnRate = burnRate;
    this._growthDirection = [...growthDirection];
    this._waterRequired = waterRequired;
    this.growthWater = 0;
  }

  get burnRate() { return this._burnRate; }
  get growthDirection() { return this._growthDirection; }
  get waterRequired() { return this._waterRequired; }

  update(x, y, world) {
    const component = this.findComponent(x, y, world);
    const leader = component.leader;
    if (leader.x !== x || leader.y !== y) return;

    const storedWater = Math.max(...component.map(({ pixel }) => pixel.growthWater));
    const waterCells = new Set();
    for (const { x: cellX, y: cellY } of component) {
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const waterX = cellX + dx;
        const waterY = cellY + dy;
        if (world.get(waterX, waterY)?.type === 'water') waterCells.add(`${waterX},${waterY}`);
      }
    }

    const growthWater = storedWater + waterCells.size;
    for (const { pixel } of component) pixel.growthWater = growthWater;
    if (growthWater < this.waterRequired) return;

    const targets = [];
    const seenTargets = new Set();
    for (const { x: cellX, y: cellY } of component) {
      const targetX = cellX + this.growthDirection[0];
      const targetY = cellY + this.growthDirection[1];
      const key = `${targetX},${targetY}`;
      if (!seenTargets.has(key) && world.isEmpty(targetX, targetY)) {
        seenTargets.add(key);
        targets.push([targetX, targetY]);
      }
    }
    if (targets.length === 0) return;

    const [targetX, targetY] = targets[Math.floor(world.random() * targets.length)];
    const newPlant = new Plant({
      burnRate: this.burnRate,
      growthDirection: this.growthDirection,
      waterRequired: this.waterRequired,
    });
    for (const key of [...waterCells].slice(0, this.waterRequired)) {
      const [waterX, waterY] = key.split(',').map(Number);
      world.set(waterX, waterY, null);
    }
    newPlant.growthWater = 0;
    world.set(targetX, targetY, newPlant);
    for (const { pixel } of component) pixel.growthWater = newPlant.growthWater;
  }

  findComponent(x, y, world) {
    const key = `${x},${y}`;
    const cached = world.plantComponents.get(key);
    if (cached) return cached;

    const component = [];
    const pending = [[x, y]];
    const visited = new Set();
    while (pending.length > 0) {
      const [cellX, cellY] = pending.pop();
      const key = `${cellX},${cellY}`;
      if (visited.has(key) || world.get(cellX, cellY)?.type !== this.type) continue;
      visited.add(key);
      component.push({ x: cellX, y: cellY, pixel: world.get(cellX, cellY) });
      pending.push([cellX - 1, cellY], [cellX + 1, cellY], [cellX, cellY - 1], [cellX, cellY + 1]);
    }
    component.leader = component.reduce((best, cell) => (
      cell.y < best.y || (cell.y === best.y && cell.x < best.x) ? cell : best
    ));
    for (const cell of component) world.plantComponents.set(`${cell.x},${cell.y}`, component);
    return component;
  }
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

    const fuels = [];
    for (const [dx, dy] of neighbors) {
      const fuelX = x + dx;
      const fuelY = y + dy;
      const fuel = world.get(fuelX, fuelY);
      if (!fuel?.flammable) continue;
      fuels.push({ fuel, x: fuelX, y: fuelY });
    }

    if (fuels.length === 0) {
      super.update(x, y, world);
      return;
    }

    for (const target of fuels.filter(({ fuel }) => fuel.ignitionMode !== 'focused')) {
      const { fuel } = target;
      if (fuel.lastIgnitionTick !== world.tick) {
        fuel.ignitionTicks++;
        fuel.lastIgnitionTick = world.tick;
      }
      if (fuel.ignitionTicks >= fuel.ignitionDelay) {
        world.set(target.x, target.y, new Fire(fuel.burnRate ?? Fire.lifetime));
      }
    }

    const focusedFuels = fuels.filter(({ fuel }) => fuel.ignitionMode === 'focused');
    if (focusedFuels.length === 0) {
      super.update(x, y, world);
      return;
    }

    const target = focusedFuels[Math.floor(world.random() * focusedFuels.length)];
    const { fuel } = target;
    if (fuel.lastIgnitionTick !== world.tick) {
      fuel.ignitionTicks++;
      fuel.lastIgnitionTick = world.tick;
    }
    if (fuel.ignitionTicks >= fuel.ignitionDelay) {
      world.set(target.x, target.y, new Fire(fuel.burnRate ?? Fire.lifetime));
      return;
    }

    // Keep heating the selected fuel until it catches, rather than igniting a wall at once.
  }
}

/** Every placeable material, keyed by type. New materials must be added here. */
export const MATERIALS = {
  stone: Stone,
  sand: Sand,
  water: Water,
  plant: Plant,
  oil: Oil,
  steam: Steam,
  fire: Fire,
};

export function createPixel(type, ...args) {
  const Material = MATERIALS[type];
  if (!Material) throw new Error(`Unknown material type: ${type}`);
  return new Material(...args);
}
