// Requisition packs: three items offered, keep one.
//
// Standard packs draw Commons and Tech only — Specialists come from the shop
// or from specialist packs (operation complete, gauntlet complete), so their
// price tags are real saving goals rather than lottery noise. One slot
// guarantees an unowned card while any remains; the other slots draw from the
// whole pool, and a duplicate is offered as a field promotion instead — the
// deployments it grants advance that card toward its next veterancy rank.
// Once the cards run out the guaranteed slot degrades to unowned gear, then
// promotions, then raw credits. The pack NEVER opens empty.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {active, packQueue} from '../state/session.js';
import {takeOne, chance} from '../state/rng.js';
import {commit} from '../save/profile.js';

const OFFER_SIZE = 3;
const PROMOTION_DEPLOYMENTS = 12;
const CONSOLATION_CREDITS = 40;

// Priced BELOW the average unowned Common/Tech single (~115 cr): the pack is
// the budget gamble, the exact card is the certainty premium — the structure
// that keeps both purchases sometimes-correct. See docs/NOTES.md.
export const PACK_PRICE = 100;

/** Chance a bought pack arrives upgraded to a Specialist pack. */
export const PRIORITY_CHANCE = 0.125;

/**
 * Buy a standard pack at the Quartermaster. Roughly one in eight arrives as a
 * priority requisition — a Specialist pack — the jackpot only packs can give.
 * Returns false (and changes nothing) when credits fall short.
 */
export function purchasePack() {
  if (!active || active.progress.credits < PACK_PRICE) return false;
  active.progress.credits -= PACK_PRICE;
  const priority = chance(PRIORITY_CHANCE);
  queuePack(priority ? 'specialist' : 'standard',
    priority ? 'Priority requisition' : 'Requisitioned drop');
  commit();
  return true;
}

/**
 * Roll an offer.
 * @param {'standard'|'specialist'} tier  specialist draws Specialist cards only
 * @returns {Array<{kind:'card'|'gear'|'vet'|'credits', id?:string, amount?:number}>}
 */
export function packOffer(tier) {
  const owned = active.unlocks.cards || [];
  const pool = Object.keys(POOL).filter(id =>
    tier === 'specialist' ? POOL[id].t === 'special' : POOL[id].t !== 'special');

  const out = [];

  // The guaranteed-progress slot: an unowned card from this pack's pool,
  // else a piece of unowned gear, else nothing special — the dupe slots below
  // take over.
  const unowned = pool.filter(id => !owned.includes(id));
  if (unowned.length) {
    out.push({kind: 'card', id: takeOne(unowned)});
  } else {
    const gear = Object.keys(GEAR).filter(k => !(active.unlocks.gear || []).includes(k));
    if (gear.length) out.push({kind: 'gear', id: takeOne(gear)});
  }

  // The remaining slots draw from the whole pool, owned or not. A duplicate
  // becomes a promotion for that card rather than a blank.
  const rest = pool.filter(id => !out.some(o => o.id === id));
  while (out.length < OFFER_SIZE && rest.length) {
    const id = takeOne(rest);
    out.push(owned.includes(id)
      ? {kind: 'vet', id, amount: PROMOTION_DEPLOYMENTS}
      : {kind: 'card', id});
  }
  while (out.length < OFFER_SIZE) out.push({kind: 'credits', amount: CONSOLATION_CREDITS});
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
  } else if (pick.kind === 'credits') {
    active.progress.credits += pick.amount;
  }
  commit();
}

/** Owe the player a pack. Delivered after the result card is dismissed. */
export function queuePack(tier, label) {
  packQueue.push({tier, label});
}
