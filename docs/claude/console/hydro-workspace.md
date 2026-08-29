# The HYDRO workspace — the track is the protagonist, one flow around it

**Status: REWORKED 2026-08-13; SHELL CONTRACT 2026-08-29.** The console
«Гидросеть Марса» is a full North-Star workspace: `preview → pre-select
(embedded / nested) → summary → A «Укрепить гидросеть» → marker glide →
resolution ON the landed stage → result hold → close`. The old confirm modal
(`ConsoleHydroConfirm`) and the flat `hydroPick` sheet (`hydro-pick` frame
kind) are GONE; the `X Подробности` help panel and the header lore paragraph
are gone too. The stop-lift draw cinematic (`hydroDraw/*`) is retired —
position 5 plays the deck pick's own standard deal (the Pluto language),
embedded under the standing track.

## THE SHELL — one standing frame, three zones that never trade places

**The work surface is ONE `.con-hydro__panel`** (glass, `position: absolute;
inset: 0` of the scene — from the track anchor to the foot line), holding a
constant grid `ctx | flow | act` (column tokens `--hydro-ctx-w` /
`--hydro-act-w` on `__scene`; the profiles override the TOKENS, never the
grid). **No substate may move any edge of the surface or of its columns** —
the per-state centred panels this replaced seated the choice/payment/result
states ~250 px lower than the preview, tearing the track connector off
mid-flow (the shipped «интерфейс проваливается вниз» report).

- **CTX — the persistent identity column** (`ctxView`, ONE derivation): the
  stage variant (glyph 3.1rem base / 4.4rem tv · name · «Этап N из 11» · the
  state chip in a RESERVED slot · the route) or the SOURCE variant (the
  granting card + route) for a card's move. Past the commit it reads the
  FROZEN record (`sourceCard` / `stageNameKey` / actual energy+steel price) —
  the live model has moved on. It never re-enters with a layer; a stop change
  retunes it in place together with the plan body.
- **FLOW — the one transitioning zone** (`__flow` hosts the keyed
  `__layer--*`s; the descend phrase plays HERE). Every layer is TOP-ANCHORED;
  `--choice`/`--result` centre their content INSIDE the standing zone (a
  composition, not a coordinate system). The reward step renders through
  **`ConsoleHydroPlanSteps`** — the movement plan's decisions as a LIST
  (today always length 1; a future multi-reward move grows the DATA, the
  progress head + per-stage chip rail appear only at length > 1 —
  `hydroPlanSteps.ts` is the pure model, `consoleHydroPlanSteps.spec.ts`
  pins 1/3/6). The payment substep is the shared `ConsolePaymentPanel` in
  this zone (crumb tail «ОПЛАТА»), with the chosen stage reward pinned above
  it (`__paychoice`) — the ctx column IS the pinned summary.
- **ACT — the persistent action column**: ONE physical home for the
  decision's verbs in every substate (plan CTA + reasons as one `__verdict`
  chassis · choice commit · payment reinforce · the bonus answer pair ·
  result «Продолжить»); bodies crossfade (`con-hydro-act`), bottom-seated.
  The column NEVER unmounts — a column that came and went re-measured the
  flow zone under a leaving layer. A bar-driven substate (commit, target)
  keeps it as composed air.
- **The connector stem** (`__stop--focused::after`, 1.05rem) physically
  crosses the root's .5rem flex gap + the rail's .3rem padding and PLUGS into
  the frame's top edge — in every substate, because the frame's top never
  moves. Pinned by `console-hydro-geometry.spec.ts` (gap ∈ [0, 0.9rem]) and
  by the `hydroAnchor` probes in `console-dp06-payment-mix.spec.ts`
  (preview → choice → payment → back → result, fhd + tv4k).
- **Skipped rewards are a POLICY COUNT** («↷ Промежуточные награды будут
  пропущены · N»), never the raw roster — the route stops are lit on the rail
  right above. The commit record carries `skippedCount` and the result stage
  restates it.
- ⚠️ **Never re-introduce a per-panel `:not()` ladder for the hero scale.**
  The old `console_tv.less` rule (`:not(--details)` only) matched the payment
  panel that the base chain excluded — the payment summary shipped at ×1.4
  the preview's icon/title scale. The ctx column has ONE scale per profile.

## THE PARITY LAW — the source changes context, never the decision language

A source card (SSB's entry, DOB's offer) adds the card, an explanation, a
special price and possibly a refusal. It may NOT fork the decision surfaces:

- **The primary is named by the NEXT REQUIRED INTERACTION**
  (`hydroNextInteraction` + `HYDRO_PRIMARY_KEY` in `hydroBonusOffer.ts`):
  unresolved stage choice → «Выберите награду», ready → «Укрепить
  гидросеть» — the SAME mint `__cta` plate as the plan's own, from every
  door. `HydroBonusCopy` deliberately carries NO confirm key; «Продвинуться»
  as a source-only final verb is retired. The optional «Пропустить» stays a
  calm SECONDARY beneath the primary (server-framed offers only; a card
  entry's way out is B), reachable inside the reward step too (↓ past the
  armed commit), and B stays «Свернуть» — never an answer.
- **«Вы получите» is ONE component** (`ConsoleHydroGains.vue`) for the
  preview AND the source zone: same typography/icons/«или»; an UNRESOLVED
  choice shows the ALTERNATIVES (never a concrete delta — the shipped
  «502 → 502» over an unmade choice); an honest zero reads «Без изменений».
  The source price renders through the plan's own `__payline` classes —
  the «Будет потрачено» dialect is gone.
- **The reward step, the pos 7/9 picks, the payment substep and the result
  are the same components/state** whichever door opened the flow (this was
  already true structurally; the CTA/gains forks above were the residue).

## THE CARD SCENE — immersive, and the deal plays ONCE per batch

While the landed stage's embedded deck pick is live (`deckPickState.phase !==
'idle'` ∧ commit standing ∧ claim host `hydro`), the frame wears
`__panel--immersive`: ctx/act/commitline DISSOLVE (opacity only — the grid
never re-lays), `__flow`/`__layer--commit` drop to `position: static` so
`__embed` measures against the PANEL and takes the whole surface; everything
fades back when the selection ends. The commit spinner renders only while the
GAME works (`v-if="!followUpLive"`) — never over a screen waiting for the
player.

**Deal-once**: the deal is the presentation of a NEW reward batch, keyed on
the batch's own identity in MODULE state (`deckPickState.dealtKey` = the
surface's structural `promptKey`; `shouldDealBatch`/`markBatchDealt`), never
on a mount. Collapse → reopen / inspect / resize ADOPT a settled table; the
unanswered draft picks + cursor survive the park
(`saveDeckPickDraft`/`takeDeckPickDraft`, cleared when the batch is
answered). A host-flown adopt (`workspaceOutcomeArrivalFlown`) still defers
its arrival gate to the host's handoff. Pinned by `consoleDeckPick.spec.ts`
and live by `tests/e2e/console-hydro-cards-scene.spec.ts` (stage 5 via four
API-played tag cards → one 5-step advance; deal-proxy counter proves first
deal > 0 and reopen = 0; fhd + tv4k).

**Pluralization**: translations inline number forms as `{карту|карты|карт}`
(`src/client/i18n/pluralForms.ts`, resolved in `translateMessage` against the
nearest number to the group's left) — «Оставьте себе 2 карт(ы)» is no longer
expressible; the deck pick's server title now reads correctly for 1/2/5.

## INVARIANT CONTROL GEOMETRY — the glyph slot + the two-line pick row

A control's OUTER geometry and its label's position never change on a focus
move. The controller badge lives in a PERMANENT `.con-glyphslot`
(`gamepad.less`) inside every hydro verb — the pick row, the primary CTA, the
optional refusal — and losing the cursor hides the badge with
`.con-glyphslot--ghost` (`visibility`, footprint preserved), never `v-if`/
`display: none`. «Exactly one lit A» is now a claim about NON-GHOST badges.
The pick row is a COLUMN in every state: the eyebrow (`__section-label`) on
its own line, then `__pickrow-body` (glyph slot → the state's content) — the
base `__summary` wrap used to seat the eyebrow inline beside a short
«выберите» and above a long chosen graphic, re-composing the row on every
state/focus change. Size discipline: `__summary-body` carries **no
`zoom: … * var(--con-ui-scale)`** — rem text already rides the root scale
(`console_tv.less` html font-size), so the zoom DOUBLE-scaled every label and
badge on TV (scale², the oversized gold «A»); px-authored card-DSL inlays
integrate locally (`__repeatpick-graphic`'s own zoom, `__pick-cur`'s rem
icon). Hydro badges are calibrated once (`.con-hydro .con-glyphslot
.gp-glyph`, rem). Pinned by `consoleHydroBonusZone.spec.ts` (lit-glyph
counts + permanent berths) and live by
`tests/e2e/console-hydro-repeat-bridge.spec.ts` (focused-vs-blurred boxes,
fhd + tv4k).

## FOCUS — seated by the DECISION'S IDENTITY, never by a render

`pickDecisionKey` = door (`offerOrigin` ?? plan) | landing position | pick
kind | answerable (`mustSelectCard`). The seat machinery (`seatOwed` →
`applyOwedSeat`: an owed pick outranks the confirm) runs on the MOUNT edge
and on every CHANGE of that key — so `unavailable → available` (the player
used a blue action elsewhere and came back) re-seats onto the newly
answerable pre-select, while a same-revision re-render re-seats nothing. Two
qualifiers: the player's OWN track walk flips the key too (`selfKeyChange`,
armed beside the position write, consumed by the watcher's flush — never a
steal mid-walk), and a hand-moved cursor (`focusMoved`) is never re-seated
inside its own revision. **A made pick KEEPS the cursor on its own row**
(the old hand-over to the confirm let a habitual second A commit straight
out of the selector); the row's verb is now «Сменить», and the selector's
cancel returns to the same seat untouched. Pinned by
`consoleHydroBonusZone.spec.ts` («re-seats onto the pick when it becomes
answerable», «KEEPS THE CURSOR») and live by both repeat-selector e2e specs.

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

- **PREVIEW** (`browse`): the track rail is the primary object; the standing
  frame beneath reads it — identity + route in the CTX column, requirements /
  notes / the honest «сейчас → станет» deltas / the price line / the
  pre-select summary in the FLOW zone, ONE CTA (or the verdict block) in the
  ACT column. The old three-column stretch, the «История этапа» block and
  the read-only bonus preview are gone. dpad ←/→ = stages (unchanged), RT =
  farthest, dpad ↓ = the summary chip, B = close.
- **PRE-SELECT is a client DRAFT** — nothing submits, nothing is spent, the
  marker does not move:
  - pos 1/2 → the embedded REWARD CHOICE step, which **confirms itself**: a
    D-pad row of the two option cards (each with its own delta preview;
    never LB/RB — rendered through `ConsoleHydroPlanSteps`, the plan-of-1
    strip) plus the step's OWN commit standing in the ACT column. `A` on an
    option holds it and arms that CTA, `A` again reinforces; `↑`/`←`/`→`
    return to the options. The flow never walks BACKWARDS to be confirmed on
    the parent — that was one press of pure delay.
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

**ONE ROW, BOTH ROADS** (`hydroFlow/ConsoleHydroPickRow.vue`). The pre-select is
a single component used by the offer's window AND the plan panel — same label,
same branch graphic, same focus ring, same verbs, one copy table
(`HYDRO_PICK_COPY`). Three states it never lies about:
 - **UNCHOSEN** — the amber owed register; the press is the content;
 - **CHOSEN** — the branch's own printed graphic + the card's name + a tick;
 - **FIZZLED** — the server offered no candidate, so the reward simply fizzles.
   The row states THAT and offers no press at all: «выберите действие» where
   there is physically nothing to choose is an instruction the player cannot
   follow, and nothing is owed, so nothing warns.
The plan panel's row is no longer conditional on a made choice: it stands for
the whole stage from the first frame (the CTA quietly relabelling itself used to
be the entire affordance).

**THE CURSOR STARTS ON THE ACT, AND THE BAR NAMES IT.** With a pick owed the
cursor seats on the ROW (seating it on the confirm made the first press a
warning and the affordance a hunt); a made pick HANDS THE CURSOR ON to the
confirm. The ONE command bar follows it — `Выбрать действие` / `Сменить
действие` on the row, `Осмотреть` on the source, `Продвинуться` /
`Пропустить` on the answers. A bar that says «Продвинуться» over a cursor
standing somewhere else is the bar describing a different button.

⚠️ **A BRANCH SHOWN ALONE MUST DROP THE CONNECTOR THAT JOINED IT TO ITS
SIBLING.** The DSL marks an `or` join in two places and only the LEADING one was
stripped — «Права на астероиды» ends its first `action()` with `.nbsp.or()`, so
a lone branch read «1 M€ → <asteroid>* ИЛИ» with nothing after the ИЛИ. Fixed in
the SHARED `branchActionNode` (so the Actions-workspace tile, the composer's
repeat slot and this row all gained it), walking in past the row builder's empty
tail slot first — «is the last item an OR?» answers no for a row that visibly ends
in one. An `or()` INSIDE the effect is a different thing (one branch, two
outcomes) and is deliberately left alone.

**AND THE OMISSION IS NAMED — BUT NEVER LOCKS THE COMMIT.** Advancing without
stopping to configure the landed stage's reward is a LEGAL move, and the pick is
not lost by it: the server defers the same `SelectCard` either way and the
console embeds that prompt in the workspace that made the move (which is why
`submitHydroAdvance` unions `hydroBonusAdvancePlan`'s `serves` whenever the pick
was not pre-collected). So `canConfirm` does NOT require it — the model used to,
and that assertion was the trap: the CTA could not fire, the only live
affordance was the picker, and there was no way to advance at all.

The gate is a HEADS-UP: the first confirm names what is unchosen
(`pickWarningKey` — «его спросят после продвижения», which is the truth), the
second press advances. ⚠️ **The cursor STAYS PUT** — an earlier version moved it
onto the row, so the second press opened the picker instead and the player was
trapped a second time. The row is the OTHER affordance, reached by the cursor
that starts on it; the CTA is always the advance and never relabels itself into
a second picker opener.
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
prompt), `hydroReasons.spec.ts` (`hydroTurnStateOf`), `consoleHydroPickRow.spec.ts` (the
row's three states + the branch render), `actionExtraction.spec.ts` (the
leading AND trailing `or` connectors),
`tests/cards/delta/DynamicOceanBarrier.spec.ts`,
`tests/e2e/console-hydro-bonus-order.spec.ts`,
`hydroTargetStep.spec.ts`, the marker rows in
`tests/delta/DeltaProjectExpansion.spec.ts`, the Delta row in
`promptSource.spec.ts`; the batch shape stays pinned by
`consoleHydroAdvance.spec.ts`.
