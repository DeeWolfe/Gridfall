// Requisition pack presentation: the sealed box, the burst, and the fan of
// three cards to choose from.

import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {packQueue} from '../state/session.js';
import {packOffer, claimPack} from '../rules/packs.js';
import {runDraftOffer, runDraftTake} from '../rules/roguelike.js';
import {$} from './dom.js';
import {sigil, artFor, bokehLayer, portrait} from './art.js';
import {sfx} from './sound.js';
import {focusCard, focusGear, focusLead} from './focus.js';

const BURST_MS = 260;

export let packPicks = [];
let packOpen = false;
// True while the overlay is showing a Deep Run draft rather than a pack: the
// offer came from the run and the pick goes back into it.
let packDraft = false;

/** Runs once the whole queue has been worked through. Set by wiring.js. */
let afterPacks = () => {};
export const setAfterPacks = fn => { afterPacks = fn; };

/** Everything the pack card needs to render one offer. Card picks carry no
 * sub-line — tier and stats stay in the shop and squad views; the pick's
 * rules text is already on the card. Non-card picks keep a kind label. */
function packArt(p) {
  if (p.kind === 'card') {
    const k = POOL[p.id];
    return {title: k.n, sub: '', body: k.d, art: artFor(p.id, k.t, 86), tier: k.t};
  }
  if (p.kind === 'gear') {
    const g = GEAR[p.id];
    return {title: g.n, sub: 'Gear', body: g.d, art: sigil(p.id, 'tech', 86), tier: 'tech'};
  }
  if (p.kind === 'lead') {
    const L = LEADS[p.id];
    const perk = [L.passive ? '◈ ' + L.passive.n + ' — ' + L.passive.d : '',
      L.con ? '▽ ' + L.con.n + ' — ' + L.con.d : ''].filter(Boolean).join('<br>');
    return {title: L.call, sub: L.role, body: perk || L.bio, art: portrait(p.id, 86), tier: 'special'};
  }
  if (p.kind === 'vet') {
    const k = POOL[p.id];
    return {title: k.n, sub: 'Field promotion',
      body: `+${p.amount} deployments logged — advances this card toward its next rank.`,
      art: artFor(p.id, k.t, 86, '#9d6bff'), tier: 'special'};
  }
  return {title: '+' + p.amount + ' Credits', sub: 'Bonus payout', body: 'Extra requisition credits — nothing wasted.',
    art: sigil('credits', 'tech', 86), tier: 'tech'};
}

/** Present the next owed pack. Returns false when the queue is empty. */
export function showPack() {
  if (!packQueue.length) { packPicks = []; return false; }
  const job = packQueue.shift();
  packDraft = !!job.draft;
  packPicks = packDraft ? runDraftOffer() : packOffer(job.tier);
  // A draft with nothing left to offer is not a beat worth showing — skip it
  // and take whatever is behind it in the queue.
  if (packDraft && !packPicks.length) return showPack();
  packOpen = false;

  const specialist = job.tier === 'specialist';
  $('packlabel').textContent = job.label || 'Requisition';
  $('packhint').textContent = packDraft ? 'Tap the cache to open' : 'Tap the pack to open';
  $('packbg').innerHTML = packDraft
    ? bokehLayer(['#4de8ff', '#9d6bff', '#5dffa0'])
    : bokehLayer(specialist
      ? ['#ffc94d', '#9d6bff', '#ff4d8f']
      : ['#4de8ff', '#9d6bff', '#5dffa0']);
  $('packfoot').innerHTML = '';
  $('packstage').innerHTML = `<button class="packbox${packDraft ? ' draft' : specialist ? ' spec' : ''}" id="packbox">
      <span class="pbglow"></span>
      <span class="pbseal">${packDraft ? 'SALVAGE' : specialist ? 'SPECIALIST' : 'STANDARD'}</span>
      <span class="pbmark">${packDraft ? '▣' : '◆'}</span>
      <span class="pbsub">${packDraft ? 'Field Cache' : 'Requisition Pack'}</span>
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
  $('packhint').textContent = packDraft
    ? 'Choose one to take deeper — the rest stay in the dirt'
    : 'Choose one to keep — the others are returned';

  setTimeout(() => {
    $('packstage').innerHTML = `<div class="packfan">${packPicks.map((p, i) => {
      const a = packArt(p);
      // A pack pick's flavour text alone isn't the full story — the same
      // stats a shop or squad tile shows a tap away live behind this one too,
      // so choosing doesn't mean choosing blind.
      const inspectable = p.kind === 'card' || p.kind === 'gear' || p.kind === 'vet' || p.kind === 'lead';
      return `<div class="packcard t-${a.tier}" data-pick="${i}" style="animation-delay:${i * 110}ms">
        <button class="pclook"${inspectable ? ` data-inspect="${i}"` : ' disabled'} title="${inspectable ? 'Tap to inspect' : ''}">
          <span class="pcart">${a.art}</span>
          <span class="pcname">${a.title}</span>
          ${a.sub ? `<span class="pcsub">${a.sub}</span>` : ''}
          <span class="pctxt">${a.body}</span>
        </button>
        <button class="pctake" data-take="${i}">Keep this</button>
      </div>`;
    }).join('')}</div>`;
    document.querySelectorAll('#packstage [data-take]').forEach(b => {
      b.onclick = () => takePack(+b.dataset.take);
    });
    document.querySelectorAll('#packstage [data-inspect]').forEach(b => {
      b.onclick = () => {
        const p = packPicks[+b.dataset.inspect];
        if (p.kind === 'gear') focusGear(p.id, true);
        else if (p.kind === 'lead') focusLead(p.id, 'view');
        else focusCard(p.id);
      };
    });
  }, BURST_MS);
}

export function takePack(i) {
  const p = packPicks[i];
  if (!p) return;
  if (packDraft) runDraftTake(p); else claimPack(p);
  const a = packArt(p);

  document.querySelectorAll('#packstage [data-pick]').forEach(el => {
    el.classList.add(+el.dataset.pick === i ? 'taken' : 'returned');
  });
  document.querySelectorAll('#packstage [data-take]').forEach(b => { b.onclick = null; });
  document.querySelectorAll('#packstage [data-inspect]').forEach(b => { b.onclick = null; });
  $('packhint').textContent = '';
  $('packfoot').innerHTML = `<div class="packgot"><b>${a.title}</b> ${packDraft
    ? (p.kind === 'lead' ? 'has the run' : 'goes with you')
    : 'added to your collection'}</div>
    <button class="btn" id="packnext">${packQueue.length ? 'Next pack' : 'Continue'}</button>`;
  $('packnext').onclick = () => {
    $('pack').classList.remove('on');
    setTimeout(() => { if (!showPack()) afterPacks(); }, 120);
  };
}
