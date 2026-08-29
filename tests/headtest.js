// The combat header must place the wave title and the lead badge on one row,
// and nothing in it may be free to overlap — every child is placed by a named
// grid area rather than by document order.
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const page = builtPage();
const {head, css} = pageParts(page);

const rule = sel => {
  const m = new RegExp('(?:^|\\n)' + sel + '\\s*\\{([^}]*)\\}', 'm').exec(css);
  return m ? m[1] : null;
};

const header = rule('\\.cbhead');
if (!header) {
  F.push('.cbhead rule missing');
} else {
  if (!/display:\s*grid/.test(header)) F.push('header is not a grid');
  if (!/grid-template-areas/.test(header)) F.push('header has no named areas');

  const areas = (header.match(/grid-template-areas:([^;]*)/) || [])[1] || '';
  ['title', 'badge', 'inc'].forEach(a => {
    if (!areas.includes(a)) F.push('header area missing: ' + a);
  });

  const rows = areas.trim().split('"').filter(x => x.trim());
  if (rows.length !== 2) F.push('header should be two rows, got ' + rows.length);
  if (rows[0] && !rows[0].includes('title')) F.push('wave title is not on the first row');
  if (rows[0] && !(rows[0].includes('title') && rows[0].includes('badge'))) {
    F.push('title and badge are not on the same row by default');
  }
  if (rows[1] && !rows[1].includes('inc')) F.push('inbound strip is not on the second row');
  if (!rows.every(r => r.includes('badge'))) F.push('lead badge does not span both rows');
}

['\\.mtitle', '\\.leadbadge', '\\.incoming'].forEach(sel => {
  const r = rule(sel);
  if (!r) { F.push(sel + ' rule missing'); return; }
  if (!/grid-area/.test(r)) F.push(sel + ' has no grid-area — it can land anywhere');
});

if (!page.includes('id="c-doc"')) F.push('doctrine line missing from markup');
if (!page.includes("$('c-doc')")) F.push('doctrine line never populated');

// The inbound strip has to be reachable when the wave does not fit: it scrolls
// sideways, its chips keep their own width rather than squashing, and nothing
// hides the scrollbar that says so.
{
  const strip = rule('\\.incoming');
  if (!strip) {
    F.push('.incoming rule missing');
  } else {
    if (!/overflow-x:\s*auto/.test(strip)) F.push('inbound strip does not scroll sideways');
    if (/scrollbar-width:\s*none/.test(strip)) F.push('inbound strip hides its scrollbar');
  }
  if (/\.incoming::-webkit-scrollbar\s*\{[^}]*display\s*:\s*none/.test(css)) {
    F.push('inbound strip hides its webkit scrollbar');
  }
  const chip = rule('\\.incp');
  if (!chip) F.push('.incp rule missing');
  else if (!/flex:\s*0\s+0\s+auto|flex-shrink:\s*0/.test(chip)) {
    F.push('inbound chips can shrink — the strip squashes instead of scrolling');
  }
}

{
  const order = [head.indexOf('id="c-title"'), head.indexOf('id="c-doc"'), head.indexOf('id="man"')];
  if (order.some(i => i < 0)) F.push('a header element is missing');
  else if (!(order[0] < order[1] && order[1] < order[2])) F.push('order should be wave, doctrine, inbound');
}

F.report('combat header: all checks pass');
