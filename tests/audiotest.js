// The combat soundtrack, held to the audio handoff's checkable claims.
//
// Audio is hard to assert on, so this guards exactly what is provable without
// ears: the progression's chord tones (a transpose bug shows up here
// instantly), the single borrowed tone that gives the loop its character, the
// lead's closing fall to E, the pressure read that drives the build, the
// one-stage-per-rotation movement rule, the per-operation transpose table,
// and that the scheduler still books notes ahead of the clock rather than
// timer-per-note. Everything stays a silent no-op in the stub DOM.
import './support/install-dom.js';
import {failures, ROOT} from './support/harness.js';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  M_PROG, M_BASS16, M_LEAD, M_TRANSPOSE, opTranspose,
  pressureStage, buildStep, setMusicMood, startMusic, stopMusic,
} from '../src/render/music.js';
import {OPS} from '../src/content/operations.js';
import {launchSpec} from '../src/rules/mission.js';
import {blankProfile} from '../src/save/profile.js';
import {enterProfile} from '../src/rules/run.js';
import {G} from '../src/state/session.js';

const F = failures();
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const nm = m => NAMES[((m % 12) + 12) % 12];

// --- the progression is the handoff's, note for note ---
{
  const want = [
    {name: 'Em', root: 40, chord: [52, 55, 59], borrowed: false},
    {name: 'G',  root: 43, chord: [55, 59, 62], borrowed: false},
    {name: 'D',  root: 38, chord: [50, 54, 57], borrowed: false},
    {name: 'F',  root: 41, chord: [53, 57, 60], borrowed: true},
  ];
  if (M_PROG.length !== 4) F.push(`expected 4 bars, found ${M_PROG.length}`);
  want.forEach((w, i) => {
    const c = M_PROG[i];
    if (!c) return;
    if (c.name !== w.name) F.push(`bar ${i + 1}: chord ${c.name}, handoff says ${w.name}`);
    if (c.root !== w.root) F.push(`bar ${i + 1}: root ${c.root} vs ${w.root}`);
    if (c.chord.join() !== w.chord.join()) F.push(`bar ${i + 1}: chord [${c.chord}] vs [${w.chord}]`);
    if (!!c.borrowed !== w.borrowed) F.push(`bar ${i + 1}: borrowed flag wrong`);
  });
}

// --- the harmony: E natural minor plus exactly ONE borrowed tone, F. If a
// second pitch class ever leaks outside the key, or the F got "fixed" to F#,
// this is the alarm that says the loop lost its character ---
{
  const eMinor = [4, 6, 7, 9, 11, 0, 2];  // E F# G A B C D
  const outside = new Set();
  M_PROG.forEach(p => [p.root, ...p.chord].forEach(m => {
    if (!eMinor.includes(m % 12)) outside.add(nm(m));
  }));
  if (outside.size !== 1 || !outside.has('F'))
    F.push(`expected exactly one borrowed tone (F), found ${[...outside].join(', ') || 'none'}`);
  const flagged = M_PROG.filter(p => p.borrowed);
  if (flagged.length !== 1 || flagged[0].name !== 'F') F.push('the F chord is not the one flagged borrowed');
}

// --- the hook: the lead's last note of the fourth bar falls a semitone to E ---
{
  const last = M_LEAD[3][M_LEAD[3].length - 1];
  const before = M_LEAD[3][M_LEAD[3].length - 2];
  if (last[1] !== 52) F.push(`the lead ends on midi ${last[1]}, not E (52)`);
  if (before[1] - last[1] !== 1) F.push('the closing descent is not a semitone');
  M_LEAD.forEach((bar, i) => bar.forEach(([pos]) => {
    if (pos < 0 || pos > 15) F.push(`lead bar ${i + 1} places a note off the 16-step grid (${pos})`);
  }));
  if (M_BASS16.length !== 16) F.push('the sixteenth-bass gate is not one bar long');
}

// --- transport: a four-bar rotation at 118 BPM is 8.14s — the number every
// build-pacing claim in the handoff rests on ---
{
  const rot = 60 / 118 * 4 * 4;
  if (Math.abs(rot - 8.14) > 0.05) F.push(`rotation is ${rot.toFixed(2)}s, handoff says 8.14s`);
}

// --- per-operation colour: the three specified transposes, a value for every
// operation on the map, and a safe 0 for op-less modes ---
{
  if (M_TRANSPOSE.ironveil !== 0) F.push('ironveil should play as written (0)');
  if (M_TRANSPOSE.blackmarrow !== -1) F.push('blackmarrow should sit a semitone down');
  if (M_TRANSPOSE.sunderglass !== 3) F.push('sunderglass should sit a minor third up');
  Object.keys(OPS).forEach(op => {
    if (!(op in M_TRANSPOSE)) F.push(`operation ${op} has no transpose colour`);
  });
  Object.entries(M_TRANSPOSE).forEach(([op, tp]) => {
    if (!Number.isInteger(tp) || Math.abs(tp) > 6) F.push(`transpose for ${op} is out of taste (${tp})`);
  });
  if (opTranspose(null) !== 0 || opTranspose('endless-nowhere') !== 0)
    F.push('op-less modes should transpose by 0');
}

// --- the pressure read: quiet openings are quiet, worsening fights climb,
// easing fights fall, and boss phase two pegs it ---
{
  const fight = (over = {}) => ({
    over: false, turn: 1, waves: 10, enemies: [], breaches: 0,
    ter: Array.from({length: 5}, () => ['p', 'p', 'p', 'n', 'n', 'e', 'e', 'e']),
    ...over,
  });
  if (pressureStage(null) !== 0) F.push('no mission should read as pressure 0');
  if (pressureStage(fight()) !== 0) F.push('a quiet opening should read as 0');
  const mid = pressureStage(fight({turn: 6, enemies: new Array(4)}));
  if (mid < 2 || mid > 4) F.push(`mid-fight with a horde should read 2-4, got ${mid}`);
  const worst = pressureStage(fight({
    turn: 10, enemies: new Array(9), breaches: 2,
    ter: Array.from({length: 5}, () => ['p', 'n', 'n', 'n', 'n', 'e', 'e', 'e']),
  }));
  if (worst !== 5) F.push(`a collapsing fight should read 5, got ${worst}`);
  const eased = pressureStage(fight({turn: 6, enemies: []}));
  if (eased >= mid) F.push('clearing the board should drop the read');
  if (pressureStage(fight({boss: {phase: 2}})) !== 5) F.push('boss phase two must peg the read at 5');
  if (pressureStage(fight({boss: {phase: 1}})) > 1) F.push('boss phase one should still be read, not pegged');
  if (pressureStage(fight({over: true, turn: 10, breaches: 2})) !== 0) F.push('a finished mission should read 0');
}

// --- the movement rule: one stage per rotation, in both directions; the boss
// phase-two jump is the only teleport ---
{
  if (buildStep(0, 3) !== 1) F.push('the build must climb one stage at a time');
  if (buildStep(4, 1) !== 3) F.push('the build must also FALL one stage at a time');
  if (buildStep(2, 2) !== 2) F.push('a matched stage should hold');
  if (buildStep(1, 5, true) !== 5) F.push('boss phase two must jump straight to full');
  let stage = 0;
  const path = [];
  for (const target of [2, 2, 4, 4, 4, 1, 1, 1]) { stage = buildStep(stage, target); path.push(stage); }
  if (path.join() !== '1,2,3,4,4,3,2,1') F.push(`ramp walked ${path.join()}, expected 1,2,3,4,4,3,2,1`);
}

// --- live wiring: pressureStage accepts the real mission object, and every
// engine call is a silent no-op in the stub (no WebAudio here) ---
{
  enterProfile(blankProfile('AUD'));
  launchSpec({node: null, op: 'ironveil', type: 'stronghold', mod: 'none', reward: 0});
  const live = pressureStage(G);
  if (!(live >= 0 && live <= 5)) F.push(`live mission pressure out of range: ${live}`);
  try {
    startMusic();
    setMusicMood('combat');
    setMusicMood('boss');
    setMusicMood('hold');
    stopMusic();
  } catch (e) { F.push('music engine threw without WebAudio: ' + e.message); }
}

// --- the scheduler still books ahead of the clock. If someone simplifies it
// to a timer per note the timing will drift audibly; this reads what ships ---
{
  const src = readFileSync(join(ROOT, 'src/render/music.js'), 'utf8');
  if (!/while \(mNext < c\.currentTime \+ 0\.6\)/.test(src))
    F.push('lookahead scheduling not found in music.js — did the loop become a plain timer?');
  if (/setTimeout\(/.test(src)) F.push('music.js schedules with setTimeout — that will drift');
  const dist = readFileSync(join(ROOT, 'dist/gridfall.html'), 'utf8');
  if (!dist.includes('[53, 57, 60]')) F.push('the shipped page lost the borrowed F chord');
}

F.report('audio: all checks pass');
