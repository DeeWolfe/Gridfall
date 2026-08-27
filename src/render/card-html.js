// The small card tile used in the Squad, Quartermaster and Database grids.

import {DECKSIZE} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {TIERNAME} from '../content/ranks.js';
import {active} from '../state/session.js';
import {costOf, gearOf, vetOf} from '../save/progression.js';
import {sigil} from './art.js';
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
  const tip = `${k.n} — ${TIERNAME[k.t]} · ${costOf(id)} DP${k.hp ? ' · ' + hull + ' hull' : ''}\n${k.d}` +
    `${g ? '\nGear: ' + g.n + ' — ' + g.d : ''}${v.t ? '\nRank: ' + v.n + ' (' + v.u + ' deployments)' : ''}`;

  const traits = TIERNAME[k.t] + (k.attach ? ' · Attach' : '') + (k.size > 1 ? ' · 2 cells' : '') +
    (k.mob || k.attach ? '' : ' · Anchored');

  return `<button class="gcard t-${k.t}${cls} v${v.t}" title="${attr(tip)}" data-focus="${id}" data-mode="${mode}">
    <div class="gart">${sigil(id, k.t, null, v.t >= 2 ? v.col : null)}<div class="gcost">${costOf(id)}</div>
      ${k.hp ? `<div class="ghp">${hull} HP</div>` : ''}
      ${v.t ? `<div class="pips">${'◆'.repeat(v.t)}</div>` : ''}</div>
    <div class="gname">${k.n}</div>
    <div class="gtype">${traits}</div>
    <div class="gtxt">${k.d}</div>${g ? `<div class="gtag">◈ ${g.n}</div>` : ''}${foot}</button>`;
}
