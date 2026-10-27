import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, createPixel, Sand, Stone, Steam, Water } from '../src/materials/index.js';
import { createRandom } from '../src/random.js';
import { worldFromRows, rowsFromWorld, stepN } from './helpers.js';

// --- Registry ---

test('every material has a unique type and symbol', () => {
  const list = Object.values(MATERIALS);
  assert.equal(new Set(list.map((M) => M.type)).size, list.length);
  assert.equal(new Set(list.map((M) => M.symbol)).size, list.length);
  for (const [key, M] of Object.entries(MATERIALS)) assert.equal(key, M.type);
});

test('createPixel builds materials by type and rejects unknown ones', () => {
  assert.ok(createPixel('sand') instanceof Sand);
  assert.ok(createPixel('stone') instanceof Stone);
  assert.ok(createPixel('water') instanceof Water);
  assert.ok(createPixel('steam') instanceof Steam);
  assert.throws(() => createPixel('unobtainium'));
});

// --- Hand-computed grids ---

test('sand falls one cell per tick', () => {
  const world = worldFromRows(['.s.', '...', '...']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['...', '.s.', '...']);
});

test('sand comes to rest on a stone floor', () => {
  const world = worldFromRows(['.s.', '...', '...', '###']);
  stepN(world, 10);
  assert.deepEqual(rowsFromWorld(world), ['...', '...', '.s.', '###']);
});

test('sand slides diagonally off a ledge', () => {
  const world = worldFromRows(['s..', '#..', '##.', '###']);
  stepN(world, 10);
  assert.deepEqual(rowsFromWorld(world), ['...', '#..', '##s', '###']);
});

test('a column of sand spreads into a row', () => {
  const world = worldFromRows(['..s..', '..s..', '..s..', '.....', '#####']);
  stepN(world, 20);
  assert.deepEqual(rowsFromWorld(world), ['.....', '.....', '.....', '.sss.', '#####']);
});

test('sand cannot fall through stone', () => {
  const world = worldFromRows(['s', '#', '.']);
  stepN(world, 5);
  assert.deepEqual(rowsFromWorld(world), ['s', '#', '.']);
});

test('water falls and spreads across a floor', () => {
  const world = worldFromRows(['..w..', '..w..', '..w..', '.....', '#####']);
  stepN(world, 30);
  assert.deepEqual(rowsFromWorld(world), ['.....', '.....', '.....', '.www.', '#####']);
});

test('sand displaces water', () => {
  const world = worldFromRows(['s', 'w']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['w', 's']);
});

test('steam rises', () => {
  const world = worldFromRows(['...', '.v.', '...']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['.v.', '...', '...']);
});

test('steam bubbles up through water', () => {
  const world = worldFromRows(['w', 'v']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['v', 'w']);
});

test('steam escapes from under a column of water', () => {
  const world = worldFromRows(['.', 'w', 'w', 'v']);
  stepN(world, 10);
  assert.deepEqual(rowsFromWorld(world), ['v', '.', 'w', 'w']);
});

test('steam cannot rise through stone', () => {
  const world = worldFromRows(['.', '#', 'v']);
  stepN(world, 5);
  assert.deepEqual(rowsFromWorld(world), ['.', '#', 'v']);
});

test('water displaced by rising steam still updates that tick', () => {
  const world = worldFromRows(['w', 'v']);
  const water = world.get(0, 0);
  world.step();
  assert.equal(water.lastUpdatedTick, world.tick);
});

test('steam dissipates after its lifetime', () => {
  const world = worldFromRows(['v']);
  stepN(world, Steam.lifetime);
  assert.deepEqual(rowsFromWorld(world), ['.']);
});

test('gas instances use the lifetime defined by their material', () => {
  assert.equal(createPixel('steam').lifetime, Steam.lifetime);
});

test('gas lifetime can be configured for each created material', () => {
  const shortWorld = worldFromRows(['.']);
  shortWorld.set(0, 0, createPixel('steam', 1));
  shortWorld.step();
  assert.equal(shortWorld.get(0, 0), null);

  const longWorld = worldFromRows(['.']);
  longWorld.set(0, 0, createPixel('steam', 3));
  longWorld.step();
  assert.ok(longWorld.get(0, 0) instanceof Steam);
  longWorld.step();
  assert.ok(longWorld.get(0, 0) instanceof Steam);
  longWorld.step();
  assert.equal(longWorld.get(0, 0), null);
});

test('gas lifetime must be a non-negative integer', () => {
  assert.throws(() => createPixel('steam', -1), RangeError);
  assert.throws(() => createPixel('steam', 1.5), RangeError);
});

// --- Properties that must always hold ---

function randomWorldRows(width, height, seed) {
  const random = createRandom(seed);
  const rows = [];
  for (let y = 0; y < height; y++) {
    let row = '';
    for (let x = 0; x < width; x++) {
      const r = random();
      row += r < 0.15 ? '#' : r < 0.5 ? 's' : '.';
    }
    rows.push(row);
  }
  return rows;
}

function stonePositions(world) {
  const positions = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.get(x, y)?.type === 'stone') positions.push(`${x},${y}`);
    }
  }
  return positions;
}

for (const seed of [1, 2, 3]) {
  test(`pixel counts are conserved every tick (seed ${seed})`, () => {
    const world = worldFromRows(randomWorldRows(20, 20, seed), seed);
    const initial = world.grid.countByType();
    for (let i = 0; i < 100; i++) {
      world.step();
      assert.deepEqual(world.grid.countByType(), initial, `tick ${world.tick}`);
    }
  });

  test(`stone never moves (seed ${seed})`, () => {
    const world = worldFromRows(randomWorldRows(20, 20, seed), seed);
    const initial = stonePositions(world);
    for (let i = 0; i < 100; i++) {
      world.step();
      assert.deepEqual(stonePositions(world), initial, `tick ${world.tick}`);
    }
  });

  test(`sand eventually settles with nothing empty below it (seed ${seed})`, () => {
    const world = worldFromRows(randomWorldRows(20, 20, seed), seed);
    stepN(world, 100);
    const settled = rowsFromWorld(world);
    world.step();
    assert.deepEqual(rowsFromWorld(world), settled, 'grid still changing');
    for (let y = 0; y < world.height - 1; y++) {
      for (let x = 0; x < world.width; x++) {
        if (world.get(x, y)?.type === 'sand') assert.notEqual(world.get(x, y + 1), null, `(${x}, ${y})`);
      }
    }
  });
}
