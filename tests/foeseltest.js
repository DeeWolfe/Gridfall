// Selecting a hostile on the combat board.
//
// The grid used to obey two rules: tapping one of yours selected it, tapping
// one of theirs jumped straight to a popup. Now it obeys one. What that has to
// preserve is the thing a player would notice instantly if it broke —
// attacking. A tap on a hostile already in a selected unit's sights is a shot,
// not an inspection, and no amount of new selection behaviour may swallow it.
import './support/install-dom.js';
import * as A from './support/api.js';
import {failures} from './support/harness.js';
import {foeThreatCells} from '../src/rules/forecast.js';
import {BEST} from '../src/content/hostiles.js';
import {COLS} from '../src/state/constants.js';

const F = failures();
const p = A.blankProfile('FOESEL');
A.setActive(p);

const board = () => {
  A.launchSpec({node: null, type: 'stronghold', mod: 'none', reward: 0, heat: 1});
  A.G.units = [];
  A.G.enemies = [];
  return A.G;
};
let uid = 70000;
const foe = (k, lane, col) => ({uid: ++uid, k, lane, col, hp: BEST[k].hp, mv: 0});
const unit = (id, lane, col) => {
  const u = A.mkUnit(id, lane, col);
  u.uid = ++uid;
  return u;
};
const cols = list => list.map(i => i % COLS).sort((a, b) => a - b);

// --- the ranged hostile threatens its whole lane, not just its target ---
{
  const G = board();
  const spitter = foe('spitter', 2, 4);          // hold: 4, so it fires now
  G.enemies = [spitter];
  G.units = [unit('rifle', 2, 1)];
  const t = foeThreatCells(spitter);
  console.log('spitter threatens columns:', cols(t.threat), 'strikes:', cols(t.strike));
  if (cols(t.strike).join() !== '1') F.push(`spitter struck ${cols(t.strike)}, expected column 1`);
  if (t.threat.length !== 4) F.push(`spitter threatened ${t.threat.length} cells, expected 4`);
  // The point of the threat band: dropping a body into the gap changes who
  // eats the shot. If that stops being true the highlight is decorative.
  G.units.push(unit('rifle', 2, 3));
  const t2 = foeThreatCells(spitter);
  if (cols(t2.strike).join() !== '3') {
    F.push(`a closer body did not take the shot — struck ${cols(t2.strike)}, expected column 3`);
  }
  console.log('a closer body takes the shot instead:', cols(t2.strike).join() === '3');
}

// --- a melee hostile shows the ground it crosses, and stops at what it hits ---
{
  const G = board();
  const crawler = foe('crawler', 1, 5);          // spd 2
  G.enemies = [crawler];
  G.units = [unit('wall', 1, 1)];
  const t = foeThreatCells(crawler);
  console.log('crawler advance columns:', cols(t.threat));
  if (t.threat.length !== 2) F.push(`crawler showed ${t.threat.length} cells of advance, expected 2`);
  if (t.strike.length) F.push('crawler struck from out of contact');

  // Once it is in contact it strikes instead of advancing.
  const touching = foe('crawler', 1, 2);
  G.enemies = [touching];
  const t2 = foeThreatCells(touching);
  if (!t2.strike.length) F.push('a hostile in contact did not show a strike');
  if (t2.threat.length) F.push('a hostile in contact showed an advance as well as a strike');
  console.log('in contact: strikes and does not advance:', !!t2.strike.length && !t2.threat.length);
}

// --- emplacements project a lane, not a step ---
{
  const G = board();
  const pylon = foe('pylon', 3, 6);
  G.enemies = [pylon];
  const t = foeThreatCells(pylon);
  console.log('pylon lane effect cells:', t.infl.length);
  if (t.infl.length !== COLS) F.push(`pylon lit ${t.infl.length} cells, expected the whole lane (${COLS})`);
  if (t.strike.length || t.threat.length) F.push('an immobile, unarmed hostile showed a strike or advance');
}

// --- a stunned hostile threatens nothing ---
{
  const G = board();
  const c = foe('crawler', 2, 3);
  c.stun = 1;
  G.enemies = [c];
  G.units = [unit('rifle', 2, 2)];
  const t = foeThreatCells(c);
  if (t.strike.length || t.threat.length) F.push('a stunned hostile still threatened ground');
  console.log('stunned hostile threatens nothing:', !t.strike.length && !t.threat.length);
}

// --- selection state is mutually exclusive ---
{
  board();
  const u = unit('rifle', 2, 1);
  const e = foe('crawler', 2, 4);
  A.G.units = [u];
  A.G.enemies = [e];

  A.setMover(u);
  A.setFoeSel(null);
  A.setFoeSel(e);
  A.setMover(null);
  if (A.mover) F.push('selecting a hostile left a unit selected');

  A.clearSelection();
  if (A.foeSel) F.push('clearSelection() left a hostile selected');
  console.log('clearSelection drops the hostile too:', !A.foeSel);
}

// --- every hostile produces a readable threat without throwing ---
{
  let ok = 0;
  for (const k of Object.keys(BEST)) {
    const G = board();
    G.enemies = [foe(k, 2, 5)];
    G.units = [unit('rifle', 2, 1)];
    try {
      const t = foeThreatCells(G.enemies[0]);
      if (Array.isArray(t.strike) && Array.isArray(t.threat) && Array.isArray(t.infl)) ok++;
    } catch (err) {
      F.push(`${k}: foeThreatCells threw — ${err.message}`);
    }
  }
  console.log(`hostiles with a readable threat: ${ok} / ${Object.keys(BEST).length}`);
  if (ok !== Object.keys(BEST).length) F.push('some hostiles produced no threat shape');
}

F.report('hostile selection: threat, advance and lane effects all read true');
