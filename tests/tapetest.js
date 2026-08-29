// Turn playback: the tape the rules record, and the replay that presents it.
//
// The contract worth pinning: recording is off until a presenter enables it
// (the bots and logic harnesses must pay nothing), frames are snapshots rather
// than live references, endTurn hands the tape to the turnResolved hook and
// falls back to a plain invalidate when the hook declines, and a replay leaves
// G exactly as it found it — with input held off while it runs.
import './support/install-dom.js';
import * as A from './support/api.js';
import {get, flushTimers} from './support/dom.js';
import {failures} from './support/harness.js';
import {spawnUnit, spawnFoe, clearBoard, unlockAll, stillAir} from './support/fixtures.js';
import {enableTape, tapeBegin, tapeEnd} from '../src/rules/tape.js';
import {playTurn, skipReplay, isReplaying} from '../src/render/playback.js';
import {drawAll, drawActions} from '../src/render/combat.js';

const F = failures();
let captured = null;
let invalidated = 0;
let takeOver = false;
A.setHooks({
  turnResolved: frames => { captured = frames; return takeOver; },
  invalidate: () => { invalidated++; },
});

A.enterProfile(unlockAll(A.blankProfile('TP'), ['rifle', 'wall', 'scout', 'marks']));
A.launch(Object.keys(A.opRun().nodes)[0]);
  stillAir();

// 1. before anyone enables recording, the tape stays empty and free
A.endTurn();
if (captured === null) F.push('turnResolved was never called');
else if (captured.length) F.push('the tape recorded before anything enabled it');
if (!invalidated) F.push('declining the tape did not fall back to invalidate');

// 2. enabled, a turn with hostiles produces frames with real events
enableTape();
clearBoard();
const rifle = spawnUnit('rifle', 2, 1);
spawnFoe('crawler', 2, 4, 3);
spawnFoe('crawler', 3, 7, 3);
A.endTurn();

if (!captured.length) F.push('an eventful turn recorded no frames');
const allEvents = captured.flatMap(f => f.events);
if (!allEvents.some(e => e.type === 'hit' && e.foe && e.amount > 0)) {
  F.push('the rifleman auto-fire produced no hit event');
}
if (!captured.some(f => f.label === 'territory')) F.push('no territory beat in the tape');
if (!captured.some(f => f.label === 'spawn')) F.push('no spawn frames in the tape');

// 3. frames are snapshots, not live references
{
  const frame = captured.find(f => f.units.length);
  if (!frame) {
    F.push('no frame carried units');
  } else {
    if (frame.units.some(u => A.G.units.includes(u))) F.push('a frame shares unit objects with G');
    if (frame.ter === A.G.ter) F.push('a frame shares the territory grid with G');
    const hp = frame.units[0].hp;
    frame.units[0].hp = -99;
    if (A.G.units.some(u => u.hp === -99)) F.push('mutating a frame mutated the live game');
    frame.units[0].hp = hp;
  }
}

// 4. replay swaps the frames in, holds off input, and restores G exactly
{
  takeOver = true;
  A.endTurn();
  const frames = captured;
  if (!frames.length) F.push('no tape to replay');

  const before = {units: A.G.units, enemies: A.G.enemies, ter: A.G.ter, breaches: A.G.breaches};
  let finished = false;
  const started = playTurn(frames, () => { finished = true; });
  if (!started) F.push('playTurn refused a non-empty tape');
  if (!A.replaying || !isReplaying()) F.push('replay did not raise the replaying flag');
  if (!get('combat')._cls.has('replaying')) F.push('the combat screen was not marked replaying');

  // Input holds off: endTurn refuses, the action bar reads Resolving.
  const turn = A.G.turn;
  A.endTurn();
  if (A.G.turn !== turn) F.push('endTurn ran mid-replay');
  drawActions();
  if (get('actPrimary').textContent !== 'Resolving…') F.push('action bar does not say Resolving…');
  if (!get('actPrimary').disabled) F.push('End turn stayed clickable mid-replay');

  // Run the tape out through the stubbed timers.
  for (let i = 0; i < 200 && !finished; i++) flushTimers();
  if (!finished) F.push('replay never finished');
  if (A.replaying || isReplaying()) F.push('replaying flag not cleared after the tape');
  if (get('combat')._cls.has('replaying')) F.push('replaying class not removed');
  if (A.G.units !== before.units || A.G.enemies !== before.enemies ||
      A.G.ter !== before.ter || A.G.breaches !== before.breaches) {
    F.push('replay did not restore G to the real final state');
  }
}

// 5. skipping mid-tape restores immediately
{
  A.endTurn();
  if (captured.length) {
    let finished = false;
    playTurn(captured, () => { finished = true; });
    skipReplay();
    if (!finished) F.push('skip did not finish the replay');
    if (A.replaying) F.push('skip left the replaying flag up');
    flushTimers();   // any stale timer must be harmless after a skip
    if (A.replaying) F.push('a stale timer restarted the replay after skip');
  }
}

// 6. finish() discards a half-recorded tape rather than replaying over a result
{
  tapeBegin();
  A.finish(true);
  if (tapeEnd().length) F.push('finish() left a recorded tape behind');
  if (!A.G.over) F.push('finish() did not end the mission');
}

F.report('turn playback: all checks pass');
