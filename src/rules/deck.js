// The 12-card deck: drawing, and cycling the reserve when it runs dry.

import {POOL} from '../content/cards.js';
import {G, active} from '../state/session.js';
import {shuffle} from '../state/rng.js';
import {clog} from './log.js';

/**
 * Draw one card. An empty deck reshuffles from the loadout, minus whatever is
 * already in hand — so cycling never hands you a duplicate of a card you hold.
 */
export function drawCard() {
  if (!G.deck.length) {
    const back = active.loadout.deck.filter(c => POOL[c] && !G.hand.includes(c));
    if (!back.length) return;
    G.deck = shuffle([...back]);
    clog('<span class="t">Reserve cycled</span> — fresh requisition available.', 'info');
  }
  G.hand.push(G.deck.pop());
}
