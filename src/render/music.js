// Synthwave atmosphere, generated note by note on the same WebAudio stack as
// the effects — no track to download, nothing to loop-splice. Two genuinely
// different tracks share one engine:
//
//  - hold "cruise": 92 BPM, A minor (Am·F·C·G), detuned saw pads breathing
//    through a slow, closed lowpass, an 8th-note bass pulse, a soft kick
//    heartbeat, a sparse high arpeggio, washed in delay and hall.
//  - combat "drive": 132 BPM, an E Phrygian vamp (Em·F·Em·Bb — the i→bII
//    half-step is the classic "danger" cue, a different mode, not just a
//    reshuffle of hold's chords), square-wave pads and bass for a harder
//    edge, a driving 16th-note bassline, a snare backbeat under the kick, a
//    brighter filter that opens up instead of breathing, and a drier mix
//    (less delay/hall) so it reads as tighter and more urgent, not just
//    louder or faster.
//
// setMusicMood() ramps the shared filter/delay/hall parameters to the new
// mood's targets over ~0.6s so the switch is quick but not a click; the next
// scheduled beat picks up the new tempo, key and instrumentation outright.
//
// A look-ahead scheduler (the standard WebAudio pattern) books ~600ms of
// music at a time from a 200ms interval, so tab jank never tears a note. The
// switch lives on the profile next to the sound one; without WebAudio every
// call is a silent no-op, which is also what the test stub exercises.

import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {audio} from './sound.js';

const MUSIC_LEVEL = 0.12;
const NOTE_HZ = n => 440 * 2 ** ((n - 69) / 12); // midi -> Hz

// Two moods, two keys, two instrument voicings. Each is four bars, one
// chord per bar: pad voicing (close, mid register), bass root, and the arp
// pool it sprays from — voice-leading keeps the pads from jumping within a
// mood. `wave` sets the pad/bass oscillator type; `bassDiv` is how many
// slices the bass cuts each beat into (2 = straight 8ths, 4 = driving
// 16ths); `filterHz`/`filterLfo`/`filterDepth` are the pad filter's target
// cutoff and how it breathes; `verbWet`/`delayWet`/`delayFb` set how washed
// the mix is.
const M_MOODS = {
  hold: {
    bpm: 92, arpChance: 0.5, hat: false, snare: false, bassDiv: 2,
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
    bpm: 132, arpChance: 0.85, hat: true, snare: true, bassDiv: 4,
    wave: 'square', padAttack: 0.25,
    filterHz: 2400, filterLfo: 0.22, filterDepth: 500,
    verbWet: 0.16, delayWet: 0.22, delayFb: 0.24,
    prog: [
      {pad: [52, 55, 59], bass: 28, arp: [64, 67, 71, 76]},  // E minor
      {pad: [53, 57, 60], bass: 29, arp: [65, 69, 72, 77]},  // F major — the Phrygian bII, the "danger" step
      {pad: [52, 55, 59], bass: 28, arp: [64, 67, 71, 76]},  // E minor
      {pad: [58, 62, 65], bass: 34, arp: [70, 74, 77, 82]},  // Bb major — a tritone jolt off the tonic
    ],
  },
};
let mMood = 'hold';
const moodDef = () => M_MOODS[mMood];
const mSpb = () => 60 / moodDef().bpm;

/** Pick the track: 'hold' cruise or 'combat' drive. Tempo, key and
 * instrumentation switch on the next scheduled beat; the shared filter,
 * delay and hall ramp to the new mood's targets over the same beat or two
 * so the mix doesn't click, but the switch still lands fast. */
export function setMusicMood(mood) {
  if (!M_MOODS[mood] || mood === mMood) return;
  mMood = mood;
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
let mBeat = 0;
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

  // A cheap hall: convolve with 2.2s of exponentially decaying noise.
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
  padFilter.frequency.setTargetAtTime(m.filterHz, t, ramp);
  mLfo.frequency.setTargetAtTime(m.filterLfo, t, ramp);
  mLfoDepth.gain.setTargetAtTime(m.filterDepth, t, ramp);
  mDelay.delayTime.setTargetAtTime(mSpb() * 0.75, t, ramp);
  mDelayFeedback.gain.setTargetAtTime(m.delayFb, t, ramp);
  mDelayWet.gain.setTargetAtTime(m.delayWet, t, ramp);
  mVerbWet.gain.setTargetAtTime(m.verbWet, t, ramp);
}

// -- the players --------------------------------------------------------------

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

/** Offbeat hat for the combat mood: a 60ms puff of highpassed noise. */
function mHat(c, t) {
  const frames = (0.06 * c.sampleRate) | 0;
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = c.createBufferSource();
  src.buffer = buf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6000;
  const g = c.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(hp);
  hp.connect(g);
  g.connect(mBus);
  src.start(t);
}

/** Combat's backbeat crack on 2 and 4: a wider, band-passed noise burst —
 * a real snare hit, not just a louder hat, so the drums read as a
 * different kit rather than the same one turned up. */
function mSnare(c, t) {
  const frames = (0.14 * c.sampleRate) | 0;
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 1.4;
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.7;
  const g = c.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.connect(bp);
  bp.connect(g);
  g.connect(mBus);
  src.start(t);
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
  const mood = moodDef();
  const spb = mSpb();
  const chord = mood.prog[(beat >> 2) % mood.prog.length];
  if (beat % 4 === 0) mPad(c, chord, t, mood);
  mKick(c, t);
  if (mood.hat) mHat(c, t + spb / 2);
  // The backbeat crack, beats 2 and 4 of every bar — combat only.
  if (mood.snare && (beat % 4 === 1 || beat % 4 === 3)) mSnare(c, t);
  // The bass cuts each beat into `bassDiv` slices — 2 (straight 8ths) for
  // hold's cruise, 4 (driving 16ths) for combat. The first slice of every
  // odd beat jumps an octave, same "pop" in either meter. Note length
  // shortens with the subdivision so dense 16ths don't smear into each other.
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

function mTick() {
  const c = musicGraph();
  if (!c) return;
  while (mNext < c.currentTime + 0.6) {
    mScheduleBeat(c, mBeat, mNext);
    mNext += mSpb();
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
