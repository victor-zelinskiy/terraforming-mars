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
→ ONE reveal modal for the cards of THIS payout
   (the SERVER merged the same-response batches by
   tradeId; segments keep the income/bonus split);
   the colony bonus gets ONE ZONE PER COLONY
   («Бонус колонии 2/3»), exactly one live — later
   colonies show a face-down placeholder, their card
   is not drawn yet
→ confirmAllReceivedCards (take / take all → hand intake)
→ [PLUTO] the live zone's OWN «Выбрать карту для
   сброса» → the hand overlay, single-select → back
   into the modal, where the next colony's card turns
   face up; repeated per colony
→ the white marker GLIDES LEFT to the reset cell     (only after the server's own reset committed —
   cell-by-cell impulse, settle                       Colony.handleTrade's finalizer runs at
→ «4/7» flips + «ТОРГОВАТЬ» value morphs             DECREASE_COLONY_TRACK_AFTER_TRADE, i.e. after
   in the SAME beat (presented position releases)     the TRADER'S OWN rewards including their
→ finalColonyPulse → unlockInput → done               interactive prompts — see DETACHED DELIVERY)
```

**THE TRADER NEVER WAITS FOR SOMEBODY ELSE'S CLICK (2026-08-23).** A colony
bonus owed to a player OTHER than the trader is a **DETACHED DELIVERY**
(`Colony.isDetachedBonusDelivery`): it queues at `Priority.BACK_OF_THE_LINE`
on its own recipient — **after** the trade's finalizer — instead of resolving
inside `GiveColonyBonus`'s drain. Before this, an opponent's Pluto discard or
Titan floater pick froze the whole deferred queue: the trader's own bonus draw
had not even happened, their trade-income prompt (prio 20) and the track reset
(prio 22) sat behind an opponent's click, the pre-collected batch answers were
silently dropped (`PlayerInputBatch` breaks at a foreign `waitingFor`), and
the trader stood in a finished interface for up to the 60 s ceiling. Now the
trader's whole chain — income, their own cubes' bonuses (per-cube pairing
intact), their mandatory prompts, the reset — runs contiguously inside their
own request/response chain; opponents' bonuses resolve after it, each
recipient sequentially (per-cube `draw → discard` pairing preserved by the
SUPERPOWER discard inside each detached pair). Tabletop-faithful: simultaneous
effects resolve active-player-first. Guards:
`tests/colonies/colonyTradeDetachedDelivery.spec.ts`.

**…and the pause is BROADCAST.** When the deferred queue pauses on any
player's prompt (`DeferredActionsQueue.run`, `GiveColonyBonus`'s inline
prompt), the server emits the realtime invalidation (`game.notifyStateChange`)
— previously nothing did (the only broadcast sites lived in
`Player.takeAction`, which a paused queue never reaches), so an off-turn
recipient learned about their prompt only on the healthy-socket ~20 s fallback
poll. Guard: `tests/realtime/QueuePauseBroadcast.spec.ts`.

**THE PRE-TRADE ADVANCE IS ITS OWN LEG (2026-08-12).** A trade-offset card
(«Торговая колония») moves the track FORWARD before the reward is read
(`Colony.trade` → `increaseTrack` → the manifest). The marker used to simply
appear further along; it now glides RIGHT first — the same physical language
as the closing reset, one mechanism with two legs
(`colonyTradeState.glideKind` = `advance` | `reset`, `trackAdvancePlan` /
`trackGlidePlan`). The origin is the cell the player pressed (captured at
`armColonyTrade`), the destination is the manifest's `preTradeTrackPosition`
— so SEVERAL offset cards are one summed move by server truth, never a client
sum of card behaviours — and the leg is bounded by its own net, so an
unmeasurable track never holds the payout.

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
  ONE reveal modal / ONE acknowledgement per response. A draw resolving after
  the player already confirmed the earlier cards (Pluto's rules-accurate
  draw→discard→draw pairing — each colony in its own batch) honestly starts a
  new batch.
- **The track reset ends the TRADER's own chain** — deferred at
  `Priority.DECREASE_COLONY_TRACK_AFTER_TRADE`, AFTER the income and the
  trader's own colony bonuses (including their prompts), and BEFORE every
  detached foreign delivery (`BACK_OF_THE_LINE`). The committed reset — the
  client transaction's own end — therefore always arrives inside the trader's
  own response chain, never behind an opponent's answer. The manifest exposes
  the pre / post positions so the client can present that same order.
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

## THE CARD-TARGET STEP — «куда положить награду» is a LEVEL, not a list (2026-08-12)

A trade whose reward lands on a card (Titan's floaters, Miranda's animals, the
Venus «any resource» rewards — trade income AND owner-bonus picks alike) asks
the player to point at a physical card. That decision is the SAME decision the
blue-action and play composers already own a surface for, so the colony stage
reuses it instead of a text list in the configuration column:

- **The step is a DEEPER LEVEL of the same flow.** The decision row reads
  «Цель торговой награды» with the honest `current → resulting`; A descends —
  the track, the configuration and the summary rail RELEASE in place
  (`--targeting`, short and symmetric: this is reversible), the crumb's tail
  advances «…› ТОРГОВЛЯ» → «…› ЦЕЛЬ НАГРАДЫ», and the SHARED
  `ConsolePlayedTargetStep` unfolds over the working area. The hero planet
  never moves — it is the flow's spatial anchor. Both doors (Колонии and a
  card action's trade) host the identical step, because both stand on the one
  focus stage.
- **The model is the shared one** (`colonyTradeTargetStep.ts` →
  `buildColonyTradeTargetModel` → `consolePlayedTargetModel`): the server
  preview's own candidate list, physical faces, ownership, per-candidate
  `before → after` and the resource badge with `showZero`. Deliberately NO
  `sourceCardName`: no card stands on this stage (the hero is the planet), so
  the «ЭТА КАРТА» proxy never appears here.
- **Grammar**: d-pad = the measured cells (`stepPlayedTargetFocusAt`), A =
  choose (capture + return to the review), X = inspect the focused candidate
  fullscreen, B = one level back — and B after a re-entry through «Изменить
  выбор» KEEPS the previous pick (closing the step is never losing the
  choice). The capture feeds the SAME batch slot as before
  (`{type:'card', cards:[name]}`) — presentation changed, the wire did not.
- **Invalidation is the preview's.** `ConsoleColoniesSection` re-pulls the
  focused colony's preview on every game-state version (`gameAge|undoCount`,
  quiet while a trade is resolving), and a fresh preview PRUNES captures it no
  longer offers (`pruneStaleCaptures`) — a stale target is never shown as
  chosen and never submitted; the confirm re-locks until re-picked.

### BUILDING ASKS THE SAME QUESTION (2026-08-13)

A colony whose PLACEMENT bonus lands on a card (Titan: «положи 3 аэростата на
любую карту») used to drop that prompt on the player AFTER the cube had
landed. It is the same decision, so it rides the same machinery end to end:

- **the server offers it** — `ColonyTradePreviewModel.buildFollowUps` (the
  next free slot's bonus through the very same `benefitFollowUp`, role
  `buildBonus`; absent for a full colony and for every bonus that resolves
  without asking). One preview per colony serves both intents;
- **the stage composes it** — `buildSteps(preview)` produces the same
  `cardTarget` step, so the same decision row («ЦЕЛЬ БОНУСА ПОСТРОЙКИ»), the
  same embedded picker and the same `canConfirm` gate apply. A build that
  composes speaks the trade's grammar (A opens the decision, X builds); a
  build with nothing to ask keeps its single «A Построить»;
- **the batch answers it** — `[{type:'colony'}, {type:'card', cards:[…]}]`,
  truncated at the first uncaptured step exactly like the trade's;
- **the reward flies to it** — `armColonyBuild(..., targetCard)` →
  `buildRewardSpecs` emits a `card-resource` spec, so the placement bonus is a
  chip landing on the chosen card instead of a number that appeared.
  ⚠️ The build's presented scene takes the SUMMARY RAIL's column
  (`--carding-rail`), never the working area: its cube is landing in the berth
  row and both physical events must stay visible at once.

## THE PRESENTED TARGETS — the reward LANDS on the card, visibly

The confirm derives every card-resource DESTINATION once
(`colonyTradeCardDestinations` — picked targets AND the single-candidate AUTO
ones the server applies without a prompt, merged per card) and that one list
feeds BOTH consumers: the transfer flight's `ColonyTradeTargets` and the
stage's presented scene.

- At `holdPresentation` the stage snapshots the presented targets beside
  `heldView` and stands them over the MAIN area (`__cardland`, pose
  `--carding`) — the chosen card(s) are physically on stage from the commit,
  through the fleet flight, to the landing. The summary rail deliberately
  STAYS lit: the income value in it is the chips' launch anchor, so the player
  reads the whole flight «из награды → на карту».
- The transfer ladder resolves the presented card FIRST for the colony flow:
  `targetPointFor`'s card-resource rung
  `.con-colfocus [data-played-key] .pcard__res` aims the chip at the card's
  own stored-resource capsule — the touchdown IS the counter.
- **The counter is honest**: the face is fed a snapshotted model frozen at the
  pre-trade count (`presentedTargetModel`), ticking by exactly what has
  PHYSICALLY landed — `cardResourceLandings` in the transfer framework itself,
  bumped at every arrival path (flight, degrade, reduced motion, safety), so
  a TRADE reward and a BUILD bonus tick identically — with a re-keyed contact
  flash per touchdown. A multi-chip payout (two bonus cubes onto one card)
  ticks per contact; the store committing underneath can never tick it early.
- **⚠️ THE SCENE OUTLIVES ITS TRANSACTION.** A colony BUILD's transaction ends
  when the cube seats — several hundred ms before its floaters touch down — so
  neither the scene's visibility nor the pinned presentation may hang off
  `resolving`: the card vanished from under its own reward, and the panel
  re-derived to `inspect` and shrank by a third beneath it. The snapshot IS
  the proof of «past the commit»; it releases on its own landing + read beat
  (`CARDLAND_READ_MS`), immediately when a card payout takes the area over
  (Miranda), by a bounded net when a promised chip never came
  (`CARDLAND_NET_MS`), and at once on a refusal (nothing landed, nothing in
  flight) — no success scene without a success.
- **The conclusion waits for the scene**, twice over: `stageBusy` feeds
  `setColonyStageYielded` (the closing track glide never runs under the
  presented cards), and `colonyResolutionUi.cardSceneLive` gates the section's
  `completeFlow` — a colony may not route home while a reward is still
  arriving on a card.

## The STAGED BOT PATH (the field-report root cause — read before touching)

A trade that ENDS the human's turn carries the MarsBot's turns in its own
response, so `presentFreshBotTurns` intercepts `WaitingFor.fetchPlayerInput`
and RETURNS EARLY — the commit is buffered into the bot pipeline. Anything
detected only BELOW that block never runs on such a response. The trade
integration therefore lives ABOVE it (with the played-hero / patent-sale /
tile-hero gates): the fleet gate awaits the dock and `detectColonyTrade`
claims the manifest BEFORE the staged return; the staged branch releases the
fleet proxy (`endTradeFleet` on nextTick), and the reward waves start from
`noticeColonyTradeCommit` — the ConsoleShell playerView watcher that observes
EVERY commit path (the buffered bot commit, and a poll after a lost response,
where it also performs the FALLBACK claim without seeding — the chips then
fly as decoration over already-committed values, the honest degrade).
`colonyTradeClaimsReveal` additionally matches an ARMED-but-unclaimed
transaction by colony name, so the deck-draw can never grab a trade batch in
any claim-timing race. Known accepted compromise: in the staged path the
bot's turn cards present BEFORE the trade's reward waves (both ride the same
buffered commit — same as the tile-hero's staged reward beat).

## Pluto: one colony at a time, inside the reveal modal (2026-07-26)

Pluto's colony bonus pays **"draw 1, then discard 1"**, and by the rules EACH
colony resolves **separately and in full** before the next is revealed. A player
with three cubes answers three payouts in a row and must never see all three
cards before choosing what to throw away. (An earlier iteration of this fork
batched them into one draw-N/discard-N payout; that was a rules error and has
been reverted — do not re-introduce it.)

What the fork changes is only the PRESENTATION: the whole sequence happens
inside the reveal modal instead of arriving as detached discard prompts the
player cannot connect to the trade.

- **SERVER — unchanged rules, plus an ORDINAL.** `GiveColonyBonus` fans the
  bonus out per CUBE as upstream does (`MultiSet`, one entry per cube, drained
  one at a time), and Pluto's branch draws 1 and defers one
  `DiscardCards(p, 1, 1)` at `Priority.SUPERPOWER` — for the TRADER that puts
  the discard ahead of every other pending pair and of the trade's own track
  reset, and cube 2 only draws once cube 1 is finished. A recipient OTHER
  than the trader is a DETACHED DELIVERY: their whole pair queues at
  `BACK_OF_THE_LINE` (after the reset), the SUPERPOWER discard inside it
  still pairing draw → discard before the next detached pair. The one
  addition is `ColonyBonusOrdinal {index, total}` (which of the recipient's
  cubes is resolving), passed as `IColony.giveColonyBonus(player, true,
  ordinal)`.
- **The prompt is MARKED, never sniffed.** `ColonyBonusDiscardMeta`
  `{colonyName, index, total}` rides `BaseInputModel.colonyBonusDiscard` via
  `BasePlayerInput.markColonyBonusDiscard` (serialized centrally in
  `ServerModel.getWaitingFor`, carried by `DiscardCards`' `options`).
- **The OUT-OF-TRADE grant is the same family with NO segments.**
  ProductiveOutpost / Yvonne pay this bonus outside any trade window, so the
  draw is untagged and the batch carries `tradeSegments: undefined` while the
  discard marker rides as usual. The client's zone membership therefore has a
  structural fallback (`segmentlessZoneBatch` — marker + the batch's own
  colony source + exactly one card), or the card rendered BESIDE its own zone
  and the cardless active zone showed a false taken-✓ socket. An active zone
  with no entry now renders the empty socket WITHOUT the ✓, always.
- **CLIENT — one ZONE per colony, exactly one live.** `bonusZones(meta)`
  (`colonyBonusDiscardStep.ts`, pure) derives the whole strip from the marker
  alone — zones before `index` are `done`, `index` is `active`, the rest
  `future`. **Nothing is carried across reveal batches**: `index`/`total`
  already say where in the sequence we are, and each colony's card arrives in
  its own batch.
  - `future` zones show a **face-down placeholder**, not a card: the server has
    not drawn that card yet, so there is nothing to leak. It says "one more
    bonus is coming" and carries no actions.
  - the `active` zone owns **its own** discard button, directly under its card,
    locked (with an honest reason) until everything on the table is taken — on
    the trade's first payout that includes the trade income.
  - **always single-select** (`min = max = 1`); the generic hand overlay keeps
    its multi-select support for other mechanics, this flow just never uses it.
- **EVERY CARD OF THE PAYOUT TURNS IN THE AIR** (iteration 8 — the earlier
  face-down delivery + in-place `con-bonus-turn` flip is REMOVED). A
  destination that opened its card on the table drew that card's back while
  the cover was still carrying it — two objects for one card — and then
  played a second, differently-shaped turn. The zone renders its card exactly
  as the strip does; the flip chassis belongs to the take-in-place turn
  alone; and `--bonus-held` holds every BACK **and the zone's own furniture**
  (frame ring, floating caption, name bar) until the handoff — the zone
  MATERIALIZES as its card lands, never stands pressable-looking over an
  empty table while the covers are still flying.
- **Input during the flight is phase-locked** (`isColonyTradeInputLocked` —
  `cardScene` `fly | ascend | frame` swallow the pad), so no take can re-flow
  the strip under an airborne cover; the landing targets additionally stay
  still because the embedded fit DEFERS its re-solve while the cover scene
  owns the batch (`fitEmbeddedStrip`'s scene guard) and the outcome zone's
  entrance is opacity-only (`con-colfocus-outcome-in`).
- A fully taken batch is HELD on screen for its step (`holdRevealForFollowUp` /
  `releaseRevealFollowUp`); `singleCardMode` returns false whenever a discard is
  owed, so the 1-card FOREIGN-trade payout keeps the real modal (the headless
  fullscreen has nowhere to host a zone).
- **A TAKEN card leaves its EMPTY SOCKET, never its back.** The resolved zone
  renders `.con-reveal__bonus-socket` — a recessed, empty frame at the card's
  exact box plus the ✓ — because a card BACK there reads as a card still lying on
  the table. `future` zones keep a back (that IS a card, just not turned yet).
  Both placeholders are sized in **px** (320×460, `keep-px`): the premium face is
  a px design box and the slot's own `zoom` scales it, so a rem size would be
  scaled twice and stop matching its card.
- **⚠️ `stripCount` counts what the row HOLDS, not what is left to take.** On the
  untaken count the scale ladder stepped up as cards left and every remaining
  card visibly GREW. The taken card's socket and the future colonies' backs keep
  the row's width, so the card scale is fixed from the batch's first frame.
- **The row RE-CENTRES on transform, it never snaps.** The strip is a
  `TransitionGroup` (`con-reveal-shift`): survivors FLIP to their new centred
  positions (`--move`, transform only), while the taken card leaves the flow at
  once — its hand-intake proxy is already carrying it to the dock, so a leave
  animation would show the same card twice. This is on the strip itself, so it
  covers EVERY reveal (colony bonus, deck draw, board bonus), not just Pluto.
- **The foreign-trade case is the same code path**: the viewer's bonus draws are
  trade-tagged too, so their batch carries only `role: 'bonus'` segments — no
  income zone renders, and the sequence proceeds identically.

## The invariants (the done-criteria)

1. Nothing reward-shaped appears before the fleet docks (the existing fleet
   gate holds the commit; the reward metrics additionally ride the panel
   hold until each touchdown).
2. The reward is read at the PRE-reset position (server truth — the manifest).
3. The reset is presented only after the TRADER's every reward is granted AND
   confirmed (server truth + the three-gate conclusion; the glide additionally
   waits for the COMMITTED drop). The trader's own interactive bonuses
   (Pluto's discard between two bonus draws) arrive responses later inside the
   trader's OWN dialogue — the transaction waits for those with input FREE —
   but it NEVER waits on another player: foreign bonuses are detached behind
   the reset, and if a view still proves the queue parked on somebody else
   (an off-turn reaction wedged mid-trade), the transaction concludes to
   committed truth on a short named net (`TRADE_PARKED_NET_MS`) instead of
   freezing the screen (the old blind 60 s ceiling remains the backstop).
4. Pluto covers are REAL card-backs leaving the exact interface areas; one
   cover per real card, staggered; the whole payout is ONE CONTINUOUS DEAL —
   the bonus cover is its LAST card (one stagger + a short wave breath after
   the final income cover, `TRADE_WAVE_GAP_MS`), its fan peeling out beside
   the «БОНУС» cell while the income covers are still in the air, the waves
   still readable by their distinct source cells; all of one trade's cards
   land in ONE reveal (server merge). The stage's dissolve is keyed to the
   LAST wave's separation (`liftAnchor` in `ConsoleColonyTradeLayer`), so
   every wave leaves a still-lit source.
   4a. **The strip is ONE line while the covers fly.** The bonus zone's frame is
   decorative (`::before`, inflated outside the content box) — it used to be a
   PADDED box that sank its cards 1.1rem below the income cards (~44 px on a 4K
   TV), and the covers, which land on those rects, came down on a different line.
   `--bonus-held` additionally suppresses the focused slot's lift + 1.1× scale, so
   every cover lands pixel-exact and the focus eases in with the handoff instead of
   the row jumping.
   4c. **The modal veils on its FIRST render, not on the claim.** The claim rides
   `ConsoleColonyTradeLayer`'s pre-flush watcher, whose scheduler job is ordered by
   the LAYER's component uid — higher than the shell's, so the shell's render (which
   MOUNTS the modal) runs first and the modal gets one render with no veil classes:
   it paints frame, header, source chip and closer at full opacity, starts its
   entrance, and is then faded away by the arriving veil. That is the reported
   flash — a whole modal appearing for a beat before the cards fly. The veil
   therefore reads `colonyTradeWillDressReveal(source)` (active ∧ !reduced ∧
   `cardScene === 'idle'` ∧ claims-this-batch), which is true from the instant the
   batch exists; it hands off to `isColonyTradeRevealStaged` the moment the layer
   stages (`cardScene` leaves `'idle'`), and is bounded by the transaction's own
   lifetime. **Never gate a scene's veil on its own claim landing** — the claim is
   always at least one scheduler job behind the mount.
   4b. **The handoff crossfades, never dips.** Releasing the cards starts a
   160 ms opacity ramp UP on each card; fading the proxy out at the same instant
   ran two opposing ramps over the same pixels and the reveal visibly BLINKED as
   the cards arrived. `runTradeCoversHandoff` therefore holds the proxy opaque for
   `CARD_RELEASE_MS` first — keep it in step with the CSS transition.
4d. **The marker's return is the trade's FINAL animated beat** (official
   rules: the marker drops only after the rewards fully resolve). Two
   enforcements: `maybeAdvance` waits out the colony-bonus DISCARD flight
   (`cardDiscardColonyBonus` gate + falling-edge watcher), and the glide run
   itself waits for a STANDING track — every path cell rendered, honestly
   visible (`checkVisibility` incl. ancestor opacity) and geometrically at
   rest (`waitForStandingTrack`, bounded by `TRACK_STANDING_WAIT_MS`) — so
   the marker can never fly across a yielded working area, a hidden tile or
   a still-unfolding stage; past the net the values release with the instant
   commit and nothing flies.
5. Counters / hand / track change only at their visual commit (touchdown /
   intake landing / glide landing).
6. Reduced motion: no covers (the modal mounts with its stock entrance), the
   chips release instantly, the glide snaps — same order, same final state.
7. Reconnect / reload never replays a presented trade (`armColonyTrade` only
   fires from the live confirm; `seenTradeIds` guards replays in-session; a
   lingering manifest without an arm is ignored).
8. A bot's / opponent's trade never engages the orchestration (never armed) —
   the standard commit path plays; the viewer's own bonus batch from a FOREIGN
   trade stays with the deck-draw scene (those cards honestly come off the
   deck). ⚠️ **A card-sourced trade is NOT in that list any more** — see below.

## THE SECOND DOOR — a trade started from a CARD ACTION (2026-08-11)

«Хочу торговать» (Колонии) and «хочу использовать Летающую платформу»
(Действия карт) are two entry points into ONE action. After the door they are
the same flow: one server command, one payment model, one colony workspace, one
controller contract, one validation, one resolution. Only three things differ —
the entry CONTEXT, the header, and what B means before the commit.

- **SERVER — one implementation.** `TitanFloatingLaunchPad.action()`'s trade
  branch no longer spends a floater and calls `colony.trade` itself: it
  delegates to `TradeWithTitanFloatingLaunchPad`, the very `IColonyTrader` the
  trade prompt's fee picker offers. The two had already drifted — only the
  picker opened the colony EVENT SCOPE and carried the `'trade'` button label
  the orchestration keys on, so a trade taken from the card grouped differently
  in the journal and played none of the reward cinematic.
- **The branch DECLARES itself**: `ActionPreviewStep {kind:'colonyTrade', card}`
  (`actionPreviews.colonyTradeStep`) replaces the prose note. `card` names the
  payment path, matched against `OptionMetadata.card` — never a label.
- **CLIENT — the card door SUBMITS NOTHING.** `playActionCard` marks a card
  action used SYNCHRONOUSLY at the branch pick, so submitting first would spend
  the floater and the action before the colony was even asked for, and B would
  have nothing to go back to. So the console does not submit: the CTA becomes
  «Выбрать колонию», the colony workspace is pushed as a STEP of the
  card-actions frame (`card-actions ⊃ colonies`, `anchor: always`), the fee is
  pinned to this card's path, and the trade's own confirm is the single atomic
  commit — byte-identical to the Колонии entry.
- **The header is the only trace**: «ДЕЙСТВИЯ КАРТ › ЛЕТАЮЩАЯ ПЛАТФОРМА ›
  ВЫБОР КОЛОНИИ» → «› ГАНИМЕД · ТОРГОВЛЯ» → «› ПЛУТОН · ДОБОР КАРТ». No source
  card, no banner, no second chip — and the composer's hero column RECEDES while
  the step stands (`.con-composer--colonystep`), because a full workspace needs
  the whole room.
- **VISUAL PARITY IS THE POINT** — «я попал туда же, просто из другого места».
  The working zone must be pixel-for-pixel the screen «Колонии» gives (measured:
  scroll 3198 vs 3197, grid 3174 vs 3173, tile 1010 vs 1010 at 4K), and three
  things had to be true for that:
  1. **The composer's panel width cap does not apply to a HOSTING composer.**
     `:not(.con-composer--embed)` now also excludes `--colonystep`; without it
     the TV cap (58rem × the TV scale = 2320 px) took ~880 px off the zone —
     and because the colony fit is `min(scaleW, scaleH)`, the tiles lost a
     third of their width to a purely horizontal constraint.
  2. **The FLEET DOCK berths in the HOST header's TRAILING zone**
     (`colonyFleetBerth` — the host publishes a selector, the section
     teleports the one instance into it; the berth element lives in
     `ConsoleWsHead`'s `#trailing` slot, `.con-wshead__trailing`). That zone is
     the header's RESERVED RIGHT EDGE — the very cell the standalone «Колонии»
     header renders the dock in — so the ships sit at the same size, the same
     spacing and the same place for every entry point; the «N/M вариант» chip
     stays in the crumb-tail cell and simply yields while the step stands.
     ⚠️ The berth must be a REAL flex cell: it first shipped inside the
     crumb-tail's absolute shrink-to-fit box, whose width is 0 — the dock's
     `flex-wrap: wrap` then folded the fleet chips into a VERTICAL stack
     mid-line, the one visual divergence on the one screen whose whole point
     is «я попал туда же». A dock floating in the content area is equally
     wrong (spatial memory, plus a stolen row of grid height).
  3. **The composer's own chrome yields** — panel padding and the setup
     column's gap/centring are the SETUP layout's, and every row of them the
     host keeps is a row of colony tiles the player loses.
- **A FIXED FEE IS NOT A LIST.** With the entry locking the path, the other
  payment rows are not merely unpickable — they are unreachable, so they are
  filtered out (`visiblePayEntries` / `visibleDisabledEntries`), not dimmed. A
  menu whose every other item refuses the press is furniture. ⚠️ The filtered
  rows carry their ORIGINAL index: `payIdx`, the focus ring and the submit all
  speak the SERVER's option order, and a filtered list must never renumber it.
- **B is one logical level**: colony focus → colony selection → the card's
  variant, still selected, floater still on the card. Past the trade's commit
  the standard resolution owns B (collapse).
- **«СВЕРНУТЬ» mid-resolution suspends the EXACT instance (2026-08-12).** The
  frames park at full depth (`card-actions ⊃ colonies ⊃ hand`); what the
  frames cannot carry — the composer's descent — survives as the workspace's
  DESCENT DRAFT (`consoleCardActionsUi.draft`, module state, written at the
  descend and cleared only by a genuine fold/close), beside the entry lock
  (`colonyTradeEntryState`). RESUME has exactly two doors — the board-home
  restore card (A/B) and the notification CTA, both through
  `restoreDeferredTask` — and re-seats the whole chain: the mount-time
  decision is the pure `actionWorkspaceRestorePlan` (host-scoped: a claim is
  only ever adopted from `host === 'card-actions'` — adopting the colony
  resolution's claim is how «ДЕЙСТВИЯ КАРТ › ПЛУТОН › ПЛУТОН · СБРОС КАРТЫ»
  once stood over a browse body), and the composer republishes the colonies
  step zone from its own `mounted()` (the change-watcher cannot fire for a
  step that was already hosted before the mount). A chain whose descent
  cannot be rebuilt (a reload dropped the draft) FOLDS honestly — the
  mandatory gate re-announces and A rebuilds the plain colonies chain; a
  mixed surface is the one forbidden outcome.
- **A wheel-open beside the suspended flow is a FRESH instance.** `openSheet`
  never restores: «Действия карт» opened by hand while the resolution is
  parked is an ordinary clean browse (no Pluto crumb, no adopted claim,
  read-only via `actionBlockedReason` — «Сначала завершите текущее
  действие»), and closing it leaves the park untouched. The parked chain
  still `stackServes` the discard, so the leak detector stays quiet and the
  restore card remains the way back.
- Module: `src/client/console/colonyTrade/colonyTradeEntry.ts` (pure).
  Guards: `tests/client/components/console/colonyTradeEntry.spec.ts`,
  `tests/cards/colonies/TitanFloatingLaunchPad.spec.ts`,
  `tests/e2e/console-card-trade-entry.spec.ts` (fhd + tv4k).

⚠️ **Two axes can be set at once, and DEPTH breaks the tie.** With the colonies
hosted inside the card-actions sheet, `sheet` is `cardActions` AND `section` is
`colonies`. Input routing and the command bar asked the sheet first, so both
went to the composer parked underneath while the player was demonstrably driving
the colony grid on top of it. `workspaceStackTopAxis()` is the one answer —
the same rule presence already uses.

## Guards

- Server: `tests/colonies/ColonyTradeManifest.spec.ts` (manifest fields,
  merge + segments, Pluto's per-cube sequence — income + cube 1 in one batch,
  cube 2 in its OWN batch after cube 1's discard, each prompt carrying its
  ordinal, reset-last, selfish, partial trades, no-decrease, exhausted deck) +
  `tests/colonies/Pluto.spec.ts` (one cube vs several: draw → discard → draw →
  discard, never a merged draw and never a multi-card discard).
- Client: `tests/client/components/console/colonyTradeModel.spec.ts` (pure
  mapping / waves / glide) + `consoleColonyTrade.spec.ts` (lifecycle,
  three-gate conclusion, claims, dedupe, holds release on abort, the pre-claim
  veil's one-shot latch) + `colonyBonusDiscardStep.spec.ts` (the zone layout and
  the step's lock/label derivation, plus the follow-up hold) +
  `tests/e2e/console-pluto-bonus-discard.spec.ts` (the real DOM: three zones,
  the card opening by itself, the per-zone locked/ready button, B never exiting).
- ⚠️ `ConsoleRevealOverlay` cannot be MOUNTED under mochapack (it fails to load
  in that bundle — the pre-existing `consoleRevealResultFlight.spec.ts` shows the
  same 0-passing symptom), which is why the modal's logic lives in the pure
  `bonusDiscardStep` / `drawnCardsState` helpers that CAN be guarded. Keep new
  reveal logic out of the component for the same reason.
