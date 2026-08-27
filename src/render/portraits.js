// Placeholder card portraits: simple vector scenes composed from shared parts
// (busts with different helmets, emplacements, drones, devices), tinted to the
// card's tier. Deliberately flat and geometric — these are stand-ins that make
// every card recognisable at a glance until real art lands. A real image in
// CARD_ART always wins over these (see artFor in art.js).

const PXFILL = '#141a30';

// -- shared parts ------------------------------------------------------------
// All coordinates live in a 100x140 viewBox; subjects centre around x=50 with
// the ground line near y=120. Parts return SVG fragments; `c` is the accent.

const pxNeck = c => `<path d="M44 76 L56 76 L56 92 L44 92 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.2"/>`;
const pxTorso = c => `<path d="M18 124 Q22 94 40 88 L60 88 Q78 94 82 124 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>`;
const pxTorsoHeavy = c => `<path d="M14 124 Q18 92 38 86 L62 86 Q82 92 86 124 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>
  <rect x="15" y="90" width="17" height="18" rx="4" fill="${PXFILL}" stroke="${c}" stroke-width="1.4"/>
  <rect x="68" y="90" width="17" height="18" rx="4" fill="${PXFILL}" stroke="${c}" stroke-width="1.4"/>`;

const pxHelm = {
  trooper: c => `<path d="M36 74 L36 56 Q36 40 50 40 Q64 40 64 56 L64 74 Q50 80 36 74 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M40 58 L60 58 L60 66 Q50 70 40 66 Z" fill="${c}" opacity=".9"/>`,
  scout: c => `${pxHelm.trooper(c)}
    <path d="M64 48 L74 34" stroke="${c}" stroke-width="1.4"/><circle cx="74" cy="33" r="2" fill="${c}"/>`,
  hood: c => `<path d="M32 78 Q30 46 50 40 Q70 46 68 78 Q50 86 32 78 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <ellipse cx="50" cy="63" rx="10" ry="12" fill="#07060f"/>
    <path d="M44 62 h5 M52 62 h5" stroke="${c}" stroke-width="1.6" opacity=".9"/>`,
  kabuto: c => `<path d="M36 74 L36 58 Q36 42 50 42 Q64 42 64 58 L64 74 Q50 80 36 74 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M36 60 L26 72 M64 60 L74 72" stroke="${c}" stroke-width="1.6" opacity=".7"/>
    <path d="M50 42 Q40 30 30 34 M50 42 Q60 30 70 34" stroke="${c}" stroke-width="1.8" fill="none"/>
    <circle cx="50" cy="38" r="2.6" fill="${c}"/>
    <path d="M42 60 h6 M52 60 h6" stroke="${c}" stroke-width="1.6"/>`,
  knight: c => `<path d="M36 74 L36 54 Q36 40 50 40 Q64 40 64 54 L64 74 Q50 80 36 74 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M50 46 V64 M40 58 H60" stroke="${c}" stroke-width="1.4"/>
    <path d="M50 40 Q60 26 56 14" stroke="${c}" stroke-width="2.4" fill="none" opacity=".8"/>`,
  heavy: c => `<path d="M32 76 L32 52 Q32 42 42 40 L58 40 Q68 42 68 52 L68 76 Q50 82 32 76 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>
    <path d="M38 56 H62 V62 H38 Z" fill="${c}" opacity=".85"/>
    <circle cx="37" cy="68" r="1.6" fill="${c}" opacity=".6"/><circle cx="63" cy="68" r="1.6" fill="${c}" opacity=".6"/>`,
  bare: c => `<path d="M38 72 Q38 44 50 44 Q62 44 62 72 Q50 78 38 72 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M38 56 H62" stroke="${c}" stroke-width="2.2"/><path d="M62 56 L70 50 M62 58 L70 60" stroke="${c}" stroke-width="1.2" opacity=".7"/>
    <path d="M44 64 h4 M52 64 h4" stroke="${c}" stroke-width="1.5" opacity=".9"/>`,
};

const pxBust = (c, helm, heavy) => `${pxNeck(c)}${heavy ? pxTorsoHeavy(c) : pxTorso(c)}${pxHelm[helm](c)}`;

const pxProp = {
  rifle: c => `<path d="M26 100 L74 76" stroke="${c}" stroke-width="2.6"/>
    <path d="M62 82 L66 92" stroke="${c}" stroke-width="2"/><path d="M74 76 L81 72" stroke="${c}" stroke-width="1.4"/>`,
  longrifle: c => `<path d="M20 104 L84 68" stroke="${c}" stroke-width="2.4"/>
    <circle cx="56" cy="84" r="4" fill="none" stroke="${c}" stroke-width="1.4"/>
    <path d="M84 68 L91 64" stroke="${c}" stroke-width="1.2"/>`,
  bow: c => `<path d="M62 46 Q86 82 62 118" stroke="${c}" stroke-width="2" fill="none"/>
    <path d="M62 46 L62 118" stroke="${c}" stroke-width="1" opacity=".7"/>
    <path d="M40 82 H70 M70 82 L64 78 M70 82 L64 86" stroke="${c}" stroke-width="1.6"/>`,
  katana: c => `<path d="M58 88 L88 50" stroke="${c}" stroke-width="2.4"/><path d="M62 82 L68 88" stroke="${c}" stroke-width="2"/>`,
  twin: c => `<path d="M56 88 L84 54 M44 88 L16 54" stroke="${c}" stroke-width="2.2"/>
    <path d="M52 82 L60 88 M48 82 L40 88" stroke="${c}" stroke-width="1.8"/>`,
  daggers: c => `<path d="M34 96 L22 118 M66 96 L78 118" stroke="${c}" stroke-width="2.2"/>
    <path d="M30 99 L38 104 M70 99 L62 104" stroke="${c}" stroke-width="1.6"/>`,
  dagger: c => `<path d="M68 92 L78 116" stroke="${c}" stroke-width="2.2"/><path d="M64 96 L73 92" stroke="${c}" stroke-width="1.6"/>`,
  naginata: c => `<path d="M70 128 V46" stroke="${c}" stroke-width="2"/>
    <path d="M70 46 Q66 30 78 22" stroke="${c}" stroke-width="2.4" fill="none"/>`,
  spear: c => `<path d="M66 128 V42" stroke="${c}" stroke-width="2"/><path d="M60 42 L72 42 L66 24 Z" fill="${c}" opacity=".9"/>`,
  banner: c => `<path d="M70 128 V30" stroke="${c}" stroke-width="2"/>
    <path d="M70 32 L94 40 L70 52 Z" fill="${c}" opacity=".8"/>`,
  cross: c => `<path d="M46 98 h8 v6 h6 v8 h-6 v6 h-8 v-6 h-6 v-8 h6 Z" fill="${c}" opacity=".95"/>`,
  kite: c => `<path d="M26 86 L44 86 L44 106 Q35 118 26 106 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M35 90 V110" stroke="${c}" stroke-width="1.2" opacity=".6"/>`,
  sword: c => `<path d="M64 118 V80" stroke="${c}" stroke-width="2.2"/><path d="M58 90 H70" stroke="${c}" stroke-width="2"/>`,
  hammer: c => `<path d="M64 122 L78 68" stroke="${c}" stroke-width="2.4"/>
    <path d="M68 54 L90 62 L86 76 L64 68 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>`,
  thrusters: c => `<path d="M30 94 L14 116 M70 94 L86 116" stroke="${c}" stroke-width="3" opacity=".8"/>
    <path d="M18 120 L15 128 M82 120 L85 128" stroke="${c}" stroke-width="1.6" opacity=".5"/>`,
  blade: c => `<path d="M76 118 V44" stroke="${c}" stroke-width="6" opacity=".18"/>
    <path d="M76 118 V44" stroke="${c}" stroke-width="2.4"/><path d="M71 118 H81" stroke="${c}" stroke-width="2.4"/>`,
  pluses: c => `<path d="M26 51 v7 M22.5 54.5 h7 M74 45 v7 M70.5 48.5 h7 M30 82 v6 M27 85 h6" stroke="${c}" stroke-width="1.6" opacity=".8"/>`,
  bolt: c => `<path d="M74 44 L66 58 L73 58 L63 76" stroke="${c}" stroke-width="2" fill="none"/>`,
  chevrons: c => `<path d="M76 56 L84 64 L76 72 M83 50 L91 58" stroke="${c}" stroke-width="1.8" fill="none" opacity=".8"/>`,
  chest: c => `<path d="M42 102 L50 97 L58 102 M42 110 L50 105 L58 110" stroke="${c}" stroke-width="1.6" fill="none" opacity=".8"/>`,
  drop: c => `<path d="M26 40 L32 48 L38 40" stroke="${c}" stroke-width="1.8" fill="none" opacity=".85"/>`,
};

// -- whole-scene bodies for the non-humanoid cards ---------------------------

const pxBody = {
  wall: c => `<rect x="22" y="102" width="26" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="52" y="102" width="26" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="35" y="86" width="30" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="26" y="70" width="22" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="52" y="70" width="20" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M38 94 L48 86 M52 102 L62 94" stroke="${c}" stroke-width="1.2" opacity=".5"/>`,
  turret: c => `<path d="M32 120 L68 120 L62 106 L38 106 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M38 106 V94 Q38 88 46 88 L54 88 Q62 88 62 94 V106 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M60 96 H88" stroke="${c}" stroke-width="3"/><path d="M88 93 V99" stroke="${c}" stroke-width="1.5"/>
    <circle cx="46" cy="96" r="2" fill="${c}"/>`,
  mortar: c => `<ellipse cx="50" cy="116" rx="22" ry="5" fill="${PXFILL}" stroke="${c}" stroke-width="1.4"/>
    <path d="M38 112 L64 64 L74 70 L48 118 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M62 86 L48 112" stroke="${c}" stroke-width="1.2" opacity=".5"/>
    <path d="M72 62 Q86 40 78 24" stroke="${c}" stroke-width="1.6" fill="none" stroke-dasharray="3 4" opacity=".8"/>`,
  battery: c => `<rect x="26" y="92" width="26" height="22" rx="3" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M52 100 H92" stroke="${c}" stroke-width="2.6"/>
    <path d="M62 96 V104 M72 96 V104" stroke="${c}" stroke-width="1.4" opacity=".5"/>
    <circle cx="92" cy="100" r="2.6" fill="${c}"/>`,
  pulse: c => `<circle cx="50" cy="90" r="18" fill="none" stroke="${c}" stroke-width="1.2" opacity=".5" stroke-dasharray="4 5"/>
    <circle cx="50" cy="90" r="27" fill="none" stroke="${c}" stroke-width="1" opacity=".28" stroke-dasharray="4 7"/>
    <path d="M50 74 L60 90 L50 106 L40 90 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <circle cx="50" cy="90" r="3" fill="${c}"/>`,
  relay: c => `<path d="M50 120 V58" stroke="${c}" stroke-width="2"/><path d="M40 120 H60" stroke="${c}" stroke-width="2"/>
    <path d="M42 66 L50 58 L58 66 M42 78 L50 70 L58 78 M42 90 L50 82 L58 90" stroke="${c}" stroke-width="1.8" fill="none" opacity=".8"/>`,
  beacon: c => `<path d="M38 120 L50 86 L62 120 M43 108 H57" stroke="${c}" stroke-width="1.8" fill="none"/>
    <path d="M50 86 V60" stroke="${c}" stroke-width="2"/>
    <circle cx="50" cy="56" r="4" fill="${c}"/>
    <path d="M50 46 V40 M42 50 L38 46 M58 50 L62 46" stroke="${c}" stroke-width="1.4"/>
    <ellipse cx="50" cy="124" rx="16" ry="4" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="3 4" opacity=".6"/>`,
  scrambler: c => `<rect x="36" y="94" width="28" height="22" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M50 94 V72" stroke="${c}" stroke-width="1.8"/><circle cx="50" cy="70" r="2" fill="${c}"/>
    <path d="M30 78 Q24 84 30 90 M34 72 Q26 84 34 96" stroke="${c}" stroke-width="1.2" fill="none" opacity=".5"/>
    <path d="M70 78 Q76 84 70 90 M66 72 Q74 84 66 96" stroke="${c}" stroke-width="1.2" fill="none" opacity=".5"/>
    <path d="M42 104 H58" stroke="${c}" stroke-width="1.2" stroke-dasharray="2 3" opacity=".7"/>`,
  supply: c => `<path d="M28 60 H72" stroke="${c}" stroke-width="1.6" opacity=".7"/>
    <circle cx="34" cy="60" r="2" fill="${c}"/><circle cx="66" cy="60" r="2" fill="${c}"/>
    <ellipse cx="50" cy="68" rx="13" ry="7" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M50 75 V88" stroke="${c}" stroke-width="1.2"/>
    <rect x="40" y="88" width="20" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M40 96 H60" stroke="${c}" stroke-width="1" opacity=".6"/>`,
  cache: c => `<rect x="28" y="92" width="44" height="26" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="36" y="70" width="24" height="20" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M28 100 H72" stroke="${c}" stroke-width="1" opacity=".6"/>
    <path d="M34 118 L46 106 M50 118 L62 106" stroke="${c}" stroke-width="1.2" opacity=".5"/>
    <path d="M70 64 v6 M67 67 h6" stroke="${c}" stroke-width="1.4" opacity=".8"/>`,
  recon: c => `<path d="M14 72 Q50 48 86 72" stroke="${c}" stroke-width="2" fill="none"/>
    <path d="M44 68 L56 68 L50 82 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M50 82 V92" stroke="${c}" stroke-width="1.5"/>
    <path d="M50 84 L34 118 M50 84 L66 118" stroke="${c}" stroke-width="1" opacity=".25"/>
    <path d="M38 112 Q50 120 62 112" stroke="${c}" stroke-width="1" stroke-dasharray="3 4" opacity=".4" fill="none"/>
    <circle cx="50" cy="72" r="2" fill="${c}"/>`,
  shield: c => `<path d="M50 58 L74 70 V98 Q50 120 26 98 V70 Z" fill="${PXFILL}" stroke="${c}" stroke-width="2"/>
    <path d="M50 68 L66 76 V94 Q50 108 34 94 V76 Z" fill="none" stroke="${c}" stroke-width="1.2" opacity=".5"/>
    <path d="M50 82 v10 M45 87 h10" stroke="${c}" stroke-width="1.8" opacity=".9"/>`,
  cannon: c => `<rect x="32" y="96" width="20" height="15" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M46 98 L84 74 L89 81 L51 105 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <circle cx="88" cy="75" r="2.6" fill="${c}"/>
    <path d="M38 111 V118 M46 111 V118" stroke="${c}" stroke-width="1.4" opacity=".6"/>`,
  bulwark: c => `<rect x="40" y="110" width="20" height="10" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="30" y="64" width="40" height="46" fill="${c}" opacity=".16"/>
    <rect x="30" y="64" width="40" height="46" fill="none" stroke="${c}" stroke-width="1.6"/>
    <path d="M34 76 H66 M34 88 H66 M34 100 H66" stroke="${c}" stroke-width="1" stroke-dasharray="4 4" opacity=".45"/>`,
  plasma: c => `<path d="M36 112 L58 74 L68 80 L46 118 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <ellipse cx="50" cy="120" rx="20" ry="4" fill="${PXFILL}" stroke="${c}" stroke-width="1.2"/>
    <path d="M66 70 Q84 46 76 28" stroke="${c}" stroke-width="1.6" fill="none" stroke-dasharray="3 4" opacity=".8"/>
    <circle cx="74" cy="26" r="5" fill="${c}" opacity=".85"/>
    <path d="M70 33 Q74 40 78 33" stroke="${c}" stroke-width="1.2" opacity=".5" fill="none"/>`,
  hell: c => `<rect x="28" y="74" width="16" height="26" rx="8" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <rect x="58" y="54" width="16" height="26" rx="8" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M34 80 h4 M64 60 h4" stroke="${c}" stroke-width="1.4" opacity=".8"/>
    <path d="M38 70 L30 44 M68 50 L60 24" stroke="${c}" stroke-width="1.8" stroke-dasharray="4 4" opacity=".5"/>
    <path d="M32 104 L36 112 L40 104 M62 84 L66 92 L70 84" stroke="${c}" stroke-width="1.4" fill="none" opacity=".7"/>`,
  aegis: c => `<path d="M30 80 Q30 68 38 68 Q46 68 46 80 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.4"/>
    <path d="M54 80 Q54 68 62 68 Q70 68 70 80 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.4"/>
    <rect x="24" y="80" width="24" height="38" rx="3" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>
    <rect x="52" y="80" width="24" height="38" rx="3" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>
    <path d="M36 90 V104 M64 90 V104" stroke="${c}" stroke-width="1.6" opacity=".8"/>`,
};

const pxBodyNew = {
  zaku: c => `<path d="M10 124 Q13 104 26 100 L40 100 Q53 104 56 124 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.5"/>
    <path d="M24 98 L24 86 Q24 76 33 76 Q42 76 42 86 L42 98 Q33 102 24 98 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.5"/>
    <path d="M27 88 L39 88 L39 93 Q33 96 27 93 Z" fill="${c}" opacity=".9"/>
    <path d="M44 124 Q47 106 60 102 L74 102 Q87 106 90 124 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.5"/>
    <path d="M58 100 L58 88 Q58 78 67 78 Q76 78 76 88 L76 100 Q67 104 58 100 Z" fill="${PXFILL}" stroke="${c}" stroke-width="1.5"/>
    <path d="M61 90 L73 90 L73 95 Q67 98 61 95 Z" fill="${c}" opacity=".9"/>
    <path d="M14 108 L44 92 M48 110 L78 94" stroke="${c}" stroke-width="1.8"/>`,
  swapArrows: c => `<path d="M20 40 Q50 22 80 40 M80 40 L72 36 M80 40 L76 48" stroke="${c}" stroke-width="1.8" fill="none" opacity=".85"/>
    <path d="M84 92 Q92 68 80 48" stroke="${c}" stroke-width="1.2" fill="none" opacity="0"/>
    <path d="M80 116 Q50 134 20 116 M20 116 L28 120 M20 116 L24 108" stroke="${c}" stroke-width="1.8" fill="none" opacity=".85"/>`,
  cog: c => `<circle cx="76" cy="52" r="7" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <circle cx="76" cy="52" r="2.4" fill="${c}"/>
    <path d="M76 42 V45 M76 59 V62 M66 52 H69 M83 52 H86 M69 45 L71 47 M81 57 L83 59 M83 45 L81 47 M71 57 L69 59" stroke="${c}" stroke-width="1.6"/>`,
  dash: c => `<path d="M64 96 L76 90 M64 104 L80 98 M64 112 L76 106" stroke="${c}" stroke-width="1.8" opacity=".7"/>`,
  fob: c => `<rect x="20" y="96" width="60" height="22" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>
    <rect x="30" y="80" width="40" height="16" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <path d="M38 104 H62" stroke="${c}" stroke-width="1.2" opacity=".6"/>
    <path d="M50 80 V58" stroke="${c}" stroke-width="1.8"/><circle cx="50" cy="56" r="2.4" fill="${c}"/>
    <path d="M42 88 h6 M52 88 h6" stroke="${c}" stroke-width="1.6" opacity=".8"/>
    <path d="M14 118 H86" stroke="${c}" stroke-width="1.4" opacity=".5"/>
    <path d="M26 62 v6 M23 65 h6 M74 66 v6 M71 69 h6" stroke="${c}" stroke-width="1.4" opacity=".7"/>`,
  mine: c => `<ellipse cx="50" cy="98" rx="26" ry="10" fill="${PXFILL}" stroke="${c}" stroke-width="1.8"/>
    <ellipse cx="50" cy="94" rx="16" ry="6" fill="none" stroke="${c}" stroke-width="1.2" opacity=".7"/>
    <path d="M38 90 V82 M50 88 V78 M62 90 V82" stroke="${c}" stroke-width="2"/>
    <circle cx="50" cy="75" r="2" fill="${c}"/>
    <path d="M20 112 L28 104 M80 112 L72 104" stroke="${c}" stroke-width="1.2" opacity=".5"/>
    <path d="M30 60 L36 66 M70 60 L64 66 M50 54 V62" stroke="${c}" stroke-width="1.4" opacity=".6"/>`,
  hecate: c => `<path d="M34 120 L50 92 L66 120 M40 110 H60" stroke="${c}" stroke-width="1.8" fill="none"/>
    <path d="M42 96 L86 34" stroke="${c}" stroke-width="4"/>
    <path d="M86 34 L92 26" stroke="${c}" stroke-width="1.6"/>
    <rect x="40" y="88" width="20" height="12" rx="2" fill="${PXFILL}" stroke="${c}" stroke-width="1.6"/>
    <circle cx="80" cy="26" r="8" fill="none" stroke="${c}" stroke-width="1" opacity=".6" stroke-dasharray="3 3"/>
    <path d="M80 20 V32 M74 26 H86" stroke="${c}" stroke-width="1" opacity=".6"/>`,
};

// -- the card table ----------------------------------------------------------

const pxDraw = {
  scout: c => pxBust(c, 'scout') + pxProp.pluses(c),
  rifle: c => pxBust(c, 'trooper') + pxProp.rifle(c),
  marks: c => pxBust(c, 'hood') + pxProp.longrifle(c),
  medic: c => pxBust(c, 'trooper') + pxProp.cross(c),
  recon: c => pxBody.recon(c),
  pathfinder: c => pxBust(c, 'scout') + pxProp.rifle(c) + pxProp.chevrons(c),
  vanguard: c => pxBust(c, 'heavy', true) + pxProp.chest(c),
  archer: c => pxBust(c, 'hood') + pxProp.bow(c),
  assassin: c => pxBust(c, 'hood') + pxProp.dagger(c) + pxProp.drop(c),
  samurai: c => pxBust(c, 'kabuto') + pxProp.katana(c),
  lancer: c => pxBust(c, 'trooper') + pxProp.spear(c),
  mortar: c => pxBody.mortar(c),
  bulwark: c => pxBody.bulwark(c),
  ronin: c => pxBust(c, 'bare') + pxProp.twin(c),
  naginata: c => pxBust(c, 'trooper') + pxProp.naginata(c),
  kunoichi: c => pxBust(c, 'hood') + pxProp.daggers(c) + pxProp.drop(c),
  herald: c => pxBust(c, 'trooper') + pxProp.banner(c),
  knight: c => pxBust(c, 'knight') + pxProp.kite(c) + pxProp.sword(c),
  wall: c => pxBody.wall(c),
  supply: c => pxBody.supply(c),
  beacon: c => pxBody.beacon(c),
  cache: c => pxBody.cache(c),
  shield: c => pxBody.shield(c),
  cannon: c => pxBody.cannon(c),
  turret: c => pxBody.turret(c),
  relay: c => pxBody.relay(c),
  techblade: c => pxBust(c, 'trooper') + pxProp.blade(c),
  pulse: c => pxBody.pulse(c),
  scrambler: c => pxBody.scrambler(c),
  battery: c => pxBody.battery(c),
  aegis: c => pxBody.aegis(c),
  biomed: c => pxBust(c, 'hood') + pxProp.cross(c) + pxProp.pluses(c),
  techmed: c => pxBust(c, 'trooper') + pxProp.cross(c) + pxProp.bolt(c),
  dragoon: c => pxBust(c, 'trooper') + pxProp.thrusters(c) + pxProp.katana(c),
  railgun: c => pxBust(c, 'heavy') + pxProp.longrifle(c) +
    `<path d="M30 99 V107 M40 93 V101" stroke="${c}" stroke-width="1.4" opacity=".6"/>
     <path d="M20 104 L84 68" stroke="${c}" stroke-width="6" opacity=".15"/>`,
  hell: c => pxBody.hell(c),
  plasma: c => pxBody.plasma(c),
  exo: c => pxBust(c, 'heavy', true) + pxProp.hammer(c),
  zaku: c => pxBodyNew.zaku(c),
  cipher: c => pxBust(c, 'hood') + pxBodyNew.swapArrows(c),
  engineer: c => pxBust(c, 'scout') + pxBodyNew.cog(c),
  outrider: c => pxBust(c, 'trooper') + pxProp.katana(c) + pxBodyNew.dash(c),
  fob: c => pxBodyNew.fob(c),
  mine: c => pxBodyNew.mine(c),
  hecate: c => pxBodyNew.hecate(c),
};

export const hasPortrait = id => !!pxDraw[id];
export const portraitIds = () => Object.keys(pxDraw);

/** Full-bleed placeholder portrait; `accent` is the tier or veterancy colour. */
export function cardPortrait(id, accent) {
  const draw = pxDraw[id];
  if (!draw) return '';
  return `<svg class="artfill" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice">
    <rect width="100" height="140" fill="#0b0918"/>
    <ellipse cx="50" cy="132" rx="70" ry="34" fill="${accent}" opacity=".1"/>
    <path d="M0 96 H100" stroke="${accent}" stroke-width=".6" opacity=".28"/>
    <path d="M0 108 H100" stroke="${accent}" stroke-width=".5" opacity=".16"/>
    <path d="M0 124 H100" stroke="${accent}" stroke-width=".5" opacity=".09"/>
    ${draw(accent)}
  </svg>`;
}
