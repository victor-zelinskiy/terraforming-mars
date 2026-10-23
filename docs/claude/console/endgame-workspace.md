# Console FINAL SCORING workspace («Финальный подсчёт»)

The post-game is a **PHASE-anchored workspace root** (`'endgame'` in
`WORKSPACE_KINDS`, anchor `{type: 'phase', phase: 'end'}`) — the same shape as
`start`/`draft`. `ConsoleShell.endgameFrameLive` (=`Phase.END`) stands it up on
the rising edge and tears it down (+`resetConsoleEndgame`) on the falling edge
(undo / rollback). It projects onto neither navigation axis, serves no prompt,
and is a full-bleed scene over the frame: `.con-endgame` covers everything
except the bottom command bar strip; `.con-root--endgame` fades the status
strip / player rail / banner out (`visibility`, never `display`) — and DROPS
while the scene is **collapsed** (B), so the final board + HUD come back for
the inspection round trip. The desktop endgame surfaces go HEADLESS in console
mode (`EndgameExperience :console-native` — no auto-reveal, no pill;
`RematchLayer :headless` — poller alive, no DOM).

## Files

| Layer | File |
| --- | --- |
| pure VM | `src/client/console/endgame/consoleEndgameModel.ts` |
| pure track geometry (the bar — the counting instrument) | `src/client/console/endgame/consoleEndgameLayout.ts` |
| pure PODIUM planner (TR69 — the seats' geometry, the podium order, the horizon) | `src/client/console/endgame/consoleEndgamePodium.ts` |
| beat script (pure) | `src/client/console/endgame/consoleEndgameScript.ts` |
| reactive machine | `src/client/console/endgame/consoleEndgameState.ts` |
| the END boundary seal | `src/client/console/endgame/consoleEndgameSeal.ts` |
| GSAP director | `src/client/console/endgame/consoleEndgameDirector.ts` |
| surface | `src/client/components/console/ConsoleEndgameWorkspace.vue` |
| view→model adapter | `src/client/components/endgame/endgameViewAdapter.ts` (shared with desktop) |
| styles | `src/styles/console_endgame.less` |
| specs | `tests/client/components/console/consoleEndgameModel.spec.ts`, `consoleEndgameCeremony.spec.ts`, `consoleEndgameLayout.spec.ts`, `consoleEndgameSeal.spec.ts`, `tests/console/consoleEndgamePodium.spec.ts`, `tests/e2e/console-endgame.spec.ts`, `tests/e2e/console-endgame-boundary.spec.ts`, `tests/e2e/console-finale-podium.spec.ts` (+ shared journey `tests/e2e/consoleEndgameHarness.ts`; the saturated fixtures `finale-rich-5p` / `-2p` via `fixtureTable(request, name)`) |

## The VM is a RE-PROJECTION, never a second source of numbers

`buildConsoleEndgameVm(EndgameModel, playerOrder, {botColors})` builds on
`buildFinalScoringRevealModel` — the same segments/winners/tie-break the
desktop reveal uses. Console categories in ceremony order: `tr → milestones →
awards → greenery → city → [moon → tracks → delta] → cards → [penalty]`; a
category absent for everyone does not exist (zero visual noise), TR is always
present (base). TR and Cards carry `subs` (micro-reveals); one surviving sub
collapses to a single beat.

**THE BOT NORMALISATION** (presentation only, spec-guarded «nothing lost,
nothing doubled»): the legacy top-level «Подсчёт бота» is dissolved into the
card families — `automa.mcToVp → Resource cards`, `neuralInstance →
Conditional cards`, `cardVp → Fixed VP cards` — merged with the bot's ordinary
`detailsCards` kinds. The TR residual sub is labelled `Track actions` when
every non-zero contributor is a bot, else `Cards & effects`.

Invariants (spec'd): Σ categories ≡ `finalTotal` ≡ `breakdown.total`;
Σ subs ≡ category; ties → `tieBreak` (M€) → still equal = SHARED victory
(`winners.length > 1`, never an index pick); `automaClockWin` forces the
winner with no tie-break.

## STABILITY — the three audited regressions, kept fixed by construction

The 2026-08-18 audit measured three shipped defects; each fix is structural
and each is pinned by an e2e probe (`console-endgame.spec.ts` § stability):

1. **The settled-scene FLASH.** `finalizeCeremony` bumps `skipSeq` on every
   terminal landing (the natural end included); the old `--noanim` frame set
   `animation: none !important` and re-enabled it two rAFs later — and a
   re-enabled keyframe animation RESTARTS from its first frame, so the scene
   root's completed fade-in replayed from `opacity: 0` (~0.5 s of the board
   showing through). Now: `--noanim` suppresses **transitions only**; the
   scene root carries **no keyframe animation at all** (the shell's
   `con-layer` transition owns the arrival); entrances live only on elements
   that MOUNT at their moment (ribbon, places, tie chip) or under phase
   classes present only then (`--entering` rows/rail).
2. **The bar JUDDER.** The row grid declared five columns but rendered four
   children while the tie-break M€ chip was absent — auto-placement put the
   running total into the `auto` column, so every count-up digit re-solved
   the `1fr` track (36 distinct bar boxes measured). The structural answer
   survives the podium (TR69): every part of a seat is a fixed box (the face
   slot, the reading block, the bar, the medallions' reserved height), the
   seat's size is the planner's px, never its content's; the M€ chip is
   absolute over the track; and the count-up writes `textContent` directly
   (`hooks.onCount` → an unbound span), never a reactive per-frame write.
   The reactive `displayTotals` is a per-BEAT settle record. The e2e probe
   reads PER SEAT during the COUNT (one bar box, one seat box each) — the
   ranking and the crowning are the podium's deliberate moves, after it.
3. **The BARCODE.** Sub-segment shades/seams survived the merge, so the
   settled bar showed every TR source and card family as its own stripe.
   Now the shade/seam classes are gated on `!merged` and dissolve via a
   background-color transition — the settled bar is ONE hue per top-level
   category, with a dark hairline between categories (`.con-eg__seg::after`).

## THE STAGE HOLDS ITS LAYERS — one stalled frame per category was the GPU (PL-868, T08)

Measured on the Steam Machine at 4K (TV profile, GPU raster, `--exclusive`), HEAD and T08 alike: once per category a
frame of 450–600 ms — the main thread idle in `LayerTreeHost::WaitForCommitCompletion` while `CrGpuMain` rastered
(`RendererRasterWorker` ≈ 600 ms). CDP `LayerTree` + a GPU trace named it: every category start promoted and dropped
small layers (a medal's transition, a chip's spotlight, the light), each churn RE-CREATED the five seats as «Overlap»
layers (new ids, 186 tiles each, rastered from scratch) and re-rastered a 1151-tile layer; the light's tone change
re-rastered its 3744×1384 wash (750 tiles); the count-up crossing a power of ten moved the shield beside it and
re-painted the whole seat. Four fixes, all in `console_endgame.less` / the component: ① the stage's moving parts and
the seats are promoted ONCE for the scene's life (`will-change` on the seats, the horizon, the rail chips, the
medallions, the sub-segments, the seams, the scar, the plate; the running total and the place medal as layers of their
own); ② the light's wash is a 256×128 `<canvas>` painted once per category (`paintLightWash`) and stretched by the
compositor — a tone change re-rasters a bitmap, never a 4K-wide layer; ③ the total's box holds its widest number
(`totalDigits` — the pre-penalty sum or the final, whichever has more digits), so a digit arriving never moves the
shield; ④ the board under the opaque scene stops rastering (`.con-root--endgame .con-main { visibility: hidden }`,
after the scene's 480 ms arrival; «Свернуть» drops the class and the board is back at once). Result (the same probe,
the same box): the worst per-category frame 550 → ~120 ms, p95 350 → 117 ms, frames over 500 ms 6 → 1 (the mount);
the trace has no main frame over 60 ms left. The remaining ~120 ms vsync misses are GPU-side with the main thread
idle (the screencast pump's readback is the suspect) — named open in the ledger.

## Track geometry (`consoleEndgameLayout.ts`) — the counting instrument

Pure and spec'd: `buildRowGeometry` solves all segments once per VM on the
SHARED `maxTotal` scale (fill = `scaleX`, paint-only); a penalty is a
**reclaim scar** `[netPct … grossPct]` — a track-background curtain sweeping
in from the right (origin right), leaving a red-hatched strip. The bar is the
seat's counting INSTRUMENT: every category's exact value stands in the seat's
MEDALLION (TR69), so the anchored label plan (`planValueLabels`) and the «+N»
edge chip retired with the rows.

## THE PODIUM (TR69 «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ», `consoleEndgamePodium.ts`)

Every player is a SEAT standing on the horizon: the corporation's premium face
(`ConsoleEndgameRow.face` — a human's first corporation card, the MarsBot
corporation's own face; a corpless seat shows its prepared place in its
colour) with the seat's LINEAGE behind it (below), the name with its PLACE MARK
beside it, the score in the score
cell's language (`ConsoleVpBadge` + the total — it ticks on the seat's ignition), the bar,
the medallions (the dossier's discs — `scoreCategoryGlyph`). The planner
(`planPodium`) solves the seats from the MEASURED box (`.con-eg__rows` is
`flex: 1 1 0` — the free space, never its content; a ResizeObserver re-plans
it; a hidden scene keeps the last box) and the live rem:
- `stack` (3–5) — the face over the reading block; `side` (the duel, a solo
  game) — the face beside it, and the seat is the TALLER of the two (the
  reading column's floor `readRem` / `heroReadRem` — a narrow box caps the
  face by width and the column must still fit: PL-646, the Deck duel);
- one equal width per seat for the whole act (the crowning moves nobody
  sideways); the drama is height — equal at `EQUAL_HEADROOM` of the hero while
  the count runs, the crowned winner(s) at the full height with the largest
  face, the rest at `placeRatio`;
- ranked, `podiumOrder` puts the winner on the crest, the runner-up at its
  left, the third at its right; each ranked seat stands on the planet's curve
  (`horizonDrop` on the radius `horizonRadius` — the same number the CSS
  draws the limb with, `--eg-arc-r`); the count stands level;
- the horizon (`.con-endgame::before`) crests at the podium's measured foot
  (`--eg-horizon-y`) — the stage the winner stands on, the actions on the
  ground below it.
**THE LINEAGE STANDS BEHIND THE FACE, THE HONOURS NEVER COVER IT** (the owner's
direction of 2026-10-22 — a campaign seat carries several corporations, «первая
всегда главная, дополнительные премиально сзади»; the title badges «не должны
закрывать важную инфу»). Four rules:
- **The face is the FIRST corporation** (`player.corporations[0]` — the tableau
  is in play order, so a campaign seat's base corporation, the one its lineage
  starts with); **every later one is a CHARTER behind it**
  (`ConsoleEndgameRow.lineage`, play order — a bot has none): the same premium
  face, one NAMEPLATE higher per depth (`LINEAGE_STEP` = 0.13 of the face — the
  gold frame + the name band, 12.5 %, show whole), `LINEAGE_SHRINK` narrower and
  a shade deeper per depth (an overlay — never the charter's own opacity, which
  would show the art behind through its nameplate), at most `LINEAGE_VISIBLE`
  (3), the deepest naming the rest («+N»). The names rise above the face like a
  pediment's tiers; the face stays the one hero. The charters stand OUTSIDE
  `.con-eg__face` (`.con-eg__stand` › `.con-eg__charter[data-eg-charter]`), so
  «the seat's face» keeps meaning the first corporation; they rise from behind
  it as the scene enters (transform / opacity).
- **The planner reserves the table's deepest rise on EVERY seat**
  (`planPodium({lineage})` → `rise`; the face is solved from the box less
  `(1 + rise)`, `--eg-rise` on the rows) — the faces stand level, a
  one-corporation seat keeps the geometry with its rise empty, the count's
  seats stay equal. A table of one corporation each reserves nothing.
- **The place medal stands BESIDE THE NAME, never on the face** — it stood on
  the face's foot, over the corporation's starting row («30 · пр. стали»). The
  ident's PLACE MARK slot (`.con-eg__mark`, `--eg-mark-d`) is reserved from the
  first frame: the colour dot while the count runs, the medal ringed in the
  player's colour once ranked (the dot grows into it — nothing moves).
- **A campaign title is the seat's CREST** (missions 1–3; `.con-eg__title`,
  `data-eg-title`): on the anchor the ribbon and the champion plate share — the
  seat's top edge, centred — the real insignia taller than its plaque, the
  title in its metal, the TP under it; the seat's top padding (1.2rem, the
  planner's `padY`) holds the crest's inner half, so it never reaches the
  lineage, the face or the name. The winner's «ПОБЕДИТЕЛЬ» YIELDS to its
  Governor crest in the crest's own beat (`ribbonYields` — CSS-timed on the
  title's ascending delay, Prefect → Administrator → Governor), the champion
  plate's precedent: the mission is won first, the title conferred second; a
  settled screen shows the crest alone. In the DUEL (`side`) the whole crest
  anchor — ribbon, champion plate, title — stands over the READING column (the
  player's name and score, whose honour it is: `50% + (face + gap) / 2`), never
  over the seat's middle, where it hung over the seam between the face and the
  name.

The type is rem ≥ 0.85 everywhere on the podium (the TV floor is a floor of
type; the faces are what scale). Guard: `consoleEndgamePodium.spec` (every
profile × table size: the seats fit, the hero ≥ a third of the box and the
tallest, the count lower); e2e `console-finale-podium` (A — five seats at
4K / FHD / Deck: the hero ≥ ⅓ of the opening, the content's foot ≥ 85 %, no
empty band over ⅓, no scroll, nothing under the floor; B — the duel × 4K /
FHD / Deck, every seat holding its reading column; E — MarsBot in the race,
its OWN corporation face on a seat: `data-eg-face="bot"`, the fixture
`finale-rich-bot`). The lineage and the honours: `consoleEndgamePodium.spec`
§ THE LINEAGE (the stand fits every profile × table size with three charters,
a one-corporation table reserves nothing), `consoleEndgameModel.spec` § THE
LINEAGE (the first corporation is the face, the rest in play order, a bot has
none), e2e `console-campaign-endgame` § campaign podium (`seatCoverage` — the
crest, its insignia, the ribbon and the place medal cover 0 % of a face, the
crest 0 % of the name; every charter's nameplate whole above the card in
front of it).

## Ceremony machine

`CeremonyPhase`: `idle → entering → scoring → settling → ranking →
[tiebreak] → winner → actions`; inside a category the phrase is
`beatStage: focus → light → grow → settle` (+ a scripted pause). The pure script
emits TWO beat lists that share ONE tail (`tailBeats` — ranking, places, tie-break,
winner hold, winner, champion, actions — always at ×1): the NATURAL count
(`ceremonyBeats` = `countBeats` + preRank + tail — a MAIN category ≈ 220 focus /
280 the light's way / 100 a seat (the cascade) / 440 grow / 180 settle / 180 pause ms,
a multi-sub category's intro 360 ms, sub-steps 340 ms, merges 400 ms; ≈ 12.4 s for
`finale-rich-5p` on the box) and the HURRIED one (`hurriedBeats(vm, from)`, below).

**THE LIGHT BUDGET (CI, the owner 2026-10-23: «всё мигает как на дискотеке,
особенно при ускоренном подсчёте») — the law every beat obeys on ANY pace.**
① ONE light lives the whole count: `onLight` 'rise' with the first category
(600 ms), 'glide' to every next one (500 ms — the wash's HOTSPOT moves under the
category's rail chip and its TONE lerps to the category's, the 256×128 canvas
re-painted per frame: the light never switches off), one 'release' at the preRank
(760 ms, longer than the rise). Never «falls and releases» per category (T08 did
— 14 switch-ons/offs of the podium's light per count). ② No luminous event is
shorter than `CEREMONY_MS.minEvent` (240 ms): JS through `luminousMs`, CSS through
`max(@eg-floor, calc(Xms * var(--motion-scale, 1)))`; the old `--eg-pace` token is
GONE (it cut the rail's spotlight and the ignition to 43–53 ms under X). ③ A
seat's medallion ignites ONCE per category: a soft RISE of the medallion itself
(CSS `--on` 420 ms ease-out + the disc settling from 0.92, `igniteRise`) — no
ring, no flash (`.con-eg__medal-glow` is deleted); a multi-sub category ignites
on its first source (stagger 100) and its later sources count on at once under
the same rise. ④ The PLATE is a STRIP (`.con-eg__plate` = a masked window as wide
as the widest face, every category's face in one grid cell shifted by
`--eg-pf − --eg-plate-i`, each face its own content-sized PILL): a category change
SLIDES it — never a crossfade of two faces; its frame is neutral (the tone is each
face's disc), the sources of a multi-sub category stand in one cell and change by
opacity. ⑤ The rail's spotlight and the plate's slide are floored transitions;
under X the plate slides LINEARLY at the pass's step (`--eg-sweep-step`) so the
steps chain into one glide. The ignition cascade reads the script's times
(`igniteOffsets`), the seat's count starts on ITS ignition, its segment grows
out of the medallion (`segOn` / `subOn` / `reclaimOn` read the seat's ignition).
Every motion is under the director's clock (`attach` — paused and killed with
the timeline; a tween's OWN `onComplete` is chained, never replaced). Reduced
motion draws no light and plays no accent. The ranking FLIP moves the seats along
both axes; the crowning is its own FLIP (`hooks.onCrown`). The winner's
`ceremonyFx` is a WAVE (`intensity: 'wave'` / `'wave-quiet'` for a co-winner):
ONE ring that swells in over ≥ 400 ms and lets go slower, one soft sweep — no
sparks, no flash, no repeated rings. The root publishes the beat for the probes
(`data-eg-beat` / `data-eg-cat` / `data-eg-hurried`); the light declares itself
(`data-eg-light="wash"`).

**X HURRIES THE COUNT — ITS OWN CHOREOGRAPHY, never `timeScale` (CI; the owner
chose M1 «one pass» on the live mockups, 2026-10-23, over the per-category comb
×3 and the all-at-once curtain).** `handle.hurry()` cuts the timeline at the
playhead (every beat not yet played and every count-up still running — its proxy
keeps the value it shows) and lays `hurriedBeats(vm, from)` in its place, from
the category the count stands in: one `sweep` (`hurrySweepMs(remaining)` — 1.2–1.8 s,
the fewer left the shorter): the light glides chip to chip in ONE motion
(`onLight` 'sweep' with the path, or 'rise' with it when X lands before the
first category), each category falls into place as the light passes it (every
seat's medallion at once — one comb), the plate slides after the light; the
`odometer` (one `power2.out` tween per seat from its shown value to its FINAL
sum — never a step per category); a `preRank` breath of 460 ms at ×1
(`hurry = 'returned'`); then the SAME tail at the full pace. A second X is a no-op;
past the count X is refused and the bar does not offer it (`countHurriable`).
Reduced motion HURRIES TOO — the same beats, no light (the hooks draw none
there). **The one atomic settle remains** only for the hidden-tab safety net
(sized from the LAID timeline, `tl.duration()`) and a reload into END.

The numbers (Steam Machine, `--exclusive --workers=1`, TV 4K / FHD, `finale-rich-5p`;
the stand `console-finale-flash-budget`, the game running beside it): the natural
count — lights at once 6 → 1, luminous events per count 47 → 1, per second 11 → 1;
the hurried remainder — luminous events per second 23 → 0, the shortest 58 ms →
none (the light glides), the podium's brightness swings (≥ 1 luma within 400 ms)
8 → 1 a second, the odometer never steps back; the remainder 1.8 s either way.

**`finalizeCeremony(vm)` is the ONE canonical terminal state** — the natural
ending, reload-into-END and the safety net all land there;
`skipSeq` drives the one-frame transition suppression. It resets
`actionsFocus` to 0 («Обзор партии» — the natural next step) and leaves
`collapsed` alone (finalizing behind a collapsed scene must not yank the
player off the board). The animation-hold supplier (`endgame-ceremony`)
reads the reactive phase AND releases while collapsed.

### The CAMPAIGN CHAMPION beat (final mission only)

`vm.campaignFinale` (from the server's `gameOptions.campaign` contract:
`final === true`) appends ONE `champion` beat between `winner` and `actions` —
the mandatory campaign coronation, on the SAME timeline (pause/resume, skip,
safety net and idempotency inherited). Five windows (~5s base), each a
reactive `championStage` the CSS narrates: **pause** (the result stands
fixed; `.con-endgame--champion` recedes the rail/caption/meta and deepens the
rest-rows' step-back) → **seal** (the header slot crossfades «ИТОГИ ПАРТИИ» →
«КАМПАНИЯ ЗАВЕРШЕНА») → **sweep** (a one-shot light bar runs the champion
row's own frame; the row gains the persistent `--champion` deepened gold) →
**plate** (the «ПОБЕДИТЕЛЬ» ribbon fades while `.con-eg__champline` unfolds
on the same anchor: «ЧЕМПИОН КАМПАНИИ» + the player-color swatch + one pip
per mission lighting in sequence) → **fix** (a gold ping + a GSAP scale pulse
on the final total — deliberately NOT a CSS animation swap, which would
restart the winner crown pulse when the phase class drops — and the
persistent gold KEEL mounts under the number) → a reading hold.

Rules the beat obeys: it is a DECORATIVE LAYER — every mark is absolute, the
row grid never re-flows (e2e-pinned rect-equality across the whole act). It
CANNOT be skipped: `handleIntent` absorbs the whole pad and `footCommands`
returns `[]` while `phase === 'champion'` (no stale hints, mash-proof); the
animation-hold supplier already covers it as a pre-`actions` phase, and the
director's safety net / unmount finalize keep the lock bounded.
`finalizeCeremony` carries the TERMINAL campaign state (`championStage: 4`,
`championShown`) so the scoring skip, a reload into the ended campaign and
the natural ending all land on the same settled screen: header «Кампания
завершена», plates, keels, full row readability, actions focused on
«Хроника кампании» (the campaign-map door leads the list). «Повторить
подсчёт» resets the marks and replays the full act. Ties share the
championship: every `vm.winners` row gets an EQUAL plate/frame/keel (the
zone note turns «Чемпионы кампании» in its fixed-height slot); the MarsBot
rides the same path (no bot branch exists). Reduced motion keeps the
SEMANTIC act (header turn, instant plate+pips, keel) with no travel.
Missions 1–3 and ordinary games see zero changes (no beat is emitted), and
the Governor emblem is never the champion mark — the plate is
(`campaignRowBadges` carries per-mission titles only). E2E: a REAL final
mission (`tests/e2e/console-campaign-endgame.spec.ts` — dev fast-forward ×3
with single-corp lineages, mission 4 played through the shared harness).

**Missions 1–3 have ONE continuation CTA** (2026-09-04): the actions list
leads with a single «Следующая миссия» (`campaign-next`, honest status
note; a live mission is entered directly). It opens the ONE campaign scene
— the map — which opens the mandatory carryover step ITSELF and then
stands as the launch / ready-waiting stage (auto-join armed for a ready
non-host). The workspace's own carryover scene is DELETED; while the map
scene stands, `footCommands` mirrors its overlay through `campaignMapUi`.
Full contract: `docs/CAMPAIGN_MODE_ARCHITECTURE.md` (header, «Interlude
ONE-FLOW»).

**THE WINNER IS THE SEAT — the hero of the podium** (TR69): the tallest seat
with the largest face on the horizon's crest, the gold rim + wash, the
«ПОБЕДИТЕЛЬ» ribbon standing on the seat's top edge (on missions 1–3 it yields
to the Governor crest), the gold place medal beside the name and the
total with a one-shot crown pulse — never a duplicate plate. Solo defeat = a calm neutral ribbon, no burst. The tie-break strip is
transient zone annunciation; the deciding M€ chips stay on the contender
rows through the settled state (absolute — zero layout impact). Winner gold
≠ focus cyan by hue, weight and placement.

## THE BOUNDARY IS A TEARDOWN (`consoleEndgameSeal.ts`)

Phase.END arrives from the POLL, not from a press, so whatever the player had
open at that instant is still open one frame later — and `.con-endgame` is one
of the LOWEST layers in the shell (11480). The quick wheel (11500), a sheet
(11500), Information (11560), the hand pack (11645) and the notification feed
(12650) therefore kept painting OVER the finale, and because the workspace
consumes the whole pad while its scene stands, none of them could be dismissed
any more: an open action wheel was a lid welded over the final scoring.

`sealLiveGameSurfaces()` runs ONCE on the rising edge of `endgameFrameLive`,
BEFORE `enterWorkspace('endgame')`, and dismisses every live-game instrument
BY NAME — the quick wheel / sheets / confirm / sale (`closeConsoleLayers`), the
workspace PARK (a decision set aside for a game that has ended), Information,
the journal + its local layers, the fullscreen viewer, the colony focus stage,
both board inspection modes, the prompt-scoped picks, the notification feed,
the surface-motion shade. The shell adds what it owns as component state
(«Разыграно», the journal's colony dossier, `resetHandReveal`). **A new console
surface is a new line there and a new row in `consoleEndgameSeal.spec.ts`** —
that spec is the boundary's worklist.

Deliberately NOT sealed: the workspace STACK (the phase root's own
`enterWorkspace` unwinds it), every `waitingFor`-derived surface (the transport
is down; nothing is ever owed), and the drawn-cards REVEAL — a reload into an
ended game can still owe undelivered draws, and «no silent loss» outranks a
tidy screen.

⚠ **PLANET FOCUS IS ASKED TO END, NOT TO VANISH.** The module owns WHEN the
mode ends; `ConsoleBoardSection` owns its GEOMETRY — the camera moved in, and
the pre-focus framing is replayed on the `exiting` phase. `resetPlanetFocus()`
is a hard DROP: it jumps straight to `idle`, so `exiting` never happens,
nothing replays the framing, and nothing re-derives it either (the stage's box
is identical across the boundary — every HUD member the post-game hides uses
`visibility` — so no resize ever reaches `scheduleFit`). The player collapsed
the results onto a planet zoomed in, clipped by both bars, arcs cut off. Fixed
on BOTH sides: the seal calls `beginPlanetFocusExit()` when the mode is engaged
(the ordinary exit costs nothing under the arriving scene and unfreezes
`heldParams` through its own settle), and the board SELF-HEALS at `idle` when
`fitMode` is still `'focus'` — so any future hard drop, from any caller, is
covered. The `--board-scale` across the boundary is pinned in
`console-endgame-boundary.spec.ts`.

⚠ `closeInfoMode()` LATCHES a dismiss tail (`infoModeState.closing`) whose
release is the panel's own after-leave hook — which cannot fire for a panel
that was never mounted. Sealing an already-closed Info Mode pinned `closing`
true for the session, and `con-root--rail-replaced` reads it: the trophy
gallery went dark for the whole post-game inspection, the exact defect
`endgameStageUp` exists to prevent. The seal asks before closing. A latch
belongs to the WORK, not to the ATTEMPT.

**The HAND leaves with its dock.** `handDockVisible` already hid the CHASSIS at
Phase.END, but the cards are not the dock's children — they are one persistent
fixed layer of their own (`handBodies.ts`), so the finale ran under a full hand
nobody could put away. `ConsoleShell.handBodyCards` (the layer's `cards` prop)
is empty in the post-game — gated on the PHASE alone, deliberately: the
pre-game setup window is the dock's other hidden state and cards are physically
flying into it there.

## Collapse (B = «Свернуть») and the READ-ONLY FREE ROAM

B in ANY phase parks the scene: `consoleEndgameUi.collapsed = true`, the
director timeline PAUSES (`handle.pause()`; the safety net re-arms while
paused instead of skipping), the workspace hides via v-show with its frame
still in the stack, `.con-root--endgame` drops (HUD + final board return)
and the bar reads `B Итоги партии`. B never leads to the main menu — «В главное
меню» is an ordinary A-confirmed action.

**Collapsed, the workspace owns NOTHING** — it publishes no bar commands and
its `handleIntent` returns immediately. The shell routes on `endgameStageUp`
(mounted AND showing), so past «Свернуть» the pad runs the ORDINARY chain and
the post-game is a read-only free roam over the same screens: the board and
both its inspection modes (L3 / R3), «Журнал» (View), «Разыграно» (X),
«Информация» (Y), and — through the RT wheel, which is how they are reached at
all — «Колонии» and «Гидросеть». Every action verb answers «Партия завершена»
(`actionBlockedReason` gains the post-game answer, which the LT wheel, the
standard projects, the MA items and the hand press all read), and the RT
wheel's two PERSONAL tiles («Карты», «Действия карт») are blocked with that
same reason while the two BOARD tiles stay open. Blocked with a reason, never
hidden — the console's rule everywhere else. The ONE exemption is
`confirmColonySelection`: the focus stage IS the colony's dossier, and refusing
the descent would take the colonies' final state away from the inspection.

**B is one calm level, every time.** A surface closes itself; an inspection
mode exits; and at the BOARD-HOME ROOT — where there is nothing shallower left
— `handleSectionBack` calls the workspace's `expandFromBoard()` and the results
come back, settled, from the same beat. The bar's road home is appended to the
board `home` run (a `back` command is `keep: true` in the fit model, so it
survives every drop pass; it needs no `priority`).

The alternative shipped and was the report: a hidden scene that keeps eating
the pad is not a workspace, it is a lock — the whole inspection was a static
board with one live button.

**Re-entry:** the ceremony auto-plays only when this page load SAW a live
phase (`sawLivePhase`) and hasn't played yet; a reload straight into an
ended game lands SETTLED — «Повторить подсчёт» is the explicit replay
(it resets presentation state only; the VM/data are untouched).

## The road BACK IN — the archive slice of «МОИ ПАРТИИ»

A finished party is not a dead end: the main menu's games list has **two
SLICES**, and L3 (`stickL`) toggles them — «АКТИВНЫЕ» (the join list) ⇄
«ЗАВЕРШЁННЫЕ» (the archive). Opening an archive row lands exactly here, on the
settled state above, where «Обзор партии» and «Повторить подсчёт» live. That
toggle is the whole feature: the workspace already knew how to be re-entered,
nothing about the ceremony changed.

- **Server:** ONE route, one param. `GET /api/games/joinable?name=…&status=active|finished`
  (`JoinableGameStatus`; default `active`, and an unknown value can never widen
  the slice). `getJoinableGameSummary(game, name, status)` returns `undefined`
  for the other slice and stamps `finished` on the summary. Both slices scan the
  same ledger, so the console asks for the archive LAZILY (once per menu
  session, for the tab-chip count) and keeps POLLING only the live slice.
- **A finished row claims nothing that belongs to a live game.** Its stored
  `activePlayer` is merely whoever was to move when the game ended, so
  `yourTurn()` and the crew's «его ход» dot are both gated on `finished !== true`
  — otherwise the archive pulses a turn that cannot be taken. And opening one
  must NOT stamp `recordLastGameEntered`: that memory names the party CONTINUE
  should resume, and a finished id would erase it (`openLocalGame`). The curtain
  says «синхронизация», not «подготовка экспедиции» — nobody is leaving on an
  expedition.
- **LAN rows are live-only.** Hosts publish their unfinished games; the archive
  is this device's own (`visibleLanRows` is empty on the archive tab, which also
  keeps the cursor range honest).
- Files: `src/server/models/joinableGames.ts`, `src/server/routes/ApiGamesJoinable.ts`,
  `src/client/components/mainMenu/joinGamesState.ts` (`finishedGamesState` —
  no polling, no cross-session cache, self-healing on a profile switch),
  `src/client/components/console/menu/ConsoleMainMenu.vue`. Specs:
  `tests/models/joinableGames.spec.ts`, `tests/routes/ApiGamesJoinable.spec.ts`.

## The head's HANDOFF and the post-game PLATES (PL-576, 2026-10-17)

- **The title / caption swap is the prompt family's handoff, never a cross-fade** (`con-eg-xfade`): the old line
  lets go ON THE SPOT (130 ms), the new one arrives 40 ms before the old is gone (300 ms, from `scale(.965)`). The
  simultaneous 160 / 220 ms fade read «ФИ◈ИТОГИ ПАРТИИЧЁТ» at mid-swap — two legible lines in one cell. Storyboard:
  `screenshots/pl580/finale-after/title-handoff.jpg`.
- **The post-game actions are PLATES with a SIGN**: the console glass, an inline-SVG stroke icon per action family
  (`ACTION_ICON` — never a font symbol: the Deck's fonts have no ⟳), the word; the cursor is the ONE grammar
  (`.con-cursor()` + `.con-cursor-on()`, TR58 — cyan, the winner's gold stays on the row); disabled = muted ink + a
  neutral ring paint (`.con-cursor-paint`). `cursorGrammarGuard` lists the surface as MIGRATED.

## Input & the bottom bar

The shell delegates the whole pad to the workspace while its SCENE IS ON
SCREEN (`endgameStageUp` branch in `handleIntent` — mounted AND showing) —
Info Mode / journal / wheels are deliberately consumed there (an Info peek
would leak pre-reveal totals). One exception: ⚠ **a LIVE drawn-cards reveal
keeps the pad** (a reload can owe undelivered draws; the overlay stands over
the settled result and its normal branch sits BELOW this one). Past «Свернуть»
the branch steps aside entirely — see the free roam above. «Обзор партии» is
the workspace's OWN internal scene — the workspace routes the whole pad to it
while it stands (`overviewParked` branch at the top of `handleIntent`); the
desktop `.eg-results` overlay never rises in console mode. Full contract:
`docs/claude/console/endgame-overview.md`.

Bar: PanelOwner `'endgame'`; during the count `B Свернуть · X Ускорить
подсчёт` (T08 — `countHurriable`: the verb exists only while a count is left to
hurry; once pressed, and through the ranking and the crowning, the bar is `B
Свернуть` alone); settled `dpad Выбрать · A Подтвердить · B Свернуть`. COLLAPSED the
workspace publishes NOTHING — the bar belongs to whatever surface the free roam
is standing on, and the board home carries the ordinary view run plus
`B Итоги партии`. The bar CONTEXT is empty while the scene shows (the scene's
own header already reads «ФИНАЛЬНЫЙ ПОДСЧЁТ» → «ИТОГИ ПАРТИИ» at settle) and
`Final state` on the collapsed board home (every other surface names itself). Post-game actions (real flows only), in
priority order: `Game overview` (default focus) → rematch verbs from
`rematchState` (**`Rematch`** when `votes.length <= 1` — a bot/solo game's
offer creates instantly, there is nobody to propose to; else `Offer
rematch` / accept+decline / cancel / join via `navigateWithCurtain`) →
`Replay scoring` → `To main menu`. Action pills carry no inline glyphs —
the bar states the controller semantics.

## Presentation modes (player count)

The podium planner IS the presentation mode (TR69): `side` for the duel and a
solo game, `stack` for three to five; the seats are solved from the measured
box, so five players stay one screen with no scroll (e2e-guarded at 4K / FHD /
Deck — `console-finale-podium` A). `con-eg--n<N>` stays on the frame as a hook;
the frame's own furniture (the rail, the caption, the bottom zone) has one set
of tokens, which the handheld profile overrides.

## E2E harness law (cost a day)

**Once the page is open, the VIEWED seat's prompts are answered THROUGH THE
PAGE only.** `WaitingFor` skips GO/REFRESH while the viewer holds a required
prompt (mid-input protection), so an API answer behind a live client freezes
it — a state two real clients cannot produce. The shared journey
(`consoleEndgameHarness.journeyToEndgame`) drives everyone to the viewer's
final-greenery question over the API, answers THAT through the page,
finishes the others over the API, and the promptless page hears the END
through its own poll. Also: testMode deals 8 corps/seat — a 4-seat table
needs `promo+community` or two seats are never dealt and the start deadlocks
on `every(pickedCorporationCard)`. Probes are `setInterval`, never rAF
(headless starves rAF; a dead probe passes). **A MOTION claim pumps its frames and reads them** (T08): headless
Chromium paints only when asked, so an unpumped 4K count crawled (≈ 5 rAF/s beside a neighbour's run, the beats
stretched ×6, the safety net finalizing mid-count) — `pumpFrames(page)` (a low-res CDP screencast, every frame acked
and dropped; a storyboard pumps by itself) and the probe's own rAF / LoAF record (`readCountProbe` prints `[frames]`
and annotates the test) sit beside every verdict; a cascade is judged only where the page HAD its frames (a gap over
200 ms inside its window is the frame's verdict, never the cascade's). `console-finale-podium` is TIMING class:
`--exclusive --workers=1`.

## «Обзор партии» — the internal analytics scene

The console-native OVERVIEW rewrite shipped 2026-08-19: «Обзор партии» is an
internal SCENE of this workspace (`ConsoleEndgameOverview` — six tabs on the
LB/RB ring, InsightEngine headline facts, console-native charts), never the
desktop `.eg-results`. The scoring stage PARKS under it (opacity/visibility,
never display) and returns on B with the settled state intact. Full contract:
`docs/claude/console/endgame-overview.md`.
