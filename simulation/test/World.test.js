import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/World.js';
import { Pixel } from '../src/Pixel.js';
import { createRandom } from '../src/random.js';

/** Counts its own updates and tries to move up every tick. */
class Riser extends Pixel {
  static type = 'riser';
  static density = 1;
  constructor() { super(); this.updates = 0; }
  update(x, y, world) { this.updates++; world.tryMove(x, y, x, y - 1); }
}

/** Counts its own updates and tries to move down every tick. */
class Faller extends Riser {
  static type = 'faller';
  static density = 5;
  update(x, y, world) { this.updates++; world.tryMove(x, y, x, y + 1); }
}

class Wall extends Pixel {
  static type = 'wall';
  static isStatic = true;
}

test('step advances the tick counter', () => {
  const world = new World(3, 3, { seed: 1 });
  world.step();
  world.step();
  assert.equal(world.tick, 2);
});

test('a pixel moving into an unvisited row is still updated only once per tick', () => {
  const world = new World(1, 5, { seed: 1 });
  const riser = new Riser();
  world.set(0, 4, riser);
  world.step();
  assert.equal(riser.updates, 1);
  assert.equal(world.get(0, 3), riser, 'moved exactly one cell');
});

test('a pixel moving into an already-visited row is updated only once per tick', () => {
  const world = new World(1, 5, { seed: 1 });
  const faller = new Faller();
  world.set(0, 0, faller);
  world.step();
  assert.equal(faller.updates, 1);
  assert.equal(world.get(0, 1), faller);
});

test('every pixel in a full grid is updated exactly once per step', () => {
  const world = new World(4, 4, { seed: 1 });
  const pixels = [];
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const p = (x + y) % 2 ? new Riser() : new Faller();
      pixels.push(p);
      world.set(x, y, p);
    }
  }
  for (let n = 1; n <= 10; n++) {
    world.step();
    for (const p of pixels) assert.equal(p.updates, n);
  }
});

test('tryMove refuses out of bounds targets', () => {
  const world = new World(2, 2, { seed: 1 });
  world.set(0, 1, new Faller());
  assert.equal(world.tryMove(0, 1, 0, 2), false);
});

test('tryMove never moves static pixels or moves into them', () => {
  const world = new World(1, 2, { seed: 1 });
  const wall = new Wall();
  world.set(0, 0, wall);
  assert.equal(world.tryMove(0, 0, 0, 1), false);
  world.set(0, 1, new Faller());
  assert.equal(world.tryMove(0, 1, 0, 0), false);
  assert.equal(world.get(0, 0), wall);
});

test('tryMove swaps a heavier pixel with a lighter one', () => {
  const world = new World(1, 2, { seed: 1 });
  const heavy = new Faller();
  const light = new Riser();
  world.set(0, 0, heavy);
  world.set(0, 1, light);
  assert.equal(world.tryMove(0, 0, 0, 1), true);
  assert.equal(world.get(0, 1), heavy);
  assert.equal(world.get(0, 0), light);
});

test('tryMove upward swaps a lighter pixel with a heavier one', () => {
  const world = new World(1, 2, { seed: 1 });
  const heavy = new Faller();
  const light = new Riser();
  world.set(0, 0, heavy);
  world.set(0, 1, light);
  assert.equal(world.tryMove(0, 1, 0, 0), true);
  assert.equal(world.get(0, 0), light);
  assert.equal(world.get(0, 1), heavy);
});

test('tryMove upward refuses to lift a heavier pixel past a lighter one', () => {
  const world = new World(1, 2, { seed: 1 });
  const heavy = new Faller();
  const light = new Riser();
  world.set(0, 0, light);
  world.set(0, 1, heavy);
  assert.equal(world.tryMove(0, 1, 0, 0), false);
  assert.equal(world.get(0, 0), light);
  assert.equal(world.get(0, 1), heavy);
});

test('tryMove on an empty cell does nothing', () => {
  const world = new World(2, 2, { seed: 1 });
  assert.equal(world.tryMove(0, 0, 1, 0), false);
});

test('random is reproducible for a given seed and stays in [0, 1)', () => {
  const a = createRandom(42);
  const b = createRandom(42);
  for (let i = 0; i < 1000; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});
