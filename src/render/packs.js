// Requisition pack presentation: the sealed box, the burst, and the fan of
// three cards to choose from.

import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {TIERNAME} from '../content/ranks.js';
import {packQueue} from '../state/session.js';
import {costOf} from '../save/progression.js';
import {packOffer, claimPack} from '../rules/packs.js';
import {$} from './dom.js';
import {sigil, artFor, bokehLayer} from './art.js';
import {sfx} from './sound.js';

const BURST_MS = 260;

export let packPicks = [];
let packOpen = false;

/** Runs once the whole queue has been worked through. Set by wiring.js. */
let afterPacks = () => {};
export const setAfterPacks = fn => { afterPacks = fn; };

/** Everything the pack card needs to render one offer. */
export function packArt(p) {
  if (p.kind === 'card') {
    const k = POOL[p.id];
    return {title: k.n, sub: TIERNAME[k.t], body: k.d, art: artFor(p.id, k.t, 86),
      cost: costOf(p.id), hp: k.hp, tier: k.t};
  }
  if (p.kind === 'gear') {
    const g = GEAR[p.id];
    return {title: g.n, sub: 'Gear', body: g.d, art: sigil(p.id, 'tech', 86), cost: '◈', hp: 0, tier: 'tech'};
  }
  if (p.kind === 'vet') {
    const k = POOL[p.id];
    return {title: k.n, sub: 'Field promotion',
      body: `+${p.amount} deployments logged — advances this card toward its next rank.`,
      art: artFor(p.id, k.t, 86, '#9d6bff'), cost: '★', hp: 0, tier: 'special'};
  }
  return {title: p.amount + ' Salvage', sub: 'Supplies', body: 'Raw materials for the Quartermaster.',
    art: sigil('salvage', 'tech', 86), cost: '◈', hp: 0, tier: 'tech'};
}

/** Present the next owed pack. Returns false when the queue is empty. */
export function showPack() {
  if (!packQueue.length) { packPicks = []; return false; }
  const job = packQueue.shift();
  packPicks = packOffer(job.tier);
  packOpen = false;

  const specialist = job.tier === 'specialist';
  $('packlabel').textContent = job.label || 'Requisition';
  $('packhint').textContent = 'Tap the pack to open';
  $('packbg').innerHTML = bokehLayer(specialist
    ? ['#ffc94d', '#9d6bff', '#ff4d8f']
    : ['#4de8ff', '#9d6bff', '#5dffa0']);
  $('packfoot').innerHTML = '';
  $('packstage').innerHTML = `<button class="packbox${specialist ? ' spec' : ''}" id="packbox">
      <span class="pbglow"></span>
      <span class="pbseal">${specialist ? 'SPECIALIST' : 'STANDARD'}</span>
      <span class="pbmark">◆</span>
      <span class="pbsub">Requisition Pack</span>
    </button>`;
  $('packbox').onclick = burstPack;
  $('pack').classList.add('on');
  return true;
}

export function burstPack() {
  if (packOpen) return;
  packOpen = true;
  sfx('pack');

  const flash = $('packflash');
  flash.classList.remove('go');
  void flash.offsetWidth;          // force a reflow so the animation replays
  flash.classList.add('go');

  const box = $('packbox');
  if (box) box.classList.add('burst');
  $('packhint').textContent = 'Choose one to keep — the others are returned';

  setTimeout(() => {
    $('packstage').innerHTML = `<div class="packfan">${packPicks.map((p, i) => {
      const a = packArt(p);
      return `<button class="packcard t-${a.tier}" data-pick="${i}" style="animation-delay:${i * 110}ms">
        <span class="pcart">${a.art}<span class="pccost">${a.cost}</span>
          ${a.hp ? `<span class="pchp">${a.hp} HULL</span>` : ''}</span>
        <span class="pcname">${a.title}</span>
        <span class="pcsub">${a.sub}</span>
        <span class="pctxt">${a.body}</span>
        <span class="pctake">Keep this</span>
      </button>`;
    }).join('')}</div>`;
    document.querySelectorAll('#packstage [data-pick]').forEach(b => {
      b.onclick = () => takePack(+b.dataset.pick);
    });
  }, BURST_MS);
}

export function takePack(i) {
  const p = packPicks[i];
  if (!p) return;
  claimPack(p);
  const a = packArt(p);

  document.querySelectorAll('#packstage [data-pick]').forEach(b => {
    b.classList.add(+b.dataset.pick === i ? 'taken' : 'returned');
    b.onclick = null;
  });
  $('packhint').textContent = '';
  $('packfoot').innerHTML = `<div class="packgot"><b>${a.title}</b> added to your collection</div>
    <button class="btn" id="packnext">${packQueue.length ? 'Next pack' : 'Continue'}</button>`;
  $('packnext').onclick = () => {
    $('pack').classList.remove('on');
    setTimeout(() => { if (!showPack()) afterPacks(); }, 120);
  };
}
