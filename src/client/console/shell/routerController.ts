/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ROUTER CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {addressed} from '@/common/inputs/preselectAddress';
import {computed, ref} from 'vue';
import {promptReceiveArmed, promptReceiveState} from '@/client/console/cardReceive/promptReceive';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {isReduxParty, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {Payment} from '@/common/inputs/Payment';
import {SelectCardModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {choiceSeriesKeyOf, seriesVisitStands} from '@/client/console/promptSeries';
import {transportState, SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {maFocusState, openMaFocus, discardMaFocusDraft} from '@/client/console/consoleMaFocus';
import {ConsoleHandEntry} from '@/client/components/console/consoleHandSectionTypes';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {startPreludeGrantOf} from '@/client/console/parliament/hostedParliamentStep';
import {buildEffectDecision, declineModelOf, EffectDecisionAction, EffectDecisionSource, EffectDecisionViewModel, nextStageKeyOf} from '@/client/console/effectDecision/effectDecisionModel';
import type {DeclineModel} from '@/client/console/optionalChoice';
import {decisionPromptStamp, effectDecisionState, markDecisionPickAnswered, resetDecisionFocus} from '@/client/console/effectDecision/effectDecisionState';
import {stackYieldedToBoard, yieldedStackCards, enterWorkspace, frameServing, goBoardHome, pushWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameMounted, workspaceFramePhase, workspaceFrameSubject, workspaceFrameHost, workspaceFrameKnown, workspaceHostForStep, FrameAnchor, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {isCommitted} from '@/client/console/consoleWorkspaceFlow';
import {cardDiscardTransaction} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyBonusCollectOf, colonyBonusDiscardOf} from '@/client/console/colonyTrade/colonyResolution';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';
import {draftPaymentPending} from '@/client/console/draft/consoleDraftFlow';
import {externalDrawResolutionOf, externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';
import {Phase} from '@/common/Phase';
import {colonyFocusState} from '@/client/console/consoleColoniesModel';
import {consoleStartState} from '@/client/console/consoleStartState';
import {energyConversionState} from '@/client/components/feedback/energyConversionTransition';
import {ConsoleTask, taskFor, taskServedByHost, shellTaskOnSurface, followUpStepStage, NATIVE_COMPOSITE_KINDS, SECTION_SERVED_KINDS, SHELL_SECTION_KINDS, corpFirstActionInStartFlow, startStepDiscardOf, DELEGATE_GRANT_STEP_STAGE, partyStepStageOf, firstActionPartyStep} from '@/client/console/consoleTaskRouter';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {buildBotAttackView, BotAttackViewModel} from '@/client/console/botAttack/botAttackModel';
import {cardGrantOwedTo} from '@/client/console/cardGrantHost';
import {cardsResponse, orOptionResponse, orWrappedResponse} from '@/client/console/taskResponses';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {preludeChainOn, preludePlayChainState} from '@/client/console/deckPick/preludePlayChain';
import {workspaceClaimsVenusBonus, workspaceClaimsEffect, workspaceClaimsPick, workspaceOutcomeClaimed, workspaceOutcomeBeatPending, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomeArrivalDone, markWorkspaceOutcomeBeatDone, markWorkspaceOutcomePresenting, setWorkspaceOutcomePhase, workspaceOutcomeState, workspaceOutcomeZone} from '@/client/console/consoleWorkspaceOutcome';
import {claimPlayOutcome, isPlayOutcomeHost} from '@/client/console/played/consolePlayOutcomeClaim';
import {isBoardCardBonusActive} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {deckDrawHolds} from '@/client/console/deckDraw/consoleDeckDraw';
import {cardReactionTellsTableAnswer} from '@/client/console/cardReaction/cardReactionDirector';
import {colonyBuildAnswered} from '@/client/console/colonyBuild/consoleColonyBuild';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {consoleHandPickState, enterConsoleHandPick, handPickStageKey} from '@/client/console/consoleHandPick';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {AdmissionSignals, LATCHED_SURFACES, PromptSurface, isPromptAdmitted, isPromptPresent, latchPromptPresence, presenceOutlivesAnswer, promptPresenceState, releasePromptPresence} from '@/client/console/consolePromptAdmission';
import {guardedAdmissionSignals, noteAdmissionSignals} from '@/client/console/consoleForegroundWatchdog';
import {stagedPlayState, stagedPlacementOf} from '@/client/console/stagedPlay';
import {SeriesVisit, PendingClientPayment, PendingClientPick, CLIENT_PAYMENT_TASK, CLIENT_PICK_TASK} from '@/client/console/shell/shellShared';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {RevealController} from '@/client/console/shell/revealController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {DraftController} from '@/client/console/shell/draftController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {MaController} from '@/client/console/shell/maController';
import type {CardActionsController} from '@/client/console/shell/cardActionsController';
import type {StdProjectsController} from '@/client/console/shell/stdProjectsController';
import type {StartController} from '@/client/console/shell/startController';
import type {MandatoryController} from '@/client/console/shell/mandatoryController';
import type {SeatController} from '@/client/console/shell/seatController';
import {setQuestionAside, takeUpQuestion} from '@/client/console/setAside';

/** The standard projects' step zone — the hosted payment / pick / Venus bonus re-home there (one literal). */
const STDP_STEP_ZONE = '.con-stdp [data-embed-slot="stdp-step"]';

/** The hosted Venus bonus's stage name in its host's crumb (P89 · EE) — «БОНУС ВЕНЕРЫ». */
const VENUS_BONUS_STAGE = 'Venus bonus';

/** The sitting's reward-stage zone (published by `ConsoleParliamentSitting` — `consoleParliamentUi.stageZone`). */
const SITTING_STAGE_ZONE = '.con-parl [data-embed-slot="parliament-stage"]';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type RouterPort = {
  boardStoryBeforePlacement: UnwrapRef<PlacementController['boardStoryBeforePlacement']>,
  cancelClientPick(): void,
  chainPlacementOrderEmbedded: UnwrapRef<PlacementController['chainPlacementOrderEmbedded']>,
  closeHandWithReveal: UnwrapRef<RevealController['closeHandWithReveal']>,
  collapseWorkspace(): void,
  coloniesForRail: UnwrapRef<ColonyController['coloniesForRail']>,
  colonyPick: UnwrapRef<ColonyController['colonyPick']>,
  colonyStepReturnGatesPrompt: UnwrapRef<ColonyController['colonyStepReturnGatesPrompt']>,
  consoleRevealMode: UnwrapRef<RevealController['consoleRevealMode']>,
  corpFirstActionOpen: UnwrapRef<PlayedController['corpFirstActionOpen']>,
  deckPickActive: UnwrapRef<RevealController['deckPickActive']>,
  deckPickBelongsToWorkspace: UnwrapRef<RevealController['deckPickBelongsToWorkspace']>,
  deckPickEmbedTarget: UnwrapRef<RevealController['deckPickEmbedTarget']>,
  deckPickHeldForWorkspace: UnwrapRef<RevealController['deckPickHeldForWorkspace']>,
  draftClaimsTask: UnwrapRef<DraftController['draftClaimsTask']>,
  enterWorkspaceAfterHandoff(kind: WorkspaceFrameKind, opts: {anchor: FrameAnchor}): void,
  externalDrawWorkspaceMounted: UnwrapRef<RevealController['externalDrawWorkspaceMounted']>,
  finalePromptOwned: UnwrapRef<FinaleController['finalePromptOwned']>,
  finalGreeneryActive: UnwrapRef<PlacementController['finalGreeneryActive']>,
  focusFirstSelectableHandCard(): void,
  govSupportActive: UnwrapRef<ParliamentController['govSupportActive']>,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  readonly handPickActive: boolean,
  handPickStandsAlone(): boolean,
  readonly handSelectModel: SelectCardModel | undefined,
  readonly handSelectSelectableNames: ReadonlyArray<string>,
  hydroQueuedPromptForLaterStep: UnwrapRef<HydroController['hydroQueuedPromptForLaterStep']>,
  lawLivePlayStepOwed: UnwrapRef<ParliamentController['lawLivePlayStepOwed']>,
  ledgerDiscardStepOwed: UnwrapRef<ParliamentController['ledgerDiscardStepOwed']>,
  maScreenItems: UnwrapRef<MaController['maScreenItems']>,
  nomadMoveHolds: UnwrapRef<PlacementController['nomadMoveHolds']>,
  onCardActionsCollapse: UnwrapRef<CardActionsController['onCardActionsCollapse']>,
  openColoniesForPrompt: UnwrapRef<ColonyController['openColoniesForPrompt']>,
  openColonyBonusCollect: UnwrapRef<ColonyController['openColonyBonusCollect']>,
  openColonyBonusDiscard: UnwrapRef<ColonyController['openColonyBonusDiscard']>,
  openHandWithReveal: UnwrapRef<RevealController['openHandWithReveal']>,
  openLawLivePlayStep: UnwrapRef<ParliamentController['openLawLivePlayStep']>,
  openLedgerDiscardStep: UnwrapRef<ParliamentController['openLedgerDiscardStep']>,
  openPartyDiscardStep: UnwrapRef<ParliamentController['openPartyDiscardStep']>,
  openSheet(sheet: WorkspaceFrameKind): void,
  parliamentAnswerTask: UnwrapRef<ParliamentController['parliamentAnswerTask']>,
  parliamentBillStanding: UnwrapRef<ParliamentController['parliamentBillStanding']>,
  parliamentStageTask: UnwrapRef<ParliamentController['parliamentStageTask']>,
  partyDiscardStepOwed: UnwrapRef<ParliamentController['partyDiscardStepOwed']>,
  /** WRITTEN here. */ pendingClientPayment: PendingClientPayment | undefined,
  /** WRITTEN here. */ pendingClientPick: PendingClientPick | undefined,
  playedHeroHolds: UnwrapRef<PlayedController['playedHeroHolds']>,
  readonly playerView: PlayerViewModel,
  rawDrawnRevealPending: UnwrapRef<RevealController['rawDrawnRevealPending']>,
  remoteLandingBeforePlacement: UnwrapRef<PlacementController['remoteLandingBeforePlacement']>,
  restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean,
  resumePartyActionWorkspace(party: ReduxParty): void,
  revealOverlayMode: UnwrapRef<RevealController['revealOverlayMode']>,
  rollbackStdProjectFlow: UnwrapRef<StdProjectsController['rollbackStdProjectFlow']>,
  scaleBonusOwesStory: UnwrapRef<PlacementController['scaleBonusOwesStory']>,
  seatAwardFundingSurface(): void,
  sittingHostsVenusBonus: UnwrapRef<ParliamentController['sittingHostsVenusBonus']>,
  sittingRiseGatesPrompt: UnwrapRef<ParliamentController['sittingRiseGatesPrompt']>,
  startSceneServes: UnwrapRef<StartController['startSceneServes']>,
  stdpHostsVenusBonus: UnwrapRef<StdProjectsController['stdpHostsVenusBonus']>,
  submit(response: unknown): SubmitTicket,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  submitStandardProjectPayment: UnwrapRef<StdProjectsController['submitStandardProjectPayment']>,
  taskGateHeld: UnwrapRef<MandatoryController['taskGateHeld']>,
  taskSpacePending: UnwrapRef<PlacementController['taskSpacePending']>,
  tilePlacementHolds: UnwrapRef<PlacementController['tilePlacementHolds']>,
  viewerAskedOffTurn: UnwrapRef<SeatController['viewerAskedOffTurn']>,
  viewerHandNames: UnwrapRef<SeatController['viewerHandNames']>,
};

export function createRouterController(shell: RouterPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /** PC04 · GS — the series member the standalone host answered last (`noteSeriesAnswer`); read by `seriesHeldVisit`. */
  const seriesVisit = ref(undefined as SeriesVisit | undefined);
  /** Prompt identity — a change resets the task defer state. */
  const lastTaskKey = ref('');

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * PRESENTATION FLOW: while the player is being shown what just happened
   * (the compact AI-turn card / the opened «Разбор хода» review), the
   * console's mandatory task surfaces hold off mounting — bounded by the
   * card's TTL / the review close. The holding card / review is registered as
   * a serving surface in the leak detector, so the prompt is never "stranded".
   */
  const presentationHeld = computed((): boolean => {
    return isMandatoryPromptsHeld();
  });

  /** A console blocking foreground surface is actively presenting (drives
   *  the lease): task host / start scene / gov-support panel / the dedicated
   *  composites, plus the reveal overlays ('drawn' also derives from
   *  drawnCardsState — the lease covers the console-only 'result'/'viewer'
   *  modes too).
   *
   *  A LEASE IS A CLAIM THAT SOMETHING IS VISIBLE — so every branch here must
   *  match a surface that really renders. The two states documented as
   *  "render nowhere" are excluded explicitly: the hero beat unmounting the
   *  reveal (via `revealOverlayVisible`) and a host claimed by a workspace
   *  whose outcome slot does not exist yet (`taskHeldForWorkspace`, see its
   *  own comment). Everything else the watchdog covers as the net.
   *
   *  …AND THE CONVERSE MATTERS JUST AS MUCH: a surface that renders WITHOUT a
   *  lease can be retracted out from under the player. `mandatoryPromptsHeld`
   *  lets a flow-holding bot-turn card hold the NEXT prompt only while no
   *  mandatory lease is held — its documented fixed point ("with a surface up
   *  the hold is off and the surface stays"). The DEDICATED COMPOSITES took no
   *  lease and are gated on the very `admits('host')` that hold feeds, so a
   *  bot card arriving over «Разместите бонус шкалы Венеры» unmounted it for
   *  the card's whole TTL. Their branches are the surfaces' own `v-if`s. */
  const consoleMandatoryPresenting = computed((): boolean => {
    if (shell.revealOverlayMode !== undefined) {
      return true;
    }
    if (consoleState.task.deferred || taskHeldForWorkspace.value) {
      return false;
    }
    return (hostTask.value !== undefined && shell.taskSpacePending === undefined) ||
      shell.startSceneServes ||
      shell.govSupportActive ||
      (compositeSurfaceActive.value && !shell.deckPickHeldForWorkspace);
  });

  /**
   * THE OPTIONAL-DECISION SCREEN. A top-level `OrOptions` that the server
   * MARKED with `choiceContext` and whose every branch the adapter can serve
   * honestly becomes a decision screen instead of a list of thin rows.
   * `undefined` — for an unmarked prompt, a branch that needs a surface of
   * its own (a payment dial, a board pick), or any shape the adapter has not
   * been taught — keeps the existing task host. That is the whole migration
   * gate; there is no per-card switch anywhere.
   */
  const effectDecisionVm = computed((): EffectDecisionViewModel | undefined => {
    return hostTask.value?.kind === 'choice' ? rawEffectDecisionVm.value : undefined;
  });

  /**
   * …and the SAME decision read off the RAW prompt, with no admission gate.
   *
   * OWNERSHIP AND READINESS ARE DIFFERENT QUESTIONS (embed rule 4), and here
   * they are separated by a whole cinematic: a play's own hero scene holds
   * the task host for its entire length, so «is the decision surface up?»
   * cannot answer «is this decision the play's own?». The reconciler asks the
   * second question — the same reason a play claim reads the RAW prompt kind
   * rather than «the gate is holding something».
   */
  const rawEffectDecisionVm = computed((): EffectDecisionViewModel | undefined => {
    if (taskFor(shell.playerView)?.kind !== 'choice') {
      return undefined;
    }
    return buildEffectDecision(shell.playerView.waitingFor, {handNames: shell.viewerHandNames});
  });

  /** The decision's identity — a NEW one must not inherit a stale focus. */
  const effectDecisionKey = computed((): string => {
    const vm = effectDecisionVm.value;
    return vm === undefined ? '' : `${vm.eyebrowKey}|${vm.headlineKey}|${vm.actions.length}|${vm.source?.card ?? ''}`;
  });

  const effectDecisionActive = computed((): boolean => {
    return effectDecisionVm.value !== undefined &&
      !shell.govSupportActive && !productionLossActive.value &&
      !consoleState.task.deferred && shell.taskSpacePending === undefined &&
      !shell.handPickActive && !effectDecisionHeldForWorkspace.value;
  });

  /**
   * THE DECISION IS ITS PICK — an optional decision whose one answer is a card from the hand (Mars University's
   * discard) stands as the ALBUM, its decline inside it: the screen that asked «use the effect?» before the album was
   * a whole step with nothing to decide (the owner, 2026-10-13). Read where the decision would have stood.
   */
  const effectDecisionDirectPick = computed((): EffectDecisionAction | undefined => {
    // An answer given in that album is on the wire: the prompt it answered stands until the server moves past it,
    // and re-opening on it would ask the question twice.
    const answered = effectDecisionState.pickAnsweredAt;
    if (answered !== '' && answered === decisionPromptStamp(shell.playerView)) {
      return undefined;
    }
    return effectDecisionActive.value ? effectDecisionVm.value?.directPick : undefined;
  });

  /**
   * THE DECISION BELONGS TO AN OPEN WORKSPACE — the player pressed «Разыграть»
   * inside a screen and a card of theirs answered that press.
   *
   * Read off the RAW prompt for the same reason `taskBelongsToWorkspace` is
   * split from `taskEmbedTarget`: ownership is settled at submit time, long
   * before any surface may be shown. The `buildEffectDecision` term is not a
   * formality — a claim admitted for a shape this console cannot present
   * would SUPPRESS the standalone band and leave the prompt nowhere.
   */
  const effectDecisionBelongsToWorkspace = computed((): boolean => {
    // …and never a decision asked OFF the player's turn: that is another seat's chain (a rival's ocean waking the
    // viewer's Neptunian Power Consultants), whatever claim happens to be landing its cards (`closeWorkspaceOutcomeChain`).
    return workspaceClaimsEffect() && rawEffectDecisionVm.value !== undefined && !shell.viewerAskedOffTurn;
  });

  /** Claimed but not ready → render NOWHERE for the gap frame, never in a
   *  band of our own for one frame and somewhere else the next. The BEAT is
   *  part of «ready»: the play's own commit must be seen through before its
   *  consequence is put on screen. */
  const effectDecisionHeldForWorkspace = computed((): boolean => {
    return effectDecisionBelongsToWorkspace.value &&
      (workspaceOutcomeZone() === '' || workspaceOutcomeBeatPending());
  });

  const effectDecisionEmbedTarget = computed((): string | undefined => {
    // THE ADMITTED vm, not the raw one. Ownership is settled at submit time,
    // but a TARGET is a claim that something is about to be re-homed into the
    // zone — and `workspaceOutcomeEmbedded` reads it. The play's own cinematic
    // holds this prompt closed for its whole length, so the raw vm made the
    // zone «occupied» while nothing rendered in it: the crumb's tail dropped
    // to the generic «ДОБОР КАРТ» for the entire landing beat, i.e. it named a
    // stage that did not exist, one stage AHEAD of the flow.
    if (effectDecisionVm.value === undefined ||
        !effectDecisionBelongsToWorkspace.value || effectDecisionHeldForWorkspace.value) {
      return undefined;
    }
    const slot = workspaceOutcomeZone();
    return slot === '' ? undefined : slot;
  });

  /**
   * THE PLAY'S CHAIN STILL OWES AN EFFECT DECISION — a batch was only ONE
   * effect of the press, and the server is still asking the other one.
   *
   * «Акведуки» draw three cards AND wake «Рециклон» in the SAME response:
   * the batch presents first (surfaces go in turn), and the take is where
   * the flow used to end — `result-detached`/`drawn-complete` released the
   * claim and folded the workspace under a prompt that had been standing in
   * `waitingFor` the whole time, so the decision then rose as a standalone
   * band over the board. The same fact the colony resolution states with
   * `colonyResolutionLive`: a claim is the CHAIN's ownership, and no single
   * leg's end may release it while another leg is still owed.
   *
   * Structural on both sides (the server's `choiceContext` + a shape the
   * adapter can present), and scoped to the play hosts — the only claims
   * that admit `'effect'`.
   */
  const playEffectOwed = computed((): boolean => {
    return isPlayOutcomeHost(workspaceOutcomeState.host) && effectDecisionBelongsToWorkspace.value;
  });

  /**
   * THE DECISION SCREEN OWNS THIS PROMPT — it is on screen, OR briefly held
   * while the workspace that will host it publishes its zone.
   *
   * The TASK HOST must stand down for both. `effectDecisionActive` alone
   * suppresses it only for the first, so the hold would hand a marked
   * decision to the generic band for the gap frame — a modal blinking between
   * two stages of one flow, which is the whole class of break the embedding
   * removes.
   */
  const effectDecisionOwnsPrompt = computed((): boolean => {
    return effectDecisionActive.value || effectDecisionHeldForWorkspace.value;
  });

  /**
   * THE ONE snapshot every prompt-surface family is admitted against
   * (consolePromptAdmission.ts owns the policy, the shell owns the signals).
   * Collected in one place so a NEW signal reaches every family at once —
   * the four hand-copied gate expressions this replaced had already drifted
   * apart, and the fifth family (board placement) had never been given one.
   */
  const admissionSignals = computed((): AdmissionSignals => {
    return guardedAdmissionSignals(rawAdmissionSignals.value);
  });

  /**
   * The signals as the shell observes them, BEFORE the watchdog's staleness
   * mask. Every one of these is a bounded cinematic, but they are read as raw
   * module predicates — the animation-hold registry's 35 s ceiling never
   * protected prompt ADMISSION, so one leaked scene flag held every mandatory
   * surface closed forever. `guardedAdmissionSignals` masks a claim the
   * watchdog has PROVEN stale (nothing rendered, player blocked); the mask
   * lifts by itself the moment the flag goes honestly false again.
   */
  const rawAdmissionSignals = computed((): AdmissionSignals => {
    return {
      ...admissionSignalsBeforeStory.value,
      // The board owes a scale story over a board in plain view (PL-336) — or under a cover the placement takes (PL-1840).
      boardStory: shell.boardStoryBeforePlacement,
    };
  });

  /**
   * Every signal but the board's story (PL-1840): `boardStoryBeforePlacement` asks «would anything ELSE hold the
   * placement?» of these, so the story's own signal is never read by the question that raises it (no cycle).
   */
  const admissionSignalsBeforeStory = computed((): AdmissionSignals => {
    return {
      revealOpen: shell.consoleRevealMode !== undefined,
      revealPending: shell.rawDrawnRevealPending,
      playedHero: shell.playedHeroHolds,
      // The nomad-move hop composes into the SAME signal: it is a board
      // landing cinematic with the tile hero's exact admission semantics.
      tileHero: shell.tilePlacementHolds || shell.nomadMoveHolds,
      // Deliberately WITHOUT the board card-bonus scene — it is armed by a
      // placement's own confirm, so it is a separate signal (see below).
      cardArrival: deckDrawHolds() || handDeliveryState.flights.length > 0,
      boardBonus: isBoardCardBonusActive(),
      cardDiscard: cardDiscardTransaction.active,
      presentation: presentationHeld.value,
      announceGate: shell.taskGateHeld,
      // OWNERSHIP, not timing — the prompt belongs to a traversal step whose
      // cell the marker has not settled on yet (see the block's own doc).
      stageGated: shell.hydroQueuedPromptForLaterStep || shell.sittingRiseGatesPrompt || shell.colonyStepReturnGatesPrompt,
      anyAnimation: isAnimationHoldActive(),
      boardStory: false,
      // Another seat's tile is owed to this board (state delivery, 2026-10-28): the board's truth lands first.
      remoteLanding: shell.remoteLandingBeforePlacement,
      // A card's reaction to the cause is being told (the owner, 2026-11-01): a decision of the same response after it.
      tableAnswer: cardReactionTellsTableAnswer(),
    };
  });

  /**
   * THE PROMPT A SURFACE IS ADMITTED FOR — the presence latch's identity (`consolePromptAdmission` § ENTRY IS NOT
   * PRESENCE). The server's prompt id with its type: a new prompt is a new entry, the same prompt keeps its surface.
   */
  const promptPresenceIdentity = computed((): string => {
    const wf = shell.playerView.waitingFor;
    return wf === undefined ? '' : `${wf.type}#${wf.promptId ?? ''}`;
  });

  /** The latched families admitted RIGHT NOW by entry (the watcher latches them) — one string per state, for the watcher. */
  /** The submit funnel is closed — the answer is on its way (the presence latch lets go). */
  const promptAnswerInFlight = computed((): boolean => {
    return transportState.requestInProgress;
  });

  /** The answer on its way is played IN PLACE by its own surface — an armed live-pick receive (`presenceOutlivesAnswer`). */
  const answerPlaysInPlace = computed((): boolean => {
    return promptReceiveState.card !== undefined;
  });

  const promptPresenceEntries = computed((): string => {
    if (promptPresenceIdentity.value === '') {
      return '';
    }
    return [...LATCHED_SURFACES].filter((surface) => isPromptAdmitted(surface, admissionSignals.value)).join(',');
  });

  /** The task-host task (undefined = not served natively → fallback/other surfaces). */
  const activeConsoleTask = computed((): ConsoleTask | undefined => {
    // A reveal overlay owns the foreground — the task host (and, cascading
    // off it, the gov-support panel) does not serve under it (see startTask).
    // Also held while a drawn reveal is pending, and while THIS interruptive
    // host prompt is still GATED (announced, not yet opened — consoleMandatoryGate).
    // NOTE the 'host' policy includes `card-discard` as ANY live discard
    // transaction, not just its animating phases: the window between the
    // answer and the server's reply is exactly when the host would otherwise
    // re-mount its branch list over the cards the player just chose (the pick
    // surface has already released it).
    if (!admits('host')) {
      return undefined;
    }
    // The DRAFT WORKSPACE presents its prompts natively (the pick, the
    // wait, the research buy) — the standalone host must not rise over it.
    if (shell.draftClaimsTask) {
      return undefined;
    }
    return taskServedByHost(shell.playerView);
  });

  /**
   * Does the console TASK HOST serve the current prompt — HOLD-INDEPENDENTLY?
   * `activeConsoleTask` goes `undefined` during a transient hold (the
   * tile-placement hero, a reveal, presentation), which used to un-SUPPRESS
   * the desktop MandatoryInputModal fallback for the ~1s gap before the
   * console surface mounts — so the desktop `ModernProductionToLose` FLASHED
   * for a beat after placing next to a hazard, then swapped to the premium
   * console surface. This reads the classification directly (no hold gate), so
   * the desktop modal stays suppressed through the hold. It stays FALSE for a
   * genuine fallback (`composite` the host can't serve) → that modal still
   * shows when nothing native handles the prompt.
   */
  const hostServesPrompt = computed((): boolean => {
    // The three DEDICATED composite surfaces count too: they are not
    // host-served, but they ARE served natively, and the desktop fallback
    // must stay suppressed for them exactly as it does for the host (and
    // hold-independently, or it flashes for a beat before they mount).
    return taskServedByHost(shell.playerView) !== undefined || compositeServesPrompt.value;
  });

  /**
   * DOES THE CONSOLE SERVE THIS PROMPT AT ALL — the desktop fallback's ONE
   * question, and deliberately NOT `hostServesPrompt`.
   *
   * The two ask different things. `hostServesPrompt` is «might the TASK HOST
   * take this», which the outcome reconciler needs. This is «is any console
   * surface responsible for it», which is what decides whether the legacy
   * `MandatoryInputModal` may rise. A SHELL-SECTION prompt is served by a
   * SCREEN (the hand, the colony workspace, the awards sheet) — usually
   * after a mandatory ANNOUNCE, so there is a deliberate window where none
   * of its DOM is mounted yet, and reading the host classification alone
   * made that window look like «nobody serves this». The desktop modal rose
   * into it: the remote colony-bonus collect («Заберите 1 карту с колонии
   * Миранда») shipped as a legacy dialog over the board, and answering it
   * there flew the card into a full-bleed reveal instead of taking the
   * player to the colony that paid it. The set is `SECTION_SERVED_KINDS`
   * (one place, with the reasoning for the one kind it leaves out).
   */
  const promptServedNatively = computed((): boolean => {
    if (hostServesPrompt.value) {
      return true;
    }
    const task = taskFor(shell.playerView);
    if (task === undefined) {
      return false;
    }
    // …or a live WORKSPACE FRAME has declared it serves this kind. That is
    // the general form of the set below: a frame earns `serves` at runtime
    // for the span of a prompt it owns (the Hydronetwork's bonus offer, the
    // landed stage's follow-up), and while it does, the legacy fallback must
    // not treat the prompt as unserved.
    if (frameServing(task.kind) !== undefined) {
      return true;
    }
    return SECTION_SERVED_KINDS.has(task.kind);
  });

  /**
   * The three prompts that used to fall through to the DESKTOP modal inside
   * the console shell — the Venus alt-track bonus, Stormcraft's spend-heat
   * and the planetary-event thresholds. Read from the RAW router (none of
   * them is host-served) and HOLD-INDEPENDENT, like `hostServesPrompt`.
   */
  const compositeServesPrompt = computed((): boolean => {
    const task = taskFor(shell.playerView);
    return task !== undefined && NATIVE_COMPOSITE_KINDS.has(task.kind);
  });

  /**
   * THE VENUS BONUS BELONGS TO A WORKSPACE (P89 · ledger EE). Read off the RAW prompt — ownership is settled at the
   * press (the claim's `venus-bonus` kind: a card action / a repeat / a law's play / a play from the hand / a trade),
   * long before the surface may show; the standard projects' terminal commit holds for it on its own
   * (`stdpVenusStep` — that workspace is no outcome host).
   */
  const venusBonusBelongsToWorkspace = computed((): boolean => {
    if (shell.playerView.waitingFor?.venusBonusPrompt === undefined) {
      return false;
    }
    return shell.stdpHostsVenusBonus || workspaceClaimsVenusBonus();
  });

  /** Claimed, but the host's zone is not standing yet → render NOWHERE for the gap, never a band of its own. */
  const venusBonusHeldForWorkspace = computed((): boolean => {
    // The sitting's step waits for its FIELD (the surfaces go in turn: the law's wave first, then the zone opens).
    if (shell.sittingHostsVenusBonus) {
      return !workspaceFrameMounted('parliament') || !consoleParliamentUi.fieldStanding || !consoleParliamentUi.stageZone;
    }
    if (!venusBonusBelongsToWorkspace.value || shell.stdpHostsVenusBonus) {
      return false;
    }
    return workspaceOutcomeZone() === '' || workspaceOutcomeBeatPending();
  });

  /** The zone the ONE bonus surface is re-homed into, or undefined (no host → the standalone band). */
  const venusBonusEmbedTarget = computed((): string | undefined => {
    if (shell.sittingHostsVenusBonus) {
      return venusBonusHeldForWorkspace.value ? undefined : SITTING_STAGE_ZONE;
    }
    if (!venusBonusBelongsToWorkspace.value || venusBonusHeldForWorkspace.value) {
      return undefined;
    }
    if (shell.stdpHostsVenusBonus) {
      return STDP_STEP_ZONE;
    }
    const slot = workspaceOutcomeZone();
    return slot === '' ? undefined : slot;
  });

  const nativeCompositeTask = computed((): ConsoleTask | undefined => {
    if (shell.pendingClientPayment !== undefined || shell.pendingClientPick !== undefined || !admits('host')) {
      return undefined;
    }
    const task = taskFor(shell.playerView);
    // The alternative Venus board's bonus band waits for the board's story of the step that earned it (P89 · DZ).
    // …unless a workspace HOSTS it: the question is answered inside, the story plays after (P89 · EE) — waiting for a
    // story the covered board cannot tell would hold both forever.
    // …and the SITTING's step (P89 · EJ) is held by its own field, never by the board's story the sitting tells after it.
    if (task?.kind === 'venusBonus' && !venusBonusBelongsToWorkspace.value && !shell.sittingHostsVenusBonus &&
        (!admits('scaleBonus') || shell.scaleBonusOwesStory)) {
      return undefined;
    }
    return task !== undefined && NATIVE_COMPOSITE_KINDS.has(task.kind) ? task : undefined;
  });

  const venusBonusActive = computed((): boolean => {
    return nativeCompositeTask.value?.kind === 'venusBonus' && !consoleState.task.deferred && !venusBonusHeldForWorkspace.value;
  });

  const spendHeatActive = computed((): boolean => {
    return nativeCompositeTask.value?.kind === 'spendHeat' && !consoleState.task.deferred;
  });

  const aresGlobalsActive = computed((): boolean => {
    return nativeCompositeTask.value?.kind === 'aresGlobal' && !consoleState.task.deferred;
  });

  const botAttackActive = computed((): boolean => {
    return nativeCompositeTask.value?.kind === 'botAttack' && !consoleState.task.deferred;
  });

  /**
   * The bot card's printed rules resolve differently per expansion set, and
   * the FACE must read as the player will experience it in THIS game — the
   * same context every other host of `BonusCardFace` passes.
   */
  const botCardContext = computed((): BonusCardContext => {
    const expansions = shell.playerView.game.gameOptions.expansions;
    // A random-set game's B14 face lists THIS game's awards (`MarsBotModel.competition` — the server's lines).
    const competition = shell.playerView.game.automa?.competition;
    return {venus: expansions.venus === true, colonies: expansions.colonies === true, ...(competition !== undefined ? {competition} : {})};
  });

  /** The attack's whole meaning, derived from the SERVER's own marker. */
  const botAttackVm = computed((): BotAttackViewModel | undefined => {
    return botAttackActive.value ?
      buildBotAttackView(shell.playerView.waitingFor, botCardContext.value) :
      undefined;
  });

  /**
   * ONE of the four DEDICATED COMPOSITE surfaces is on screen — the family's
   * own `v-if`s, collected in one place so the shell's cross-cutting
   * questions («does something own the pad?», «may the journal stay?», «is a
   * mandatory surface presenting?») can ask about it as a family instead of
   * naming its members one predicate at a time. It was named nowhere, and the
   * predicates that enumerate task families therefore skipped it in three
   * separate places at once.
   */
  const compositeSurfaceActive = computed((): boolean => {
    return venusBonusActive.value || spendHeatActive.value ||
      aresGlobalsActive.value || shell.deckPickActive || botAttackActive.value;
  });

  /** The generic TASK HOST is on screen — its template condition, stated ONCE
   *  (the start scene's yield below must ask exactly what renders). The
   *  template's `hostTask !== undefined &&` before it is narrowing only — a
   *  computed does not narrow `:task` for vue-tsc (same for the decision). */
  const taskHostRendered = computed((): boolean => {
    return hostTask.value !== undefined && !taskHeldForWorkspace.value && !effectDecisionOwnsPrompt.value &&
      !shell.finalGreeneryActive && !shell.finalePromptOwned && !shell.govSupportActive && !productionLossActive.value &&
      !govScaleFocusState.holding && !energyConversionState.active && !consoleState.task.deferred &&
      shell.taskSpacePending === undefined && !shell.handPickActive;
  });

  /** The EFFECT DECISION screen is on screen — its template condition, once. */
  const effectDecisionRendered = computed((): boolean => {
    return effectDecisionActive.value && effectDecisionVm.value !== undefined &&
      effectDecisionVm.value.directPick === undefined;
  });

  /**
   * A PROMPT SURFACE STANDS ON ITS OWN — rendered for a LIVE question and NOT
   * inside a workspace's outcome zone (its own band in the central opening).
   *
   * The full-bleed scenes (the start workspace) sit on the SAME layer as these
   * bands (z 11480) and come LATER in this template, so a standalone band
   * mounted while the scene is visible is painted over: pickable, owning the
   * pad, invisible. Inside a live start flow every such prompt is claimed and
   * embedded, so this is the case where the claim is GONE — a reload wipes the
   * module claim, and a full-bleed scene that still serves (a corporation
   * owing its first action, a bonus window) mounts over the claimless band.
   * Read off what RENDERS, so the yield can never hide a scene for a surface
   * that is not on screen; the post-submit hold of the deck pick is excluded —
   * only a live question makes a scene step aside.
   */
  const standalonePromptSurfaceStands = computed((): boolean => {
    return (nativeCompositeTask.value?.kind === 'deckSelect' && shell.deckPickActive &&
        !shell.deckPickHeldForWorkspace && shell.deckPickEmbedTarget === undefined) ||
      (taskHostRendered.value && taskEmbedTarget.value === undefined) ||
      (effectDecisionRendered.value && effectDecisionEmbedTarget.value === undefined) ||
      (venusBonusActive.value && venusBonusEmbedTarget.value === undefined) || spendHeatActive.value || aresGlobalsActive.value ||
      (botAttackActive.value && botAttackVm.value !== undefined) ||
      (shell.govSupportActive && !consoleState.task.deferred) ||
      (productionLossActive.value && !consoleState.task.deferred);
  });

  /** What the ConsoleTaskHost renders: a server task OR the client payment. */
  /**
   * THE SERIES' VISIT, STANDING (PC04 · GS): question k of a series is answered and the next one is not admitted yet
   * (the table tells answer k first — the `table-answer` entry wait), so nothing serves — the host would leave and
   * come back for k + 1 («the modal blinks», measured 1.2 s of nothing on the stand). The host stands instead, on the
   * answered question, inert (`SERIES_VISIT_ABSORBER`), while the server's prompt is that question in flight or the
   * NEXT of the same series (`seriesVisitStands` — never another question, never past the series' end); the next one
   * arrives through the host's own prompt handoff. No admission block, no hold: the presence stays the prompt's.
   */
  const seriesHeld = computed((): SeriesVisit | undefined => {
    const visit = seriesVisit.value;
    if (visit === undefined || hostTask.value !== undefined || consoleState.task.deferred ||
        !seriesVisitStands(visit.key, shell.playerView.waitingFor)) {
      return undefined;
    }
    return visit;
  });

  /** …held on the TASK HOST (the answered question was the host's). */
  const seriesHeldVisit = computed((): SeriesVisit | undefined => {
    return seriesHeld.value?.surface === 'host' ? seriesHeld.value : undefined;
  });

  /** …held on the EFFECT DECISION (Viral Enhancers' question — the decision's own surface stands). */
  const seriesHeldDecision = computed((): SeriesVisit | undefined => {
    return seriesHeld.value?.surface === 'decision' ? seriesHeld.value : undefined;
  });

  const hostTask = computed((): ConsoleTask | undefined => {
    if (shell.pendingClientPayment !== undefined) {
      return CLIENT_PAYMENT_TASK;
    }
    if (shell.pendingClientPick !== undefined) {
      return CLIENT_PICK_TASK;
    }
    return activeConsoleTask.value;
  });

  /** The receive scene of a CLIENT-HOSTED pick (RX35's «where») is still owed or playing — the door stands until it has let go. */
  const clientPickSceneLive = computed((): boolean => {
    return promptReceiveState.card !== undefined;
  });

  /**
   * "Reduce your production" (SelectProductionToLose) — the ONE distribute
   * prompt that gets the dedicated premium production-loss surface instead of
   * the generic ConsoleTaskHost lanes (the Ares hazard-adjacency penalty).
   * Only the TOP-LEVEL prompt (a nested productionToLose inside an OrOptions
   * stays in the host via `taskServedByHost`'s `choice` classification).
   */
  const productionLossActive = computed((): boolean => {
    const task = hostTask.value;
    return shell.pendingClientPayment === undefined &&
      task?.kind === 'distribute' && task.mode === 'production';
  });

  /** A SHELL-SECTION task (T3/T4): projectCard → hand / std sheet; colony → rail. */
  const shellTask = computed((): ConsoleTask | undefined => {
    // A reveal overlay owns the foreground — no shell section activates
    // under it (see startTask). It re-opens once the reveal is finished.
    // Also suppressed while a drawn reveal is PENDING (even gated — the
    // Pluto discard waits for the WHOLE reveal beat: announce → open → take →
    // clear), and while THIS interruptive task is still GATED (announced, not
    // yet opened via B — consoleMandatoryGate).
    if (!admits('section')) {
      return undefined;
    }
    const task = taskFor(shell.playerView);
    if (task === undefined || !SHELL_SECTION_KINDS.has(task.kind)) {
      return undefined;
    }
    // A STAGED CELL stands over the very pick its batch will answer (RX36 — the law's LIVE play: the card's cell on
    // the board, the server's `projectCard` under it). That pick is no task of its own while the door is open: B
    // belongs to the board's placement (one level back to the play), never to a collapse of a stack already yielded.
    if (task.kind === 'projectCard' && stagedPlacementOf(stagedPlayState.arm) !== undefined) {
      return undefined;
    }
    // The corporation's MANDATORY FIRST ACTION belongs to the GAME START
    // WORKSPACE while the start flow is live (generation 1, zero actions
    // taken — `corpFirstActionInStartFlow`): the scene's own «ПЕРВОЕ
    // ДЕЙСТВИЕ» stage serves it seamlessly after the preludes, so the
    // standalone confirm modal must never rise beside it (two competing
    // doors into one action). Outside the start flow (a mid-game merger
    // chain) the modal remains the serving surface.
    if (task.kind === 'corpFirstAction' && corpFirstActionInStartFlow(shell.playerView)) {
      return undefined;
    }
    // The MID-GAME first-action confirm is a STANDALONE modal that hosts
    // NONE of the running cinematics. The guard above already waits out the
    // reveal / hero / BLOCKING holds, but the intake + card deal register
    // 'notification-only' holds (they legitimately play OVER the other
    // shell sections and the action menu, so they must not hold those),
    // which are invisible to it. Hold the confirm until the WHOLE
    // presentation has settled — otherwise it pops as "modal spam" over
    // still-running intake animations. Safe from a self-deadlock: the
    // confirm animates nothing of its own, so nothing it hosts keeps the
    // hold alive; the hold is reactive, so the modal appears the instant
    // the last flight lands.
    if (task.kind === 'corpFirstAction' && !admits('standaloneModal')) {
      return undefined;
    }
    return task;
  });

  /**
   * The workspace slot the TASK HOST is teleported into, for a card pick the
   * player's own workspace produced (buy / keep-some).
   *
   * Narrow on purpose. Only `cardSelect` is re-homed: it is the one prompt
   * family that is genuinely a CONTINUATION of the activation the player
   * just confirmed — the cards it offers are the ones that action turned
   * over. A payment, an OrOptions branch, a placement, a resource pick that
   * happens to ride the same response keep their own band, because the
   * workspace has no honest place to seat them and holding them would
   * strand the prompt.
   */
  /**
   * The prompt BELONGS to an open workspace, whether or not its slot is
   * ready yet. Split out from `taskEmbedTarget` on purpose: ownership and
   * readiness are different questions, and conflating them is what let the
   * standalone band win the race. While this is true and the slot is not
   * there yet the host renders NOWHERE — a brief hold, never a wrong
   * surface. Exactly the `deckDrawHolds()` idiom, which withholds the reveal
   * rather than letting it mount in the wrong place for a frame.
   */
  const taskBelongsToWorkspace = computed((): boolean => {
    if (shell.deckPickBelongsToWorkspace) {
      // The DRAW & SELECT surface serves it, not the host — but the claim's
      // ownership questions (has the answer arrived? may the standalone
      // presenters fire?) are about the PROMPT, not about which component
      // draws it, so they must answer the same either way.
      return true;
    }
    return workspaceClaimsPick() &&
      (hostTask.value?.kind === 'cardSelect' || hostTask.value?.kind === 'payment');
  });

  /**
   * Claimed, but not ready to show yet → hold (render nowhere, never a
   * wrong surface). Two reasons:
   *  · the workspace's zone is not in the DOM yet;
   *  · the EXECUTION BEAT still owes its minimum time. A local server can
   *    answer faster than the stage can be read, and the flow would jump
   *    from confirm straight to a purchase screen — the player never sees
   *    the action physically happen. The beat is held, not faked.
   */
  const taskHeldForWorkspace = computed((): boolean => {
    // A Turmoil Redux vote's BILL belongs inside the vote step: while the
    // Parliament is opening around it (a reload) the host renders NOWHERE —
    // a standalone band that then teleports away leaves its shade behind.
    if (shell.parliamentBillStanding && !consoleParliamentUi.voteStanding && !consoleState.task.deferred) {
      return true;
    }
    // …and a table's answer to a walk of the Career (TR78 Arwind Inc. — «ОТВЕТ СТОЛА»: the quest's step, the
    // sitting's winner step, a law's) belongs on the Parliament's ANSWER STAGE: held until the flow that walked the
    // marker has played the step and the stage has entered with the asker on its hero (the surfaces go in turn).
    if (shell.parliamentAnswerTask && !consoleParliamentUi.answerZone && !consoleState.task.deferred) {
      return true;
    }
    // …and an enacted resolution's ask belongs inside the Parliament's
    // SITTING (its reward stage's FIELD) on the same terms — held until the
    // field has opened, i.e. until the payout that arrived with the ask has
    // played its wave (the surfaces go in turn).
    if (shell.parliamentStageTask && !consoleParliamentUi.fieldStanding && !consoleState.task.deferred) {
      return true;
    }
    return taskBelongsToWorkspace.value &&
      (workspaceOutcomeZone() === '' || workspaceOutcomeBeatPending());
  });

  const taskEmbedTarget = computed((): string | undefined => {
    // HELD means "renders nowhere yet" — so it is NOT embedded, and saying
    // otherwise is what killed the execution beat: `workspaceOutcomeEmbedded`
    // went true the instant the prompt arrived, the shell marked the outcome
    // `presenting`, the composer's `outcomePendingBeat` flipped false and
    // ABORTED the flight in mid-air (log: `maybeFlip WAITING {landed:false}`
    // immediately followed by `outcomePendingBeat {on:false}`). The card
    // never landed, the backstop released the gate ~2.6 s later, and the old
    // deal played instead. Target-exists ≠ content-embedded.
    if (taskHeldForWorkspace.value) {
      return undefined;
    }
    // The DRAFT's post-buy payment (Helion heat / steel — the plain M€ case
    // auto-resolves server-side): pick-then-pay is ONE decision, so the
    // second half teleports into the workspace's pay slot instead of rising
    // as its own band over the flow it belongs to. Keyed on the FRAME and
    // the phase, deliberately NOT on `draftCompletionHolding()`: the
    // completion latch is a client-side beat that a reload never replays
    // (and the done-beat used to expire it mid-payment) — the workspace's
    // pay slot answers the same predicate (`draftPaymentPending`), so the
    // two can never disagree about where the panel stands.
    if (hostTask.value?.kind === 'payment' && workspaceFrameMounted('draft') &&
        draftPaymentPending(shell.playerView)) {
      return '.con-draftws [data-draft-pay-slot]';
    }
    // The STD-PROJECT's alt-resource payment (a CLIENT prompt — the plain
    // M€ case never builds one): choosing the project and paying for it is
    // ONE decision, so the payment host teleports into the workspace's own
    // step zone («› ОПЛАТА») instead of replacing the screen it belongs to.
    if (shell.pendingClientPayment !== undefined && workspaceFrameMounted('standard-projects')) {
      return '.con-stdp [data-embed-slot="stdp-step"]';
    }
    // A CLIENT-HOSTED PICK (RX35's «where» of a replaced unit): the door that promised it hosts it in its own zone.
    if (shell.pendingClientPick !== undefined) {
      return shell.pendingClientPick.zone;
    }
    // A PAID VOTE's bill (Turmoil Redux — the delegate from the reserve):
    // the vote step hosts it in its own zone, so paying is one more row of
    // the decision the player is already inside, never a band over it. The
    // section publishes the zone post-flush (`voteStanding`) and rebuilds
    // the step around the bill after a reload / a restore by the server's
    // own marker (`votePayment`) — the shell never reads a title.
    if (hostTask.value?.kind === 'payment' && workspaceFrameMounted('parliament') && consoleParliamentUi.voteStanding &&
        (shell.playerView.waitingFor as SelectPaymentModel | undefined)?.votePayment !== undefined) {
      return '.con-parl [data-embed-slot="parliament-vote"]';
    }
    // AN ENACTED RESOLUTION'S ASK (Turmoil Redux): the shared recipient
    // picker stands in the Parliament's SITTING — its reward stage's zone: the
    // resolution is on stage above it, the stage names the amount, the picker
    // asks where.
    // A WALK OF THE CAREER ANSWERED BY THE TABLE (TR78 — «ОТВЕТ СТОЛА»): the answer stage's own zone, published by
    // the stage once it has entered — before the sitting's generic zone, which the same prompt would also match.
    if (shell.parliamentAnswerTask && consoleParliamentUi.answerZone) {
      return '.con-parl [data-embed-slot="parliament-answer"]';
    }
    if (shell.parliamentStageTask && workspaceFrameMounted('parliament') && consoleParliamentUi.fieldStanding && consoleParliamentUi.stageZone) {
      return '.con-parl [data-embed-slot="parliament-stage"]';
    }
    // P58 · FS — A PRELUDE CHAIN'S «WHICH TILE NEXT» (Project Eden played out of a mid-game pick): a step of the play
    // the chain's host stands in — the order step teleports into the host's zone (the play's claim is kept through
    // the board steps, `preludePlayChain.ts`), never a band over it.
    if (hostTask.value?.kind === 'choice' && hostTask.value.flavor === 'placementOrder' &&
        preludeChainOn(preludePlayChainState.host) && workspaceFrameMounted(preludePlayChainState.host)) {
      const zone = workspaceOutcomeZone();
      return zone === '' ? undefined : zone;
    }
    if (!workspaceClaimsPick()) {
      return undefined;
    }
    // `payment` rides along: buying a revealed card is pick-then-pay, one
    // decision in two prompts (ChooseCards defers SelectPaymentDeferred), and
    // letting the second half rise as its own band would break the flow open
    // exactly where it is least expected — after the player already said yes.
    if (hostTask.value?.kind !== 'cardSelect' && hostTask.value?.kind !== 'payment') {
      return undefined;
    }
    const slot = workspaceOutcomeZone();
    return slot === '' ? undefined : slot;
  });

  const shellTaskActive = computed((): boolean => {
    return shellTask.value !== undefined && !consoleState.task.deferred;
  });

  /**
   * IS THE PLAYER STANDING WHERE THE TASK IS ANSWERED?
   *
   * Each shell-section kind has ONE target surface — the screen
   * `openShellTaskSurface` opens for it. This answers «is that screen the
   * one in front of the player right now», which is the only honest basis
   * for telling them something is waiting: on the target surface the ask is
   * already stated by that surface's own header and command bar, so a chip
   * repeating it is noise; anywhere else it is the only thing that says
   * where to go back to.
   *
   * The `playFromHand` row carries the Game Start Workspace's step: there
   * the hand is hosted INSIDE the workspace, so «on the hand» and «inside
   * the start» are the same place, not two.
   */
  const ownShellTaskOnSurface = computed((): boolean => {
    return shellTaskOnSurface(shellTask.value, {
      section: consoleState.section,
      sheet: consoleState.sheet,
      corpFirstActionOpen: shell.corpFirstActionOpen,
      externalDrawOpen: shell.externalDrawWorkspaceMounted,
    });
  });

  /** The live multi select holds every candidate it may (`max`) — R3 then reads «unselect all». */
  const taskAllSelected = computed((): boolean => {
    const model = shell.handSelectModel;
    if (model === undefined) {
      return false;
    }
    const target = Math.min(shell.handSelectSelectableNames.length, model.max);
    return target > 0 && consoleState.select.selected.length >= target;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * May this prompt-surface family come alive right now? THE single admission
   * question — every family asks it, none re-derives it (consolePromptAdmission).
   */
  /**
   * MAY THIS SURFACE BE ON SCREEN — entry for a surface not yet up, PRESENCE for one that is (the owner, 2026-11-01:
   * «модалка не должна мигать и исчезать, если уже появилась»). A family admitted for THIS prompt keeps its surface
   * through every later scene until the answer is sent; only a modal of its own, an answer in flight or a prompt not
   * of this stage withdraw it (`PRESENCE_WITHDRAWS`).
   */
  function admits(surface: PromptSurface): boolean {
    const latched = promptPresenceState.latched[surface] === promptPresenceIdentity.value &&
      promptPresenceIdentity.value !== '' &&
      (!transportState.requestInProgress || presenceOutlivesAnswer(surface, answerPlaysInPlace.value));
    return isPromptPresent(surface, admissionSignals.value, latched);
  }

  // ── CTS task host (T1–T3) ────────────────────────────────────────────
  function onTaskSubmit(response: unknown): void {
    // A CLIENT-HOSTED PICK (RX35's «where») resolves into the door's own batch — the door's callback.
    if (shell.pendingClientPick !== undefined) {
      const pick = shell.pendingClientPick;
      const answer = addressed(response as InputResponse, pick.address);
      // THE ANSWER IS A SCENE (RX35 — the host ARMED the receive on its press): the pick STANDS, sealed, while the
      // transport holds the commit and plays the data onto the chosen card inside the door's plate; the door closes
      // only when the scene has let go (`clientPickSceneLive`'s falling edge) — never under the token.
      if (promptReceiveArmed() && promptReceiveState.card !== undefined) {
        pick.answered = true;
        pick.onAnswer(answer);
        return;
      }
      shell.pendingClientPick = undefined;
      pick.onAnswer(answer);
      pick.onSettled?.();
      return;
    }
    // The CLIENT payment resolves into the std-project response (T3).
    if (shell.pendingClientPayment !== undefined) {
      const cardName = shell.pendingClientPayment.cardName;
      shell.pendingClientPayment = undefined;
      const payment = (response as {payment?: Payment}).payment;
      if (payment !== undefined) {
        shell.submitStandardProjectPayment(cardName, payment);
      }
      return;
    }
    // (The starting-cards DELIVERY is armed + fired entirely inside
    // ConsoleStartScene — the hold begins at the first ceremony frame and
    // the flight fires ONLY on the project-payment confirm. The shell just
    // hosts the delivery layer + passes the held set to the dock.)
    //
    // …but NOT when this host is the workspace's own outcome: the layers it
    // would close include the workspace HOSTING it. Buying a revealed card
    // is pick-then-pay, and tearing the frame down between the two halves is
    // the same break the embedding removes. The workspace folds on its own
    // signal (the claim's release) once the server stops asking.
    //
    // …and the same holds for an embedded EFFECT DECISION: answering the
    // question a play's own card asked is a stage of that play, not the end
    // of the screen it was made in (the discard it opens, and the card that
    // discard buys, are still inside this workspace).
    // P58 · FS — a prelude chain's «which tile next» answered IN its host: the host stays (it steps aside for the
    // placement and comes back for the next step) — closing the layers here ended the chain on the answer.
    if (!taskBelongsToWorkspace.value && effectDecisionEmbedTarget.value === undefined && venusBonusEmbedTarget.value === undefined &&
        !shell.chainPlacementOrderEmbedded) {
      closeConsoleLayers();
    }
    noteSeriesAnswer();
    takeUpQuestion('answered');
    shell.submit(response);
  }

  /**
   * A SERIES MEMBER ANSWERED (PC04 · GS): a standalone host answering question k of N (not the last) remembers it —
   * the visit stands on it until question k + 1 of the same series is admitted (`seriesHeldVisit`).
   */
  function noteSeriesAnswer(): void {
    const wf = shell.playerView.waitingFor;
    const key = choiceSeriesKeyOf(wf);
    const task = activeConsoleTask.value;
    seriesVisit.value = undefined;
    if (key === undefined || key.series.index >= key.series.of || task === undefined || wf === undefined ||
        shell.pendingClientPick !== undefined || shell.pendingClientPayment !== undefined) {
      return;
    }
    // EACH SURFACE HOLDS ITSELF: the effect decision submits through here too — its answered question is held on the
    // decision (never a task host swapped into its place), the host's on the host; an embedded one is its host's.
    const vm = effectDecisionVm.value;
    if (effectDecisionRendered.value && vm !== undefined) {
      seriesVisit.value = effectDecisionEmbedTarget.value === undefined ? {key, surface: 'decision', task, vm, input: wf} : undefined;
    } else if (taskHostRendered.value && taskEmbedTarget.value === undefined) {
      seriesVisit.value = {key, surface: 'host', task, input: wf};
    }
  }

  /**
   * PICK-THEN-PAY in ONE submit (PL-1411): a workspace purchase whose price the server asks answers the pick AND its
   * payment in one batch (`ConsoleTaskHost.submitBuyBatch`) — the same rules as a single answer: the layers that host
   * it stay, the deferred flag drops.
   */
  function onTaskSubmitBatch(responses: ReadonlyArray<unknown>): void {
    if (!taskBelongsToWorkspace.value && effectDecisionEmbedTarget.value === undefined && venusBonusEmbedTarget.value === undefined) {
      closeConsoleLayers();
    }
    takeUpQuestion('answered');
    shell.submitBatch(responses);
  }

  /** B in the host: defer a SERVER task; CANCEL a client payment / a client-hosted pick. */
  function onTaskDefer(): void {
    if (shell.pendingClientPick !== undefined) {
      shell.cancelClientPick();
      return;
    }
    if (shell.pendingClientPayment !== undefined) {
      // Nothing committed — the payment step folds ONE level back to the
      // browse layer of the workspace that hosts it (the frame never
      // closed, so the row, focus and preview are exactly where they were).
      shell.pendingClientPayment = undefined;
      if (workspaceFrameMounted('standard-projects')) {
        shell.rollbackStdProjectFlow();
        return;
      }
      // Legacy fallback (no workspace standing): reopen the task surface.
      const task = shellTask.value;
      if (task?.kind === 'projectCard' && task.mode === 'standardProject') {
        openShellTaskSurface(task);
      }
      return;
    }
    // An EMBEDDED task's «Свернуть» folds the WHOLE workspace that hosts it —
    // the atomic collapse (sheet closed + composer contract reset), never a
    // bare deferred flag. The task host is the B-owner during an embedded
    // pick (input routes to it before the workspace), so without this route
    // the flag rises while `sheet === 'cardActions'` stays set: the exact
    // iteration-16 half-collapse — the «вернуться» card never appears
    // (mandatoryAnnounceVisible needs sheet === undefined), input keeps
    // routing into the invisible workspace, and the bar keeps advertising a
    // stage that no longer serves.
    if (taskEmbedTarget.value !== undefined) {
      shell.onCardActionsCollapse();
      return;
    }
    // …and so does an embedded DRAW & SELECT (and an embedded EFFECT
    // DECISION): B on a nested step minimizes the workspace HOSTING it, never
    // the step alone. Which collapse that is depends on the host — the action
    // centre has its own atomic one; every other workspace parks its whole
    // stack, exactly as its own B does.
    if (shell.deckPickEmbedTarget !== undefined || effectDecisionEmbedTarget.value !== undefined ||
        venusBonusEmbedTarget.value !== undefined) {
      if (workspaceOutcomeState.host === 'card-actions' && !shell.stdpHostsVenusBonus && !shell.sittingHostsVenusBonus) {
        shell.onCardActionsCollapse();
      } else {
        shell.collapseWorkspace();
      }
      return;
    }
    setQuestionAside('question');
  }

  function openShellTaskSurface(task: ConsoleTask): void {
    // A STAGED DOOR OWNS THE SCREEN over the very pick its batch will answer (RX36 — the law's LIVE play: the card's
    // cell / delegate / colony is still ahead while the server's `projectCard` stands under it). That pick opens
    // nothing of its own — a standalone hand over the board would take B away from the door (B gives the play back
    // where it was made, the door's confirm sends the answer).
    if (task.kind === 'projectCard' && stagedPlayState.arm !== undefined) {
      return;
    }
    // Already standing where this is answered — nothing to open, and above
    // all no lateral move: the colonies teleported into a live flow must not
    // have their host's chrome swapped out from under them. Only the cursor
    // lands on the first pickable tile.
    if (task.kind === 'colony' && workspaceFrameMounted('colonies')) {
      const pick = shell.colonyPick;
      const rail = shell.coloniesForRail;
      const first = pick !== undefined ? rail.findIndex((c) => pick.selectable.includes(c.name)) : -1;
      consoleState.colonyIndex = first !== -1 ? first : 0;
      return;
    }
    // THE REDS' DISCARD IS A STEP OF THE LIVE ACTION WORKSPACE that drew the
    // cards (Turmoil Redux): it opens INSIDE that frame — closing the sheet
    // layers here would pop the very host the step teleports into.
    if (task.kind === 'handSelect' && shell.partyDiscardStepOwed) {
      shell.openPartyDiscardStep();
      return;
    }
    // …and so is the discard of a CARD's colony-bonus payout (TR23 — Pluto's
    // pair): a step of the action workspace whose ledger is paying.
    if (task.kind === 'handSelect' && shell.ledgerDiscardStepOwed) {
      shell.openLedgerDiscardStep();
      return;
    }
    // …and so is the law's LIVE PLAY (RX36, PL-727): the album stands up as a step of the stage that paid the bill.
    if (task.kind === 'projectCard' && task.mode === 'playFromHand' && shell.lawLivePlayStepOwed) {
      shell.openLawLivePlayStep();
      return;
    }
    closeConsoleLayers();
    if (task.kind === 'awardFunding') {
      // THE FIRST ACTION'S OWN FUNDING STAGE. Raised while the START
      // workspace is the live top frame (Vitor's «спонсируйте награду
      // бесплатно» — the answer to the «ПЕРВОЕ ДЕЙСТВИЕ» submit), the free
      // sponsorship is a STEP of that flow, never a screen of its own: the
      // awards frame is PUSHED (hosted), takes the whole scene (the start
      // row's `frameSteps: {awards: 'scene'}` — the tiles keep the exact
      // full-scene composition of the standalone screen) and the nesting is
      // stated where nesting belongs — in the HEADER, rooted «СТАРТ
      // ПАРТИИ». The lateral `openSheet` below stays the mid-game door
      // (a merger-acquired Vitor over the board).
      if (workspaceHostForStep() === 'start' && !workspaceFrameKnown('awards')) {
        takeUpQuestion('step-opened');
        pushWorkspaceFrame({
          kind: 'awards',
          // The crumb's stable middle + the step's `L3 Источник` card: the
          // corporation whose mandatory action this is.
          subject: consoleStartState.firstAct.corp ?? '',
          stage: 'Awards',
          // The or-option is already consumed — this step stands past its
          // flow's commit boundary (amber tail, B = «Свернуть»).
          phase: 'committed',
          serves: ['awardFunding'],
          anchor: {type: 'prompt', promptType: 'or'},
          sourceCard: consoleStartState.firstAct.corp ?? '',
        });
        shell.seatAwardFundingSurface();
        return;
      }
      // FREE award funding rides the premium awards MA screen (its own
      // v-if renders it); openSheet treats it as the task surface.
      shell.openSheet('awards');
      // RESUME ≠ FRESH-OPEN: this is the task-restore door, so a suspended
      // PRE-COMMIT detail re-seats exactly (kind, item, focus) — the stage
      // mounts already open, no re-entrance cinematic. A wheel open never
      // reads the draft.
      const draft = maFocusState.draft;
      if (draft !== undefined && draft.kind === 'award') {
        const idx = shell.maScreenItems.findIndex((it) => it.name === draft.name);
        if (idx !== -1) {
          consoleState.sheetIndex = idx;
          openMaFocus(draft.kind, draft.name);
        }
        discardMaFocusDraft();
      }
      return;
    }
    if (task.kind === 'colony') {
      // The PROMPT brought the player here (the `prompt` anchor) — after the
      // follow-up settles the frame hands the screen back on its own, so the
      // player is never stranded in a workspace they did not open.
      shell.openColoniesForPrompt();
      return;
    }
    if (task.kind === 'colonyBonus') {
      const collect = colonyBonusCollectOf(shell.playerView.waitingFor);
      if (collect !== undefined) {
        shell.openColonyBonusCollect(collect);
      }
      return;
    }
    if (task.kind === 'party') {
      // A DELEGATE GRANT (Turmoil Redux — the Redux Venus's «add 2 delegates
      // to a resolution»): the Parliament's VOTE STEP stands INSIDE the flow
      // that paid it — the colonies the player just built on or traded with
      // — as a hosted frame in that workspace's own zone («КОЛОНИИ › ВЕНЕРА ›
      // ГОЛОСОВАНИЕ»), past its commit (B = «Свернуть»). A grant met with no
      // live flow to host it (a reload, a resumed session) opens the
      // Parliament on its own, where the mode serves it just the same.
      // …and a card's SUPPORT-AREA pick met LIVE (TR12 — re-asked, a reload, a play outside the staged boundary)
      // stands the same way: the Parliament's support-area mode, inside the flow that raised it.
      // …and a card's DELEGATE pick met LIVE (TR72) — the Parliament's delegate mode, the same way.
      // A FIRST ACTION's PARTY STEP — Septem Tribus:redux's «a cube on the banner of any party», The Deimos Group's
      // «a delegate on any resolution» (TR83) — is a STEP of «ПЕРВОЕ ДЕЙСТВИЕ» (the Vitor precedent, one branch up):
      // the Parliament frame is PUSHED on the start workspace, takes the whole scene (the start row's
      // `frameSteps: {parliament: 'scene'}`) and the nesting is stated in the HEADER («СТАРТ ПАРТИИ › SEPTEM TRIBUS ›
      // ЗНАМЯ», «… › THE DEIMOS GROUP › ГОЛОСОВАНИЕ»), past the commit (B = «Свернуть»). The section arms its own mode
      // before the first render (`bridge.bannerPick` / `bridge.grant`).
      if (firstActionPartyStep(shell.playerView.waitingFor) && workspaceHostForStep() === 'start' && !workspaceFrameKnown('parliament')) {
        takeUpQuestion('step-opened');
        // P60 · FW — a PRELUDE's grant names its prelude (`startPreludeGrantOf`): after a reload no start state does.
        const giver = startPreludeGrantOf(shell.playerView) ?? consoleStartState.firstAct.corp ?? '';
        pushWorkspaceFrame({
          kind: 'parliament',
          subject: giver,
          stage: partyStepStageOf(shell.playerView.waitingFor),
          phase: 'committed',
          serves: ['party'],
          anchor: {type: 'prompt', promptType: 'party'},
          sourceCard: giver,
        });
        return;
      }
      const partyStep = shell.playerView.waitingFor?.votePrompt?.source === 'grant' || shell.playerView.waitingFor?.supportPrompt !== undefined ||
        shell.playerView.waitingFor?.delegatePrompt !== undefined || shell.playerView.waitingFor?.bannerPrompt !== undefined;
      // A CARD's build (TR25) whose stage still stands: the grant's step takes the section's central area, so its
      // door waits for the stage to go HOME — `landColonyBuild` opens it then (never a Parliament over a lit stage).
      if (partyStep && colonyBuildAnswered() && colonyFocusState.open) {
        return;
      }
      // A CARD's live grant whose play stands aside for the board (T03 — the city's staged cell came first): the
      // flow comes back over the quiet board and opens the vote inside itself (`resumeStackFromBoardAndSettle`);
      // a standalone Parliament here would be a second place for one press.
      if (partyStep && stackYieldedToBoard() && cardGrantOwedTo(shell.playerView.waitingFor, yieldedStackCards())) {
        return;
      }
      if (partyStep) {
        const host = workspaceHostForStep();
        if (host !== undefined && host !== 'parliament') {
          if (workspaceFrameHost('parliament') === host) {
            return; // already standing where it is answered (idempotent)
          }
          setWorkspaceFramePhase(host, 'committed');
          pushWorkspaceFrame({
            kind: 'parliament', subject: '', stage: followUpStepStage('party', shell.playerView.waitingFor) ?? DELEGATE_GRANT_STEP_STAGE, phase: 'committed',
            serves: ['party'], anchor: {type: 'prompt', promptType: 'party'},
            // The Unity door's trade (parliament ⊃ card-actions ⊃ colonies) meets a
            // Parliament frame already below: the step NESTS a second one rather
            // than re-entering — and tearing down — the flow it stands inside.
            nest: workspaceFrameKnown('parliament'),
          });
          return;
        }
      }
      // The chairman's seat pick (Turmoil Redux) — the PROMPT brought the
      // player to the Parliament; the frame hands the screen back on its own
      // once the seat is filled.
      if (!workspaceFrameKnown('parliament')) {
        enterWorkspace('parliament', {anchor: {type: 'prompt', promptType: 'party'}});
      }
      return;
    }
    if (task.kind === 'chairmanQuest') {
      // «ПРЕДСЕДАТЕЛЬСТВО» (Turmoil Redux) — the whole point of the server's
      // gate is that the player is BROUGHT to the Parliament: the beats of
      // the Agenda step live in that section, and a section off screen plays
      // them into nothing. An `always` anchor, because the flow deliberately
      // outlives its own prompt (the office and the step play AFTER the
      // answer); its own guarded conclusion ends it.
      if (!shell.restoreParkedWorkspace('parliament') && !workspaceFrameKnown('parliament')) {
        enterWorkspace('parliament', {anchor: {type: 'always'}});
      }
      return;
    }
    if (task.kind === 'parliamentPhase') {
      // THE SITTING'S GATE (Turmoil Redux) — the political phase is ONE flow
      // the player opened by A this generation (the flow beat); a gate that
      // finds the Parliament gone (the winner's tile took the screen with no
      // stack to resume, a reload) re-enters it at the server's step. A
      // parked sitting is the same sitting: it comes back as it was.
      // A sitting merely ASIDE for the board (yielded) is not gone either:
      // the placement's own end brings it back at the same depth, once the
      // board's story is quiet — a fresh frame stood up here would cover
      // the board in the very frame the removed ocean (Water Export) lifts
      // off it, and the scene would degrade under it.
      if (!stackYieldedToBoard() && !shell.restoreParkedWorkspace('parliament')) {
        shell.enterWorkspaceAfterHandoff('parliament', {anchor: {type: 'phase', phase: Phase.PARLIAMENT}});
      }
      return;
    }
    if (task.kind === 'externalDraw') {
      // A RESOLUTION's draw is a STEP of the Parliament's sitting (the flow
      // beat's A is its usual door — `openMandatoryAnnounce`); an ordinary
      // external draw stands its own workspace up. Idempotent via the frame
      // guard (a raced double press finds the frame known).
      if (externalDrawResolutionOf(externalDrawTakeOf(shell.playerView.waitingFor)) !== undefined) {
        // (A yielded sitting comes back by itself — same reason as the gate above.)
        if (!stackYieldedToBoard() && !shell.restoreParkedWorkspace('parliament')) {
          shell.enterWorkspaceAfterHandoff('parliament', {anchor: {type: 'phase', phase: Phase.PARLIAMENT}});
        }
        return;
      }
      if (!workspaceFrameKnown('external-draw')) {
        enterWorkspace('external-draw', {anchor: {type: 'prompt', promptType: 'card'}});
      }
      return;
    }
    if (task.kind === 'handSelect') {
      // A COLONY-BONUS discard (Pluto's «draw 1, discard 1») is a PHASE of
      // the colony resolution, never a screen of its own — the whole flow
      // stays inside the ONE colony workspace.
      const bonus = colonyBonusDiscardOf(shell.playerView.waitingFor);
      if (bonus !== undefined) {
        shell.openColonyBonusDiscard(bonus);
        return;
      }
      // MANDATORY pick from hand (discard / reveal / place): open the hand
      // carousel in select mode + land on the first PICKABLE card so A means
      // something at once. Picks/filter are reset by the prompt-change watcher.
      // A PARTY ACTION'S discard (the Reds — Turmoil Redux) REACHED FROM
      // OUTSIDE its workspace — a reload mid-flow, the board-home plate: the
      // action workspace stands back up around it (the same composer past
      // its commit, the hand as its STEP), so the flow ends where it began,
      // with its payout beat. Inside a live workspace the take opens the
      // step itself (`partyDiscardStepOwed`, above).
      const marker = shell.playerView.waitingFor?.partyActionPrompt;
      if (marker !== undefined && marker.stage === 'discard' && isReduxParty(marker.party) &&
          !workspaceFrameKnown('card-actions') && !workspaceFrameKnown('hand')) {
        shell.resumePartyActionWorkspace(marker.party);
      }
      // A MANDATORY pick from the hand OPENS the hand — the cards lift out of the dock into the album (the owner,
      // 2026-10-25: a pick whose cards just appear while the fan stays docked breaks the physics of the cards).
      void shell.openHandWithReveal({keepTask: true});
      // …and the step's stage name is the crumb's tail («… › КРАСНЫЕ ›
      // СБРОС КАРТ»), handed up like every hosted step's.
      if (marker !== undefined && marker.stage === 'discard' && workspaceFrameHost('hand') === 'card-actions') {
        setWorkspaceFrameStage('hand', 'Card discard');
      }
      // …and a START PRELUDE's own discard (P55 · FN) is the start's step: «СТАРТ ПАРТИИ › <пролог> › СБРОС КАРТЫ».
      // The prelude is the crumb's subject — named by the server's marker when the press that set it is gone (a
      // reload mid-step).
      const startDiscard = startStepDiscardOf(shell.playerView);
      if (startDiscard !== undefined && workspaceFrameHost('hand') === 'start') {
        if (workspaceFrameSubject('start') === '') {
          setWorkspaceFrameSubject('start', startDiscard);
        }
        setWorkspaceFrameStage('hand', 'Card discard');
      }
      // AN ENACTED RESOLUTION'S DISCARD (Colonial Affairs — Pluto's «draw 1,
      // then discard 1» repeated): the hand is a STEP of the Parliament's
      // SITTING, in the sitting's own zone (the frame's slot the section
      // publishes once the step's door opens), under the ONE word the sitting
      // publishes for it («ПАРЛАМЕНТ › ЗАСЕДАНИЕ › СБРОС») — the same key
      // `consoleSittingFlow.sittingStageKey` prints, so the tail animates once.
      const resolutionStep = followUpStepStage(task.kind, shell.playerView.waitingFor);
      if (resolutionStep !== undefined && workspaceFrameHost('hand') === 'parliament') {
        setWorkspaceFrameStage('hand', resolutionStep);
      }
      shell.focusFirstSelectableHandCard();
      return;
    }
    if (task.kind === 'projectCard') {
      // GENERIC (wave 2): candidates that are neither the hand nor the
      // standard-project sheet — ConsoleTaskHost auto-mounts once the gate
      // releases (the same «nothing else to open» rule as choice/payment).
      if (task.mode === 'generic') {
        return;
      }
      if (task.mode === 'playFromHand') {
        const firstPlayable = shell.handEntries.findIndex((e) => e.playable);
        consoleState.handIndex = firstPlayable !== -1 ? firstPlayable : 0;
        // INSIDE a live workspace the hand does not "appear": it OPENS, with
        // the same dock → slot cinematic every other route gets. The cards
        // are already the player's — they unfold from the dock they are lying
        // in, they are never re-dealt. `keepTask`: this prompt is exactly why
        // we are opening, so deferring it would be the opposite of navigating
        // away. (`openHandWorkspace` decides screen-vs-step; the reveal is
        // the same either way.)
        void shell.openHandWithReveal({keepTask: workspaceHostForStep() !== undefined});
      } else {
        shell.openSheet('standard-projects');
      }
      return;
    }
    if (task.kind === 'corpFirstAction') {
      // Inside the START FLOW the Game Start Workspace's own stage serves
      // this prompt — its frame is already standing (or restoring via the
      // deferred card); steering the section here would only disturb it.
      if (corpFirstActionInStartFlow(shell.playerView)) {
        return;
      }
      // Mid-game (merger chain): the dedicated confirm modal serves it. Its
      // presence is DERIVED (corpFirstActionOpen), so there is nothing to
      // open here: only the board must be the section underneath it.
      goBoardHome();
    }
  }

  /**
   * THE PLAY'S CHAIN STILL ASKS — after a STEP of the play ended (the colony «Научная колония» builds), a card of the
   * player's that this very press woke is asking now (Mars University answering the science tag), and no claim is
   * left to own the question: the play's ended at its batch's take (the colony was the step it still owed), the
   * colony step's ended with the colony. Concluded there, the workspace left and the question rose as a fresh album
   * over the board — a stage of the play with the play gone (the field report of 2026-10-14).
   *
   * It IS this play's next stage: the server asks a player one thing at a time, so a decision standing while the
   * play's frame is past its commit is that press's chain — the same reading the play's own optimistic claim makes
   * for every play (`claimPlayOutcome`: `'effect'` for every play, settled by the reconciler). So the claim is made
   * again, late, with what it would hold by now: the execution beat long played, the arrival long landed, the
   * outcome on stage. The decision then opens in the hand that made the play and the conclusion holds for it
   * (`live-outcome`) — and its draw arrives in the same zone. A pick the decision already opened on this shelf
   * names its stage now (it opened when nothing owned it, so it named none).
   */
  function adoptPlayEffectDecision(): void {
    // A decision asked OFF the turn is another seat's chain — never the play's next stage.
    if (workspaceOutcomeClaimed() || rawEffectDecisionVm.value === undefined || shell.viewerAskedOffTurn ||
        !isCommitted(workspaceFramePhase('hand') ?? 'browse')) {
      return;
    }
    const card = workspaceFrameSubject('hand');
    if (card === '' || claimPlayOutcome(card) !== 'hand') {
      return;
    }
    markWorkspaceOutcomeAnswerIn();
    markWorkspaceOutcomeBeatDone();
    markWorkspaceOutcomePresenting();
    markWorkspaceOutcomeArrivalDone();
    // …and the crumb names the coming stage NOW, in the same flush the step's frame left: the album the decision
    // IS (`directPick` — «СБРОС КАРТЫ») or the decision's own stage. Left unnamed until the album opened, the tail
    // fell back to «РОЗЫГРЫШ» for that gap — backwards, through a flow that only moves forward.
    const vm = rawEffectDecisionVm.value;
    const direct = vm.directPick?.nested;
    const stage = shell.handPickActive ? handPickStageKey(consoleHandPickState.request) :
      direct !== undefined ? handPickStageKey({discard: direct.discardPrompt}) : vm.stageKey;
    if (stage !== '') {
      setWorkspaceOutcomePhase(stage);
    }
  }

  /**
   * A nested option whose card candidates are ALL IN HAND (Mars University's
   * "discard a card to draw a card" branch): the pick leaves the task host
   * and rides the REAL hand overlay through the shared hand-pick bridge —
   * the same surface a top-level in-hand prompt and a composer pick use. The
   * answer is wrapped back into this option's OR index, byte-identical to
   * what the host would have submitted from its own grid.
   *
   * Cancelling (B in the hand) returns to the branch list: the host is
   * re-mounted by its own v-if, showing «Выберите вариант» again — which is
   * exactly where the player was before choosing this branch.
   */
  /** Open the album a decision IS (`effectDecisionDirectPick`) — B there minimizes, RT declines. */
  function openEffectDecisionPick(action: EffectDecisionAction | undefined): void {
    const vm = effectDecisionVm.value;
    if (action === undefined || action.nested === undefined || vm === undefined || shell.handPickActive) {
      return;
    }
    onTaskHandPick({
      index: action.optionIndex,
      cardPrompt: action.nested,
      source: vm.source,
      nextStage: nextStageKeyOf(action),
      decline: declineModelOf(vm.decline),
      direct: true,
    });
  }

  function onTaskHandPick(payload: {
    index: number, cardPrompt: SelectCardModel, source?: EffectDecisionSource, nextStage?: string,
    /** The decision's refusal as a button — RT in the album, the plate in its question line. */
    decline?: DeclineModel,
    /** The album IS the decision (`effectDecisionDirectPick`): there is no screen behind it to return to. */
    direct?: boolean,
  }): void {
    const prompt = payload.cardPrompt;
    const reasons: Record<string, string> = {};
    for (const d of prompt.disabledCards ?? []) {
      reasons[d.name] = d.disabledReason === undefined ? '' :
        (typeof d.disabledReason === 'string' ? translateText(d.disabledReason) : translateMessage(d.disabledReason));
    }
    // THE PICK IS THE NEXT STAGE OF THE SAME EFFECT, not a screen the player
    // was dropped into: inside the workspace that raised the decision the
    // hand's own shelf becomes the picker (the play stage steps aside —
    // `--stagepaused`), so the crumb's tail must ADVANCE («… › ЭФФЕКТ» →
    // «… › СБРОС КАРТЫ») instead of blanking.
    //
    // Published HERE because the decision surface unmounts for the pick and
    // its own `beforeUnmount` would otherwise clear the tail; it deliberately
    // only clears a phase that is still its own, so this write wins.
    const ownsStage = workspaceClaimsEffect();
    const pickStage = handPickStageKey({discard: prompt.discardPrompt});
    // …and the tail is HANDED ON at the answer rather than retracted. What
    // this pick buys is the flow's next stage (the card the discard draws),
    // and between the submit and the deal nothing owns the tail — retracting
    // there would drop it back to the composer's last stage, «РАЗЫГРАНО»,
    // which is two steps BACK through a flow that only moves forward.
    //
    // The asking surface computes it (`nextStageKeyOf`, one pure rule for
    // both press kinds); a pick handed over by the generic task host carries
    // none, which is the honest answer there — nothing claims that flow.
    const nextStage = payload.nextStage ?? '';
    const decline = payload.decline;
    const promptKey = promptIdentityKey(shell.playerView.waitingFor);
    if (ownsStage) {
      setWorkspaceOutcomePhase(pickStage);
    }
    enterConsoleHandPick({
      title: prompt.title,
      buttonLabel: prompt.buttonLabel || 'Select',
      selectable: prompt.cards.map((c) => c.name),
      reasons,
      min: prompt.min,
      max: prompt.max,
      selected: [],
      // The RAW server marker — the shell derives the discard skin from the
      // very same field a top-level discard uses (one derivation, no drift).
      discard: prompt.discardPrompt,
      // The CONTEXT travels with the pick, so the overlay keeps naming the
      // effect that sent the player there and L3 can open it. Without it the
      // hand reads as an unrelated screen they were dropped into.
      source: payload.source?.card !== undefined ?
        {kicker: effectDecisionVm.value?.eyebrowKey ?? 'Card effect', card: payload.source.card} :
        undefined,
      decline,
      // An album that IS the decision has no screen behind it: B is the decision's own minimize.
      backLabel: payload.direct === true ? 'Minimize' : undefined,
    }, (cards) => {
      // ONLY OUR OWN KEY: by now the claim may already be naming something
      // else (or be gone entirely), and overwriting a stage we do not own is
      // how a crumb starts describing a screen that is not there.
      if (ownsStage && workspaceOutcomeState.phaseKey === pickStage) {
        setWorkspaceOutcomePhase(nextStage);
      }
      if (payload.direct === true) {
        markDecisionPickAnswered(decisionPromptStamp(shell.playerView));
      }
      shell.submit(orWrappedResponse(payload.index, cardsResponse(cards)));
    }, payload.direct === true ? () => {
      // B in an album that IS the decision — the decision's own B: minimize (one level up is the board / the
      // hosting workspace's collapse, never a decline). Only while it is still this prompt: a cancel fired because
      // the server moved on must not defer the NEXT one.
      if (promptIdentityKey(shell.playerView.waitingFor) !== promptKey) {
        return;
      }
      // A hand the pick stood up OVER THE BOARD has nothing under it to return to: it gathers back into the dock —
      // the board home is where the minimized decision's card waits. (Inside a workspace the hand is that
      // workspace's, and the defer collapses it whole.)
      const alone = shell.handPickStandsAlone();
      onTaskDefer();
      if (alone) {
        void shell.closeHandWithReveal();
      }
    } : undefined, decline !== undefined ? () => {
      // RT in the album — the refusal. Nothing follows it: the tail is handed on EMPTY.
      if (ownsStage && workspaceOutcomeState.phaseKey === pickStage) {
        setWorkspaceOutcomePhase('');
      }
      if (payload.direct === true) {
        markDecisionPickAnswered(decisionPromptStamp(shell.playerView));
      }
      // …and a hand the pick stood up over the board goes back into the dock with it (no discard cinematic will
      // hand the surface off — nothing leaves the hand).
      const alone = shell.handPickStandsAlone();
      shell.submit(orOptionResponse(decline.index));
      if (alone) {
        void shell.closeHandWithReveal();
      }
    } : undefined);
  }

  /** THE PRESENCE LATCH (`consolePromptAdmission` § ENTRY IS NOT PRESENCE): a family admitted for the prompt keeps it. */
  function whenPromptPresenceEntriesChanges(entries: string): void {
    for (const surface of entries.split(',')) {
      if (surface !== '') {
        latchPromptPresence(surface as PromptSurface, promptPresenceIdentity.value);
      }
    }
  }

  /** …and the answer sent lets the surface go (the next presence is an entry again). */
  function whenPromptAnswerInFlightChanges(inProgress: boolean): void {
    if (inProgress) {
      // …unless the surface plays that very answer in place (an armed «on which card» receive — the plate is its stage).
      releasePromptPresence(answerPlaysInPlace.value ? ['host'] : []);
    }
  }

  /** WATCH `startPartyStepDue` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenStartPartyStepDueChanges(due: boolean): void {
    const task = taskFor(shell.playerView);
    if (due && task?.kind === 'party') {
      openShellTaskSurface(task);
    }
  }

  /** The hosted Venus bonus hands its stage name UP (P89 · EE): the host's crumb gains «› БОНУС ВЕНЕРЫ». */
  function whenVenusBonusEmbedTargetChanges(target: string | undefined): void {
    if (target === undefined) {
      return;
    }
    if (shell.sittingHostsVenusBonus) {
      // The sitting's crumb names the step itself (`sittingStageKey` → «› БОНУС ВЕНЕРЫ»).
      return;
    }
    if (shell.stdpHostsVenusBonus) {
      setWorkspaceFrameStage('standard-projects', VENUS_BONUS_STAGE);
    } else {
      setWorkspaceOutcomePhase(VENUS_BONUS_STAGE);
    }
  }

  // Mirror the RAW admission signals into the foreground watchdog: it runs on
  // the leak detector's 1 s timer and cannot recompute them, and it needs the
  // raw values both to name what is claiming the foreground and to lift its
  // staleness mask the moment a claim goes honestly false again.
  function whenRawAdmissionSignalsChanges(raw: AdmissionSignals): void {
    noteAdmissionSignals(raw);
  }

  /** A genuinely NEW decision starts at the top; returning from an overlay
   *  (same prompt, same key) keeps the action card the player opened. */
  function whenEffectDecisionKeyChanges(now: string, was: string | undefined): void {
    if (now !== '' && now !== was) {
      resetDecisionFocus();
    }
  }

  /** The decision that IS its pick opens the album where the decision would have stood — before it ever renders
   *  (a `pre` watcher: the same flush that would mount the surface finds the pick already open). */
  function whenEffectDecisionDirectPickChanges(action: EffectDecisionAction | undefined): void {
    openEffectDecisionPick(action);
  }

  /**
   * The server's question as the shell last saw it: has its identity moved? (`promptIdentityKey` — never a title.)
   * The view-apply reaction asks once per applied view; a `true` is the edge every «belongs to the question» state
   * ends on.
   */
  function questionChanged(key: string): boolean {
    if (key === lastTaskKey.value) {
      return false;
    }
    lastTaskKey.value = key;
    return true;
  }

  return {
    questionChanged,
    seriesVisit,
    lastTaskKey,
    presentationHeld,
    consoleMandatoryPresenting,
    effectDecisionVm,
    rawEffectDecisionVm,
    effectDecisionKey,
    effectDecisionActive,
    effectDecisionDirectPick,
    effectDecisionBelongsToWorkspace,
    effectDecisionHeldForWorkspace,
    effectDecisionEmbedTarget,
    playEffectOwed,
    effectDecisionOwnsPrompt,
    admissionSignals,
    rawAdmissionSignals,
    admissionSignalsBeforeStory,
    promptPresenceIdentity,
    promptAnswerInFlight,
    answerPlaysInPlace,
    promptPresenceEntries,
    activeConsoleTask,
    hostServesPrompt,
    promptServedNatively,
    compositeServesPrompt,
    venusBonusBelongsToWorkspace,
    venusBonusHeldForWorkspace,
    venusBonusEmbedTarget,
    nativeCompositeTask,
    venusBonusActive,
    spendHeatActive,
    aresGlobalsActive,
    botAttackActive,
    botCardContext,
    botAttackVm,
    compositeSurfaceActive,
    taskHostRendered,
    effectDecisionRendered,
    standalonePromptSurfaceStands,
    seriesHeld,
    seriesHeldVisit,
    seriesHeldDecision,
    hostTask,
    clientPickSceneLive,
    productionLossActive,
    shellTask,
    taskBelongsToWorkspace,
    taskHeldForWorkspace,
    taskEmbedTarget,
    shellTaskActive,
    shellTaskOnSurface: ownShellTaskOnSurface,
    taskAllSelected,
    admits,
    onTaskSubmit,
    noteSeriesAnswer,
    onTaskSubmitBatch,
    onTaskDefer,
    openShellTaskSurface,
    adoptPlayEffectDecision,
    openEffectDecisionPick,
    onTaskHandPick,
    whenPromptPresenceEntriesChanges,
    whenPromptAnswerInFlightChanges,
    whenStartPartyStepDueChanges,
    whenVenusBonusEmbedTargetChanges,
    whenRawAdmissionSignalsChanges,
    whenEffectDecisionKeyChanges,
    whenEffectDecisionDirectPickChanges,
  };
}

export type RouterController = ReturnType<typeof createRouterController>;
