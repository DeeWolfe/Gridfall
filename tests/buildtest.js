// The built page has to actually run.
//
// The bundler flattens every module into one scope, so this evaluates the
// shipped script in a stub DOM and drives it through a mission. It is the only
// harness that tests the build output as code rather than as text; everything
// else either reads dist as a string or imports src directly.
import './support/install-dom.js';
import {get} from './support/dom.js';
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const {body} = pageParts(builtPage());
const script = body.slice(body.indexOf('<script>') + 8, body.indexOf('</script>'));

if (!script.trim()) F.push('built page has an empty script block');
if (/^\s*(import|export)\s/m.test(script)) F.push('module syntax survived bundling');

let api;
try {
  // The bundle ends with boot(); everything it declares is in scope here.
  api = new Function(script + `
    ;return {blankProfile, enterProfile, opRun, launch, endTurn, deploy, validTiles,
      costOf, show, POOL, COLS, G: () => G, active: () => active};`)();
} catch (e) {
  F.push('built script threw on evaluation: ' + e.message);
  F.report('built page runs');
  process.exit();
}

// boot() should have populated the record-select slots. (Which screen is
// visible at load comes from the static markup, not from script, so csstest
// checks that against the page text rather than here.)
if (get('slots').children.length !== 3) {
  F.push(`record slots never rendered (${get('slots').children.length} of 3)`);
}

try {
  const p = api.blankProfile('BUILD');
  api.enterProfile(p);
  api.launch(Object.keys(api.opRun().nodes)[0]);
  if (!api.G()) throw new Error('no mission started');

  let turns = 0;
  while (api.G() && !api.G().over && turns++ < 30) {
    for (let n = 0; n < 6; n++) {
      const card = [...api.G().hand].find(x => api.costOf(x) <= api.G().dp);
      if (!card) break;
      const tiles = api.validTiles(card);
      if (!tiles.length) break;
      api.deploy(card, (tiles[0] / api.COLS) | 0, tiles[0] % api.COLS);
    }
    api.endTurn();
  }
  if (!api.G() || !api.G().over) F.push('mission never resolved in the built page');
  else if (!api.G().result) F.push('built page produced no mission result');
  else console.log('built page played a mission to:', api.G().result.title);
} catch (e) {
  F.push('built page threw during play: ' + e.message);
}

F.report('built page runs');
