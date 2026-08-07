# The COLONY FOCUS STAGE — the detail scene of the colony workspace

`ConsoleColonyFocusStage.vue` + `consoleColonyFocusMotion.ts` + the
`.con-colfocus` block in `console.less`. The workspace's DEEPER state for ONE
colony, reached from the tile grid by A (act) or X (inspect). The crumb above
already says «КОЛОНИИ › <колония> › <ЭТАП>», so the stage never titles itself.

This document is the contract for the iteration-3 rework. What it replaced —
and why — is stated in each section, because every rule here exists to stop a
specific regression from coming back.

---

## 1 · COMPOSITION — three columns, one reading order

```
HERO                MAIN — ONE 7-COLUMN GRID                    RESULT
┌────────────┐  ┌───────────────────────────────────────────┐  ┌─────────────┐
│  planet    │  │ ТОРГОВЫЙ ТРЕК                              │  │ ИТОГ        │
│  + orbital │  │ ┌──┬──┬──┬──┬──┬──┬──┐                     │  │ ─ награда   │
│    berth   │  │ │ 1│ 2│ 3│ 4│ 5│ 6│ 7│  reward per level   │  │ ─ владельцам│
│  ACTIVE    │  │ │▓▓│ ●│ ⌾│ ⌾│ ⌾│ ⌾│ ⌾│  guard · marker    │  │ ─ оплата    │
│  what it is│  │ └━━┩▌ └──┴──┴──┴──┴──┘  ▌= the STOP        │  └─────────────┘
│  fleet line│  │    ╿ ВОЗВРАТ            (mechanism lane)   │
│  verdict   │  │ ┌──┴─┬────┬────┐                           │
└────────────┘  │ │cube│    │    │  berths — column-aligned  │
                │ └────┴────┴────┘                           │
                │ СПОСОБ ОПЛАТЫ / brief                      │
                └───────────────────────────────────────────┘
```

**The surface is a DENSE PANEL, not a stretched one** —
`height: min(100%, var(--colfocus-h))` + `align-self: center`. The scene is a
dossier: it is sized by its own composition and centred in the band, so a tall
host gives it air AROUND it instead of a hole inside it.

**The height is a TOKEN, per MODE, and the TV profile overrides the token.**
27.5rem for an action, 19.5rem for inspect (no configuration → a shorter panel
instead of an empty half), 32.5rem / 21rem on TV. A panel that re-measured
itself every time a sub-editor opened would move the layout under the player's
thumb — but a panel sized for the BASE row height is exactly what drew a
scrollbar over three payment options on TV, where every row is
`--con-hit-min` (3.2rem) tall.

**The two OBJECT zones never shrink** (`flex: 0 0 auto` on `__trackzone`,
which now owns both grid rows). The configuration is the shock absorber — it is
the one zone that legitimately scrolls (`ConsoleScrollArea`), so it takes the
squeeze. Crushing the berths clipped their labels and the marker rail.

---

## 1b · ONE FUNCTION PER LAYER (the anti-duplication contract)

The same fact used to live in three or four places at once. Each layer now has
exactly one job, and a layer that already states something must not be echoed:

| layer | states | must NOT state |
| --- | --- | --- |
| TRADE TRACK | every level, its reward, the current position, the protected positions and the return stop | anything about the result |
| BERTHS | occupancy, owner, and the position each one HOLDS | the reset number, the owner rate |
| RESULT | «what happens if I confirm NOW» — one card per source of value | rules, the return point, the colony's standing rate |
| STATUS RAIL (overview) | identity + the EXCEPTION (a blocked reason, a standing offset) | rewards / owner bonuses already printed on the tile |

On the OVERVIEW the same contract shortens the tile: the status band keeps its
reserved height (the fixed-grid rule — a reason must never shift the rows above
it) but draws its divider ONLY when there is a status, so a calm tile reads the
band as its own bottom air instead of a rule over emptiness.

Removed by this contract: the «ПОСТРОЕНО ЗДЕСЬ N → ТРЕК ВЕРНЁТСЯ НА M» chips,
the «Каждая колония поднимает точку возврата на 1» caption, the per-berth
«⟲ N» chips, the «КАК ЭТО РАБОТАЕТ» panel, the build result's track-return and
future-owner-bonus groups, the owner-bonus block in TRADE mode, the overview
rail's reward/bonus restatement, and the per-tile «Доступна торговля» line.

## 2 · THE RETURN BASE — the colony-count rule, DRAWN

The rule: **after a trade the track falls back to the number of colonies built
there** (`Colony.trade()` → `trackPosition = colonies.length`). It is the
reason building is worth more than its one-off grant, and the old stage stated
it only as a line of prose nobody read.

It is not written down anywhere any more. It is BUILT, out of one shared
geometry:

**The track and the berths are ONE 7-column grid** (`--track-gap`,
`--track-cell` on `__trackzone`; `display: grid; grid-template-columns:
repeat(7, 1fr)` on both rows). Berth `i` therefore stands under track cell `i`,
and that is literally the rule — an occupied berth PROTECTS that position.

Three physical objects say the rest:

1. **The GUARD** (`__xcell-guard`) — an amber bar laid across the foot of every
   protected cell. It bridges the column gap to the RIGHT, so consecutive
   guards fuse into ONE rail rather than reading as separate chips; the
   protected cell's socket closes to a solid amber block (the marker cannot
   seat there) and the cell takes an amber rim.
2. **The LATCH** (`__berth-latch`) — a vertical bolt from the occupied berth up
   through the mechanism lane into the guard above it. «This colony holds that
   position» is one continuous object.
3. **The STOP** (`__stop`) — a post + foot flange standing on the boundary of
   the first UNPROTECTED cell, riding `--stop-col` with a transform-only
   transition. One word, `Return point`, sits under it in the mechanism lane —
   never over a game cell.

Build preview adds a mint ghost stop one cell further right and a
`--willprotect` ring on the cell about to be taken.

**The mechanism lane** is the ~0.8rem band between the track and the berths:
the latches run through it, the stop names itself at its left end and the
berth row's ONE word («МЕСТА КОЛОНИЙ») sits at its right end. Nothing is ever
written over a track cell or a berth.

Reading it: one colony → cell 1 is held → the stop stands on cell 2 → the
marker can never return past 2. Verified geometrically by the probe
(`stopLeft === cellLefts[protectedCount]`, berths column-aligned).

⚠️ **The number comes from `colonyTradePlan.trackResetPosition()`**, never from
an inline expression: a presentation that teaches a rule must read the rule
from the same place every other surface does. Guarded by
`tests/client/components/colonies/colonyTradePlan.spec.ts`.

---

## 3 · SEATS — why the flying objects are the size they land at

Two directors fly a physical token onto this stage. Both used to compute their
size from a CONTAINER and a magic fraction, which is only ever right for one
container:

| Anchor | Published by | Consumed by |
| --- | --- | --- |
| `data-colony-track-cell` on `__xcell-seat` (a `.8rem` round chip) | the stage AND the overview tile | `ConsoleColonyTradeLayer.runTrackGlide` |
| `data-colony-build-slot` + `data-colony-build-seat` on `__berth-seat` (a 44 px box) | the stage AND the tile (32 px) | `consoleColonyBuild.measureBuildSlot` |

**The SEAT is the contract.** An anchor that declares `data-colony-build-seat`
IS the seated token's own box, so the proxy is `rect.h × 1` — born at the size
it will rest at, centred where the real token centres (`colonyBuildState.cubeFactor`
is `1` for a seat, the legacy `CUBE_SLOT_F` for a bare cell). Before this the
build cube flew at **64 px into a 24 px seat** (2.67×, a visible pop at the
handoff) and landed ~9 px low because it centred on the berth RECT, under the
berth's name label. The marker was the same story: `size = min(cellW, cellH)`
of a stretched flex cell made a crisp dot on the tile and a blob on the stage.

⚠️ Never give the token inside a seat a different `:size` from the seat's box.

---

## 4 · ANCHOR RESOLUTION — a MEASURED ladder, never `a ?? b`

Every anchor exists twice while the stage is up: on the stage and on the
PARKED overview tile (`visibility: hidden` + a GSAP recede transform — a full
layout box that measures fine and is geometrically wrong).

`??` falls through only on a MISSING element, so a stage anchor that exists but
has collapsed (a fold in flight, a host parked behind an embed) POISONED the
lookup: the still-visible tile was never tried, `stableRect` polled 40 frames
against a dead node and the scene silently degraded. Every consumer now walks a
ladder and takes the first candidate with a real box:

* `ConsoleColonyTradeLayer.pickAnchor()` — covers, chips, marker cells;
* `ConsoleTradeFleetLayer.berthEl()` — the orbital berth;
* `consoleColonyBuild.buildSlotEls()` — the build seat.

The stage's launch cells are **keyed by colony name**
(`[data-colony-trade-source="Luna"]`) — the stage shows one colony, but an
unkeyed match fires for whichever it happens to be showing.

**They are TIGHT.** The trade income leaves the reward VALUE
(`__rvalue`), the owners' bonus leaves the berth zone that pays it — never a
whole result section, or the chips read as "born somewhere in that area"
instead of "born from that number".

---

## 4b · BUILD CHANGES THE MECHANISM (the signature commit)

A build is not «token → slot → reward». It changes how the track will behave
for the rest of the game, and the commit says so, in this order:

1. the destination berth is ringed and pulsing before the press (the other two
   dim — `--build` mode);
2. the cube flies and docks at its exact seat size (§3);
3. **the LATCH beat** — `--latching`, driven by the build transaction's own
   `landed`/`done` phase (never a timer), slams the guard bar across the newly
   held cell and shoots the bolt down into the berth;
4. the STOP slides one cell right (transform transition on `--stop-col`);
5. the build grant flies;
6. **the completion settle**, then the screen moves forward.

## 4c · COMPLETION — settle, then FORWARD ONLY

`COMPLETION_SETTLE_MS = 300` (`ConsoleColoniesSection`). Closing on the same
frame the last physical change lands means the player never sees what it was.
It is a DWELL, not a gate — nothing is being waited for, so there is no
completion signal to ride — and it is skipped while an outcome claim is live
(a follow-up owns the screen; completion then belongs to the claim's own
falling edge, watched on `outcomeState.sourceCard`).

After the settle the section emits `flow-complete` and the shell routes
**forward**: an embedded host or a live task surface continues the sequence,
otherwise the field. A committed action never travels back through the
configuration surface it was made on.

## 4d · THE FOLLOW-UP IS BORN INSIDE THE STAGE (Pluto)

Pluto's trade AND build deal cards, so both end in a `CardDrawReveal`. Three
things make that one continuous scene instead of «cards flying over an old
screen that then vanishes»:

1. **The zone lives in the STAGE** — `.con-colfocus__outcome`
   (`data-outcome-zone` + `data-embed-slot="colonies-focus-reveal"`),
   absolutely positioned over the WORKING AREA and leaving the hero column
   standing, so the colony never disappears from under its own payout.
   `ConsoleColoniesSection` is the ONE writer of `setWorkspaceOutcomeSlot` and
   points it at the stage's zone while the stage stands, at its own otherwise.
2. **The shared phrase** — `armOutcomeOriginFrom(mainEl)` at the commit, then
   `playConfigRelease` → `playOutcomePhase` → `playOutcomeContent`
   (`consoleActionOutcomeMotion` — the blue-action flow's own module, extended
   with a rect-arm rather than forked). The released configuration stays
   MOUNTED and recedes to 16 % opacity: unmounting it would kill the release
   mid-tween and leave the zone nothing to open out of.
3. **The destination exists before anything moves** — the zone is rendered from
   claim time, so the cards land in a surface already on screen.

⚠️ **The panel keeps the ACTION height while handing** (`--handing`). Past the
commit the server takes the pick away and `presentMode` re-derives to
`inspect`; without the override the panel shrank by a third UNDER the payout,
the reveal's strip lost ~150 px and every card was cropped by its slot.

**Three defects made this look like a legacy modal — none of them was legacy:**

| # | defect | fix |
| --- | --- | --- |
| A | `onColonyBuildConfirm` never called `claimWorkspaceOutcome('colonies', …)`, so a Pluto BUILD draw had no claim and teleported to `body` | claim it, gated on `colonyBuildDrawsCards(metadata, slot)` — structural, from the colony's own benefit |
| B | `revealHeldForWorkspace` knew only `workspaceClaimsDrawReveal`, so a claimed COLONY payout whose zone was one tick late mounted full-bleed | hold for either claim |
| C | the come-home watcher required `colonyTradeState.active` AND `source.trade`, which a build's draw never has (`Colony.tradeRevealTag` skips `benefit === 'build'`) | added `colonyPayoutIncoming`, keyed on the CLAIM |

The discard itself was never a modal: `type:'card'` over the whole hand routes
to `handSelect` (the hand carousel in select mode), and `MODAL_INPUT_TYPES`
does not contain `'card'`, so the legacy stack cannot render it at all.

## 5 · MOTION — space, then objects, then WORDS

`consoleColonyFocusMotion.ts`, in the workspace-descend grammar:

| beat | at | what |
| --- | --- | --- |
| RELEASE | 0 | the pressed tile's own content dissolves in place |
| RECEDE | 40 | the grid steps back into the press point |
| UNFOLD | 70 → 430 | the surface's clip opens from the tile's rect |
| CARRY | 70 / 110 / 150 | planet · track · berths FLIP from their compact twins |
| **REVEAL** (`[data-unfold-item]`) | 250 | the structural groups surface from inside |
| **LATE** (`[data-unfold-late]`) | 410 | labels, numbers, notes, the verdict |

**The two waves are the whole rework.** The stage published NO `[data-unfold-item]`
at all before, so the REVEAL beat animated nothing: every word was at full
opacity from the first frame while the panel was still clipped to a tile-sized
window. That is the «резко / текст сразу» the iteration had to remove.

Measured on the real flow (1280×720): the surface finishes opening at ~460 ms,
structure is legible at ~330 ms, **text at ~490 ms** — after the geometry has
stopped. The late wave's stagger is CAPPED (`LATE_SPREAD_S`) so a colony with
many labels never takes longer to open than one with few.

Both waves are hidden with `gsap.set(autoAlpha: 0)` in the enter hook (which
runs before the first paint, `:css="false"`), and **restored by both cancelled
hooks** — a killed timeline never runs its `clearProps`, and an interrupted
entrance must not cost the player the content.

B reverses the same phrase: fine print lets go first, then the structure, then
the panel folds back into the tile it opened from.

---

## 6 · RESOLUTION ON THE STAGE

The confirm does NOT fold the stage (`ConsoleShell.onColonyTradeComposerConfirm`
only calls `holdFocusStage()`): the fleet docks at the hero planet's orbital
berth, the reward chips leave the tight value, the marker glides along the
expanded rail and the section auto-folds on the transaction's own falling edge.

**The commit boundary pins the presentation** (`heldView`): mode, availability
AND the chosen payment path. The server takes the options away the instant it
answers — blanking the config zone there left a hole under a flying reward and
read as the screen forgetting the decision the moment it was taken. The pinned
row renders `--locked` (chosen, no longer a control) and the «СПОСОБ ОПЛАТЫ»
heading belongs to the rows, not to the mode.

The stage also honours the beats the overview tile always had and the stage
silently dropped: `--gliding` dims the resting marker while the proxy flies
(one physical object on screen, never two) and `--settled` plays the landing
glow on the cell the glide finished on.

---

## 7 · MODES

One scene, genuinely different priorities:

* **trade** — payment paths lead the configuration; the result column is the
  trade outcome by source.
* **build** — the BERTHS come first (`order: -1`), the destination pulses, the
  non-destination berths dim, the rail shows the `+1` ghost and the result
  column states the grant, the new colony, the future owner bonus and the
  return-base move.
* **inspect / unavailable** — NO configuration block and NO manual. The
  physical scene IS the dossier; the panel is simply shorter. A «how it works»
  panel appeared exactly when the player could not act, which made the screen
  change genre at the worst moment.
* **pick** — the server's verb, plainly.

---

## Where things live

| Concern | File |
| --- | --- |
| Markup + state | `src/client/components/console/ConsoleColonyFocusStage.vue` |
| Entrance / fold choreography | `src/client/console/consoleColonyFocusMotion.ts` |
| Styles | `src/styles/console.less` (`.con-colfocus`), `console_tv.less` |
| The reset rule (pure) | `src/client/components/colonies/colonyTradePlan.ts` |
| Build cube transaction | `src/client/console/colonyBuild/consoleColonyBuild.ts` |
| Trade transaction | `src/client/console/colonyTrade/consoleColonyTrade.ts` |
| Probe (visual + motion evidence) | `tests/e2e/console-colony-focus-probe.spec.ts` |
| Pluto embedded-payout guard | `tests/e2e/console-colony-pluto-embed.spec.ts` |
