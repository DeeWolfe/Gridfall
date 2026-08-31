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
import {playIntro, introSeen, replayIntros, closeCodec} from '../src/render/codec.js';

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

F.report('codec call: gating, walk-through and handoff all hold');
