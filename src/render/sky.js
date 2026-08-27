// The dropship viewport on the hold screen: a parallax canvas of stars,
// horizon glow and scrolling terrain, plus the descent clock.
//
// Purely decorative. It runs only while the hold screen is up and is stopped
// on every navigation away, so nothing animates behind a screen nobody sees.

import {$} from './dom.js';

const DESCENT_SECONDS = 214;

let raf = null;
let t = 0;
let W = 0;
let H = 0;
let layers = [];
let stars = [];
let last = 0;
let canvas = null;
let ctx = null;

export function sizeSky() {
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, r.width * dpr);
  canvas.height = Math.max(1, r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = r.width;
  H = r.height;
  buildSky();
}

function buildSky() {
  layers = [];
  stars = [];
  [{y: 0.60, a: 0.055, s: 0.10, c: '#0e0d24'},
    {y: 0.72, a: 0.075, s: 0.22, c: '#141130'},
    {y: 0.86, a: 0.10, s: 0.46, c: '#1c1740'}].forEach(o => {
    const pts = [];
    for (let i = 0; i < 28; i++) pts.push(Math.random());
    layers.push({...o, pts, off: Math.random() * 900});
  });
  for (let i = 0; i < 90; i++) {
    stars.push({x: Math.random(), y: Math.random() * 0.55, a: 0.15 + Math.random() * 0.6, tw: Math.random() * 6.3});
  }
}

function drawSky(dt) {
  t += dt;

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04030b');
  g.addColorStop(0.4, '#0a0820');
  g.addColorStop(0.66, '#191138');
  g.addColorStop(1, '#3a1436');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    ctx.fillStyle = `rgba(190,210,255,${s.a * (0.6 + 0.4 * Math.sin(t * 1.6 + s.tw))})`;
    ctx.fillRect(s.x * W, s.y * H, 1.2, 1.2);
  });

  const hz = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.74);
  hz.addColorStop(0, 'rgba(255,77,143,0)');
  hz.addColorStop(1, 'rgba(255,77,143,.13)');
  ctx.fillStyle = hz;
  ctx.fillRect(0, H * 0.5, W, H * 0.24);

  layers.forEach(L => {
    L.off += dt * L.s * W * 0.14;
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

  // A running light on the hull, blinking.
  const px = (Math.sin(t * 2.2) + 1) / 2;
  ctx.fillStyle = `rgba(77,232,255,${0.25 + px * 0.65})`;
  ctx.fillRect(W * 0.78, H * 0.7, 2, 2);
  ctx.fillStyle = `rgba(77,232,255,${0.05 + px * 0.1})`;
  ctx.beginPath();
  ctx.arc(W * 0.78 + 1, H * 0.7 + 1, 9 + px * 6, 0, 6.283);
  ctx.fill();

  // Engine vibration, and the descent clock counting down on a loop.
  const vibe = $('vibe');
  if (vibe) {
    const shake = ((Math.sin(t * 23) + Math.sin(t * 37)) * 0.32).toFixed(2);
    vibe.style.transform = `translate3d(0,${shake}px,0)`;
  }
  const left = Math.max(0, DESCENT_SECONDS - Math.floor(t) % DESCENT_SECONDS);
  $('eta').textContent = 'T−' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
}

function loop(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000 || 0);
  last = ts;
  drawSky(dt);
  raf = requestAnimationFrame(loop);
}

export function startSky() {
  if (!canvas) {
    canvas = $('sky');
    ctx = canvas.getContext('2d');
  }
  sizeSky();
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
}

export function stopSky() {
  if (raf) {
    cancelAnimationFrame(raf);
    raf = null;
  }
}

/** True while the sky is animating — the resize handler needs to know. */
export const skyRunning = () => raf !== null;
