import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Grid } from '../src/Grid.js';
import { Pixel } from '../src/Pixel.js';

class A extends Pixel { static type = 'a'; }
class B extends Pixel { static type = 'b'; }

test('rejects invalid dimensions', () => {
  assert.throws(() => new Grid(0, 5), RangeError);
  assert.throws(() => new Grid(5, -1), RangeError);
  assert.throws(() => new Grid(2.5, 5), RangeError);
});

test('a new grid is entirely empty', () => {
  const grid = new Grid(5, 5);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) assert.equal(grid.get(x, y), null);
  }
});

test('set then get returns the same pixel', () => {
  const grid = new Grid(5, 5);
  const p = new A();
  grid.set(3, 1, p);
  assert.equal(grid.get(3, 1), p);
  assert.equal(grid.get(1, 3), null);
});

test('out of bounds reads return undefined and writes throw', () => {
  const grid = new Grid(3, 3);
  assert.equal(grid.get(-1, 0), undefined);
  assert.equal(grid.get(0, 3), undefined);
  assert.throws(() => grid.set(3, 0, new A()), RangeError);
});

test('swap exchanges two cells, including empty ones', () => {
  const grid = new Grid(3, 3);
  const p = new A();
  grid.set(0, 0, p);
  grid.swap(0, 0, 2, 2);
  assert.equal(grid.get(0, 0), null);
  assert.equal(grid.get(2, 2), p);
});

test('countByType counts pixels and ignores empty cells', () => {
  const grid = new Grid(4, 4);
  grid.set(0, 0, new A());
  grid.set(1, 0, new A());
  grid.set(3, 3, new B());
  assert.deepEqual(grid.countByType(), { a: 2, b: 1 });
});
