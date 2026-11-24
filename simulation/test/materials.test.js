import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIALS, createPixel, Fire, Metal, Oil, Plant, Sand, Stone, Steam, Water, Wood } from '../src/materials/index.js';
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
  assert.ok(createPixel('wood') instanceof Wood);
  assert.ok(createPixel('metal') instanceof Metal);
  assert.ok(createPixel('water') instanceof Water);
  assert.ok(createPixel('oil') instanceof Oil);
  assert.ok(createPixel('steam') instanceof Steam);
  assert.ok(createPixel('fire') instanceof Fire);
  assert.throws(() => createPixel('unobtainium'));
});

test('material pixels mostly use their base color with occasional variation', () => {
  const pixels = Array.from({ length: 100 }, () => createPixel('water'));
  const varied = pixels.filter((pixel) => pixel.color !== Water.color);

  assert.ok(varied.length > 0);
  assert.ok(varied.length < pixels.length / 2);
  for (const pixel of varied) assert.match(pixel.color, /^#[0-9a-f]{6}$/);
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

test('oil floats on water', () => {
  const world = worldFromRows(['w', 'o', '#']);
  world.step();
  assert.equal(world.get(0, 0)?.type, 'oil');
  assert.equal(world.get(0, 1)?.type, 'water');
  assert.ok(Oil.density < Water.density);
});

test('sand displaces water', () => {
  const world = worldFromRows(['s', 'w']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['w', 's']);
});

test('plant consumes the water that causes it to grow', () => {
  const world = worldFromRows(['#####', '#.#.#', '#.#.#', '#pw##', '#####']);
  world.set(1, 3, createPixel('plant', { growthDirection: [0, -1] }));
  world.random = () => 0;
  world.step();
  assert.equal(world.get(1, 2)?.type, 'plant');
  assert.equal(world.get(2, 3), null);
  assert.equal(new Plant().flammable, true);
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

test('fire rises', () => {
  const world = worldFromRows(['...', '.f.', '...']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['.f.', '...', '...']);
});

test('fire turns water into steam and is extinguished', () => {
  const world = worldFromRows(['f', 'w', '#']);
  world.step();
  assert.deepEqual(rowsFromWorld(world), ['.', 'v', '#']);
  assert.ok(world.get(0, 1) instanceof Steam);
});

test('fire stays beside a plant until it ignites it downward', () => {
  const world = worldFromRows(['###', '#f#', '#p#', '###']);
  stepN(world, Plant.ignitionDelay);
  assert.ok(world.get(1, 2) instanceof Fire);
});

test('a fire heats only one adjacent plant at a time', () => {
  const world = worldFromRows(['#####', '#p#p#', '#pfp#', '#####']);
  world.random = () => 0;
  world.step();
  assert.equal(world.get(3, 2).ignitionTicks, 1);
  assert.equal(world.get(1, 2).ignitionTicks, 0);
});

test('oil burns after accumulating its configured fire-contact time', () => {
  const world = worldFromRows(['####', '#of#', '####']);
  world.random = () => 0.99;
  stepN(world, Oil.ignitionDelay - 1);
  assert.ok(world.get(1, 1) instanceof Oil);
  stepN(world, 1);
  assert.ok(world.get(1, 1) instanceof Fire);
  assert.equal(new Oil().flammable, true);
});

test('gaps in fire contact do not erase oil ignition progress', () => {
  const world = worldFromRows(['####', '#of#', '####']);
  world.step();
  assert.ok(world.get(1, 1) instanceof Oil);

  world.set(2, 1, new Stone());
  world.step();
  assert.ok(world.get(1, 1) instanceof Oil);

  world.set(2, 1, new Fire());
  world.step();
  assert.ok(world.get(1, 1) instanceof Fire);
});

test('oil has a deterministic ignition delay', () => {
  assert.equal(Oil.ignitionDelay, 2);
  assert.equal(new Oil().flammable, true);
});

test('wood is solid and burns slower than plant and oil', () => {
  const wood = new Wood();
  assert.equal(wood.isStatic, true);
  assert.equal(wood.flammable, true);
  assert.ok(Wood.ignitionDelay > Plant.ignitionDelay);
  assert.ok(Wood.ignitionDelay > Oil.ignitionDelay);
  assert.ok(Wood.burnRate > Plant.burnRate);
  assert.ok(Wood.burnRate > Fire.lifetime);
});

test('fire spreads downward through wood from the top', () => {
  const world = worldFromRows(['###', '#f#', '#d#', '#d#', '###']);
  world.random = () => 0;
  stepN(world, Wood.ignitionDelay);
  assert.ok(world.get(1, 2) instanceof Fire);
});

test('burning wood produces additional short-lived fire', () => {
  const world = worldFromRows(['.....', '#fd.#', '.....']);
  world.random = () => 0;
  world.step();

  const flames = [];
  for (let y = 0; y < world.height; y++) {
    for (let x = 0; x < world.width; x++) {
      if (world.get(x, y) instanceof Fire) flames.push(world.get(x, y));
    }
  }
  assert.ok(flames.some((flame) => flame.lifetime === Wood.flameLifetime));

  const emitted = world.get(3, 1);
  assert.equal(emitted?.source, 'wood');
  world.step();
  assert.equal(world.get(3, 0)?.type, 'fire');
});

test('metal is solid and progresses through heat stages near fire', () => {
  const metal = new Metal();
  assert.equal(metal.isStatic, true);
  assert.equal(metal.heatLevel, 0);
  assert.equal(metal.color, Metal.color);

  metal.heat();
  assert.equal(metal.heatLevel, 1);
  assert.equal(metal.color, '#c97a45');
  metal.heat();
  assert.equal(metal.heatLevel, 2);
  assert.equal(metal.color, '#ef5a32');
  metal.heat();
  assert.equal(metal.heatLevel, 3);
  assert.equal(metal.color, '#ff1a1a');
});

test('fire heats metal and heat spreads to adjacent metal', () => {
  const world = worldFromRows(['f', 'm', 'm']);
  stepN(world, Metal.directHeatTicks);
  assert.equal(world.get(0, 1).heatLevel, 1);

  stepN(world, Metal.spreadHeatTicks);
  assert.equal(world.get(0, 2).heatLevel, 1);
});

test('metal cools naturally when it is no longer heated', () => {
  const metal = new Metal();
  metal.heat(Metal.maxHeatLevel);
  const world = worldFromRows(['m']);
  const worldMetal = world.get(0, 0);
  worldMetal.heat(Metal.maxHeatLevel);

  stepN(world, Metal.naturalCoolTicks);
  assert.equal(worldMetal.heatLevel, 2);

  stepN(world, Metal.naturalCoolTicks);
  assert.equal(worldMetal.heatLevel, 1);

  stepN(world, Metal.naturalCoolTicks);
  assert.equal(worldMetal.heatLevel, 0);
});

test('metal block stops reheating after its fire source is removed', () => {
  const world = worldFromRows(['f', 'm']);
  stepN(world, 40);
  assert.equal(world.get(0, 1).heatLevel, 3);

  world.set(0, 0, null);
  stepN(world, Metal.naturalCoolTicks * 6);
  assert.equal(world.get(0, 1).heatLevel, 0);
});

test('holding fire against metal prevents natural cooling waves', () => {
  const world = worldFromRows([
    'm',
    'f',
  ]);
  stepN(world, 40);
  const metal = world.get(0, 0);
  assert.equal(metal.heatLevel, 3);

  for (let i = 0; i < Metal.naturalCoolTicks * 3; i++) {
    if (world.get(0, 1)?.type !== 'fire') world.set(0, 1, new Fire());
    world.step();
  }
  assert.equal(metal.heatLevel, 3);
  assert.equal(metal.coolTicks, 0);
});

test('sustained fire can heat an entire larger metal block', () => {
  const world = worldFromRows([
    'mmm',
    'mmm',
    'fff',
  ]);

  for (let i = 0; i < 30; i++) {
    for (let x = 0; x < world.width; x++) {
      if (world.get(x, 2)?.type !== 'fire') world.set(x, 2, new Fire());
    }
    world.step();
  }

  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < world.width; x++) {
      assert.ok(world.get(x, y).heatLevel > 0);
    }
  }
});

test('metal object cools from its outside inward', () => {
  const world = worldFromRows([
    'mmm',
    'mmm',
    'mmm',
  ]);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) {
      world.get(x, y).heat(Metal.maxHeatLevel);
    }
  }

  stepN(world, Metal.naturalCoolTicks * 4);
  const outside = world.get(0, 0);
  const center = world.get(1, 1);
  assert.ok(outside.heatLevel < center.heatLevel);
});

test('maximum-temperature metal ignites adjacent flammable material', () => {
  const world = worldFromRows(['m', 'o', '#']);
  const metal = world.get(0, 0);
  metal.heat(Metal.maxHeatLevel);
  stepN(world, Oil.ignitionDelay);
  assert.ok(world.get(0, 1) instanceof Fire);
});

test('hot metal boils adjacent water into steam', () => {
  const world = worldFromRows(['m', 'w']);
  world.random = () => 0;
  const metal = world.get(0, 0);
  metal.heat(Metal.maxHeatLevel);

  stepN(world, Metal.boilTicks);
  assert.ok(world.get(0, 1) instanceof Steam);
  assert.equal(metal.heatLevel, 3);
});

test('metal heating beats water cooling while fire is applied', () => {
  const world = worldFromRows(['f', 'm', 'w']);
  world.random = () => 0;
  stepN(world, 16);

  assert.equal(world.get(0, 1).heatLevel, 3);
  assert.ok(world.get(0, 2) instanceof Steam);
});

test('water in a metal container can boil under sustained external fire', () => {
  const world = worldFromRows([
    'ffffff',
    'mmmmm',
    'mwwwm',
    'mwwwm',
  ]);
  world.random = () => 0;

  for (let i = 0; i < 30; i++) {
    for (let x = 0; x < world.width; x++) {
      if (world.get(x, 0)?.type !== 'fire') world.set(x, 0, new Fire());
    }
    world.step();
  }

  assert.ok([...Array(world.width)].some((_, x) =>
    [...Array(world.height)].some((_, y) => world.get(x, y) instanceof Steam)
  ));
});

test('water cools metal and prolonged contact creates rust stages', () => {
  const world = worldFromRows(['m', 'w', '#']);
  const metal = world.get(0, 0);
  stepN(world, Metal.waterCoolTicks);
  assert.equal(metal.heatLevel, 0);
  assert.equal(metal.rustTicks, Metal.waterCoolTicks);

  stepN(world, Metal.rustThreshold - Metal.waterCoolTicks);
  assert.equal(metal.rustTicks, Metal.rustThreshold);
  assert.equal(metal.color, '#ad7a52');

  stepN(world, Metal.rustThreshold);
  assert.equal(metal.color, '#955a32');

  stepN(world, Metal.rustThreshold);
  assert.equal(metal.color, '#7a3f20');
});

test('rusted metal can still be heated by fire and adjacent metal', () => {
  const world = worldFromRows([
    'fm',
  ]);
  const rusted = world.get(1, 0);
  rusted.rustTicks = Metal.rustThreshold * 3;

  for (let i = 0; i < 300; i++) {
    if (world.get(0, 0)?.type !== 'fire') world.set(0, 0, new Fire());
    world.step();
  }
  assert.equal(rusted.heatLevel, Metal.maxHeatLevel);
  assert.equal(rusted.color, '#ff1a1a');
});

test('fire lifetime is half its previous 100-tick duration', () => {
  assert.equal(Fire.lifetime, 50);
});

test('fire dissipates after its lifetime', () => {
  const world = worldFromRows(['f']);
  stepN(world, Fire.lifetime);
  assert.deepEqual(rowsFromWorld(world), ['.']);
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
