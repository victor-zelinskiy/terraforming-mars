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
HERO (12rem)        MAIN (flex)                                 RESULT (13.2rem)
┌────────────┐  ┌───────────────────────────────────────────┐  ┌─────────────┐
│  planet    │  │ ТОРГОВЫЙ ТРЕК   ПОСТРОЕНО 0 → ВЕРНЁТСЯ НА 1│  │ ИТОГ        │
│  + orbital │  │ ┌──┬──┬──┬──┬──┬──┬──┐                     │  │ ─ награда   │
│    berth   │  │ │ 1│ 2│ 3│ 4│ 5│ 6│ 7│  cells + reward     │  │ ─ владельцам│
│  ACTIVE    │  │ │ ⌾│ ●│ ⌾│ ⌾│ ⌾│ ⌾│ ⌾│  MARKER RAIL       │  │ ─ доп.      │
│  what it is│  │ └──┴──┴──┴──┴──┴──┴──┘                     │  │ ─ оплата    │
│  fleet line│  │ ──▲⟲······   the RETURN BASE               │  └─────────────┘
│  verdict   │  │ МЕСТА КОЛОНИЙ  [berth][berth][berth][бонус]│
└────────────┘  │ СПОСОБ ОПЛАТЫ / brief / rules              │
                └───────────────────────────────────────────┘
```

**The surface is a DENSE PANEL, not a stretched one** — `height: min(100%, 30rem)`
+ `align-self: center`. The scene is a dossier: it is sized by its own
composition and centred in the band, so a tall host gives it air AROUND it
instead of a hole inside it. The height is a TOKEN, not the content's: a panel
that re-measured itself every time a sub-editor opened would move the whole
layout under the player's thumb.

**The two OBJECT zones never shrink** (`flex: 0 0 auto` on `__trackzone` /
`__berthzone`). The configuration is the shock absorber — it is the one zone
that legitimately scrolls (`ConsoleScrollArea`), so it takes the squeeze.
Crushing the berths clipped their labels and the marker rail.

---

## 2 · THE RETURN BASE — the colony-count rule, DRAWN

The rule: **after a trade the track falls back to the number of colonies built
there** (`Colony.trade()` → `trackPosition = colonies.length`). It is the
reason building is worth more than its one-off grant, and the old stage stated
it only as a line of prose nobody read.

It is now drawn three times over, in the same colour (amber):

1. **The rail** under the track (`__resetrail`): a bracket from position 1
   through the built count, the **⟲ anchor with a caret pointing UP at the exact
   cell** the marker returns to, and the distance it will travel back as a
   dashed span. Column geometry mirrors the track (same flex basis, same gap),
   so every notch sits under its own cell.
2. **The chips** in the track's zone head: «ПОСТРОЕНО ЗДЕСЬ N → ТРЕК ВЕРНЁТСЯ
   НА M», with a `→ M+1` preview in build mode.
3. **The berths**: each one advertises the return step it would buy («⟲ 2»,
   «⟲ 3», «⟲ 4»), which is what turns the rule from something deduced into
   something read.

In **build mode** a mint `+1` ghost stands one cell further right and the
result column carries «ТРЕК ВЕРНЁТСЯ НА 1 → 2» as its own group.

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
* **inspect / unavailable** — no payment skeleton: the colony's OWN RULES take
  the configuration room, one row per rule led by its real glyph.
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
