import { World } from '../../simulation/src/World.js';
import { MATERIALS, createPixel } from '../../simulation/src/materials/index.js';
import { ERASE, paintAt, paintLine } from './brush.js';
import { createRenderer } from './renderer.js';

const WIDTH = 120;
const HEIGHT = 90;
const TICKS_PER_SECOND = 60; // engine ticks per second at 1x speed
const MAX_TICKS_PER_FRAME = 16; // a slow frame never runs more than this many ticks
const MAX_UNDO = 30;

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const world = new World(WIDTH, HEIGHT);
const draw = createRenderer(canvas.getContext('2d'), WIDTH, HEIGHT);
const state = { material: 'sand', brush: 2, speed: 1, paused: false };
const undoStack = [];
let stroke = null; // { id, erase, cell } while a pointer is painting

// One button per material in the engine's registry (plus the eraser), so new materials appear automatically.
for (const [type, { color }] of [...Object.entries(MATERIALS), [ERASE, { color: '#0b0d12' }]]) {
  const button = document.createElement('button');
  button.textContent = type[0].toUpperCase() + type.slice(1);
  button.style.setProperty('--c', color);
  button.setAttribute('aria-pressed', type === state.material);
  button.onclick = () => {
    state.material = type;
    for (const other of $('materials').children) other.setAttribute('aria-pressed', other === button);
  };
  $('materials').append(button);
}

// Undo: a snapshot is a plain array with one material type (or null) per cell.
function pushUndo() {
  undoStack.push(world.grid.cells.map((pixel) => pixel && pixel.type));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  $('undo').disabled = false;
}

$('undo').onclick = () => {
  const types = undoStack.pop();
  types?.forEach((type, i) => world.set(i % WIDTH, Math.floor(i / WIDTH), type && createPixel(type)));
  $('undo').disabled = undoStack.length === 0;
};
$('clear').onclick = () => { pushUndo(); world.grid.cells.fill(null); };
$('step').onclick = () => world.step();
$('speed').onchange = (e) => { state.speed = Number(e.target.value); };
$('brush').oninput = (e) => { state.brush = Number(e.target.value); };
$('pause').onclick = (e) => {
  state.paused = !state.paused;
  e.target.textContent = state.paused ? 'Resume' : 'Pause';
  $('step').disabled = !state.paused;
};

// Painting: left button paints the selected material, right button erases.
const cellAt = (e) => {
  const rect = canvas.getBoundingClientRect();
  return [
    Math.floor(((e.clientX - rect.left) / rect.width) * WIDTH),
    Math.floor(((e.clientY - rect.top) / rect.height) * HEIGHT),
  ];
};
const stamp = () => paintAt(world, ...stroke.cell, stroke.erase ? ERASE : state.material, state.brush);

canvas.oncontextmenu = (e) => e.preventDefault();
canvas.onpointerdown = (e) => {
  if (stroke) return;
  canvas.setPointerCapture(e.pointerId);
  pushUndo(); // one undo step per stroke, saved before it changes anything
  stroke = { id: e.pointerId, erase: e.button === 2, cell: cellAt(e) };
  stamp();
};
canvas.onpointermove = (e) => {
  if (stroke?.id !== e.pointerId) return;
  const cell = cellAt(e);
  paintLine(world, stroke.cell, cell, stroke.erase ? ERASE : state.material, state.brush);
  stroke.cell = cell;
};
canvas.onpointerup = canvas.onpointercancel = (e) => { if (stroke?.id === e.pointerId) stroke = null; };

// Main loop: fixed-timestep ticks (independent of the display's frame rate) plus one draw per frame.
let last = performance.now();
let owed = 0;
let frames = 0;
let windowStart = last;

function frame(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  if (stroke) stamp(); // holding still keeps pouring

  if (!state.paused) {
    owed += (dt / 1000) * TICKS_PER_SECOND * state.speed;
    const whole = Math.floor(owed);
    const ticks = Math.min(whole, MAX_TICKS_PER_FRAME);
    owed = whole > MAX_TICKS_PER_FRAME ? 0 : owed - ticks;
    for (let i = 0; i < ticks; i++) world.step();
  }
  draw(world);

  frames++;
  if (now - windowStart >= 500) {
    const fps = Math.round((frames * 1000) / (now - windowStart));
    $('stats').textContent = `FPS ${fps} · Particles ${world.grid.cells.filter(Boolean).length.toLocaleString()}`;
    frames = 0;
    windowStart = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
