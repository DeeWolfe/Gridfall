// Corrupted and legacy save handling, plus every screen surviving a null
// profile. migrate() must REPAIR what it finds, never reject it — a save that
// points at a card which no longer exists still has to load and be playable.
import './support/install-dom.js';
import * as A from './support/api.js';
import {dispatch} from './support/dom.js';
import {failures} from './support/harness.js';
import {renderModes} from '../src/render/modes.js';
import {renderOps} from '../src/render/ops.js';
import {renderMap} from '../src/render/map.js';
import {paintHold, enter} from '../src/render/hold.js';
import {openPanel} from '../src/render/panels.js';
import {boot} from '../src/render/wiring.js';

// Boot for real so the window-level handlers below are the shipped ones.
boot();

const F = failures();
const PANELS = ['squad', 'quartermaster', 'database', 'record', 'settings'];

// Native modals would block a real browser; nothing may reach for them.
globalThis.confirm = () => { throw new Error('native confirm called'); };
globalThis.alert = () => { throw new Error('native alert called'); };
globalThis.prompt = () => { throw new Error('native prompt called'); };

function step(name, fn) {
  try {
    fn();
    console.log('ok   ' + name);
  } catch (e) {
    console.log('FAIL ' + name + ' -> ' + e.message);
    F.push(name + ': ' + e.message);
  }
}

step('boot with no profile', () => {});
step('create profile + enter', () => enter(A.blankProfile('TEST')));
step('renderModes', () => renderModes());
step('renderOps', () => renderOps());
step('renderMap', () => renderMap());
step('paintHold', () => paintHold());
PANELS.forEach(p => step('panel ' + p, () => openPanel(p)));
step('onslaught launch', () => A.launchOnslaught());
step('onslaught abort', () => A.abortMission());
step('descent start', () => { A.startRun(); A.active.run.lead = 'ironbrand'; });
step('descent launch', () => A.launchRunNode(A.active.run.map.nodes[0].id));
step('descent abort', () => A.abortMission());

// Switching record drops the active profile; screens must not throw on it.
step('switch record then renderModes', () => { A.setActive(null); renderModes(); });
step('renderOps with no profile', () => renderOps());
step('renderMap with no profile', () => renderMap());
step('paintHold with no profile', () => paintHold());
step('openPanel with no profile', () => PANELS.forEach(openPanel));
step('commit with no profile', () => A.commit());

// The window-level handlers must survive having no profile at all.
step('resize handler with active null', () => dispatch('resize'));
step('keydown handler with active null', () => dispatch('keydown', {key: 'Escape'}));
step('beforeunload with active null', () => dispatch('beforeunload'));
step('error handler with active null', () => dispatch('error', {message: 'synthetic'}));

console.log('--- corrupt / legacy save handling ---');

const cases = [
  ['v1 legacy', [{version: 1, id: 'a', callsign: 'OLD', created: 1, lastPlayed: 1,
    progress: {rank: 1, xp: 0, credits: 10}, unlocks: {cards: ['scout'], enemies: []},
    loadout: {deck: ['scout']}, stats: {}}]],
  ['unknown op', [{version: 4, id: 'b', callsign: 'B', created: 1, lastPlayed: 1,
    op: 'nowhere', ops: {}, progress: {}, unlocks: {}, loadout: {}, stats: {}}]],
  ['deleted cards', [{version: 4, id: 'c', callsign: 'C', created: 1, lastPlayed: 1,
    op: 'ironveil', ops: {}, progress: {}, unlocks: {cards: ['ghostcard', 'scout']},
    loadout: {deck: ['ghostcard', 'rifle'], gear: {ghostcard: 'barrel', scout: 'nogear'}},
    stats: {}}]],
  ['empty object', [{}]],
  ['not an array', {version: 4}],
  ['unparseable', '{{{'],
];

for (const [name, data] of cases) {
  try {
    A.store.set(A.KEY, typeof data === 'string' ? data : JSON.stringify(data));
    const loaded = A.initProfiles();

    if (name === 'not an array' || name === 'unparseable') {
      if (loaded.length) F.push(`${name}: expected no profiles, got ${loaded.length}`);
      console.log(`ok   ${name} -> ignored, ${loaded.length} profiles`);
      continue;
    }

    const p = loaded[0];
    if (!p) throw new Error('migrate rejected the save instead of repairing it');
    enter(p);
    paintHold();
    renderModes();
    renderOps();
    renderMap();
    PANELS.forEach(openPanel);

    if (p.loadout.deck.some(c => !A.POOL[c])) F.push(name + ': deck still references a missing card');
    if (p.unlocks.cards.some(c => !A.POOL[c])) F.push(name + ': collection still references a missing card');
    if (Object.keys(p.loadout.gear).some(k => !A.POOL[k] || !A.GEAR[p.loadout.gear[k]])) {
      F.push(name + ': gear still references something missing');
    }
    if (!A.OPS[p.op]) F.push(name + ': unknown operation survived migration');
    if (!p.settings || typeof p.settings !== 'object') F.push(name + ': migration left no settings object');

    console.log(`ok   ${name} -> op: ${p.op} deck: ${p.loadout.deck.length}`);
  } catch (e) {
    console.log('FAIL ' + name + ' -> ' + e.message);
    F.push(name + ': ' + e.message);
  }
}

F.report('corrupt and legacy saves: all checks pass');
