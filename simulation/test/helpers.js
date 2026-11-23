import { World } from '../src/World.js';
import { MATERIALS } from '../src/materials/index.js';

const EMPTY = '.';
const BY_SYMBOL = Object.fromEntries(Object.values(MATERIALS).map((M) => [M.symbol, M]));

/** Builds a world from rows of symbols, e.g. ['.s.', '###']. '.' is empty. */
export function worldFromRows(rows, seed = 1) {
  const world = new World(rows[0].length, rows.length, { seed });
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch === EMPTY) return;
      const Material = BY_SYMBOL[ch];
      if (!Material) throw new Error(`Unknown symbol '${ch}'`);
      world.set(x, y, new Material());
    });
  });
  return world;
}

export function rowsFromWorld(world) {
  const rows = [];
  for (let y = 0; y < world.height; y++) {
    let row = '';
    for (let x = 0; x < world.width; x++) row += world.get(x, y)?.symbol ?? EMPTY;
    rows.push(row);
  }
  return rows;
}

export function stepN(world, n) {
  for (let i = 0; i < n; i++) world.step();
}
