import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeParticle, makeVine } from '../src/hover.js';

const PARTICLE_KINDS = { fire: 'flame', water: 'drip', oil: 'oil', steam: 'puff', sand: 'grain' };
const seeded = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('every material with a particle effect has its own kind', () => {
  for (const [type, kind] of Object.entries(PARTICLE_KINDS)) assert.equal(makeParticle(type).kind, kind);
  assert.equal(new Set(Object.values(PARTICLE_KINDS)).size, Object.keys(PARTICLE_KINDS).length);
});

test('stone (a CSS wall), plant (a vine) and unknown materials have no particles', () => {
  for (const type of ['stone', 'plant', 'erase', 'nothing']) assert.equal(makeParticle(type), null);
});

test('particles appear across the name and stay in range', () => {
  for (const random of [() => 0, () => 0.5, () => 0.999999]) {
    for (const type of Object.keys(PARTICLE_KINDS)) {
      const particle = makeParticle(type, random);
      assert.ok(particle.left >= 0 && particle.left <= 100);
      assert.match(particle.color, /^#[0-9a-f]{6}$/i);
      assert.ok(Math.abs(particle.drift) <= 4);
    }
  }
});

test('flames and steam sway sideways; drips, oil and grains fall straight down', () => {
  for (const type of ['fire', 'steam']) assert.notEqual(makeParticle(type, () => 0).drift, 0);
  for (const type of ['water', 'oil', 'sand']) assert.equal(makeParticle(type, () => 0).drift, 0);
});

test('the same random numbers always give the same particle', () => {
  const sequence = () => { const values = [0.2, 0.7, 0.4]; let i = 0; return () => values[i++ % values.length]; };
  for (const type of Object.keys(PARTICLE_KINDS)) assert.deepEqual(makeParticle(type, sequence()), makeParticle(type, sequence()));
});

test('a vine is one stem along the bottom of the name that starts first', () => {
  const vine = makeVine(40, 15, seeded(1));
  assert.match(vine.stem.d, /^M0\.0 \d/);
  assert.equal(vine.stem.delay, 0);
  assert.equal(vine.height, 15 + 14); // room for twigs above and below the name
});

test('twigs branch off the stem, each starting as the stem reaches it', () => {
  const { stem, twigs } = makeVine(40, 15, seeded(2));
  assert.ok(twigs.length >= 3);
  for (let i = 0; i < twigs.length; i++) {
    assert.ok(twigs[i].delay >= 0 && twigs[i].delay < stem.dur);
    if (i > 0) assert.ok(twigs[i].delay > twigs[i - 1].delay);
  }
});

test('every twig ends in a leaf that opens after the twig starts, inside the drawing', () => {
  const vine = makeVine(40, 15, seeded(3));
  assert.equal(vine.leaves.length, vine.twigs.length);
  vine.leaves.forEach((leaf, i) => {
    assert.ok(leaf.delay > vine.twigs[i].delay);
    assert.ok(leaf.x >= 0 && leaf.x <= 40 + 10);
    assert.ok(leaf.y >= 0 && leaf.y <= vine.height);
  });
});

test('twigs lean alternately left and right, and a longer name grows more twigs', () => {
  const vine = makeVine(40, 15, seeded(4));
  const roots = vine.twigs.map((twig) => Number(twig.d.match(/^M(\d+\.\d)/)[1]));
  const tips = vine.leaves.map((leaf) => leaf.x);
  const leans = tips.map((tip, i) => Math.sign(tip - roots[i]));
  assert.ok(leans.every((lean, i) => i === 0 || lean !== leans[i - 1]));
  assert.ok(makeVine(80, 15, seeded(4)).twigs.length > vine.twigs.length);
});

test('the same random numbers always grow the same vine', () => {
  assert.deepEqual(makeVine(40, 15, seeded(5)), makeVine(40, 15, seeded(5)));
});
