// Manual target locks, stale-lock fallback, and the selection panel's copy.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, unlockAll, stillAir} from './support/fixtures.js';
import {drawAll} from '../src/render/combat.js';

const F = failures();
A.enterProfile(unlockAll(A.blankProfile('AIM'),
  ['assassin', 'dragoon', 'rifle', 'marks', 'wall', 'scout']));
A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();

// Push a few turns so hostiles actually arrive.
for (let t = 0; t < 5; t++) A.endTurn();

// Any hostile that has left the board's edge column will do, so long as there
// is a cell in FRONT of it to stand in. Taking enemies[0] blindly put the
// Assassin on column -1 whenever the oldest hostile had reached column 0 —
// which it now does far more often, because a hostile that meets an obstacle
// reroutes instead of stalling. The test was always unsound; v2.3 just made it
// show up one run in five.
const foe = A.G.enemies.find(e => e.col >= 1);
if (!foe) {
  F.push('no hostile stopped short of the edge column to test aiming against');
} else {
  // An Assassin surrounded on several sides has a real choice to make.
  const asn = spawnUnit('assassin', foe.lane, foe.col - 1);
  [[0, 1], [1, 0], [-1, 0]].forEach(([dl, dc]) => {
    const l = asn.lane + dl;
    const c = asn.col + dc;
    if (l >= 0 && l < A.LANES && c >= 0 && c < A.COLS && !A.foeAt(l, c)) spawnFoe('crawler', l, c, 3);
  });

  const candidates = A.candidatesFor(asn);
  if (candidates.length < 2) F.push('expected multiple candidates, got ' + candidates.length);

  const auto = A.targetsFor(asn)[0];
  const other = candidates.find(e => e.uid !== auto.uid);
  if (!other) {
    F.push('no alternative target to lock');
  } else {
    asn.tgt = other.uid;
    const locked = A.targetsFor(asn)[0];
    if (!locked || locked.uid !== other.uid) F.push('manual lock not respected by targetsFor');
  }

  // A lock on something that has since died must fall back, not blank out.
  asn.tgt = 999999;
  if (!A.targetsFor(asn).length) F.push('stale lock did not fall back to auto-target');
}

// Multi-target cards expose no choice at all.
['lancer', 'mortar', 'samurai', 'railgun'].forEach(id => {
  const u = A.mkUnit(id, 2, 1);
  if (A.candidatesFor(u).length) F.push(id + ' should not offer target choice');
});

// Single-target cards do, and mkUnit must carry the flag that says so.
['rifle', 'marks', 'archer', 'assassin', 'bulwark'].forEach(id => {
  if (!A.mkUnit(id, 2, 1).single) F.push(id + ' lost its single-target flag in mkUnit');
});

// Threat forecast shape
{
  const th = A.forecastThreat();
  if (typeof th.hits !== 'object' || typeof th.atk !== 'object') F.push('forecast shape wrong');
}

// The panel renders cleanly in each selection state.
const panelIsClean = label => {
  const html = get('selinfo')._html;
  if (/undefined|NaN|\[object/.test(html)) F.push(`selected panel artefact (${label})`);
};
A.setMover(A.G.units[0]);
drawAll();
panelIsClean('mover');
A.setMover(A.G.units.find(u => u.single) || null);
drawAll();
panelIsClean('single-target unit');
A.setMover(null);
drawAll();
panelIsClean('idle');

F.report('targeting + feedback: all checks pass');
