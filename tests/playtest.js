// Full playthrough: every screen, panel, mission type and wired control.
//
// This is the harness that catches what the logic tests cannot — a render
// artefact, a control wired to nothing, a screen that never repaints. It plays
// real missions and then clicks every dynamically generated control it can find.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {unlockAll} from './support/fixtures.js';
import {renderModes} from '../src/render/modes.js';
import {renderOps} from '../src/render/ops.js';
import {renderMap} from '../src/render/map.js';
import {paintHold, enter} from '../src/render/hold.js';
import {openPanel, renameShip} from '../src/render/panels.js';
import {focusCard, focusEnemy, focusGear} from '../src/render/focus.js';
import {dlgClose} from '../src/render/dialog.js';
import {leaveCombat} from '../src/render/combat.js';
import {boot} from '../src/render/wiring.js';

// Boot for real: with the hooks installed, every deploy, move and end-of-turn
// repaints the combat screen, so the artefact checks below see real renders.
boot();

const F = failures();
let checked = 0;

// Native modals would block a real browser; nothing may reach for them.
globalThis.confirm = () => { throw new Error('BLOCKED native confirm'); };
globalThis.alert = () => { throw new Error('BLOCKED native alert'); };
globalThis.prompt = () => { throw new Error('BLOCKED native prompt'); };

function T(name, fn) {
  checked++;
  try {
    fn();
  } catch (e) {
    F.push(name + ' -> ' + e.message);
  }
}

/** An artefact here means a template hole the renderer papered over. */
function noUndef(id, label) {
  const html = get(id)._html + get(id)._text;
  if (/undefined|\[object |NaN/.test(html)) F.push('render artefact in ' + label);
}

// 1. a fresh player walks in
T('create', () => enter(A.blankProfile('PILOT')));
T('hold', () => { paintHold(); noUndef('deploysub', 'hold'); noUndef('shipname', 'shipname'); });
T('readout', () => {
  noUndef('readout', 'deployment readout');
  const html = get('readout')._html;
  ['opmini', 'dhead', 'pips', 'dgo'].forEach(k => {
    if (!html.includes(k)) throw new Error('readout missing ' + k);
  });
  if (html.includes('nodes secured')) throw new Error('readout grew its node tally back');
  if (html.includes('dpic')) throw new Error('readout grew its lead row back');
});
T('ticker', () => {
  noUndef('ticker', 'service ticker');
  const t = get('ticker')._text;
  if (!t || t.length < 80) throw new Error('ticker line too short to crawl');
  if (!t.includes('残心ネット')) throw new Error('ticker lost its zanshin-net chatter');
});
T('rename ship', () => {
  renameShip();
  dlgClose('VALKYRIE');
  if (A.active.ship !== 'VALKYRIE') throw new Error('ship name not applied');
});
T('modes', () => { renderModes(); noUndef('modesbody', 'modes'); });
T('ops', () => { renderOps(); noUndef('opsbody', 'ops'); });
T('map', () => { renderMap(); noUndef('mapbody', 'map'); });

// 2. panels and the focus overlay
const PANELS = ['squad', 'quartermaster', 'database', 'record', 'settings'];
PANELS.forEach(p => T('panel ' + p, () => { openPanel(p); noUndef('pbody', 'panel ' + p); }));
T('focus card', () => { focusCard('marks', 'shop'); noUndef('fwrap', 'focus card'); });
T('focus gear', () => { focusGear('barrel'); noUndef('fwrap', 'focus gear'); });
T('focus enemy', () => { focusEnemy('hulk'); noUndef('fwrap', 'focus enemy'); });

/** Play the mission out, exercising deploys, moves and abilities every turn. */
function playMission(label, maxTurns = 30, endless = false) {
  let t = 0;
  while (A.G && !A.G.over && t++ < maxTurns) {
    for (let n = 0; n < 8; n++) {
      const card = [...A.G.hand].sort((a, b) => A.costOf(b) - A.costOf(a))
        .find(x => A.costOf(x) <= A.G.dp);
      if (!card) break;
      const tiles = A.validTiles(card);
      if (!tiles.length) break;
      // Deploy as far forward as legal — it stresses territory and clashes.
      const tile = tiles.sort((a, b) => (b % A.COLS) - (a % A.COLS))[0];
      A.deploy(card, (tile / A.COLS) | 0, tile % A.COLS);
    }
    A.G.units.filter(u => u.ab && !u.cd && !u.acted).slice(0, 1).forEach(u => A.doAbility(u));
    A.G.units.filter(u => u.mob && !u.acted && !u.moved).slice(0, 2).forEach(u => {
      const moves = A.moveTargets(u);
      if (moves.length) A.doMove(u, (moves[0] / A.COLS) | 0, moves[0] % A.COLS);
    });
    A.endTurn();
    noUndef('board', 'board');
    noUndef('hcards', 'hand');
    noUndef('selinfo', 'selected');
  }
  if ((!A.G || !A.G.over) && !endless) F.push(label + ': never resolved');
  return A.G;
}

// 3. a full campaign mission
T('campaign mission', () => {
  A.launch(Object.keys(A.opRun().nodes)[0]);
  playMission('campaign');
  noUndef('rs', 'result');
});
T('post-mission map', () => { renderMap(); noUndef('mapbody', 'map after'); });

// 4. shop, deck and gear round trip
T('buy card', () => {
  A.active.progress.credits = 5000;
  A.active.progress.salvage = 2000;
  focusCard('samurai', 'shop');
});
T('deck edit', () => {
  const p = A.active;
  if (!p.unlocks.cards.includes('samurai')) p.unlocks.cards.push('samurai');
  p.loadout.deck = p.loadout.deck.slice(0, 11);
  p.loadout.deck.push('samurai');
  p.loadout.gear = {samurai: 'barrel', marks: 'servo'};
  openPanel('squad');
  noUndef('pbody', 'squad geared');
});

// 5. Onslaught, and where aborting sends you
T('onslaught', () => {
  A.launchOnslaught();
  const G = playMission('onslaught', 60, true);
  if (!G.endless) F.push('onslaught not flagged endless');
});
T('onslaught abort routes to modes', () => {
  A.launchOnslaught();
  leaveCombat();
  if (!get('modes')._cls.has('on')) F.push('abort did not return to modes');
});

// 6. the Gauntlet chain
T('gauntlet', () => { A.launchGauntlet(); playMission('gauntlet'); });
T('gauntlet abort clears chain', () => {
  A.launchGauntlet();
  leaveCombat();
  if (A.active.gaunt !== null) F.push('gauntlet chain not cleared on abort');
});

// 7. every mission type, played to a conclusion
Object.keys(A.MISSIONS).forEach(type => {
  T('mission type ' + type, () => {
    const p = unlockAll(A.blankProfile('M'), Object.keys(A.POOL).slice(0, 12));
    A.setSel(null);
    enter(p);
    const run = A.opRun();
    const nodeId = Object.keys(run.nodes)[0];
    run.nodes[nodeId].type = type;
    A.launch(nodeId);
    playMission(type);
  });
});

// 8. save round trip through storage
T('save reload', () => {
  if (!A.store.get(A.KEY)) throw new Error('nothing persisted');
  const loaded = A.initProfiles();
  const p = loaded[0];
  if (!p) throw new Error('no profile after reload');
  enter(p);
  paintHold();
  renderMap();
});

// 9. click everything the renderer wires up dynamically
function clickAll(render, label) {
  T('wire ' + label, () => {
    render();
    const selectors = ['[data-focus]', '[data-foe]', '[data-gear]', '[data-tab]', '[data-op]',
      '[data-go]', '[data-n]', '#expo', '#newrun', '#shipren',
      '#goCampaign', '#goOnslaught', '#goGauntlet', '#ironbox'];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        try {
          if (typeof el.onclick === 'function') el.onclick({target: el, stopPropagation() {}, dataset: el.dataset});
          if (typeof el.onchange === 'function') el.onchange();
        } catch (e) {
          F.push(label + ' ' + sel + ' -> ' + e.message);
        }
      });
    });
  });
}

const rich = A.blankProfile('WIRE');
rich.progress.credits = 9000;
rich.progress.salvage = 9000;
enter(rich);
PANELS.forEach(k => clickAll(() => openPanel(k), 'panel ' + k));
clickAll(() => renderModes(), 'modes');
clickAll(() => renderOps(), 'ops');
clickAll(() => { enter(rich); renderMap(); }, 'map');
clickAll(() => focusCard('marks', 'shop'), 'focus shop');
clickAll(() => focusCard('marks', 'gear'), 'focus gear-fit');

console.log('checks run:', checked);
F.report('PLAYABLE — no failures');
