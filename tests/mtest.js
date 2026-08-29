// Balance: win rate per mission type, across all three operations.
// Informational — this harness reports, it does not pass or fail.
import * as A from './support/api.js';
import {playOut} from './support/bot.js';

const RUNS_PER_OP = 10;
const byType = {};

for (const opKey of Object.keys(A.OPS)) {
  for (let run = 0; run < RUNS_PER_OP; run++) {
    // Roll one operation's worth of nodes, then play each from a clean profile
    // so no node inherits progress from the one before it.
    const seed = A.blankProfile('T' + run);
    seed.op = opKey;
    A.setActive(seed);
    A.setMapdef(opKey);
    A.genRun();
    const nodes = seed.ops[opKey].nodes;

    for (const nodeId of Object.keys(nodes)) {
      const type = nodes[nodeId].type;
      byType[type] = byType[type] || {w: 0, l: 0, e: 0, why: {}};

      const p = A.blankProfile('X');
      p.op = opKey;
      p.ops = JSON.parse(JSON.stringify(seed.ops));
      A.setActive(p);
      A.setMapdef(opKey);

      try {
        A.launch(nodeId);
        const r = playOut({advance: true});
        if (!r.over) { byType[type].e++; continue; }
        r.won ? byType[type].w++ : byType[type].l++;
        const why = (r.result && r.result.lines[0]) || '';
        byType[type].why[why.slice(0, 46)] = (byType[type].why[why.slice(0, 46)] || 0) + 1;
      } catch (err) {
        byType[type].e++;
        if (!globalThis._shownError) {
          console.log('ERR', err.message, (err.stack || '').split('\n')[1]);
          globalThis._shownError = 1;
        }
      }
    }
  }
}

Object.entries(byType).forEach(([type, v]) => {
  const total = v.w + v.l + v.e;
  console.log(type.padEnd(12), 'win', String(v.w).padStart(3), 'lose', String(v.l).padStart(3),
    Math.round(v.w / total * 100) + '%');
  // The two objective missions are the ones worth knowing the failure mode of.
  if (type === 'retake' || type === 'crystals') {
    Object.entries(v.why || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
      .forEach(([why, n]) => console.log('              ', n + 'x', why));
  }
});
