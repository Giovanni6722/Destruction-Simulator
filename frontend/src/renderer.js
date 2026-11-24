const BACKGROUND = '#0b0d12';
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((value, i) => Math.round(value + (b[i] - value) * t));

// Flame gradient from the hot base to the cooling tips: yellow, gold, orange, red, dark red.
const FLAME = ['#ffe34d', '#ffb627', '#ff7a1a', '#ec3d17', '#a81b0e'].map(rgb);
const EMBER = rgb('#ff7a1a'); // the glow fire casts on the empty cells around it
const GLOW_RADIUS = 2;
// Vine shades: a dark outline, the twisted strands (groove, body, highlight) and leaves.
const VINE = {
  outline: rgb('#123f1f'),
  strands: ['#1f6b33', '#2e9443', '#2e9443', '#57c25a'].map(rgb),
  leaf: rgb('#a6f06a'),
  leafVein: rgb('#6fd04a'),
};
const LEAF_CHANCE = 0.22; // share of a vine's edge cells drawn as leaves
// Water from the bright surface down to the deep: aqua, teal, sea blue, deep blue, navy.
const SEA = ['#8ff0f0', '#3fc1d6', '#2a86c8', '#1d559e', '#122f6b'].map(rgb);
const SEA_DEPTH = 10; // cells of water above a cell before it reaches the darkest blue
const WAVE = rgb('#9fe3ff'); // the light streaks of the waves
// Stone is drawn as cobbles: dark mortar between rounded stones shaded from dark to light gray.
const COBBLE = 6; // average cobble size in cells
const MORTAR = rgb('#2a2d33');
const COBBLE_SHADES = ['#5c5f63', '#74777b', '#8b8e92', '#a6a9ad'].map(rgb);
// Beach sand: a peach base, lighter grains, wind ripples in a darker orange, and wet sand by water.
const SAND = {
  base: rgb('#f4c690'),
  light: rgb('#fad6a4'),
  ripple: rgb('#e6a462'),
  rippleEdge: rgb('#eeb679'),
  wet: rgb('#c98f55'),
};

/** A repeatable random number in [0, 1) for a pair of integers (and a salt for separate streams). */
function hash(a, b, salt) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A color along a list of color stops; t = 0 is the first stop and 1 the last. */
export function gradient(stops, t) {
  const position = Math.min(Math.max(t, 0), 1) * (stops.length - 1);
  const i = Math.min(Math.floor(position), stops.length - 2);
  return mix(stops[i], stops[i + 1], position - i);
}

const typeAt = (world, x, y) => world.get(x, y)?.type;

/**
 * Fire is hottest (yellow) low in a flame and while fresh, and coolest (red) at the tips and as it
 * burns out. flicker (0..1) changes from frame to frame so the flames dance.
 */
export function fireColor(world, x, y, pixel, flicker) {
  // Fire or fuel in the 3 cells under this one. Rising fire leaves gaps, so a gap doesn't stop the count.
  let depth = 0;
  for (let dy = 1; dy <= 3; dy++) {
    const below = world.get(x, y + dy);
    if (below?.type === 'fire' || below?.flammable) depth++;
  }
  const tip = typeAt(world, x, y - 1) !== 'fire' && typeAt(world, x, y - 2) !== 'fire';
  const life = pixel.lifetime > 0 ? 1 - (pixel.age ?? 0) / pixel.lifetime : 0;
  const heat = 0.1 + 0.35 * (depth / 3) + 0.25 * life + 0.25 * flicker - (tip ? 0.1 : 0);
  return gradient(FLAME, 1 - heat);
}

/** Plants are drawn as twisted vines: a dark outline down wide stems, leaves dotted along the edges. */
export function vineColor(world, x, y, seed) {
  const isPlant = (dx, dy) => typeAt(world, x + dx, y + dy) === 'plant';
  // An edge of a stem at least 3 cells thick along this direction (dx, dy) gets the outline,
  // so thin vines keep their strand colors.
  const thickEdge = (dx, dy) => (!isPlant(-dx, -dy) && isPlant(dx, dy) && isPlant(2 * dx, 2 * dy))
    || (!isPlant(dx, dy) && isPlant(-dx, -dy) && isPlant(-2 * dx, -2 * dy));
  const edge = !isPlant(-1, 0) || !isPlant(1, 0) || !isPlant(0, -1) || !isPlant(0, 1);
  if (edge && seed < LEAF_CHANCE) return seed < LEAF_CHANCE / 3 ? VINE.leafVein : VINE.leaf;
  if (thickEdge(1, 0) || thickEdge(0, 1)) return VINE.outline;
  // Diagonal bands make the strands look twisted around each other.
  return VINE.strands[(x + y) & 3];
}

/**
 * Water is aqua at the surface and darkens to navy with depth, crossed by light wave streaks
 * that drift sideways over time (frame).
 */
export function waterColor(world, x, y, frame) {
  const depthAt = (column) => { // water cells stacked above (column, y)
    let depth = 0;
    while (depth < SEA_DEPTH && typeAt(world, column, y - depth - 1) === 'water') depth++;
    return depth;
  };
  const depth = depthAt(x);
  if (depth === 0) return SEA[0]; // the surface line
  // Blend with the neighboring columns so an uneven surface doesn't leave vertical stripes.
  const side = (dx) => (typeAt(world, x + dx, y) === 'water' ? depthAt(x + dx) : depth);
  const base = gradient(SEA, (side(-1) + 2 * depth + side(1)) / 4 / SEA_DEPTH);
  // Two slow waves crossing give long, uneven streaks like the swell in pixel-art seas.
  const swell = Math.sin(x * 0.17 + y * 1.3 + frame * 0.05) + Math.sin(x * 0.07 - y * 0.8 - frame * 0.03);
  if (swell > 1.15) return mix(base, WAVE, 0.4);
  if (swell > 0.55) return mix(base, SEA[2], 0.45); // a softer band around each streak
  if (swell < -1.3) return mix(base, SEA[4], 0.35);
  return base;
}

/**
 * Stone is a cobblestone wall. The pattern is fixed to the grid, so stone painted anywhere shows the
 * same cobbles: each cobble is the area closest to one jittered point, with mortar where two meet.
 */
export function stoneColor(x, y) {
  const gx = Math.floor(x / COBBLE);
  const gy = Math.floor(y / COBBLE);
  let nearest = Infinity;
  let second = Infinity;
  let cobble = null;
  for (let j = gy - 1; j <= gy + 1; j++) {
    for (let i = gx - 1; i <= gx + 1; i++) {
      const px = (i + 0.15 + 0.7 * hash(i, j, 1)) * COBBLE;
      const py = (j + 0.15 + 0.7 * hash(i, j, 2)) * COBBLE;
      const distance = Math.hypot(x + 0.5 - px, (y + 0.5 - py) * 1.2); // a bit wider than tall
      if (distance < nearest) {
        second = nearest;
        nearest = distance;
        cobble = { px, py, i, j };
      } else if (distance < second) {
        second = distance;
      }
    }
  }
  if (second - nearest < 1.1) return MORTAR;
  // Light from the top left: each cobble is lighter up and left of its middle, darker down and right,
  // and every cobble gets its own slightly different tone.
  const light = (cobble.px - x + cobble.py - y) / COBBLE + 0.8 * hash(cobble.i, cobble.j, 3) - 0.4;
  return COBBLE_SHADES[Math.max(0, Math.min(3, Math.round(1.5 + 1.5 * light)))];
}

/**
 * Sand is beach sand: a grain's dry look (look, from sandRipple) plus a darker wet look where it
 * touches water.
 */
export function sandColor(world, x, y, seed, look = sandRipple(x, y, seed)) {
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    if (typeAt(world, x + dx, y + dy) === 'water') return SAND.wet;
  }
  return look;
}

/** Short diagonal wind ripples at (x, y), broken into dashes, with light speckles on some grains (seed). */
export function sandRipple(x, y, seed) {
  // Diagonal bands that wobble, cut into dashes so they read as ripples, not stripes.
  const band = Math.sin((x * 0.55 - y + 2.2 * Math.sin(x * 0.21 + y * 0.13)) * 0.75);
  const dash = hash(Math.floor((x + 2 * y) / 7), Math.floor(y / 3), 4) > 0.3;
  if (dash && band > 0.9) return SAND.ripple;
  if (dash && band > 0.75) return SAND.rippleEdge;
  return seed < 0.12 ? SAND.light : SAND.base;
}

/** Returns draw(world), which paints one canvas pixel per cell through a single ImageData. */
export function createRenderer(ctx, width, height, random = Math.random) {
  const image = ctx.createImageData(width, height);
  const background = rgb(BACKGROUND);
  const colors = new Map();
  const colorOf = (pixel) => {
    if (!colors.has(pixel.color)) colors.set(pixel.color, rgb(pixel.color));
    return colors.get(pixel.color);
  };
  // A fixed random number per pixel: picks which vine cells are leaves and offsets each flame's flicker.
  const seeds = new WeakMap();
  const seedOf = (pixel) => {
    if (!seeds.has(pixel)) seeds.set(pixel, random());
    return seeds.get(pixel);
  };
  const sandLooks = new WeakMap(); // each sand grain's dry color, fixed when it is first drawn
  const glow = new Float32Array(width * height);

  return (world) => {
    // Waves, flicker and glow follow the simulation clock, so they freeze while paused and keep pace with the speed.
    const frame = world.tick;
    const cells = world.grid.cells;
    glow.fill(0);
    cells.forEach((pixel, i) => {
      if (pixel?.type !== 'fire') return;
      const x = i % width;
      const y = (i - x) / width;
      for (let dy = -GLOW_RADIUS; dy <= GLOW_RADIUS; dy++) {
        for (let dx = -GLOW_RADIUS; dx <= GLOW_RADIUS; dx++) {
          const gx = x + dx;
          const gy = y + dy;
          if (gx < 0 || gy < 0 || gx >= width || gy >= height) continue;
          const j = gy * width + gx;
          glow[j] = Math.max(glow[j], 1 - Math.hypot(dx, dy) / (GLOW_RADIUS + 1));
        }
      }
    });

    const pulse = 0.25 + 0.08 * Math.sin(frame * 0.2);
    cells.forEach((pixel, i) => {
      const x = i % width;
      const y = (i - x) / width;
      let color = background;
      if (pixel?.type === 'fire') {
        const flicker = 0.5 + 0.5 * Math.sin(frame * 0.35 + seedOf(pixel) * Math.PI * 2);
        color = fireColor(world, x, y, pixel, flicker);
      } else if (pixel?.type === 'sand') {
        // A grain keeps the ripple color of where it was first drawn, so the texture doesn't shift as it falls.
        if (!sandLooks.has(pixel)) sandLooks.set(pixel, sandRipple(x, y, seedOf(pixel)));
        color = sandColor(world, x, y, seedOf(pixel), sandLooks.get(pixel));
      } else if (pixel?.type === 'stone') {
        color = stoneColor(x, y);
      } else if (pixel?.type === 'water') {
        color = waterColor(world, x, y, frame);
      } else if (pixel?.type === 'plant') {
        color = vineColor(world, x, y, seedOf(pixel));
      } else if (pixel) {
        color = colorOf(pixel);
      } else if (glow[i] > 0) {
        color = mix(background, EMBER, glow[i] * pulse);
      }
      image.data.set([color[0], color[1], color[2], 255], i * 4);
    });
    ctx.putImageData(image, 0, 0);
  };
}
