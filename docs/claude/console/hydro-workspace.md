# The HYDRO workspace — the track is the protagonist, one flow around it

**Status: REWORKED 2026-08-13.** The console «Гидросеть Марса» is a full
North-Star workspace: `preview → pre-select (embedded / nested) → summary →
A «Укрепить гидросеть» → marker glide → resolution ON the landed stage →
result hold → close`. The old confirm modal (`ConsoleHydroConfirm`) and the
flat `hydroPick` sheet (`hydro-pick` frame kind) are GONE; the `X Подробности`
help panel and the header lore paragraph are gone too. The stop-lift draw
cinematic (`hydroDraw/*`) is retired — position 5 plays the deck pick's own
standard deal (the Pluto language), embedded under the standing track.

## The pieces

| Concern | File |
| --- | --- |
| Flow state machine (steps, commit phases, back verbs, restore plan — PURE) | `src/client/console/hydroFlow/consoleHydroFlow.ts` |
| Position-9 glue onto the SHARED played-target selector | `src/client/console/hydroFlow/hydroTargetStep.ts` |
| Scene-layer motion (descend phrase) + the VP ceremony | `src/client/console/hydroFlow/consoleHydroFlowMotion.ts` |
| The workspace (header, track rail, scene layers, input) | `ConsoleHydroSection.vue` |
| Commit pipeline / watchers / claims / submit | `ConsoleShell.vue` (the `hydro*` family) |
| Marker glide gate + reward wave (unchanged) | `src/client/console/hydroMarker/*` |
| The batch builder (byte-parity, unchanged) | `src/client/console/consoleHydroAdvance.ts` |

## The flow contract

- **PREVIEW** (`browse`): the track rail is the primary object; the compact
  panel beneath shows destination identity, route `A → B · −N⚡`,
  requirements, the honest «сейчас → станет» deltas, the pre-select summary
  and ONE CTA. The old three-column stretch, the «История этапа» block and
  the read-only bonus preview are gone. dpad ←/→ = stages (unchanged), RT =
  farthest, dpad ↓ = the summary chip, B = close.
- **PRE-SELECT is a client DRAFT** — nothing submits, nothing is spent, the
  marker does not move:
  - pos 1/2 → the embedded REWARD CHOICE step, which **confirms itself**: a
    D-pad row of the two option cards (each with its own delta preview;
    never LB/RB) plus the step's OWN commit row underneath. `A` on an option
    holds it and arms that CTA, `A` again reinforces; `↑`/`←`/`→` return to
    the options. The flow never walks BACKWARDS to be confirmed on the
    parent — that was one press of pure delay.
    ⚠️ **The choice is SCOPED TO THE STEP**, not a standing pre-select:
    `openChoiceStep` clears it on every entry, `B` clears it on the way out,
    and a mount with no live step clears it too. It therefore has no summary
    chip and cannot survive a trip to the board — the shipped bug where a
    reward configured in an earlier visit was silently committed by a CTA
    that no longer showed it. (`primaryVerb` on a choice stage is ALWAYS
    `choose-reward` for the same reason.)
  - pos 7 → the NESTED repeat browser (`enterConsoleRepeatPick` — the same
    Viron-parity surface + composer, every pre-select of the chosen action
    composed there). `source.label` flips the crumb to «ГИДРОСЕТЬ МАРСА ›
    ПОВТОР ДЕЙСТВИЯ › …» (a label-carrying source keeps ITS workspace as the
    root — `ConsoleCardActions.vue`). The resolve returns to the SUMMARY;
    commit stays a separate deliberate press.
    ⚠️ **The workspace HANDS THE SCREEN OVER, it does not sit under it.**
    A full-scene step needs the whole band, so the hydro section rides
    `v-show="!pickBridgeActive"` exactly as the card-actions source does
    (without it the browser simply stacked on a still-lit hydro workspace —
    two frames at once, the shipped report) and plays its own phrase around
    the swap: `playHydroBridgeRelease` runs FIRST and the shell opens the
    bridge on its settle; the return rides the bridge's falling edge
    (`flow.repeatBridge` watcher, one tick after the host re-shows it) out
    of the EXACT rest pose the release left behind — which is what makes
    the round trip seamless instead of a pop. The bridge flag can never
    outlive the browser: a `repeatPickActive` falling-edge watcher drops it
    even on a hard teardown (`resetConsoleRepeatPick` fires no callbacks).
  - pos 9 → the embedded TARGET layer hosting the SHARED
    `ConsolePlayedTargetStep` (the colony-trade grammar: A Select ·
    X Inspect · B Back, edges hold, `lockedCard` on re-entry).
  - The summary chip is focusable → «A Изменить выбор» re-opens the exact
    step. A stale target silently dropped by the model raises a notice.
- **COMMIT** (`submitHydroAdvance`): freeze the decision into
  `beginHydroCommit` (route, spend, choice, target, frozen result lines),
  raise the OUTCOME CLAIM for card-producing landings (`'hydro'` is a
  `WorkspaceOutcomeHost`; pos 5 → `['draw','pick']` on the Delta Project,
  pos 7 → kinds derived from the composed branch's cached preview), set the
  frame's runtime `serves`, arm the marker, submit ONE batch.
- **MOVING** (`executing`, input absorbed): the existing glide gate
  (`WaitingFor.holdingForHydroMarker`) holds the view until the token LOCKS.
  The falling edge with a genuine lock advances the flow to `resolving` and
  releases the outcome beat (`markWorkspaceOutcomeBeatDone` — the glide IS
  the execution beat). **The recovery net**: a degraded glide (expired arm on
  a slow answer) advances off the SERVER truth instead
  (`hydroViewerTrackPosition` watcher) — the flow can never hang on a visual.
- **RESOLVING**: the landed stage pays INSIDE the workspace —
  - plain stages: the existing reward wave (`hydroRewardTransfers` +
    `panelRewardHold`, counters tick at touchdown);
  - pos 5 / repeated draws: the deck pick teleports into
    `[data-embed-slot="hydro"]` (published `flush:'post'` + from `mounted()`)
    and plays its own deal; its stage name rides `setWorkspaceOutcomePhase`
    into the crumb tail;
  - pos 9: the chosen card stands ON STAGE (`ConsoleCardFaceLite`,
    `data-played-key`); the animal chips land on its `.pcard__res` (the
    transfer ladder gained a `.con-hydro` rung) with the counter FROZEN at
    `targetBefore` and ticking per touchdown (`cardResourceLandings`);
  - pos 10/11: the VP CEREMONY (`runHydroCeremony`) — the value rises OUT of
    the landed stop into the scene seat, the shared `playCeremonyBurst`
    fires, dwell, then result. A `notification-only` hold
    (`'hydro-ceremony'`) keeps the feed queued.
  A standing follow-up decision turns the phase into `committed`
  (B = collapse); the resolution's END is the falling edge of
  `hydroResolutionBusy` (marker ∨ holds ∨ transfers ∨ ceremony ∨ follow-up) —
  never a timeout.
- **RESULT** (`completing`): the frozen summary (−N⚡ · A → B · the reward /
  card / action), a `HYDRO_RESULT_HOLD_MS` read hold, A/B skip; then
  `finishHydroFlow` releases everything and goes board-home.

## Collapse / resume / reconnect

- B during a follow-up (or the embedded deck pick's own B) rides the generic
  `onTaskDefer` → `collapseWorkspace()`: the WHOLE stack parks, the claim and
  the flow record survive in module state. ⚠ Three shell guards keep a PARK
  from reading as completion: the `hydroResolutionBusy` watcher bails while
  deferred/collapsed, the `deckPickActive` release watcher ignores the
  deferred falling edge, and `reconcileWorkspaceOutcome`'s `ours` includes
  the parked hydro claim.
- The restore door (`restoreDeferredTask` → `restoreWorkspaceStack`) remounts
  the section; `mounted()` runs the pure HOST-SCOPED
  `hydroWorkspaceRestorePlan`: `seat-commit` (our claim / a live follow-up →
  the exact scene re-seats, zones republished), `fold` (nothing live →
  honest reset), `none` (browse; the pre-commit draft re-seats only while
  `hydroDraftFresh(cacheKey)` — the wheel entry no longer blanket-resets).
- A reload wipes the module flow → the follow-up serves STANDALONE off the
  server markers: pos 5 carries `deckPickPrompt` (source Delta Project),
  pos 1/2 carry `choiceContext`, and the rework added the missing markers —
  pos 7's SelectCard and pos 9's AddResourcesToCard (`cause`) now carry
  `choiceContext` too (`DeltaProjectExpansion.ts`, spec-pinned). Nothing
  replays: animations arm only at the live submit.
- A server refusal calls `rollbackHydroCommit()` beside `abortHydroMarker()`
  in BOTH WaitingFor error paths — the draft returns intact, B lives.

## The CARD-GRANTED BONUS MOVE (Dynamic Ocean Barrier, DP03)

A card may hand the player a step on the track they did not ask for. The offer
arrives as an ordinary `OrOptions` carrying the SERVER's structural marker
`deltaBonusPrompt` (`BonusDeltaAdvance`, queued `BACK_OF_THE_LINE` so every
other consequence of the placement — the hex's card draw and its reveal
included — is finished first). The client never re-derives a single field of it.

**THE DOOR** waits for the whole arrival chain (`admits('followUp')`) and then
either OPENS the workspace (`anchor: {type:'prompt'}` — a frame that hands the
screen back) or QUEUES into one already standing. Pure policy in
`hydroBonusOffer.ts`; the order is pinned at the seam by
`hydroBonusDoorOrder.spec.ts` and in the DOM by `console-hydro-bonus-order.spec.ts`.

⚠️ **A DOOR IS A DECISION *AND* THE FRAME IT IS APPLIED TO — two live states
never make the decision CHANGE, and a change watcher therefore never runs.**
Both shipped as one report:
 - A **RELOAD** with the offer already on the wire computes the door as `open`
   on its FIRST evaluation and never again — the workspace never opened and the
   leak detector correctly shouted «STRANDED PROMPT: waitingFor "or" (task kind
   "choice") has NO serving surface». The mount edge is asked from `mounted()`
   (`syncHydroBonusDoor`), never with `immediate` — an immediate handler runs at
   SETUP, before there is a shell to enter a workspace from.
 - Opening «ГИДРОСЕТЬ» **FROM THE WHEEL** while the offer is parked keeps the
   decision at `queue` (a parked frame is still «known») while standing up a
   BRAND-NEW live frame that never earned its `serves`. The offer still
   rendered, but `frameServing('choice')` answered with the PARKED frame, so
   the screen the player was standing in did not count as the prompt's home:
   the top chip beaconed at somebody looking straight at the decision.
So the watched signal carries the frame's depth (`hydroBonusDoorSignal`) and
the handler is IDEMPOTENT — any number of edges is harmless, a missing one is a
strand. The chip's own side of that fact is `promptServedByStandingFrame`
(ConsoleShell): a LIVE frame entitled to answer the standing prompt is the
third honest form of «здесь», beside `shellTaskOnSurface` and a presenting
claim. Parked frames deliberately do NOT count — the player walked away, which
is exactly when the beacon is their only reminder.

**IT IS THE SAME MOVE, SO IT GETS THE SAME PRESENTATION.** Taking the offer
routes through `ConsoleShell.beginHydroAdvancePresentation` — the ONE opening
that «Укрепить гидросеть» uses: commit record → outcome claim + `serves` →
`armHydroMarker` → submit. The marker glides, the landed stage pays out through
the reward wave, the counters tick on touchdown and the result stage holds. The
only difference a bonus move is allowed to have is the price. (Before this it
submitted and closed in the same breath: nothing was armed, so nothing moved and
the whole advance happened off screen.) The close gate is the pure
`hydroResolutionBusyOf` — its falling edge is what opens the result stage, and
the result stage is the only door to closing the workspace.

**B IS «СВЕРНУТЬ», NEVER AN ANSWER.** A refusal is an option the player focuses
and confirms with A, like every other refusal in this console; B on the one
button that means «step out and look at the board» everywhere else silently
declined a card's effect, irreversibly. The rule is shared policy, not a hydro
branch: `backVerbWithOwedPrompt(phase, ownsPrompt)` turns CLOSE into COLLAPSE
while a prompt is owed and touches nothing else. The park then reaches the
board-home mandatory card (`consoleTaskSummary`'s `deltaBonus` row names the
workspace), and A there restores the same prompt at the same depth.

**THE MOVE IS READ THE WAY AN ORDINARY ADVANCE IS.** The zone states what the
step COSTS and what it PAYS in the same «сейчас → станет» delta rows the plan
panel uses (`Будет потрачено` — the amber cost register; `Вы получите` — the
landing stage's reward, or both alternatives when it asks). The CTA carries the
VERB and nothing else (`Advance`, identical for the free step and the waiver):
it is echoed into the ONE command bar, where «ПОТРАТИТЬ 1 ЭНЕРГИЮ И
ПРОДВИНУТЬСЯ» crowded out «X Осмотреть» and «B Свернуть» and then truncated
itself — and a bonus advance must not read differently from a paid one.

**«СНАЧАЛА ЗАВЕРШИТЕ ТЕКУЩЕЕ ДЕЙСТВИЕ» IS ABOUT ANOTHER SCREEN.** `turnState`
is `hydroTurnStateOf({waiting, actionMenu, ownsPrompt})`: a prompt THIS
workspace serves is `own-prompt` (status chip «Предложен бонусный шаг», no
reason emitted), a prompt somebody else serves is `busy`. Deriving it from
`waitingFor !== undefined` printed the warning inside the workspace the prompt
itself had opened — telling the player to go and finish the thing in front of
them.

**THE LANDED STAGE'S PICK IS MADE ON THE OFFER'S OWN WINDOW.** Positions 7
(repeat a used blue action) and 9 (which card receives the animals) defer a
`SelectCard`. Reached through an offer the workspace used to pre-collect
nothing, so the pick arrived AFTER the commit as the generic card browser — a
standalone legacy surface over the very workspace that had just asked the
question. The fix is NOT a second implementation: an offer **seats the plan on
its own destination** (`seatPlanOnOffer`), after which `model.needsCardSelect`,
the eligibility list, the repeat-browser bridge (`$emit('pick')`), the embedded
target step (`openTargetStep`) and the summary chip all describe the LANDING
stage exactly as they do for the player's own advance. The zone then renders
the same `.con-hydro__summary` row, and the answer rides the SAME batch tail
(`hydroAdvanceTail` — shared with `hydroAdvanceResponses`, so the two roads onto
the track cannot diverge past the landing).
⚠️ The seating is asked on BOTH edges: the offer watcher runs at SETUP and
`mounted()` legitimately calls `resetHydroPlan()` for a fresh open, which lands
after it and wiped the seat. A mount is not a change; it has to ask for itself.

**AND THE OMISSION IS NAMED.** The pos 7/9 pick is MANDATORY (the model says so:
«a pos 7/9 card pick is MANDATORY before confirm — the reward can't be skipped
per the rules»), so a confirm that ignores it forfeits nothing — it only
postpones the question into a surface nobody chose. The gate is therefore a
WARNING and never a bypass: the first confirm names what is missing
(`pickWarningKey`) and puts the cursor on the pre-select row; the second press
goes and answers it. Shared by the offer and the plan CTA, because it is the
same omission either way — the CTA used to relabel itself «Выбрать действие» and
never say why.
⚠️ **The warning's slot is ALWAYS in layout** (`.con-hydro__pickwarn`, reserved
height, content-only toggle). It fires on the press the player aimed AT the
confirm, so a line that grew the column would move that very button out from
under their thumb. Pinned by `consoleHydroBonusZone.spec.ts` «reserves its
line».

**WHAT THE LANDING STILL OWES.** A bonus move cannot pre-collect its stage's
follow-up (the server framed the offer as a two-option question), so
`hydroBonusAdvancePlan(stage)` — keyed on the stage's own `followUp`, never a
position literal — declares what the frame must SERVE while the result
resolves: pos 5 claims its 4-card batch (`deckSelect`), pos 7 serves everything
the REPEATED action raises once it runs, pos 9 keeps `cardSelect` as the honest
net. A follow-up the frame does not serve rises as a band OVER the workspace
that caused it. Everything the workspace CAN ask up front — the pos 1/2 reward
choice, the pos 7 repeat, the pos 9 target — is pre-collected instead and rides
the one batch.

**THE SOURCE CARD IS PHYSICAL.** The dock carries `data-zoom-slot` and X opens
the shared `slotZoomOrigin` fullscreen: the card LIFTS OUT of that slot, the
slot is held empty for the whole flight (`con-zoom-hold` + the `:has()` rule),
and it flies back into it on close. Without an origin the viewer used its
textual rise-from-depth entrance — a second, identical card materialising while
the first sat in the source zone.

## Gotchas

1. **The Delta Project is never a card face.** `promptSource.ts`
   special-cases `CardName.DELTA_PROJECT` → a module attribution
   («Гидросеть Марса»), `inspectable: false` — the deck pick's L3 hides
   itself off that same field. The lore card must not leak anywhere.
2. The commands ride the DEDICATED store (`consoleHydroUi.commands`, the
   consoleStartUi idiom) — the section coexists with surfaces that steal the
   bar (deck pick, repeat browser), so a single-owner panel slot would race.
3. `hydroFlowState.commit` advances FORWARD-ONLY; the one reversal is the
   server-refusal rollback. A stray late signal cannot resurrect a beat.
4. The scene layers swap through the descend phrase
   (`hydroSceneEnterHook/LeaveHook` — unfold from the pressed rect +
   cascade); a bare `v-if` blink is banned. The track outside the scene
   never moves.
5. **ONE route grammar from the offer to the result.** The commit and result
   scenes state the price the way the offer does — `−N ⚡` when there is one,
   the «БЕСПЛАТНО» badge when there is not. «−0 ⚡» is a price on the one
   move whose whole point is that it has none.
6. ⚠️ **An e2e visibility probe must walk the ANCESTOR CHAIN.** `opacity` is
   not an inherited computed value, so a card inside the zoom flight proxy
   (authored `opacity: 0`, revealed by its tween's from-state) reports
   `opacity: 1` and counts as a second visible card. Two runs of the
   frame-by-frame inspect probe failed on that before the product was even
   suspect.

Guards: `tests/client/components/console/consoleHydroFlow.spec.ts` (incl. the
close gate — «the flow cannot reach its result stage while the chain is
busy»), `consoleHydroBonusZone.spec.ts`, `hydroBonusOffer.spec.ts`,
`hydroBonusDoorOrder.spec.ts`, `consoleWorkspaceFlow.spec.ts` (B under an owed
prompt), `hydroReasons.spec.ts` (`hydroTurnStateOf`),
`tests/cards/delta/DynamicOceanBarrier.spec.ts`,
`tests/e2e/console-hydro-bonus-order.spec.ts`,
`hydroTargetStep.spec.ts`, the marker rows in
`tests/delta/DeltaProjectExpansion.spec.ts`, the Delta row in
`promptSource.spec.ts`; the batch shape stays pinned by
`consoleHydroAdvance.spec.ts`.
