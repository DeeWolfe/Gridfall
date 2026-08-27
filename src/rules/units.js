// Turning a card into a unit on the board, and the friendly buffs acting on it.

import {POOL} from '../content/cards.js';
import {G, nextUid} from '../state/session.js';
import {gearOf, leadOf} from '../save/progression.js';

/** Buffs stack but are capped, so a Scout/Relay/Herald stack cannot run away. */
const MAX_BUFF = 2;

/**
 * Build the live unit for card `cid` landing at (l, c). Gear and the team
 * lead's passive are folded in here, once, so nothing downstream has to
 * remember to ask about them.
 */
export function mkUnit(cid, l, c) {
  const k = POOL[cid];
  const g = gearOf(cid);
  const lead = leadOf();
  const hardened = lead.passive && lead.passive.n === 'Hardened Frames' && k.hp ? 1 : 0;
  const hp = k.hp + (g && g.hp ? g.hp : 0) + hardened;
  const shield = (k.regen ? 1 : 0) + (g && g.shield ? g.shield : 0);

  return {
    uid: nextUid(),
    id: cid,
    n: k.n,
    t: k.t,
    lane: l,
    col: c,
    size: k.size || 1,
    hp,
    max: hp,
    mob: !!k.mob,
    tg: k.tg || 'none',
    dmg: (k.dmg || 0) + (g && g.dmg ? g.dmg : 0),
    indirect: !!k.indirect,
    // NOTE: the reference build dropped this flag on the floor, which quietly
    // turned every single-target card into an area attack in live play. The
    // data, the spec, the targeting UI and the test suite all assume it is
    // here; see docs/NOTES.md for the balance impact of putting it back.
    single: !!k.single,
    blocker: !!k.blocker,
    aura: k.aura || 0,
    colBuff: k.col || 0,
    laneB: k.laneB || 0,
    dampen: k.dampen || 0,
    heal: k.heal || 0,
    hot: k.hot || 0,
    healType: k.healType,
    healMode: k.healMode,
    pen: !!k.pen || !!(g && g.pen),
    scorch: !!k.scorch,
    cool: !!(g && g.cool),
    phase: !!(g && g.phase),
    choose: !!k.choose,
    tgt: null,
    pristine: k.pristine || 0,
    tech: !!k.tech,
    regen: !!k.regen,
    riposte: k.riposte || 0,
    servo: !!(g && g.servo),
    ab: k.ab || null,
    att: {},
    acted: false,
    moved: false,
    cd: 0,
    stun: 0,
    regenTicks: 0,
    phased: false,
    fresh: true,
    shieldMax: shield,
    shield,
  };
}

/** Total friendly damage buff on `u` from auras, column relays and lane standards. */
export function buffOf(u) {
  let b = 0;
  G.units.forEach(o => {
    if (o.uid === u.uid) return;
    if (o.aura && Math.abs(o.lane - u.lane) + Math.abs(o.col - u.col) === 1) b += o.aura;
    if (o.colBuff && o.col === u.col) b += o.colBuff;
    if (o.laneB && o.lane === u.lane) b += o.laneB;
  });
  return Math.min(b, MAX_BUFF);
}

/** Damage this unit would deal right now, buffs and pristine bonus included. */
export function dmgPreview(u) {
  const pristine = u.pristine && u.hp >= u.max ? u.pristine : 0;
  return Math.max(0, u.dmg + buffOf(u) + pristine);
}
