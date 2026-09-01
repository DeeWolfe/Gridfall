// Synthwave atmosphere, generated note by note on the same WebAudio stack as
// the effects — no track to download, nothing to loop-splice.
//
//  - hold "cruise": 92 BPM, A minor (Am·F·C·G), detuned saw pads breathing
//    through a slow, closed lowpass, an 8th-note bass pulse, a soft kick
//    heartbeat, a sparse high arpeggio, washed in delay and hall.
//  - combat / boss: the AUDIO-BRIEF theme — 118 BPM, E natural minor with a
//    borrowed ♭II (Em·G·D·F; the F natural is the only tone outside the key
//    and it is the entire character of the loop — do not "fix" it to F#),
//    a 16-step sequencer per bar over a four-bar rotation. Combat starts on
//    pad and root and BUILDS, one layer at a time; boss is the full
//    arrangement from the first bar, filter wide open.
//
// The combat build is driven by MISSION PRESSURE, not a timer (the brief's
// own recommended change): each completed rotation reads the fight — wave
// fraction, horde on the board, breaches, thin ground — and moves at most
// ONE stage toward that reading, up or down. A fight that eases sounds like
// it eased. Boss phase two slams the arrangement to full regardless.
//
// Per-operation colour is one number: the same generator transposed
// (Ironveil as written, Blackmarrow down a semitone, Sunderglass up a minor
// third — the lead's final fall to E lands wherever E now is).
//
// A look-ahead scheduler (the standard WebAudio pattern) books ~600ms of
// music at a time from a 200ms interval, so tab jank never tears a note. The
// switch lives on the profile next to the sound one; without WebAudio every
// call is a silent no-op, which is also what the test stub exercises.

import {active, G} from '../state/session.js';
import {commit} from '../save/profile.js';
import {audio} from './sound.js';

const MUSIC_LEVEL = 0.12;
const NOTE_HZ = n => 440 * 2 ** ((n - 69) / 12); // midi -> Hz

// -- the combat theme's theory, fixed by the audio brief ----------------------

// Em · G · D · F over four bars. The F major bar is the borrowed flat-II —
// F natural is deliberately outside E natural minor and carries the tension.
export const M_PROG = [
  {name: 'Em', root: 40, chord: [52, 55, 59], borrowed: false},  // E  G  B
  {name: 'G',  root: 43, chord: [55, 59, 62], borrowed: false},  // G  B  D
  {name: 'D',  root: 38, chord: [50, 54, 57], borrowed: false},  // D  F# A
  {name: 'F',  root: 41, chord: [53, 57, 60], borrowed: true},   // F  A  C
];

// Driving sixteenth-bass gate, one bar. Steps 4 and 12 jump an octave once
// the lead is in.
export const M_BASS16 = [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1];

// The lead line, [step, midi] per bar. The last bar leans on the borrowed F
// and falls a semitone to E — that descent is the hook; keep it.
export const M_LEAD = [
  [[0, 52], [6, 55], [10, 59], [14, 62]],            // Em
  [[0, 59], [4, 62], [8, 59], [12, 55]],             // G
  [[0, 57], [6, 54], [10, 50], [14, 54]],            // D
  [[0, 60], [4, 57], [8, 53], [10, 53], [13, 52]],   // F → E
];

// Same generator, one number per operation: each theatre gets its own colour
// at zero asset cost. Negative digs in, positive brightens.
export const M_TRANSPOSE = {
  ironveil: 0,      // E minor as written — cold and mechanical
  blackmarrow: -1,  // down a semitone: heavier, subterranean
  sunderglass: 3,   // up a minor third: brighter and more brittle
  lumenspire: 2,    // up a tone: glassy, lit from inside
  crownring: 1,     // up a semitone: ceremonial, slightly wrong
  shallowhelm: -3,  // down a minor third: drowned and slow
};
export const opTranspose = op => M_TRANSPOSE[op] || 0;

// Build stages 0..5. Layers derive from the stage: pad+bass are always on;
// stage 1 adds the sixteenth bass, 2 kick and snare, 3 hats, 4 the arpeggio,
// 5 the lead. Boss pins the stage at 5 from the first bar.
const M_FULL_STAGE = 5;

/**
 * The mission-pressure read: 0 (quiet) to 5 (everything). Pure — takes the
 * mission object so the harnesses can feed it fixtures. Sums how deep into
 * the clock the fight is, how big the horde on the board is, breaches taken
 * and ground lost; boss phase two is an automatic 5.
 */
export function pressureStage(g) {
  if (!g || g.over) return 0;
  if (g.boss && g.boss.phase >= 2) return M_FULL_STAGE;
  const total = g.waves && isFinite(g.waves) ? g.waves : 12;
  const clock = Math.min(1, Math.max(0, (g.turn - 1) / Math.max(1, total - 1)));
  const horde = Math.min(1, ((g.enemies && g.enemies.length) || 0) / 6);
  const hurt = Math.min(1, (g.breaches || 0) / 2);
  let ground = 0;
  if (g.ter) {
    // 15 tiles is the standing start (3 columns × 5 lanes).
    const held = g.ter.flat().filter(t => t === 'p').length;
    ground = Math.min(1, Math.max(0, (15 - held) / 8));
  }
  return Math.max(0, Math.min(M_FULL_STAGE, Math.round(clock * 2 + horde * 2 + hurt + ground)));
}

// Two engines, three moods. `hold` keeps the beat-based cruise; `combat` and
// `boss` share the 16-step sequencer (`step: true`). For step moods the pad
// filter's real target is stage-driven (mStageFilterHz), `filterHz` is only
// the floor; the LFO barely breathes so the build owns the cutoff.
const M_MOODS = {
  hold: {
    bpm: 92, arpChance: 0.5, bassDiv: 2,
    wave: 'sawtooth', padAttack: 1.1,
    filterHz: 900, filterLfo: 0.06, filterDepth: 320,
    verbWet: 0.35, delayWet: 0.3, delayFb: 0.38,
    prog: [
      {pad: [57, 60, 64], bass: 33, arp: [69, 72, 76, 81]},  // A minor
      {pad: [53, 57, 60], bass: 29, arp: [65, 69, 72, 77]},  // F major
      {pad: [55, 60, 64], bass: 36, arp: [67, 72, 76, 79]},  // C major
      {pad: [55, 59, 62], bass: 31, arp: [67, 71, 74, 79]},  // G major
    ],
  },
  combat: {
    step: true, bpm: 118,
    filterHz: 1800, filterLfo: 0.08, filterDepth: 90,
    verbWet: 0.28, delayWet: 0.1, delayFb: 0.2,
  },
  boss: {
    step: true, bpm: 118,
    filterHz: 4200, filterLfo: 0.08, filterDepth: 90,
    verbWet: 0.28, delayWet: 0.1, delayFb: 0.2,
  },
};
let mMood = 'hold';
let mStage = 0;    // combat build stage 0..5; boss pins 5
const moodDef = () => M_MOODS[mMood];
const mSpb = () => 60 / moodDef().bpm;
const mStep16 = () => mSpb() / 4;

/** Where the shared lowpass should sit right now: the build opens it 520Hz
 * per stage so each new layer is felt as well as heard; boss starts wide. */
const mStageFilterHz = () =>
  mMood === 'boss' ? 4200 : mMood === 'combat' ? 1800 + mStage * 520 : moodDef().filterHz;

/** Pick the track: 'hold' cruise, 'combat' build, or 'boss' full-tilt.
 * Tempo, key and instrumentation switch on the next scheduled slot; the
 * shared filter, delay and hall ramp to the new mood's targets over a beat
 * or two so the mix doesn't click, but the switch still lands fast. */
export function setMusicMood(mood) {
  if (!M_MOODS[mood] || mood === mMood) return;
  mMood = mood;
  if (moodDef().step) {
    mStep = 0;
    mStage = mood === 'boss' ? M_FULL_STAGE : 0;
  }
  applyMoodTone();
}

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
let mLfo = null;            // pad filter's breathing LFO — rate ramps per mood
let mLfoDepth = null;       // and how far it swings
let mDelay = null;          // synthwave echo — time re-locks to the new tempo
let mDelayFeedback = null;
let mDelayWet = null;
let mVerbWet = null;        // hall send — combat runs drier than hold
let mRunning = false;
let mTimer = null;
let mBeat = 0;   // hold's cursor: quarter-note beats
let mStep = 0;   // the step engine's cursor: 0..63 sixteenths of a rotation
let mNext = 0;

function musicGraph() {
  const c = audio();
  if (!c) return null;
  if (mBus) return c;
  const m = moodDef();

  mBus = c.createGain();
  mBus.gain.value = 0.0001;
  mBus.connect(c.destination);

  padFilter = c.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = m.filterHz;
  padFilter.connect(mBus);
  mLfo = c.createOscillator();
  mLfo.frequency.value = m.filterLfo;
  mLfoDepth = c.createGain();
  mLfoDepth.gain.value = m.filterDepth;
  mLfo.connect(mLfoDepth);
  mLfoDepth.connect(padFilter.frequency);
  mLfo.start();

  bassFilter = c.createBiquadFilter();
  bassFilter.type = 'lowpass';
  bassFilter.frequency.value = 420;
  bassFilter.connect(mBus);

  // Dotted-eighth feedback delay — the classic synthwave echo.
  mDelay = c.createDelay(1.5);
  mDelay.delayTime.value = mSpb() * 0.75;
  mDelayFeedback = c.createGain();
  mDelayFeedback.gain.value = m.delayFb;
  mDelayWet = c.createGain();
  mDelayWet.gain.value = m.delayWet;
  mDelay.connect(mDelayFeedback);
  mDelayFeedback.connect(mDelay);
  mDelay.connect(mDelayWet);
  mDelayWet.connect(mBus);

  // A cheap hall: convolve with 2.2s of exponentially decaying noise — the
  // impulse is generated at runtime, there is no IR file to lose.
  const verb = c.createConvolver();
  const len = (2.2 * c.sampleRate) | 0;
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.8;
  }
  verb.buffer = ir;
  mVerbWet = c.createGain();
  mVerbWet.gain.value = m.verbWet;
  verb.connect(mVerbWet);
  mVerbWet.connect(mBus);
  verbSend = verb;

  arpSend = c.createGain();
  arpSend.gain.value = 1;
  arpSend.connect(mBus);
  arpSend.connect(mDelay);
  arpSend.connect(verb);

  return c;
}

/** Ramp the shared filter/delay/hall to the current mood's targets — called
 * on every setMusicMood() so a switch mid-track doesn't wait for the graph
 * to be rebuilt, and doesn't click either. No-op before the graph exists;
 * startMusic()'s musicGraph() call already builds it tuned to the mood
 * that's active at that point. */
function applyMoodTone() {
  const c = audio();
  if (!c || !mBus) return;
  const m = moodDef();
  const t = c.currentTime;
  const ramp = 0.5;
  padFilter.frequency.cancelScheduledValues(t);
  padFilter.frequency.setTargetAtTime(mStageFilterHz(), t, ramp);
  mLfo.frequency.setTargetAtTime(m.filterLfo, t, ramp);
  mLfoDepth.gain.setTargetAtTime(m.filterDepth, t, ramp);
  mDelay.delayTime.setTargetAtTime(mSpb() * 0.75, t, ramp);
  mDelayFeedback.gain.setTargetAtTime(m.delayFb, t, ramp);
  mDelayWet.gain.setTargetAtTime(m.delayWet, t, ramp);
  mVerbWet.gain.setTargetAtTime(m.verbWet, t, ramp);
}

// -- the hold cruise's players ------------------------------------------------

function mPad(c, chord, t, mood) {
  const barDur = mSpb() * 4;
  const attack = mood.padAttack;
  chord.pad.forEach(n => [-6, 6].forEach(cents => {
    const osc = c.createOscillator();
    osc.type = mood.wave;
    osc.frequency.value = NOTE_HZ(n);
    osc.detune.value = cents;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + attack);
    g.gain.setValueAtTime(0.05, t + barDur);
    g.gain.linearRampToValueAtTime(0.0001, t + barDur + 1.2);
    osc.connect(g);
    g.connect(padFilter);
    g.connect(verbSend);
    osc.start(t);
    osc.stop(t + barDur + 1.3);
  }));
}

function mBass(c, midi, t, mood, dur) {
  const osc = c.createOscillator();
  osc.type = mood.wave;
  osc.frequency.value = NOTE_HZ(midi);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.14, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(g);
  g.connect(bassFilter);
  osc.start(t);
  osc.stop(t + dur + 0.04);
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

/** Book one beat of the hold cruise at absolute time t. */
function mScheduleBeat(c, beat, t) {
  const mood = moodDef();
  const spb = mSpb();
  const chord = mood.prog[(beat >> 2) % mood.prog.length];
  if (beat % 4 === 0) mPad(c, chord, t, mood);
  mKick(c, t);
  // The bass cuts each beat into `bassDiv` slices; the first slice of every
  // odd beat jumps an octave. Note length shortens with the subdivision so
  // dense slices don't smear into each other.
  const div = mood.bassDiv;
  const dur = Math.min(0.22, (spb / div) * 0.8);
  for (let k = 0; k < div; k++) {
    const jump = k === 0 && beat % 2 === 1;
    mBass(c, chord.bass + (jump ? 12 : 0), t + (k * spb) / div, mood, dur);
  }
  // Shimmer: an arp note on some of the eighths, register high.
  for (const half of [0, 1]) {
    if (Math.random() > mood.arpChance) continue;
    const pool = chord.arp;
    mArp(c, pool[(beat * 2 + half + ((Math.random() * 2) | 0)) % pool.length], t + half * spb / 2);
  }
}

// -- the step engine's players (combat / boss) --------------------------------

/** One synth voice into the shared lowpass + hall. `hzMul` widens a detuned
 * copy without leaving midi space. */
function sVoice(c, midi, t, dur, type, gain, hzMul) {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = NOTE_HZ(midi) * (hzMul || 1);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(padFilter);
  g.connect(verbSend);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** A highpassed noise burst — snare layers and hats, gain and cutoff apart. */
function sNoise(c, t, dur, gain, hp) {
  const frames = (dur * c.sampleRate) | 0;
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2.2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(padFilter);
  g.connect(verbSend);
  src.start(t);
}

/** The step engine's kick: harder and boomier than the cruise heartbeat. */
function sKick(c, t) {
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(44, t + 0.11);
  const g = c.createGain();
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
  osc.connect(g);
  g.connect(mBus);
  osc.start(t);
  osc.stop(t + 0.36);
}

/** Book one sixteenth of the combat/boss theme at absolute time t.
 * n is 0..63 — four 16-step bars per rotation. */
function mScheduleStep(c, n, t) {
  const bar = (n >> 4) % 4;
  const s = n % 16;
  const C = M_PROG[bar];
  const tp = opTranspose(G && G.op);
  const s16 = mStep16();
  const st = mStage;

  // Pad — one long detuned stack per bar, with a sub-octave under it.
  if (s === 0) {
    const dur = s16 * 16 * 0.98;
    C.chord.forEach(m => {
      sVoice(c, m + tp, t, dur, 'sawtooth', 0.055);
      sVoice(c, m + tp, t, dur, 'sawtooth', 0.045, 1.005);  // detune for width
      sVoice(c, m + tp - 12, t, dur, 'triangle', 0.04);
    });
  }

  // Bass — one long root until the build brings the driving sixteenths in.
  if (st < 1) {
    if (s === 0) sVoice(c, C.root + tp, t, s16 * 14, 'triangle', 0.30);
  } else if (M_BASS16[s]) {
    const oct = st >= M_FULL_STAGE && (s === 4 || s === 12) ? 12 : 0;
    sVoice(c, C.root + tp + oct, t, s16 * 1.5, 'sawtooth', 0.34);
  }

  // Drums: four-on-the-floor kick, a two-layer gated snare on 2 and 4.
  if (st >= 2) {
    if (s % 4 === 0) sKick(c, t);
    if (s === 4 || s === 12) {
      sNoise(c, t, 0.19, 0.34, 1400);
      sNoise(c, t, 0.28, 0.12, 900);
    }
  }
  // Hats every second step; every step once the lead is in.
  if (st >= 3) {
    const every = st >= M_FULL_STAGE ? 1 : 2;
    if (s % every === (every === 1 ? 0 : 1)) sNoise(c, t, 0.035, 0.09, 7200);
  }

  // Arpeggio — a sixteenth run through the chord, one octave up.
  if (st >= 4) {
    const notes = [C.chord[0], C.chord[1], C.chord[2], C.chord[1] + 12,
      C.chord[2], C.chord[1], C.chord[0] + 12, C.chord[1]];
    sVoice(c, notes[s % 8] + 12 + tp, t, s16 * 1.1, 'square', 0.075);
  }

  // Lead — leans on the borrowed chord, falls a semitone to E at the end.
  if (st >= M_FULL_STAGE) {
    for (const [pos, m] of M_LEAD[bar]) if (pos === s) sVoice(c, m + tp, t, s16 * 2.6, 'sawtooth', 0.13);
  }
}

/** The build's one movement rule, pure for the harnesses: at most one stage
 * toward the target per rotation, up or down — the arrangement never
 * lurches. `jump` (boss phase two) is the one exception: straight to full. */
export function buildStep(stage, target, jump) {
  if (jump) return M_FULL_STAGE;
  return target === stage ? stage : stage + Math.sign(target - stage);
}

/** A four-bar rotation just completed: re-read the fight and move the build. */
function mRotationGate(c) {
  if (mMood === 'boss') return;
  const was = mStage;
  mStage = buildStep(mStage, pressureStage(G), G && G.boss && G.boss.phase >= 2);
  if (mStage !== was) padFilter.frequency.setTargetAtTime(mStageFilterHz(), c.currentTime, 1.2);
}

function mTick() {
  const c = musicGraph();
  if (!c) return;
  while (mNext < c.currentTime + 0.6) {
    if (moodDef().step) {
      mScheduleStep(c, mStep, mNext);
      mNext += mStep16();
      mStep = (mStep + 1) % 64;
      if (mStep === 0) mRotationGate(c);
    } else {
      mScheduleBeat(c, mBeat, mNext);
      mNext += mSpb();
      mBeat++;
    }
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
