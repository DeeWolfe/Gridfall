// Requisition packs: what an offer contains, the fallback chain as the
// collection fills, and the full open-and-choose flow.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get, flushTimers} from './support/dom.js';
import {failures} from './support/harness.js';
import {packOffer} from '../src/rules/packs.js';
import {showPack, burstPack, takePack, packPicks} from '../src/render/packs.js';

const F = failures();
const p = A.blankProfile('PK');
A.enterProfile(p);

// 1. a standard offer is three unowned cards
{
  const offer = packOffer('standard');
  if (offer.length !== 3) F.push('offer should hold 3 items, got ' + offer.length);
  offer.forEach(x => {
    if (x.kind === 'card' && p.unlocks.cards.includes(x.id)) F.push('offered a card already owned');
  });
  if (new Set(offer.map(x => x.id)).size !== 3) F.push('offer contains duplicates');
}

// 2. a specialist offer is Specialist-tier only
{
  packOffer('specialist').forEach(x => {
    if (x.kind === 'card' && A.POOL[x.id].t !== 'special') {
      F.push('specialist pack offered a ' + A.POOL[x.id].t + ' card');
    }
  });
}

// 3. claiming adds the card and slots it into the deck if there is room
{
  const before = [...p.unlocks.cards];
  const pick = packOffer('standard').find(x => x.kind === 'card');
  A.claimPack(pick);
  if (!p.unlocks.cards.includes(pick.id)) F.push('claimed card not added to collection');
  if (p.unlocks.cards.length !== before.length + 1) F.push('claim changed collection size incorrectly');
}

// 4. a full collection degrades to gear, then veterancy and salvage — never empty
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
  if (!offer.every(x => x.kind === 'vet' || x.kind === 'salvage')) {
    F.push('final fallback is not veterancy or salvage');
  }

  const vet = offer.find(x => x.kind === 'vet');
  if (vet) {
    const before = (p.usage && p.usage[vet.id]) || 0;
    A.claimPack(vet);
    if (((p.usage || {})[vet.id] || 0) !== before + vet.amount) F.push('veterancy award did not apply');
  }
  const salvage = offer.find(x => x.kind === 'salvage');
  if (salvage) {
    const before = p.progress.salvage;
    A.claimPack(salvage);
    if (p.progress.salvage !== before + salvage.amount) F.push('salvage award did not apply');
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

  const owned = [...q.unlocks.cards];
  const firstKind = packPicks[0].kind;
  takePack(0);
  if (firstKind === 'card' && q.unlocks.cards.length !== owned.length + 1) {
    F.push('taking a card did not grant it');
  }
  const buttons = document.querySelectorAll('#packstage [data-pick]');
  const taken = buttons.filter(b => b._cls.has('taken'));
  const returned = buttons.filter(b => b._cls.has('returned'));
  if (taken.length !== 1) F.push('expected exactly one card marked taken, got ' + taken.length);
  if (returned.length !== 2) F.push('expected two cards returned, got ' + returned.length);
  if (buttons.some(b => b.onclick)) F.push('cards still clickable after a pick');
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

F.report('requisition packs: all checks pass');
