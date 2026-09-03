// Hand-run boss balance probe — NOT in the run-all guards (it plays hundreds
// of bot missions and takes minutes). Use it whenever boss numbers move:
//   node tests/bossbal.mjs                       every boss, 40 runs each
//   KEYS=brood,prism RUNS=60 node tests/bossbal.mjs
// Reports win rate, average turns, and what the losses died to — the loss
// mode is the diagnosis (clock = hull/clock mismatch, breach = add pressure).
import './support/install-dom.js';
import * as A from './support/api.js';
import {unlockAll} from './support/fixtures.js';
import {playOut} from './support/bot.js';
import {BOSSDEF} from '../src/content/bosses.js';

const RUNS = Number(process.env.RUNS || 40);
for (const k of (process.env.KEYS || Object.keys(BOSSDEF).join(',')).split(',')) {
  const d = BOSSDEF[k];
  if (!d) { console.log(`${k}: no such boss`); continue; }
  let w = 0, turns = 0;
  const why = {};
  for (let i = 0; i < RUNS; i++) {
    const q = unlockAll(A.blankProfile('B' + i),
      ['rifle', 'marks', 'wall', 'medic', 'lancer', 'bulwark', 'assassin', 'sentry', 'samurai', 'archer', 'rampart', 'scout']);
    q.op = d.op;
    A.enterProfile(q);
    A.launchSpec({node: null, op: d.op, type: 'boss', mod: 'none', reward: 40, boss: d.sub ? k : undefined});
    playOut({advance: true, maxTurns: 60});
    if (A.G.result && A.G.result.cleared) w++;
    else {
      const r = (A.G.result && A.G.result.why) || 'unknown';
      const key = /clock/.test(r) ? 'clock' : /breach/i.test(r) ? 'breach' : /tiles|held/i.test(r) ? 'ground' : 'other';
      why[key] = (why[key] || 0) + 1;
    }
    turns += A.G.turn;
  }
  console.log(`${k.padEnd(10)} hp ${String(d.hp).padStart(3)}  ${w}/${RUNS} = ${Math.round(w / RUNS * 100)}%  avgTurns ${(turns / RUNS).toFixed(1)}  losses: ${JSON.stringify(why)}`);
}
