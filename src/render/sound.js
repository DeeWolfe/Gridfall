// Sound. Every effect is synthesized on a small WebAudio graph — no assets,
// nothing to load, which keeps the single-file build honest.
//
// The context is created lazily on the first play, which in practice is always
// inside a user gesture (a tap, a click), so autoplay policy never blocks it.
// Where WebAudio does not exist — the test stub, ancient embeds — every call
// is a silent no-op. The player's switch lives on the profile.

import {active} from '../state/session.js';
import {commit} from '../save/profile.js';

const MASTER_LEVEL = 0.22;

let audioCtx = null;
let masterGain = null;

function audio() {
  if (typeof AudioContext === 'undefined') return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = MASTER_LEVEL;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** On unless the profile says otherwise. */
export const soundOn = () => !active || !active.settings || active.settings.sound !== 'off';

export function toggleSound() {
  if (!active) return soundOn();
  active.settings = active.settings || {};
  active.settings.sound = soundOn() ? 'off' : 'on';
  commit();
  return soundOn();
}

/** One oscillator with a pitch glide and a fast decay envelope. */
function tone({f0, f1, t = 0.09, type = 'square', v = 1, at = 0}) {
  const c = audio();
  if (!c) return;
  const start = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, start);
  if (f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + t);
  gain.gain.setValueAtTime(v, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + t);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(start);
  osc.stop(start + t + 0.02);
}

/** A burst of filtered noise — impacts, landings, the pack seal cracking. */
function noise({t = 0.25, v = 1, cutoff = 800, at = 0}) {
  const c = audio();
  if (!c) return;
  const start = c.currentTime + at;
  const frames = Math.max(1, (t * c.sampleRate) | 0);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = c.createGain();
  gain.gain.setValueAtTime(v, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + t);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(start);
}

const SFX = {
  tap: () => tone({f0: 880, t: 0.035, v: 0.3}),
  select: () => tone({f0: 520, f1: 680, t: 0.06, type: 'sine', v: 0.5}),
  deploy: () => { tone({f0: 150, f1: 70, t: 0.12, type: 'sine', v: 0.9}); noise({t: 0.08, v: 0.4, cutoff: 600}); },
  move: () => tone({f0: 300, f1: 390, t: 0.05, type: 'sine', v: 0.3}),
  zap: () => tone({f0: 950, f1: 180, t: 0.1, type: 'sawtooth', v: 0.5}),
  thud: () => tone({f0: 180, f1: 85, t: 0.09, type: 'sine', v: 0.8}),
  boom: () => { noise({t: 0.3, v: 0.9, cutoff: 420}); tone({f0: 95, f1: 40, t: 0.26, type: 'sine', v: 0.9}); },
  ping: () => tone({f0: 1500, f1: 1150, t: 0.07, type: 'triangle', v: 0.4}),
  drop: () => { noise({t: 0.12, v: 0.35, cutoff: 1300}); tone({f0: 620, f1: 180, t: 0.12, type: 'sine', v: 0.35}); },
  alarm: () => { tone({f0: 620, t: 0.11, v: 0.55}); tone({f0: 470, t: 0.11, v: 0.55, at: 0.12}); tone({f0: 620, t: 0.11, v: 0.55, at: 0.24}); },
  confirm: () => tone({f0: 440, f1: 570, t: 0.07, v: 0.4}),
  win: () => [392, 523, 659].forEach((f, i) => tone({f0: f, t: 0.15, type: 'triangle', v: 0.5, at: i * 0.12})),
  lose: () => [330, 262, 196].forEach((f, i) => tone({f0: f, t: 0.17, type: 'triangle', v: 0.5, at: i * 0.13})),
  pack: () => { noise({t: 0.2, v: 0.4, cutoff: 3200}); tone({f0: 500, f1: 1250, t: 0.26, type: 'sine', v: 0.4}); },
};

/** The names the rest of the renderer may ask for. */
export const SFX_NAMES = Object.keys(SFX);

/** Play an effect by name. Silent when muted, unknown, or without WebAudio. */
export function sfx(name) {
  if (!soundOn() || !SFX[name]) return;
  try {
    SFX[name]();
  } catch { /* an odd audio stack must never break the game */ }
}
