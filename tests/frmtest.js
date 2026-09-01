// Balance: what a Proto Frame is actually worth.
//
// Informational — this harness reports, it does not pass or fail.
//
// Every other balance number in this repo is blind to Frames: mtest and onstest
// play STARTER decks, which carry no Pilot and leave the Frame slot empty, so
// the class has never once appeared in a measured mission. This exists to
// answer the only question that matters about it — is committing a deck slot,
// a card, and a whole turn to the Frame line worth doing?
//
// Four arms, same twelve-card spine, same bot, same mission set:
//
//   control    twelve cards, no Pilot, no Frame. What you play instead.
//   pilot      eleven cards + a Pilot, no Frame. The cost of the setup on its
//              own — this is what the Frame has to beat, because a Pilot with
//              nothing to climb into is a wasted card and a wasted point.
//   <frame>    eleven cards + a Pilot + that Frame fielded.
//
// The gap between `control` and `pilot` is the price of the line. The gap
// between `pilot` and a Frame arm is what the machine pays back.
import * as A from './support/api.js';
import {playOut} from './support/bot.js';
import {POOL} from '../src/content/cards.js';

// Small by default so `npm test` stays quick; the numbers worth quoting come
// from a deliberate long run — FRM_RUNS=120 node tests/frmtest.js.
const RUNS_PER_OP = Number(process.env.FRM_RUNS || 4);

// A spine strong enough that the arms differ by the Frame line and not by luck
// of the draw. Eleven, so the Pilot arms swap one card rather than adding one.
const SPINE = ['rifle', 'marks', 'wall', 'medic', 'lancer', 'bulwark',
  'assassin', 'knight', 'samurai', 'archer', 'turret'];
const FRAMES = Object.keys(POOL).filter(c => POOL[c].chassis === 'proto');

// The weapons each Frame is most itself with. A bare Frame and a kitted one
// are different cards — a bare White Devil is a 20-hull wall with a 2-damage
// blade — so both get arms, or the numbers describe a machine nobody fields.
// Two kits per Frame: the contact weapon and the reach weapon, because they
// answered very differently the first time this was measured — adjacency gear
// on an immobile machine waits for the fight, reach gear goes and finds it.
const KITS = {
  whitedevil: ['railcannon', 'napalm'],
  sevenblades: ['greatsword', 'longsword'],
  heavyarms: ['lasergat', 'missilegat'],
};

const ARMS = [
  {k: 'control', deck: [...SPINE, 'scout'], frame: null},
  {k: 'pilot', deck: [...SPINE, 'pilot'], frame: null},
  ...FRAMES.map(f => ({k: f, label: POOL[f].n + ' (bare)', deck: [...SPINE, 'pilot'], frame: f})),
  ...FRAMES.flatMap(f => KITS[f].map(g => ({
    k: f + '+' + g, label: POOL[f].n.split(' ')[0] + ' +' + g, deck: [...SPINE, 'pilot'], frame: f, gear: g,
  }))),
];

const stat = () => ({w: 0, l: 0, e: 0, framed: 0, turns: 0, kills: 0, lost: 0});
const tally = {};
const byType = {};
ARMS.forEach(a => { tally[a.k] = stat(); byType[a.k] = {}; });

// One roll of nodes per operation per run, played by every arm, so the arms
// face the SAME missions rather than four independent shuffles.
for (const opKey of Object.keys(A.OPS)) {
  for (let run = 0; run < RUNS_PER_OP; run++) {
    const seed = A.blankProfile('S' + run);
    seed.op = opKey;
    A.setActive(seed);
    A.setMapdef(opKey);
    A.genRun();
    const nodes = seed.ops[opKey].nodes;

    for (const nodeId of Object.keys(nodes)) {
      const type = nodes[nodeId].type;
      for (const arm of ARMS) {
        const p = A.blankProfile('X');
        p.op = opKey;
        p.ops = JSON.parse(JSON.stringify(seed.ops));
        p.unlocks.cards = Object.keys(POOL);
        p.loadout.deck = [...arm.deck];
        p.loadout.frame = arm.frame;
        p.unlocks.gear = Object.keys(A.GEAR);
        p.loadout.gear = arm.gear ? {[arm.frame]: arm.gear} : {};
        A.setActive(p);
        A.setMapdef(opKey);

        const t = tally[arm.k];
        byType[arm.k][type] = byType[arm.k][type] || {w: 0, n: 0};
        try {
          A.launch(nodeId);
          const r = playOut({advance: true, frames: true});
          if (!r.over) { t.e++; continue; }
          r.won ? t.w++ : t.l++;
          byType[arm.k][type].n++;
          if (r.won) byType[arm.k][type].w++;
          if (r.framed) t.framed++;
          t.turns += r.turns;
          t.kills += r.kills;
          t.lost += r.unitsLost;
        } catch (err) {
          t.e++;
          if (!globalThis._frmErr) {
            console.log('ERR', err.message, (err.stack || '').split('\n')[1]);
            globalThis._frmErr = 1;
          }
        }
      }
    }
  }
}

const pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : 0);
const name = a => a.label || (POOL[a.k] ? POOL[a.k].n : a.k);

console.log('\n-- proto frames: is the line worth running? --');
console.log('arm                    win%   missions   landed%  avg turns  kills  lost');
const base = tally.pilot;
const basePct = pct(base.w, base.w + base.l);
for (const arm of ARMS) {
  const t = tally[arm.k];
  const n = t.w + t.l;
  const row = [
    name(arm).padEnd(18),
    (pct(t.w, n) + '%').padStart(5),
    String(n).padStart(10),
    (arm.frame ? pct(t.framed, n) + '%' : '—').padStart(9),
    (n ? (t.turns / n).toFixed(1) : '0').padStart(10),
    (n ? (t.kills / n).toFixed(1) : '0').padStart(7),
    (n ? (t.lost / n).toFixed(1) : '0').padStart(6),
  ].join(' ');
  const delta = arm.frame ? `   ${(pct(t.w, n) - basePct >= 0 ? '+' : '')}${(pct(t.w, n) - basePct).toFixed(1)} vs pilot` : '';
  console.log(row + delta);
}

console.log('\nby mission type (win%):');
const types = [...new Set(ARMS.flatMap(a => Object.keys(byType[a.k])))].sort();
console.log('type'.padEnd(11) + ARMS.map(a => name(a).slice(0, 10).padStart(11)).join(''));
for (const ty of types) {
  console.log(ty.padEnd(11) + ARMS.map(a => {
    const v = byType[a.k][ty] || {w: 0, n: 0};
    return (v.n ? pct(v.w, v.n) + '%' : '—').padStart(11);
  }).join(''));
}

const errs = ARMS.reduce((a, x) => a + tally[x.k].e, 0);
console.log(`\nunresolved/errors: ${errs}`);
// Raw counts, so several independent passes can be summed rather than
// eyeballed — percentages cannot be averaged across runs of different size.
if (process.env.FRM_JSON) {
  console.log('JSON ' + JSON.stringify(ARMS.map(a => ({
    k: a.k, w: tally[a.k].w, l: tally[a.k].l, framed: tally[a.k].framed,
  }))));
}
console.log('reminder: the bot plays the Frame arms to a plan and the control arm greedily.');
