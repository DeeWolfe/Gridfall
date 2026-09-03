// Support and buff targeting: what each unit type paints blue, and what it
// must not. Ends with a renderer check that the panel says so in words.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {drawAll} from '../src/render/combat.js';

const F = failures();
const cell = u => u.lane * A.COLS + u.col;

A.enterProfile(unlockAll(A.blankProfile('HL'), Object.keys(A.POOL).slice(0, 12)));
A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();
clearBoard();

// Scout buffs the four orthogonal neighbours
{
  const scout = spawnUnit('scout', 2, 1);
  const near = [spawnUnit('rifle', 2, 0), spawnUnit('rifle', 2, 2),
    spawnUnit('rifle', 1, 1), spawnUnit('rifle', 3, 1)];
  const far = spawnUnit('rifle', 0, 0);

  const lit = new Set(A.supportTargets(scout));
  near.forEach(o => { if (!lit.has(cell(o))) F.push(`scout missed neighbour at ${o.lane},${o.col}`); });
  if (lit.has(cell(far))) F.push('scout buffed a non-adjacent unit');
  if (lit.has(cell(scout))) F.push('scout highlighted itself');
  if (!/adjacent/i.test(A.supportLabel(scout) || '')) F.push('scout label wrong');
}

// Field Marshal buffs its column AND its lane, nothing else
{
  clearBoard();
  const marshal = spawnUnit('marshal', 2, 2);
  const inCol = [spawnUnit('rifle', 0, 2), spawnUnit('rifle', 4, 2)];
  const inLane = spawnUnit('rifle', 2, 5);
  const outside = spawnUnit('rifle', 0, 5);
  const lit = new Set(A.supportTargets(marshal));
  if (!inCol.every(o => lit.has(cell(o)))) F.push('marshal missed a column mate');
  if (!lit.has(cell(inLane))) F.push('marshal missed a lane mate');
  if (lit.has(cell(outside))) F.push('marshal buffed outside lane and column');
}

// Medic heals only the unit directly ahead, and only personnel
{
  clearBoard();
  const medic = spawnUnit('medic', 2, 1);
  const ahead = spawnUnit('rifle', 2, 2);
  const techAhead = spawnUnit('firingstep', 1, 2);

  const lit = new Set(A.supportTargets(medic));
  if (!lit.has(cell(ahead))) F.push('medic missed the unit ahead');
  if (lit.has(cell(techAhead))) F.push('medic targeted a Tech unit');
}

// Tech Medic hits Tech only
{
  clearBoard();
  const techmed = spawnUnit('techmed', 2, 3);
  const rampart = spawnUnit('firingstep', 0, 3);
  const person = spawnUnit('rifle', 4, 3);

  const lit = new Set(A.supportTargets(techmed));
  if (!lit.has(cell(rampart))) F.push('tech medic missed a Tech unit');
  if (lit.has(cell(person))) F.push('tech medic targeted personnel');
}

// Pyre Emitter paints its whole lane as influence
{
  clearBoard();
  const scrambler = spawnUnit('pyre', 1, 2);
  if (A.influenceCells(scrambler).length !== A.COLS) {
    F.push(`pyre influence should cover its ${A.COLS}-cell lane`);
  }
}

// Attackers produce no blue, supports produce no gold
{
  clearBoard();
  spawnFoe('crawler', 2, 5, 3);
  const marksman = spawnUnit('marks', 2, 1);
  if (A.supportTargets(marksman).length) F.push('marksman should have no support cells');
  if (!A.targetsFor(marksman).length) F.push('marksman should have a gold target');

  const scout = spawnUnit('scout', 4, 1);
  if (A.targetsFor(scout).length) F.push('scout should have no attack target');

  // The panel must say what the support unit is doing, without artefacts.
  A.setMover(scout);
  drawAll();
  const panel = get('selinfo')._html;
  if (!/Buffing/.test(panel)) F.push('support line missing from panel');
  if (/undefined|NaN|\[object/.test(panel)) F.push('panel artefact');
}

F.report('highlighting: all checks pass');
