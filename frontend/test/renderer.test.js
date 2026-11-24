import assert from 'node:assert/strict';
import { test } from 'node:test';
import { World } from '../../simulation/src/World.js';
import { createPixel } from '../../simulation/src/materials/index.js';
import {
  createRenderer, fireColor, gradient, sandColor, stoneColor, vineColor, waterColor,
} from '../src/renderer.js';

const newWorld = () => new World(10, 10, { seed: 1 });
const fill = (world, type, cells) => cells.forEach(([x, y]) => world.set(x, y, createPixel(type)));
const brightness = ([r, g, b]) => r + g + b;

test('gradient returns the end stops and blends between them', () => {
  const stops = [[0, 0, 0], [200, 100, 50]];
  assert.deepEqual(gradient(stops, 0), [0, 0, 0]);
  assert.deepEqual(gradient(stops, 1), [200, 100, 50]);
  assert.deepEqual(gradient(stops, 0.5), [100, 50, 25]);
  assert.deepEqual(gradient(stops, 7), [200, 100, 50]);
});

test('fire is yellow at the base of a flame and red at a lone tip', () => {
  const world = newWorld();
  fill(world, 'plant', [[2, 9]]);
  fill(world, 'fire', [[2, 8], [2, 7], [2, 6], [2, 5], [6, 2]]);
  const base = fireColor(world, 2, 8, world.get(2, 8), 0.5);
  const tip = fireColor(world, 6, 2, world.get(6, 2), 0.5);
  assert.ok(base[1] > tip[1], 'the base has more green, so it reads yellow');
  assert.ok(brightness(base) > brightness(tip));
});

test('fire cools as it burns out', () => {
  const world = newWorld();
  fill(world, 'fire', [[4, 4]]);
  const fire = world.get(4, 4);
  const fresh = fireColor(world, 4, 4, fire, 0.5);
  fire.age = fire.lifetime - 1;
  assert.ok(brightness(fireColor(world, 4, 4, fire, 0.5)) < brightness(fresh));
});

test('wide vines get a dark outline and leaves only grow on the edges', () => {
  const world = newWorld();
  fill(world, 'plant', [3, 4, 5, 6, 7].flatMap((x) => [[x, 4], [x, 5], [x, 6]]));
  const outline = vineColor(world, 3, 5, 0.9);
  const middle = vineColor(world, 5, 5, 0.9);
  assert.ok(brightness(outline) < brightness(middle));
  assert.notDeepEqual(vineColor(world, 3, 5, 0.05), outline, 'a low seed on an edge is a leaf');
  assert.deepEqual(vineColor(world, 5, 5, 0.05), middle, 'no leaves inside the stem');
});

test('a thin vine keeps its strand colors instead of an outline', () => {
  const world = newWorld();
  fill(world, 'plant', [[4, 2], [4, 3], [4, 4], [4, 5]]);
  const colors = new Set([3, 4, 5].map((y) => vineColor(world, 4, y, 0.9).join()));
  assert.ok(colors.size > 1, 'the bands change down the vine');
});

test('water is brightest at the surface and darkens with depth', () => {
  const world = newWorld();
  fill(world, 'water', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((y) => [4, y]));
  const surface = waterColor(world, 4, 0, 0);
  // Compare the average over several frames so the passing wave streaks don't decide the result.
  const average = (y) => [0, 40, 80, 120].reduce((sum, f) => sum + brightness(waterColor(world, 4, y, f)), 0) / 4;
  assert.ok(brightness(surface) > average(2));
  assert.ok(average(2) > average(9));
  assert.ok(surface[2] > surface[0], 'water stays blue');
});

test('stone is cobbles: a fixed pattern of dark mortar and several stone shades', () => {
  const colors = [];
  for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) colors.push(stoneColor(x, y).join());
  const counts = colors.reduce((map, c) => map.set(c, (map.get(c) ?? 0) + 1), new Map());
  const darkest = [...counts.keys()].sort((a, b) => brightness(a.split(',').map(Number)) - brightness(b.split(',').map(Number)))[0];
  assert.ok(counts.size >= 4, 'mortar plus at least three stone shades');
  assert.ok(counts.get(darkest) > 60 && counts.get(darkest) < 450, 'mortar lines, not a solid fill');
  assert.deepEqual(stoneColor(17, 23), stoneColor(17, 23), 'the same cell always gets the same color');
});

test('sand has ripples, light grains and turns dark where it is wet', () => {
  const world = newWorld();
  const shades = new Set();
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) shades.add(sandColor(world, x, y, 0.5).join());
  assert.ok(shades.size >= 2, 'ripples show up among the plain sand');
  assert.notDeepEqual(sandColor(world, 3, 3, 0.05), sandColor(world, 3, 3, 0.5), 'a low seed is a light grain');
  fill(world, 'water', [[3, 2]]);
  const wet = sandColor(world, 3, 3, 0.5);
  assert.ok(brightness(wet) < brightness(sandColor(world, 6, 6, 0.5)), 'sand under water is darker');
});

test('a sand grain keeps its color while it falls', () => {
  const world = newWorld();
  const data = new Uint8ClampedArray(10 * 10 * 4);
  const draw = createRenderer({ createImageData: () => ({ data }), putImageData() {} }, 10, 10, () => 0.5);
  const at = (x, y) => [...data.slice((y * 10 + x) * 4, (y * 10 + x) * 4 + 3)];
  // Pick a column where the ripple pattern differs between the top and bottom, so a change would show.
  const x = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].find((c) => sandColor(world, c, 0, 0.5).join() !== sandColor(world, c, 9, 0.5).join());
  assert.ok(x !== undefined);
  world.set(x, 0, createPixel('sand'));
  draw(world);
  const before = at(x, 0);
  for (let i = 0; i < 20; i++) world.step();
  assert.equal(world.get(x, 9)?.type, 'sand', 'the grain reached the floor');
  draw(world);
  assert.deepEqual(at(x, 9), before);
});

test('nothing moves on screen while the simulation is paused', () => {
  const world = newWorld();
  fill(world, 'water', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((x) => [[x, 6], [x, 7], [x, 8], [x, 9]]));
  fill(world, 'fire', [[5, 2]]);
  const data = new Uint8ClampedArray(10 * 10 * 4);
  const draw = createRenderer({ createImageData: () => ({ data }), putImageData() {} }, 10, 10, () => 0.5);
  draw(world);
  const first = [...data];
  for (let i = 0; i < 30; i++) draw(world); // frames drawn with no world.step() in between
  assert.deepEqual([...data], first);
});

test('the renderer paints fire, vines and the glow around fire', () => {
  const world = newWorld();
  fill(world, 'fire', [[5, 5]]);
  fill(world, 'plant', [[1, 1]]);
  const data = new Uint8ClampedArray(10 * 10 * 4);
  const ctx = { createImageData: () => ({ data }), putImageData() {} };
  createRenderer(ctx, 10, 10, () => 0.5)(world);
  const at = (x, y) => [...data.slice((y * 10 + x) * 4, (y * 10 + x) * 4 + 3)];
  assert.ok(at(5, 5)[0] > 150, 'fire is bright');
  assert.ok(at(1, 1)[1] > at(1, 1)[0], 'the vine is green');
  assert.ok(brightness(at(5, 6)) > brightness(at(9, 9)), 'cells next to fire glow');
});
