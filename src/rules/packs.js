// Requisition packs: three items offered, keep one.
//
// The fallback chain matters more than it looks. As a collection fills, the
// pool of unowned cards empties, then unowned gear, then there is nothing
// left to give — so the chain degrades through field promotions to raw
// salvage. The pack NEVER opens empty; a player who owns everything still
// gets something for clearing a node.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {active, packQueue} from '../state/session.js';
import {takeOne} from '../state/rng.js';
import {commit} from '../save/profile.js';

const OFFER_SIZE = 3;
const PROMOTION_DEPLOYMENTS = 12;
const CONSOLATION_SALVAGE = 40;

/**
 * Roll an offer.
 * @param {'standard'|'specialist'} tier  specialist draws Specialist cards only
 * @returns {Array<{kind:'card'|'gear'|'vet'|'salvage', id?:string, amount?:number}>}
 */
export function packOffer(tier) {
  const owned = active.unlocks.cards || [];
  const cards = Object.keys(POOL).filter(id =>
    !owned.includes(id) && (tier === 'specialist' ? POOL[id].t === 'special' : true));

  const out = [];
  const draw = pool => {
    const c = [...pool];
    while (out.length < OFFER_SIZE && c.length) out.push({kind: 'card', id: takeOne(c)});
  };
  if (cards.length) draw(cards);

  if (out.length < OFFER_SIZE) {
    const gear = Object.keys(GEAR).filter(k => !(active.unlocks.gear || []).includes(k));
    const c = [...gear];
    while (out.length < OFFER_SIZE && c.length) out.push({kind: 'gear', id: takeOne(c)});
  }

  if (out.length < OFFER_SIZE) {
    const c = (active.loadout.deck || []).filter(id => POOL[id]);
    while (out.length < OFFER_SIZE && c.length) {
      out.push({kind: 'vet', id: takeOne(c), amount: PROMOTION_DEPLOYMENTS});
    }
    while (out.length < OFFER_SIZE) out.push({kind: 'salvage', amount: CONSOLATION_SALVAGE});
  }
  return out;
}

/** Take one item from an offer and write it into the profile. */
export function claimPack(pick) {
  if (pick.kind === 'card') {
    if (!active.unlocks.cards.includes(pick.id)) active.unlocks.cards.push(pick.id);
    // A new card slides straight into the deck while there is room for it.
    if (active.loadout.deck.length < DECKSIZE && !active.loadout.deck.includes(pick.id)) {
      active.loadout.deck.push(pick.id);
    }
  } else if (pick.kind === 'gear') {
    if (!active.unlocks.gear.includes(pick.id)) active.unlocks.gear.push(pick.id);
  } else if (pick.kind === 'vet') {
    active.usage = active.usage || {};
    active.usage[pick.id] = (active.usage[pick.id] || 0) + pick.amount;
  } else if (pick.kind === 'salvage') {
    active.progress.salvage += pick.amount;
  }
  commit();
}

/** Owe the player a pack. Delivered after the result card is dismissed. */
export function queuePack(tier, label) {
  packQueue.push({tier, label});
}
