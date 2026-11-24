// Hover effects on the material names in the sidebar: fire flickers, water and oil drip, a plant grows
// a vine, steam rises, sand pours and stone builds a wall. A material's effect is one of:
//   particles: kind, colors, how often one appears and how long it lives in ms (sway = drifts sideways)
//   grow(label): builds something that stays while the name is hovered and returns a function that removes it
//   nothing here: a look that is all in style.css (stone's wall)
// To give another material an effect, add an entry here and its look to style.css.
const SVG_NS = 'http://www.w3.org/2000/svg';
const EFFECTS = {
  fire: { kind: 'flame', colors: ['#ffe34d', '#ffb627', '#ff7a1a', '#ec3d17'], every: 90, life: 700, sway: true },
  water: { kind: 'drip', colors: ['#8ff0f0', '#3fc1d6', '#2a86c8'], every: 280, life: 950 },
  oil: { kind: 'oil', colors: ['#a16207', '#713f12', '#ca8a04'], every: 420, life: 1700 },
  steam: { kind: 'puff', colors: ['#e2e8f0', '#cbd5e1', '#94a3b8'], every: 200, life: 1200, sway: true },
  sand: { kind: 'grain', colors: ['#f4c690', '#fad6a4', '#e6a462'], every: 70, life: 650 },
  plant: { grow: growVine },
  stone: {},
};
const MAX_BITS = 14; // safety cap on particles alive at once per button

const VINE_STEP = 4; // px between points along the stem
const VINE_ROOM = 7; // px of room above and below the name for twigs
const STEM_SECONDS = 1.4;
const TWIG_SECONDS = 0.35;
const point = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`;
const middle = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/**
 * One particle for a material's effect, or null if the material has no particle effect: where along
 * the name it appears (left, in %), its color, and a sideways drift in px (0 for things that fall straight).
 */
export function makeParticle(type, random = Math.random) {
  const effect = EFFECTS[type];
  if (!effect?.every) return null;
  return {
    kind: effect.kind,
    left: Math.round(random() * 100),
    color: effect.colors[Math.floor(random() * effect.colors.length)],
    drift: effect.sway ? Math.round((random() - 0.5) * 8) : 0,
  };
}

/**
 * A vine for a name `width` x `height` px, as SVG path data: one wavy stem along the bottom growing left to
 * right, with twigs curling up from it (alternately leaning left and right), a leaf at each twig's tip.
 * Every piece has a delay in seconds: the stem starts first and each twig starts as the stem reaches it.
 */
export function makeVine(width, height, random = Math.random) {
  const stemY = VINE_ROOM + height + 1;
  const points = [];
  for (let x = 0, i = 0; x <= width + VINE_STEP; x += VINE_STEP, i++) {
    points.push([x, stemY + (i % 2 ? 1 : -1) * (0.4 + random() * 1.4)]);
  }
  // A smooth stem: straight to the first midpoint, curve through each point, straight to the end.
  let stem = `M${point(points[0])}L${point(middle(points[0], points[1]))}`;
  for (let i = 1; i < points.length - 1; i++) stem += `Q${point(points[i])} ${point(middle(points[i], points[i + 1]))}`;
  stem += `L${point(points.at(-1))}`;

  const twigs = [];
  const leaves = [];
  for (let i = 1; i < points.length - 1; i += 2) {
    const [x, y] = points[i];
    const lean = twigs.length % 2 ? 1 : -1;
    const length = 7 + random() * 5;
    const tip = [x + lean * (2 + random() * 3), y - length];
    const bend = [x - lean * (1.5 + random() * 2), y - length * 0.55];
    const delay = (x / (width + VINE_STEP)) * STEM_SECONDS;
    twigs.push({ d: `M${point(points[i])}Q${point(bend)} ${point(tip)}`, delay, dur: TWIG_SECONDS });
    leaves.push({ x: tip[0], y: tip[1], delay: delay + TWIG_SECONDS * 0.8 });
  }
  return { width, height: height + 2 * VINE_ROOM, stem: { d: stem, delay: 0, dur: STEM_SECONDS }, twigs, leaves };
}

/** Grows a vine around the name and keeps it there until the returned function fades it out. */
function growVine(label) {
  const vine = makeVine(label.offsetWidth, label.offsetHeight);
  const timing = (piece) => `style="--delay:${piece.delay.toFixed(2)}s;--dur:${piece.dur}s"`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'vine-svg');
  svg.setAttribute('width', vine.width);
  svg.setAttribute('height', vine.height);
  svg.innerHTML = [
    `<path class="stem" pathLength="1" d="${vine.stem.d}" ${timing(vine.stem)} />`,
    ...vine.twigs.map((twig) => `<path class="twig" pathLength="1" d="${twig.d}" ${timing(twig)} />`),
    ...vine.leaves.map((leaf) => `<rect class="leaf" x="${leaf.x - 2}" y="${leaf.y - 2}" width="4" height="4" ${timing(leaf)} />`),
  ].join('');
  label.append(svg);
  return () => {
    svg.classList.add('out');
    setTimeout(() => svg.remove(), 350);
  };
}

/** Plays the material's effect over its name while the button is hovered or keyboard-focused. */
export function addHoverEffect(button, type) {
  const effect = EFFECTS[type];
  const label = button.querySelector('.label');
  if (!effect || !label) return;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let hovering = false;
  let focused = false;
  let timer = null;
  let release = null; // removes what effect.grow built

  const emit = () => {
    if (label.children.length >= MAX_BITS) return;
    const particle = makeParticle(type);
    const bit = document.createElement('span');
    bit.className = `fx ${particle.kind}`;
    bit.style.left = `${particle.left}%`;
    bit.style.setProperty('--fx-color', particle.color);
    bit.style.setProperty('--drift', `${particle.drift}px`);
    label.append(bit);
    setTimeout(() => bit.remove(), effect.life);
  };

  const update = () => {
    const on = (hovering || focused) && !reduceMotion.matches;
    button.classList.toggle(`fx-${type}`, on);
    if (effect.grow) {
      if (on && !release) release = effect.grow(label);
      else if (!on && release) { release(); release = null; }
    } else if (effect.every) {
      if (on && !timer) {
        emit();
        timer = setInterval(emit, effect.every);
      } else if (!on && timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };

  button.addEventListener('pointerenter', () => { hovering = true; update(); });
  button.addEventListener('pointerleave', () => { hovering = false; update(); });
  button.addEventListener('focus', () => { focused = button.matches(':focus-visible'); update(); });
  button.addEventListener('blur', () => { focused = false; update(); });
}
