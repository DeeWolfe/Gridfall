// The pre-operation codec call.
//
// A transmission from Central Command that fires the first time a commander
// opens an operation, before the sector map. It is pure presentation: the
// rules layer knows nothing about it, the scene is data (OPS[k].intro) rather
// than code, and an operation without an intro block simply skips it.
//
// Nothing advances on a timer. Hikaru's line types out, you tap your reply,
// your reply types out, and a cycling "..." waits for you to be ready. That is
// the whole interaction — the player sets the pace of the whole scene.

import {OPS} from '../content/operations.js';
import {BOSSDEF} from '../content/bosses.js';
import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {bokehLayer} from './art.js';
import {$} from './dom.js';

/** Who is on the other end. The commander's side is always the player. */
const CODEC_TONE = {them: 'var(--cyan)', you: 'var(--gold)'};

let codecScene = null;    // the intro block being played
let codecOp = null;       // its operation, for the footer caption
let codecDone = null;     // what to run once the channel closes
let codecType = null;     // in-flight typewriter interval

/**
 * Whether to land each line whole instead of typing it out. An environment
 * with no matchMedia at all (the test harness) counts as reduced: nowhere that
 * cannot answer the question should be driving an animation.
 */
const codecReduced = () => {
  if (typeof matchMedia !== 'function') return true;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; }
};

/**
 * Portraits in the language of art.js: one chassis, two ranks. Hikaru wears
 * the comms headset; the commander wears the same dome and visor under a
 * command crest, so the pair read as one service rather than two species.
 */
function codecFace(accent, kind) {
  const id = 'codecg-' + kind;
  const head = kind === 'them'
    ? `<path d="M30 90 L30 44 Q50 22 70 44 L70 90 Z" fill="url(#${id})" stroke="${accent}" stroke-width="2"/>
       <path d="M35 52 L65 52 L65 63 Q50 70 35 63 Z" fill="${accent}" opacity=".85"/>
       <path d="M28 46 Q28 30 50 30 Q72 30 72 46" fill="none" stroke="${accent}" stroke-width="2.4" opacity=".9"/>
       <rect x="21" y="43" width="9" height="16" rx="2.5" fill="${accent}" opacity=".9"/>
       <rect x="70" y="43" width="9" height="16" rx="2.5" fill="${accent}" opacity=".9"/>
       <path d="M26 59 Q25 75 40 78" fill="none" stroke="${accent}" stroke-width="2" opacity=".75"/>
       <circle cx="42" cy="78" r="3.2" fill="${accent}"/>
       <path d="M39 76 L61 76" stroke="${accent}" stroke-width="2" opacity=".45"/>`
    : `<path d="M30 90 L30 44 Q50 22 70 44 L70 90 Z" fill="url(#${id})" stroke="${accent}" stroke-width="2"/>
       <path d="M35 52 L65 52 L65 63 Q50 70 35 63 Z" fill="${accent}" opacity=".85"/>
       <path d="M39 76 L61 76" stroke="${accent}" stroke-width="2" opacity=".5"/>
       <path d="M43 83 L57 83" stroke="${accent}" stroke-width="2" opacity=".32"/>
       <path d="M50 20 L50 8" stroke="${accent}" stroke-width="3"/>
       <path d="M42 12 L50 5 L58 12" fill="none" stroke="${accent}" stroke-width="2.2"/>`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${accent}" stop-opacity=".32"/>
      <stop offset="1" stop-color="${accent}" stop-opacity=".05"/>
    </linearGradient></defs>
    <rect width="100" height="100" fill="#0b0918"/>${head}</svg>`;
}

/** The chassis. Painted once per call; only the well and the pips change after. */
function codecShell() {
  const s = codecScene;
  const pips = s.beats.map(() => '<i></i>').join('');
  $('codec').innerHTML =
    `<div class="cbg"></div><div class="cbok">${bokehLayer(['#4de8ff', '#9d6bff', '#5dffa0'])}</div>
    <div class="cbox" role="dialog" aria-label="Incoming transmission">
      <div class="cfreq">
        <span class="cdot"></span><span class="cjp">${s.net || '残心ネット'}</span>
        <span>CC uplink</span><span class="cnum">${s.freq || '000.00'}</span>
        <span class="cr" id="cstage">channel open</span>
      </div>
      <div class="crow">
        <div class="cport l" id="cportl">
          <div class="cpic">${codecFace(CODEC_TONE.them, 'them')}</div>
          <div class="cwho"><b>${s.from.n}</b>${s.from.r}</div>
          <div class="ceq"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <div class="cwell" id="cwell" data-who="them">
          <div class="csaid" id="csaid"></div>
          <div class="cacts" id="cacts"></div>
        </div>
        <div class="cport r" id="cportr">
          <div class="cpic">${codecFace(CODEC_TONE.you, 'you')}</div>
          <div class="cwho"><b>${active ? active.callsign : 'You'}</b>Task Force Cmd</div>
          <div class="ceq"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
      </div>
      <div class="cfoot">
        <div class="cpips" id="cpips">${pips}</div>
        <span class="ccap">${s.cap || (codecOp ? codecOp.n : '')}</span>
        <button class="cskip" id="cskip">Skip transmission</button>
      </div>
    </div>`;
  $('codec').classList.add('on');
  $('cskip').onclick = codecFinish;
}

function codecSpeaker(who) {
  $('cwell').dataset.who = who;
  $('cportl').classList.toggle('on', who === 'them');
  $('cportr').classList.toggle('on', who === 'you');
}

function codecPips(n) {
  [...$('cpips').children].forEach((el, i) => el.classList.toggle('on', i <= n));
}

/** Types `lines` into the well, then runs `after`. Reduced motion lands it whole. */
function codecTypeOut(lines, cls, after) {
  clearInterval(codecType);
  const said = $('csaid');
  said.className = 'csaid' + (cls ? ' ' + cls : '');
  const full = lines.join('\n\n');
  if (codecReduced()) { said.textContent = full; after(); return; }
  said.textContent = '';
  const cur = document.createElement('span');
  cur.className = 'ccur';
  said.appendChild(cur);
  let i = 0;
  codecType = setInterval(() => {
    i = Math.min(full.length, i + 2);
    cur.remove();
    said.textContent = full.slice(0, i);
    said.appendChild(cur);
    if (i >= full.length) { clearInterval(codecType); codecType = null; cur.remove(); after(); }
  }, 16);
}

/**
 * Read-at-your-own-pace: a cycling "..." and nothing else.
 *
 * Every control that only means "I am ready for the next part" wears this,
 * the sign-off included. A worded button in the middle of a transmission reads
 * as a choice with consequences; the dots read as a beat of silence on an open
 * channel, which is what they are. The label lives in aria-label only, so a
 * screen reader still announces the destination without a word sitting next to
 * the dots. `kind` is what the harness and the tests address it by.
 */
function codecWait(onGo, label, kind) {
  const b = document.createElement('button');
  // The sign-off is the same dots in the channel's "clear to go" green, so the
  // one that leaves the call is still distinguishable from the ones inside it.
  b.className = 'cmore' + (kind === 'go' ? ' cgo' : '');
  b.setAttribute('aria-label', label || 'Continue');
  b.innerHTML = '<span class="cell"><i>.</i><i>.</i><i>.</i></span>';
  b.dataset.codec = kind || 'more';
  b.onclick = onGo;
  $('cacts').appendChild(b);
  try { b.focus(); } catch { /* headless */ }
}

function codecBeat(n) {
  if (n >= codecScene.beats.length) return codecFinish();
  codecPips(n);
  $('cstage').textContent = 'receiving';
  codecSpeaker('them');
  $('cacts').innerHTML = '';
  codecTypeOut(codecScene.beats[n].say, '', () => {
    $('cstage').textContent = 'awaiting reply';
    const b = document.createElement('button');
    b.className = 'creply';
    b.dataset.codec = 'reply';
    b.textContent = codecScene.beats[n].reply;
    b.onclick = () => codecReply(n);
    $('cacts').appendChild(b);
    try { b.focus(); } catch { /* headless */ }
  });
}

function codecReply(n) {
  $('cacts').innerHTML = '';
  $('cstage').textContent = 'transmitting';
  codecSpeaker('you');
  codecTypeOut([codecScene.beats[n].reply], 'you', () => {
    $('cstage').textContent = 'standing by';
    codecWait(() => codecBeat(n + 1));
  });
}

/** Sign-off: the channel closes and the map opens behind it. */
function codecFinish() {
  clearInterval(codecType);
  codecType = null;
  codecPips(codecScene.beats.length);
  $('cstage').textContent = 'channel closed';
  codecSpeaker('none');
  $('csaid').className = 'csaid';
  $('csaid').textContent = codecScene.close || 'Channel closed.';
  $('cacts').innerHTML = '';
  codecWait(closeCodec, 'Open the sector map', 'go');
}

/** Tear the overlay down and hand control back to whoever opened it. */
export function closeCodec() {
  clearInterval(codecType);
  codecType = null;
  codecScene = null;
  codecOp = null;
  $('codec').classList.remove('on');
  $('codec').innerHTML = '';
  const done = codecDone;
  codecDone = null;
  if (done) done();
}

/** True once this commander has already taken the call for this operation. */
export function introSeen(k) {
  return !!(active && active.settings && active.settings.intros && active.settings.intros[k]);
}

/**
 * Play `k`'s intro call, running `done` when the channel closes.
 * Returns false — having done nothing — when there is no call to play, so the
 * caller can fall straight through to the map.
 */
export function playIntro(k, done) {
  const op = OPS[k];
  if (!op || !op.intro || !op.intro.beats || !op.intro.beats.length) return false;
  if (introSeen(k)) return false;

  active.settings = active.settings || {};
  active.settings.intros = active.settings.intros || {};
  active.settings.intros[k] = true;
  commit();

  codecScene = op.intro;
  codecOp = op;
  codecDone = done;
  codecShell();
  codecBeat(0);
  return true;
}

/** True once this commander has taken the pre-fight call for this boss. */
export function briefSeen(k) {
  return !!(active && active.settings && active.settings.briefs && active.settings.briefs[k]);
}

/**
 * The pre-fight call: the sitrep that introduces an operation boss, played the
 * first time the commander launches its Kill Order node. Same chassis as the
 * operation intro — the scene is data (BOSSDEF[k].brief), it plays once per
 * commander, and `done` (the launch itself) runs only when the channel closes.
 * Returns false — having done nothing — when there is no call or it has been
 * taken, so the caller can fall straight through to the drop.
 */
export function playBossBrief(k, done) {
  const def = k && BOSSDEF[k];
  if (!def || !def.brief || !def.brief.beats || !def.brief.beats.length) return false;
  if (briefSeen(k)) return false;

  active.settings = active.settings || {};
  active.settings.briefs = active.settings.briefs || {};
  active.settings.briefs[k] = true;
  commit();

  codecScene = def.brief;
  codecOp = null;
  codecDone = done;
  codecShell();
  codecBeat(0);
  return true;
}

/** True once this commander has taken the after-action call for this boss. */
export function debriefSeen(k) {
  return !!(active && active.settings && active.settings.debriefs && active.settings.debriefs[k]);
}

/**
 * The after-action call: the lore beat that lands once a boss is down —
 * what the fight revealed about the world outside the grid. Plays over the
 * completed map the first time the commander walks away from the kill, once,
 * on the same chassis as everything else Central Command says.
 */
export function playBossDebrief(k, done) {
  const def = k && BOSSDEF[k];
  if (!def || !def.debrief || !def.debrief.beats || !def.debrief.beats.length) return false;
  if (debriefSeen(k)) return false;

  active.settings = active.settings || {};
  active.settings.debriefs = active.settings.debriefs || {};
  active.settings.debriefs[k] = true;
  commit();

  codecScene = def.debrief;
  codecOp = null;
  codecDone = done;
  codecShell();
  codecBeat(0);
  return true;
}

/** Settings hook: clear the seen flags so every call plays again. */
export function replayIntros() {
  if (!active) return;
  active.settings = active.settings || {};
  active.settings.intros = {};
  active.settings.briefs = {};
  active.settings.debriefs = {};
  commit();
}
