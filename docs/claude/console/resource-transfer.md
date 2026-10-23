# THE RESOURCE TRANSFER — one language of «a resource arrives», with BOTH ENDS LIVE

The console's one premium language of receiving (and paying) resources:

> **source → token → intake → delta** — a physical token carrying its amount is born on the object that produced
> it, flies to the object that receives it, and the receiver's counter changes ON THE TOUCHDOWN (its delta chip
> riding that honest transition).

It is ONE framework (`src/client/console/resourceTransfer/`) with many hosts: the play scene («Разыграно»), the
ACTION COMMIT (the composer's wave and its rail half), the tile language (own and remote landings), the colony
stages, the Parliament's sittings and laws, the score cell, the generation scene… A host never animates a resource
itself; it hands the framework SPECS and their ENDS.

| Module | Owns |
| --- | --- |
| `resourceTransferModel.ts` | the PURE vocabulary: specs, merging, the arc, the chip scale, the wave stagger, **`TransferEnd`**, the retarget ramp |
| `resourceTransferDirector.ts` | the GSAP hands of ONE chip: the birth frame, the pop, the arc, the final approach, the touchdown, the absorb |
| `consoleResourceTransfer.ts` | the RUN: the panel reward hold, the anchor ladders, the live ends, the detached flight, the sentinel, the trail |
| `transferEndVisible.ts` | the ONE verdict of «is this end painted» |
| `railReward.ts` | a promise held against the two views (the rail rows, the table's answer), flown by its owner |
| `consoleResourceTransfer.ts` § THE LAW OF THE FOLD | the registry of every token's two ends; `surfaceClear` / `surfaceHoldsTokens`; the fold sentinel; `noteTransferTrail` |

## 1. A flight end is an OBJECT (T06, the owner's direction of 2026-10-21)

The owner's two complaints: «ресурсы летят в координату на экране, где ничего нет — при розыгрыше карты или активации
действия синей карты летят туда, где карта БЫЛА» and «ресурсы с поля летят на чип другого игрока — игроки думают, что в
никуда». Both were one class: **an end was a POINT measured once — at the press, at the run's start — and a point has no
verdict**. The object it described folded (the composer), moved (the rail under a leaving workspace, a chip carried
along its ribbon) or was never there (the air under a seat's dot).

`TransferEnd = {el, fx, fy}` — the element and the place inside its box as fractions. The framework re-measures it
**in the frame the end matters**:

| Frame | What is read | Gone → |
| --- | --- | --- |
| **the birth** (the director's `place` hook in `bornThenFlown`, the very tick the chip turns visible) | the SOURCE as painted (`getBoundingClientRect`) through the verdict | the chip is **never born** — `born: 'unpainted'`, degrade `source-gone`, the counter ticks |
| **the final approach** (`TRANSFER_RETARGET_AT` = 0.8 of the arc) | the DESTINATION at rest (`restingRectOf`) through the verdict | its **stand-in** (`homeStandIn` — the spec's own home ladder: the satellite cell of that resource, a rail row), else the chip is **absorbed in the air where it is** — `end: 'lost'`, degrade `destination-gone` |
| **the touchdown** | the destination once more | the settle **glides** onto where it is now (never a jump) |

The correction found on the final approach is RAMPED IN over the rest of the arc (`transferRetargetWeight` — zero at
the read, the whole difference at the touchdown, smooth: the token follows the object without a jerk). A move below
`TRANSFER_RETARGET_EPS` (2 px) is noise.

**Where an end comes from.** `ResourceTransferRun.origins` / `source.end` / `destination` / `destinationOf` accept a
`TransferEndLike` (an object end or a bare point); a spec with no explicit destination lands on its HOME — the ladder
`targetPointFor` re-run in every frame above (its first VISIBLE rung). A source matched by `source.selectors` is kept as
its ELEMENT (`resolveSourceEnd`) with each token's spawn fraction. Producers of object ends:
`resolveGainIconEnds` / `resolveSpendIconEnds` / `centreEndOf` (`consoleActionCommitMotion.ts` — a printed icon),
the commit plan's `source` (the hero's spawn band), the play scene's `heroRewardPlace` ladder (`heroTagOrigin`,
`heroGainOrigin`, `heroWildOrigin`, `heroVpOrigin`, `heroRailOrigin`), the rail half's `capsuleEnd` / `composerCardEnd`,
`seatChipEnd` (another seat's chip).

**A bare point is allowed only where no object exists** — a board cell's printed bonus measured before the tile covers
it, an explicit stage point (the sale terminal's slit). It is never re-measured; the SENTINEL (§4) asks what was painted
under it.

**No synthetic ends.** `seatChipEnd` answers `undefined` when no chip is on screen — the caller does not fly (the old
`seatChipPoint` fell back to «the top centre of the screen» — it stays only as a remote TILE's birth supply, never a
resource's destination).

## 1b. Another seat's gain lands on its chip's INTAKE (the owner's decision 6 = M1 «плашка-хвост»)

The seat's chip is a rival's only body on this screen, so it has a RECEIVER: `console/statusIntake.ts` (state +
lifecycle on the animation clock) rendered by `ConsoleStatusStrip` — a plaque hanging from the chip's lower edge, in the
seat's tone (the dot's own paint), a stem on the dot. A SIBLING of the chips in the ribbon, absolute (the chip's width
and the ribbon never move; it rides the ribbon's one transform with its chip; a passed chip's opacity never fades it).

| Phase | What the plaque shows | Who moves it |
| --- | --- | --- |
| EXPECTING | the icons of what is coming, «…», a thin ring of intake (≤ .5) | `openSeatIntake(seat, specs)` — BEFORE the tokens (it resolves once the plaque's numbers are PAINTED — the verdict on `probeTick`, bounded on the wall clock by `INTAKE_PAINT_WAIT_MS`; never on GSAP's clock alone, which stands still with the compositor), so the receiver announces itself before the token flies |
| RECEIVED | «+N» per resource, white | `acceptSeatIntake(seat, spec)` on each token's touchdown (`onArrive` — a degraded token counts too) |
| fold | — (back into the chip) | `INTAKE_READ_MS` (1.2 s) after the last unit; `INTAKE_SAFETY_MS` (6 s) if the tokens never came; `resetStatusIntakes` on the remote stage's abort |

The token lands on the plaque's NUMBER (`seatIntakeEnd(seat, resource)` — the delta-chip anchor law), else on the chip's
dot (`seatChipEnd`). ONE item and ONE token per resource (a sum — `runPlacerBonusBeat` merges the cell's units; the
city payout's per-city tokens add up on one item). A later payout to the same seat extends the standing plaque. Users:
the placer's cell bonus (W3) and a rival's card payout (`runRemoteCityPayoutBeat({seat})`).

## 1c. The receiver announces itself — «ожидает» везде (the owner's decision 7)

From a GAIN token's birth to its touchdown its receiver wears a ring (`.con-transfer__expect`, one per flight in the
transfer layer — never a class on a foreign element): the director places it on the receiver's RESTING box
(`expectRect` → `measureEndRect`: an object end's element, the home ladder's rung) in the birth frame, moves it with the
final approach, drops it at the touchdown (the contact beat answers then); a thin line in the resource's tone
(`data-expect-resource`), ≤ .5, a 160 ms fade in — never a glow of the row. A loss's «receiver» (the printed cost it is
drawn into) is not announced; the seat's intake announces itself; reduced motion shows none.

**The rail as a destination on the new material (T03 · CF):** the left rail's paint changed (one glass plate, engraved
production — `hud-frame.md` § THE MATERIAL OF THE PLAYER BOARD) and its ANCHORS did not: `.con-score__value`,
`.con-res__row--X .con-res__digits / __stockwrap / __prod` are the same selectors at the same rects (±1 px, guarded by
`console-rail-material`). A flight aims at the same selectors on every material.

## 2. A surface never folds under its own token — `surfaceClear` (T09, ledger BY)

**The law: a surface folds when it is neither the SOURCE of a token still to leave it nor the DESTINATION of a token
still to be absorbed on it — told by the tokens (`surfaceClear(el)`), never by a clock, never by a departure alone.**

T06 let a surface fold on its tokens' departure (`ResourceTransferRun.onLeft` — every token has left its source). That
was the law of a SOURCE only. A PRICE paid off the rail (Electro Catapult's plant, Space Mirrors' 7 M€, Caretaker's
8 heat — PL-099) LEAVES the rail and is absorbed at the printed COST icon of the card standing in the composer: its
`onLeft` (the pop off the rail) says nothing about the composer it is flying INTO. The rail half waited for it with
clocks of its own (the touchdown + `TRANSFER_BEAT_MS`, the touchdown + `TRANSFER_QUICK_ABSORB_MS`).

The engine knows both ends of every token as OBJECTS (§1), so it answers the one question every host asks:

| Piece | What |
| --- | --- |
| the registry | `runResourceTransfers` registers each token's two ends (`registerTransferEnds` — the element it is born on, the element it lands on: an object end's element, the home ladder's rung; a bare point registers nothing) in its SYNCHRONOUS half, before the first `await` — a host asking right after starting a run already sees its tokens. The birth is let go on the departure (`markTransferEndLeft` on `launched`, a detached token's too); the token is dropped on every way out (`removeFlight` — absorbed, no piece; a resting `hold` chip; the run's `stalled` safety; `abortResourceTransfers`) |
| `surfaceHoldsTokens(el)` | is a birth not yet left, or a landing not yet absorbed, inside `el`? (a gone surface holds nothing — the sentinel speaks for it) |
| `surfaceClear(el)` | resolves when the answer is no — at once when it already is; bounded by a ceiling past every honest flight (`SURFACE_CLEAR_CEILING_MS`, 9 s) that writes `surface:ceiling` into the trail (never a silent wait). Ask it AFTER the runs that may touch the surface have STARTED |

The hosts, each through it:
- **the ACTION COMMIT** — `ConsoleShell.finishDismiss`: `Promise.all([rail.foldable, waveLeft]).then(() => surfaceClear(surface))`
  before `fold()` (the surface: the awaiting handoff's motion surface, else `.con-cardactions`); nothing in the air →
  the sync `fold()` as before. The rail half's `foldable` is ONE door (`foldWhenClear`): asked once the chain's last
  tokens have STARTED (the last link's run, the answer's run off the «Сработает» chip) — a result born on the card holds
  the surface to its pop, a landing on a capsule / a row's miniature and a price drawn into the cost icon to their
  ABSORB (`flyRailRewardLink(…, {onAbsorbed})` for the receive grammar's own PAY). No `delayedCall` is left in the chain.
- **the claimed path** (a hosted outcome — a draw with a spend off the capsule, PL-201): the claim's settle
  (`reconcileWorkspaceOutcome`, which may release a claim nothing hosts and conclude the workspace) waits for
  `rail.foldable` + `surfaceClear` when the half stands on the surface (H3).
- **the play scene** — `consolePlayedHero`'s close awaits `surfaceClear(.con-recv)` after its own card-target absorbs
  (`stageAbsorbs`, T06): no token still to be born on the landed card (its TR, an answer off its printed tag), none still
  to be absorbed on the stage — whichever run flew it.

`onLeft` / `onAbsorbed` stay as the run's own signals (a host chains `surfaceClear` after them); **no host folds on
`onLeft` alone** (the source guard: every client file that hears `onLeft` asks `surfaceClear` too).

### 2a. Who else may take a surface away — the voluntary action centre (H6, the owner's report)

The owner's report («the workspace folds early, the card vanishes, the price flies into nowhere» — solo against MarsBot)
was not the flight's own fold at all: an action that ENDS the turn (every second one against the bot) answers with the
bot active, the prompt «moved off the action menu», and the shell's rule «the action centre is a voluntary surface —
leave when the prompt moves on» tore the workspace down IN THE FLUSH that resolved the commit. The composer unmounted,
its `beforeUnmount` killed the commit's motion (settling the beat), `finishDismiss` ran at once and flew the price into
the cost icon of a card already gone. In solo without a bot the menu always comes back — the T06 stand stayed green.
The rule is the pure `actionCentreLeavesOnPromptChange` (`console/actionCentreLeave.ts`) and it now stands aside while
the commit owns the surface (its awaiting handoff, its owed fold, its parked dismissal): the commit's own fold leaves,
after `surfaceClear`.

### 2b. The commit resolves ONCE (H5b)

`resolveAwaiting` resolves every view whose `gameAge` differs from the press's. While the dismissal was parked behind
the commit's minimum beat (`pendingCommitDismiss`) a SECOND view (the bot's «active» broadcast, a poll behind the answer)
resolved it again, found the plan consumed and OVERWROTE the parked dismissal with one that carried no plan — the fold
came at the beat's end and the seeded half was never flown. The parked dismissal now marks the fold owed
(`commitFoldOwed`) the moment it is parked.

### 2c. A party flow does not end on the ANSWER while the commit owns the surface (the first full baseline)

The Industrialists from «ДЕЙСТВИЯ КАРТ» (`console-parliament-actions`, `console-parliament-v2` — red in every attempt
with «the birth of production:megacredits off span.pcard-prod (div.con-cardactions.con-ws gone)»): the party flow
ended itself on the answer — `ConsoleCardActions`' `playerView.game.gameAge` watcher concluded a tick after the shell
had resolved the commit's handoff and PARKED its dismissal behind the beat (or started its wave), so the workspace was
gone when the wave's production token was to be born on the plaque's printed icon. The watcher now asks
`actionCommitOwnsEnding(awaiting)` (`consoleActionCommit.ts` — armed, not released, its handoff standing) and, when it
does, concludes only on the commit's release (`actionCommitLive` → `concludeAfterCommit`): the commit's own fold leaves
first, after `surfaceClear`, and the conclusion behind it is idempotent.

## 3. The table's answer to a play FLIES from its printed cause

A card's answer to a play (T06 GMO Contract — «+2 M€» for each plant / animal / microbe tag) is not a number that changes
a beat after the wave. The forecast twin states ONE fact per matching printed tag with its `reasonTag`
(`cardPlayedForecast`, Mars University's shape); the composer arms `RailReward.answerTags`
(`receivingStageModel.railAnswerTags` — per rail row, the causes: a tag and its share); the play scene births one token
per cause on the landed card's printed tag (`heroTagOrigin`), the row ticking on each touchdown. What no visible cause
covers (a party's share) ticks at the beat, as before.

## 3a. The rail half's seed — owed is not refused; every road seeds; the verdict is in the trail (T09)

- **A view that has paid NOTHING of the promise yet is OWED, not wrong** (`railRewardOwed`): a poll / WS frame applied
  before the submit's own answer carries the press's own state. `seedActionCommitRail` leaves the plan ARMED for the view
  that pays it (until T09 the first view consumed the plan and refused it); a plan whose paying view never came counts its
  END on the commit's release (`ended` — every way out, PL-430).
- **Every road that applies a view seeds it** (H5): `App.update` (the WS / poll road) calls `seedActionCommitRail` in the
  same synchronous block as its apply, beside the transport's `seedRewardHolds` (idempotent — a plan is seeded once).
- **A seeded half nobody flies** waits under its own named hold `action-commit-rail-owed` (notification-only) whose
  ceiling on the registry's WALL clock is its net (6 s → `endHalf('not flown')`) — never a delayed call on the animation
  clock, which stands still with the compositor (decision 6).
- **The verdict is in the flights' trail**: `rail:seed {key, verdict: held | owed | refused, mismatches}` (`railReward`,
  `consoleActionCommitRail`), `rail:end {card, phase, link, why}` (`flown` · `not flown` · `superseded` · `ceiling` ·
  `never seeded — …`), `surface:wait` / `surface:ceiling`. Read it through `window.__conReady().transfer.trail` (e2e),
  or ON SCREEN with `?trail=1` (the last 24 events in a corner of the transfer layer — a diagnostic, never a surface).
- **Still the DIFF of two views** (decision 3 — the owner, 2026-10-22: keep the diff + the trail; the bench saw no `refused`; seeding against the response's EVENTS needs a server channel and is revisited only if a `refused` shows in the trail): a foreign change of the SAME row in the SAME
  response (a reaction no forecast states, a concurrent seat) refuses the seed with its mismatch named in the trail. The
  bot's turn is NOT such a change — the server's scheduler plays it in its own response ≥ 1 s later.

## 4. The runtime sentinel — «оба конца окрашены», in every build

`consoleResourceTransfer.reportEnds` → `sentinel`: a token born on, or touched down over, a BARE POINT where nothing is
painted (the page, the console's bare `.con-root` — `unpaintedUnder`) prints
`[transfer] end not painted — the <birth|touchdown> of <spec> at (x, y) stands over <what>`. It is never gated on a dev
build (the e2e serves a production bundle): the e2e harness's auto-fixture `transferEndsGuard` (`tests/e2e/consoleTest.ts`)
turns it red on EVERY spec, so every spec that flies a token witnesses the law. An object end cannot print it by
construction (gone means not flown). Every flight's ends are named in the trail (`flight:ends {born, end}`).

**…and the FOLD sentinel (T09, decision 7):** an object end whose BAND SURFACE (`.con-ws` / `.con-recv`, recorded at the
flight's start) LEFT while the token was still in the air — a birth refused (`source-gone`) or a landing absorbed in the
air (`destination-gone`) with that surface gone or faded under .5 — prints
`[transfer] surface folded under its token — the <birth|touchdown> of <spec> <off|into> <end> (<surface> gone|faded)`.
Not a degrade the framework absorbs quietly: a host broke the law of §2. Every build; `transferEndsGuard` reads it beside
«end not painted».

**…and the PAINT sentinel (T12 / CA, §7):** a token in the LIT layer that is not the topmost thing painted at its centre
— asked at its birth, on its final approach (0.8) and at its touchdown, the token made hit-testable for that one
`elementsFromPoint` (`tokenPaintedUnder`) — prints `[transfer] token painted under <element> in <surface> at the
<birth|approach|touchdown> — <spec>`. A token under the shade BY PLAN (born on a covered cell) is not asked. Every build;
`transferEndsGuard` reads it beside the other two. Its blind spot is the hit test's own — a `pointer-events: none`
cover (the shade, the satellite, a seat's plaque) is never named; those are the z map's to guard (§7).

## 5. Degrades and their names

`TransferDegradeReason`: `no-source` (no visible source at the run's start) · `no-destination` (no visible destination,
not detachable) · `no-stage` (the layer is not mounted) · `stalled` (the wave's safety) · **`source-gone`** (the source
vanished before the token's birth) · **`destination-gone`** (the destination vanished on the final approach and nothing
stands in). Every degrade ticks the counter (`onArrive`) — late, never lost.

## 7. Two paints and the handover (T12 / CA — «жетон никогда не красится под поверхностью, на которую садится»)

The owner's report of 2026-10-22: «при размещении на поле от розыгрыша ПРОЛОГА ресурс летит ПОД панель, как будто
проблема с z-index». It was no z bug: the 09-03 cut demoted a board-sourced wave by its SOURCE for its WHOLE flight
(`fromBoard` → `con-flight-to-board` on the whole `.con-transfer` layer, 11444) while the rail it lands on stands lifted
over it under any workspace (`.con-res` 11520) — the token slid under the rail and «the rail counter still ticks at the
touchdown». And the lit layer itself (11670) stood UNDER the status strip (11706) a rival's intake plaque hangs in. The
stand (`tests/e2e/console-flight-paint.spec.ts`, the paint witness `tests/e2e/paintWitness.ts`) measured it before the
fix: the prelude's city — 36–37 samples of each token UNDER `aside.con-res`, the touchdown under the rail's digits (fhd and
tv4k); a rival's city — 41–42 samples under `.con-status`, the touchdown under `.con-status__intake`.

**One flight, two paints.** A token's two ends live in different paint: a board cell under a standing workspace is the
shade's (background — the 09-03 alarm about a chip «materializing out of the UI» was about the BIRTH), the rail it lands
on is lit. So the layer has a SHADED TWIN:

| Layer | z | Holds |
| --- | --- | --- |
| `.con-transfer` (lit) | 11715 | over every hull surface in every state — the rail lifted (11520), under the start's ceremony (11490), in Info (11561), the satellite (11470), the status strip and its plaques (11706), the command bar (11700), the dock (11702–11705), the hand's verdict rail (11711); under every scene that takes the screen (the MA ceremony 11720, the notices 11740, the card-deal / stranded layers 11890+) |
| `.con-transfer--under` (shaded twin) | 11444 | under the shade (11460) and every band surface (11480+) — a board story's token while it is still over the covered board |

**The plan** (`resourceTransferModel.transferPaintPlan`, asked ONCE in the token's birth frame through
`TransferFlightOpts.paint` — only for a `fromBoard` run): the COVERED AREA is the central opening — the shade's box
(always mounted, bounded by the four hull members' measured insets) while `con-root--ws-open` stands, the whole screen under
`con-root--endgame` (`measureTransferCover`). A token whose SOURCE is the board and whose box is wholly under the cover is
born UNDER; one whose DESTINATION is the board (a loss drawn back into its cell — a rival's plant price, a VP share walked
back; a card standing in a `con-flight-to-board` layer) lands UNDER; everything else is LIT. Under the endgame a board story
keeps its birth layer to the end.

**The turn** (`transferTurnDue`, on the arc's `onUpdate`, at most once — never back): `up` the moment the token's box is
no longer wholly under the cover (it surfaces at the edge of the glass, before any part could slide under the lit rail), at
the final approach at the latest (a lit destination INSIDE the opening — the satellite — is landed on, not under); `down`
once the box is wholly under the cover, at the touchdown at the latest. A surfacing token ramps from what the dim over the
board lets through RIGHT NOW (`boardPaintThrough` — the shade's fade × its dim, the start scene's room while it stands;
floored at `TRANSFER_HANDOVER_FROM` .3) to 1 in `TRANSFER_HANDOVER_MS` (120 × motion) — never a flash from the glass to the
rail; with nothing dimming the board (the start yielded to the field, the shade off) it simply changes layer — the own
storyboard caught a constant .3 ramp as a bright → dim → bright blink there.

**The handover moves the SAME element.** `ConsoleResourceTransferLayer` renders both layers `fixed; inset: 0` (one
coordinate space) and wraps the token in `<Teleport defer to="[data-transfer-under]" :disabled>` — the director only says
`piece.setLayer(part, layer)`; Vue moves the node (its transform, its tweens untouched), and a flight that ends leaves from
whichever layer it stands in (a hand-made `appendChild` leaks the node: Vue removes a fragment by walking its siblings).
The destination's marks (the contact beat, the receiver's ring) stand in the destination's layer. Every token wears
`data-transfer-layer="lit|under"`; the trail's `flight:ends` carries `layer: under→lit` and the handover's `q`.

**Static demotion is a declaration.** `con-flight-to-board` stays on the layers whose pieces never leave the board —
`.con-tileplace`, `.con-nomadmove`, `.con-scaleswing`, and the coins of `.con-scalepay` / `.con-citypay`, which condense on
the board and hand the crossing to a transfer token at the same point — each with `data-flight-lands="board"` beside it.
The transfer layer never carries it again.

**What did not change:** the gate of the board's quiet (`boardSourcedTransferActive` — automatic transitions wait for a
board-sourced wave), the demotion of the layers that land ON the board, the demotion under the finale, the panel reward
hold (z-blind).

## 6. Guards

| Guard | Pins |
| --- | --- |
| `tests/console/transferLiveEnds.spec.ts` | the pure half (the end's fractions, the clamp, the retarget ramp, the noise floor) + the director's / run's source (birth frame, final approach, touchdown glide, the closures, the sentinel never dev-gated, the harness guard) |
| `tests/client/console/transferLiveEnds.spec.ts` | an object end measured now / gone → none; the sentinel's «nothing painted»; the commit origins are elements; `seatChipEnd` without a chip is none; `railAnswerTags` |
| `tests/console/transferFlightClock.spec.ts` | the birth is painted before the flight starts (the birth frame's `place` hook stands before it) |
| `tests/client/console/transferEndVisible.spec.ts` | the ONE verdict |
| e2e `transferEndsGuard` (every spec) | no token born on / landed over nothing |
| e2e `console-classic-gmo-contract` (C) | the answer born on `tag:plant`, landed on `rail:megacredits`, its contact beat played |
| e2e witness `tests/e2e/transferWitness.ts` | anchors `tag:<tag>` (a printed tag of the landed card), `seat:<color>` (another seat's chip), `intake:<color>` (its intake plaque) |
| `tests/client/console/statusIntake.spec.ts` | one item per resource, the lifecycle (expecting → received → fold), a later payout extends, the number as the end |
| e2e `console-rival-payout-intake` | the plaque EXPECTING in the frame of the first birth, one token per resource on `intake:<seat>`, RECEIVED «+N» standing a read, the ribbon's width constant |
| e2e `console-classic-gmo-contract` (C) | the receiver's ring over the M€ ink while the answer flies |
| `tests/client/console/transferSurfaceClear.spec.ts` | the law's engine: a price into an icon on the surface holds it to the ABSORB (its departure off the rail is no release), a gain born on it to its POP, both to both, the last token decides, an end elsewhere / a gone surface holds nothing |
| `tests/console/transferSurfaceClear.spec.ts` | the source guard: ends registered before the run's first `await`, left on `launched`, dropped on every way out; the fold sentinel in every build + the harness; no client file folds on `onLeft` without `surfaceClear`; the chain keeps no clock; the shell's fold, the claimed path and H5b; §2c — the party flow's answer asks the commit before it concludes; the play scene; `App.update` seeds |
| `tests/console/actionCentreLeave.spec.ts` | H6 — the voluntary action centre stands aside while the commit owns the surface; the shell asks the one function |
| `tests/client/console/actionCommitRail.spec.ts` | § PL-099 / BY — a price with nothing after it: the surface stands while a token still lands on it (the engine, never a clock); H5 — an owed view leaves the plan armed; a never-seeded half ends on the release |
| `tests/console/transferPaintPlan.spec.ts` | §7's pure half — the plan (the owner's case under → lit; no cover; a lit birth; a cell at the edge; a loss into a covered cell dives; a card in a demoted layer; the endgame) and the turn (the edge, the approach, a dive whole, the touchdown) + the source guards (no `con-flight-to-board` on the transfer layer, the Teleports, the plan in the birth frame, the three sentinel moments, only a board-sourced run) |
| `tests/client/console/transferLayerHandover.spec.ts` | §7's DOM half — the SAME node moves between the twins with its transform, the end marks follow their own layer, a flight leaves from whichever layer; `measureTransferCover` (none · the opening · the endgame); the paint sentinel names what stands over a token and gives its pointer events back |
| `tests/console/flightLayerZOrder.spec.ts` | §7's z map off the COMPILED stylesheet: the lit layer over every hull surface in every state and under the screen-taking scenes; the twin under the shade, the bands and the lifted rail; a static demotion only with `data-flight-lands="board"` |
| e2e `console-flight-paint` (TIMING) | §7's stand: the paint witness on every token of a start prelude's city (the owner's case) and a rival's city — never under the hull, the touchdown on top (fhd + tv4k) |
| e2e `transferEndsGuard` (every spec) | no token painted under a surface in the lit layer (`[transfer] token painted under`) |
| e2e `console-action-price-fold` (TIMING) | the BENCH of BY on the owner's table (solo against MarsBot, the bot's turn inside the flight, `?realtime=0`, a slow answer, B in «Выполнение», two actions in a row, Caretaker, T09's play): the price lands on `hero`, the workspace stands at that landing and folds no earlier than the result's birth, no fold sentinel |

Laws: `.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE (… AND LIVE … AND A SURFACE NEVER FOLDS UNDER ITS
OWN TOKEN … AND PAINTED ON TOP OF WHAT THEY LAND ON), `.claude/rules/animations.md` § Landing rects are RESTING rects.
Ledger: sections BW (T06), BY (T09) and CA (T12) (`docs/claude/gameplay-polish-ledger.md`).
