// The combat screen: header, board, hand, selection panel and action bar.
//
// Everything here is a pure function of (G, active, sel, mover) — drawAll()
// rebuilds the screen from scratch each time rather than patching it, which is
// why the rules layer only has to say "something changed".

import {LANES, COLS, HAND_CAP, GROUND_FLOOR} from '../state/constants.js';
import {POOL} from '../content/cards.js';
import {BEST} from '../content/hostiles.js';
import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {DOCTRINE} from '../content/doctrines.js';
import {BOSSDEF} from '../content/bosses.js';
import {bossHp} from '../rules/boss.js';
import {TGNAME} from '../content/targeting-names.js';
import {G, active, sel, mover, foeSel, replaying, stratSel, logOpen, abAim, setSel, setMover, setFoeSel, setStratSel, setLogOpen, setAbAim} from '../state/session.js';
import {STRATAGEMS} from '../content/stratagems.js';
import {stratReady, canPlayStratagem, playStratagem, stratMarkers} from '../rules/stratagems.js';
import {frameReady} from '../rules/frames.js';
import {costOf, gearOf, vetOf, frameWeapon, isProto, leadOf, cardName} from '../save/progression.js';
import {unitAt, foeAt, civAt, held, scorched, validTiles, breachAllowance} from '../rules/board.js';
import {geomFor, geomCells, candidatesFor, targetsFor} from '../rules/targeting.js';
import {buffOf, dmgPreview} from '../rules/units.js';
import {moveTargets, doMove, doAttack, doAbility, swapTargets, doSwap} from '../rules/actions.js';
import {pierceTargets, doPierce} from '../rules/abilities.js';
import {deploy} from '../rules/deploy.js';
import {endTurn} from '../rules/phases.js';
import {objBrief, abortMission} from '../rules/mission.js';
import {forecastThreat, foeThreatCells, enemyIntent, supportTargets, influenceCells, supportLabel} from '../rules/forecast.js';
import {EVENTS, eventStrikeMalus} from '../rules/events.js';
import {$, show} from './dom.js';
import {portrait, artFor} from './art.js';
import {ask, notify} from './dialog.js';
import {focusCard, focusEnemy, closeFocus} from './focus.js';
import {playBossDebrief} from './codec.js';
import {renderMap} from './map.js';
import {renderModes} from './modes.js';
import {sfx} from './sound.js';
import {setMusicMood} from './music.js';
import {unitSprite, foeSprite} from './sprites.js';

const LOG_LINES = 40;

/** Leaving combat: back to the map, or to mode select for endless/gauntlet. */
export function leaveCombat() {
  // A first boss kill earns an after-action call — the lore lands as the
  // commander walks away from the wreck, over the map the win just changed.
  // Read before abortMission(), which tears the mission state down.
  const bossDown = G && G.over && G.type === 'boss' && G.result && G.result.cleared && G.boss
    ? G.boss.k : null;
  const {wasEndless, wasGauntlet, wasDaily} = abortMission();
  $('result').classList.remove('on');
  closeFocus();
  setMusicMood('hold');
  if (wasEndless || wasGauntlet || wasDaily) { show('modes'); renderModes(); return; }
  show('map');
  renderMap();
  if (bossDown) playBossDebrief(bossDown, null);
}

/** Abort is irreversible, so it asks first — with the stakes for this mode. */
function confirmAbort() {
  if (G.over) return leaveCombat();
  const stakes = G.gauntlet
    ? 'The gauntlet chain is forfeit — legs already cleared keep their pay, but the run ends here.'
    : G.endless
      ? 'Onslaught pays out only when your line falls. Abort now and the run pays nothing.'
      : G.daily
        ? 'This attempt is abandoned, but the streak is untouched — you can retry today\'s challenge.'
        : 'Progress on this mission is lost. The node stays open to try again.';
  ask('Abort mission', stakes + '<br><br>Leave the field?',
    ok => { if (ok) leaveCombat(); }, {ok: 'Abort'});
}

/** The team-lead badge: passive on tap, and the stratagem's state at a glance. */
function drawLeadBadge() {
  const L = leadOf();
  const badge = $('leadbadge');
  const def = L.stratagem ? STRATAGEMS[L.stratagem] : null;
  const ready = !!(def && G.strat && !G.strat.played && !G.over);

  badge.innerHTML = `${portrait(active.lead || 'ironbrand')}
    <span class="lbname">${L.call}</span>
    ${def ? `<span class="lbtag${ready ? ' ready' : ''}">${ready ? 'CALL READY' : 'SPENT'}</span>` : ''}`;
  badge.className = 'leadbadge' + (ready ? ' ready' : '');
  badge.style.borderColor = L.col;

  badge.onclick = () => {
    const lines = [];
    if (L.passive) lines.push(`<b>Passive · ${L.passive.n}</b> — ${L.passive.d}`);
    if (def) {
      lines.push(`<b>Stratagem · ${def.n}</b> — ${def.d}` +
        (ready ? '<br>Play it from your hand.' : '<br>Already called this mission.'));
    }
    notify(L.call + ' · ' + L.role, lines.join('<br><br>') || L.bio);
  };
}

/** The two contextual buttons under the hand. */
export function drawActions() {
  const primary = $('actPrimary');
  const secondary = $('actSecondary');
  primary.disabled = false;
  secondary.disabled = false;

  if (stratSel) {
    primary.className = 'btn danger';
    primary.textContent = 'Cancel call';
    primary.onclick = () => { setStratSel(false); drawAll(); };
    secondary.className = 'btn ghost';
    secondary.textContent = 'Hold';
    secondary.onclick = () => { setStratSel(false); drawAll(); };
    return;
  }
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
  // A selected hostile gets the same two controls a unit does — the grid
  // obeys one rule for both sides.
  if (foeSel) {
    primary.className = 'btn danger';
    primary.textContent = 'Deselect hostile';
    primary.onclick = () => { setFoeSel(null); drawAll(); };
    secondary.className = 'btn ghost';
    secondary.textContent = 'View card';
    secondary.onclick = () => focusEnemy(foeSel.k);
    return;
  }
  primary.className = 'btn';
  primary.textContent = replaying ? 'Resolving…' : 'End turn';
  primary.onclick = () => { sfx('confirm'); endTurn(); };
  primary.disabled = G.over || replaying;
  secondary.className = 'btn ghost';
  secondary.textContent = 'Abort';
  secondary.onclick = confirmAbort;
  secondary.disabled = replaying;
}

/** What the selected unit will do, or what the selected card will cost. */
function drawSel() {
  const el = $('selinfo');
  el.hidden = false;

  if (stratSel) {
    const def = stratReady();
    if (!def) { setStratSel(false); }
    else {
      const how = def.target === 'friendly' ? 'Tap one of your units to mark the duelist.'
        : def.target === 'lane' ? 'Tap any cell to choose the lane.'
          : def.target === 'column' ? 'Tap any cell to choose the column.'
            : 'No target needed — commit the call.';
      el.innerHTML = `<div class="selhead"><b style="color:var(--violet)">${def.n}</b>
          <span class="hpbadge">${def.dp} DP</span></div>
        <div class="abline">${def.d}</div>
        <div class="selfire live">${STRATAGEMS[G.strat.k].now
          ? 'Lands at the END of this turn.' : 'Resolves at the START of your next turn.'} ${how}</div>
        ${def.target === 'none' ? '<div class="selacts"><button class="mini" data-callstrat="1">Call it in</button></div>' : ''}`;
      const b = el.querySelector('[data-callstrat]');
      if (b) b.onclick = () => { sfx('confirm'); playStratagem(null); setStratSel(false); drawAll(); };
      return;
    }
  }

  if (mover) {
    const u = mover;
    const incoming = forecastThreat().hits[u.uid] || 0;
    const g = geomFor(u);
    const ts = targetsFor(u);
    const dmg = dmgPreview(u);
    const buff = buffOf(u);
    const canChoose = u.single && g.length > 1;

    const verdict = u.acted ? 'Action committed for this turn'
      : u.cycling > 0 ? 'Weapon cycling — ready to fire next turn'
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
      ${!u.acted && u.swap ? '<div class="hintline">Or tap a highlighted friendly to trade places — anywhere on the board.</div>' : ''}
      ${u.ab && !u.acted ? `<div class="selacts">
        <button class="mini" data-useab="1"${u.cd > 0 ? ' disabled' : ''}>${u.cd > 0 ? `${u.ab.n} (${u.cd})` : u.ab.n}</button></div>
        <div class="abline"><b>${u.ab.n}</b> ${u.ab.d}</div>` : ''}`;

    const b = el.querySelector('[data-useab]');
    if (b && !u.cd) {
      // A cell-targeted ability (Piercing Thrust) arms an aim mode instead of
      // resolving on the spot: the board lights the legal cells, the tap on
      // one of them is the commit, and tapping the button again stands down.
      b.onclick = u.ab.target === 'cell'
        ? () => { setAbAim(abAim && abAim.uid === u.uid ? null : u); drawAll(); }
        : () => doAbility(u);
    }
    if (abAim && abAim.uid === u.uid) {
      const spots = pierceTargets(u).length;
      el.innerHTML += `<div class="selfire ${spots ? 'live' : 'dead'}">${spots
        ? `${u.ab.n} armed — tap a lit cell down the lane to dash there.`
        : `${u.ab.n} — no clear cell to dash to. The path is blocked.`}</div>`;
    }
    return;
  }

  if (foeSel) {
    const e = foeSel;
    const D = BEST[e.k];
    const t = foeThreatCells(e);
    const hitCell = t.strike.length ? t.strike[0] : null;
    const victim = hitCell === null ? null : unitAt(Math.floor(hitCell / COLS), hitCell % COLS);
    const dmg = Math.max(1, (D.dmg || 0) +
      (G.enemies.some(o => BEST[o.k].aura) ? 1 : 0) - eventStrikeMalus());
    const speed = D.spd === 0 ? 'Immobile' : D.spd === 0.5 ? 'Every other turn' : D.spd + ' / turn';

    // A boss proxy reads as the whole machine: the shared pool, the shield,
    // and which phase of its script it is running.
    if (e.boss && G.boss) {
      const def = BOSSDEF[G.boss.k];
      const cells = G.boss.bodies.reduce((a, b) => a + b.cells.length, 0);
      // Phase two shortens the Envoy's dive cycle.
      const p2cut = n => (G.boss.phase === 2 ? Math.max(2, n - 1) : n);
      // The Communion's rotation is readable by design — name the next hymn.
      const hymnNames = ['Pyre', 'Brine', 'Dynamo', 'Shard'];
      el.innerHTML = `<div class="selhead"><b style="color:var(--mag)">${D.n}</b>
          <span class="hpbadge">${bossHp()}/${def.hp}</span></div>
        ${G.boss.shield > 0 ? `<div class="hpbar"><i style="width:${Math.max(0, G.boss.shield / def.shield * 100)}%;background:var(--cyan)"></i></div>` : ''}
        <div class="hpbar"><i style="width:${Math.max(0, bossHp() / def.hp * 100)}%;background:var(--mag)"></i></div>
        <div class="selgrid">
          <div><span>Phase</span><b>${G.boss.phase} of 2</b></div>
          ${G.boss.shield > 0 ? `<div><span>Field</span><b>${G.boss.shield}</b></div>` : ''}
          <div><span>Bodies</span><b>${G.boss.bodies.length}</b></div>
          <div><span>Footprint</span><b>${cells} cell${cells === 1 ? '' : 's'}</b></div>
          ${G.boss.beam ? `<div><span>Beam</span><b>lane ${G.boss.beam.lane + 1} next</b></div>` : ''}
          ${def.diveEvery ? `<div><span>Dives</span><b>every ${p2cut(def.diveEvery)} turns</b></div>` : ''}
          ${G.boss.k === 'communion' ? `<div><span>Next hymn</span><b>${hymnNames[G.boss.hymn]}</b></div>` : ''}
          ${G.boss.k === 'immolant' ? `<div><span>Walks</span><b>one lane a turn</b></div>` : ''}
        </div>
        <div class="selfire live">${G.boss.phase === 1 ? def.p1 : def.p2}</div>
        <div class="hintline">${D.d}</div>`;
      return;
    }

    const verdict = e.stun ? 'Stunned — it does nothing this turn.'
      : hitCell !== null ? `Will strike ${victim ? victim.n : 'the line'} for <b>${dmg}</b>`
        : t.threat.length ? `Closes <b>${t.threat.length}</b> cell${t.threat.length > 1 ? 's' : ''} — nothing in reach yet`
          : D.dmg ? 'Holds — nothing to strike' : 'Carries no weapon';

    el.innerHTML = `<div class="selhead"><b style="color:var(--mag)">${D.n}</b>
        <span class="hpbadge">${e.hp}/${D.hp}</span></div>
      <div class="hpbar"><i style="width:${Math.max(0, e.hp / D.hp * 100)}%;background:var(--mag)"></i></div>
      <div class="selgrid">
        <div><span>Damage</span><b>${D.dmg || '—'}</b></div>
        <div><span>Speed</span><b>${speed}</b></div>
        <div><span>Threatens</span><b>${t.threat.length + t.strike.length} tiles</b></div>
        ${D.floor ? `<div><span>Armour</span><b>−${D.floor} taken</b></div>` : ''}
      </div>
      <div class="selfire ${hitCell !== null ? 'live' : 'dead'}">${verdict}</div>
      <div class="hintline">${D.d}</div>`;
    return;
  }

  if (sel) {
    const k = POOL[sel];
    const g = gearOf(sel);
    // A Frame carries the weapon you chose in Squad, not the printed one.
    const w = frameWeapon(sel);
    const tg = (w && w.tg) || k.tg;
    const dmg = w ? w.dmg : k.dmg + (g && g.dmg ? g.dmg : 0);
    // A Frame with no Pilot on the board has nowhere to go, and the board says
    // so by lighting nothing at all. That is the one selection state where an
    // empty highlight is the rule working rather than a mistake, so it gets a
    // sentence instead of leaving the player tapping at dead tiles.
    const anchors = isProto(sel) ? validTiles(sel).length : 1;
    el.innerHTML = `<div class="selhead"><b style="color:var(--green)">${k.n}</b>
        <span class="hpbadge">${costOf(sel)} DP</span></div>
      <div class="selgrid">
        ${k.hp ? `<div><span>Hull</span><b>${k.hp + (g && g.hp ? g.hp : 0)}</b></div>` : ''}
        ${dmg ? `<div><span>Damage</span><b>${dmg}</b></div>` : ''}
        ${tg && tg !== 'none' ? `<div><span>${w ? w.n : 'Targeting'}</span><b>${TGNAME[tg]}</b></div>` : ''}
        <div><span>Deploy</span><b>${isProto(sel) ? 'On a Pilot'
    : k.drop ? 'Any tile'
      : k.anyGround ? `Any ground · col ${k.zoneMin}+`
        : k.zoneMin ? `Held · col ${k.zoneMin}+` : 'Held tiles'}</b></div>
      </div>
      <div class="selfire ${anchors ? 'live' : 'dead'}">${anchors
    ? (isProto(sel) ? 'Tap a lit tile — the Pilot there goes aboard' : 'Tap a lit tile to deploy')
    : 'No Frame Pilot on the board. Deploy one first, and keep it alive.'}</div>
      <div class="abline">${k.d}</div>`;
    return;
  }

  // Idle. "Nothing selected. Tap a card to deploy" cost 44px of a 664px phone
  // to say nothing — and the objective now sits above this, so the panel is
  // no longer empty without it. What survives is the part that was actually
  // information: who can still act, and who is about to be hit. With neither
  // to report the block folds away and gives the room back.
  const threatened = Object.keys(forecastThreat().hits).length;
  const ready = G.units.filter(u => !u.acted).length;
  if (!ready && !threatened) { el.hidden = true; el.innerHTML = ''; return; }
  // One line, not two boxes. As stacked .selfire panels these two counts cost
  // 72px of a 664px phone to carry about nine words between them.
  el.innerHTML = `<div class="idlerow">
    ${ready ? `<span class="ok"><b>${ready}</b> to act</span>` : ''}
    ${threatened ? `<span class="hit"><b>${threatened}</b> will be struck</span>` : ''}</div>`;
}

/** Markup for one of your units standing in a cell. */
function unitMarkup(u, incoming) {
  const kind = u.t === 'special' ? 'p-spec' : u.tech ? 'p-struct' : 'p-unit';
  return `<div class="ent ${kind}${u.size > 1 ? ' anchor' : ''}${u.stun ? ' stunned' : ''}${u.acted ? ' spent' : ''}${(u.cycling > 0 || u.jam) && !u.acted ? ' cooling' : ''}${u.controlled ? ' controlled' : ''}" title="${u.controlled ? u.n + ' — mind controlled' : u.jam ? u.n + ' — weapon arced dead this turn' : u.cycling > 0 ? u.n + ' — weapon cycling' : u.n}">
        ${u.controlled ? '<span class="lockpip" style="color:var(--violet)">☍</span>' : ''}
        ${incoming ? `<span class="incdmg">-${incoming}</span>` : ''}
        ${u.tgt ? '<span class="lockpip">⌖</span>' : ''}
        <span class="minihp"><i style="width:${Math.max(0, u.hp / u.max * 100)}%"></i></span>
        ${u.shield > 0 ? `<span class="shield">${'◈'.repeat(Math.min(u.shield, 2))}</span>` : ''}
        ${u.twin ? '<span class="att">▮</span>' : ''}${u.cycling > 0 ? '<span class="att cyc">⟳</span>' : ''}${u.acted ? '<span class="ord done">✓</span>' : ''}
        ${unitSprite(u.id, u.uid, active.loadout.scheme) || `<div class="nm">${u.n.split(' ')[0]}</div>`}
        <div class="hp">${u.hp}</div></div>`;
}

/** Every hostile type carries its own glyph — identity at cell size. */
const FOE_GLYPH = {
  crawler: '▪', hulk: '⬢', breacher: '◣', spitter: '◆', burrower: '⋒',
  spore: '✱', jammer: '⌁', pylon: '▣', harrower: '✠', mender: '✚',
  husk: '◍', screamer: '◉', chorus: '≋', sovereign: '♚', puppeteer: '☍',
  fabricant: '⚙', gantry: '☰', brood: '❉', prism: '◇',
  aperture: '◎', envoy: '♔',
  zealot: '†', lector: '♰', choirwarden: '♪',
  immolant: '🜂', drowned: '🜄', conduit: '🜁', ossified: '🜃', communion: '✥',
};

/** The intent badge: what this hostile will do next turn, per enemyIntent(). */
function intentBadge(e) {
  const it = enemyIntent(e);
  if (it.k === 'strike') return `<span class="intent atk">⚔${it.dmg}</span>`;
  if (it.k === 'advance') return `<span class="intent mov">${'▸'.repeat(Math.min(it.steps, 2))}</span>`;
  if (it.k === 'mend') return '<span class="intent mend">✚</span>';
  if (it.k === 'spawn') return '<span class="intent spwn">✱</span>';
  return '<span class="intent idle">…</span>';
}

/** Markup for a hostile standing in a cell. */
function foeMarkup(e, locked) {
  const D = BEST[e.k];
  const kind = D.t === 'boss' ? 'e-boss' : D.t === 'special' ? 'e-spec' : D.t === 'tech' ? 'e-tech' : 'e-unit';
  // A boss proxy's bar reads against its BODY's pool (bmax), which after a
  // split or shatter is smaller than the bestiary total.
  const denom = e.bmax || D.hp;
  const shieldPip = e.boss && G.boss && G.boss.shield > 0
    ? `<span class="shield">◈${G.boss.shield}</span>` : '';
  return `<div class="ent ${kind}${e.stun ? ' stunned' : ''}" title="${D.n}">
        ${e.boss ? '' : intentBadge(e)}
        ${locked ? '<span class="lockpip">⌖</span>' : ''}
        ${shieldPip}
        <span class="minihp foe"><i style="width:${Math.max(0, e.hp / denom * 100)}%"></i></span>
        ${foeSprite(e.k, e.uid) || `<div class="nm"><span class="fglyph">${FOE_GLYPH[e.k] || '▪'}</span>${D.n.split(' ')[0]}</div>`}
        <div class="hp">${e.hp}</div></div>`;
}

export function drawBoard() {
  const valid = sel ? validTiles(sel) : [];
  const moves = mover ? moveTargets(mover) : [];
  const swaps = mover ? swapTargets(mover) : [];
  const threat = forecastThreat();
  const marks = new Set(stratMarkers());
  const stratDef = stratSel ? stratReady() : null;

  // Gold = will be struck if this unit fires; aimable = may be locked onto.
  const willHit = new Set();
  const aimable = new Set();
  if (mover && !mover.acted) {
    targetsFor(mover).forEach(e => willHit.add(e.lane * COLS + e.col));
    (mover.single ? candidatesFor(mover) : geomFor(mover)).forEach(e => aimable.add(e.lane * COLS + e.col));
  }
  // Cyan = every cell the weapon covers, occupied or not. Without this a
  // weapon aimed at empty ground shows nothing until something walks into
  // it — one turn too late to plan around.
  const inRange = new Set(mover ? geomCells(mover) : []);
  // The mirror for a selected hostile: what it threatens, and what it hits.
  const foeStrike = new Set();
  const foeThreat = new Set();
  const foeInfl = new Set();
  if (foeSel) {
    const t = foeThreatCells(foeSel);
    t.strike.forEach(i => foeStrike.add(i));
    t.threat.forEach(i => foeThreat.add(i));
    t.infl.forEach(i => foeInfl.add(i));
  }
  const buffed = new Set();
  const influenced = new Set();
  if (mover) {
    supportTargets(mover).forEach(i => buffed.add(i));
    influenceCells(mover).forEach(i => influenced.add(i));
  }

  // Piercing Thrust armed: the empty cells the frame may dash to.
  const pierceCells = new Set(abAim ? pierceTargets(abAim) : []);

  // The spawn-marker contract, made visible. Blackout hides it entirely.
  const spawnLanes = {};
  if (G.mod !== 'blackout') {
    (G.predict || []).concat(G.held || []).forEach(p => {
      spawnLanes[p.lane] = (spawnLanes[p.lane] || 0) + 1;
    });
  }

  // The Aperture's telegraphed beam: the lit lane burns next turn — phase
  // two opens the fan to the adjacent lanes as well.
  const beamLanes = new Set();
  if (G.boss && G.boss.beam) {
    const bl = G.boss.beam.lane;
    (G.boss.phase === 2 ? [bl - 1, bl, bl + 1] : [bl])
      .filter(x => x >= 0 && x < LANES).forEach(x => beamLanes.add(x));
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
    if (G.uplinkAt && G.uplinkAt.l === l && G.uplinkAt.c === c) cls += ' objtile';
    if (valid.includes(i)) cls += ' valid';
    if (moves.includes(i)) cls += ' movetgt';
    if (swaps.includes(i)) cls += ' swaptgt';
    if (pierceCells.has(i)) cls += ' piercetgt';
    if (marks.has(i)) cls += ' stratmark';
    if (stratDef && (stratDef.target === 'lane' || stratDef.target === 'column' ||
      (stratDef.target === 'friendly' && unitAt(l, c)))) cls += ' strattgt';
    if (mover && mover.lane === l && mover.col === c) cls += ' movesel';
    if (inRange.has(i)) cls += ' inrange';
    if (foeInfl.has(i)) cls += ' foeinfl';
    if (foeThreat.has(i)) cls += ' foethreat';
    if (foeStrike.has(i)) cls += ' foestrike';
    if (foeSel && foeSel.lane === l && foeSel.col === c) cls += ' foesel';
    if (willHit.has(i)) cls += ' willhit';
    if (buffed.has(i)) cls += ' buffed';
    if (influenced.has(i)) cls += ' influence';
    if (aimable.has(i)) cls += ' aimable';
    const burrowWarn = G.burrowAt && G.burrowAt.l === l && G.burrowAt.c === c;
    if (burrowWarn) cls += ' burrowmark';
    // The Brood Mother's telegraphed breaches: marked this turn, erupting next.
    const breachWarn = G.boss && G.boss.marks.some(m => m.l === l && m.c === c);
    if (breachWarn) cls += ' breachwarn';
    if (beamLanes.has(l)) cls += ' beamwarn';
    cell.className = cls;

    let marker = c === COLS - 1 && spawnLanes[l]
      ? `<span class="spawnmark">◀${spawnLanes[l] > 1 ? spawnLanes[l] : ''}</span>` : '';
    // The lane's Last-Stand charge, standing (bright) or spent (dark).
    if (c === 0 && G.gridCharge) {
      marker += `<span class="gridpip${G.gridCharge[l] ? '' : ' spent'}" title="${G.gridCharge[l]
        ? 'Last-Stand charge armed — the first breach in this lane fires the grid instead of counting'
        : 'Charge spent — breaches in this lane now count'}">⛨</span>`;
    }

    const u = unitAt(l, c);
    const e = foeAt(l, c);
    const v = civAt(l, c);

    if (u && u.col === c) {
      const incoming = threat.hits[u.uid] || 0;
      if (incoming) cell.className = cls + ' underthreat';
      cell.innerHTML = marker + unitMarkup(u, incoming);
      if (!sel && !G.over && !u.acted && !u.controlled) {
        cell.classList.add('clickable');
        cell.onclick = () => {
          setFoeSel(null);
          setMover(mover && mover.uid === u.uid ? null : u);
          drawAll();
        };
      }
    } else if (u) {
      // The trailing half of a two-cell unit.
      cell.innerHTML = marker + '<div class="ent p-unit anchor"><div class="nm">◂</div></div>';
    } else if (v) {
      const label = v.research ? 'RSCH' : v.building ? 'BLDG' : 'CIV';
      const ttl = v.research ? `<span class="ttl">${v.timer}</span>` : '';
      cell.innerHTML = marker + `<div class="ent p-civ">${ttl}<div class="nm">${label}</div><div class="hp">${v.hp}</div></div>`;
      if (v.research) {
        cell.classList.add('clickable');
        cell.onclick = () => notify(`${EVENTS.research.icon} ${EVENTS.research.n}`,
          `${EVENTS.research.d}<br><br>Needs <b>${v.timer}</b> more turn${v.timer === 1 ? '' : 's'} standing to extract clean. Losing it forfeits the credit bonus — not the mission.`);
      }
    } else if (e) {
      const locked = G.units.some(x => x.tgt === e.uid);
      cell.innerHTML = marker + foeMarkup(e, locked);
      cell.classList.add('clickable');
      // Attacking still wins: with a unit selected, a hostile already in its
      // sights is a target, not a thing to inspect. Selection is what a tap
      // means only when there is no shot to take.
      if (aimable.has(i) && mover && !mover.acted) cell.onclick = () => { sfx('zap'); doAttack(mover, e); };
      else {
        cell.onclick = () => {
          setMover(null);
          setSel(null);
          setFoeSel(foeSel && foeSel.uid === e.uid ? null : e);
          drawAll();
        };
      }
    } else {
      const rubble = owner === 'x' ? G.rubble[l + ',' + c] : null;
      cell.innerHTML = marker + (rubble ? `<span class="ttl">${rubble}</span>` : '');
      if (pierceCells.has(i)) {
        cell.classList.add('clickable');
        cell.onclick = () => {
          sfx('zap');
          const u = abAim;
          setAbAim(null);
          doPierce(u, l, c);
          drawAll();
        };
      } else if (rubble) {
        cell.classList.add('clickable');
        cell.onclick = () => notify(`${EVENTS.bombard.icon} Bombardment crater`,
          `Hive artillery scarred this ground — impassable to both sides while it holds.<br><br>Clears itself in <b>${rubble}</b> more turn${rubble === 1 ? '' : 's'}.`);
      } else if (burrowWarn) {
        cell.classList.add('clickable');
        cell.onclick = () => notify(`${EVENTS.burrow.icon} ${EVENTS.burrow.n}`,
          `${EVENTS.burrow.d}<br><br>This tile is the one marked — whatever is left standing here when it opens falls through with it.`);
      }
    }

    // A selected stratagem turns the whole board into its target picker.
    if (stratDef) {
      const u = unitAt(l, c);
      if (stratDef.target === 'friendly' && u) {
        cell.onclick = () => { sfx('confirm'); playStratagem({uid: u.uid}); setStratSel(false); drawAll(); };
      } else if (stratDef.target === 'lane') {
        cell.onclick = () => { sfx('confirm'); playStratagem({lane: l}); setStratSel(false); drawAll(); };
      } else if (stratDef.target === 'column') {
        cell.onclick = () => { sfx('confirm'); playStratagem({col: c}); setStratSel(false); drawAll(); };
      } else {
        cell.onclick = () => { setStratSel(false); drawAll(); };
      }
      board.appendChild(cell);
      continue;
    }

    // Placement, movement and swaps win over whatever the occupant wired up.
    if (valid.includes(i)) cell.onclick = () => { sfx('deploy'); deploy(sel, l, c); };
    else if (moves.includes(i)) cell.onclick = () => { sfx('move'); doMove(mover, l, c); };
    else if (swaps.includes(i)) cell.onclick = () => { sfx('move'); doSwap(mover, l, c); };
    else if (!cell.onclick && (sel || mover)) {
      cell.onclick = () => { setSel(null); setMover(null); setFoeSel(null); drawAll(); };
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
function drawLog() {
  const el = $('cblog');
  if (!el) return;
  const entries = G.logs.slice(0, LOG_LINES);
  el.innerHTML = entries.length
    ? entries.map(e => `<div class="logline l-${e.c}">${e.h}</div>`).join('')
    : '<div class="logline l-info">Awaiting contact.</div>';
}

/**
 * The one line in the log that a player cannot afford to miss.
 *
 * Measured across 938 turns of real missions, the log runs a median of 5 lines
 * a turn and up to 34 — and 43% of it is your own orders, 28% kills you watched
 * happen and 17% a wave the header already announced. The `loss` class, the
 * only category that reports something being done TO you, is 3.6% of it: about
 * one line every four turns, buried in narration of things already on screen.
 *
 * So that 3.6% comes out and sits under the board where the player is already
 * looking, and the other 96% stays in the history behind it. At a quarter of a
 * line per turn this can never become noise, which is the whole reason it is
 * allowed to interrupt without being asked.
 */
function paintAlert() {
  const el = $('alertstrip');
  if (!el) return;
  // The enemy phase resolves before the turn counter advances, so what was
  // just done to you is stamped with the turn that ended. Both count as "now";
  // anything older has been answered or absorbed and stops shouting.
  const hits = G.logs.filter(e => e.c === 'loss' && e.t >= G.turn - 1);
  const scr = $('combat');
  if (!hits.length || G.over) {
    el.hidden = true; el.innerHTML = '';
    if (scr) scr.classList.remove('hasalert');
    return;
  }
  const more = hits.length > 1 ? `<span class="amore">+${hits.length - 1} more</span>` : '';
  el.hidden = false;
  // One alarm at a time. While this strip is up it is already saying a
  // threshold was crossed, so the objective panel does not also need to recite
  // the rules underneath it — on a phone that is 20px of duplicate warning.
  $('combat').classList.add('hasalert');
  el.innerHTML = `<span class="aglyph">!</span><span class="atext">${hits[0].h}</span>${more}`;
  el.title = 'Open the combat log';
  el.onclick = () => openLog();
}

/**
 * The full history, as an overlay rather than a column.
 *
 * It used to be a grid track that the board had to pay for on every layout —
 * and folding it away was not even free, because the compact grid kept
 * reserving the row. Floating it costs the board nothing, works the same on a
 * phone as on a desktop, and lets the log be as long as it likes.
 */
export function openLog() {
  setLogOpen(true);
  // The objective rides at the top of the overlay, outside the scroller. The
  // log is the one place a player goes to work out what just happened, and
  // scrolling back through forty lines with the goal off-screen is how you
  // lose track of what you were trying to do in the first place.
  drawObjective('objlog');
  drawLog();
  $('logview').classList.add('on');
  sfx('tap');
}

export function closeLog() {
  setLogOpen(false);
  $('logview').classList.remove('on');
}

/** The Log button, and the two ways out of the overlay it opens. */
function paintLogToggle() {
  const tog = $('logtog');
  if (!tog) return;
  tog.onclick = () => (logOpen ? closeLog() : openLog());
  const bg = $('lvbg');
  const x = $('lvx');
  if (bg) bg.onclick = closeLog;
  if (x) x.onclick = closeLog;
}

/**
 * The objective, stated as an order, above whatever is selected.
 *
 * This is the panel's resting state: it read "Nothing selected" for most of a
 * turn while the mission's actual goal lived in a header span that is hidden
 * on every compact layout. Progress gets pips up to five and a bar beyond —
 * nine pips is a counting exercise, not a glance.
 */
function drawObjective(host) {
  const el = $(host || 'objblk');
  if (!el) return;
  const b = objBrief();
  const met = b.total > 0 && b.done >= b.total;
  let prog = '';
  if (b.total > 0 && b.total <= 5) {
    prog = `<span class="pips">${Array.from({length: b.total}, (_, i) =>
      `<i class="${i < b.done ? 'on' : ''}"></i>`).join('')}</span>`;
  } else if (b.total > 0) {
    prog = `<span class="obar"><span style="width:${Math.min(100, b.done / b.total * 100)}%"></span></span>`;
  }
  const count = b.total > 0 ? `<b class="onum">${b.done} / ${b.total}</b>` : '';
  el.className = 'objblk' + (host ? ' lvobj' : '') + (met ? ' met' : '');
  el.innerHTML = `<span class="orow"><span class="olab">Objective</span>
      <span class="oclock">${b.clock}</span></span>
    <span class="ogoal">${b.goal}</span>
    ${prog || count ? `<span class="orow">${prog}${count}</span>` : ''}
    <span class="olose">${b.lose}</span>`;
}

/**
 * The hand header: how full you are, and why, when it matters.
 *
 * Two different situations wear two different colours. Gold FULL means the
 * turn draw is being held back and you should spend; violet OVER means a card
 * you played drew past the cap on purpose and nothing is being withheld.
 * Neither is an error, so neither uses the loss colour.
 */
function paintHandCount() {
  const n = $('handcount');
  const chip = $('handchip');
  if (!n || !chip) return;
  const size = G.hand.length;
  n.textContent = `Hand ${size}/${HAND_CAP}`;
  if (size > HAND_CAP) {
    chip.hidden = false;
    chip.className = 'handchip over';
    chip.textContent = 'over cap';
  } else if (size === HAND_CAP) {
    chip.hidden = false;
    chip.className = 'handchip full';
    chip.textContent = 'full — draw held';
  } else {
    chip.hidden = true;
  }
}

export function drawHand() {
  paintHandCount();
  const h = $('hcards');
  h.innerHTML = '';
  // The last tile the deck did not deal. Everything in front of it — the
  // lead's call, the Proto Frame — is something you brought rather than drew,
  // and the tray says so with a gap instead of asking the player to remember.
  let offdeck = null;

  // The lead's one call rides at the front of the hand, outside the deck.
  const def = stratReady();
  if (def) {
    const el = document.createElement('div');
    const cant = !canPlayStratagem() || G.over || replaying;
    el.className = 'hc strat' + (cant ? ' poor' : '') + (stratSel ? ' sel' : '');
    el.innerHTML = `<div class="hart"><div class="stratmark-art">⬡</div></div>
      <div class="n">${def.n}</div>`;
    el.title = def.n + ' — ' + def.d +
      (def.now ? ' Lands at the end of this turn.' : ' Resolves at the start of your next turn.');
    el.onclick = () => {
      if (cant) return;
      sfx(stratSel ? 'tap' : 'select');
      setSel(null);
      setMover(null);
      setStratSel(!stratSel);
      drawAll();
    };
    h.appendChild(el);
    offdeck = el;
  }

  // The mission's one Proto Frame, beside the deck rather than in it — always
  // there, never drawn, spent once. Same tile as a hand card because it IS a
  // card; the violet rail says the deck did not deal it.
  const proto = frameReady();
  if (proto) {
    const k = POOL[proto];
    const w = frameWeapon(proto);
    const v = vetOf(proto);
    const cant = costOf(proto) > G.dp || G.over || replaying;
    const el = document.createElement('div');
    el.className = `hc proto t-${k.t} v${v.t}` + (cant ? ' poor' : '') + (sel === proto ? ' sel' : '');
    el.innerHTML = `<div class="protomark" aria-hidden="true">◈</div>
      <div class="hart">${artFor(proto, k.t, null, v.t >= 2 ? v.col : null)}</div>
      <div class="n">${k.n}</div>`;
    el.title = `${k.n} — ${k.d}\nCarrying ${w ? w.n : 'its service weapon'}. One per mission.`;
    el.onclick = () => {
      if (cant) return;
      sfx(sel === proto ? 'tap' : 'select');
      setSel(sel === proto ? null : proto);
      setMover(null);
      setStratSel(false);
      drawAll();
    };
    h.appendChild(el);
    offdeck = el;
  }

  // Only worth a divider when there is something on the other side of it.
  if (offdeck && G.hand.length) offdeck.classList.add('railend');

  G.hand.forEach((cid, index) => {
    const k = POOL[cid];
    const cost = costOf(cid);
    const unaffordable = cost > G.dp || G.over;
    const g = gearOf(cid);
    const v = vetOf(cid);

    const el = document.createElement('div');
    el.className = `hc t-${k.t} v${v.t}` + (unaffordable ? ' poor' : '') + (sel === cid ? ' sel' : '');
    // A trading card: the seal face and the name, nothing else. Cost, hull
    // and tier live in the details panel when the card is selected, and in
    // full behind its View card button.
    //
    // The fitted gear used to print its name here as a third line. At six
    // cards across, "Overclocked Uplink" wrapped to two lines under a name
    // that had already wrapped, and it still only said which piece — never
    // what it does. A cyan corner mark says "this one is geared"; the piece
    // and its rules text are in View card, where there is room to read them.
    el.innerHTML = `${index < 9 ? `<div class="hkey">${index + 1}</div>` : ''}
      ${v.t ? `<div class="hpips">${'◆'.repeat(v.t)}</div>` : ''}
      ${g ? '<div class="hgear" aria-hidden="true">◈</div>' : ''}
      <div class="hart">${artFor(cid, k.t, null, v.t >= 2 ? v.col : null)}</div>
      <div class="n">${cardName(cid)}</div>`;
    // Hover carries the rules text, and the gear's too now that the tile does
    // not print it.
    el.title = cardName(cid) + ' — ' + k.d + (g ? `\nGear: ${g.n} — ${g.d}` : '');
    el.onclick = () => {
      if (unaffordable) return;
      sfx(sel === cid ? 'tap' : 'select');
      setSel(sel === cid ? null : cid);
      setMover(null);
      setStratSel(false);
      drawAll();
    };
    h.appendChild(el);
  });

  // Whether the tray actually spills is a measurement, not a count: the cap
  // says six but a card effect can push past it, and how many fit depends on
  // the width the tray was given. Ask the layout, then fade the edge so the
  // extra cards announce themselves.
  h.classList.remove('spill');
  if (h.scrollWidth > h.clientWidth + 1) h.classList.add('spill');

  if (!G.hand.length && !def) {
    h.innerHTML = '<div style="font-size:0.6875rem;color:var(--dim)">Hand empty — hold with what is on the board.</div>';
  }
}

export function drawAll() {
  if (!G || !active) return;
  const m = MISSIONS[G.type];

  const waveLabel = G.endless ? `Wave ${G.turn}` : `Wave ${Math.min(G.turn, G.waves)} / ${G.waves}`;
  $('c-title').innerHTML = `${waveLabel} <span class="sep">·</span> ${m.n}` +
    (G.mod !== 'none' ? ` <span class="modtag">${MODS[G.mod].n}</span>` : '');
  $('c-dp').textContent = G.dp;
  paintLogToggle();
  paintAlert();
  drawObjective();
  const ground = held();
  const allow = breachAllowance(G.type);
  $('c-ter').textContent = ground;
  $('c-ter').className = ground <= GROUND_FLOOR ? 'bad' : ground <= GROUND_FLOOR + 2 ? 'warn' : '';
  $('c-br').innerHTML = G.breaches + '<span class="of">/' + allow + '</span>';
  $('c-br').className = G.breaches >= allow - 1 ? 'bad' : '';
  $('c-deck').textContent = G.deck.length;

  // Field events ride at the front of the incoming strip: the live one bright,
  // the telegraphed one dim — the same promise contract as the spawn markers.
  const evChips = (G.event ? `<span class="incp evt" data-evt="${G.event}">${EVENTS[G.event].icon} ${EVENTS[G.event].n}</span>` : '')
    + (G.eventNext ? `<span class="incp evtnext" data-evt="${G.eventNext}">next · ${EVENTS[G.eventNext].n}</span>` : '');

  const blind = G.mod === 'blackout';
  const manChips = G.manifest && !blind
    ? (Object.keys(G.manifest).length
      ? Object.entries(G.manifest)
        .map(([k, v]) => `<span class="incp" data-foe="${k}"><span class="fglyph">${FOE_GLYPH[k] || '▪'}</span>${BEST[k].n}<b>${v}</b></span>`).join('')
      // A boss mission's manifest is empty every turn — the hive sends nothing,
      // the machine makes its own. "Dead air" would be a lie here.
      : G.type === 'boss' ? '<span class="incp">The target spawns its own escort</span>'
        : '<span class="incp">Dead air — no spawns</span>')
    : G.manifest ? '<span class="incp">Blackout — no preview</span>'
      : '<span class="incp">No further hostiles</span>';
  $('man').innerHTML = evChips + manChips;
  document.querySelectorAll('#man [data-evt]').forEach(el => {
    el.onclick = () => notify(EVENTS[el.dataset.evt].n, EVENTS[el.dataset.evt].d);
  });

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
