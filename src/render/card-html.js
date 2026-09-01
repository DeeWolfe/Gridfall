// The small card tile used in the Squad, Quartermaster and Database grids.
// Ghost layout: no art panel, no stat chips — just the name over the card's
// ink-seal watermark, plus the tile's action state in the footer. Cost, hull
// and tier live in the focus view, one tap away (and in the hover tooltip).

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {TIERNAME} from '../content/ranks.js';
import {active} from '../state/session.js';
import {costOf, gearOf, vetOf, CHASSIS_NAME, cardName} from '../save/progression.js';
import {cardMark} from './portraits.js';
import {attr} from './dom.js';

/**
 * @param {string} id    card id
 * @param {'shop'|'deck'|'gear'|'info'} mode  decides the footer and what a tap does
 */
export function cardEl(id, mode) {
  const k = POOL[id];
  const g = gearOf(id);
  const owned = active.unlocks.cards.includes(id);
  const inDeck = active.loadout.deck.includes(id);
  const affordable = active.progress.credits >= k.price;

  let foot = '';
  let cls = '';
  if (mode === 'shop') {
    foot = owned ? '<div class="gfoot own">Owned</div>'
      : k.price === 0 ? '<div class="gfoot own">Issued</div>'
        : affordable ? `<div class="gfoot buy">${k.price} cr</div>`
          : `<div class="gfoot no">${k.price} cr</div>`;
    cls = owned ? ' owned' : (!affordable && k.price > 0 ? ' cant' : '');
  } else if (mode === 'proto') {
    // The Frame slot holds exactly one, so the footer is a radio button in
    // card form rather than an add/remove count.
    const fielded = active.loadout.frame === id;
    foot = fielded ? '<div class="gfoot own">Fielded</div>'
      : owned ? '<div class="gfoot add">Field it</div>'
        : `<div class="gfoot no">${k.price} cr</div>`;
    cls = fielded ? ' indeck' : owned ? '' : ' cant';
  } else if (mode === 'deck' || mode === 'gear') {
    foot = inDeck ? '<div class="gfoot rem">In deck</div>'
      : active.loadout.deck.length >= DECKSIZE ? '<div class="gfoot no">Deck full</div>'
        : '<div class="gfoot add">Add</div>';
    cls = inDeck ? ' indeck' : '';
  } else {
    foot = '<div class="gfoot no">Inspect</div>';
  }

  const v = vetOf(id);
  const hull = k.hp + (g && g.hp ? g.hp : 0);
  const tip = `${cardName(id)} — ${CHASSIS_NAME[k.chassis] || TIERNAME[k.t]} · ${costOf(id)} DP${k.hp ? ' · ' + hull + ' hull' : ''}\n${k.d}` +
    `${g ? '\nGear: ' + g.n + ' — ' + g.d : ''}${v.t ? '\nRank: ' + v.n + ' (' + v.u + ' deployments)' : ''}`;

  return `<button class="gcard t-${k.t}${cls} v${v.t}" title="${attr(tip)}" data-focus="${id}" data-mode="${mode}">
    ${cardMark(id, v.t >= 2 ? v.col : null)}
    <div class="tn">${cardName(id)}</div>
    ${v.t ? `<span class="pips">${'◆'.repeat(v.t)}</span>` : ''}
    ${g ? `<div class="gtag">◈ ${g.n}</div>` : ''}${foot}</button>`;
}
