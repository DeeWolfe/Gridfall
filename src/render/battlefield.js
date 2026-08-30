// The view from the dropship on the way down: a battlefield under a turning sky.
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

// The dropship's clock cycles through its own flight, not just one drop —
// descent to the AO, ascent back out, then a stretch en route to the next
// one, on repeat. Same durations for now; the flavour is in the label.
const PHASES = [
  {n: 'Descent', s: 214},
  {n: 'Ascent', s: 214},
  {n: 'Enroute', s: 214},
];
const CYCLE_SECONDS = PHASES.reduce((sum, p) => sum + p.s, 0);

// Seconds between events, picked fresh from each range every time one fires.
const CADENCE = {
  sortie: [7, 16],
  groundFire: [1.6, 4.5],
  shelling: [2.2, 6],
  mortar: [4, 11],
};

// Nothing may grow without bound if the tab is left open for an hour.
const LIMITS = {aircraft: 3, bombs: 14, tracers: 26, blasts: 12, smoke: 40, mortars: 6};

let raf = null;
let t = 0;
let last = 0;
let W = 0;
let H = 0;
let canvas = null;
let ctx = null;
let reduced = false;

// --- time of day -----------------------------------------------------------
//
// The scene used to be night and nothing else, and night here meant ridges at
// #0e0d24 against a #0a0820 sky — a four-value gap that vanished on any screen
// not in a dark room. So the sky turns, and every band turns with it: the
// terrain is a pale ridge against a dark sky at night and a dark silhouette
// against a bright one by day, which is what actually keeps it legible rather
// than any single choice of colour.
//
// Day is hazy and dust-blown on purpose. A clear blue sky would read as a
// different game sitting inside this one's palette.
const DAY_SECONDS = 180;

const SKY = [
  { // night — the old mood, but the ridges now sit ABOVE the sky in
    // luminance (+22 / +29 / +38 far to near) instead of within 8 of it,
    // which is what made the old scene a black rectangle.
    sky: ['#070614', '#0e0c26', '#181038', '#3a1836'],
    ridge: ['#2a2650', '#363062', '#453c78'],
    star: 1, glow: 0.2,
  },
  { // dawn
    sky: ['#1d1c46', '#3a2b5e', '#7c455a', '#c26a46'],
    ridge: ['#2a2550', '#332a58', '#3c2f5e'],
    star: 0.25, glow: 0.14,
  },
  { // day — smoke-hazed, never a clear blue
    sky: ['#31456a', '#4e6684', '#7f8e9c', '#a99783'],
    ridge: ['#3d4266', '#343a5a', '#2b3050'],
    star: 0, glow: 0.1,
  },
  { // dusk
    sky: ['#241740', '#4a2652', '#94404e', '#d4703c'],
    ridge: ['#2c2450', '#332654', '#3a2a56'],
    star: 0.35, glow: 0.16,
  },
];

const hexRgb = h => [
  parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixHex = (a, b, k) => {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
};

/** The sky right now: two keyframes blended, eased so it rests at each one. */
function skyNow() {
  const p = ((t % DAY_SECONDS) / DAY_SECONDS) * SKY.length;
  const i = Math.floor(p) % SKY.length;
  const A = SKY[i];
  const B = SKY[(i + 1) % SKY.length];
  const k = p - Math.floor(p);
  const e = k * k * (3 - 2 * k);
  return {
    sky: A.sky.map((c, n) => mixHex(c, B.sky[n], e)),
    ridge: A.ridge.map((c, n) => mixHex(c, B.ridge[n], e)),
    star: A.star + (B.star - A.star) * e,
    glow: A.glow + (B.glow - A.glow) * e,
  };
}

// Recomputed once a frame rather than per band — every painter reads it.
let skyTone = skyNow();

let ridges = [];
let stars = [];
let aircraft = [];
let bombs = [];
let tracers = [];
let blasts = [];
let smoke = [];
let mortars = [];
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
  // No colour here any more — each band takes its shade from the time of day,
  // so the far ridge can be lighter than the sky at night and darker by day.
  [{y: 0.62, a: 0.055, s: 0.10},
    {y: 0.72, a: 0.075, s: 0.22},
    {y: 0.86, a: 0.10, s: 0.46}].forEach(o => {
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
  mortars = [];
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

/**
 * A mortar leaves the line, arcs over, and comes down somewhere else.
 *
 * The scene already had things falling (bombs, from aircraft) and things
 * climbing (tracers, straight up). This is the shape neither of those draws —
 * a full parabola that starts and ends on the ground — which is what makes it
 * read as artillery rather than as another bomb.
 */
function fireMortar() {
  if (mortars.length >= LIMITS.mortars) return;
  mortars.push({
    x: Math.random(),
    y: GROUND - 0.005,
    vx: (Math.random() < 0.5 ? 1 : -1) * rand(0.03, 0.075),
    vy: -rand(0.42, 0.55),
    trail: [],
  });
}

// --- simulation ------------------------------------------------------------

function step(dt) {
  Object.keys(CADENCE).forEach(key => { timers[key] -= dt; });
  if (timers.sortie <= 0) { launchSortie(); cool('sortie'); }
  if (timers.groundFire <= 0) { openGroundFire(); cool('groundFire'); }
  if (timers.shelling <= 0) { shellHorizon(); cool('shelling'); }
  if (timers.mortar <= 0) { fireMortar(); cool('mortar'); }

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

  mortars = mortars.filter(m => {
    m.trail.push([m.x, m.y]);
    if (m.trail.length > 14) m.trail.shift();
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.vy += 0.42 * dt;              // ~2.5s from tube to impact
    if (m.vy > 0 && m.y >= GROUND) {
      detonate(m.x, GROUND, rand(0.014, 0.026));
      return false;
    }
    return m.x > -0.15 && m.x < 1.15;
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
  g.addColorStop(0, skyTone.sky[0]);
  g.addColorStop(0.38, skyTone.sky[1]);
  g.addColorStop(0.64, skyTone.sky[2]);
  g.addColorStop(1, skyTone.sky[3]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Stars burn out as the sky comes up, and are gone entirely by day.
  if (skyTone.star > 0.01) {
    stars.forEach(s => {
      const a = s.a * skyTone.star * (0.6 + 0.4 * Math.sin(t * 1.6 + s.tw));
      ctx.fillStyle = `rgba(200,218,255,${a.toFixed(3)})`;
      ctx.fillRect(s.x * W, s.y * H, 1.2, 1.2);
    });
  }

  // The fighting itself lights the horizon from below — plainly at night,
  // barely at all against a bright sky.
  const glow = ctx.createLinearGradient(0, H * 0.52, 0, H * GROUND);
  glow.addColorStop(0, 'rgba(255,77,143,0)');
  glow.addColorStop(1, `rgba(255,120,60,${skyTone.glow.toFixed(3)})`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, H * 0.52, W, H * (GROUND - 0.52));
}

function paintRidges(from, to) {
  ridges.slice(from, to).forEach((L, band) => {
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
    ctx.fillStyle = skyTone.ridge[from + band];
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

/** The shell itself, and the smoke arc it has drawn so far. */
function paintMortars() {
  mortars.forEach(m => {
    for (let i = 1; i < m.trail.length; i++) {
      const a = (i / m.trail.length) * 0.5;
      ctx.strokeStyle = `rgba(255,190,120,${a.toFixed(3)})`;
      ctx.lineWidth = 1 + (i / m.trail.length) * 1.4;
      ctx.beginPath();
      ctx.moveTo(m.trail[i - 1][0] * W, m.trail[i - 1][1] * H);
      ctx.lineTo(m.trail[i][0] * W, m.trail[i][1] * H);
      ctx.stroke();
    }
    const x = m.x * W;
    const y = m.y * H;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, 7);
    halo.addColorStop(0, 'rgba(255,225,150,.85)');
    halo.addColorStop(1, 'rgba(255,140,60,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 6.284);
    ctx.fill();
    ctx.fillStyle = '#fff2cc';
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, 6.284);
    ctx.fill();
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

/** Engine vibration on the hold screen, and the flight clock. */
function paintChrome() {
  const vibe = $('vibe');
  if (vibe) {
    const shake = ((Math.sin(t * 23) + Math.sin(t * 37)) * 0.32).toFixed(2);
    vibe.style.transform = `translate3d(0,${shake}px,0)`;
  }
  let into = Math.floor(t) % CYCLE_SECONDS;
  let phase = PHASES[PHASES.length - 1];
  for (const p of PHASES) {
    if (into < p.s) { phase = p; break; }
    into -= p.s;
  }
  const left = Math.max(0, phase.s - into);
  const phaseEl = $('phase');
  if (phaseEl) phaseEl.textContent = phase.n;
  const eta = $('eta');
  if (eta) eta.textContent = 'T−' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
}

function paint() {
  skyTone = skyNow();
  paintSky();
  paintRidges(0, 2);
  paintAircraft();
  paintOrdnance();
  paintMortars();
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
    // Start somewhere random in the day so two commanders do not both open
    // the hold screen onto the same sky.
    t = Math.random() * DAY_SECONDS;
    try {
      reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch { reduced = false; }
  }
  sizeScene();

  // Reduced motion gets the terrain and the sky, held still.
  if (reduced) {
    skyTone = skyNow();
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
