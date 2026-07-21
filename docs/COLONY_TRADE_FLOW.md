# Colony trade — the premium reward transaction (console-native)

One colony trade presents as ONE ordered story, bound to a server-issued
`tradeId`:

```
confirmTrade (composer X)
→ armColonyTrade + armTradeFleet + submitBatch      (client-armed, input locks)
→ trade fleet flight → DOCK                          (existing consoleTradeFleet gate holds the commit)
→ COMMIT: payment delta chips fire;                  (WaitingFor.seedRewardHolds seeds the panel
   reward metrics HIDDEN (panel reward hold),         reward hold + detectColonyTrade froze the
   traded colony's track FROZEN at pre position       track display in the same sync block)
→ wave 1 «Награда за торговлю»: income chips /       (chips: consoleResourceTransfer, arrival auto,
   card covers physically leave the tile's            touchdown → releasePanelRewardHold → delta chip;
   «ТОРГОВАТЬ» cell                                   covers: ConsoleColonyTradeLayer)
→ wave 2 «Бонус колонии»: the viewer's own per-cube
   bonuses leave the «БОНУС» cell (one flight PER
   cube — countable, staggered)
→ ONE merged reveal modal (1/N) for ALL cards of
   the trade (the SERVER merged the batches by
   tradeId; segments keep the income/bonus split)
→ confirmAllReceivedCards (take / take all → hand intake)
→ the white marker GLIDES LEFT to the reset cell     (only after the server's own reset committed —
   cell-by-cell impulse, settle                       Colony.handleTrade's finalizer runs at
→ «4/7» flips + «ТОРГОВАТЬ» value morphs             DECREASE_COLONY_TRACK_AFTER_TRADE, i.e. after
   in the SAME beat (presented position releases)     every reward including interactive bonuses)
→ finalColonyPulse → unlockInput → done
```

## Server: the atomic reward manifest

- **`ColonyTradeManifestModel`** (`src/common/models/ColonyTradeManifestModel.ts`) —
  built in `Colony.handleTrade` BEFORE any grant: `tradeId`
  (`${colony}:g${generation}:a${gameAge}`), trader, `preTradeTrackPosition`
  (the income position, post-offset), `postTradeTrackPosition` (the reset
  target; == pre when the trade doesn't reset), the income grant, the
  per-cube colony-bonus grant and the cube owners in slot order (a selfish
  trade redirects every cube to the trader). Lives on the TRADING player,
  self-only in `PlayerViewModel.colonyTradeManifest`, transient (never
  persisted). Deliberately NOT cleared in `Player.process()` — a batched
  trade replays several inputs through it before the response is built; the
  next trade overwrites it and the client de-duplicates by `tradeId`.
- **Trade-tagged reveals** — every card draw granted inside the trade window
  (`Colony.activeTradeId`, handleTrade → the finalizer) stamps
  `source.trade = {tradeId, role: 'income'|'bonus'}` onto its reveal source.
  `Player.enqueueCardDrawReveal` MERGES a same-trade draw into the still-
  pending batch (`tradeSegments` keeps the per-role split), so ONE trade =
  ONE reveal modal / ONE acknowledgement. A draw resolving after the player
  already confirmed the earlier cards (Pluto's rules-accurate
  draw→discard→draw pairing) honestly starts a new batch.
- **The track reset needs no new sequencing** — upstream already defers it at
  `Priority.DECREASE_COLONY_TRACK_AFTER_TRADE`, AFTER the income and every
  colony bonus (including their prompts). The manifest just exposes the pre /
  post positions so the client can present that same order.
- Card COUNTS in the manifest are the plan; the reveal batches are the actual
  (a short deck yields fewer covers, an empty deck yields none). Resource
  grants never fail, so for them plan == actual.

## Client: the orchestrator (`src/client/console/colonyTrade/`)

- `colonyTradeModel.ts` — PURE (server-runner tested): manifest grant →
  `ResourceTransferSpec`s, per-cube bonus specs (never merged — countable),
  the panel-hold seed list, the cover launch plan (income wave → gap → bonus
  wave), the track glide plan.
- `consoleColonyTrade.ts` — the reactive orchestrator: arm (composer
  confirm) / detect (WaitingFor, claims the manifest ONCE per tradeId +
  freezes the presented track) / seed (inside `WaitingFor.seedRewardHolds`,
  same sync block as the commit) / `runColonyTradeRewards` (the chip waves)
  / reveal-batch claim vs the deck-draw scene / the three-gate conclusion
  (`chips done` ∧ `staged reveals confirmed` ∧ `reset committed`) → glide →
  settle → unlock. Phase-aware input lock (`isColonyTradeInputLocked` — FREE
  during `awaiting` so a Pluto discard between bonus draws is never wedged)
  + an `'colony-trade'` animation-hold supplier. Dev journal:
  `[colony-trade] …` lines on every transition.
- `colonyTradeDirector.ts` — GSAP: per-card cover flight (born at the cell,
  premium tumble-open riding the arc, pixel-perfect slot landing), covers
  handoff, the white-marker rail glide (per-cell impulse, settle snap).
- `ConsoleColonyTradeLayer.vue` — the app-level stage (covers + marker),
  claims trade batches pre-flush, degrades honestly when anchors are gone.
- `ConsoleColonyTile.vue` — `presentedColonyModel` for every track read, the
  launch anchors (`data-colony-trade-source` / `data-colony-bonus-source` /
  `data-colony-track-cell`), the «4/7» ConsoleFlipValue and the keyed
  «ТОРГОВАТЬ» morph + settle pulses. The focused summary reads the same
  presented helper.

## The invariants (the done-criteria)

1. Nothing reward-shaped appears before the fleet docks (the existing fleet
   gate holds the commit; the reward metrics additionally ride the panel
   hold until each touchdown).
2. The reward is read at the PRE-reset position (server truth — the manifest).
3. The reset is presented only after every reward is granted AND confirmed
   (server truth + the three-gate conclusion; the glide additionally waits
   for the COMMITTED drop, which for interactive bonuses arrives responses
   later — the transaction waits with input FREE).
4. Pluto covers are REAL card-backs leaving the exact interface areas; one
   cover per real card, staggered; income and bonus waves are visually
   distinct; all of one trade's cards land in ONE reveal (server merge).
5. Counters / hand / track change only at their visual commit (touchdown /
   intake landing / glide landing).
6. Reduced motion: no covers (the modal mounts with its stock entrance), the
   chips release instantly, the glide snaps — same order, same final state.
7. Reconnect / reload never replays a presented trade (`armColonyTrade` only
   fires from the live confirm; `seenTradeIds` guards replays in-session; a
   lingering manifest without an arm is ignored).
8. A bot's / opponent's / Titan-Floating action trade never engages the
   orchestration (never armed) — the standard commit path plays; the
   viewer's own bonus batch from a FOREIGN trade stays with the deck-draw
   scene (those cards honestly come off the deck).

## Guards

- Server: `tests/colonies/ColonyTradeManifest.spec.ts` (manifest fields,
  merge + segments, pairwise Pluto ordering, reset-last, selfish, partial
  trades, no-decrease, exhausted deck).
- Client: `tests/client/components/console/colonyTradeModel.spec.ts` (pure
  mapping / waves / glide) + `consoleColonyTrade.spec.ts` (lifecycle,
  three-gate conclusion, claims, dedupe, holds release on abort).
