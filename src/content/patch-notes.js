// Player-facing changelog. Unlike everything else under src/content, this is
// hand-authored rather than generated from reference/gridfall-data.json —
// it's prose for a person to read, not balance data. Bump VERSION and add a
// new entry to the front of PATCH_NOTES with every release worth telling a
// commander about; skip the ones that are pure internal cleanup.

export const VERSION = '2.38.4';

export const PATCH_NOTES = [
  {
    v: '2.38.4',
    notes: [
      "DEVIL'S DRIVE runs on Barbatos's own trade now: no flat bonus, no downside to fitting it — the White Devil simply hits harder the worse shape it's in. +1 below three-quarters hull, +2 below half, +3 below a quarter, no ceiling on how far it's been ground down. HEAVY ARMS' mobility support is MANEUVER THRUSTERS — an external booster pack, the way Gundam's own auxiliary flight units carry a machine that was never built to move.",
      "FIELD REFIT REWORKED. Every gear swap now repairs 3 hull on the Frame, and the swap itself costs no action — a machine that hasn't fired yet this turn still can, after the refit. Kaede's whole identity is proactive now: patch the machine and keep fighting in the same turn.",
    ],
  },
  {
    v: '2.38.3',
    notes: [
      'EIGHT NEW FRAME GEAR CARDS. The White Devil gains BEAM JAVELIN (a sweep of every cell around it), GUARDIAN FIELD (every adjacent friendly carries a shield of its own, refreshed each turn) and DEVIL\'S DRIVE (+2 damage). The Seven Blades gains PILE BUNKER BLADE (a piercing thrust — full damage through armour at the first cell, half carried through to the second), DUAL BLADES (the lane above and below, one cell ahead, own lane left clear — the answer to a flanker) and DOUBLE BLADE (the cell ahead and the cell behind, in one motion). Heavy Arms gains the SIEGE CANNON (one heavy indirect shot at the deepest hostile on the board, then a turn to cycle) and the CORE BOOSTER, an external unit that lets the anchored gunner move.',
      'Frame chassis now carry real weapon and support choices rather than one obvious pick each — a support like Devil\'s Drive survives a later weapon swap instead of being silently wiped by it.',
    ],
  },
  {
    v: '2.38.2',
    notes: [
      'SUBJECT ONE IS TWICE THE FIGHT. Sixty-eight hull where it carried thirty-four, so the splice takes twice the work to break and each half that stands up out of it is twice what it was. It hits harder for it: the whole thing strikes for 5, and the hive half\'s claws take 6. There is still no clock on this one — but there is a great deal more of it.',
    ],
  },
  {
    v: '2.38.1',
    notes: [
      'FOUR NEW PIECES IN THE ARMOURY, aimed at what actually kills a Fireteam. MJOLNIR PLATING is an energy shield that re-forms every turn — it eats one blow, then comes back. The VISR VISOR gives +2 cells of sight in the fog, the first way to hand eyes to a unit that has none. Both fit any card that can carry gear.',
      'AND TWO FOR THE LINE ALONE. The KIT RACK lets a Fireteam carry two armour abilities at once — Camo and a Jetpack on the same Shadow, a Lock and a Drop Shield on the same Noble; if both have an ability to trigger, the newer one is the one you can use. The RECOVERY BEACON sends a lost team\'s card to your HAND instead of the deck, so the team you lose this turn is the team you redeploy next turn.',
    ],
  },
  {
    v: '2.38',
    notes: [
      'THE FIRETEAM WEAPONS ARE CUT. Rocket Launcher, Shotgun, Sniper Rifle, Energy Sword and Gravity Hammer leave the armoury, refunded at cost and unfitted. Each team\'s own gun was already its identity; the six armour abilities are where the line makes its decisions; and the general armoury still fits a Fireteam for anyone who wants to tune one. Four teams, six abilities. That is the line.',
    ],
  },
  {
    v: '2.37.5',
    notes: [
      'WEAPONS FIND THEIR TEAMS. The Sniper Rifle is Osiris\'s, the Gravity Hammer is Noble\'s, the Rocket Launcher is Majestic\'s, the Energy Sword is Shadow\'s — each fits its own team and nothing else. The Shotgun fits any Fireteam.',
    ],
  },
  {
    v: '2.37.4',
    notes: [
      'ARMOUR ABILITIES ARE ONE USE A MISSION. Play Active Camo, Jetpack, Armor Lock, Drop Shield, Hologram or the X-Grenade once and the reserve never deals it again that sortie — no dead kit cards sitting in hand after a reshuffle. Frame gear already worked this way. The teams themselves still return to the deck when lost.',
    ],
  },
  {
    v: '2.37.3',
    notes: [
      'THE LINE SHOOTS OVER A FIRETEAM. Noble still blocks the horde, but friendly direct fire passes every team the way it passes a Firing Step.',
    ],
  },
  {
    v: '2.37.2',
    notes: [
      'THE X-GRENADE IS AIMED. Play it and every cell within two of a standing Fireteam lights up; tap one and it lands there in an X for 5 through armour. Hostiles under the landing cell are fair game.',
    ],
  },
  {
    v: '2.37.1',
    notes: [
      'THE FIRETEAM WEAPONS ARE GEAR. Rocket Launcher, Shotgun, Sniper Rifle, Energy Sword and Gravity Hammer moved out of the deck and into the Quartermaster\'s armoury: buy one with credits, fit it to a team at the hold, and it replaces that team\'s own gun for the whole mission — no deck slot, no deploy point, no draw. Each fits any Fireteam and nothing else, and a team with a weapon carries nothing else from the armoury. Anyone who bought them as cards is refunded. The six armour abilities stay in the deck.',
    ],
  },
  {
    v: '2.37',
    notes: [
      'NAGINATA AND SAMURAI, split for good. Same 3 DP. The Naginata is REACH: every cell around it for 2, on 8 hull — nothing gets past it unseen, and it never hits hard. The Samurai is DAMAGE: five cells for 3, with the draw cut on play at 5 — it kills what it reaches, on 5 hull, with nothing behind it.',
      'FIVE FIRETEAM WEAPONS for the weapon slot, one carried at a time, any team: ROCKET LAUNCHER (a 3×3 three cells out for 3, direct), SHOTGUN (both columns ahead across three lanes for 2), SNIPER RIFLE (the furthest hostile for 8 through armour, every other turn), ENERGY SWORD (one adjacent hostile of your choice for 8) and GRAVITY HAMMER (every cell around the team for 3, survivors driven back). A weapon and an armour ability ride together; a new weapon strips the last. They cycle with the reserve like the rest of the line.',
    ],
  },
  {
    v: '2.36.1',
    notes: [
      'THE ORDNANCE DROP IS THE X-GRENADE. Thrown two cells ahead of the Fireteam, it lands in an X — the cell it hits and the four diagonals around it — for 5 that ignores armour floors. Then spent, and back in the reserve like the other abilities. Anyone who owned the Ordnance Drop owns the X-Grenade.',
    ],
  },
  {
    v: '2.36',
    notes: [
      'ONE CELL OF SIGHT. In the fog, every unit now sees one cell around it unless the card has a reason to see further: the Scout, the Falconer, the Forward Base and Fireteam Osiris see three; the Pathfinder, the Marksman and the Rail Sniper carry a scope and see two. A Recon Lark still lifts the whole board for a turn. Move forward or bring eyes — the horde is out there.',
    ],
  },
  {
    v: '2.35',
    notes: [
      'ONE OF EACH FIRETEAM. While a team stands, its card is out of the draw pile — no second Noble behind the first. Lose the team and the card goes straight back into the deck at a random depth, ready to be drawn again. Different teams still stand side by side. Every Fireteam FIGHTS FACING EITHER WAY: Noble cuts on both sides, Majestic sweeps ahead or behind, Osiris reaches the deepest hostile in either direction. And the teams see ONE cell in the fog, except Osiris, whose hunters keep three.',
    ],
  },
  {
    v: '2.34.2',
    notes: [
      'FIRETEAM OSIRIS no longer drops behind the line; Shadow owns that job. In its place the hunters are FAST: two cells in a straight line where everyone else takes one, both cells clear.',
    ],
  },
  {
    v: '2.34.1',
    notes: [
      'FIRETEAM SHADOW drops behind the line: deploy on any tile, hostile ground included. And Fireteam abilities cycle with the reserve again, the way the teams themselves do — play Active Camo on Noble, draw it again later, play it on Shadow. Frame gear stays spent once bolted on; that fix stands.',
    ],
  },
  {
    v: '2.34',
    notes: [
      'FIRETEAMS STACK. The one-on-the-field limit is gone: field Noble and Shadow side by side, and an armour ability fits whichever standing team you play it onto. PROTO FRAMES STRIDE: a Frame moves and still fires or uses its ability in the same turn, every turn — the machine\'s step is no longer its whole turn. Stats are unchanged; if the stride is not enough, hull and damage are the next lever.',
    ],
  },
  {
    v: '2.33.3',
    notes: [
      'THE ONE-LINE RULE IS SHELVED for play testing. A deck may carry a Fireteam and field a Proto Frame at once; the twelve slots are the only judge. MASTER CHIEF has NO FRAME back as his cost — under him the Frame slot never flies — and Lone Spartan is gone.',
    ],
  },
  {
    v: '2.33.2',
    notes: [
      'THE PRISM WAS HIDING. An operation\'s missions are dealt once and kept, so a Sunderglass, Ironveil or Blackmarrow run dealt before its boss existed still ended in a plain Extraction. Every stored run now ends where it should: the Gantry, the Brood Mother, the Prism.',
    ],
  },
  {
    v: '2.33.1',
    notes: [
      'KITS STAY SPENT. A Frame gear or Fireteam ability, once played, no longer comes back when the reserve cycles — it is on the machine, or torn off and lost, or called in. The reserve reshuffles everything else as before. The one way a kit returns is a lead handing it back: Field Refit\'s swap or Bushido\'s Code.',
    ],
  },
  {
    v: '2.33',
    notes: [
      'ONE LINE PER DECK. A deck fields the Fireteam line or the Frame line, never both: put a Fireteam in the twelve and the Frame slot must be empty, or the launch door refuses you with the same words the Squad page warned you with. MASTER CHIEF trades No Frame for LONE SPARTAN — one Fireteam in the deck, never two; the team you field is the only team you have. Spartan Company still pays the line a point cheaper.',
      'SAVED DECKS have their own tab beside Deck on the Squad page: every preset with its cards, its line, and whether it is the one you are running, with Load and Delete on each and Save current deck below.',
    ],
  },
  {
    v: '2.32',
    notes: [
      'THE FIRETEAM LINE. Four named Fireteams — NOBLE holds the line, OSIRIS hunts behind it, MAJESTIC fights the lane and steadies the flank, SHADOW cuts the diagonals through armour — each a single-cell Specialist, one on the board at a time, the way the Frames fly one machine. Six ARMOUR ABILITIES fit any of them at 1 DP, one carried at a time: ACTIVE CAMO (untargetable until it fires), ARMOR LOCK (no damage this turn, no action), JETPACK (any held tile within two, then fire), DROP SHIELD (a charge on every neighbour), HOLOGRAM (the lane shoots a ghost) and ORDNANCE DROP (8 down the lane, then spent). The generic Fireteam and its four kits are refunded. Under MASTER CHIEF the whole line deploys a point cheaper.',
      'SAVED DECKS. The Squad page keeps up to six named decks — the twelve and the Frame slot as they stand. Save the gun line, save the Frame deck, save the Fireteam deck, and swap between them in one tap.',
      'FOG OF WAR is a battlefield modifier now. Under it the middle and far ground are hidden: every cell you cannot see wears the 霧 glyph, hostiles inside it are off the board as far as you know, and nothing of yours fires into it. Your home third is always seen. Most units see two cells around them; the Scout, Pathfinder, Falconer, Forward Base and Fireteam Osiris see three; a Recon Lark lifts the fog across the whole board until the turn ends; and a hostile that fires gives itself away for a turn. Boss fights are never fogged. Move forward, or send scouts — the horde is out there either way.',
    ],
  },
  {
    v: '2.31.1',
    notes: [
      'A TWELFTH LEAD. JOHN-117, callsign MASTER CHIEF, in military green: under SPARTAN COMPANY your Fireteam and every card that fits it deploy a point cheaper, and under NO FRAME the Proto Frame slot never flies.',
    ],
  },
  {
    v: '2.31',
    notes: [
      'THE ROSTER REVIEW. Twelve slots in a deck means no two cards may do the same job, so thirteen more left — every one refunded in full: Pike Wall, Sentry Ronin, Backstop Battery, Thruster Ram, Drop Beacon, Supply Drone, Longshot, Herald, Relay, Reactor Core, Dynamo, Emergency Requisition and the Fireteam Zaku. The FORWARD BASE is the only thing that makes deploy points now: +1 every turn it stands, and it hurries cooldowns instead of repairing. Seventy-two cards.',
      'NEW: THE FIRETEAM, a Specialist rifleman with four exclusive KIT cards that rewrite what it is — NOBLE (tower shield, blocks and ripostes), SHADOW (diagonal blades that ignore armour), OSIRIS (a long rifle that arcs over your walls to the deepest hostile) and MAJESTIC (a three-cell sweep that steadies everyone beside it). The SINGER: no weapon, and every hostile within two cells of her strikes 1 softer. And the lane fields became an ELEMENTAL SET: Pyre Emitter (fire — the lane burns each enemy phase), Cryo Projector (ice), Volt Coil (volt — strips armour) and Crystal Lens (crystal — amplifies fire through it).',
      'REWORKS. The Bulwark is a two-section half wall filed down the column that your own guns shoot over — no shield, no blade, just steel. The Ashigaru Line files three down the column too. The Naginata sweeps the full circle the Samurai used to, and the Samurai cuts five: the cell either side and the three ahead. The Mortar fires a CROSS at range four. The Rearguard strikes the whole column behind it across three lanes. The Falconer\'s bird strikes anything within two cells. The Rampart is an EXO FRAME now — a heavy shield and an anchored rifle fed from an ammo backpack, firing twice a turn — and the Archer takes its starter slot. The Ashura\'s Crossing Cut became FATAL FURY: four blows on the hostile at contact. Aegis Knights lose their riposte; the Hecate ignores armour.',
    ],
  },
  {
    v: '2.30',
    notes: [
      'THE BALANCE PASS. Every unit now sits on two fixed ladders — hull 2, 3, 5, 8, 12, 18, 24 and damage 1, 2, 3, 5, 8 — so a step between two cards is a step you can feel, not a point you cannot see. The Commons are the cheap bodies; the Tech tier buys position and support; and every Specialist is lopsided on purpose: the Rail Sniper is 3 hull and an 8-damage opening shot, the Exo Juggernaut is 24 hull and an 8-damage hammer, the Plasma Artillerist hits 5 where the Mortar hits 3. The Barricade costs 2 now — twelve hull for one point was the strongest opening in the game — and the Forward Base deploys on any held ground, not just the far half.',
      'TEN CARDS LEFT THE ROSTER, every one refunded in full at the Quartermaster: the Knight (its riposte lives on the Bulwark, now 12 hull), the Vanguard, the Turret (the Rampart takes its starter slot with a proper 2-damage rifle), the Bio Medic, the Pulse Emitter, the Suppressor, the Lance Battery, the Bore Lance, the Supply Cache and the Sapper Turret. Each was a weaker copy of a card standing next to it, and with twelve slots in a deck a copy is a slot wasted. The Scrambler\'s damping is honoured at its printed value now — the Suppressor\'s never was — and a Shield card carries TWO charges.',
      'FOUR NEW CARDS fill the holes the cuts left. The BANNER BEARER hits +1 for every friendly around it, with no cap — the first card that pays a swarm for being a swarm. The FIRING STEP is a wall your own guns shoot over. The EMBER LANCE sprays a flame cone — one cell, then three across — and the ground under anything it hits burns for a turn. The RECOILLESS TEAM fires five damage into the second and third cells ahead, blind to the first, and its backblast costs whoever stands behind it a point of hull every shot. Seventy-nine cards.',
    ],
  },
  {
    v: '2.29',
    notes: [
      'NAVIGATION PASS. Combat\'s Abort button is a MENU now: it folds a sheet up over the action bar with everything in it — Abort mission, Main menu (straight back to the hold), Settings, the UI and Music toggles, Patch notes. A finished mission still leaves in one tap. The Modes and Operations screens read simply BACK, with the same Menu beside it on the right; and on the hold, the pull-up menu tab moved to the bottom-right corner where your thumb already lives.',
    ],
  },
  {
    v: '2.28',
    notes: [
      'EIGHT NEW ACHIEVEMENTS cover everything the last few patches shipped. The Frame line earns MACHINE SPIRIT for your first sortie, ROLLOUT COMPLETE for fielding all three machines, ACE OF THE LINE at twenty-five sorties, CLOSED KIT for owning a full gear set and GUNSMITH for fifteen fittings. The command calls earn FIRE MISSION on your first and FULL SPECTRUM for playing all seven. GROUND WRITER goes to the commander who owns the whole board-control kit. All thirty-two badges still compute straight from your service record — nothing new is tracked, nothing can desync. The roster also wears its new colours: BUSHIDO in blood red, CHIEF in orange, the Ex-Commander CORONET, and Lone Edge in navy.',
    ],
  },
  {
    v: '2.27',
    notes: [
      'THE COMMAND CALLS LEFT THE LEADS. All six stratagems — Duel Protocol, Field Restoration, Silent Insertion, Breaching Charge, Grapple Net, Emergency Requisition — are TECH CARDS now: bought at the Quartermaster, shuffled into your deck, drawn and paid for like everything else. The beat that defines them is untouched: playing one is a prediction, not an undo. It arms on the tap — a unit, a lane, a column — telegraphs on the board, and lands on its own clock: most at the start of your NEXT turn, the demolition charges at the end of this one, after the horde has moved. And with the deck able to hold several, calls can stack in the air at once, each landing on its own beat.',
      'BREACHING CHARGE HAS A SISTER. The ENFILADE CHARGE sweeps a LANE the way the Breaching Charge sweeps a column — every hostile in it at or below 8 hull, destroyed at the end of the turn you call it. Two demolition lines, two axes; the horde has to respect both. And the Frame kits filed under the right shelf at last: all nine gear cards are TECH now, not Specialists — which also means Coldwire\'s No Requisition no longer touches them, for whatever good gear does a commander who cannot field the machine it fits.',
    ],
  },
  {
    v: '2.26',
    notes: [
      'THE PILOT IS RETIRED, and the Frame line finally works the way a machine should. A Proto Frame is a 5 DP Specialist now: it deploys on held ground like any other unit, arrives with a functional base weapon — the White Devil\'s vulcans, the Seven Blades\' arm blade, the Heavy Arms\' ballistic gatling — and is SEEDED into your opening hand at mission start, outside the deck and outside its size. It sits there visible and unaffordable from turn one; every turn you don\'t field it is a turn you chose something else. Anything you\'d spent on the old system — the Pilot, the armoury\'s frame weapons — is refunded in full.',
      'FRAME GEAR ARE CARDS NOW: nine of them, 1 DP each, three per machine, bought like any card and shuffled into your deck. A weapon card replaces the base weapon mid-sortie — Beam Rifle, Beam Saber, Crystal Greatsword, Longsword, Laser Gatling, Missile Gatling — and a support card rides alongside: a Thruster Pack that strides two cells and fires on the move, a Resonance Core that swings harder for every hostile at its side, an Ammo Hopper that doubles the gatling. Gear fits ONLY its own Frame and is dead in hand until the machine stands, so committing to a Frame means buying deck slots into one plan — that\'s the gamble, and the seeding removes the luck from it while keeping the cost.',
      'TWO FRAME COMMANDERS take the roster to eleven. GRAHAM hands Lone Edge to the newcomer CAINE and takes up SALVAGE RIGHTS: when your Frame is destroyed it returns to your hand with every gear still bolted on — but the machine that always comes back is never built whole, deploying at half hull. KAEDE runs FIELD REFIT: gear swaps freely, the displaced piece returning to hand at no cost — but her Frame carries one gear at a time, and the swap spends the machine\'s turn. Rifle at range, blade when they close.',
    ],
  },
  {
    v: '2.25',
    notes: [
      'THE ROSTER TRADES NOW. Every team lead except Ironbrand carries a real downside beside the perk, so choosing a lead is choosing what your deck is FOR. Firebrand runs a race: everything you field hits +1 and takes +1. Riptide teaches every unit to move and fire in the same turn — and pays a third of your economy for it, every turn. Lone Edge pays +3 to a soldier standing alone and docks 1 from anyone in formation, so Scouts and Relays are dead weight under him and the spread IS the deck. Skunkworks builds her machines +2 tough while your infantry deploys thin. Quietstep works forward only — the two rearmost columns refuse your deployments outright. Coldwire keeps everything knitting and fields no Specialists at all.',
      'THREE NEW OFFICERS report to the Quartermaster. CORONET banks +2 deploy points every turn and caps your deck at nine cards — fewer, heavier, every slot earning its place — and he carries the Emergency Requisition call. QUARTERMASTER deals you an extra card every turn off a deck of eight, so you see the whole manifest every few turns and filler has nowhere to hide. IRONWRIGHT runs the machine shop: Frames and exo suits cost 2 less, Pilots deploy with +3 hull, and no Specialist made of flesh gets a slot. The Squad screen shows every lead\'s cost in red beside the perk, warns when your deck breaks the assigned lead\'s rules, and a refused card reads as dead in hand rather than failing on the tap. Wildfire has rotated off the roster — her Emergency Requisition flies Coronet\'s colours now.',
    ],
  },
  {
    v: '2.24',
    notes: [
      'Four new cards argue about the GROUND instead of the bodies on it. DEMO CHARGE is an instant that craters any open tile for good — impassable to both sides, 3 blast damage to everything around it — so the crater the horde routes around can now be a crater you chose. CRYO PROJECTOR chills its whole lane: every hostile in it advances at half speed, a Crawler crossing on every other turn and a Hulk taking four turns to find a single step.',
      'RESONANCE LENS is a conduit — friendly fire that passes through its cell lands 2 harder, so a rifle line firing down a lensed lane hits like a marksman line. FIELD DEGAUSSER strips hostile armour in its lane: innate plating and Bulwark Pylon floors alike stop subtracting while it stands, which turns the cheap massed guns a Hulk used to shrug at back into an answer. All four are in the Quartermaster now; the lane washes and support highlights show exactly who each one is helping.',
    ],
  },
  {
    v: '2.23',
    notes: [
      'The board stopped lying. Boss threats are now TELEGRAPHED a full turn ahead, painted straight onto the grid the way breach marks always were: the Brood Mother\'s mass visibly coils along the row or column it will lash NEXT turn, and the Prism\'s lance shows you exactly which squares its javelins are falling on before they fall. A telegraphed square is a promise — stand there and it lands, step off and it misses. The machines still hit like finals; now they announce it first.',
      'Selecting a boss cell finally shows its real intentions instead of a bestiary guess. Tap a pawn and see its diagonal takes, tap the knight and see every jump, tap the king and see all eight censured squares. The charging human half of Subject One draws every line it can charge down; the hive half draws its stormbreak ring; the honor guards, the wall shards and the Reliquary all show the ground their standing effects own. Every threat a boss can make is now ground you can read before you commit a soldier to it.',
    ],
  },
  {
    v: '2.22',
    notes: [
      'The Summit Floor is a CHESSBOARD. The Envoy no longer dives — it holds the back rank as a 1×1 KING behind a delegation deployed like a chess set: five pawns screening a knight, two bishops and a queen, every piece individually killable and every piece moving the way its name says. Pawns advance and take diagonally, the knight jumps your wall, the bishops work the diagonals, the queen owns every line she can see. One piece moves per turn — chess rules — and a piece that reaches your soldier hits it the same turn it arrives. The king censures all eight squares around his throne, and only the king carries the bulkhead: the formation dies as fast as you can shoot it.',
      'Take the King and learn what the summit was hiding: THE SECOND SESSION. The Envoy stands back up at FULL hull, the chess set falls with him — and the four honor guards you beat in the wings take the thrones around the floor. Pyre burns its lane, Rime freezes your deepest, Storm arcs weapons dead, Shard works the foundations — two thrones acting every turn, each on the numbers you already fought it at, each falling silent only when you kill it. The operation is won when the king and all four thrones are down. Twenty-six turns. Both fights. Go.',
    ],
  },
  {
    v: '2.21',
    notes: [
      'THE PRISM learned artillery. When it shatters now, two WALL shards dig in between your line and the third — each picking your side of the board or the middle ground — and keep the resonance hum that burns whoever stands beside them. The third shard is a LANCE: it takes the hive\'s side of the field and throws crystal javelins straight onto the squares your soldiers hold, anywhere on the board. The walls are what it hides behind. Go through them, or go around — the hull is still one hull.',
      'Subject One\'s human half does not run at you anymore — it CHARGES. No movement cap: it picks a straight line and travels flat out until a wall or a soldier stops it, and the soldier that stops it is hit the same turn. Every turn it is alone the hit lands harder. The hive half\'s claw now reaches the corners too — penning it in with bodies no longer buys the diagonal soldier a pass, so move-and-strike is guaranteed, not just likely.',
    ],
  },
  {
    v: '2.20',
    notes: [
      'THE PRISM scatters. When it shatters at half hull, the three shards no longer huddle where the lens stood — two bury themselves in YOUR half of the grid and one takes the seam. The hull is still one hull; the argument is now about geometry. And a shattered Prism finally has a weapon: every turn, each shard resonates, burning every soldier standing beside it. It still reflects. It still grows. Now it also hums.',
      'The BROOD MOTHER\'s tendril works in straight lines now — a full row or a full column each turn, her choice, for 3. A lash you can read is a lash you can vacate; a lash that can take a whole column is one you have to respect.',
      'SUBJECT ONE has no clock. The splice fights until one of you is finished, and the duet got teeth: kill the hive half and the human half SNAPS — faster and harder every turn, without limit. Kill the human half and the hive half\'s stormbreak widens into a two-ring blast that stuns everyone it doesn\'t kill. And if you let the survivor stand too long, it knits itself back to full hull. Pick a half. Commit. There is no timer coming to save you either way.',
      'The Gantry\'s containment field is up to 30 — a full extra barrage\'s worth of shield to chew through while the assembly line keeps stamping out hostiles behind it.',
    ],
  },
  {
    v: '2.19',
    notes: [
      'The machines hit back like finals now. Every boss weapon is up roughly half again: the Gantry\'s collapsed-field barrage burns 3 per emitter, the Brood Mother\'s tendril lashes rows for 3 and her eruptions land 5, the Envoy\'s censure strikes for 3, the Reliquary\'s ward purge burns 6 off unheld ground, and Subject One walks in swinging 3 — with a hive-half claw of 4, or 5 once there is nothing holding it back.',
      'THE PRISM reflects a full 35% of everything you fire into it now. It still has never attacked anything. It has also never needed to.',
      'The honor guards sharpened with the rest: the Pyreguard\'s lane burns for 4, the Rimeguard\'s grip bites for 4, the Stormguard\'s overload arc doubles, the Shardguard\'s eruptions land 5. With the bulkhead guaranteeing every Kill Order runs six-plus turns, every one of those turns now costs something.',
    ],
  },
  {
    v: '2.18',
    notes: [
      'Bosses carry BULKHEADS now. Plating answered the swarm; this answers the alpha strike: a boss can only lose so much hull in a single turn — fill the ceiling and the rest of your volley glances off until it recovers. Field reports of Kill Orders ending inside six turns have been reviewed, found accurate, and made impossible: under unlimited firepower every boss now survives at least six turns, most seven to eleven, and every one of those turns it is doing its work on you.',
      'The ceiling is honest and visible: the descent log announces it, the intel drawer shows it — and shows SEALED the moment your turn has filled it. Decks that never reach the ceiling never feel it; the ceiling exists exactly for the ones that do.',
      'The arithmetic of a Kill Order is now three-layered: plating decides what KIND of guns hurt it, the bulkhead decides how FAST it can die, and the clock decides how long you have. The space between the bulkhead and the clock is the fight.',
    ],
  },
  {
    v: '2.17',
    notes: [
      'Bosses are PLATED now. Every hit that reaches a boss\'s hull loses one point of damage — a minimum of one always lands, and the Gantry\'s containment field still absorbs cleanly. Ten pings from massed small arms lose ten damage; two heavy shells lose two. The arithmetic of flooding the board with cheap rifles and out-shooting the hull is over: heavy guns, area strikes and the Proto Frame line are the boss answer they were always meant to be.',
      'The one exception is honest about itself: THE PRISM is crystal, not armor. It has no plating — it has reflection, and reflection was always its whole argument.',
      'Every hull was re-sized for the new arithmetic, and every fight re-measured — hundreds of simulated Kill Orders per boss. The whole roster now sits meaningfully harder than before: a boss is a wall you bring the right tools to, not a health bar you rush. The intel drawer shows each machine\'s plating, and the target line announces it on descent.',
    ],
  },
  {
    v: '2.16',
    notes: [
      'Lumenspire has a new heart, and it used to be a person. SUBJECT ONE — the research division\'s volunteer, spliced with hive DNA — holds the spire now. Whole, it walks at your line the way something heavy does and strikes everything within arm\'s reach when it arrives, screaming the dead of Meridian up as it comes.',
      'At half hull, THE SPLICE COMES APART. The human half runs — all the way to the deep board, and every turn it knits the hive half back together. The hive half hunts. You will work out quickly that shooting the one that runs is the efficient play. The game will not pretend otherwise, and neither will the hive half: put the human half down and there is nothing holding it back anymore.',
      'The Aperture has been decommissioned and its lens crated for study — somewhere, something that was learning from the spire\'s transmissions is still listening, and this is not the last the war has seen of that design.',
    ],
  },
  {
    v: '2.15',
    notes: [
      'One throne room, one throne. Crownring ends at the Summit Floor now: silence the four honor guards and the way to THE ENVOY opens — still in session, still diving beneath the wards, still choosing where it surfaces. Kill it and the operation is won. No second act behind it.',
      'The Concord has left the building — but not the war. What the Envoy was assembling has been withdrawn to somewhere deeper in the hive\'s plans, and somewhere deeper in ours. You will meet it again.',
    ],
  },
  {
    v: '2.14',
    notes: [
      'The Aperture fights like what it is now. Phase one is still the array — read the light, the marked lane burns a turn later, the sweep reverses at the edges. But at half hull the lens shatters from the inside, and what climbs out of the wreckage was a researcher once.',
      'Unbound, it is a hunt: one cell of spliced flesh and glass loose on the grid, closing two cells a turn on your nearest soldier and clawing the wounded first. Your area weapons lose their three-cell target the moment it tears free — the fight you finish is not the fight you started.',
      'It does not attack on the turn it climbs out. It stands where the lens was and looks at its hands. Then it runs.',
    ],
  },
  {
    v: '2.13',
    notes: [
      'The themes found their homes. The four-wing pilgrimage belongs to OPERATION CROWNRING now — the Concordat summit, where it always made sense: start at the Delegates\' Concourse, four wings in four directions, and a gated return to the center. The four Frames are no longer cult splices but HIJACKED HONOR GUARDS — the delegations\' own ceremonial Proto chassis, taken at their posts: the Pyreguard marches and burns, the Rimeguard freezes your deepest, the Stormguard arcs weapons dead, the Shardguard works the foundations.',
      'Silence all four wings and the Summit Floor opens — the Envoy is still in session, and now nothing bars your way to it. Kill it, and what it convened assembles: THE CONCORD, four guard chassis drawn into one mass, carrying one motion per turn in a readable rotation the wards telegraph. The hive\'s working copy of the alliance itself. At half hull the vote goes unanimous — two motions a turn.',
      'Fortress Shallow Helm got its own story back: the original fortress map — power the vault, arm the Purge Core, fight back to the Gatehouse — with THE RELIQUARY waiting at the end, and the congregation in the waves the whole way: zealots, lectors, choir wardens, and the hive they invited. The ward purge still spares only ground you hold, and zealot acolytes now answer every discharge.',
      'Lumenspire keeps what was always its: the fusion. The Aperture is the research division\'s own work — a human spliced with hive DNA, fused through the lens. One theme per operation, where each belongs.',
      'Every fight re-tuned after the reshuffle — escort species turned out to matter as much as hull — and all seven Crownring and Shallowhelm encounters sit in the fair-fight band. Bestiary kills carry across under the new names.',
    ],
  },
  {
    v: '2.12',
    notes: [
      'Operation Shallowhelm is a pilgrimage now. You start at the Nave — the fortress heart — with four chapel wings singing around you. Each wing ends in a Kill Order against a FALLEN FRAME: a stolen Proto Frame chassis with a cult pilot spliced into it by hive DNA. Silence all four, and something comes back to the altar. The way out is through it.',
      'THE IMMOLANT walks the pyre: its lane burns every turn, and then it steps one lane over — a procession you can read. THE DROWNED stands in the flooded chapel and stops your deepest soldier cold, no move, no fire. THE CONDUIT arcs your weapons dead while the soldiers holding them stand unharmed — bring more guns than it has lightning. THE OSSIFIED is rooted crystal on the Brood Mother\'s breach contract: stand on the mark and nothing surfaces.',
      'THE COMMUNION is all four at once. The congregation carries its dead Frames back to the altar and the altar takes them in — four pilots, one body, one hymn per turn in a rotation the wards telegraph: pyre, brine, dynamo, shard. Read the next hymn and position for the verse that is coming. At half hull the choir stops taking turns.',
      'And Shallowhelm fights like a fallen fortress should: against PEOPLE. Zealots run your lanes, Lectors read fortress rifles down them, Choir Wardens knit the wounded — human cultists in the waves from the first turn, with the hive they invited mixed through. The Reliquary is gone; the cult built something worse.',
      'Lumenspire\'s Aperture is no longer merely a machine. The tissue return off the lens housing reads human, spliced through with hive DNA — one of the researchers made it out of the dorms. Into the machine. The briefing and the after-action call now carry what that means.',
      'All five new fights were tuned through hundreds of simulated Kill Orders — the chapels land around a fair fight each, and the Communion sits where an operation finale belongs.',
    ],
  },
  {
    v: '2.11',
    notes: [
      'Every operation ends in a Kill Order now. Lumenspire, Crownring and Shallowhelm each got their own machine, their own Central Command briefing before the descent, and their own after-action call — six bosses, six operations, no extraction point left unguarded.',
      'THE APERTURE holds the Lumenspire — the research division\'s transmission lens with something living fused through it. It marks a lane of the grid a full turn before it burns it, and the sweep is mechanical: one lane over, reversing at the edges. Read the light and you never eat it; at half hull the fan opens to three lanes and reading it stops being optional. The dead of Meridian City walk for it.',
      'THE ENVOY sits where the Concordat\'s chair sits. Everything within arm\'s reach of the floor it holds is struck; every third cycle it dives beneath the wards — untouchable, while your clock keeps running — and surfaces where it pleases with its burrower delegation. At half hull it stops pretending the Summit Hall matters and starts surfacing on your side of the board.',
      'THE RELIQUARY is what the cult made of Fortress Shallow Helm\'s ward core. It charges the fortress grid on a countdown you can read, and when the wards fire, everything standing on ground you do not hold burns — the old friend-or-foe logic survived, inverted. Between purges it converts your held ground back, tile by tile. Hold your ground. Literally.',
      'Each new machine was run through hundreds of simulated Kill Orders and tuned into the same fair-fight band as the first three — and the combat theme already knows what to do with them: every boss opens at full arrangement, in its operation\'s own key.',
    ],
  },
  {
    v: '2.10',
    notes: [
      'A new combat theme, composed for this game and generated live — no track file, no loop splice, about a page of code. Four bars at 118 BPM in E minor with one deliberately wrong note: the F natural, borrowed from outside the key, is doing all the tension work, and the lead falls a semitone onto home to close every loop.',
      'The soundtrack is a readout now, not a recording. Combat opens on bare pads and a low root, and the arrangement listens to the fight: the driving bass, the kick and snare, the hats, the arpeggio and the lead each enter as the pressure climbs — how deep into the clock you are, how big the horde on the board is, breaches taken, ground lost. It moves one layer at a time, never lurches, and when you clear the board it thins back out. A fight that eases sounds like it eased.',
      'Bosses do not build. A Kill Order opens with the full arrangement from the first bar, filter wide open — a boss should not wait to sound like one. Phase two slams any fight to full, whatever the meters say.',
      'Every operation plays the theme in its own key. Ironveil as written, cold and mechanical; Blackmarrow a semitone down into the dark; Sunderglass a minor third up, bright and brittle; Lumenspire, Crownring and Shallowhelm each get their own cast. Same music, six colours, zero downloads.',
      'The hold keeps its own cruise — 92 BPM, unhurried — so stepping out of a fight still feels like stepping out of it. The Atmosphere switch in Settings governs all of it, as before.',
    ],
  },
  {
    v: '2.9',
    notes: [
      'Proto Frames fight like the prototypes they are. All three now aim in any direction — every weapon pattern strikes behind as readily as ahead, the Beam Rifle and Rail Cannon hunt both ends of the lane — and they step diagonally, a fencer\'s footwork the rest of the roster does not get.',
      'The Seven Blades carries the Crystal Longsword as standard now: one running thrust, three cells deep, fore or aft. Its old longsword gear slot became the ARM-MOUNTED BLADE — an ability, not a weapon swap. Piercing Thrust: pick an empty cell down the lane and the frame dashes there, running the blade through every hostile it passes. Your own line stops the dash; the horde does not. Anyone who owned the longsword holds the blade already.',
      'The after-action calls actually play now. The channel was wired to a door nobody used — walking away from your first boss kill through the result card skipped the debrief entirely. Fixed, and verified the long way.',
      'A Drop Pod on Hell Jumpers crushes what it lands on, as the card always said. Before this, the first pod could come down on a hostile tough enough to survive the impact and simply stand on top of it for the rest of the mission. Checked the books while in there: no, it cannot one-shot the Gantry — a full drop beside a boss is worth about ten points into the field.',
      'Units whose recharge weapon is cycling grey out on the board, and the Hecate Platform takes manual aim at any hostile on the board (deepest by default) — both from the last patch wave, now with the paperwork.',
      'Once the mission\'s Frame has flown, the Pilot retires from the reserve cycle — an unarmed body with its whole job done was the one truly dead redraw in the game, and the deck no longer deals it back.',
      'Your pilot answers to a callsign now. Open the Frame Pilot card in Squad and name them — the hand, the board, the deck list and every field report will use it. The one we heard was 行きます.',
    ],
  },
  {
    v: '2.8',
    notes: [
      'Operation bosses. Ironveil, Blackmarrow and Sunderglass no longer end at an extraction point — each ends at a Kill Order: one machine, a hard 18-turn clock, and a mission you win by bringing it down. The hive sends no waves; everything on the board is the boss\'s own work. Boss fights run a deploy point richer per turn.',
      'A boss fills a rectangle of cells and every one of them shares a single hull pool — so an area weapon lands once per cell it covers. Your cone, your sweep, your cross of warheads: that is the anti-boss arsenal, and nobody had to design it. Bosses block movement like terrain and cannot be crushed, netted or demolition-charged — only damaged.',
      'Every boss turns once, irreversibly, and loudly. THE GANTRY fabricates behind a 30-point containment field and does not fight — until the field breaks, and then every cell it has fires. Breaking the shield is what makes it dangerous; that is the decision.',
      'THE BROOD MOTHER works the field like a seam of ore: drifting across lanes, crushing what it rolls over, lashing whole rows, and marking breach points anywhere on the board a full turn before something surfaces. Stand a soldier on the mark and it takes the hit instead — nothing surfaces. At half hull it splits into three bodies, and all three must die.',
      'THE PRISM has never attacked anything. It reflects a quarter of every hit back up the barrel that fired it, past shields, and it can kill. At half hull it shatters into four fragments that each grow every turn — up to a cap, because a fight you cannot win is a bug wearing a difficulty costume.',
      'Bringing a boss down completes the operation and lands the Specialist requisition pack. First kills enter the Database, bestiary page and all.',
      'Central Command calls before every first Kill Order. Hikaru delivers the full sitrep on the machine you are about to fight — what it is, what it does to your line, and the read Command wants you to hear — before your descent is cleared. The call plays once; Replay intros in Settings brings all three back.',
      'And Command calls again after. Walk away from your first kill of each boss and the after-action channel opens: what the fight revealed, how far this goes, and what it means for the system. The yards were only the beginning — as of the Gantry\'s destruction, Zanshin Protocol is active system-wide.',
    ],
  },
  {
    v: '2.7',
    notes: [
      'A Frame weapon should be worth its price tag. Every one of the nine got stronger this patch, and each change went through more than four thousand simulated missions before it stayed: bare Frames may run a touch lean, but bolting the kit on now pulls them ahead.',
      'The area weapons carry the class. Hyper Napalm, the Crystal Greatsword and the Missile Gatling each buy their Frame three to six points of win rate over running it bare — the Missile Gatling arm is now the single best-performing deck in the harness, ahead of decks that skip the Frame line entirely.',
      'The Crystal Longsword was measured as a trap — a single poke traded away the Seven Blades\' whole three-lane swing — so it is a different weapon now: a running thrust through everything in the lane, three cells deep. The greatsword answers width, the longsword answers depth.',
      'The Laser Gatling\'s wings run two cells deep on both diagonals now. The hole in the centre stays — the gap is the card — but a machine that cannot move needed more sky to fire into.',
      'Damage up across the rest of the rack: Beam Rifle 9, Beam Saber 12 with a riposte of 6, Beam Javelin 8, Hyper Napalm 6, Hyper Rail Cannon 12, Greatsword 6, Missile Gatling 6.',
      'The single-target weapons — saber, rail cannon, longsword before its rework — measure even with a bare Frame against the swarm, and that is by design left alone: their work is the armoured elite the harness undervalues, and pushing their numbers until they showed against crawler floods would break the other fight.',
    ],
  },
  {
    v: '2.6',
    notes: [
      'Proto Frames stand on one square now. Measured first, changed second: the two-cell body altered no win rate anywhere, but it failed to find a legal landing spot around its Pilot in one mission of five. What makes a Frame big is its weapon arc, not its parking space.',
      'The service weapons got the arcs to prove it. The White Devil\'s blade now cuts every hostile at contact, all four sides at once. Seven Blades takes the column ahead across all three lanes in one swing. Heavy Arms walks gatling fire three cells down its lane. A bare Frame is a Frame, not a big soldier.',
      'The Frame line has been through roughly ten thousand simulated missions and the verdict is: fair. Committing a deck slot, a Pilot and a whole turn costs about three points of win rate, the machine pays most of it back, and it reaches the board in nineteen missions of twenty. It is not the strongest thing you can do — it is a way of playing.',
      'The equipped Frame now shows beside the Active deck, the deck bar counts it, and everything you bring that the deck did not deal — the Frame, your lead\'s call — sits apart from the drawn cards in the combat tray.',
      'Every card is a fireteam, not a soldier. The Squad briefing and the Database now say so.',
      'The hold ticker knows about the launch bays. 行きます。',
    ],
  },
  {
    v: '2.5',
    notes: [
      'Frames are Proto Frames now, and they have a slot of their own. One per deck, beside the twelve rather than inside them, and one deployment per mission. It sits at the front of your hand from the first turn, never drawn — a plan this expensive should not also be a gamble on the shuffle.',
      'Every Proto Frame costs a full turn of deploy points. Six, against a six-point turn: fielding one IS the turn, and since the Pilot has to be standing there already, the machine is always a turn behind the person. That window is the price, and it is now the same price for all three.',
      'The machines you already had — Aegis Knights, the Ashura Frame, the Exo Juggernaut, the Thruster Ram — are Exo frames: proven suits, in service, deployed like any other card. The three new ones are prototypes, and the cards say which is which.',
      'The White Devil is the all-rounder, and it now carries five weapons — no other Frame has more than two. Beam Rifle and Beam Saber are joined by the Hyper Rail Cannon, which punches through the front rank to whatever is deepest in the lane and ignores armour floors when it gets there; the Beam Javelin, a two-cell thrust that gives up nothing at contact; and Hyper Napalm, a widening cone that leaves the ground burning behind it.',
      'All five cover different ground on purpose. You only ever carry one at a time, so a weapon that was simply a worse version of another would be dead for the rest of your career.',
      'Squad has a Proto Frame section: field one, choose its weapon, and see at a glance that it cannot deploy without a Frame Pilot among your twelve.',
    ],
  },
  {
    v: '2.4',
    notes: [
      'Frames. A Frame is a Specialist war machine that cannot deploy on its own — it needs a Frame Pilot already standing on the board, and it lands on or beside that Pilot and takes them aboard. Two cards, two deployments, and a setup step the hive gets a turn to punish.',
      'Three of them. White Devil holds a lane behind a regenerating shield. Seven Blades wants to be standing exactly where you put it. Heavy Arms never moves, carries the heaviest hull on the field, and shells whatever is in front of it.',
      'A Frame carries a weapon you choose before the mission, not gear you bolt on during it. Frame weapons REPLACE the machine\'s service weapon rather than adding to it, and each one fits one Frame and nothing else — a Beam Saber is a White Devil weapon and will not go anywhere near a Rifleman. A bare Frame is always playable, just less specialised.',
      'Six weapons: Beam Rifle and Beam Saber for the White Devil, Crystal Greatsword and Crystal Longsword for Seven Blades, Laser Gatling and Missile Gatling for Heavy Arms.',
      'The Laser Gatling fires both forward diagonals and nothing at all through the centre. It is the only weapon in the game with a hole in its own pattern, and the card draws it.',
      'A destroyed Frame is not a destroyed Pilot. The Pilot ejects at one hull and stays on the board — you lose the machine, keep the person, and that Pilot can climb into another Frame later. If something is standing in the wreck, they go up with it.',
      'Squad only offers a card the gear it can actually take, and the Quartermaster shelves Frame weapons separately and says which Frame each one needs. Buying a Beam Saber with no White Devil is money gone.',
      'A deck carrying a Frame with no Pilot in it says so on the Squad screen, rather than letting you find out on the board with five deploy points spent.',
      'Fixed: a weapon firing at exactly three cells was blocked by your own two-cell units inconsistently — the rules cut the shot where the board had not dimmed the tile, so it struck from a cell that never lit up.',
    ],
  },
  {
    v: '2.3',
    notes: [
      'Hostiles go round dead ends. A bombardment crater used to park whatever was behind it for the rest of the mission, and a slow body plugged a lane for everything queued up behind it. Both step into an open lane now — a fast one keeps its tempo doing it, a slow one pays a turn. A unit of yours standing in front is still a fight, never a wall to walk around.',
      'New Specialist: the Ashura Frame. Sixteen hull, blocks a lane, and its scythes sweep the column ahead across three lanes at once. Crossing Cut slides it one lane toward the heavier side and cuts everything in front for 6.',
      'New hostile: the Oni Frame. The hive read the same brief. It does not queue and it does not wait — every step it crosses toward whichever lane is thinnest, so it will always turn up where you are weakest.',
      'Breaching Charge now lands at the end of the turn you call it, after the horde has moved, instead of at the start of the next. It is still a prediction — you aim at where a body will be — just a shorter one. A full turn was long enough for the column to empty itself.',
      'Nine new achievements, including a no-breach record, a seven-day Daily streak, the full uniform rack, and the deep end of Onslaught.',
      'Squad sorting applies to the Reserve only. The twelve cards in your deck are twelve you chose one at a time, and rearranging those on a preference takes something away.',
      'Gear in the locker looks like gear everywhere else in the game again — the same tile as the Quartermaster shelf, with the card carrying it printed on the front.',
      'Opening a piece of gear now leads with which card it is linked to. Tap that to unfold the full list of units, "None" included, instead of scrolling past a picker to find the answer.',
      'Every Central Command transmission control is the cycling dots, sign-off included.',
    ],
  },
  {
    v: '2.2',
    notes: [
      'The combat board holds its place. It used to jump upward the moment an alert appeared beneath it and drop back when the alert cleared — a measured 17.7px on a 1024px display, several times a mission. Nothing under the board can move it now.',
      'The objective panel keeps one shape for the whole mission. The losing conditions used to appear and vanish depending on how close you were to them, resizing the panel and shunting everything under it; they simply stay up, and the panel fills the room the board leaves rather than parking dead space above your hand.',
      'The combat log opens with the objective pinned to the top of it. Forty lines of history scroll underneath while the goal stays put — the log is where you go to work out what just happened, and losing the goal on the way there was backwards.',
      'The Shoulder Cannon is gear now, not a card. Fit it at the armoury and that unit fires twice from the moment it lands. If you had already bought the card, the piece is in your locker.',
      'A gear locker in Squad: every piece you own, what it does in full, and which card is carrying it. Tap one to choose where it goes. Gear used to be reachable only from inside a card, which asked the question backwards — you had to know which piece you wanted before you could read what any of them did.',
      'Fitting gear from a card now lists each piece with its rules text and where it currently is. It was a row of nineteen bare names, and one copy of each piece exists, so fitting one silently took it off something else. Both halves are now on screen before you tap.',
      'Squad can be sorted — A–Z, level, deploy cost, or geared first — and split by class the way the Quartermaster shelf is. The choice is remembered on your record.',
      'The gear on a card in hand is no longer a caption crushed under its name. The hand card carries a small ◈, and the piece and what it does are in View card, where there is room to read them.',
      'Every "next part" control in a Central Command transmission is the same cycling dots now, the sign-off included. A worded button in the middle of a call read as a decision; these are a beat of silence on an open channel.',
      'Tab rows that scroll sideways — Service Record, Database, the gear roles — fade at the edge instead of drawing a scrollbar under themselves.',
    ],
  },
  {
    v: '2.1',
    notes: [
      'Every mission now states its objective on the field, as an order rather than a score — with live progress, the wave clock, and the two ways to lose. It was previously a line in the header that no phone ever showed.',
      'A win says why it was a win. Every loss already named its reason; wins arrived with nothing but a kill count. Holding the line and clearing the field are now told apart, because they are not the same victory.',
      'Ground and Breaches under the board turn gold as they approach the line and magenta at it.',
      'Your hand holds six cards and the whole hand is on screen — one row, no sideways scrolling, on any size of screen. Cards size themselves to the display instead of a fixed width that fitted two of them on a phone.',
      'Cards that call in more cards — Recon Lark, Falconer — ignore the hand limit. You paid for those draws.',
      'A full hand holds the turn draw rather than discarding it. Nothing is ever lost to the limit; the card is waiting when you deploy.',
      'The hand no longer folds away, because it no longer needs to. The combat log took its place as the thing that folds, and it is a floating panel now instead of a column — so it is finally readable on a phone, where the log used to be desktop-only.',
      'Anything that happens TO you — a unit destroyed, a lane cratered, a breach — now surfaces under the board the moment it happens, instead of scrolling past in a log you had to go looking for.',
      'The combat board is a third larger on desktop, using the room the hand tray and log column gave back.',
      'Fixed: Eradication Blitz asked for ten hostiles in its briefing and nine in the mission.',
    ],
  },
  {
    v: '2.0',
    notes: [
      'Every card with a weapon now draws its firing pattern instead of describing it — the shape it covers, at a glance, no counting cells out of a sentence.',
      'Selecting a unit lights every tile its weapon reaches, not just the ones that already have something standing in them. Gold still marks what actually gets struck.',
      'Tapping a hostile now selects it the same way your own units do: its threat lights up, and Deselect / View card work on it too. Attacking still comes first — a hostile already in your sights is a target, not a thing to inspect.',
      'Card text is trimmed to the ability itself. Deploy cost, hull and class come off the stat block — all three were already printed on the card.',
      'Hostiles gained a Counter line: how to beat it, kept separate from what it does.',
      'Central Command calls ahead of every operation now. A transmission before the drop, paced by you — it plays once per operation, and Settings can reset them.',
      "Operation Shallowhelm's story is rewritten. The fortress anchors the whole line, a cult opened its gates from the inside, and the Self-Cleanse is now the Purge Protocol.",
      'Four new cards fight over the back line: Longshot and Sapper Turret reach into theirs, Rearguard and Backstop Battery defend yours. Optics Relay and Rear Sights join the gear list.',
      'Recon Lark and Backstop Battery are instants — they resolve and leave no body behind.',
      'New hostile: the Puppeteer. It never moves, and every third turn it seizes the nearest unit in its lane and turns it on you.',
      'New field event: Burrow Breach. The floor opens under a marked tile and swallows whatever is still standing on it.',
      'Field events explain themselves now — tap a research pod or a bombardment crater for what it is and how long it lasts.',
      'Civilian Extract is a shelter to hold rather than a scatter of static pods, and every operation has a signature hazard of its own.',
      'Pixel units on the grid have centred visors and redrawn weapons, so you can tell a Marksman from a Lancer without reading the label.',
      'The gear-fitting list groups by role, with a filter once you own enough to need one.',
      'A cleared operation stays cleared and offers a Replay button, instead of silently rolling a fresh set of missions behind you.',
      'Daily Challenge sits at the top of the mode list.',
      'Fixed: specialist card art was off-centre in its frame, and gauntlet packs let you keep a card without letting you look at it first.',
    ],
  },
  {
    v: '1.8',
    notes: [
      'The hand tray in combat now collapses, so you can see more of the board.',
      "Card art no longer prints the card's name a second time on top of the seal — and the seal is centred in the frame.",
      'Four new uniform schemes: Umber, Teal, Sand, Indigo.',
      'Quartermaster cleanup — fewer redundant labels in the shop.',
    ],
  },
  {
    v: '1.7',
    notes: [
      'Salvage is gone. Cards, gear and uniforms all spend the same credits now.',
    ],
  },
  {
    v: '1.6',
    notes: [
      '12 new cards and 6 new gear pieces join the roster.',
      'Requisition packs arrive a little slower, to make room for the bigger collection.',
    ],
  },
  {
    v: '1.5',
    notes: [
      'Daily Challenge: one mission a day, the same for every commander, with a streak to protect.',
      'Squad, Quartermaster, Database and Service Record each walk a new commander through once.',
      'Combat has its own music now, distinct from the hold screen.',
      'An animated title screen.',
    ],
  },
  {
    v: '1.4',
    notes: [
      'Turn events, lane charges, the Dynamo card, and enemy intent readouts.',
      'Achievements, and a pull-up drawer for quick settings mid-mission.',
    ],
  },
  {
    v: '1.3',
    notes: [
      "Every unit — yours and the hive's — gets a hand-drawn pixel sprite on the board.",
      'Purchasable uniform schemes for your whole roster.',
      'A darker, more tactical palette.',
    ],
  },
  {
    v: '1.2',
    notes: [
      'Ink-seal card art for every card, and chip-style tiles throughout the shop and squad screens.',
      'Desktop and compact interface modes.',
    ],
  },
  {
    v: '1.1',
    notes: [
      'Eight team leads, each with a passive and a stratagem call.',
      'Three new hostiles, three new campaign operations.',
    ],
  },
  {
    v: '1.0',
    notes: [
      'First release: campaign operations, lane-defence combat, Squad, Quartermaster and Database, local save records.',
    ],
  },
];
