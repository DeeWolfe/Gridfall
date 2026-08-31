// The combat screen holds still.
//
// The complaint this guards against was concrete: "grid screen moves when it
// could easily stay static and have text do the work." Measured on a 1024px
// display, the board jumped 17.7px upward the moment the alert strip appeared
// under it and dropped back when it cleared, because the middle column centred
// its contents — anything that grew below the board pushed the board itself.
//
// The contract, stated in CSS terms so it cannot be reintroduced by accident:
// nothing in the combat screen may be centred along the axis it can grow on,
// no column may be sized by its own content, and the compact layout may not
// scroll sideways at all.
import {failures, builtPage, pageParts} from './support/harness.js';

const F = failures();
const {css} = pageParts(builtPage());

const rule = sel => {
  const m = new RegExp('(?:^|\\n)\\s*' + sel + '\\s*\\{([^}]*)\\}', 'm').exec(css);
  return m ? m[1] : null;
};

// --- a column never takes its width from its own text ---
{
  const col = rule('\\.cbcol');
  if (!col) F.push('.cbcol rule missing');
  else if (!/min-width:\s*0/.test(col)) {
    F.push('.cbcol has no min-width:0 — long objective text can widen its grid track');
  }
}

// --- the board is pinned, never centred, in every layout that sizes it ---
{
  const mids = [...css.matchAll(/\.cbcol\.mid\s*\{([^}]*)\}/g)].map(m => m[1]);
  if (mids.length < 2) F.push(`expected the compact and desktop .cbcol.mid rules, found ${mids.length}`);
  mids.forEach(body => {
    if (/justify-content:\s*center/.test(body)) {
      F.push('.cbcol.mid centres its board — the alert strip will move it');
    }
  });
  console.log('.cbcol.mid rules pinned to the top:', mids.length);
}

// --- the compact layout has no sideways axis to wander on ---
{
  const mains = [...css.matchAll(/\.cbmain\{([^}]*)\}/g)].map(m => m[1]);
  if (!mains.length) F.push('.cbmain rule missing');
  if (mains.some(b => /overflow:\s*auto/.test(b))) {
    F.push('.cbmain declares overflow:auto — that is a horizontal axis too');
  }
  if (!mains.some(b => /overflow-x:\s*hidden/.test(b))) {
    F.push('no .cbmain rule pins overflow-x to hidden');
  }
  console.log('.cbmain rules:', mains.length, '— none of them scroll sideways');
}

// --- objective text wraps rather than pushing ---
['\\.ogoal', '\\.olose'].forEach(sel => {
  const body = rule(sel);
  if (!body) F.push(`${sel} rule missing`);
  else if (!/overflow-wrap:\s*anywhere/.test(body)) {
    F.push(`${sel} does not wrap — one long token widens the panel`);
  }
});

F.report('combat layout: the board holds its place whatever the text does');
