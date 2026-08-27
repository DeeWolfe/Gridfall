// The combat screen: header, board, hand, selection panel and action bar.
//
// Everything here is a pure function of (G, active, sel, mover) — drawAll()
// rebuilds the screen from scratch each time rather than patching it, which is
// why the rules layer only has to say "something changed".

import {LANES, COLS} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {DOCTRINE} from '../content/doctrines.js';
import {TGNAME} from '../content/targeting-names.js';
import {TIERNAME} from '../content/ranks.js';
import {G, active, sel, mover, replaying, setSel, setMover} from '../state/session.js';
import {costOf, gearOf, vetOf, leadOf} from '../save/progression.js';
import {unitAt, foeAt, civAt, held, scorched, validTiles} from '../rules/board.js';
import {geomFor, candidatesFor, targetsFor} from '../rules/targeting.js';
import {buffOf, dmgPreview} from '../rules/units.js';
import {moveTargets, doMove, doAttack, doAbility} from '../rules/actions.js';
import {deploy} from '../rules/deploy.js';
import {endTurn} from '../rules/phases.js';
import {objText, abortMission} from '../rules/mission.js';
import {forecastThreat, supportTargets, influenceCells, supportLabel} from '../rules/forecast.js';
import {clog} from '../rules/log.js';
import {$, show} from './dom.js';
import {portrait, sigil} from './art.js';
import {ask, notify} from './dialog.js';
import {focusCard, focusEnemy, closeFocus} from './focus.js';
import {renderMap} from './map.js';
import {renderModes} from './modes.js';
import {sfx} from './sound.js';

const LEAD_DP_BONUS = 4;
const LOG_LINES = 40;

/** Leaving combat: back to the map, or to mode select for endless/gauntlet. */
export function leaveCombat() {
  const {wasEndless, wasGauntlet} = abortMission();
  $('result').classList.remove('on');
  closeFocus();
  if (wasEndless || wasGauntlet) { show('modes'); renderModes(); return; }
  show('map');
  renderMap();
}

/** The team-lead badge, and its once-per-mission active. */
function drawLeadBadge() {
  const L = leadOf();
  const badge = $('leadbadge');
  const ready = !!L.active && !G.leadUsed && !G.over;

  badge.innerHTML = `${portrait(active.lead || 'ironbrand')}
    <span class="lbname">${L.call}</span>
    ${L.active ? `<span class="lbtag${ready ? ' ready' : ''}">${G.leadUsed ? 'SPENT' : 'READY'}</span>` : ''}`;
  badge.className = 'leadbadge' + (ready ? ' ready' : '');
  badge.style.borderColor = L.col;

  badge.onclick = () => {
    if (ready) {
      ask(L.active.n, L.active.d + '<br><br>Use it now?', ok => {
        if (!ok) return;
        G.leadUsed = true;
        G.dp += LEAD_DP_BONUS;
        clog(`<span class="g">${L.call} — ${L.active.n}</span>: +${LEAD_DP_BONUS} deploy points.`, 'order');
        drawAll();
      }, {ok: 'Commit'});
    } else {
      const perk = L.passive || L.active;
      notify(L.call + ' · ' + L.role,
        perk.n + ' — ' + perk.d + (G.leadUsed ? '<br><br>Already spent this mission.' : ''));
    }
  };
}

/** The two contextual buttons under the hand. */
export function drawActions() {
  const primary = $('actPrimary');
  const secondary = $('actSecondary');
  primary.disabled = false;
  secondary.disabled = false;

  if (sel) {
    primary.className = 'btn danger';
    primary.textContent = 'Cancel placement';
    primary.onclick = () => { setSel(null); drawAll(); };
    secondary.className = 'btn ghost';
    secondary.textContent = 'View card';
    secondary.onclick = () => focusCard(sel, 'info');
    return;
  }
  if (mover) {
    primary.className = 'btn danger';
    primary.textContent = 'Deselect unit';
    primary.onclick = () => { setMover(null); drawAll(); };
    secondary.className = 'btn ghost';
    secondary.textContent = 'View card';
    secondary.onclick = () => focusCard(mover.id, 'info');
    return;
  }
  primary.className = 'btn';
  primary.textContent = replaying ? 'Resolving…' : 'End turn';
  primary.onclick = () => { sfx('confirm'); endTurn(); };
  primary.disabled = G.over || replaying;
  secondary.className = 'btn ghost';
  secondary.textContent = 'Abort';
  secondary.onclick = leaveCombat;
  secondary.disabled = replaying;
}

/** What the selected unit will do, or what the selected card will cost. */
export function drawSel() {
  const el = $('selinfo');

  if (mover) {
    const u = mover;
    const incoming = forecastThreat().hits[u.uid] || 0;
    const g = geomFor(u);
    const ts = targetsFor(u);
    const dmg = dmgPreview(u);
    const buff = buffOf(u);
    const canChoose = u.single && g.length > 1;

    const verdict = u.acted ? 'Action committed for this turn'
      : !g.length ? 'No target in range — it will hold'
        : canChoose ? `<b>${g.length}</b> targets in reach — tap one in gold to strike`
          : u.single ? `Will strike ${BEST[ts[0].k].n} for <b>${dmg}</b>`
            : `Will strike ${g.length} hostile${g.length > 1 ? 's' : ''} for <b>${dmg}</b> each`;

    el.innerHTML = `<div class="selhead"><b style="color:var(--cyan)">${u.n}</b>
        <span class="hpbadge">${u.hp}/${u.max}${u.acted ? ' · spent' : ''}</span></div>
      <div class="hpbar"><i style="width:${Math.max(0, u.hp / u.max * 100)}%"></i></div>
      <div class="selgrid">
        <div><span>Damage</span><b>${u.dmg}${buff ? ` <span style="color:var(--green)">+${buff}</span>` : ''}</b></div>
        <div><span>Targeting</span><b>${TGNAME[u.tg] || 'None'}</b></div>
        ${u.shield ? `<div><span>Shield</span><b style="color:var(--cyan)">${u.shield}</b></div>` : ''}
        ${incoming ? `<div><span>Incoming</span><b style="color:var(--mag)">${incoming}</b></div>` : ''}
      </div>
      ${supportLabel(u) ? `<div class="selsupport">${supportLabel(u)}</div>` : ''}
      <div class="selfire ${g.length ? 'live' : 'dead'}">${verdict}</div>
      ${!u.acted && u.mob ? '<div class="hintline">Tap a green tile to reposition.</div>' : ''}
      ${u.ab && !u.acted ? `<div class="selacts">
        <button class="mini" data-useab="1"${u.cd > 0 ? ' disabled' : ''}>${u.cd > 0 ? `${u.ab.n} (${u.cd})` : u.ab.n}</button></div>
        <div class="abline"><b>${u.ab.n}</b> ${u.ab.d}</div>` : ''}`;

    const b = el.querySelector('[data-useab]');
    if (b && !u.cd) b.onclick = () => doAbility(u);
    return;
  }

  if (sel) {
    const k = POOL[sel];
    const g = gearOf(sel);
    el.innerHTML = `<div class="selhead"><b style="color:var(--green)">${k.n}</b>
        <span class="hpbadge">${costOf(sel)} DP</span></div>
      <div class="selgrid">
        ${k.hp ? `<div><span>Hull</span><b>${k.hp + (g && g.hp ? g.hp : 0)}</b></div>` : ''}
        ${k.dmg ? `<div><span>Damage</span><b>${k.dmg + (g && g.dmg ? g.dmg : 0)}</b></div>` : ''}
        ${k.tg && k.tg !== 'none' ? `<div><span>Targeting</span><b>${TGNAME[k.tg]}</b></div>` : ''}
        <div><span>Deploy</span><b>${k.drop ? 'Any tile' : 'Held tiles'}</b></div>
      </div>
      <div class="selfire live">Tap a lit tile to deploy</div>
      <div class="abline">${k.d}</div>`;
    return;
  }

  const threatened = Object.keys(forecastThreat().hits).length;
  const ready = G.units.filter(u => !u.acted).length;
  el.innerHTML = `Nothing selected.<div style="margin-top:7px">Tap a card to deploy, or a unit to act with it.</div>
    ${ready ? `<div class="selfire live" style="margin-top:9px"><b>${ready}</b> unit${ready > 1 ? 's' : ''} still to act</div>` : ''}
    ${threatened ? `<div class="selfire dead" style="margin-top:7px"><b style="color:var(--mag)">${threatened}</b> of your positions will be struck this turn</div>` : ''}`;
}

/** Markup for one of your units standing in a cell. */
function unitMarkup(u, incoming) {
  const kind = u.t === 'special' ? 'p-spec' : u.tech ? 'p-struct' : 'p-unit';
  return `<div class="ent ${kind}${u.size > 1 ? ' anchor' : ''}${u.stun ? ' stunned' : ''}${u.acted ? ' spent' : ''}">
        ${incoming ? `<span class="incdmg">-${incoming}</span>` : ''}
        ${u.tgt ? '<span class="lockpip">⌖</span>' : ''}
        <span class="minihp"><i style="width:${Math.max(0, u.hp / u.max * 100)}%"></i></span>
        ${u.shield > 0 ? `<span class="shield">${'◈'.repeat(Math.min(u.shield, 2))}</span>` : ''}
        ${u.att.cannon ? '<span class="att">▮</span>' : ''}${u.acted ? '<span class="ord done">✓</span>' : ''}
        <div class="nm">${u.n.split(' ')[0]}${u.size > 1 ? '▸' : ''}</div><div class="hp">${u.hp}</div></div>`;
}

/** Markup for a hostile standing in a cell. */
function foeMarkup(e, striking, locked) {
  const D = BEST[e.k];
  const kind = D.t === 'special' ? 'e-spec' : D.t === 'tech' ? 'e-tech' : 'e-unit';
  return `<div class="ent ${kind}${e.stun ? ' stunned' : ''}">
        ${striking ? '<span class="striking">!</span>' : ''}
        ${locked ? '<span class="lockpip">⌖</span>' : ''}
        <span class="minihp foe"><i style="width:${Math.max(0, e.hp / D.hp * 100)}%"></i></span>
        <div class="nm">${D.n.split(' ')[0]}</div><div class="hp">${e.hp}</div></div>`;
}

export function drawBoard() {
  const valid = sel ? validTiles(sel) : [];
  const moves = mover ? moveTargets(mover) : [];
  const threat = forecastThreat();

  // Gold = will be struck if this unit fires; aimable = may be locked onto.
  const willHit = new Set();
  const aimable = new Set();
  if (mover && !mover.acted) {
    targetsFor(mover).forEach(e => willHit.add(e.lane * COLS + e.col));
    (mover.single ? candidatesFor(mover) : geomFor(mover)).forEach(e => aimable.add(e.lane * COLS + e.col));
  }
  const buffed = new Set();
  const influenced = new Set();
  if (mover) {
    supportTargets(mover).forEach(i => buffed.add(i));
    influenceCells(mover).forEach(i => influenced.add(i));
  }

  // The spawn-marker contract, made visible. Blackout hides it entirely.
  const spawnLanes = {};
  if (G.mod !== 'blackout') {
    (G.predict || []).concat(G.held || []).forEach(p => {
      spawnLanes[p.lane] = (spawnLanes[p.lane] || 0) + 1;
    });
  }

  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${COLS},1fr)`;
  board.innerHTML = '';

  for (let l = 0; l < LANES; l++) for (let c = 0; c < COLS; c++) {
    const i = l * COLS + c;
    const owner = G.ter[l][c];
    const cell = document.createElement('div');

    let cls = 'cell ' + (owner === 'p' ? 't-p' : owner === 'e' ? 't-e' : owner === 'x' ? 't-x' : 't-n');
    if (scorched(l, c)) cls += ' scorch';
    if (G.crystals.some(x => x.l === l && x.c === c)) cls += ' objtile';
    if (valid.includes(i)) cls += ' valid';
    if (moves.includes(i)) cls += ' movetgt';
    if (mover && mover.lane === l && mover.col === c) cls += ' movesel';
    if (willHit.has(i)) cls += ' willhit';
    if (buffed.has(i)) cls += ' buffed';
    if (aimable.has(i)) cls += ' aimable';
    cell.className = cls;

    const marker = c === COLS - 1 && spawnLanes[l]
      ? `<span class="spawnmark">◀${spawnLanes[l] > 1 ? spawnLanes[l] : ''}</span>` : '';

    const u = unitAt(l, c);
    const e = foeAt(l, c);
    const v = civAt(l, c);

    if (u && u.col === c) {
      const incoming = threat.hits[u.uid] || 0;
      if (incoming) cell.className = cls + ' underthreat';
      cell.innerHTML = marker + unitMarkup(u, incoming);
      if (!sel && !G.over && !u.acted) {
        cell.classList.add('clickable');
        cell.onclick = () => { setMover(mover && mover.uid === u.uid ? null : u); drawAll(); };
      }
    } else if (u) {
      // The trailing half of a two-cell unit.
      cell.innerHTML = marker + '<div class="ent p-unit anchor"><div class="nm">◂</div></div>';
    } else if (v) {
      cell.innerHTML = marker + `<div class="ent p-civ"><div class="nm">CIV</div><div class="hp">${v.hp}</div></div>`;
    } else if (e) {
      const locked = G.units.some(x => x.tgt === e.uid);
      cell.innerHTML = marker + foeMarkup(e, threat.atk[e.uid], locked);
      cell.classList.add('clickable');
      if (aimable.has(i) && mover && !mover.acted) cell.onclick = () => { sfx('zap'); doAttack(mover, e); };
      else cell.onclick = () => focusEnemy(e.k);
    } else {
      cell.innerHTML = marker;
    }

    // Placement and movement win over whatever the cell's occupant wired up.
    if (valid.includes(i)) cell.onclick = () => { sfx('deploy'); deploy(sel, l, c); };
    else if (moves.includes(i)) cell.onclick = () => { sfx('move'); doMove(mover, l, c); };
    else if (!cell.onclick && (sel || mover)) {
      cell.onclick = () => { setSel(null); setMover(null); drawAll(); };
    }

    board.appendChild(cell);
  }

  const total = LANES * COLS;
  const mine = held();
  const theirs = G.ter.flat().filter(t => t === 'e').length;
  $('terbar').innerHTML = `<i class="p" style="width:${mine / total * 100}%"></i>` +
    `<i class="n" style="width:${(total - mine - theirs) / total * 100}%"></i>` +
    `<i class="e" style="width:${theirs / total * 100}%"></i>`;
}

/**
 * The combat log. The engine has always kept it; until the desktop layout there
 * was nowhere to put it. Newest first, capped to what the rail can show.
 */
export function drawLog() {
  const el = $('cblog');
  if (!el) return;
  const entries = G.logs.slice(0, LOG_LINES);
  el.innerHTML = entries.length
    ? entries.map(e => `<div class="logline l-${e.c}">${e.h}</div>`).join('')
    : '<div class="logline l-info">Awaiting contact.</div>';
}

export function drawHand() {
  const h = $('hcards');
  h.innerHTML = '';

  G.hand.forEach((cid, index) => {
    const k = POOL[cid];
    const cost = costOf(cid);
    const unaffordable = cost > G.dp || G.over;
    const g = gearOf(cid);
    const v = vetOf(cid);

    const el = document.createElement('div');
    el.className = `hc t-${k.t} v${v.t}` + (unaffordable ? ' poor' : '') + (sel === cid ? ' sel' : '');
    // A trading card: cost in the corner, the sigil as art, name and tier
    // beneath. No rules text — that lives in the details panel when the card
    // is selected, and in full behind the ⌕ badge.
    el.innerHTML = `<div class="hcost">${cost}</div>
      ${index < 9 ? `<div class="hkey">${index + 1}</div>` : ''}
      <div class="zoom" data-z="${cid}">⌕</div>${v.t ? `<div class="hpips">${'◆'.repeat(v.t)}</div>` : ''}
      <div class="hart">${sigil(cid, k.t, null, v.t >= 2 ? v.col : null)}</div>
      <div class="n">${k.n}</div>
      <div class="hsub">${TIERNAME[k.t]}${k.hp ? ' · ' + (k.hp + (g && g.hp ? g.hp : 0)) + ' hull' : ''}</div>
      ${g ? `<div class="gtag">${g.n}</div>` : ''}`;
    el.title = k.n + ' — ' + k.d;   // hover tooltip carries the rules text
    el.onclick = ev => {
      if (ev.target.dataset.z) { focusCard(cid, 'hand'); return; }
      if (unaffordable) return;
      sfx(sel === cid ? 'tap' : 'select');
      setSel(sel === cid ? null : cid);
      setMover(null);
      drawAll();
    };
    h.appendChild(el);
  });

  if (!G.hand.length) {
    h.innerHTML = '<div style="font-size:0.5625rem;color:var(--dim)">Hand empty — hold with what is on the board.</div>';
  }
}

export function drawAll() {
  if (!G || !active) return;
  const m = MISSIONS[G.type];

  const waveLabel = G.endless ? `Wave ${G.turn}` : `Wave ${Math.min(G.turn, G.waves)} / ${G.waves}`;
  $('c-title').innerHTML = `${waveLabel} <span class="sep">·</span> ${m.n}` +
    (G.mod !== 'none' ? ` <span class="modtag">${MODS[G.mod].n}</span>` : '');
  $('c-obj').textContent = objText();
  $('c-dp').textContent = G.dp;
  $('c-ter').textContent = held();
  $('c-br').innerHTML = G.breaches + '<span class="of">/3</span>';
  $('c-deck').textContent = G.deck.length;

  const blind = G.mod === 'blackout';
  $('man').innerHTML = G.manifest && !blind
    ? Object.entries(G.manifest)
      .map(([k, v]) => `<span class="incp" data-foe="${k}">${BEST[k].n}<b>${v}</b></span>`).join('')
    : G.manifest ? '<span class="incp">Blackout — no preview</span>'
      : '<span class="incp">No further hostiles</span>';

  const doctrine = DOCTRINE.find(d => d.k === G.doctrine);
  $('c-doc').textContent = G.manifest
    ? (blind ? 'Approach unknown' : (doctrine ? doctrine.n : ''))
    : 'Wave cleared';
  document.querySelectorAll('#man [data-foe]').forEach(el => {
    el.onclick = () => focusEnemy(el.dataset.foe);
  });

  drawLeadBadge();
  drawBoard();
  drawHand();
  drawSel();
  drawActions();
  drawLog();
}
