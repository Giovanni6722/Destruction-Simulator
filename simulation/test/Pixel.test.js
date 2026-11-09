import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pixel } from '../src/Pixel.js';

class Heavy extends Pixel {
  static type = 'heavy';
  static density = 10;
}

class Light extends Pixel {
  static type = 'light';
  static density = 1;
}

class Wall extends Pixel {
  static type = 'wall';
  static density = 0;
  static isStatic = true;
}

test('a new pixel has not been updated yet', () => {
  assert.equal(new Pixel().lastUpdatedTick, -1);
});

test('instance getters read the subclass static properties', () => {
  const h = new Heavy();
  assert.equal(h.type, 'heavy');
  assert.equal(h.density, 10);
  assert.equal(h.isStatic, false);
  assert.equal(new Wall().isStatic, true);
});

test('any pixel can move into an empty cell', () => {
  assert.equal(new Light().canDisplace(null), true);
});

test('heavier pixels displace lighter ones, not the reverse', () => {
  assert.equal(new Heavy().canDisplace(new Light()), true);
  assert.equal(new Light().canDisplace(new Heavy()), false);
});

test('equal density pixels do not displace each other', () => {
  assert.equal(new Heavy().canDisplace(new Heavy()), false);
});

test('static pixels are never displaced, regardless of density', () => {
  assert.equal(new Heavy().canDisplace(new Wall()), false);
});

test('when rising, lighter pixels displace heavier ones, not the reverse', () => {
  assert.equal(new Light().canDisplace(new Heavy(), true), true);
  assert.equal(new Heavy().canDisplace(new Light(), true), false);
});

test('when rising, equal density and static pixels are not displaced', () => {
  assert.equal(new Light().canDisplace(new Light(), true), false);
  assert.equal(new Light().canDisplace(new Wall(), true), false);
});

test('when rising, any pixel can move into an empty cell', () => {
  assert.equal(new Heavy().canDisplace(null, true), true);
});

test('default update does nothing', () => {
  assert.doesNotThrow(() => new Pixel().update(0, 0, null));
});

test('per-instance state is independent between pixels', () => {
  const a = new Heavy();
  const b = new Heavy();
  a.lastUpdatedTick = 5;
  assert.equal(b.lastUpdatedTick, -1);
});
