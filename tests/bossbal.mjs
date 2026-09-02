import './support/install-dom.js';
import * as A from './support/api.js';
import {unlockAll} from './support/fixtures.js';
import {playOut} from './support/bot.js';
import {BOSSDEF} from '../src/content/bosses.js';
const RUNS = 60;
for (const k of ['brood', 'subject', 'envoy']) {
  const d = BOSSDEF[k];
  let w = 0, turns = 0;
  const why = {};
  for (let i = 0; i < RUNS; i++) {
    const q = unlockAll(A.blankProfile('B' + i),
      ['rifle', 'marks', 'wall', 'medic', 'lancer', 'bulwark', 'assassin', 'knight', 'samurai', 'archer', 'turret', 'scout']);
    q.op = d.op;
    A.enterProfile(q);
    A.launchSpec({node: null, op: d.op, type: 'boss', mod: 'none', reward: 40, boss: d.sub ? k : undefined});
    playOut({advance: true, maxTurns: 40});
    if (A.G.result && A.G.result.cleared) w++;
    else {
      const r = (A.G.result && A.G.result.why) || 'unknown';
      const key = /clock/.test(r) ? 'clock' : /breach/i.test(r) ? 'breach' : /tiles|held/i.test(r) ? 'ground' : 'other';
      why[key] = (why[key] || 0) + 1;
    }
    turns += A.G.turn;
  }
  console.log(`${k.padEnd(8)} hp ${d.hp}  ${w}/${RUNS} = ${Math.round(w / RUNS * 100)}%  avgTurns ${(turns / RUNS).toFixed(1)}  losses: ${JSON.stringify(why)}`);
}
