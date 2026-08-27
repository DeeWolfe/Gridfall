// The view from the dropship on the way down: a night battlefield.
//
// Everything here is atmosphere — nothing it draws feeds back into the game.
// It runs only while the hold screen is up and stops on every navigation away,
// so nothing animates behind a screen nobody is looking at.
//
// The scene is event-driven rather than a loop of constant motion: each of the
// four events (a sortie, a bomb, ground fire, a distant shell) waits out a
// randomised cooldown, so the horizon is quiet often enough that a strike
// registers when it comes.

import {$} from './dom.js';

const DESCENT_SECONDS = 214;

// Seconds between events, picked fresh from each range every time one fires.
const CADENCE = {
  sortie: [7, 16],
  groundFire: [1.6, 4.5],
  shelling: [2.2, 6],
};

// Nothing may grow without bound if the tab is left open for an hour.
const LIMITS = {aircraft: 3, bombs: 14, tracers: 26, blasts: 12, smoke: 40};

let raf = null;
let t = 0;
let last = 0;
let W = 0;
let H = 0;
let canvas = null;
let ctx = null;
let reduced = false;

let ridges = [];
let stars = [];
let aircraft = [];
let bombs = [];
let tracers = [];
let blasts = [];
let smoke = [];
let timers = {};

const rand = (a, b) => a + Math.random() * (b - a);
const cool = key => { timers[key] = rand(...CADENCE[key]); };

/** The ground line, as a fraction of canvas height. */
const GROUND = 0.78;

export function sizeScene() {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, r.width * dpr);
  canvas.height = Math.max(1, r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = r.width;
  H = r.height;
  buildTerrain();
}

function buildTerrain() {
  ridges = [];
  stars = [];
  [{y: 0.62, a: 0.055, s: 0.10, c: '#0e0d24'},
    {y: 0.72, a: 0.075, s: 0.22, c: '#141130'},
    {y: 0.86, a: 0.10, s: 0.46, c: '#1c1740'}].forEach(o => {
    const pts = [];
    for (let i = 0; i < 28; i++) pts.push(Math.random());
    ridges.push({...o, pts, off: Math.random() * 900});
  });
  for (let i = 0; i < 90; i++) {
    stars.push({x: Math.random(), y: Math.random() * 0.5, a: 0.15 + Math.random() * 0.6, tw: Math.random() * 6.3});
  }
  aircraft = [];
  bombs = [];
  tracers = [];
  blasts = [];
  smoke = [];
  Object.keys(CADENCE).forEach(cool);
}

// --- events ----------------------------------------------------------------

/** A gunship crosses the horizon, high and unhurried. */
function launchSortie() {
  if (aircraft.length >= LIMITS.aircraft) return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  aircraft.push({
    dir,
    x: dir > 0 ? -0.08 : 1.08,
    y: rand(0.18, 0.38),
    speed: rand(0.055, 0.1),
    drops: Math.random() < 0.7 ? (Math.random() < 0.35 ? 3 : 2) : 0,
    nextDrop: rand(0.3, 0.55),   // as a fraction of the crossing
    trail: [],
  });
}

/** A bomb released from `plane`, falling under gravity with its inherited run. */
function releaseBomb(plane) {
  if (bombs.length >= LIMITS.bombs) return;
  bombs.push({x: plane.x, y: plane.y, vx: plane.speed * plane.dir * 0.55, vy: 0.04});
}

/** Tracer fire climbing from the ridge, bursting into flak near the top. */
function openGroundFire() {
  const shots = 2 + ((Math.random() * 4) | 0);
  const originX = Math.random();
  for (let i = 0; i < shots && tracers.length < LIMITS.tracers; i++) {
    tracers.push({
      x: originX + rand(-0.02, 0.02),
      y: GROUND - 0.01,
      vx: rand(-0.05, 0.05),
      vy: -rand(0.32, 0.5),
      life: 1,
      burstAt: rand(0.2, 0.42),
    });
  }
}

/** Something lands out on the horizon. Flash, ring, then smoke. */
function detonate(x, y, power) {
  if (blasts.length >= LIMITS.blasts) return;
  blasts.push({x, y, r: 0, max: power, life: 1});
  const puffs = 2 + ((power * 90) | 0);
  for (let i = 0; i < puffs && smoke.length < LIMITS.smoke; i++) {
    smoke.push({
      x: x + rand(-power, power),
      y: y - rand(0, power * 0.6),
      r: rand(2, 6),
      rise: rand(0.012, 0.03),
      life: 1,
      fade: rand(0.2, 0.4),
    });
  }
}

function shellHorizon() {
  detonate(Math.random(), GROUND - rand(0, 0.02), rand(0.01, 0.022));
}

// --- simulation ------------------------------------------------------------

function step(dt) {
  Object.keys(CADENCE).forEach(key => { timers[key] -= dt; });
  if (timers.sortie <= 0) { launchSortie(); cool('sortie'); }
  if (timers.groundFire <= 0) { openGroundFire(); cool('groundFire'); }
  if (timers.shelling <= 0) { shellHorizon(); cool('shelling'); }

  aircraft = aircraft.filter(p => {
    const before = p.x;
    p.x += p.speed * p.dir * dt;
    p.trail.push(p.x);
    if (p.trail.length > 26) p.trail.shift();

    const crossed = p.dir > 0 ? (before < p.nextDrop && p.x >= p.nextDrop)
      : (before > p.nextDrop && p.x <= p.nextDrop);
    if (p.drops > 0 && crossed) {
      releaseBomb(p);
      p.drops--;
      p.nextDrop += p.dir * rand(0.04, 0.09);
    }
    return p.x > -0.2 && p.x < 1.2;
  });

  bombs = bombs.filter(b => {
    b.vy += 0.16 * dt;              // gravity, in canvas fractions
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y >= GROUND) {
      detonate(b.x, GROUND, rand(0.018, 0.03));
      return false;
    }
    return b.x > -0.1 && b.x < 1.1;
  });

  tracers = tracers.filter(s => {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 0.1 * dt;               // rounds arc over as they climb
    s.life -= dt * 0.6;
    if (s.life > 0 && s.y <= s.burstAt) {
      detonate(s.x, s.y, rand(0.006, 0.012));
      return false;
    }
    return s.life > 0;
  });

  blasts = blasts.filter(b => {
    b.r += (b.max * 2.4 - b.r) * Math.min(1, dt * 7);
    b.life -= dt * 1.5;
    return b.life > 0;
  });

  smoke = smoke.filter(s => {
    s.y -= s.rise * dt;
    s.r += 4 * dt;
    s.life -= s.fade * dt;
    return s.life > 0;
  });
}

// --- painting --------------------------------------------------------------

function paintSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04030b');
  g.addColorStop(0.38, '#0a0820');
  g.addColorStop(0.64, '#191138');
  g.addColorStop(1, '#3a1436');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    ctx.fillStyle = `rgba(190,210,255,${s.a * (0.6 + 0.4 * Math.sin(t * 1.6 + s.tw))})`;
    ctx.fillRect(s.x * W, s.y * H, 1.2, 1.2);
  });

  // The fighting itself lights the horizon from below.
  const glow = ctx.createLinearGradient(0, H * 0.52, 0, H * GROUND);
  glow.addColorStop(0, 'rgba(255,77,143,0)');
  glow.addColorStop(1, 'rgba(255,120,60,.17)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.52, W, H * (GROUND - 0.52));
}

function paintRidges(from, to) {
  ridges.slice(from, to).forEach(L => {
    ctx.beginPath();
    ctx.moveTo(0, H);
    const n = L.pts.length;
    const seg = W / (n - 2);
    for (let i = 0; i < n; i++) {
      const x = i * seg - (L.off % seg);
      const idx = (i + Math.floor(L.off / seg)) % n;
      ctx.lineTo(x, H * L.y - L.pts[(idx + n) % n] * H * L.a);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = L.c;
    ctx.fill();
  });
}

function paintAircraft() {
  aircraft.forEach(p => {
    const y = p.y * H;

    // Contrail: a thinning line back along the run.
    for (let i = 0; i < p.trail.length - 1; i++) {
      const a = (i / p.trail.length) * 0.16;
      ctx.fillStyle = `rgba(190,205,235,${a.toFixed(3)})`;
      ctx.fillRect(p.trail[i] * W, y - 0.5, 2, 1);
    }

    // Silhouette: a swept delta, nose in the direction of travel.
    const x = p.x * W;
    const d = p.dir;
    ctx.beginPath();
    ctx.moveTo(x + 9 * d, y);
    ctx.lineTo(x - 4 * d, y - 3);
    ctx.lineTo(x - 6 * d, y);
    ctx.lineTo(x - 4 * d, y + 3);
    ctx.closePath();
    ctx.fillStyle = '#0a0916';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 1 * d, y - 1);
    ctx.lineTo(x - 9 * d, y - 6);
    ctx.lineTo(x - 7 * d, y);
    ctx.lineTo(x - 9 * d, y + 6);
    ctx.closePath();
    ctx.fillStyle = '#111029';
    ctx.fill();

    // Engine glow.
    ctx.fillStyle = `rgba(255,150,70,${(0.5 + 0.3 * Math.sin(t * 22)).toFixed(2)})`;
    ctx.fillRect(x - 7 * d, y - 0.8, 2.2, 1.6);
  });
}

function paintOrdnance() {
  bombs.forEach(b => {
    ctx.fillStyle = '#d9dcf0';
    ctx.fillRect(b.x * W - 1, b.y * H - 2.5, 2, 5);
  });

  tracers.forEach(s => {
    const x = s.x * W;
    const y = s.y * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - s.vx * W * 0.11, y - s.vy * H * 0.11);
    ctx.strokeStyle = `rgba(255,208,120,${Math.max(0, s.life).toFixed(2)})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  });
}

function paintBlasts() {
  smoke.forEach(s => {
    ctx.beginPath();
    ctx.arc(s.x * W, s.y * H, s.r, 0, 6.283);
    ctx.fillStyle = `rgba(34,28,46,${(s.life * 0.38).toFixed(3)})`;
    ctx.fill();
  });

  blasts.forEach(b => {
    const x = b.x * W;
    const y = b.y * H;
    const r = b.r * W;

    // Core flash.
    const flash = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
    flash.addColorStop(0, `rgba(255,240,190,${(b.life * 0.95).toFixed(2)})`);
    flash.addColorStop(0.35, `rgba(255,150,60,${(b.life * 0.6).toFixed(2)})`);
    flash.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r), 0, 6.283);
    ctx.fill();

    // Shock ring, expanding ahead of the flash and fading faster.
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, r * 1.3), 0, 6.283);
    ctx.strokeStyle = `rgba(255,176,96,${(b.life * 0.22).toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

/** Engine vibration on the hold screen, and the descent clock. */
function paintChrome() {
  const vibe = $('vibe');
  if (vibe) {
    const shake = ((Math.sin(t * 23) + Math.sin(t * 37)) * 0.32).toFixed(2);
    vibe.style.transform = `translate3d(0,${shake}px,0)`;
  }
  const left = Math.max(0, DESCENT_SECONDS - Math.floor(t) % DESCENT_SECONDS);
  const eta = $('eta');
  if (eta) eta.textContent = 'T−' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
}

function paint() {
  paintSky();
  paintRidges(0, 2);
  paintAircraft();
  paintOrdnance();
  paintBlasts();
  paintRidges(2);        // the near ridge sits in front of the fighting
  paintChrome();
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  t += dt;
  step(dt);
  paint();
  raf = requestAnimationFrame(frame);
}

export function startScene() {
  if (!canvas) {
    canvas = $('sky');
    ctx = canvas.getContext('2d');
    try {
      reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { reduced = false; }
  }
  sizeScene();

  // Reduced motion gets the terrain and the sky, held still.
  if (reduced) {
    paintSky();
    paintRidges(0);
    paintChrome();
    return;
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

export function stopScene() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

/** True while the scene is animating — the resize handler needs to know. */
export const sceneRunning = () => raf !== null;
