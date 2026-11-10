/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE REVEAL CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import type {CardIntakeBatchRef} from '@/common/models/CardDrawRevealModel';
import {CardName} from '@/common/cards/CardName';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import ConsoleHandSection from '@/client/components/console/ConsoleHandSection.vue';
import {ConsoleHandEntry, HandTransitionTargets} from '@/client/components/console/consoleHandSectionTypes';
import {shortBlockerLabel} from '@/client/components/console/consoleHandGrid';
import {unplayableReasonChip} from '@/client/components/handCards/unplayableReasonFormat';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {deckPickHolding} from '@/client/console/deckPick/consoleDeckPick';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import {closeWorkspaceRoot, workspaceFrameMounted, workspaceFrameRenders, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {colonyRevealSourceOf, colonyResolutionUi, remoteColonyBonusParksReveal} from '@/client/console/colonyTrade/colonyResolution';
import {handRevealState, RevealVisual} from '@/client/console/handDock/handRevealState';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {beginDockIntakeAccent} from '@/client/console/handDock/consoleDockAccent';
import {isHandRevealEpisodeRunning, reverseHandReveal, runHandCloseEpisode, runHandOpenEpisode, settleHandHome, settledPaint, RevealPair} from '@/client/console/handDock/handRevealDirector';
import {externalDrawHolding, externalDrawResolutionOf, externalDrawTakeOf, resetExternalDraw} from '@/client/console/externalDraw/consoleExternalDraw';
import {consoleActionComposerUi, resetConsoleActionRevealClaim} from '@/client/console/consoleActionComposerUi';
import {currentRevealEvent, drawnCardsState, markRevealPresented, revealPresented} from '@/client/components/drawnCards/drawnCardsState';
import {revealViewerState} from '@/client/components/notifications/revealViewerState';
import {ConsoleTask, taskFor, SHELL_SECTION_KINDS} from '@/client/console/consoleTaskRouter';
import {hydroStepQueuedFor, hydroTraversalPending} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';
import {bonusDiscardOwnsBatch, bonusDiscardStep, BonusDiscardStep} from '@/client/console/colonyTrade/colonyBonusDiscardStep';
import {workspaceClaimsColonyRevealBatch, workspaceClaimsRevealBatch, workspaceClaimsDeckCheck, workspaceClaimsPick, workspaceOutcomeBeatPending, releaseWorkspaceOutcome, retainWorkspaceOutcomeForNextBatch, workspaceOutcomeState, workspaceOutcomeZone} from '@/client/console/consoleWorkspaceOutcome';
import {boardBeatParksReveal} from '@/client/console/boardBeatPark';
import {parliamentParksReveal} from '@/client/console/parliament/parliamentRewardBeat';
import {rulingChangeParksReveal} from '@/client/console/parliament/rulingChangeDraw';
import {PARLIAMENT_DRAW_ZONE, parliamentDrawZone, parliamentOwnsRevealBatch} from '@/client/console/parliament/parliamentDraw';
import {colonyBonusPayoutParksReveal} from '@/client/console/colonyLedger/colonyBonusPayout';
import {ResultRevealPresentation, resultRevealPresentation} from '@/client/console/consoleRevealPresentation';
import {isPlayOutcomeHost, lawPlayOutcomeLive, playOwesTargetPick} from '@/client/console/played/consolePlayOutcomeClaim';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {consoleState} from '@/client/console/consoleRouter';
import {acknowledgeMandatoryBeat} from '@/client/console/consoleMandatoryGate';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {PlayedController} from '@/client/console/shell/playedController';

/**
 * THE SCENE-EXIT BARRIER'S NAMED NET (see `revealHeldForWorkspace`). Long
 * enough for the slowest honest exit this console plays (a take-all gather plus
 * its dock flights), short enough that a missed completion reads as a beat that
 * arrived a moment late rather than as a screen that stopped.
 */
const REVEAL_EXIT_BARRIER_NET_MS = 4000;

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type RevealPort = {
  $nextTick(fn?: () => void): Promise<void>,
  $refs: Record<string, unknown>,
  armPartyDiscardStep: UnwrapRef<ParliamentController['armPartyDiscardStep']>,
  readonly cardStageExitBusy: boolean,
  colonyResolutionLive: UnwrapRef<ColonyController['colonyResolutionLive']>,
  continueLedgerPayoutAfterTake: UnwrapRef<ParliamentController['continueLedgerPayoutAfterTake']>,
  deferShellTask: UnwrapRef<MandatoryController['deferShellTask']>,
  foldWorkspaceAfterResult(host?: WorkspaceFrameKind): void,
  readonly handAlbumParked: boolean,
  /** WRITTEN here. */ handClosePreparing: boolean,
  handEffectStageOn(): void,
  readonly handEntriesAll: Array<ConsoleHandEntry>,
  readonly handSelectSelectableNames: ReadonlyArray<string>,
  readonly handSelectUiActive: boolean,
  readonly hostTask: ConsoleTask | undefined,
  hydroActiveStepSource: UnwrapRef<HydroController['hydroActiveStepSource']>,
  hydroQueuedRevealForLaterStep: UnwrapRef<HydroController['hydroQueuedRevealForLaterStep']>,
  hydroRevealEmbedded: UnwrapRef<HydroController['hydroRevealEmbedded']>,
  leaveHandAfterAnswer(): void,
  ledgerDiscardStepOwed: UnwrapRef<ParliamentController['ledgerDiscardStepOwed']>,
  ledgerPayoutClaimed: UnwrapRef<ParliamentController['ledgerPayoutClaimed']>,
  mandatoryBeat: UnwrapRef<MandatoryController['mandatoryBeat']>,
  readonly nativeCompositeTask: ConsoleTask | undefined,
  nomadMoveHolds: UnwrapRef<PlacementController['nomadMoveHolds']>,
  openHandWorkspace(opts?: {overlay?: boolean}): void,
  openLedgerDiscardStep: UnwrapRef<ParliamentController['openLedgerDiscardStep']>,
  openShellTaskSurface(task: ConsoleTask): void,
  readonly outcomeAdoptionPending: boolean,
  partyDiscardStepOwed: UnwrapRef<ParliamentController['partyDiscardStepOwed']>,
  playedHeroHolds: UnwrapRef<PlayedController['playedHeroHolds']>,
  readonly playEffectOwed: boolean,
  readonly playerView: PlayerViewModel,
  remoteColonyBonusPending: UnwrapRef<ColonyController['remoteColonyBonusPending']>,
  /** WRITTEN here. */ revealParliamentLatch: UnwrapRef<ParliamentController['revealParliamentLatch']>,
  settlementTableParked: UnwrapRef<ColonyController['settlementTableParked']>,
  submit(response: unknown): SubmitTicket,
  taskSpacePending: UnwrapRef<PlacementController['taskSpacePending']>,
  tilePlacementHolds: UnwrapRef<PlacementController['tilePlacementHolds']>,
  readonly workspaceOutcomeServingNow: boolean,
};

export function createRevealController(shell: RevealPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The reveal QUEUE park's restore fn (registered at mount beside the board-beat probe). */
  const releaseRevealQueuePark = ref(undefined as (() => void) | undefined);
  /** The scene-exit barrier's net + the batch id it has released. */
  const revealExitBarrierNetId = ref(undefined as number | undefined);
  const revealExitBarrierPassed = ref(undefined as number | undefined);
  /** The reveal-result the player already acknowledged (until the server clears). */
  const dismissedRevealKey = ref('');
  /** Restore fn of the injected reveal-park supplier (see mounted()). */
  const releaseRevealParkSupplier = ref(undefined as (() => void) | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * Dock backs the hand ALBUM owns right now (hidden in the tray) —
   * DERIVED, never stored, so it can't drift from the live hand:
   *  - the WHOLE album universe while the album owns the cards — phase
   *    `open`/`closing`, or `opening` once its proxies stand (the old
   *    whole-pack `dockLifted` timing). THE WHOLE HAND LEAVES THE DOCK:
   *    a card outside the tag filter is not on any page, but it is parked
   *    with the far page packets beyond the stage edge — the dock never
   *    shows a «remainder» while the player is leafing the album (one
   *    card, one home);
   *  - plus `dockExtraLift`: filter-episode leavers still airborne
   *    (released at the episode's materialization).
   */
  /** A reveal episode (open/close/filter flight) is airborne — the album
   *  spine's opaque well holds transparent so the pack is never covered
   *  mid-launch/mid-landing (chrome materializes around SETTLED cards). */
  const handRevealTransit = computed((): boolean => {
    // The spine is the album's READING (where the player stands in it) — it comes with the cursor, after the
    // copies' handoff, never in its flush (PL-508: `chrome` stays below `all` until the copies have gone).
    return handRevealState.phase === 'opening' || handRevealState.phase === 'closing' ||
      handRevealState.filterActive || handRevealState.chrome !== 'all';
  });

  /**
   * The mode the reveal overlay is ACTUALLY mounted with, or undefined when it
   * is not on screen. The single source for both its `v-if` and the foreground
   * lease — they were two hand-written expressions and they had drifted: the
   * lease was taken on `consoleRevealMode` alone while the overlay
   * additionally required `!playedHeroHolds`, so through the hero beat the
   * console held a `mandatory-choice` lease with NOTHING rendered. That is a
   * foreground claim nobody can satisfy: the notification queue cannot drain
   * and no mandatory surface may mount behind it.
   */
  const revealOverlayMode = computed((): ConsoleRevealMode | undefined => {
    return shell.playedHeroHolds ? undefined : consoleRevealMode.value;
  });

  /**
   * «Посмотри N карт колоды, оставь K» — the DRAW & SELECT surface.
   *
   * `deckPickHolding()` is what keeps it up PAST its own prompt: the answer
   * ends `waitingFor` the moment it reaches the server, and both of the
   * flow's closing beats (the picks flying into the dock, the rest tumbling
   * away) live entirely after that. Without it the surface would be deleted
   * out from under the very animation it exists for.
   */
  const deckPickActive = computed((): boolean => {
    if (consoleState.task.deferred || shell.taskSpacePending !== undefined) {
      return false;
    }
    if (deckPickHolding()) {
      return true;
    }
    return shell.nativeCompositeTask?.kind === 'deckSelect';
  });

  /** The prompt BELONGS to an open workspace (ownership), whether or not its
   *  zone is ready yet — the same split `taskBelongsToWorkspace` makes. */
  const deckPickBelongsToWorkspace = computed((): boolean => {
    return workspaceClaimsPick() && deckPickActive.value;
  });

  /** Claimed but not ready → render NOWHERE for the gap frame, never in a
   *  band of our own for one frame and then somewhere else. */
  const deckPickHeldForWorkspace = computed((): boolean => {
    return deckPickBelongsToWorkspace.value &&
      (workspaceOutcomeZone() === '' || workspaceOutcomeBeatPending());
  });

  const deckPickEmbedTarget = computed((): string | undefined => {
    if (!deckPickBelongsToWorkspace.value || deckPickHeldForWorkspace.value) {
      return undefined;
    }
    const slot = workspaceOutcomeZone();
    return slot === '' ? undefined : slot;
  });

  /** ON STAGE and owning its screen — the ONE predicate the pad routing, the
   *  command bar and the start scene's own ownership all read. */
  const deckPickServing = computed((): boolean => {
    return deckPickActive.value && !deckPickHeldForWorkspace.value;
  });

  /**
   * A HOST IS STANDING THE SOURCE CARD beside this reveal — the overlay then
   * drops its own head chip (one sentence, one voice) and re-fits around the
   * seat. Today the Hydronetwork's repeated action; any future host that
   * stands a `[data-embed-source-slot]` joins this one predicate.
   */
  const revealSourceSeatStands = computed((): boolean => {
    return shell.hydroRevealEmbedded && shell.hydroActiveStepSource !== undefined;
  });

  /**
   * A draw granted by an ENACTED RESOLUTION (Turmoil Redux — Climate
   * Research) is a STEP of the political phase's enactment stage, never a
   * second workspace over it: the SAME premium take surface teleports into
   * the Parliament's own zone. Structural (the intake's `cause`), never a
   * name. Undefined until the zone is published — the claimant renders
   * NOWHERE while the slot is missing (the embed contract, rule 4).
   */
  const externalDrawEmbedTarget = computed((): string | undefined => {
    const meta = externalDrawTakeOf(shell.playerView.waitingFor);
    if (externalDrawResolutionOf(meta) === undefined) {
      return undefined;
    }
    // The zone is the reward stage's FIELD — open one flush after the pose
    // stands, and only once the payout that arrived WITH the draw has flown
    // (`consoleParliamentUi.fieldStanding`): the wave first, then the deal.
    // …and the ZONE NODE must be in the DOM (v4): the reading panel that carries it mounts with the reward
    // stage and unmounts when the walk is back on the table, and a teleport pointed at a destroyed node
    // crashes the patch (`consoleParliamentUi.stageZone`).
    return workspaceFrameMounted('parliament') && consoleParliamentUi.fieldStanding && consoleParliamentUi.stageZone ?
      '.con-parl [data-embed-slot="parliament-stage"]' : undefined;
  });

  /**
   * PRESENCE IS THE STACK (invariant 1) — the workspace's ONE v-if, plus the
   * EMBEDDED case, whose host frame is the Parliament's and whose presence
   * is therefore the published zone.
   */
  const externalDrawWorkspaceMounted = computed((): boolean => {
    return workspaceFrameRenders('external-draw') || externalDrawEmbedTarget.value !== undefined;
  });

  /** The external-draw take is ALIVE for this player — the frame-lifetime
   *  predicate. The commit hold extends it past the LAST take's answer, so
   *  the final flight lands before the workspace folds. */
  const externalDrawFrameLive = computed((): boolean => {
    return externalDrawTakeOf(shell.playerView.waitingFor) !== undefined || externalDrawHolding();
  });

  /** The take is EMBEDDED in the Parliament — the standalone root is never entered for it. */
  const externalDrawEmbedded = computed((): boolean => {
    return externalDrawEmbedTarget.value !== undefined;
  });

  /** The workspace owns the pad exactly while it is the surface on screen. */
  const externalDrawOwnsPad = computed((): boolean => {
    return externalDrawWorkspaceMounted.value && shell.hostTask === undefined;
  });

  /**
   * A DRAWN-cards reveal is pending — the RAW signal (`currentRevealEvent`
   * minus the tile/deck holds). The drawn reveal is NEVER gated (it is the
   * continuous endpoint of its draw cinematic — see consoleMandatoryGate), but
   * a pending draw still HOLDS the follow-up task surface (the Pluto discard
   * waits for the whole reveal beat), so `shellTask`/`activeConsoleTask`/
   * `startTask` read this.
   */
  const rawDrawnRevealPending = computed((): boolean => {
    // The tile-placement / nomad-move heroes own the screen through their
    // landing + reward beats, and the deck-draw scene deals the cards out
    // first — the drawn reveal assembles only after those (same holds as
    // the 'drawn' branch). For the nomad move this is what defers a
    // card-bonus reveal until the camp has seated and the field restored.
    if (shell.tilePlacementHolds || shell.nomadMoveHolds || deckDrawHolds()) {
      return false;
    }
    // A FOREIGN trade's owner-bonus batch is PARKED behind the mandatory
    // entry (remoteColonyBonusPending): nothing presents, nothing forces the
    // player off their screen — the announcement is the door, and opening it
    // arms the entry, which is what releases this hold. Without it the batch
    // mounted a full-bleed reveal over wherever the player stood.
    //
    // ⚠️ THE PARK IS ABOUT THAT BATCH, NOT ABOUT «THE REVEAL». This signal is
    // what every admission family reads as «the player is still in a reveal»
    // (`admissionSignals.revealPending`), so a state-shaped park lied about
    // the viewer's OWN untaken draw: an opponent's Pluto marker landing while
    // the player worked through a card action's reveal dropped the block, and
    // the bonus's own door opened on top of the flow they were in. Scoped to
    // the batch that would present (`remoteColonyBonusParksReveal`), so an
    // unrelated draw of the viewer's own keeps its surface and keeps holding
    // every other prompt out until it is finished.
    // …and a GLOBAL-PARAMETER batch (the Venus 8% draw) is PARKED while the
    // board is covered: its one honest presentation is the cover lifting
    // off the scale's own marker, which needs a board the player can SEE —
    // the board-beat drain releases it after the workspace has concluded
    // and the held scales have told their story. Same law, same shape as
    // the colony park above: scoped to the batch it parks, never «the
    // reveal», and bounded by the park's own safety.
    // …and the PARLIAMENT's Agenda CARD batch (Turmoil Redux) is PARKED
    // while the political phase's sitting still owes the enactment glide
    // that reaches the step: its one honest presentation is the cover
    // lifting off that step, on a track the player can see. Released by
    // the sitting director at the glide's landing (or the ledger's idle net).
    // …and a CARD's colony-bonus payout («the ledger pays», TR23): a row's drawn
    // batch waits for ITS TURN in the ledger — the rows before it are still
    // paying, and its take stands in the workspace's own draw layer only once
    // the walk reaches it. Scoped to the batch (`via` = the paying card),
    // released by the walk, bounded by its stall net.
    const ev = currentRevealEvent();
    return ev !== undefined && !revealBatchParked(ev);
  });

  /**
   * The reveal modal's MANDATORY closing step, when the pending prompt is the
   * discard half of a colony bonus (Pluto — the server marks it structurally).
   * `ready` once every card of the payout has been taken; the label is
   * singular for one cube and plural for several.
   */
  const revealDiscardCloser = computed((): BonusDiscardStep | undefined => {
    if (consoleRevealMode.value !== 'drawn') {
      return undefined;
    }
    const ev = currentRevealEvent();
    const untaken = ev === undefined ? 0 : ev.cards.length - ev.takenIndices.size;
    // …and only for the batch the marker OWNS: the overlay scopes the very
    // same read (`bonusDiscard`), and the bar must never advertise a verb the
    // surface it describes does not have.
    const meta = shell.playerView.waitingFor?.discardPrompt?.colonyBonus;
    return bonusDiscardStep(
      // The colony's OWN segment, never the root (a Venus trade's batch is rooted on the 8 % card — read off the root
      // the bar lost its discard verb and the overlay its closing step: the discard never opened, 2026-10-30).
      bonusDiscardOwnsBatch(meta, colonyRevealSourceOf(ev)) ? meta : undefined, untaken);
  });

  /** The T6 REVEAL overlay mode (drawn > result > viewer), undefined = none. */
  /**
   * The workspace slot the reveal is TELEPORTED into, or undefined for the
   * ordinary full-bleed band.
   *
   * The overlay is not duplicated and not suppressed — it is RE-HOMED: same
   * instance, same `consoleRevealMode`, same input routing, same commands.
   * That is what makes «one component, two hosts» true rather than a claim
   * in a comment. The selector is a stable data attribute on the workspace's
   * outcome zone, which the workspace renders from SUBMIT time so it always
   * exists before Vue resolves the target.
   */
  const revealEmbedTarget = computed((): string | undefined => {
    // A PARKED SETTLEMENT TABLE stays in its own zone (the receded stage's) — never the standalone band, never
    // nowhere: `settlementTableParked` already requires the zone to be published.
    if (revealOverlayMode.value === undefined && shell.settlementTableParked) {
      return workspaceOutcomeState.embedSlot;
    }
    // THE VERDICT re-homes on exactly the same terms as a batch. Keyed on
    // `revealOverlayMode`, not on `consoleRevealMode`: a card PLAY's verdict
    // waits behind its own played-hero scene («сначала карта сыграна, потом
    // результат»), and reading the ungated mode here would publish the embed
    // — and with it `markWorkspaceOutcomePresenting` — while the hero still
    // owns the screen and nothing had been re-homed yet.
    if (revealOverlayMode.value === 'result') {
      return ownResultRevealPresentation.value === 'embedded' && workspaceOutcomeZone() !== '' ?
        workspaceOutcomeZone() : undefined;
    }
    if (consoleRevealMode.value !== 'drawn') {
      return undefined;
    }
    const ev = currentRevealEvent();
    if (!workspaceClaimsRevealBatch(ev)) {
      // «ПРИЁМКА»: the Parliament's own families stand in its draw stage (`parliamentDraw.ts`).
      if (parliamentOwnsRevealBatch(ev)) {
        const zone = parliamentDrawZone();
        return zone === '' ? undefined : zone;
      }
      return undefined;
    }
    const slot = workspaceOutcomeZone();
    return slot === '' ? undefined : slot;
  });

  /** A claimed batch whose workspace zone is not mounted yet → hold the
   *  reveal rather than let the full-bleed band take it for a frame.
   *
   *  ⚠️ BOTH claim shapes, always. This guard knew only the CARD claim, so
   *  a claimed COLONY payout whose zone was one tick late (the section
   *  re-mounts and publishes its slot a `$nextTick` after the response)
   *  mounted full-bleed over the colony workspace — indistinguishable from
   *  a legacy modal, and the reason «Плутон открывает модалку» was reported
   *  against a flow that had no legacy component in it at all. */
  const revealHeldForWorkspace = computed((): boolean => {
    const ev = currentRevealEvent();
    // «ПРИЁМКА» (`parliamentDraw.ts`): a batch the PARLIAMENT hosts (a Career card step, a card's answer to a change
    // of power) waits NOWHERE until its draw stage has entered — never the standalone band for a frame and the stage
    // the next. Ownership ≠ readiness; the section's readiness net bounds the wait.
    if (ev !== undefined && rawDrawnRevealPending.value && !workspaceClaimsRevealBatch(ev) && parliamentOwnsRevealBatch(ev)) {
      return parliamentDrawZone() === '';
    }
    if (ev === undefined || !rawDrawnRevealPending.value || !workspaceClaimsRevealBatch(ev)) {
      return false;
    }
    // THE ACTIVATION GATE OUTRANKS EVERY EXIT SIGNAL. The scene-exit barrier
    // below asks «has the previous stage finished leaving?» — a question about
    // MOTION. This one asks «does this batch's own stage exist yet?» — a
    // question about the FLOW, and it is the one the screenshot defect
    // answered wrongly: the stage-5 exits genuinely completed, so the barrier
    // opened, and stage 7's cards mounted over a track still showing stage 5.
    if (shell.hydroQueuedRevealForLaterStep) {
      return true;
    }
    if (workspaceOutcomeZone() === '' || workspaceOutcomeBeatPending()) {
      return true;
    }
    // THE DISCARD STEP OWNS THE ROOM — a next cycle's batch that rode the discard's own answer waits for the
    // stage to come back. This used to be the EMPTY SLOT's job (the stage closed for the discard); the stage now
    // RECEDES with its zone still published (the settlement table parks in it), so the hold is stated here.
    if (colonyResolutionUi.discardStage && workspaceClaimsColonyRevealBatch(ev)) {
      return true;
    }
    // THE SCENE-EXIT BARRIER: exactly one card stage owns the working scene
    // at a time. A batch that has NOT presented yet waits out the PREVIOUS
    // stage's whole exit — see `cardStageExitBusy` (the ONE join of every
    // exit-shaped completion signal). The `revealPresented` latch makes the
    // hold one-directional: a batch already ON the scene starts flights of
    // its own with every take, and those must never re-raise the barrier
    // under it.
    //
    // ⚠️ …AND IT IS BOUNDED (`revealExitBarrierPassed`). It used to be
    // «completion signals only — never a timeout», and every term of
    // `cardStageExitBusy` is a CLIENT-derived motion flag: a hand-delivery
    // episode or a card-exit flight whose completion is missed withholds the
    // NEXT batch for the rest of the session. Measured on the second cycle of
    // a multi-settlement Pluto payout (1 in ~6 runs of
    // `console-pluto-two-colony-sequence`): the claim live, the zone
    // published, the browse yielded — and no reveal anywhere, i.e. «КОЛОНИИ ›
    // ПЛУТОН › БОНУС ВЛАДЕЛЬЦА» over an empty frame with a mandatory card
    // owed and no surface to answer it. A sequencer may reorder beats; it may
    // never be the reason the game cannot go on.
    return !revealPresented(ev.id) && exitBarrierHolds(ev.id);
  });

  /**
   * WHICH BATCH THE SCENE-EXIT BARRIER IS WITHHOLDING RIGHT NOW (undefined =
   * none). The net below rides this, so the wait is per batch: releasing one
   * says nothing about the next, and a batch that has already been let
   * through is never held again.
   */
  const exitBarrierHeldBatch = computed((): number | undefined => {
    const ev = currentRevealEvent();
    if (ev === undefined || revealPresented(ev.id) || revealExitBarrierPassed.value === ev.id) {
      return undefined;
    }
    return shell.cardStageExitBusy ? ev.id : undefined;
  });

  /**
   * WHERE THE DECK-CHECK VERDICT PRESENTS — nowhere, the full-bleed band, or
   * RE-HOMED into the claiming workspace's own zone. The pure decision, fed
   * from the claim (which survives a park) and the composer's mirror.
   */
  const ownResultRevealPresentation = computed((): ResultRevealPresentation => {
    const lr = shell.playerView.lastReveal;
    return resultRevealPresentation({
      // …AND THE SAME STAGE GATE. A copied action is not only a draw: repeat
      // «Поиск жизни» at stage 7 and the server turns a card over inside the
      // response that answers the stage-5 pick, exactly as it draws — and
      // `lastReveal` reaches this computed with nothing between it and the
      // screen. `action` is the ACTING card, so the gate reads it directly.
      // (The artifact families a copied action can produce, and the stance of
      // each, are declared in `hydroStepAdmission.COPIED_ACTION_STANCES` and
      // guarded by `tests/console/copiedActionStageGuard.spec.ts`.)
      present: lr !== undefined && !hydroStepQueuedFor(lr.action),
      acknowledged: lr !== undefined && `${lr.action}|${lr.revealed.name}` === dismissedRevealKey.value,
      workspaceOwns: workspaceClaimsDeckCheck(lr?.action),
      // «ДЕЙСТВИЯ КАРТ» owns a verdict stage of its own (hero column + deck
      // flight + source FLIP); every other host takes the re-homed overlay.
      // (…except a card played THROUGH A LAW, RX36: its verdict is a play's outcome — the re-homed overlay.)
      hostDrawsItself: workspaceOutcomeState.host === 'card-actions' && !lawPlayOutcomeLive(),
      stageMounted: lr !== undefined && lr.action === consoleActionComposerUi.revealClaim,
    });
  });

  /**
   * THE SCENE LEASE, reported where it is DECIDED: the batch the shell
   * admits to present (`consoleRevealMode === 'drawn'`) latches
   * `revealPresented` — the scene-exit barrier (`revealHeldForWorkspace`)
   * then can never re-raise under this batch's own take flights. Marked
   * HERE and not in the overlay: the overlay's instance persists across a
   * batch switch, and its own watcher fired one flush before the shell's
   * v-if could hold the NEXT batch — marking it presented while the
   * previous stage's exits were still playing, which is exactly the window
   * the barrier exists for.
   */
  const presentedDrawnRevealId = computed((): number | undefined => {
    return consoleRevealMode.value === 'drawn' ? currentRevealEvent()?.id : undefined;
  });

  const consoleRevealMode = computed((): ConsoleRevealMode | undefined => {
    if (revealHeldForWorkspace.value) {
      return undefined;
    }
    if (rawDrawnRevealPending.value) {
      // ONE VISIBLE CARD BATCH PER FRAME — for the UNCLAIMED batch too.
      // The workspace barrier above is claim-gated by construction, so a
      // batch whose claim had already ended (or that never had one) used
      // to mount the standalone band while the previous stage's exits
      // still played. The same exit join holds it here: it opens on the
      // real completions, and the presented latch keeps the hold
      // one-directional exactly as it does for the claimed path.
      const ev = currentRevealEvent();
      if (ev !== undefined && !revealPresented(ev.id) &&
          (exitBarrierHolds(ev.id) || shell.hydroQueuedRevealForLaterStep ||
           // …and a batch the ADOPTION net is about to claim/re-home holds
           // for that one flush — never the standalone band for a frame and
           // an embedded stage the next (see `outcomeAdoptionPending`).
           shell.outcomeAdoptionPending)) {
        return undefined;
      }
      return 'drawn';
    }
    // A verdict a WORKSPACE owns is ITS stage — either drawn by the host
    // itself («Действия карт») or the SAME overlay re-homed into its zone
    // («Проверка проекта», the Hydronetwork's copy). Only what nobody claimed
    // rises as the full-bleed band. See `resultRevealPresentation`.
    if (ownResultRevealPresentation.value !== 'none') {
      // Claimed but the zone is not there yet → hold, exactly like a claimed
      // drawn batch: never our own band for a frame and somewhere else the
      // next one.
      return ownResultRevealPresentation.value === 'embedded' &&
        workspaceOutcomeZone() === '' ? undefined : 'result';
    }
    if (revealViewerState.open) {
      return 'viewer';
    }
    return undefined;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * A COLONY-BONUS DISCARD routed to its owner. Two moments reach here:
   *  · the ENTRY (remote bonus / reload) — the batch is still on the table:
   *    the workspace + bonus stage open and the reveal runs its course; the
   *    discard step opens later from the reveal's own closer;
   *  · the CLOSER (every card taken) — the hand mounts INSIDE the colony
   *    workspace as a step (`hosts: 'inFlow'`), and the crumb reads
   *    «КОЛОНИИ › <колония> › СБРОС КАРТЫ». Never a second workspace root.
   */
  /** Is the scene-exit barrier still withholding THIS batch? (bounded — see
   *  `REVEAL_EXIT_BARRIER_NET_MS`). */
  function exitBarrierHolds(id: number): boolean {
    return shell.cardStageExitBusy && revealExitBarrierPassed.value !== id;
  }

  // ── the dock ↔ hand-overlay REVEAL episodes (handRevealDirector) ──────
  /**
   * OPEN the hand as a physical reveal: mount the overlay HELD (slots
   * invisible, chrome arriving), measure both ends in one read batch,
   * then fly one proxy per card dock → slot (backs flip to faces around
   * the edge, centre-out fan). Reopening mid-close reverses the running
   * gather instead. Falls back to the plain section switch when the
   * geometry isn't measurable.
   */
  async function openHandWithReveal(opts?: {keepTask?: boolean, overlay?: boolean}): Promise<void> {
    if (isHandRevealEpisodeRunning()) {
      if (handRevealState.phase === 'closing') {
        reverseHandReveal(); // reopen mid-close: same timeline, back to open
      }
      return;
    }
    if (consoleState.section === 'hand') {
      return;
    }
    // SINGLE-OWNER: the bodies ARE the visible pack, wherever the pose
    // ride has them this instant — the episode seizes them in place, so
    // no snapshot, no pose latch and no dock measure exist any more.
    // `keepTask`: the Game Start Workspace's play-from-hand step OPENS the
    // hand because of a live prompt — deferring it would be the opposite of
    // navigating away, and would drop the very claim that keeps the hand
    // inside the workspace. Everything below (the real dock → slot
    // choreography) is exactly the same, which is the point: the player
    // gets the hand opening they already know.
    if (opts?.keepTask !== true) {
      shell.deferShellTask('hand'); // navigation-away (the RT path's contract)
    }
    // ARM THE ART FIRST — before the section mounts, before the two
    // measuring frames. Every proxy mounts a premium face, and a face whose
    // webp is not decoded yet paints a BLACK art window and then fades the
    // picture in over 240ms; a hand full of those is the «карты без артов»
    // half of the open's flicker. The mount + measure + lift ahead of the
    // flight is exactly the head start the decode needs.
    preloadPremiumCardArt(shell.handEntriesAll.map((e) => e.card.name));
    // Phase BEFORE the section flip: the section watcher must see a
    // director-owned transition, not an untracked open (which would lift
    // the dock instantly and skip the choreography).
    handRevealState.phase = 'opening';
    handRevealState.holdSlots = true;
    handRevealState.chrome = 'held'; // the album's chrome comes in its own beats (PL-508)
    // The dock stands FULL for the whole opening — its backs are the flight
    // sources, so the pose must not change while they are measured. The
    // lease covers the pre-install window too (measure + two frames), which
    // is precisely where the old flag-reading accent could latch forever.
    const releaseAccent = beginDockIntakeAccent('hand-open');
    try {
      shell.openHandWorkspace({overlay: opts?.overlay});
      await shell.$nextTick();
      // Two frames: the grid measures itself + ensureSelectedVisible seats
      // the scroll — the targets below are the settled layout. Bounded: an
      // idle compositor withholding rAF must not latch `opening` forever.
      await settledPaint();
      const section = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
      const t: HandTransitionTargets = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      const pairs: Array<RevealPair> = t.pairs.map((p) => ({
        name: p.name, target: p.rect, visible: p.visible, clip: p.clip, visual: revealVisualFor(p.name),
      }));
      await runHandOpenEpisode(pairs, t.stage);
    } finally {
      releaseAccent();
    }
  }

  /**
   * CLOSE the hand as the physical gather: measure the LIVE slot rects
   * (current scroll/filter), fly the cards back into the dock's exact
   * back positions (faces flip back-side-out on approach). `B` mid-open
   * never reaches here — handleSectionBack reverses the running episode.
   */
  async function closeHandWithReveal(exclude?: ReadonlySet<string>): Promise<void> {
    if (isHandRevealEpisodeRunning() || consoleState.section !== 'hand' || shell.handClosePreparing) {
      return;
    }
    // A GATHER NEEDS A GRID TO GATHER FROM. With the shelf parked behind a
    // stage its slot rects describe a grid that is not on screen, so the
    // flight would depart from nowhere — the silent return owns that ending
    // (see `handCardsBelongToDock`), and it has usually already run.
    if (shell.handAlbumParked) {
      settleHandHome(exclude);
      shell.leaveHandAfterAnswer(); // the episode's own `setSection` hook, spelled out
      return;
    }
    // THE LANDING POSE IS THE FULL POSE — the accent begins BEFORE anything
    // is measured. While the album is open the dock rests COMPACT; targets
    // measured in that pose landed the whole pack in miniature, and the
    // real backs then materialized full-size in one frame (the reported
    // «прилёт → мгновенно обычный размер»). The latch covers the one tick
    // this now takes (a second B in it must not race a second gather).
    shell.handClosePreparing = true;
    const releaseAccent = beginDockIntakeAccent('hand-close');
    try {
      await shell.$nextTick(); // the FULL pose (intake snap) lands before the measure
      if (isHandRevealEpisodeRunning() || consoleState.section !== 'hand') {
        return;
      }
      const section = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
      const t: HandTransitionTargets = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};
      // The landing targets are ANALYTIC (the bodies layer's pose oracle):
      // no dock measure, no provisional berths, no retarget races.
      const pairs: Array<RevealPair> = [];
      for (const p of t.pairs) {
        // `exclude` = cards that are NOT going home. The discard cinematic owns
        // them on its own layer and is carrying them the other way, so flying
        // their bodies to the dock would fight it and, worse, would land them
        // in a pack they already left.
        if (exclude?.has(p.name) === true) {
          continue;
        }
        pairs.push({name: p.name, target: p.rect, visible: p.visible, clip: p.clip, visual: revealVisualFor(p.name)});
      }
      await runHandCloseEpisode(pairs, t.scrollTop, t.stage);
    } finally {
      shell.handClosePreparing = false;
      releaseAccent();
    }
  }

  /** A TAKE from the external-draw workspace — the ordinary submit funnel.
   *  (No defer counterpart exists on purpose: the workspace is locked.) */
  function onExternalDrawSubmit(response: unknown): void {
    shell.submit(response);
  }

  /**
   * «THE LEDGER PAYS» — a batch of the payout was taken. The claim stays for
   * the rest of the payout (re-armed: its next batch may be a response away),
   * and a discard the same row owes (Pluto's pair) is the NEXT STEP of the
   * very action that drew the card: the take is its acknowledgement, so the
   * mandatory beat is acknowledged here and the hand opens inside the action
   * workspace once the intake has landed the card (`consoleForegroundBusy`'s
   * falling edge; now, if it already has) — never announced, never lateral.
   */
  /**
   * IS THIS BATCH PARKED — the ONE verdict of every park family, for the queue, the occupancy and the pending
   * signal alike («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР», R7): a park holds a batch by its ROOT (the first segment's
   * source — a foreign trade's delivery behind its announcement, the Agenda CARD step behind the sitting's
   * glide, a ledger row behind its turn, a change-of-power answer behind the enactment tact), and the BOARD
   * BEAT holds only a batch no workspace claims: a merged batch whose Venus-scale card rides beside the played
   * card's own presents in the workspace (its scale run starts from the peek), never out of line waiting for a
   * board the very workspace covers — that wait was a deadlock by construction.
   */
  function revealBatchParked(batch: CardIntakeBatchRef): boolean {
    const root = batch.source;
    return remoteColonyBonusParksReveal(shell.remoteColonyBonusPending, root) ||
      parliamentParksReveal(root) ||
      rulingChangeParksReveal(root) ||
      colonyBonusPayoutParksReveal(root) ||
      (!workspaceClaimsRevealBatch(batch) && boardBeatParksReveal(root));
  }

  /**
   * The reveal modal's closing step was pressed: the payout's discard now runs
   * on its ordinary surface (the hand overlay in select mode — single-select
   * for one card, multi-select + confirm for several, exactly as any other
   * discard). The press is the acknowledgement of the mandatory beat, so the
   * announcement card is skipped and the player lands straight in the hand —
   * the payout continues instead of restarting as a fresh demand.
   */
  /**
   * The last card of an EMBEDDED batch has been taken. The claim is released
   * here — the shell owns the re-homed instance, so it owns the end of its
   * life — and the workspace folds its own stage back to browse off the
   * composer's `outcome-done`. Releasing here (rather than only in the
   * workspace) also covers the case where the workspace has already gone.
   */
  function onEmbeddedDrawnComplete(): void {
    // «ПРИЁМКА»: a batch the Parliament hosted was nobody's workspace outcome — nothing to release, nothing to fold.
    if (shell.revealParliamentLatch) {
      return;
    }
    const host = workspaceOutcomeState.host;
    // A COLONY RESOLUTION outlives any one of its batches: the mandatory
    // discard, the next colony's cycle and the closing track reset are still
    // this claim's flow. The claim releases on the RESOLUTION's own falling
    // edge (the colonyResolutionLive watcher) — releasing per batch is what
    // used to fold the workspace between the reveal and the discard.
    if (host === 'colonies' && shell.colonyResolutionLive) {
      return;
    }
    // …and A LEDGER PAYOUT outlives every one of its batches (TR23): the take
    // is one row's half — its discard, the next pair, the rows after it are
    // still this claim's. It re-arms for whatever comes next and ends with
    // the payout (`onLedgerDone` in the action workspace).
    if (shell.ledgerPayoutClaimed) {
      shell.continueLedgerPayoutAfterTake();
      return;
    }
    // …and a PLAY'S CHAIN outlives its batch the same way: the press also
    // woke an optional EFFECT («Рециклон» answering the building tag), and
    // that prompt has been standing in `waitingFor` since the play's own
    // response. The claim stays — the decision teleports into this very zone
    // once the intake settles, and the flow concludes when IT is answered
    // (the reconciler's release → `handOutcomeLive`'s falling edge).
    if (shell.playEffectOwed) {
      shell.handEffectStageOn();
      return;
    }
    // …AND THE PLAY'S OWN «WHERE?» FOLLOWS ITS DRAW (TRP9 Medical Institute, PL-1117): the prelude draws a card, then
    // asks which card takes its microbe / data — a TARGET pick the claim admits (`pick`, `taskEmbedTarget`), standing
    // in `waitingFor` since the play's response. Released here, it rose as the task host's own band over the start.
    // The claim is KEPT AS IT IS — never re-posed to `awaiting` (the rehome law: `embedPresenting` would stay false
    // and the zone would stand empty); the reconciler releases it once the pick is answered. Structural on the raw
    // prompt (`playOwesTargetPick`), the same test the start scene's own release asks.
    if (isPlayOutcomeHost(host) && playOwesTargetPick(shell.playerView.waitingFor)) {
      return;
    }
    // …AND A QUEUED SIBLING BATCH KEEPS THE LEASE. One press's chain can
    // produce SEVERAL reveal batches (a traversal's stage draw + its
    // repeat's own; a chained follow-up draw landing in the take's
    // response), and the server's own queue is the race-proof witness.
    // Released here, the next batch was claimless: it skipped the
    // claim-gated scene-exit barrier and rose as the STANDALONE band over
    // a workspace still playing this batch's exits — two batches on one
    // frame, ladder-small cards, no dim. The claim RE-ARMS for it instead
    // and the same barrier + embed zone serve it as the next stage.
    const next = drawnCardsState.events.find((e) =>
      !e.dismissed && e.cards.length - e.takenIndices.size > 0);
    if (next !== undefined ||
        (host === 'hydro' && hydroTraversalPending())) {
      retainWorkspaceOutcomeForNextBatch(next?.cards.length ?? 0);
      return;
    }
    // The Reds' batch (see `onWorkspaceResultDetached`): the claim ends
    // with the take; the flow's next step is armed, idempotently.
    if (shell.partyDiscardStepOwed) {
      releaseWorkspaceOutcome('drawn-complete', {force: true});
      shell.armPartyDiscardStep();
      return;
    }
    // FORCED: the last card's take IS the answer — the artifact being
    // consumed is the one licence to end a serving claim (an unforced call
    // here would be refused while `rawDrawnRevealPending` covers the
    // dismissal tick, orphaning the claim until its backstop).
    releaseWorkspaceOutcome('drawn-complete', {force: true});
    shell.foldWorkspaceAfterResult(host);
  }

  function onRevealDiscardPick(): void {
    // The LEDGER's pair (Ф4): the closing step is the action workspace's own hand step.
    if (shell.ledgerDiscardStepOwed) {
      shell.openLedgerDiscardStep();
      return;
    }
    const beat = shell.mandatoryBeat;
    if (beat !== undefined) {
      acknowledgeMandatoryBeat(beat.key);
    }
    void shell.$nextTick(() => {
      const task = taskFor(shell.playerView);
      if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
        shell.openShellTaskSurface(task);
      }
    });
  }

  /**
   * Replay the dock → grid reveal for a hand that came back from the PARK
   * (its frame already stands — `openHandWithReveal` would push a second
   * one). The measure loop rides the restore's own teleport chain: the
   * host re-mounts, publishes its zone, the hand teleports in, the grid
   * solves its fit — a few frames, bounded, with the honest instant-open
   * degrade when nothing becomes measurable.
   */
  async function replayHandOpenReveal(): Promise<void> {
    if (isHandRevealEpisodeRunning()) {
      return;
    }
    // SINGLE-OWNER: the bodies stand wherever they stand — the episode
    // seizes them in place; only the album targets need measuring.
    const releaseAccent = beginDockIntakeAccent('hand-open');
    try {
      await shell.$nextTick();
      let t: HandTransitionTargets = {pairs: [], scrollTop: 0};
      for (let i = 0; i < 10 && t.pairs.length === 0; i++) {
        await new Promise((r) => requestAnimationFrame(() => r(undefined)));
        const section = (shell.$refs.handSection ?? undefined) as InstanceType<typeof ConsoleHandSection> | undefined;
        if (section !== undefined) {
          t = section.transitionTargets();
        }
      }
      const pairs: Array<RevealPair> = t.pairs.map((p) => ({
        name: p.name, target: p.rect, visible: p.visible, clip: p.clip, visual: revealVisualFor(p.name),
      }));
      await runHandOpenEpisode(pairs, t.stage);
    } finally {
      releaseAccent();
    }
  }

  // ── T6: reveal-result ack + notification CTAs ────────────────────────
  /**
   * «ОК» on the deck-check result: mark seen until the server clears it.
   *
   * …and, when the verdict stood as a WORKSPACE'S OWN STAGE (the overlay
   * re-homed into its zone — a repeated action played from the hand, the
   * Hydronetwork's copy), this press is also the end of what that workspace
   * was holding: the claim is released and the ONE guarded conclusion is
   * asked, exactly as «ДЕЙСТВИЯ КАРТ» does through `onCardActionsRevealAck`.
   * Without it the claim would stand until its 20 s backstop with nothing on
   * screen, and the flow could never conclude.
   *
   * The card-actions host is carved out because it acks through its OWN path
   * (it draws its own verdict stage and releases the claim there); calling
   * both would release twice and conclude a workspace that is mid-fold.
   */
  function onDismissRevealResult(): void {
    const lr = shell.playerView.lastReveal;
    if (lr !== undefined) {
      dismissedRevealKey.value = `${lr.action}|${lr.revealed.name}`;
    }
    const host = workspaceOutcomeState.host;
    if (host !== undefined && (host !== 'card-actions' || lawPlayOutcomeLive()) && workspaceClaimsDeckCheck(lr?.action)) {
      // The dismissal marker above is set FIRST, so an acked verdict has
      // already stopped serving — the funnel refuses only when the SAME
      // claim still owes something else (a `chain` claim's follow-up pick
      // riding the same press): then the claim stays for that leg and the
      // workspace must NOT fold out from under it.
      if (releaseWorkspaceOutcome('reveal-result-ack')) {
        shell.foldWorkspaceAfterResult(host);
      }
    }
  }

  /** «ОК» on the IN-FRAME reveal phase (the Action Focus stage): mark the
   *  reveal seen exactly like the standalone overlay's OK, and release the
   *  stage's claim so a FUTURE reveal routes normally. */
  function onCardActionsRevealAck(): void {
    // The Viron in-frame reveal (the ONLY repeat-reveal that runs INSIDE the
    // Action Center — its own entry point) acks back to the browse grid.
    // ProjectInspection reveals never reach here — they ride the standalone
    // reveal overlay and ack to the board (its entry point was card play).
    onDismissRevealResult();
    resetConsoleActionRevealClaim();
  }

  /**
   * The card's LANDED grid presentation, carried by the reveal/filter
   * proxies so the settled state is readable DURING the flight and can
   * never pop at the handoff. Mirrors the section's slot exactly: browse →
   * unplayable dim + the `shortBlockerLabel` chip; select/pick → the strong
   * select-disabled dim + «Unavailable»; sale shows the whole hand undimmed.
   *
   * The LIVE MODEL rides along UNCONDITIONALLY — it is the biggest half of
   * «the same card lands». The grid slot renders `<Card :card>`, so without
   * it the flying face loses the discount chip and the stored-resource
   * capsule, drops the disabled wash, and — because the cost chip widens the
   * title's left safe-area — even re-sizes and re-wraps the card's NAME.
   * That is why this returns a presentation for every card now instead of
   * `undefined` for «nothing special»: there is no such thing as a card with
   * nothing to carry.
   */
  function revealVisualFor(name: CardName): RevealVisual {
    const entry = shell.handEntriesAll.find((e) => e.card.name === name);
    const card = entry?.card;
    if (consoleState.sale.active) {
      return {card};
    }
    if (shell.handSelectUiActive) {
      return shell.handSelectSelectableNames.includes(name) ?
        {card} :
        {card, dim: 'strong', chip: 'Unavailable'};
    }
    // Mirrors the slot: the dim belongs to the RULES verdict, never to the
    // turn — a card the player simply cannot play YET lands bright.
    if (entry === undefined || entry.potential) {
      return {card, playable: entry?.playable === true};
    }
    return {card, dim: 'soft', chip: shortBlockerLabel(entry.card.unplayableReasons ?? []),
      chipEmblem: unplayableReasonChip(entry.card.unplayableReasons ?? [])};
  }

  /** «ПРИЁМКА»: where the reveal stands — a NEW home re-latches; «nowhere» keeps the last (see the data field). */
  function whenRevealEmbedTargetChanges(target: string | undefined): void {
    if (target !== undefined) {
      shell.revealParliamentLatch = target === PARLIAMENT_DRAW_ZONE;
    }
  }

  /**
   * THE ENTRY'S WAIT IS OVER THE MOMENT THE PAYOUT IS REAL. From here on the
   * resolution stands on server evidence alone and the entry is context —
   * which is what makes the falling edge below reachable at all. (Immediate,
   * because a resolution already running when this shell mounts — a reload
   * straight into one — has no rising edge left to give.)
   */
  /**
   * THE BARRIER'S NAMED NET. Completion signals stay the primary release —
   * this only guarantees the wait ENDS (see `revealHeldForWorkspace`).
   */
  function whenExitBarrierHeldBatchChanges(id: number | undefined): void {
    if (revealExitBarrierNetId.value !== undefined) {
      window.clearTimeout(revealExitBarrierNetId.value);
      revealExitBarrierNetId.value = undefined;
    }
    if (id === undefined) {
      return;
    }
    revealExitBarrierNetId.value = window.setTimeout(() => {
      revealExitBarrierNetId.value = undefined;
      revealExitBarrierPassed.value = id;
    }, REVEAL_EXIT_BARRIER_NET_MS);
  }

  // The deck pick's life ended (submitted, closing beats done) — release a
  // hydro claim so the resolution can settle. (The card-actions host has
  // its own release doors; the hydro host's is this falling edge.)
  // ⚠ A DEFER also drops `deckPickActive` — but the decision still stands
  // in the park, so the claim must survive it for the restore.
  // ⚠⚠ And so must a claim ALREADY SERVING THE NEXT BATCH: the response
  // that answered the pick drains the parked tail inside its own request,
  // so a traversal repeat's drawn cards arrive while the pick's closing
  // beats still play — released here, their teleport zone died with the
  // claim and the batch rose as the standalone band over the track. The
  // client-side `rawDrawnRevealPending` is NOT enough evidence: it is
  // false BY DESIGN while the deal/closing beats hold, and this falling
  // edge lands exactly there — the SERVER's own unconsumed reveal and the
  // still-standing leg plan are the race-proof witnesses. The claim then
  // ends where every drawn batch ends: at the take (`drawn-complete` /
  // `result-detached`), or with the flow (`hydro-flow-complete`).
  // ⚠⚠⚠ And this falling edge is an ADMISSION-GATED blink, not «answered»:
  // `deckPickActive` rests on `admits('host')` before the submit, so any
  // host block (a presentation hold, an announce gate, a card arrival)
  // drops it while the pick prompt still stands in `waitingFor`. The RAW
  // serving fact is the discriminator — and the release funnel refuses the
  // call anyway, so this term is the honest predicate, not the protection.
  function whenDeckPickActiveChanges(active: boolean): void {
    // The batch witness is OWNERSHIP-SCOPED (`workspaceOutcomeBatchServed`
    // — the funnel's own probe: the server's unconsumed reveals AND the
    // client's pending flag, each judged by the batch's SOURCE). The raw
    // pair it replaces (`rawDrawnRevealPending` + a bare
    // `cardDrawReveals.length === 0`) also counted FOREIGN batches — an
    // out-of-band delivery's echo then blocked this release until the 20 s
    // claim safety, the same wedge class as the close gate's.
    if (!active && !consoleState.task.deferred &&
        workspaceOutcomeState.host === 'hydro' &&
        hydroFlowState.commit !== undefined &&
        !shell.workspaceOutcomeServingNow &&
        !deckDrawHolds() &&
        !hydroTraversalPending()) {
      releaseWorkspaceOutcome('hydro-pick-done');
    }
  }

  // The batch the shell ADMITS to present takes the scene lease — the
  // scene-exit barrier is one-directional from this frame on (see the
  // computed's own doc). `immediate`: a batch can already be presenting
  // when the shell (re)creates this watcher graph.
  function whenPresentedDrawnRevealIdChanges(id: number | undefined): void {
    if (id !== undefined) {
      markRevealPresented(id);
    }
  }

  // THE EXTERNAL-DRAW WORKSPACE'S FRAME — the draft's lifecycle contract:
  // the rising edge opens NOTHING (the mandatory announce + the player's A
  // stand the frame up), the falling edge closes it. The predicate keeps
  // `externalDrawHolding()` true through the last take's flight, so the
  // workspace folds only after the card has physically reached the dock.
  function whenExternalDrawFrameLiveChanges(live: boolean): void {
    if (!live) {
      closeWorkspaceRoot('external-draw');
      resetExternalDraw();
    }
  }

  return {
    releaseRevealQueuePark,
    revealExitBarrierNetId,
    revealExitBarrierPassed,
    dismissedRevealKey,
    releaseRevealParkSupplier,
    handRevealTransit,
    revealOverlayMode,
    deckPickActive,
    deckPickBelongsToWorkspace,
    deckPickHeldForWorkspace,
    deckPickEmbedTarget,
    deckPickServing,
    revealSourceSeatStands,
    externalDrawEmbedTarget,
    externalDrawWorkspaceMounted,
    externalDrawFrameLive,
    externalDrawEmbedded,
    externalDrawOwnsPad,
    rawDrawnRevealPending,
    revealDiscardCloser,
    revealEmbedTarget,
    revealHeldForWorkspace,
    exitBarrierHeldBatch,
    resultRevealPresentation: ownResultRevealPresentation,
    presentedDrawnRevealId,
    consoleRevealMode,
    exitBarrierHolds,
    openHandWithReveal,
    closeHandWithReveal,
    onExternalDrawSubmit,
    revealBatchParked,
    onEmbeddedDrawnComplete,
    onRevealDiscardPick,
    replayHandOpenReveal,
    onDismissRevealResult,
    onCardActionsRevealAck,
    revealVisualFor,
    whenRevealEmbedTargetChanges,
    whenExitBarrierHeldBatchChanges,
    whenDeckPickActiveChanges,
    whenPresentedDrawnRevealIdChanges,
    whenExternalDrawFrameLiveChanges,
  };
}

export type RevealController = ReturnType<typeof createRevealController>;
