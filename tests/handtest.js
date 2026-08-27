// The combat screen's layout contract.
//
// The hand is a row of upright cards across the full width of the screen, not
// a stack of horizontal bars squeezed into the side rail — and the details
// panel sits beside the board, above the hand, so what you are about to play
// is next to where you are about to play it. None of that is visible to the
// logic harnesses, so it is checked here against the built page.
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const page = builtPage();
const {head, css} = pageParts(page);

const rule = sel => {
  const m = new RegExp('(?:^|\\n)' + sel + '\\s*\\{([^}]*)\\}', 'm').exec(css);
  return m ? m[1] : null;
};

// --- structure: head, board+details, then the hand strip ---
{
  const combat = head.slice(head.indexOf('id="combat"'));
  const at = needle => combat.indexOf(needle);

  const order = [
    ['cbhead', at('class="cbhead"')],
    ['cbmain', at('class="cbmain"')],
    ['cbfoot', at('class="cbfoot"')],
  ];
  order.forEach(([name, i]) => { if (i < 0) F.push('combat screen has no .' + name); });
  if (order.every(([, i]) => i >= 0)) {
    if (!(order[0][1] < order[1][1] && order[1][1] < order[2][1])) {
      F.push('combat order should be header, board, hand strip');
    }
  }

  // The hand and the action bar belong to the full-width footer.
  const foot = combat.slice(at('class="cbfoot"'));
  ['id="hcards"', 'id="actPrimary"', 'id="actSecondary"', 'id="c-dp"'].forEach(id => {
    if (!foot.includes(id)) F.push(id + ' is not in the footer strip');
  });

  // The details panel belongs to the rail beside the board, not the footer.
  const main = combat.slice(at('class="cbmain"'), at('class="cbfoot"'));
  if (!main.includes('id="selinfo"')) F.push('details panel is not beside the board');
  if (!main.includes('id="board"')) F.push('board is not in the main area');
  if (main.indexOf('id="board"') > main.indexOf('id="selinfo"')) {
    F.push('details panel is rendered before the board');
  }
}

// --- the hand is a scrolling row of upright cards ---
{
  const strip = rule('\\.hcards');
  if (!strip) {
    F.push('.hcards rule missing');
  } else {
    if (!/display:\s*flex/.test(strip)) F.push('hand is not laid out as a row');
    if (/grid-template-columns/.test(strip)) F.push('hand is still a stacked grid');
    if (!/overflow-x:\s*auto/.test(strip)) F.push('hand does not scroll sideways');
  }

  const card = rule('\\.hc');
  if (!card) {
    F.push('.hc rule missing');
  } else {
    if (/width:\s*auto/.test(card)) F.push('hand cards still stretch to the container');
    if (!/width:\s*clamp\(/.test(card)) F.push('hand cards have no clamped width — they will not scale');
    if (!/flex:\s*0\s+0\s+auto/.test(card)) F.push('hand cards can shrink instead of scrolling');
    if (!/flex-direction:\s*column/.test(card)) F.push('hand cards are not upright');
  }
}

// --- the details panel is the part of the rail that grows ---
{
  const rail = rule('\\.selbox');
  if (!rail) F.push('.selbox rule missing');
  if (!head.includes('class="box grow selbox"')) {
    F.push('the details panel is not the growing element in the rail');
  }
  const hand = rule('\\.handbox');
  if (hand && !/flex:\s*0\s+0\s+auto/.test(hand)) {
    F.push('the hand box grows and squeezes the details panel');
  }
}

F.report('combat layout: all checks pass');
