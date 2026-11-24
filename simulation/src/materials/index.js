import { Solid, Powder, Liquid, Gas, Fire as FireCategory } from './categories.js';
import { Pixel } from '../Pixel.js';

export class Stone extends Solid {
  static type = 'stone';
  static symbol = '#';
  static color = '#7a7a7a';
  static density = 100;
}

export class Wood extends Solid {
  static type = 'wood';
  static symbol = 'd';
  static color = '#8b5a2b';
  static density = 100;
  static flammable = true;
  static ignitionDelay = 8;
  static ignitionMode = 'focused';
  static ignitionDirection = 'down';
  static burnRate = 80;
  static flameLifetime = 12;
  static flameChance = 0.55;
  static flameBursts = 2;
  static flameBurstInterval = 4;

  constructor() {
    super();
    this.flameBurstCooldown = 0;
  }
}

export class Metal extends Solid {
  static type = 'metal';
  static symbol = 'm';
  static color = '#a3a3a3';
  static density = 100;
  static maxHeatLevel = 3;
  static rustThreshold = 60;
  static directHeatTicks = 4;
  static spreadHeatTicks = 8;
  static naturalCoolTicks = 60;
  static waterCoolTicks = 24;
  static boilTicks = 8;

  constructor() {
    super();
    this.heatLevel = 0;
    this.rustTicks = 0;
    this.heatTicks = 0;
    this.coolTicks = 0;
    this.heatSourceDistance = 0;
    this.heatSourceTick = -1;
    this.boilTicks = 0;
  }

  get color() {
    if (this.heatLevel >= 3) return '#ff1a1a';
    if (this.heatLevel === 2) return '#ef5a32';
    if (this.heatLevel === 1) return '#c97a45';
    if (this.rustTicks >= Metal.rustThreshold * 3) return '#7a3f20';
    if (this.rustTicks >= Metal.rustThreshold * 2) return '#955a32';
    if (this.rustTicks >= Metal.rustThreshold) return '#ad7a52';
    return this._color;
  }

  get isHot() { return this.heatLevel >= Metal.maxHeatLevel; }

  heat(amount = 1) {
    this.heatLevel = Math.min(Metal.maxHeatLevel, this.heatLevel + amount);
  }

  cool(amount = 1) {
    this.heatLevel = Math.max(0, this.heatLevel - amount);
    this.heatTicks = 0;
    if (this.heatLevel === 0) {
      this.heatSourceDistance = 0;
      this.heatSourceTick = -1;
    }
  }

  receiveHeat(world, amount = 1, heatSourceDistance = 1) {
    if (this.heatLevel >= Metal.maxHeatLevel) {
      this.heatSourceDistance = heatSourceDistance;
      this.heatSourceTick = world.tick;
      return;
    }
    this.heatTicks += amount;
    if (this.heatTicks < Metal.directHeatTicks) return;
    this.heat();
    this.heatSourceDistance = heatSourceDistance;
    this.heatSourceTick = world.tick;
    this.heatTicks = 0;
  }

  update(x, y, world) {
    const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let inWater = false;
    let hasHeatSource = false;

    for (const [dx, dy] of neighbors) {
      if (world.get(x + dx, y + dy)?.type === 'water') {
        inWater = true;
        break;
      }
    }

    if (inWater) {
      for (const [dx, dy] of neighbors) {
        const neighbor = world.get(x + dx, y + dy);
        if (neighbor?.type === 'fire') {
          hasHeatSource = true;
          this.receiveHeat(world);
          break;
        }
      }

      if (!hasHeatSource) {
        this.coolTicks++;
        if (this.coolTicks >= Metal.waterCoolTicks) {
          this.cool(1);
          this.coolTicks = 0;
          this.heatTicks = 0;
        }
      } else {
        this.coolTicks = 0;
      }
      this.rustTicks++;

      if (this.heatLevel >= 2) {
        this.boilTicks++;
        if (this.boilTicks >= Metal.boilTicks) {
          const waterNeighbors = neighbors
            .map(([dx, dy]) => ({ x: x + dx, y: y + dy }))
            .filter(({ x: waterX, y: waterY }) => world.get(waterX, waterY)?.type === 'water');
          if (waterNeighbors.length > 0) {
            const target = waterNeighbors[Math.floor(world.random() * waterNeighbors.length)];
            world.set(target.x, target.y, new Steam());
          }
          this.boilTicks = 0;
        }
      } else {
        this.boilTicks = 0;
      }
    } else {
      for (const [dx, dy] of neighbors) {
        const neighbor = world.get(x + dx, y + dy);
        if (neighbor?.type === 'fire') {
          hasHeatSource = true;
          this.receiveHeat(world);
          break;
        }
      }
    }

    const activeDistance = world.metalHeatSnapshot?.get(`${x},${y}`)?.activeHeatDistance ?? 0;
    if (!inWater && activeDistance > 0) hasHeatSource = true;

    if (this.heatLevel < Metal.maxHeatLevel) {
      for (const [dx, dy] of neighbors) {
        const neighbor = world.get(x + dx, y + dy);
        if (neighbor?.type !== 'metal') continue;
        const neighborSnapshot = world.metalHeatSnapshot?.get(`${x + dx},${y + dy}`);
        const snapshotLevel = neighborSnapshot?.heatLevel ?? neighbor.heatLevel;
        const neighborDistance = neighborSnapshot?.activeHeatDistance ?? 0;
        const selfDistance = activeDistance;
        if (snapshotLevel <= this.heatLevel) continue;
        if (neighborDistance === 0) continue;
        if (neighborDistance >= selfDistance) continue;
        this.heatTicks++;
        if (this.heatTicks >= Metal.spreadHeatTicks) {
          this.heat();
          this.heatSourceDistance = neighborDistance === 0 ? 0 : neighborDistance + 1;
          this.heatSourceTick = world.tick;
          hasHeatSource = true;
          this.heatTicks = 0;
        }
        break;
      }
    }

    if (!inWater && this.heatLevel > 0 && hasHeatSource) {
      this.coolTicks = 0;
    } else if (!inWater && this.heatLevel > 0) {
      this.coolTicks++;
      const coolingDepth = world.metalHeatSnapshot?.get(`${x},${y}`)?.coolingDepth ?? 1;
      const coolingDelay = Metal.naturalCoolTicks * coolingDepth;
      if (this.coolTicks >= coolingDelay) {
        this.cool();
        this.coolTicks = 0;
      }
    }

    if (!this.isHot) return;

    for (const [dx, dy] of neighbors) {
      const target = world.get(x + dx, y + dy);
      if (!target?.flammable || target.type === 'metal') continue;
      if (target.lastIgnitionTick !== world.tick) {
        target.ignitionTicks++;
        target.lastIgnitionTick = world.tick;
      }
      if (target.ignitionTicks >= target.ignitionDelay) {
        world.set(x + dx, y + dy, new Fire(target.burnRate ?? Fire.lifetime));
      }
    }
  }
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

  constructor(lifetime, source = null) {
    super(lifetime);
    this.source = source;
  }

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

    for (const target of fuels) {
      const { fuel } = target;
      if (fuel.type !== 'wood') continue;
      const flameLifetime = fuel.constructor.flameLifetime;
      const flameChance = fuel.constructor.flameChance;
      if (fuel.flameBurstCooldown > 0) {
        fuel.flameBurstCooldown--;
        continue;
      }
      if (world.random() >= flameChance) continue;

      const emptyNeighbors = neighbors
        .map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy }))
        .filter(({ x: flameX, y: flameY }) => world.isEmpty(flameX, flameY));
      if (emptyNeighbors.length === 0) continue;

      const flameCell = emptyNeighbors[Math.floor(world.random() * emptyNeighbors.length)];
      world.set(flameCell.x, flameCell.y, new Fire(flameLifetime, 'wood'));
      fuel.flameBurstCooldown = fuel.constructor.flameBurstInterval;
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

    let candidates = focusedFuels;
    const directionalFuels = focusedFuels.filter(({ fuel }) => fuel.ignitionDirection === 'down');
    if (directionalFuels.length > 0) {
      const below = directionalFuels.filter(({ y: fuelY }) => fuelY === y + 1);
      const sideways = directionalFuels.filter(({ y: fuelY }) => fuelY === y);
      candidates = below.length > 0 ? below : (sideways.length > 0 ? sideways : directionalFuels);
    }
    const target = candidates[Math.floor(world.random() * candidates.length)];
    const { fuel } = target;
    if (fuel.lastIgnitionTick !== world.tick) {
      fuel.ignitionTicks++;
      fuel.lastIgnitionTick = world.tick;
    }
    if (fuel.ignitionTicks >= fuel.ignitionDelay) {
      world.set(target.x, target.y, new Fire(fuel.burnRate ?? Fire.lifetime));
      return;
    }

    // Keep heating focused fuel, while short-lived flames produced by wood can still rise.
    if (this.source === 'wood') super.update(x, y, world);
  }
}

/** Every placeable material, keyed by type. New materials must be added here. */
export const MATERIALS = {
  stone: Stone,
  wood: Wood,
  metal: Metal,
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
