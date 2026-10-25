import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, createPixel, Sand, Stone } from '../src/materials/index.js';
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
