// The pre-operation codec call: gating, the beat-by-beat walk, and the
// handoff back to the map.
//
// The scene is data, so this guards the contract between the two: every
// operation that ships an intro must be playable, the call must run exactly
// once per commander per operation, and it must always end by handing control
// back — a transmission that swallows the map would strand the player on the
// ops screen with no way forward.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {OPS} from '../src/content/operations.js';
import {BOSSDEF} from '../src/content/bosses.js';
import {playIntro, introSeen, replayIntros, closeCodec, playBossBrief, briefSeen,
  playBossDebrief, debriefSeen} from '../src/render/codec.js';

const F = failures();
const p = A.blankProfile('CODEC');
A.setActive(p);

// --- the data every intro must satisfy ---
const withIntro = Object.values(OPS).filter(o => o.intro);
console.log('operations with an intro call:', withIntro.map(o => o.k).join(', ') || 'none');
if (!withIntro.length) F.push('no operation ships an intro call');
for (const o of withIntro) {
  const i = o.intro;
  if (!Array.isArray(i.beats) || !i.beats.length) F.push(`${o.k}: intro has no beats`);
  if (!i.from || !i.from.n) F.push(`${o.k}: intro names no caller`);
  (i.beats || []).forEach((b, n) => {
    if (!Array.isArray(b.say) || !b.say.length) F.push(`${o.k} beat ${n}: nothing said`);
    if (!b.reply) F.push(`${o.k} beat ${n}: no reply for the commander`);
  });
}

// --- an operation with no intro falls straight through ---
const noIntro = Object.values(OPS).find(o => !o.intro);
if (noIntro && playIntro(noIntro.k, () => {})) F.push(`${noIntro.k} has no intro but played one`);
console.log('operation without an intro plays nothing:', !noIntro || !get('codec')._cls.has('on'));

// --- walk the whole scene ---
const target = withIntro[0];
let landed = 0;
const played = playIntro(target.k, () => landed++);
if (!played) F.push(`${target.k}: intro refused to play for a fresh commander`);
if (!get('codec')._cls.has('on')) F.push('codec overlay never opened');
if (landed) F.push('the map opened before the call finished');

/** The last button the scene appended carrying `kind`. */
const act = kind => [...get('cacts').children].filter(b => b.dataset.codec === kind).pop();

for (let n = 0; n < target.intro.beats.length; n++) {
  const reply = act('reply');
  if (!reply) { F.push(`beat ${n}: no reply button`); break; }
  // Mid-call replies are the wordless dots — the commander's words appear
  // once, typed on the channel, never printed on the button first. Only the
  // final reply (the sign-off decision) wears its words up front.
  const last = n === target.intro.beats.length - 1;
  if (last) {
    if (!reply._text) F.push('the final reply lost its words');
  } else {
    if (!reply._cls.has('cmore')) F.push(`beat ${n}: mid-call reply is not the dots`);
    if (reply._text) F.push(`beat ${n}: mid-call reply shows "${reply._text}" before it is spoken`);
    if (!reply.getAttribute('aria-label')) F.push(`beat ${n}: wordless reply names nothing for a screen reader`);
  }
  reply.onclick();
  if (get('cwell').dataset.who !== 'you') F.push(`beat ${n}: reply did not switch the speaker`);
  const more = act('more');
  if (!more) { F.push(`beat ${n}: no continue affordance after the reply`); break; }
  more.onclick();
}
console.log('beats walked:', target.intro.beats.length);

const go = act('go');
if (!go) F.push('the call never reached its sign-off');
// Every control that only means "next part" wears the same cycling dots — the
// sign-off included. A worded button reads as a decision; these are a beat of
// silence on an open channel.
else {
  if (!go._cls.has('cmore')) F.push('the sign-off is not the dots animation');
  if (go._text) F.push(`the sign-off carries the words "${go._text}"`);
  if (!go.getAttribute('aria-label')) F.push('the wordless sign-off names no destination');
  const more = [...get('cacts').children].filter(x => x.dataset.codec === 'more');
  if (more.some(x => !x._cls.has('cmore'))) F.push('a continue control is not the dots');
}
if (landed) F.push('the map opened before the sign-off was acknowledged');
if (go) go.onclick();
console.log('map opened exactly once:', landed === 1);
if (landed !== 1) F.push(`map handoff ran ${landed} times, expected 1`);
if (get('codec')._cls.has('on')) F.push('codec overlay stayed open after the handoff');

// --- once per commander, until Settings says otherwise ---
if (!introSeen(target.k)) F.push('a played call was not recorded as seen');
if (playIntro(target.k, () => {})) F.push('the call played a second time');
replayIntros();
if (introSeen(target.k)) F.push('Settings reset did not clear the seen flag');
if (!playIntro(target.k, () => {})) F.push('the call did not play again after a reset');
console.log('plays once, replays on request: ok');

// --- skipping still hands control back ---
let skipped = 0;
closeCodec();
replayIntros();
playIntro(target.k, () => skipped++);
get('cskip').onclick();
const skipGo = act('go');
if (!skipGo) F.push('skip did not reach the sign-off');
else skipGo.onclick();
console.log('skip still opens the map:', skipped === 1);
if (skipped !== 1) F.push(`skip handed off ${skipped} times, expected 1`);

// --- the pre-fight briefing and after-action debrief: same chassis, same contract ---
{
  closeCodec();
  for (const k of Object.keys(BOSSDEF)) {
    for (const kind of ['brief', 'debrief']) {
      const br = BOSSDEF[k][kind];
      if (!br) { F.push(`${k}: no ${kind}`); continue; }
      if (!Array.isArray(br.beats) || !br.beats.length) F.push(`${k}: ${kind} has no beats`);
      if (!br.from || !br.from.n) F.push(`${k}: ${kind} names no caller`);
      (br.beats || []).forEach((b, n) => {
        if (!Array.isArray(b.say) || !b.say.length) F.push(`${k} ${kind} beat ${n}: nothing said`);
        if (!b.reply) F.push(`${k} ${kind} beat ${n}: no reply for the commander`);
      });
    }
  }

  // Walk one through the skip path: the drop must wait for the sign-off and
  // then happen exactly once.
  let dropped = 0;
  if (!playBossBrief('gantry', () => dropped++)) F.push('gantry briefing refused a fresh commander');
  if (!get('codec')._cls.has('on')) F.push('briefing overlay never opened');
  if (dropped) F.push('the drop launched before the channel closed');
  get('cskip').onclick();
  const briefGo = act('go');
  if (!briefGo) F.push('briefing skip did not reach the sign-off');
  else briefGo.onclick();
  if (dropped !== 1) F.push(`briefing handed off ${dropped} times, expected 1`);
  console.log('boss briefing plays and hands off the drop:', dropped === 1);

  // Once per commander; the same Settings reset that replays intros replays it.
  if (!briefSeen('gantry')) F.push('a taken briefing was not recorded as seen');
  if (playBossBrief('gantry', () => {})) F.push('the briefing played a second time');
  replayIntros();
  if (briefSeen('gantry')) F.push('Settings reset did not clear the briefing flag');
  closeCodec();
  console.log('briefing plays once, replays on request: ok');

  // The after-action call: same walk, same once-per-commander gate.
  let debriefed = 0;
  if (!playBossDebrief('gantry', () => debriefed++)) F.push('gantry debrief refused a fresh kill');
  get('cskip').onclick();
  const dGo = act('go');
  if (!dGo) F.push('debrief skip did not reach the sign-off');
  else dGo.onclick();
  if (debriefed !== 1) F.push(`debrief handed off ${debriefed} times, expected 1`);
  if (!debriefSeen('gantry')) F.push('a taken debrief was not recorded as seen');
  if (playBossDebrief('gantry', () => {})) F.push('the debrief played a second time');
  replayIntros();
  if (debriefSeen('gantry')) F.push('Settings reset did not clear the debrief flag');
  closeCodec();
  console.log('after-action debrief plays once and hands back:', debriefed === 1);
}

F.report('codec call: gating, walk-through, boss briefing and handoff all hold');
