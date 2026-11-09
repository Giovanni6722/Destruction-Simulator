import assert from 'node:assert/strict';
import { test } from 'node:test';
import { World } from '../../simulation/src/World.js';
import { createPixel } from '../../simulation/src/materials/index.js';
import { ERASE, brushOffsets, lineCells, paintAt, paintLine } from '../src/brush.js';

const newWorld = () => new World(10, 10, { seed: 1 });
const count = (world) => world.grid.cells.filter(Boolean).length;

test('size 1 is a single cell and every size is bigger and symmetric', () => {
  assert.deepEqual(brushOffsets(1), [[0, 0]]);
  let previous = 0;
  for (const size of [1, 2, 3, 4, 5]) {
    const offsets = brushOffsets(size);
    assert.ok(offsets.length > previous);
    previous = offsets.length;
    const keys = new Set(offsets.map(([dx, dy]) => `${dx},${dy}`));
    assert.ok(offsets.every(([dx, dy]) => keys.has(`${-dx},${dy}`) && keys.has(`${dx},${-dy}`)));
  }
});

test('lineCells includes both ends and never leaves a gap', () => {
  assert.deepEqual(lineCells(3, 3, 3, 3), [[3, 3]]);
  assert.deepEqual(lineCells(0, 0, 3, 3), [[0, 0], [1, 1], [2, 2], [3, 3]]);
  const cells = lineCells(9, 5, 2, 1);
  assert.deepEqual(cells[0], [9, 5]);
  assert.deepEqual(cells.at(-1), [2, 1]);
  for (let i = 1; i < cells.length; i++) {
    assert.equal(Math.max(Math.abs(cells[i][0] - cells[i - 1][0]), Math.abs(cells[i][1] - cells[i - 1][1])), 1);
  }
});

test('paintAt fills empty cells but never overwrites a pixel', () => {
  const world = newWorld();
  world.set(5, 5, createPixel('stone'));
  paintAt(world, 5, 5, 'sand', 1);
  assert.equal(world.get(5, 5).type, 'stone');
  paintAt(world, 6, 5, 'sand', 1);
  assert.equal(world.get(6, 5).type, 'sand');
});

test('ERASE clears any pixel', () => {
  const world = newWorld();
  world.set(5, 5, createPixel('stone'));
  world.set(5, 6, createPixel('sand'));
  paintAt(world, 5, 5, ERASE, 2);
  assert.equal(count(world), 0);
});

test('painting at the edge skips cells off the grid', () => {
  const world = newWorld();
  paintAt(world, 0, 0, 'sand', 3);
  assert.ok(count(world) > 0);
});

test('paintLine fills the whole line, and painted sand falls without losing any', () => {
  const world = newWorld();
  paintLine(world, [0, 9], [9, 9], 'stone', 1);
  paintLine(world, [2, 0], [7, 0], 'sand', 1);
  assert.equal(count(world), 16);
  for (let i = 0; i < 30; i++) world.step();
  assert.equal(count(world), 16);
  assert.equal(world.get(4, 0), null);
});
