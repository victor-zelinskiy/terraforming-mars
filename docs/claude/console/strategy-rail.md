# The right STRATEGY RAIL — Milestones/Awards premium HUD (P30 → P31 trophy gallery → P31.2 activation polish)

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
  its square right edge INTO the spine — a brushed metal post whose ends
  carry thin horizontal TIE-INS welding it to the case's corners (P31.2:
  the earlier wider end caps read as a scrollbar's draggable handles; a
  structural joint does not). The old read of «glass cropped by the screen
  edge» is gone by construction. Geometry rides one token
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

Icon-first: the medal art (`assets/ma/<slug>.png`) is the identity; SHAPE +
WORD carry state (never colour alone); POSITION + the crown is race
hierarchy. COLOUR SEMANTICS ARE FIXED (P31.2): GREEN = the requirement is
met; GOLD-WHITE light = the action is genuinely available THIS frame;
PLAYER COLOUR = owner / sponsor / scorer, and player cubes appear in
exactly three places — the milestone owner seal, the award sponsor socket,
the award podium (plus the tray slots, which stay DIAMONDS: slot language,
not player language). These never mix. No names, no cost — the workspaces
(LB/RB, also click) hold the detail; rows carry `aria-label` one-liners.

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
  requirement-met cue — perf-lite safe) → the owner/sponsor enamel accent
  (`__plate`: a QUIET thin ring on milestones, a faint bottom-bowl
  reflection on awards — P31.2 killed the loud colour disc that read as
  focus/winner) → the ART, oversized past the puck (`inset: -5.5%`) → the
  milestone ACTIVATION optics (`__actring` gold-white rim, `__spark` bottom
  crystal, `__sweep` one-shot contour pass) → the sponsor cube (`__gem`,
  AWARDS ONLY — a claimed milestone's emblem stays CLEAN; the seal and the
  tray already answer «who») → the seal kiss. OPTICAL-FIT: `maArtFitStyle`
  (generated `maArtFit.json`; regenerate `pwsh scripts/measure-ma-art.ps1`).
- **Milestone states — the ATTENTION HIERARCHY (P31.2)**: claimable-now is
  the section's loudest LIVE object; open progress is calm; taken is
  prestigious but QUIET. All server-authoritative — `ready` is the rules'
  own `canClaim` (turn-independent requirement), `availableNow` is the
  claim option's PRESENCE in the waitingFor tree (turn + money + slots) —
  never a client `score >= threshold` guess:
  1. *A — in progress*: CURRENT value is the voice, `/threshold` recedes,
     a hairline METER under the numbers (the fixed-height `__cellfoot`).
  2. *B — met, not actionable*: green drawn ✓ + green value + FULL meter +
     a moderate mint rim. No gold, no word — «yours, waiting».
  3. *C — claimable NOW*: everything from B, PLUS the gold-white
     `__actring` (slow single-layer breath), the lit bottom crystal, a thin
     row bracket, and «ДОСТУПНО» (`Available now`) replacing the meter in
     the same fixed foot — no layout shift on a turn flip. Reduced motion:
     all static, same reads.
  4. *Taken*: the OWNER SEAL — ONE calm horizontal line `cube · ВЗЯТО · ✓`
     (cube = who, neutral tick = done, thin gold hairline = fixed) in the
     value zone; smaller and quieter than a live row, never a CTA-looking
     plaque, and NO owner cube on the emblem.
- **Award row = medal + sponsor SOCKET + OPEN RANK RAIL (P31.3 cassette →
  P31.4 de-carded).** The sponsor's CUBE sits in a warm metal socket at the
  ribbon corner with a contact-shadow MOUNT (funder ≠ scorer; never over
  the art's centre, never near the rail). The ranking is ONE module with
  two FIXED levels (`__race { grid-template-rows: repeat(2,
  --strat-cas-row); min-width: pz+sz }`) on two FIXED axes — the PLAYER
  ZONE (`__pz`, constant track, cubes centred: both levels share one
  horizontal centre) and the SCORE ZONE (constant track, right-aligned
  tabular values on one right edge). P31.4 killed the CARD read: no
  four-side plate — a faint wash dissolving toward the score, a thin left
  vertical GUIDE (gold→silver), and per-level STEP notches (gold tread
  under the leader, cool silver under the second; the rank reads from the
  metal). Cubes are ENAMEL (bevel + top light + dark facet + metal edging
  + contact shadow — one material for every place incl. the sponsor;
  `--me` is a slimmer white ring). The CROWN is a CAP anchored to the
  CLUSTER's box (`bottom: 100% + --strat-crown-lift` — a breath of air,
  never glued), and a tied group takes the gold ARCH (`__arch`, width
  follows the cluster) with the cap on its centre. TIES SHOW EVERYONE:
  full equal cubes, ZERO overlap, never a «+N» — the cluster-count class
  (`__chips--n3/4/5`) steps the size down instead (TV floor respected). A
  lone leader keeps the top level with the bottom silver notch calmly
  empty (`:has(only-of-type)`); an empty race dissolves the rail to one
  centred «—». MOTION is one language at two amplitudes: `--strat-mo` (1 /
  .8 in the completed pose) scales the FLIP, the crown-cap fade, the
  score ROLL (`--tick-up/-down` — digits arrive along the change's
  direction) and the crown hand-over's gold-step flare
  (`--crownmove`, driven by the `leadPrev` ledger — live changes only,
  never mount/reseed/covered). Guard: the states e2e asserts both axes at
  ±1 rendered px, ZERO tie overlap by bounding boxes, the group-centred
  crown, the arch, and that the emblem kept its size.
- **The silver second is RULES-HONEST** (`MaHudItem.secondRanked`,
  mirroring `giveAwards`): a 2nd place exists only with a SINGLE leader and
  MORE than two players — a tie for 1st awards no 2nd at all, and in a duel
  only 1st scores. A REAL second is the quieter silver-valued second line
  (position + weight carry the rank — no «II»); a group that would not
  score is a plain dim chaser. The two-step height is reserved
  (`min-height` on `__race`), so a chaser arriving or leaving never reflows
  the row.
- **Completed poses** differ on purpose: milestones 3/3 = a TROPHY column
  (bigger medals, seals gone with the values — the race is settled); awards
  3/3 = a LIVE scoreboard (bigger medals AND numbers). Both warm the pucks
  with a gold rim. The triggers are INDEPENDENT per zone (`composed.<kind>`).
- **COMPACT provenance (P31.5).** In the compact pose the owner/sponsor
  reads from ONE physically-mounted language, the PROVENANCE SOCKET
  (`__gem`): a player cube in the gold socket at the emblem's ribbon
  corner. Awards wear it from the funding on (the sponsor); a milestone
  wears it ONLY in compact (`--own`, with a tiny ENGRAVED CHECK — an SVG
  stroke, deliberately not text: crisp at any scale and outside the TV
  type-floor's jurisdiction) as the collapsed form of the full owner seal
  — cube keeps the colour, check keeps the «done», gold keeps the
  fixation; no «ВЗЯТО» returns. The old owner read via the big colour
  ring is demoted: the compact milestone plate decays to the same faint
  bottom-bowl reflection the awards use (a halo reads as focus/hover —
  never an ownership marker). On the LIVE pose change the socket CLICKS IN
  (`strat-socket-in`, gliding down-left from where the seal stood, on the
  `--arriving` window only — a seeded mount/reload renders it static).
  Compact also steps the ranking voices UP for the couch (~18% cubes, a
  taller crown, more crown-lift air) — the score axis never moves and the
  emblems never shrink. **And compact carries ONE line (P31.6):** the
  cassette's vertical guide is a FULL-pose device — at compact density it
  ran against the emblem, crossed its wing and the sponsor socket and read
  as a coordinate grid, so the compact pose drops it, drops the
  lone-leader notch and the second level's tread, and keeps exactly one
  DIVIDER between the two places (on the levels' boundary, starting inside
  the player zone, ending on the score axis, a warm→cool hairline — never
  a gold underline). ⚠️ A `:has()` ARGUMENT COUNTS toward specificity: the
  lone-leader notch's own `:has()` rule (0,4,1) out-ranked a plain
  compact reset (0,3,1), so the reset mirrors the `:has()` tail.
  **PAINT ORDER RUNS UP THE COLUMN** (`item:nth-child(1..6)` → `z-index:
  6..1`): every art is drawn larger than its medal box and carries a drop
  shadow, so the row BELOW — later in the DOM — painted over the row above
  and that dark edge landed on its provenance socket (reported as a
  leftover glass contour on the cube). The socket also sits off the very
  edge (`bottom: 9%`), and compact drops the zone's wash entirely — its
  left edge was the same contour from the other side. ⚠️ Never judge such
  overlaps with `document.elementFromPoint`: a held, fully transparent app
  overlay (`con-cards__verdictbar--held`) tops every point on the page —
  measure the rail's own boxes and compare the rows' z-index. ⚠️ And a
  CLIENT LEARNS OF A RIVAL'S MOVE WHEN THE TURN REACHES IT (measured: the
  server held three sponsors while the page still rendered two), so a
  driver that passes the viewer's turn to hurry the table strands it
  forever. Guard: the states e2e funds three awards live
  (blue finishes the limit while red's page watches — a page holding its
  own menu does not poll), asserts the watched morph, the three sockets,
  zone independence, and — on a RELOADED page, where the ranking is live
  and no beats replay — the compact geometry: no vertical decoration, one
  divider clear of emblem and socket, no neighbour art over a socket. It
  also proves a reload lands straight in compact with no
  replay.

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

### The ACTIVATION machine (P31.2 — «it just became claimable»)

The same seed-then-diff idiom, over the SERVER's own offer (`availableNow`'s
rising edge per row). The FULL ceremony (~1.1s: value fixes green → the ✓
draws → the bottom crystal flashes → a light impulse runs the contour → a
3% physical nudge → the gold rim assembles → «ДОСТУПНО» surfaces) plays
ONCE per row per epoch, and ONLY on a live watched transition:

- mount / reload / reconnect / epoch reseed → the ledger seeds silently and
  an already-offered row renders straight in its final C state;
- a poll re-render with the same offer → nothing (the ledger sees no edge);
- the offer RE-gained (a new turn, a blocker cleared) → the short
  `--repulse` swell of the standing light, never the ceremony again;
- a flip under `covered` → queued and played on the uncover (TTL 20s —
  stale activations apply silently);
- a claim consumes any live or queued activation for its row;
- reduced motion → no phrase at all, final state instantly.

## Guards

- Model: `consoleMaHudModel.spec.ts` (ready/offered, leader/second/ties,
  `secondRanked` vs giveAwards, funder≠scorer, completed facts, price
  pass-through).
- Component: `ConsoleStrategyRail.spec.ts` (case+spine, pedestal, meter,
  drawn readymark, the horizontal owner seal + `--mine` + the clean emblem,
  crown/silver/chase podium, tie crown+chips+N, the sponsor socket cube,
  the «ДОСТУПНО»⇄meter foot swap, the ACTIVATION machine matrix
  (mount-silent / first-live / re-gain pulse / covered queue / claim
  consumes), door-level arming + gold pip, calm award rows, doors, poses,
  the seal
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
