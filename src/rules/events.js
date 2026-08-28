// Turn events: field conditions run on the same promise contract as the
// spawn markers. Each event is announced a full turn before it lands
// (G.eventNext), and G.event itself carries it for exactly one turn before
// expiring. Most effects live and die with that single turn — they live
// where the numbers they touch live: strike()/forecastThreat for the
// tremor, fire()/dmgPreview for the overclock, wave() for the hive's mood,
// the end-of-turn DP grant for the supply drop — and every pair must stay
// mirrored, or the banner lies to the player. Bombardment and Research Team
// are the two exceptions: each fires a one-time effect the instant G.event
// picks it up (phases.js, alongside the supply grant), but that effect
// outlives the turn on its own separate clock — G.rubble for the crater,
// a timer on the G.civ entry for the research team — same pattern as
// G.scorch already uses for plasma burn. The event flag still only lasts
// one turn; what it started doesn't have to.

import {G} from '../state/session.js';
import {chance, randInt} from '../state/rng.js';
import {clog} from './log.js';

export const EVENTS = {
  supply: {n: 'Supply Drop', icon: '▼',
    d: 'A requisition pod lands behind the line — +2 deploy points this turn.'},
  tremor: {n: 'Seismic Tremor', icon: '≈',
    d: 'The ground heaves under the horde — every hostile strike deals 1 less this turn.'},
  overclock: {n: 'Grid Overclock', icon: '⌁',
    d: 'The power grid spikes — your Tech units strike for +1 this turn.'},
  surge: {n: 'Hive Surge', icon: '▲',
    d: 'The tunnels drum louder — the wave marked this turn arrives +2 threat heavy.'},
  calm: {n: 'Dead Air', icon: '○',
    d: 'The tunnels go quiet — no hostiles spawn at the end of this turn.'},
  bombard: {n: 'Bombardment', icon: '☄',
    d: 'The hive lobs spike ordnance downrange — three tiles take a direct hit and craters for a few turns after.'},
  research: {n: 'Research Team', icon: '⚗',
    d: 'A field team drops in to tag a live specimen. Keep it standing a few turns and it extracts clean — credits for the escort.'},
};

const EVENT_CHANCE = 0.35;

/** Roll the event telegraphed for the coming turn — usually nothing. Research
 * Team sits out a Civilians mission: it rides G.civ same as the shelter and
 * its walkers do, and an unflagged extra entry there would throw off that
 * mode's own extraction count and shelter-hull tracking. */
export function rollEvent() {
  if (!chance(EVENT_CHANCE)) return null;
  const keys = Object.keys(EVENTS).filter(k => !(k === 'research' && G.type === 'civilians'));
  return keys[randInt(keys.length)];
}

/**
 * Advance the event clock at end of turn: the telegraphed event goes live for
 * the coming turn, and the one after is rolled and announced. Runs BEFORE the
 * next wave is rolled, so surge/calm shape the manifest they promised to.
 */
export function eventTick() {
  // Determinism valve for the guard suite: a mission flagged noEvents never
  // rolls, so exact-number assertions hold. Balance harnesses leave it unset.
  if (G.noEvents) { G.event = null; G.eventNext = null; return; }
  G.event = G.eventNext || null;
  G.eventNext = rollEvent();
  if (G.event) {
    const ev = EVENTS[G.event];
    clog(`<span style="color:var(--violet)">${ev.icon} ${ev.n}</span> — ${ev.d}`, 'order');
  }
  if (G.eventNext) {
    clog(`Field report: <span style="color:var(--violet)">${EVENTS[G.eventNext].n}</span> expected next turn.`, 'info');
  }
}

/** The tremor's bite on one hostile strike. Mirrored by forecastThreat. */
export const eventStrikeMalus = () => (G.event === 'tremor' ? 1 : 0);

/** The overclock's edge on one Tech unit's shot. Mirrored by dmgPreview. */
export const eventTechBonus = u => (G.event === 'overclock' && u.tech ? 1 : 0);
