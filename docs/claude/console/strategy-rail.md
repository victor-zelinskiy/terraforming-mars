# The right STRATEGY RAIL — Milestones/Awards premium HUD (P30 → P31 trophy gallery)

The console board home's right edge is `ConsoleStrategyRail.vue` (`.con-strat`)
— a narrow icon-first HUD of the two 3-slot races. It replaced the wide P27
«right home panel»; P31 rebuilt its interior as a TROPHY GALLERY: the left
resource rail's **footprint** twin, deliberately NOT its interior twin.

## The composition contract

- **Twin FOOTPRINTS, different interiors.** `.con-strat { width:
  var(--con-rail-outer-w) }` — the SAME seam token `.con-res` reads. Never a
  second constant: «the board sits centred between two equal rails» is
  structural. But the interior is NOT mirrored: the left rail is an
  instrument bank of plated rows; the right is ONE glass display case on a
  metallic spine with open shelf rows. Equal weight and quality, different
  composition — mirroring the left rail's cells would shrink the emblems,
  and the emblem is this rail's hero. Guard:
  `tests/e2e/console-strategy-rail.spec.ts` (FHD + 4K TV + Deck, box-to-box).
- **The FINISHED BODY (`__case` + `__spine`).** The chassis still bleeds to
  the physical edge (hull-frame grammar), but the VISIBLE composition ends
  inside the viewport: the display case (thin metallic cant, inner top
  highlight, controlled outer shadow, rounded stage-facing corners) seats
  its square right edge INTO the spine — a brushed metal post with weld feet
  at both ends (the top/bottom terminators). The old read of «glass cropped
  by the screen edge» is gone by construction. Geometry rides one token
  family (`--strat-spine-w/-r`, `--strat-edge` — derived from
  `--con-pad-x`), so every profile keeps the joint. ⚠️ A profile ladder that
  re-states the rail's `padding` as a bare shorthand strips the
  `--strat-edge` compensation — repeat the calc (the handheld block does).
- **The dossier is an OVERLAY** (`ConsoleContextPanel`, absolute in
  `.con-main`) — the board NEVER reflows for a mode change. ⚠️ A later
  `position: relative` in its block silently re-enters it into the flex flow
  (shipped once).
- **Zones are FIXED halves** (`flex: 1 1 0`): recomposition happens INSIDE a
  constant box; the rail's outer geometry cannot jump.

## The information grammar

Icon-first: the medal art (`assets/ma/<slug>.png`) is the identity; COLOUR is
the player; SHAPE + WORD carry state (never colour alone); POSITION + the
rank plaque is race hierarchy. No names, no cost — the workspaces (LB/RB,
also click) hold the detail; rows carry `aria-label` one-liners.

- **Zone head = the DOOR**, one compact line: LB/RB glyph cap + title + the
  3-slot diamond tray. The title never ellipsizes (e2e-guarded). The tray's
  three states are three MATERIALS: taken = the owner's enamel (colour +
  gloss), open = neutral metal contour, and `--next` = the first open slot
  takes a soft GOLD rim while the zone's action is genuinely offered —
  «this is where the next seal lands».
- **Award availability is DOOR-level, never row-level** (`__head--armed`: a
  warm keyline under the head + the gold next-slot pip). With money and an
  open slot nearly every unsponsored award is fundable — a column of glowing
  rows says nothing. The accent dies with the offer (`zone.actionable` is
  server-filtered: money, slot and window all said yes). Milestones keep
  row-level states because the server offers only the ones actually met.
- **The medallion is a physical exhibit**: state bloom → the DISPLAY PUCK
  (`__pedestal`, a recessed glass disc whose `box-shadow` rim is the
  functional state cue — perf-lite safe) → the owner enamel RING
  (`__plate`, the player-colour class masked to a rim — an accent, never a
  wash) → the ART, oversized past the puck (`inset: -5.5%` — only light and
  silhouette may cross a row; no opaque plate can amputate it any more) →
  the shoulder jewel (`__gem`) → the seal kiss. OPTICAL-FIT: `maArtFitStyle`
  (generated `maArtFit.json`; regenerate `pwsh scripts/measure-ma-art.ps1`)
  keeps equal visual mass across assets.
- **Milestone states** (the three-state system):
  1. *In progress*: CURRENT value is the voice, `/threshold` recedes, and a
     hairline METER under the numbers repeats the fact non-verbally
     (integrated into the value block — never a progress bar).
  2. *Ready / offered*: a clean emerald RIM on the puck + a soft inner
     bloom + the `✓` readymark beside the value; `--now` (offered this
     frame) breathes the bloom's light only, `--ready` (met, not your
     window) is the same presence steady. Reduced motion: the breath stops,
     rim + mark + contrast still carry it. Never a blurry green wash.
  3. *Taken*: the row keeps its dark premium material; the OWNER SEAL
     (`__ownseal`: the player-colour crystal + `✓` + «ВЗЯТО» in a thin gold
     fixation) takes the value zone — the right side is never left empty,
     and the state reads by shape and word, never by a colour fill. The
     enamel ring + shoulder jewel stay secondary accents on the medal.
- **Award row = medal + sponsor seal + MICRO-PODIUM.** The sponsor's jewel
  sits at the ribbon corner with a warm metal mount (funder ≠ scorer stays
  readable; it never covers the art's centre). The podium is two steps in
  the reserved value track: a metallic rank plaque (gold «I» / silver «II»),
  enamel diamond CHIPS for the players (the tray's crystal language — never
  bare squares; the viewer's chip is white-rimmed), and the tabular number.
  A 3+-way tie keeps two chips + an honest «+N» beside ONE shared value.
- **The silver «II» is RULES-HONEST** (`MaHudItem.secondRanked`, mirroring
  `giveAwards`): a 2nd place exists only with a SINGLE leader and MORE than
  two players — a tie for 1st awards no 2nd at all, and in a duel only 1st
  scores. A `second` group that would not score renders as a plain CHASER
  (no plaque, quieter voice): the pursuit stays visible, the rank stays
  honest. The two-step height is reserved (`min-height` on `__race`), so a
  chaser arriving or leaving never reflows the row.
- **Completed poses** differ on purpose: milestones 3/3 = a TROPHY column
  (bigger medals, seals gone with the values — the race is settled); awards
  3/3 = a LIVE scoreboard (bigger medals AND numbers). Both warm the pucks
  with a gold rim.

## The motion machine (all in the component)

Seed-then-diff (the `maCeremonyState` idiom): `created()` seeds silently per
epoch (`playerView.runId`) — mount / reload / reconnect never replay. A live
claim/fund queues a SEAL:

- `covered` prop defers the beat to the uncover (the workspace ceremony's
  continuation); TTL 45s → silent apply.
- The seal renders the HELD pre-claim face until its beat, then `--sealing`
  plays ONE phrase: the art takes a metallic impulse, MY row's emerald light
  collects inward (`--mine` only — a rival's row never glowed here, so it
  must not flash), the enamel ring stamps, the jewel sets with overshoot,
  the kiss crosses, the held numbers dissolve WHILE the owner seal stamps
  into the same grid cell over them (950ms, staggered 340ms for a
  multi-claim response). Award seals: jewel + tray pip recolour; the podium
  is untouched (the race runs on).
- The third seal HOLDS for a read beat (1050ms), then `composed` flips: open
  rows leave (pinned absolute — `pinLeaving`), survivors FLIP, the pose
  settles via `--arriving`.
- Leader changes: units keyed by GROUP colour signature — a lead⇄chase swap
  MOVES both units (FLIP). Hierarchy lives in typography/material on the
  inner `__unitbody` (deliberately NO transform there — a scale would fight
  the FLIP). Value ticks only on a REAL diff while watchable; an UNDO rolls
  back silently.
- Reduced motion: everything applies instantly; the availability breath
  stops (rim/mark/contrast carry it).

## Guards

- Model: `consoleMaHudModel.spec.ts` (ready/offered, leader/second/ties,
  `secondRanked` vs giveAwards, funder≠scorer, completed facts, price
  pass-through).
- Component: `ConsoleStrategyRail.spec.ts` (case+spine, pedestal, meter,
  readymark, owner seal + `--mine`, podium ranks I/II/chase, tie chips+N,
  door-level arming + gold pip, calm award rows, doors, poses, the seal
  pipeline through a captured-timer queue, undo, epoch reseed). ⚠️ Its rAF
  polyfill is SUITE-scoped (a top-level `before` is a mocha ROOT hook of the
  whole bundle).
- e2e: `console-strategy-rail.spec.ts` — twin-rail geometry at FHD / Deck /
  4K TV, no idle dossier, overlay without reflow, LB/RB round trips, the
  no-ellipsis title. `console-strategy-rail-states.spec.ts` — the staged
  3-seat matrix over the real `player/input` API (cities/greeneries → real
  scores; fund + claim; the claim through the live MA workspace so the rail
  seal rides the fold): finished-body geometry, ready/offered, sponsor seal
  + podium I/II, the owner seal, the tie-for-first recomposition.
