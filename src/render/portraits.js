// Ink Seal card faces: every card is a sumi-e seal — an ensō brush ring, one
// kanji chosen for the card's role, a nameplate, and the Zanshin chop. All
// procedural SVG, tinted by the accent the caller passes (tier colour, or a
// veterancy recolour). The kanji itself stays ink-white; specialists get a
// visibly heavier ensō stroke, rarity you can feel before you read it.
//
// Two products ship from here. cardPortrait() is the full 100x140 face, used
// wherever a card is a poster: the combat hand, the focus view, pack reveals.
// cardMark() is the bare ensō-and-kanji, used as a faint watermark behind the
// text of the ghost tiles in the Squad / Quartermaster / Database grids.
// A real image in CARD_ART always wins over the face (see artFor in art.js).

import {POOL} from '../content/cards.js';

// One kanji per card, picked for the role: 目 eye for the Scout's overwatch
// aura, 臼 for the mortar (臼砲), 貫 "pierce through" for the Rail Sniper,
// 双 "pair" for the two-body fireteam. All 58 are distinct, which is also
// what guarantees no two faces ever render identically. (Shoulder Cannon's
// 撃 left with it when the card became gear — gear wears the procedural sigil.)
const KANJI = {
  // scouts and skirmish troopers
  scout: '目', recon: '鳥', pathfinder: '道', rifle: '銃', zaku: '双',
  vanguard: '先', marks: '狙', archer: '弓', assassin: '影', kunoichi: '忍',
  samurai: '侍', ronin: '浪', naginata: '薙', lancer: '槍', herald: '旗',
  medic: '医', knight: '騎', bulwark: '塁', outrider: '駆', cipher: '換',
  engineer: '工', mortar: '臼', ashigaru: '兵', pikewall: '列', sentry: '討',
  falconer: '隼', longshot: '遠', rearguard: '殿',
  // tech emplacements and devices
  wall: '壁', supply: '糧', beacon: '灯', cache: '蔵', shield: '護',
  turret: '塔', relay: '波', techblade: '刃', pulse: '響',
  scrambler: '乱', battery: '陣', fob: '営', mine: '罠', dynamo: '電',
  rampart: '塞', piercer: '突', suppressor: '抑', reactor: '核', bore: '穿',
  sapper: '伏', backstop: '堤',
  // specialists
  aegis: '盾', biomed: '命', techmed: '療', dragoon: '竜', railgun: '貫',
  hell: '焔', plasma: '光', exo: '鎧', hecate: '砲', kessen: '斬', ram: '衝',
  marshal: '将', ashura: '阿',
};

const INK = '#e8e4f5';
const CHOP = '#c43a4b';
const KFONT = `'Hiragino Mincho ProN','Yu Mincho','Noto Serif JP','MS Mincho',serif`;
const TIER_INK = {special: '#ffc94d', tech: '#4de8ff'};

const accentFor = (id, tint) =>
  tint || TIER_INK[POOL[id] && POOL[id].t] || '#9aa6c8';

/** The ensō: a heavy open brush ring with a thin trailing echo stroke. */
const enso = (c, cx, cy, heavy) => {
  const r = heavy ? 36 : 34;
  return `<path d="M${cx} ${cy - r} A${r} ${r} 0 1 0 ${cx + 1} ${cy - r}"
      fill="none" stroke="${c}" stroke-width="${heavy ? 6 : 4.5}" stroke-linecap="round"
      opacity=".5" stroke-dasharray="${heavy ? '196 34' : '185 30'}"/>
    <path d="M${cx} ${cy - r + 6} A${r - 6} ${r - 6} 0 1 0 ${cx + 1} ${cy - r + 6}"
      fill="none" stroke="${c}" stroke-width="1.4" stroke-linecap="round"
      opacity=".35" stroke-dasharray="150 40"/>`;
};

export const hasPortrait = id => !!KANJI[id];
export const portraitIds = () => Object.keys(KANJI);

/** Full-bleed seal face; `accent` is the tier or veterancy colour. The name
 * is never drawn here — every surface that shows this portrait (combat
 * hand, focus view, pack reveal) already prints the card's name right next
 * to it, so baking it into the art too was pure duplication. */
export function cardPortrait(id, accent) {
  const k = KANJI[id];
  if (!k) return '';
  const c = accentFor(id, accent);
  const heavy = POOL[id] && POOL[id].t === 'special';
  return `<svg class="artfill" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="140" fill="#0d0a1c"/>
    <rect width="100" height="140" fill="#141026" opacity=".6"/>
    <rect x="3" y="3" width="94" height="134" fill="none" stroke="${c}" stroke-width=".8" opacity=".35"/>
    <path d="M14 10 V44 M86 96 V130" stroke="${c}" stroke-width="1" opacity=".18"/>
    <circle cx="20" cy="116" r="1" fill="${c}" opacity=".25"/>
    <circle cx="84" cy="26" r=".9" fill="${c}" opacity=".22"/>
    ${enso(c, 50, 70, heavy)}
    <text x="50" y="88" text-anchor="middle" font-size="52" fill="${INK}"
      font-family="${KFONT}">${k}</text>
    <rect x="78" y="102" width="15" height="15" fill="${CHOP}"/>
    <text x="85.5" y="113.5" text-anchor="middle" font-size="10.5" fill="#0d0a1c"
      font-family="${KFONT}">残</text>
  </svg>`;
}

/**
 * The bare seal — ensō and kanji, no frame, no plate, no chop — for use as a
 * watermark behind tile text. Opacity is the container's business (.inkmark);
 * everything here is drawn at full strength in the accent colour.
 */
export function cardMark(id, accent) {
  const k = KANJI[id];
  if (!k) return '';
  const c = accentFor(id, accent);
  const heavy = POOL[id] && POOL[id].t === 'special';
  return `<svg class="inkmark" viewBox="0 6 100 104" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    ${enso(c, 50, 58, heavy)}
    <text x="50" y="76" text-anchor="middle" font-size="52" fill="${c}"
      font-family="${KFONT}">${k}</text>
  </svg>`;
}
