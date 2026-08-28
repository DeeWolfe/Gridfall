// Synthwave atmosphere, generated note by note on the same WebAudio stack as
// the effects — no track to download, nothing to loop-splice. A night-drive
// progression (Am · F · C · G) at 92 BPM: detuned saw pads swelling a bar at
// a time behind a slowly breathing lowpass, an eighth-note bass pulse, a soft
// kick heartbeat, and a sparse high arpeggio echoing through a feedback delay
// and a procedural convolver hall.
//
// A look-ahead scheduler (the standard WebAudio pattern) books ~600ms of
// music at a time from a 200ms interval, so tab jank never tears a note. The
// switch lives on the profile next to the sound one; without WebAudio every
// call is a silent no-op, which is also what the test stub exercises.

import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {audio} from './sound.js';

const MUSIC_LEVEL = 0.12;
const M_BPM = 92;
const M_SPB = 60 / M_BPM;                        // seconds per beat
const NOTE_HZ = n => 440 * 2 ** ((n - 69) / 12); // midi -> Hz

// Four bars, one chord each: pad voicing (close, mid register), bass root,
// and the arp pool it sprays from. Voice-leading keeps the pads from jumping.
const M_PROG = [
  {pad: [57, 60, 64], bass: 33, arp: [69, 72, 76, 81]},  // A minor
  {pad: [53, 57, 60], bass: 29, arp: [65, 69, 72, 77]},  // F major
  {pad: [55, 60, 64], bass: 36, arp: [67, 72, 76, 79]},  // C major
  {pad: [55, 59, 62], bass: 31, arp: [67, 71, 74, 79]},  // G major
];

/** On unless the profile says otherwise — same contract as soundOn. */
export const musicOn = () => !active || !active.settings || active.settings.music !== 'off';

export function toggleMusic() {
  if (!active) return musicOn();
  active.settings = active.settings || {};
  active.settings.music = musicOn() ? 'off' : 'on';
  commit();
  syncMusic();
  return musicOn();
}

/** Start or stop to match the profile switch. Safe to call any time. */
export function syncMusic() {
  if (musicOn()) startMusic();
  else stopMusic();
}

// -- the graph, built once and reused across stop/start ----------------------

let mBus = null;        // music master: everything funnels through here
let padFilter = null;   // shared breathing lowpass for the pads
let bassFilter = null;
let arpSend = null;     // arp dry tap that also feeds delay + hall
let verbSend = null;
let mRunning = false;
let mTimer = null;
let mBeat = 0;
let mNext = 0;

function musicGraph() {
  const c = audio();
  if (!c) return null;
  if (mBus) return c;

  mBus = c.createGain();
  mBus.gain.value = 0.0001;
  mBus.connect(c.destination);

  padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 900;
  padFilter.connect(mBus);
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoDepth = c.createGain();
  lfoDepth.gain.value = 320;
  lfo.connect(lfoDepth);
  lfoDepth.connect(padFilter.frequency);
  lfo.start();

  bassFilter = c.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 420;
  bassFilter.connect(mBus);

  // Dotted-eighth feedback delay — the classic synthwave echo.
  const delay = c.createDelay(1.5);
  delay.delayTime.value = M_SPB * 0.75;
  const feedback = c.createGain();
  feedback.gain.value = 0.38;
  const wet = c.createGain();
  wet.gain.value = 0.3;
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(mBus);

  // A cheap hall: convolve with 2.2s of exponentially decaying noise.
  const verb = c.createConvolver();
  const len = (2.2 * c.sampleRate) | 0;
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8;
  }
  verb.buffer = ir;
  const verbWet = c.createGain();
  verbWet.gain.value = 0.35;
  verb.connect(verbWet);
  verbWet.connect(mBus);
  verbSend = verb;

  arpSend = c.createGain();
  arpSend.gain.value = 1;
  arpSend.connect(mBus);
  arpSend.connect(delay);
  arpSend.connect(verb);

  return c;
}

// -- the players --------------------------------------------------------------

function mPad(c, chord, t) {
  const barDur = M_SPB * 4;
  chord.pad.forEach(n => [-6, 6].forEach(cents => {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = NOTE_HZ(n);
    osc.detune.value = cents;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.1);
    g.gain.setValueAtTime(0.05, t + barDur);
    g.gain.linearRampToValueAtTime(0.0001, t + barDur + 1.2);
    osc.connect(g);
    g.connect(padFilter);
    g.connect(verbSend);
    osc.start(t);
    osc.stop(t + barDur + 1.3);
  }));
}

function mBass(c, midi, t) {
  const osc = c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = NOTE_HZ(midi);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.14, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(g);
  g.connect(bassFilter);
  osc.start(t);
  osc.stop(t + 0.26);
}

function mKick(c, t) {
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  const g = c.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
  osc.connect(g);
  g.connect(mBus);
  osc.start(t);
  osc.stop(t + 0.15);
}

function mArp(c, midi, t) {
  const osc = c.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = NOTE_HZ(midi);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(g);
  g.connect(arpSend);
  osc.start(t);
  osc.stop(t + 0.6);
}

/** Book one beat of music at absolute time t. */
function mScheduleBeat(c, beat, t) {
  const chord = M_PROG[(beat >> 2) % M_PROG.length];
  if (beat % 4 === 0) mPad(c, chord, t);
  mKick(c, t);
  // Driving eighths on the root; every fourth eighth jumps the octave.
  mBass(c, chord.bass + ((beat * 2) % 4 === 2 ? 12 : 0), t);
  mBass(c, chord.bass + ((beat * 2 + 1) % 4 === 2 ? 12 : 0), t + M_SPB / 2);
  // Sparse shimmer: an arp note on roughly half the eighths, register high.
  for (const half of [0, 1]) {
    if (Math.random() < 0.45) continue;
    const pool = chord.arp;
    mArp(c, pool[(beat * 2 + half + ((Math.random() * 2) | 0)) % pool.length], t + half * M_SPB / 2);
  }
}

function mTick() {
  const c = musicGraph();
  if (!c) return;
  while (mNext < c.currentTime + 0.6) {
    mScheduleBeat(c, mBeat, mNext);
    mNext += M_SPB;
    mBeat++;
  }
}

// -- the switch ---------------------------------------------------------------

export function startMusic() {
  if (mRunning || !musicOn()) return;
  try {
    const c = musicGraph();
    if (!c) return;
    mRunning = true;
    mNext = Math.max(mNext, c.currentTime + 0.1);
    mBus.gain.cancelScheduledValues(c.currentTime);
    mBus.gain.setValueAtTime(Math.max(0.0001, mBus.gain.value), c.currentTime);
    mBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, c.currentTime + 1.6);
    mTick();
    mTimer = setInterval(mTick, 200);
  } catch { /* an odd audio stack must never break the game */ }
}

export function stopMusic() {
  if (!mRunning) return;
  try {
    mRunning = false;
    clearInterval(mTimer);
    mTimer = null;
    const c = audio();
    if (c && mBus) {
      mBus.gain.cancelScheduledValues(c.currentTime);
      mBus.gain.setValueAtTime(Math.max(0.0001, mBus.gain.value), c.currentTime);
      mBus.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.8);
    }
  } catch { /* see above */ }
}
