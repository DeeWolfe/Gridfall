// The contextual action bar: what the two buttons say and do in each state.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get} from './support/dom.js';
import {failures} from './support/harness.js';
import {spawnUnit, unlockAll} from './support/fixtures.js';
import {drawAll} from '../src/render/combat.js';
import {dlgClose} from '../src/render/dialog.js';

const F = failures();
const primary = () => get('actPrimary');
const secondary = () => get('actSecondary');

A.enterProfile(unlockAll(A.blankProfile('AB'), ['scout', 'rifle', 'marks', 'assassin']));
A.launch(Object.keys(A.opRun().nodes)[0]);

// idle: end the turn, or walk away
drawAll();
if (primary().textContent !== 'End turn') F.push('idle primary should be End turn, got ' + primary().textContent);
if (secondary().textContent !== 'Abort') F.push('idle secondary should be Abort');
if (primary()._cls.has('danger')) F.push('idle primary should not be red');

// card selected: cancel the placement
A.setSel('rifle');
drawAll();
if (primary().textContent !== 'Cancel placement') {
  F.push('card primary should be Cancel placement, got ' + primary().textContent);
}
if (!primary()._cls.has('danger')) F.push('cancel placement should be red');
if (secondary().textContent !== 'View card') F.push('card secondary should be View card');

primary().onclick();
if (A.sel !== null) F.push('cancel placement did not clear the selection');
drawAll();
if (primary().textContent !== 'End turn') F.push('bar did not revert after cancelling');

// unit selected: deselect it
{
  const unit = spawnUnit('rifle', 2, 1);
  A.setSel(null);
  A.setMover(unit);
  drawAll();
  if (primary().textContent !== 'Deselect unit') {
    F.push('unit primary should be Deselect unit, got ' + primary().textContent);
  }
  if (!primary()._cls.has('danger')) F.push('deselect should be red');
  if (secondary().textContent !== 'View card') F.push('unit secondary should be View card');

  primary().onclick();
  if (A.mover !== null) F.push('deselect did not clear the selection');
}

// abort asks first — the mission survives until the player confirms
A.setMover(null);
A.setSel(null);
drawAll();
secondary().onclick();
if (!get('dlg')._cls.has('on')) F.push('Abort should open a confirmation dialog');
if (!A.G) F.push('Abort left the mission before the player confirmed');
dlgClose(false);
if (!A.G) F.push('cancelling the abort dialog should stay in the mission');
if (get('dlg')._cls.has('on')) F.push('cancel should close the abort dialog');
drawAll();
secondary().onclick();
dlgClose(true);
if (A.G) F.push('confirmed abort should leave the mission');

// mission over: End turn is disabled, and Abort leaves without asking
A.launch(Object.keys(A.opRun().nodes)[0]);
A.G.over = true;
drawAll();
if (!primary().disabled) F.push('End turn should be disabled once the mission is over');
secondary().onclick();
if (get('dlg')._cls.has('on')) F.push('Abort after the mission is over should not ask');
if (A.G) F.push('Abort after the mission is over should leave immediately');

F.report('action bar: all checks pass');
