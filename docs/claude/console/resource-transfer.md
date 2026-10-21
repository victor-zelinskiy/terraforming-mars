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

## 2. The surface folds only after its tokens have LEFT it — told by the tokens

`ResourceTransferRun.onLeft` fires once every token of the run has left its source (its pop is over, or it was never
born) — on every way the run ends. A host whose surface is the SOURCE folds on it, never on a clock beside the wave: a
wave's later tokens are born a stagger after the first, and a «one pop» timer let the composer dissolve under them.
Users: the shell's ACTION COMMIT wave (`runCommitRewardWave` returns the promise; the fold waits it), the rail half's
last link (`flyRailReward(…, onLeft)`), the table's answer flown from the composer's «Сработает» chip (PL-220).

`ResourceTransferRun.onAbsorbed` fires once every token has been ABSORBED at its destination. A host whose surface is
the DESTINATION does not dissolve before it: the play scene's card-target groups (`stageAbsorbs` — the stage closes
only after its own tokens finished their contact beat on its cards; before T06 a token absorbing over a card that had
left hung over the board where the card was — the stand: Pets' animal, 1094 px off any object at fhd, 2094 px at 4K).

## 3. The table's answer to a play FLIES from its printed cause

A card's answer to a play (T06 GMO Contract — «+2 M€» for each plant / animal / microbe tag) is not a number that changes
a beat after the wave. The forecast twin states ONE fact per matching printed tag with its `reasonTag`
(`cardPlayedForecast`, Mars University's shape); the composer arms `RailReward.answerTags`
(`receivingStageModel.railAnswerTags` — per rail row, the causes: a tag and its share); the play scene births one token
per cause on the landed card's printed tag (`heroTagOrigin`), the row ticking on each touchdown. What no visible cause
covers (a party's share) ticks at the beat, as before.

## 4. The runtime sentinel — «оба конца окрашены», in every build

`consoleResourceTransfer.reportEnds` → `sentinel`: a token born on, or touched down over, a BARE POINT where nothing is
painted (the page, the console's bare `.con-root` — `unpaintedUnder`) prints
`[transfer] end not painted — the <birth|touchdown> of <spec> at (x, y) stands over <what>`. It is never gated on a dev
build (the e2e serves a production bundle): the e2e harness's auto-fixture `transferEndsGuard` (`tests/e2e/consoleTest.ts`)
turns it red on EVERY spec, so every spec that flies a token witnesses the law. An object end cannot print it by
construction (gone means not flown). Every flight's ends are named in the trail (`flight:ends {born, end}`).

## 5. Degrades and their names

`TransferDegradeReason`: `no-source` (no visible source at the run's start) · `no-destination` (no visible destination,
not detachable) · `no-stage` (the layer is not mounted) · `stalled` (the wave's safety) · **`source-gone`** (the source
vanished before the token's birth) · **`destination-gone`** (the destination vanished on the final approach and nothing
stands in). Every degrade ticks the counter (`onArrive`) — late, never lost.

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

Laws: `.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE (… AND LIVE), `.claude/rules/animations.md` §
Landing rects are RESTING rects. Ledger: section BW (`docs/claude/gameplay-polish-ledger.md`).
