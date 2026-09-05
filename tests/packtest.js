// Requisition packs: what an offer contains, the fallback chain as the
// collection fills, and the full open-and-choose flow.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get, flushTimers} from './support/dom.js';
import {failures} from './support/harness.js';
import {packOffer} from '../src/rules/packs.js';
import {showPack, burstPack, takePack, packPicks} from '../src/render/packs.js';
import {closeFocus} from '../src/render/focus.js';
import {unlockAll} from './support/fixtures.js';

const F = failures();
const p = A.blankProfile('PK');
A.enterProfile(p);

// 1. a standard offer: three distinct items, no Specialists, at least one
//    unowned card, and owned draws arrive as promotions rather than blanks
{
  const offer = packOffer('standard');
  if (offer.length !== 3) F.push('offer should hold 3 items, got ' + offer.length);
  offer.forEach(x => {
    if (x.kind === 'card' && p.unlocks.cards.includes(x.id)) F.push('offered a card already owned');
    if (x.kind === 'vet' && !p.unlocks.cards.includes(x.id)) F.push('offered a promotion for an unowned card');
    if ((x.kind === 'card' || x.kind === 'vet') && A.POOL[x.id].t === 'special') {
      F.push('standard pack offered a Specialist (' + x.id + ')');
    }
  });
  if (!offer.some(x => x.kind === 'card')) F.push('no unowned card offered while plenty remain');
  if (new Set(offer.map(x => x.id)).size !== 3) F.push('offer contains duplicates');
}

// 2. a specialist offer is Specialist-tier only
{
  packOffer('specialist').forEach(x => {
    if ((x.kind === 'card' || x.kind === 'vet') && A.POOL[x.id].t !== 'special') {
      F.push('specialist pack offered a ' + A.POOL[x.id].t + ' card');
    }
  });
}

// 2b. one common left unowned: the offer guarantees it, and the other slots
//     are duplicates offered as +12-deployment promotions
{
  const q = A.blankProfile('DUP');
  A.enterProfile(q);
  const nonSpecial = Object.keys(A.POOL).filter(id => A.POOL[id].t !== 'special');
  q.unlocks.cards = nonSpecial.slice(1);
  const offer = packOffer('standard');
  const cards = offer.filter(x => x.kind === 'card');
  const vets = offer.filter(x => x.kind === 'vet');
  if (cards.length !== 1 || cards[0].id !== nonSpecial[0]) {
    F.push('the last unowned card was not guaranteed a slot');
  }
  if (vets.length !== 2) F.push('duplicates should be offered as promotions, got ' + vets.length);
  vets.forEach(v => {
    if (v.amount !== 12) F.push('promotion should log 12 deployments, got ' + v.amount);
  });
  const before = (q.usage && q.usage[vets[0].id]) || 0;
  A.claimPack(vets[0]);
  if (((q.usage || {})[vets[0].id] || 0) !== before + 12) F.push('claimed promotion did not add deployments');
  A.enterProfile(p);
}

// 3. claiming adds the card and slots it into the deck if there is room
{
  const before = [...p.unlocks.cards];
  const pick = packOffer('standard').find(x => x.kind === 'card');
  A.claimPack(pick);
  if (!p.unlocks.cards.includes(pick.id)) F.push('claimed card not added to collection');
  if (p.unlocks.cards.length !== before.length + 1) F.push('claim changed collection size incorrectly');
}

// 4. a full collection degrades to gear, then veterancy and credits — never empty
{
  p.unlocks.cards = Object.keys(A.POOL);
  let offer = packOffer('standard');
  if (offer.length !== 3) F.push('offer went short once cards ran out');
  if (offer.some(x => x.kind === 'card')) F.push('offered a card the player already owns');
  if (!offer.some(x => x.kind === 'gear')) F.push('should fall back to gear first');

  p.unlocks.gear = Object.keys(A.GEAR);
  offer = packOffer('standard');
  if (offer.length !== 3) F.push('offer went short with everything owned');
  if (offer.some(x => x.kind === 'card' || x.kind === 'gear')) F.push('offered something already owned');
  if (!offer.every(x => x.kind === 'vet' || x.kind === 'credits')) {
    F.push('final fallback is not veterancy or credits');
  }

  const vet = offer.find(x => x.kind === 'vet');
  if (vet) {
    const before = (p.usage && p.usage[vet.id]) || 0;
    A.claimPack(vet);
    if (((p.usage || {})[vet.id] || 0) !== before + vet.amount) F.push('veterancy award did not apply');
  }
  const creditsPick = offer.find(x => x.kind === 'credits');
  if (creditsPick) {
    const before = p.progress.credits;
    A.claimPack(creditsPick);
    if (p.progress.credits !== before + creditsPick.amount) F.push('credits award did not apply');
  }
}

// 5. the reveal flow: sealed pack -> burst -> three cards -> pick one
{
  const q = A.blankProfile('FLOW');
  A.enterProfile(q);
  A.setPackQueue([]);
  A.queuePack('standard', 'Node secured');
  if (A.packQueue.length !== 1) F.push('queuePack did not enqueue');

  if (!showPack()) F.push('showPack returned false with a pack queued');
  if (!get('pack')._cls.has('on')) F.push('pack overlay did not open');
  if (!get('packstage')._html.includes('packbox')) F.push('closed pack not rendered');
  if (get('packstage')._html.includes('data-pick')) F.push('cards visible before opening');

  burstPack();
  if (!get('packflash')._cls.has('go')) F.push('flash did not fire');
  flushTimers();

  const revealed = (get('packstage')._html.match(/data-pick=/g) || []).length;
  if (revealed !== 3) F.push('expected 3 revealed cards, got ' + revealed);

  // A pick's flavour text is on the card, but its hard stats (DP cost, hull,
  // targeting) are not — that's what the inspect button opens, over the same
  // focus popup a shop or squad tile uses. Only card/gear/vet picks carry it;
  // a flat credits bonus has nothing further to show.
  const inspectButtons = [...document.querySelectorAll('#packstage [data-inspect]')];
  if (inspectButtons.length !== packPicks.filter(p => p.kind !== 'credits').length) {
    F.push('expected an inspect button on every non-credits pick');
  }
  if (inspectButtons.length) {
    inspectButtons[0].onclick();
    if (!get('focus')._cls.has('on')) F.push('inspecting a pick did not open the focus view');
    const inspected = packPicks[+inspectButtons[0].dataset.inspect];
    const expectedName = inspected.kind === 'gear' ? A.GEAR[inspected.id].n : A.POOL[inspected.id].n;
    if (!get('fwrap')._html.includes(expectedName)) F.push('focus view did not show the inspected pick');
    closeFocus();
    if (get('focus')._cls.has('on')) F.push('closing the focus view left it open');
    if (!get('pack')._cls.has('on')) F.push('closing the focus view also closed the pack overlay');
  }

  const owned = [...q.unlocks.cards];
  const firstKind = packPicks[0].kind;
  takePack(0);
  if (firstKind === 'card' && q.unlocks.cards.length !== owned.length + 1) {
    F.push('taking a card did not grant it');
  }
  const cards = document.querySelectorAll('#packstage [data-pick]');
  const taken = cards.filter(b => b._cls.has('taken'));
  const returned = cards.filter(b => b._cls.has('returned'));
  if (taken.length !== 1) F.push('expected exactly one card marked taken, got ' + taken.length);
  if (returned.length !== 2) F.push('expected two cards returned, got ' + returned.length);
  const takeButtons = document.querySelectorAll('#packstage [data-take]');
  if (takeButtons.some(b => b.onclick)) F.push('cards still clickable after a pick');
  if (!get('packfoot')._html.includes('Continue') && !get('packfoot')._html.includes('Next')) {
    F.push('no continuation control after picking');
  }
}

// 6. queued packs chain rather than overlapping
{
  A.setPackQueue([]);
  A.queuePack('standard', 'one');
  A.queuePack('specialist', 'two');
  showPack();
  if (A.packQueue.length !== 1) F.push('showPack should consume one pack at a time');
  if (get('packlabel')._text !== 'one') F.push('wrong pack shown first');
}

// 7. buying a pack: deducts the price, refuses when broke, and roughly one
//    in eight arrives upgraded to a Specialist priority requisition
{
  const q = A.blankProfile('BUY');
  A.enterProfile(q);
  A.setPackQueue([]);

  q.progress.credits = A.PACK_PRICE - 1;
  if (A.purchasePack()) F.push('purchase should refuse when credits fall short');
  if (q.progress.credits !== A.PACK_PRICE - 1) F.push('refused purchase still took credits');
  if (A.packQueue.length) F.push('refused purchase still queued a pack');

  const TRIES = 200;
  q.progress.credits = A.PACK_PRICE * TRIES;
  for (let i = 0; i < TRIES; i++) {
    if (!A.purchasePack()) F.push('purchase failed with credits available');
  }
  if (q.progress.credits !== 0) F.push('purchases did not deduct exactly the pack price');
  if (A.packQueue.length !== TRIES) F.push('each purchase should queue exactly one pack');
  const priority = A.packQueue.filter(x => x.tier === 'specialist').length;
  // Binomial(200, .125): mean 25, sd ~4.7 — 8..45 is comfortably 4 sigma.
  if (priority < 8 || priority > 45) {
    F.push(`priority upgrades far from 1-in-8: ${priority}/${TRIES}`);
  }
  A.setPackQueue([]);
}

// 8. campaign packs arrive every PACK_METER_GOAL-th node secured
{
  const q = A.blankProfile('METER');
  A.enterProfile(q);
  A.setPackQueue([]);
  for (let win = 1; win <= A.PACK_METER_GOAL * 2; win++) {
    const open = Object.keys(A.opRun().nodes).filter(id => A.nodeState(id) === 'open');
    A.launch(open[0]);
    A.finish(true, '');
    A.setG(null);
    const expected = Math.floor(win / A.PACK_METER_GOAL);
    // Completing the whole operation pays its own first-clear bundle (two
    // standard, one specialist), so the meter is counted by its own label
    // rather than by tier — otherwise finishing the map looks like the meter
    // running fast.
    const meter = A.packQueue.filter(x => x.label === 'Node secured').length;
    if (meter !== expected) {
      F.push(`after ${win} wins expected ${expected} meter packs, got ${meter}`);
    }
  }
}

// 7. Onslaught pays per wave survived — and not for sitting still
//
// The interval was 5, which is exactly where an idle run ends: deploy nothing,
// tap End turn, and the line falls on wave 5 in 97 runs out of 100. The mode
// paid a free pack for that. This drives real idle runs rather than asserting
// the constant, so the guard fails if either the interval drops back OR the
// wave ramp softens far enough that idling starts reaching it again.
{
  A.enterProfile(unlockAll(A.blankProfile('IDLE')));
  let paid = 0;
  let deepest = 0;
  for (let n = 0; n < 25; n++) {
    A.setPackQueue([]);
    A.launchOnslaught();
    let guard = 0;
    while (!A.G.over && guard++ < 500) A.endTurn();
    deepest = Math.max(deepest, A.G.turn);
    paid += A.packQueue.length;
    A.setG(null);
  }
  if (paid) F.push(`idling through Onslaught paid ${paid} pack(s) across 25 runs — it should pay none`);
  // And the payout still works for someone who actually holds a line.
  A.setPackQueue([]);
  A.launchOnslaught();
  A.G.turn = 20;
  A.finish(false, '');
  if (A.packQueue.length !== 2) {
    F.push(`surviving 20 waves paid ${A.packQueue.length} packs, expected 2`);
  }
  A.setG(null);
}

// 8. clearing an operation pays a first-clear bundle — once, ever
//
// The whole point of the record is that it outlives the run: `ops` is thrown
// away by a replay, a reroll or an Ironman loss, so the payout has to hang off
// something else or a commander could farm the bundle by rerolling the map.
{
  const clearOp = () => {
    let guard = 0;
    while (!A.opComplete() && guard++ < 40) {
      const open = Object.keys(A.opRun().nodes).filter(id => A.nodeState(id) === 'open');
      if (!open.length) break;
      A.launch(open[0]);
      A.finish(true, '');
      A.setG(null);
    }
  };
  const bundle = () => A.packQueue.filter(x => /first clear/.test(x.label));

  A.enterProfile(A.blankProfile('FIRST'));
  if (A.opCleared(A.active.op)) F.push('a fresh commander already has an operation on record');
  A.setPackQueue([]);
  const op = A.active.op;
  clearOp();
  if (!A.opComplete()) F.push('could not clear the operation');
  if (!A.opCleared(op)) F.push('clearing the operation did not go on the record');

  const first = bundle();
  const std = first.filter(x => x.tier === 'standard').length;
  const spec = first.filter(x => x.tier === 'specialist').length;
  if (std !== 2 || spec !== 1) {
    F.push(`first clear paid ${std} standard + ${spec} specialist, expected 2 + 1`);
  }

  // Reroll the map and clear it again: credits yes, bundle no.
  A.setPackQueue([]);
  A.genRun();
  if (!A.opCleared(op)) F.push('a reroll wiped the completion record');
  clearOp();
  if (bundle().length) F.push(`a repeat clear paid ${bundle().length} first-clear pack(s)`);

  // And the record survives a save round trip.
  A.commit();
  const back = A.initProfiles().find(x => x.callsign === 'FIRST');
  if (!back || !back.opsDone || !back.opsDone[op]) F.push('the completion record did not persist');
}

F.report('requisition packs: all checks pass');
