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

Guards: `tests/client/components/console/consoleHydroFlow.spec.ts`,
`hydroTargetStep.spec.ts`, the marker rows in
`tests/delta/DeltaProjectExpansion.spec.ts`, the Delta row in
`promptSource.spec.ts`; the batch shape stays pinned by
`consoleHydroAdvance.spec.ts`.
