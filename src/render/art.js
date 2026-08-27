// Procedural art. No image assets ship with the game: card sigils and lead
// portraits are SVG generated from a hash of the id, so every card has a
// stable, distinct mark and the whole build stays one download.
//
// This is the layer to replace first when a real art pipeline arrives — every
// caller wants an HTML string and does not care how it was made.

import {LEADS} from '../content/leads.js';
import {CARD_ART} from '../content/card-art.js';
import {cardPortrait, hasPortrait} from './portraits.js';

/** Deterministic little PRNG seeded from a string id. */
function seeded(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return n => { h = (h * 1103515245 + 12345) >>> 0; return (h >>> 16) % n; };
}

const TIER_COLOUR = {special: '#ffc94d', tech: '#4de8ff'};

/**
 * A card's face, best available first: real art where a piece exists, then the
 * vector placeholder portrait, then the procedural sigil. Callers size the
 * result through their container, so the img and portrait versions ignore
 * `size`; `tint` (veterancy) recolours the portrait's accent.
 */
export function artFor(id, tier, size, tint) {
  const src = CARD_ART[id];
  if (src) return `<img class="artimg" src="${src}" alt="">`;
  if (hasPortrait(id)) return cardPortrait(id, tint || TIER_COLOUR[tier] || '#9aa6c8');
  return sigil(id, tier, size, tint);
}

/** A card's mark: concentric rings, radial spokes and a polygon core. */
export function sigil(id, tier, size, tint) {
  const col = tint || TIER_COLOUR[tier] || '#9aa6c8';
  const r = seeded(id);
  let p = '';

  const rings = 1 + r(2);
  const spokes = 4 + r(5);
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    p += `<line x1="26" y1="26" x2="${(26 + Math.cos(a) * 20).toFixed(1)}" y2="${(26 + Math.sin(a) * 20).toFixed(1)}" stroke="${col}" stroke-width="1.1" opacity=".55"/>`;
  }
  for (let i = 0; i < rings; i++) {
    p += `<circle cx="26" cy="26" r="${8 + i * 7 + r(4)}" fill="none" stroke="${col}" stroke-width="1.2" opacity=".8"/>`;
  }
  const sides = 3 + r(4);
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${(26 + Math.cos(a) * 13).toFixed(1)},${(26 + Math.sin(a) * 13).toFixed(1)}`);
  }
  p += `<polygon points="${pts.join(' ')}" fill="${col}" opacity=".22" stroke="${col}" stroke-width="1.3"/>`;

  return `<svg viewBox="0 0 52 52"${size ? ` style="width:${size}px;height:${size}px"` : ''}>${p}</svg>`;
}

/** A team lead's helmeted silhouette, tinted to their colour. */
export function portrait(id, size) {
  const L = LEADS[id] || LEADS.ironbrand;
  const c = L.col;
  const r = seeded(id);
  const visor = 18 + r(10);
  const jaw = 52 + r(12);
  const crest = r(3);

  return `<svg viewBox="0 0 100 100"${size ? ` style="width:${size}px;height:${size}px"` : ''}>
    <defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c}" stop-opacity=".30"/>
      <stop offset="1" stop-color="${c}" stop-opacity=".04"/></linearGradient></defs>
    <rect width="100" height="100" fill="#0b0918"/>
    <path d="M30 88 L30 40 Q50 18 70 40 L70 88 Z" fill="url(#g${id})" stroke="${c}" stroke-width="2"/>
    <path d="M34 ${visor + 22} L66 ${visor + 22} L66 ${visor + 34} Q50 ${visor + 42} 34 ${visor + 34} Z" fill="${c}" opacity=".85"/>
    <path d="M38 ${jaw + 14} L62 ${jaw + 14}" stroke="${c}" stroke-width="2" opacity=".55"/>
    <path d="M42 ${jaw + 22} L58 ${jaw + 22}" stroke="${c}" stroke-width="2" opacity=".35"/>
    ${crest ? `<path d="M50 18 L50 6" stroke="${c}" stroke-width="3"/>` : ''}
    ${crest > 1 ? `<circle cx="50" cy="4" r="3" fill="${c}"/>` : ''}
    <path d="M30 40 Q50 18 70 40" fill="none" stroke="${c}" stroke-width="2" opacity=".9"/>
  </svg>`;
}

/** Drifting coloured blobs behind the focus and pack overlays. */
export function bokehLayer(tint) {
  const cols = tint || ['#8d9bbd', '#4de8ff', '#9d6bff'];
  let h = '';
  for (let i = 0; i < 9; i++) {
    const s = 60 + Math.random() * 180;
    h += `<div class="bok" style="width:${s}px;height:${s}px;left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;
      background:radial-gradient(circle,${cols[i % cols.length]} 0%,transparent 68%);
      animation-delay:${(-Math.random() * 18).toFixed(1)}s;opacity:${(0.18 + Math.random() * 0.3).toFixed(2)}"></div>`;
  }
  return h;
}
