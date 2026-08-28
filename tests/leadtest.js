// Team lead passives and actives, the Drop Pod, and enemy doctrines.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures, builtPage, pageParts} from './support/harness.js';
import {spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {portrait} from '../src/render/art.js';
import {leadCardHTML, leadTilesHTML, toggleRoster, closeRoster} from '../src/render/hold.js';
import {renderOps} from '../src/render/ops.js';
import {openPanel} from '../src/render/panels.js';
import {drawAll} from '../src/render/combat.js';
import {ask, notify, dlgClose} from '../src/render/dialog.js';

const F = failures();
const page = builtPage();
const {head, css} = pageParts(page);
const firstNode = () => Object.keys(A.opRun().nodes)[0];

A.enterProfile(unlockAll(A.blankProfile('LD'), Object.keys(A.POOL).slice(0, 12)));

// --- leads exist, render, and are switchable ---
if (Object.keys(A.LEADS).length !== 8) F.push('expected 8 team leads');
Object.keys(A.LEADS).forEach(id => {
  const L = A.LEADS[id];
  if (!L.passive && !L.stratagem) F.push(id + ' has neither passive nor stratagem');
  const svg = portrait(id);
  if (!svg.startsWith('<svg') || svg.length < 200) F.push(id + ' portrait did not render');
});

renderOps();
{
  const html = get('opsbody')._html;
  ['leadcard', 'leadpic', 'leadname', 'leadinfo', 'data-lead'].forEach(t => {
    if (!html.includes(t)) F.push('ops banner missing ' + t);
  });
  if (/undefined|NaN|\[object/.test(html)) F.push('ops banner render artefact');
}

// --- Ironbrand: +1 hull on every unit deployed ---
A.active.lead = 'ironbrand';
A.launch(firstNode());
  stillAir();
{
  const u = A.mkUnit('rifle', 2, 1);
  if (u.max !== A.POOL.rifle.hp + 1) F.push(`Ironbrand hull bonus missing (${u.max} vs ${A.POOL.rifle.hp + 1})`);
}
A.active.lead = 'wildfire';
{
  const u = A.mkUnit('rifle', 2, 1);
  if (u.max !== A.POOL.rifle.hp) F.push('hull bonus applied under the wrong lead');
}

// --- Coldwire: +1 hull repaired at the end of every turn ---
A.active.lead = 'coldwire';
A.launch(firstNode());
  stillAir();
{
  clearBoard();
  const u = A.mkUnit('rifle', 2, 1);
  u.hp = 2;
  A.G.units.push(u);
  A.playerPhase();
  if (u.hp !== 3) F.push(`Nanite Weave should repair 1 (hp ${u.hp})`);
  u.hp = u.max;
  A.playerPhase();
  if (u.hp > u.max) F.push('repair overhealed past max');
}

// --- Wildfire's call is once per mission, and the badge says so ---
A.active.lead = 'wildfire';
A.launch(firstNode());
  stillAir();
{
  if (!A.G.strat || A.G.strat.k !== 'requisition') F.push('Wildfire mission did not seed her stratagem');
  if (A.G.strat.played) F.push('the call should start unspent');
  drawAll();
  const badge = get('leadbadge');
  if (!badge._html.includes('READY')) F.push('badge should show CALL READY while unspent');
  A.G.strat.played = true;
  drawAll();
  if (!badge._html.includes('SPENT')) F.push('badge should show SPENT once called');
}
A.active.lead = 'ironbrand';
drawAll();
{
  const badge = get('leadbadge')._html;
  if (badge.includes('READY') || badge.includes('SPENT')) F.push('a lead without a stratagem should show no call tag');
}

// --- Drop Pod gear: crushes a Common hostile, cannot touch a Specialist ---
{
  if (!A.GEAR.dropod) F.push('Drop Pod is not gear');
  if (A.POOL.dropod) F.push('Drop Pod is still a card');

  A.active.loadout.gear = {rifle: 'dropod'};
  A.launch(firstNode());
  stillAir();
  clearBoard();
  A.G.hand = ['rifle'];
  A.G.dp = 9;
  const crawler = spawnFoe('crawler', 2, 6, 3);
  spawnFoe('sovereign', 3, 6, 40);

  const tiles = A.validTiles('rifle');
  if (!tiles.includes(2 * A.COLS + 6)) F.push('drop pod cannot target a Common hostile');
  if (tiles.includes(3 * A.COLS + 6)) F.push('drop pod should not be able to crush a Specialist');
  // The gear widens where the card may go; it must not remove normal ground.
  if (!tiles.some(t => A.G.ter[(t / A.COLS) | 0][t % A.COLS] === 'p')) {
    F.push('drop pod gear removed the card\'s normal deployment tiles');
  }

  A.deploy('rifle', 2, 6);
  if (A.G.enemies.some(e => e.uid === crawler.uid)) F.push('drop pod did not destroy the hostile');
  const pod = A.G.units.find(u => u.id === 'rifle');
  if (!pod) F.push('drop pod left no unit behind');
  else if (pod.lane !== 2 || pod.col !== 6) F.push('drop pod did not occupy the cleared cell');
  if (A.G.ter[2][6] !== 'p') F.push('cleared cell was not claimed');
  A.active.loadout.gear = {};
}

// --- Knight is a Common unit, and does not out-riposte the Specialist ---
{
  const knight = A.POOL.knight;
  if (knight.t !== 'common') F.push('Knight is not a Common');
  if (knight.tech) F.push('Knight is still flagged Tech');
  if (knight.riposte >= A.POOL.aegis.riposte) {
    F.push(`Knight ripostes for ${knight.riposte}, at or above the Specialist's ${A.POOL.aegis.riposte}`);
  }
  const u = A.mkUnit('knight', 2, 1);
  if (u.tech) F.push('a deployed Knight still counts as Tech');
}

// --- doctrine variety, and what each posture does to lane spread ---
{
  A.launch(firstNode());
  stillAir();
  const seen = {};
  for (let i = 0; i < 400; i++) seen[A.rollDoctrine()] = 1;
  if (Object.keys(seen).length < 3) F.push('doctrine roll never produced all three postures');

  const lanesUsed = d => {
    A.G.doctrine = d;
    A.G.manifest = {crawler: 5};
    A.predictSpawns();
    return new Set(A.G.predict.map(x => x.lane)).size;
  };
  const focus = lanesUsed('focus');
  const spread = lanesUsed('spread');
  if (focus > 2) F.push(`focus used ${focus} lanes, expected at most 2`);
  if (spread < 4) F.push(`spread used only ${spread} lanes, expected 4+`);
}

// --- the lead card lives on Squad, not on the hold screen ---
{
  const card = leadCardHTML();
  ['leadpic', 'leadname', 'leadrole', 'leadperk', 'leadbio'].forEach(k => {
    if (!card.includes(k)) F.push('lead card missing ' + k);
  });
  if (/undefined|NaN|\[object/.test(card)) F.push('lead card artefact');

  // The roster grid carries the switching; every lead gets a tile.
  const tiles = leadTilesHTML('squad');
  if ((tiles.match(/data-leadfocus=/g) || []).length !== Object.keys(A.LEADS).length) {
    F.push('roster grid does not offer every lead');
  }
  if (!tiles.includes('leadtile')) F.push('roster grid missing its tiles');
  if (/undefined|NaN|\[object/.test(tiles)) F.push('roster grid artefact');

  // The roster folds behind the portrait: closed by default, the portrait is
  // the toggle, and the Quartermaster's grid never folds at all.
  if (!card.includes('data-rosterbtn')) F.push('lead portrait is not the roster toggle');
  if (!card.includes('lswap')) F.push('portrait missing its swap chip');
  if (!tiles.includes('leadroster')) F.push('squad roster missing its fold wrapper');
  if (tiles.includes('leadroster open')) F.push('roster should start folded');
  toggleRoster();
  if (!leadTilesHTML('squad').includes('leadroster open')) F.push('toggle did not open the roster');
  closeRoster(true);
  if (leadTilesHTML('squad').includes('leadroster open')) F.push('closeRoster left the roster open');
  if (!leadCardHTML().includes('absorb')) F.push('assigning should pulse the portrait');
  if (leadCardHTML().includes('absorb')) F.push('the absorb pulse should be one-shot');
  if (leadTilesHTML('shop').includes('leadroster')) F.push('the shop grid should not fold');

  openPanel('squad');
  const squad = get('pbody')._html;
  if (!squad.includes('leadcard')) F.push('Squad page is missing the lead card');
  if (!squad.includes('leadgrid')) F.push('Squad page is missing the roster grid');
  if (!squad.includes('Team lead')) F.push('Squad page is missing the lead heading');
  if (head.includes('id="leadcard"')) F.push('stale lead card still in the hold markup');
  if (css.includes('.leadbar{')) F.push('stale .leadbar css still present');
}

// --- the combat badge sits top-right (placement itself is headtest's job) ---
{
  const rule = (/\.leadbadge\{([^}]*)\}/.exec(css) || [])[1] || '';
  if (!/grid-area:\s*badge/.test(rule)) F.push('lead badge not placed in the badge area');
  if (!/justify-self:\s*end/.test(rule)) F.push('lead badge not aligned right');
}

// --- dialogs close via the X, with no Understood button ---
{
  if (!head.includes('id="dlgx"')) F.push('dialog X button missing from markup');
  if (page.includes("ok: 'Understood'") || page.includes("ok:'Understood'")) {
    F.push('Understood button still present');
  }

  notify('Test', 'Body copy');
  if (get('dlgacts').style.display !== 'none') F.push('notify still shows the action row');
  if (get('dlgok').style.display !== 'none') F.push('notify still shows a confirm button');
  dlgClose(false);
  if (get('dlg')._cls.has('on')) F.push('X close did not dismiss the dialog');

  let got = null;
  ask('Q', 'msg', v => { got = v; }, {ok: 'Go'});
  if (get('dlgacts').style.display === 'none') F.push('confirm dialog hid its actions');
  dlgClose(true);
  if (got !== true) F.push('confirm callback did not fire');
}

F.report('leads, drop pod, doctrine: all checks pass');
