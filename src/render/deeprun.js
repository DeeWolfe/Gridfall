// The Deep Run screen: the generated map, the route in front of you, and the
// kit the run has handed you so far.
//
// It shares the operation map's SVG builders (mapSvg) rather than drawing its
// own, and it shares the pack overlay for the draft rather than inventing a
// second reward beat. What it does not share is the profile: nothing on this
// screen reads or writes the collection, the loadout or the lead, because a
// run that consulted your unlocks would stop being the same run for everybody.

import {MISSIONS} from '../content/missions.js';
import {MODS} from '../content/modifiers.js';
import {POOL} from '../content/cards.js';
import {GEAR} from '../content/gear.js';
import {LEADS} from '../content/leads.js';
import {BOSSDEF} from '../content/bosses.js';
import {active} from '../state/session.js';
import {commit} from '../save/profile.js';
import {queueDraft} from '../rules/packs.js';
import {launchRunNode} from '../rules/mission.js';
import {
  startRun, runActive, runMap, runNodeState, runNodeSpec, runComplete,
  runDepthReached, runDeckCap, RUN_STARTER,
} from '../rules/roguelike.js';
import {$, show} from './dom.js';
import {ask} from './dialog.js';
import {mapSvg} from './map.js';
import {showPack, setAfterPacks} from './packs.js';
import {playBossBrief} from './codec.js';

/**
 * Node labels for the run map. The operation maps hand-name their nodes and put
 * the mission underneath; a generated map has no names to give, and the mission
 * names themselves ("Defend Stronghold", "Fight for Crystals") are wider than
 * the spacing a five-column map leaves, so the board carries a short code and
 * the route list on the right carries the full briefing.
 */
const RUN_CODE = {
  stronghold: 'HOLD', civilians: 'RESCUE', specimens: 'CAPTURE', crystals: 'CRYSTALS',
  retake: 'RETAKE', extract: 'EXTRACT', uplink: 'UPLINK', blitz: 'BLITZ', boss: 'TARGET',
};
function runLabel(n, m) {
  if (n.role === 'start') return ['DROP', ''];
  if (n.role === 'final') return ['TARGET', ''];
  const spec = runNodeSpec(n.id);
  const code = RUN_CODE[Object.keys(MISSIONS).find(k => MISSIONS[k] === m)] || '';
  return [code, spec && spec.mod !== 'none' ? '◈' : ''];
}

/** The run's own loadout readout — deck, gear and lead as the run holds them. */
function kitHTML(r) {
  const L = LEADS[r.lead];
  const cards = r.deck.map(c => {
    const k = POOL[c];
    const g = GEAR[r.gear[c]];
    return `<div class="row"><span>${k ? k.n : c}</span>
      <span class="r${g ? ' hot' : ''}">${g ? g.n : '—'}</span></div>`;
  }).join('');
  return `<div class="sect">Lead</div><div class="rows">
      <div class="row"><span>${L
    ? `<b style="color:${L.col}">${L.call}</b> · ${L.role}
      <div style="font-size:0.6562rem;color:var(--dim);margin-top:4px;line-height:1.5">${[
    L.passive ? '◈ ' + L.passive.d : '', L.con ? '▽ ' + L.con.d : '',
  ].filter(Boolean).join(' ')}</div>`
    : 'Not yet chosen'}</span></div></div>
    <div class="sect">Manifest — ${r.deck.length} / ${runDeckCap()}</div>
    <div class="rows">${cards || '<div class="row"><span style="color:var(--dim)">Empty.</span></div>'}</div>`;
}

/** Offer one or more drafts back to back and come back here once they are taken. */
function draft(...labels) {
  labels.forEach(l => queueDraft(l));
  setAfterPacks(() => renderRun());
  if (!showPack()) renderRun();
}

/** The panel shown when there is no run to stand on — before one, or after. */
function idleHTML() {
  const r = active.run;
  const ended = r && r.over;
  const won = ended && runComplete();
  const best = active.bests.run || 0;
  return `<div class="mapwrap"><div>
      <div class="sect">${ended ? (won ? '突破 · Run complete' : '断絶 · Run ended') : '深層 · Deep Run'}</div>
      <div class="oplore" style="border-color:#9d6bff">${ended
    ? (won
      ? 'The target is down and the ground behind you is somebody else’s problem now. ' +
        'Everything the run handed you stays where you found it — the credits are what comes home.'
      : `The run stopped at layer ${runDepthReached()}. Nothing carries forward but what you learned ` +
        'about the ground, which is the only thing that ever did.')
    : 'One drop, one route, one way out. You go in with five cards and no lead, and every layer ' +
      'you clear offers three things — take one. Your collection is not consulted and never will be: ' +
      'the run is the same for a commander on their first night as it is for one with the whole roster. ' +
      'A single loss ends it.'}</div>
      <div class="sect">Standing orders</div><div class="rows">
        <div class="row"><span>Starting manifest</span><span class="r">${RUN_STARTER.length} cards</span></div>
        <div class="row"><span>Draft after every layer</span><span class="r">3 offered, keep 1</span></div>
        <div class="row"><span>Depth</span><span class="r hot">Raises hive pressure every 2 layers</span></div>
        <div class="row"><span>A loss</span><span class="r hot">Ends the run</span></div>
      </div>
    </div><div>
      <div class="sect">Record</div><div class="rows">
        <div class="row"><span>Deepest layer reached</span><span class="r hot">${best}</span></div>
        <div class="row"><span>Runs completed</span><span class="r">${active.bests.runsDone || 0}</span></div>
      </div>
      <div class="row" style="margin-top:14px;justify-content:center">
        <button class="btn gold" id="runstart">${ended ? '↺ Run it again' : 'Begin the descent ▸'}</button>
      </div>
    </div></div>`;
}

export function renderRun() {
  if (!active) return;
  active.bests = active.bests || {onslaught: 0, gauntlet: 0};

  if (!runActive()) {
    $('runbody').innerHTML = idleHTML();
    $('runstart').onclick = () => {
      startRun();
      // Two picks before the first drop. The lead is the run's opening
      // decision and asking it after the drop would mean fighting the drop
      // under a default nobody chose; the card that follows is what turns
      // the starter five into a hand with an idea in it.
      draft('Deep Run · choose your lead', 'Deep Run · first requisition');
    };
    return;
  }

  const r = active.run;
  const map = runMap();
  if (!r.lead) { draft('Deep Run · choose your lead'); return; }

  const open = map.nodes.filter(n => runNodeState(n.id) === 'open');
  const briefings = open.map(n => {
    const nd = runNodeSpec(n.id);
    const m = MISSIONS[nd.type];
    const md = MODS[nd.mod];
    const boss = nd.type === 'boss' ? BOSSDEF[nd.boss] : null;
    const tag = n.role === 'final'
      ? ` <span style="color:var(--gold)">· ${boss ? boss.n.toUpperCase() : 'PRIORITY TARGET'} — ends the run</span>` : '';
    return `<div class="row" data-go="${n.id}" style="cursor:pointer">
      <span><b style="color:var(--zan)">Layer ${nd.depth} — ${m.n}</b>${nd.mod !== 'none'
    ? ` <span style="color:var(--violet)">· ${md.n}</span>` : ''}${tag}
      <div style="font-size:0.6562rem;color:var(--dim);margin-top:4px;line-height:1.5">${m.d}${md.d ? ' ' + md.d : ''}${nd.heat
    ? ` <span style="color:var(--hot)">Hive pressure +${nd.heat}.</span>` : ''}</div></span>
      <span class="r hot">${nd.reward} cr ▸</span></div>`;
  }).join('');

  $('runbody').innerHTML = `<div class="mapwrap"><div><div class="mapsvg">
    ${mapSvg(map, r, false, runNodeState, null, runLabel)}</div>
    <div class="sect">状況 · Situation report</div>
    <div class="oplore" style="border-color:${map.col}">${map.lore}</div></div>
    <div><div class="sect">Route — ${open.length} ahead · layer ${runDepthReached() + 1} of ${map.layers.length}</div>
    <div class="rows">${briefings || '<div class="row"><span style="color:var(--dim)">Nowhere left to go.</span></div>'}</div>
    ${kitHTML(r)}
    <div class="row" style="margin-top:14px;justify-content:center">
      <button class="btn ghost" id="runquit">Abandon run</button></div></div></div>`;

  document.querySelectorAll('#runbody [data-n],#runbody [data-go]').forEach(el => {
    const id = el.dataset.n || el.dataset.go;
    if (runNodeState(id) !== 'open') return;
    el.onclick = () => {
      const nd = runNodeSpec(id);
      if (nd.type === 'boss' && nd.boss && playBossBrief(nd.boss, () => launchRunNode(id))) return;
      launchRunNode(id);
    };
  });

  $('runquit').onclick = () => ask('Abandon run',
    'Walk away at layer ' + runDepthReached() + '? The run closes where it stands — ' +
    'the credits you have banked are yours, everything you drafted is not.',
    ok => {
      if (!ok) return;
      r.over = true;
      commit();
      renderRun();
    }, {ok: 'Abandon'});
}

/** Enter the Deep Run screen from anywhere. */
export function openRun() {
  show('deeprun');
  renderRun();
}
