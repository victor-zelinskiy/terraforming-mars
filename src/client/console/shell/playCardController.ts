/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLAYCARD CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import type {PreselectAddress} from '@/common/inputs/preselectAddress';
import {computed, ref} from 'vue';
import {scopedState} from '@/client/console/session/scopedState';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {Payment} from '@/common/inputs/Payment';
import {SelectCardModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {PassFacts, PassWarnings, passWarnings} from '@/client/console/passWarnings';
import {ConsoleHandEntry} from '@/client/components/console/consoleHandSectionTypes';
import {preloadResolutionArt} from '@/client/console/parliament/parliamentArtTier';
import {AgendaWalkRailPromise, promiseAgendaWalk} from '@/client/console/parliament/agendaWalk';
import {promiseNeutralRally} from '@/client/console/parliament/neutralRally';
import {resolutionPlayOf} from '@/client/console/parliament/consoleParliamentModel';
import {workspaceStackRootKind, descendWorkspaceFrame, setWorkspaceFramePhase, workspaceFrameDescended, workspaceFrameHasNested, workspaceFrameIndex, workspaceFrameMounted, workspaceFrameSlot, workspaceFrameHost, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {guardHandHeroFlight, heroCommitLift} from '@/client/console/consoleHandStageMotion';
import {armHandPlayPrewarm, cancelHandPlayPrewarm} from '@/client/console/consoleHandPlayPrewarm';
import {armPreselectedDiscard} from '@/client/console/cardDiscard/consoleCardDiscard';
import {PreselectedDiscard} from '@/client/console/cardDiscard/preselectedDiscards';
import {runCardTransfer} from '@/client/console/cardDeal/cardExitDirector';
import {armPlayedHero, isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {CardType} from '@/common/cards/CardType';
import {releaseConsolePlayCardCommands} from '@/client/console/consolePlayCardUi';
import {buildPlayCardBatch} from '@/client/console/consolePlayCardComposer';
import {ArmedPlayEffectModel} from '@/common/models/ArmedPlayEffectModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {isHydroMarkerActive} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroFlowState} from '@/client/console/hydroFlow/consoleHydroFlow';
import {workspaceOutcomeClaimed, setWorkspaceOutcomePhase, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {claimPlayOutcome, isPlayOutcomeHost, playLandingShowing} from '@/client/console/played/consolePlayOutcomeClaim';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {PlayReaction} from '@/client/console/played/receivingStageModel';
import {type RailReward} from '@/client/console/resourceTransfer/railReward';
import {playCardPriceReward} from '@/client/console/consoleActionCommit';
import type {DeltaEspionageProjectionModel} from '@/common/models/DeltaEspionageModel';
import type {DeltaStageAnswer} from '@/common/inputs/InputResponse';
import {getCard} from '@/client/cards/ClientCardManifest';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {consolePlayPickState, resolveConsolePlayPick} from '@/client/console/consolePlayPick';
import {findConvertHeatOption, findConvertPlantsOption, findPassPath, findPlayProjectCardAction, inputTitleText, optionResponseForPath, wrapPath} from '@/client/console/turnIntents';
import {translateText} from '@/client/directives/i18n';
import {motionMs} from '@/client/components/motion/motionTokens';
import type {PlayComposerDraft, StagedPlayArm, StagedReceipt} from '@/client/console/stagedPlay';
import type {ActionEffect, AgendaWalkModel, NeutralRallyModel, StagedColonyModel, StagedPlacementModel, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import type {EffectForecast} from '@/common/models/EffectForecastModel';
import {ActionConfirmKind} from '@/client/components/console/consoleActionConfirmTypes';
import {PendingPlayCard, PendingClientPayment, PendingClientPick, STAGED_VOTE_RELEASE_MS} from '@/client/console/shell/shellShared';
import type {CardActionsController} from '@/client/console/shell/cardActionsController';
import type {RouterController} from '@/client/console/shell/routerController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {OutcomeController} from '@/client/console/shell/outcomeController';
import type {ConvertController} from '@/client/console/shell/convertController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {SeatController} from '@/client/console/shell/seatController';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {WheelController} from '@/client/console/shell/wheelController';

/** A staged PLAY's locked receipt — the card's price in M€ as the composer settled it (TR03 / TR07). */
function playReceiptOf(pending: PendingPlayCard): StagedReceipt | undefined {
  const cost = pending.input.cards.find((c) => c.name === pending.cardName)?.calculatedCost;
  return cost === undefined ? undefined : {amount: cost, icon: 'megacredits'};
}

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type PlayCardPort = {
  $refs: Record<string, unknown>,
  actionsAvailableCount: UnwrapRef<CardActionsController['actionsAvailableCount']>,
  adoptPlayEffectDecision: UnwrapRef<RouterController['adoptPlayEffectDecision']>,
  beginEspionageExecution: UnwrapRef<HydroController['beginEspionageExecution']>,
  beginStagedPlayLanding: UnwrapRef<StagedController['beginStagedPlayLanding']>,
  concludeWorkspaceFlowOrOwe: UnwrapRef<OutcomeController['concludeWorkspaceFlowOrOwe']>,
  convertHeatFutile: UnwrapRef<ConvertController['convertHeatFutile']>,
  convertHeatReady: UnwrapRef<ConvertController['convertHeatReady']>,
  enterStagedPlacement: UnwrapRef<PlacementController['enterStagedPlacement']>,
  foldHandStage(): void,
  followUpStepOwed: UnwrapRef<OutcomeController['followUpStepOwed']>,
  game: UnwrapRef<SeatController['game']>,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  handExitSlot(name: CardName): HTMLElement | null,
  handOutcomeLive: UnwrapRef<OutcomeController['handOutcomeLive']>,
  readonly handSelectUiActive: boolean,
  hydroActionAvailable: UnwrapRef<HydroController['hydroActionAvailable']>,
  playedOpen: UnwrapRef<PlayedController['playedOpen']>,
  readonly playerView: PlayerViewModel,
  rawEffectDecisionVm: UnwrapRef<RouterController['rawEffectDecisionVm']>,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  submit(response: unknown): SubmitTicket,
  submitBatch(responses: ReadonlyArray<unknown>, promptId?: number): SubmitTicket,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  tradeColonyContext: UnwrapRef<ColonyController['tradeColonyContext']>,
  wheelCounts: UnwrapRef<WheelController['wheelCounts']>,
  workspaceOutcomeEmbedded: UnwrapRef<OutcomeController['workspaceOutcomeEmbedded']>,
};

export function createPlayCardController(shell: PlayCardPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  const pendingPlayCard = scopedState('pending-play-card', undefined as PendingPlayCard | undefined);
  /** The card mid-RETURN from a cancelled play composer (its hand slot
   *  stays held until the transfer proxy touches down). */
  const returningPlayCard = ref(undefined as CardName | undefined);
  /** The card just PLAYED (success) — its hand slot stays held until the
   *  server response removes it from the hand (never a fake return). */
  const departingPlayCard = ref(undefined as CardName | undefined);
  const pendingClientPayment = scopedState('pending-client-payment', undefined as PendingClientPayment | undefined);
  /** A client-hosted PICK (RX35's «where» on a one-press door) — see `PendingClientPick`. */
  const pendingClientPick = scopedState('pending-client-pick', undefined as PendingClientPick | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const playAction = computed(() => {
    // A LAW'S PLAY PICK (RX36): the album and the composer play from the law's PROMISED pick (the live prompt's own
    // shape, the law's waiver standing) — the live menu's «play a card» plays WITHOUT the law, so it is not the
    // question while the bridge stands. Its answer never reaches the server from here (the bridge resolves it).
    const pick = consolePlayPickState.request;
    if (consolePlayPickState.active && pick !== undefined) {
      return {path: [] as ReadonlyArray<number>, input: pick.input};
    }
    return findPlayProjectCardAction(shell.playerView.waitingFor);
  });

  /**
   * MAY THE PLAY COMPOSER LET GO OF THE STAGE?
   *
   * Its successor is standing in the outcome zone (a layer ABOVE the stage,
   * never beside it) AND the landing tableau it carried has finished its own
   * exit. Two halves of ONE handoff: the first says «there is something to
   * take over», the second «and the thing being relieved has gone properly».
   *
   * Splitting them is what makes the exit a dissolve rather than a cut. When
   * the outcome is a DEAL the tableau has usually finished releasing long
   * before the reveal assembles, so this reads exactly as it always did; when
   * the outcome is a DECISION (nothing comes off the deck at all) both events
   * land in the same flush, and clearing the composer there tore the tableau
   * out mid-fade — the one place this whole scene exists to make continuous.
   *
   * It cannot hang: with the claim `presenting`, `playLandingShowing()` is
   * the release flag alone, which is bounded by the dissolve AND its backstop.
   */
  const playComposerReleasable = computed((): boolean => {
    return pendingPlayCard.value !== undefined &&
      // ANY host a PLAY can be made in, not literally the hand: when the hand
      // was a STEP of another workspace («Эпатажный спонсор») the step ends
      // with the play and its outcome moves UP to the host that is still
      // standing (`rehomePlayOutcome`). Pinned to 'hand', this went false at
      // that moment and never came back — the composer stayed mounted over
      // the very pick it had produced. `pendingPlayCard` is what makes the
      // widening safe: a start-QUEUE play has none, so it can never match.
      isPlayOutcomeHost(workspaceOutcomeState.host) &&
      shell.workspaceOutcomeEmbedded &&
      !isPlayedHeroActive() &&
      !playLandingShowing();
  });

  /**
   * TRUE exactly when the held departing-play slot can be released: the
   * played card is genuinely gone from the hand (and the SRR host). A TINY
   * computed on purpose (perf iteration 3): the release used to ride a
   * watcher on `handEntriesAll`, which force-built the whole
   * playable/potential entry list on EVERY server response — hand closed
   * included — to answer a question that is almost always «no card is
   * departing». While `departingPlayCard` is undefined this tracks nothing
   * but that one string.
   */
  const departingPlayCardGone = computed((): boolean => {
    const name = departingPlayCard.value;
    if (name === undefined) {
      return false;
    }
    return !shell.playerView.cardsInHand.some((c) => c.name === name) &&
      !(shell.thisPlayer.selfReplicatingRobotsCards ?? []).some((c) => c.name === name);
  });

  /**
   * The workspace slot the PLAY COMPOSER is teleported into (undefined → its
   * own band). The composer is a PHASE of the hand's frame, so it lands in
   * that frame's OWN zone — the same selector a nested frame would use, one
   * level up the same teleport chain.
   */
  const playEmbedTarget = computed((): string | undefined => {
    if (pendingPlayCard.value === undefined) {
      return undefined;
    }
    const slot = workspaceFrameSlot('hand');
    return !workspaceFrameDescended('hand') || slot === '' ? undefined : slot;
  });

  /**
   * OWNERSHIP ≠ READINESS. The descent is claimed synchronously on the press,
   * but the zone it teleports into exists one flush later. For that one frame
   * the composer must render NOWHERE rather than in its standalone band —
   * mounting it there and moving it next frame is a visible modal-then-embed
   * flash, i.e. exactly the impression this migration removes. Same idiom as
   * `taskHeldForWorkspace` / `deckDrawHolds()`.
   */
  const playHeldForWorkspace = computed((): boolean => {
    return workspaceFrameDescended('hand') && workspaceFrameSlot('hand') === '';
  });

  /**
   * The card the PLAY PREWARM watches: the browse-hand cursor standing on a
   * playable card (never a sale / select / pick mode — those cursors are not
   * «considering a play»). Feeds the focus-dwell preview prefetch, so by the
   * time A lands the composer usually reads its preview synchronously.
   */
  const focusedPlayableHandCard = computed((): CardName | undefined => {
    if (consoleState.section !== 'hand' || consoleState.sale.active ||
        shell.handSelectUiActive || pendingPlayCard.value !== undefined) {
      return undefined;
    }
    const entry = shell.handEntries[consoleState.handIndex];
    return entry?.playable === true ? (entry.card.name as CardName) : undefined;
  });

  const confirmBody = computed((): string => {
    // The pass's consequence is the plate's own OPERATION line (`ConsoleActionConfirm`, PL-385) — the body is only a
    // WARNING.
    if (consoleState.confirm === 'pass') {
      return '';
    }
    // The sentence is a WARNING's — only when the step is empty (PL-067: the reacting-table stage has none).
    const found = confirmOption.value;
    return (found?.option.warnings ?? []).includes('maxtemp') ? 'The temperature is already at its maximum.' : '';
  });

  /** The standing conversion's option (heat / plants) — ONE reader for the plate's props and its A. */
  const confirmOption = computed((): {path: ReadonlyArray<number>, option: SelectOptionModel} | undefined => {
    return confirmOptionOf(consoleState.confirm);
  });

  /** The conversion's formula chips — the server's reading of the option (PL-067); none for the pass. */
  const confirmEffects = computed((): ReadonlyArray<ActionEffect> => {
    return confirmOption.value?.option.metadata?.effects ?? [];
  });

  /** What the table answers to the conversion — the «Сработает» row (PL-067). */
  const confirmForecast = computed((): EffectForecast | undefined => {
    return confirmOption.value?.option.metadata?.forecast;
  });

  /** T7 info parity: the desktop PassConfirmContent warning set. */
  /**
   * WHAT THE PASS LEAVES UNUSED (`passWarnings.ts`): an action with no effect is never listed as an opportunity —
   * the futile card actions are subtracted, a heat conversion at the temperature's maximum is dropped — and when
   * nothing BUT such actions is left, one quiet line says so (`confirmQuiet`) and the pass stays calm.
   */
  const passReading = computed((): PassWarnings => {
    if (consoleState.confirm !== 'pass') {
      return {lines: []};
    }
    return passLeftBehind.value;
  });

  /**
   * WHAT A PASS WOULD LEAVE UNUSED, whichever door it comes through — the pass confirm above AND a card play that
   * counts as a pass (`ActionPreview.passes`, P80 — the play composer's «ЭТО ПАС» row): ONE reading of ONE set of facts
   * (class CT), never a second count beside this one.
   */
  const passLeftBehind = computed((): PassWarnings => {
    return passWarnings(passFacts.value);
  });

  const passFacts = computed((): PassFacts => {
    return {
      cardActions: shell.actionsAvailableCount,
      futileCardActions: shell.wheelCounts.futileCardActions,
      trade: shell.tradeColonyContext !== undefined,
      plants: findConvertPlantsOption(shell.playerView.waitingFor, shell.thisPlayer.canConvertPlants === true) !== undefined,
      heat: !shell.convertHeatReady ? 'none' : shell.convertHeatFutile !== undefined ? 'futile' : 'useful',
      hydro: shell.hydroActionAvailable,
      freeVote: shell.game.parliament?.viewer?.vote.available === true && shell.game.parliament.viewer.vote.source === 'lobby',
    };
  });

  const confirmWarnings = computed((): Array<string> => {
    return passReading.value.lines.map((l) => l.count !== undefined ? `${translateText(l.key)}: ${l.count}` : translateText(l.key));
  });

  /** The ONE quiet line when only actions with no effect are left ('' otherwise). */
  const confirmQuiet = computed((): string => {
    const q = passReading.value.quiet;
    return q === undefined ? '' : `${translateText(q.key)}: ${q.count ?? ''}`;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function acceptConfirm(): void {
    const kind = consoleState.confirm;
    if (kind === 'pass') {
      consoleState.confirm = undefined;
      const path = findPassPath(shell.playerView.waitingFor);
      if (path !== undefined) {
        shell.submit(optionResponseForPath(path));
      }
      return;
    }
    const found = confirmOption.value;
    if (found === undefined) {
      consoleState.confirm = undefined;
      return;
    }
    // A REPLACED UNIT'S «WHERE» (RX35): the option's pre-collected step stands up in the plate's own zone — the
    // shared picker, the law as its asker — and its answer rides ONE batch with the press; the plate stays until
    // then, B folds the picker one level back to it.
    const step = (found.option.metadata?.steps ?? []).find((s) => s.kind === 'input' && s.input.type === 'card');
    if (step !== undefined && step.kind === 'input') {
      const path = found.path;
      pendingClientPick.value = {
        host: 'confirm',
        input: step.input as SelectCardModel,
        address: step.for,
        zone: '.con-confirm [data-embed-slot="confirm-step"]',
        onAnswer: (response) => {
          shell.submitBatch([optionResponseForPath(path), response]);
        },
        // The plate closes once the data has landed on the chosen card (the answer's scene plays INSIDE it).
        onSettled: () => {
          consoleState.confirm = undefined;
        },
        onCancel: () => {},
      };
      return;
    }
    consoleState.confirm = undefined;
    shell.submit(optionResponseForPath(found.path));
  }

  /** The option behind the standing CONVERSION confirm (heat / plants), by its structural marker. */
  function confirmOptionOf(kind: ActionConfirmKind | undefined): {path: ReadonlyArray<number>, option: SelectOptionModel} | undefined {
    if (kind === 'convertHeat') {
      return findConvertHeatOption(shell.playerView.waitingFor);
    }
    if (kind === 'convertPlants') {
      const found = findConvertPlantsOption(shell.playerView.waitingFor, shell.thisPlayer.canConvertPlants === true);
      return found?.option !== undefined ? {path: found.path, option: found.option} : undefined;
    }
    return undefined;
  }

  // ── flows ────────────────────────────────────────────────────────────
  function openPlayCard(cardName: CardName): void {
    const action = playAction.value;
    const card = action?.input.cards.find((c) => c.name === cardName);
    if (action === undefined || card === undefined || card.isDisabled === true) {
      return;
    }
    // DESCEND, don't open a modal. The player is standing IN «Карты в руке»,
    // so playing this card is the next stage of that screen — claimed
    // SYNCHRONOUSLY (before any render) so no frame can hand the composer to
    // the standalone band first. Opened from anywhere else there is no
    // workspace to be inside of, and the band is the honest presentation.
    // …and INSIDE the Game Start Workspace's play-from-hand step the player
    // is likewise standing in a hand — the composer must descend into its
    // stage zone, never open its own band on top of the workspace (that band
    // is the «modal arrived» reading the whole step exists to remove).
    // A card picked up INSIDE the hand is a PHASE of the hand's frame, never
    // a second frame: the browse grid parks (its selection, filter and scroll
    // survive for free) and the composer teleports into the frame's own zone.
    // The anchor moves with it — a card that leaves the hand takes its own
    // configure stage with it.
    if (workspaceFrameMounted('hand')) {
      descendWorkspaceFrame('hand', cardName, 'Playing', {type: 'cardInHand', card: cardName});
    }
    pendingPlayCard.value = {cardName, input: {...action.input, cards: [card]}, promptId: shell.playerView.waitingFor?.promptId};
  }

  /**
   * DIRECT play from the hand (A on a playable card) — the PERSISTENT HERO.
   *
   * ONE FaceLite hero spawns over the pressed card in the same paint its
   * slot hides (`stagedHandCard`), answers the press on itself (commit ring
   * + lift, `heroCommitLift`), and flies a FIXED-duration transfer into the
   * composer's pre-held card well — the flight starts only once the well's
   * rect has held still across frames, and the real card is revealed UNDER
   * the still-opaque hero on touchdown. Around it, the stage's enter hook
   * fades the rest of the hand in place and materializes the work-surface
   * groups WHILE the hero travels — the card and the level assemble as one
   * event. The grid itself never moves; a far-right card differs only in
   * velocity, never in duration or quality.
   */
  function openPlayCardFromHand(name: CardName): void {
    const slot = shell.handExitSlot(name);
    // Opening pendingPlayCard ALSO engages the Vue-managed hand-slot hold
    // (stagedHandCard) in the same flush — the source card leaves the
    // table the frame its hero exists; no double-vision, patch-proof.
    openPlayCard(name);
    if (slot === null) {
      return;
    }
    void guardHandHeroFlight(runCardTransfer({
      name,
      from: slot,
      resolveTo: () => document.querySelector<HTMLElement>('.con-composer--play [data-zoom-handoff="play-card"]'),
      holdTarget: true,
      onSpawn: heroCommitLift,
    }));
  }

  /**
   * CANCEL of the play composer: the card physically RETURNS to its hand
   * slot (the reverse transfer — playing was never committed). The modal
   * closes at onLift; the hand slot stays held (returningPlayCard) until
   * the proxy TOUCHES DOWN, so the card materializes exactly under it. A
   * hand slot hidden by filters/virtualization degrades to the dive-away
   * exit (touchdown still fires — the hold is always released).
   */
  function onPlayCardCancel(): void {
    // Mid-transaction (submit in flight / scene running) a cancel would
    // corrupt the hero state — the input chain already swallows B, this
    // is the belt-and-braces for programmatic emits.
    if (isPlayedHeroActive()) {
      return;
    }
    const pending = pendingPlayCard.value;
    if (pending === undefined) {
      return;
    }
    const name = pending.cardName;
    // The hero flies HOME — the same persistent-hero grammar reversed: it
    // spawns over the anchored card (which hides under it in the same
    // paint), the leave hook blooms the hand back in around the flight, and
    // the card is revealed in its own held-empty slot on touchdown. One
    // path for the workspace descent and the standalone band alike.
    const modalSlot = document.querySelector<HTMLElement>('.con-composer--play [data-zoom-handoff="play-card"]');
    if (modalSlot === null) {
      pendingPlayCard.value = undefined;
      return;
    }
    returningPlayCard.value = name; // keeps the hand slot held across the modal close
    void guardHandHeroFlight(runCardTransfer({
      name,
      from: modalSlot,
      resolveTo: () => shell.handExitSlot(name),
      // ONE visible owner from the first frame: the anchored card hides
      // under the hero the moment it spawns — the composer stays mounted
      // through its own leave fade, and without the hold both would paint
      // together for the length of that fade.
      holdFrom: true,
      onLift: () => {
        pendingPlayCard.value = undefined;
      },
      onTouchdown: () => {
        returningPlayCard.value = undefined;
      },
    }));
  }

  function clearDepartingPlayCard(): void {
    departingPlayCard.value = undefined;
  }

  function onPlayCardConfirmNative(payload: {branchIndex: number, branchFor?: PreselectAddress, preResponses: ReadonlyArray<unknown>, optionResponse: unknown, stepResponses: ReadonlyArray<unknown>, payment: Payment, rewards?: ReadonlyArray<ResourceTransferSpec>, reactions?: ReadonlyArray<PlayReaction>, rail?: RailReward, spends?: RailReward, alloyPrice?: RailReward, known?: Readonly<Record<string, number>>, targetSpends?: ReadonlyArray<ResourceTransferSpec>, discards?: ReadonlyArray<PreselectedDiscard>, draws?: number, repeat?: ConsoleRepeatPickResult, espionage?: {projection: DeltaEspionageProjectionModel, target?: Color, ownerAnswer?: DeltaStageAnswer}, staged?: StagedPlacementModel, stagedVote?: StagedVoteModel, stagedColony?: StagedColonyModel, agendaWalk?: AgendaWalkModel, agendaWalkRail?: AgendaWalkRailPromise, neutralRally?: {rally: NeutralRallyModel, known: Readonly<Record<string, number>>}, stagedCardTarget?: CardName, armedSpends?: ReadonlyArray<ArmedPlayEffectModel>, composerDraft?: PlayComposerDraft}): void {
    const action = playAction.value;
    const pending = pendingPlayCard.value;
    if (pending === undefined || action === undefined) {
      pendingPlayCard.value = undefined;
      return;
    }
    // A LAW'S PLAY PICK (RX36 Live Experiments): the composed play goes BACK to the law's stage — nothing is sent
    // here. The law's own commit posts it in its one batch behind the menu option and the bill; the scene's promise
    // rides along for the landing the law's commit arms.
    if (consolePlayPickState.active) {
      const card = pending.input.cards.find((c) => c.name === pending.cardName);
      resolveConsolePlayPick({
        cardName: pending.cardName,
        payment: payload.payment,
        branchIndex: payload.branchIndex,
        branchFor: payload.branchFor,
        preResponses: payload.preResponses,
        optionResponse: payload.optionResponse,
        stepResponses: payload.stepResponses,
        cost: card?.calculatedCost ?? 0,
        scene: {
          rewards: payload.rewards, reactions: payload.reactions, rail: payload.rail, spends: payload.spends,
          alloyPrice: payload.alloyPrice, targetSpends: payload.targetSpends, draws: payload.draws, known: payload.known,
        },
        // …and EVERY DOOR the composer opened (the design rule of 2026-10-20): the staged cell / vote / colony and a
        // composed repeat ride the result — the law's commit stages them where an ordinary play would, at its commit.
        composed: {
          ...(payload.staged !== undefined ? {staged: payload.staged} : {}),
          ...(payload.stagedVote !== undefined ? {stagedVote: payload.stagedVote} : {}),
          ...(payload.stagedColony !== undefined ? {stagedColony: payload.stagedColony} : {}),
          ...(payload.stagedCardTarget !== undefined ? {stagedCardTarget: payload.stagedCardTarget} : {}),
          ...(payload.armedSpends !== undefined && payload.armedSpends.length > 0 ? {armedSpends: payload.armedSpends} : {}),
          ...(payload.repeat !== undefined ? {repeat: payload.repeat} : {}),
          ...(payload.composerDraft !== undefined ? {composerDraft: payload.composerDraft} : {}),
        },
      });
      return;
    }
    // The HERO transaction (spec: no visual success before the server's
    // word). The composer STAYS OPEN through the submit; nothing lifts,
    // nothing closes. On the confirmed response the transport gate runs
    // the scene — the composer closes UNDER the lifted card at the
    // 'lifting' phase (watcher below); a refused play keeps the composer
    // intact and re-arms its CTA on 'failed'. Double-confirm is blocked
    // both here and by the composer's own submit latch.
    if (isPlayedHeroActive()) {
      return;
    }
    const isEvent = getCard(pending.cardName)?.type === CardType.EVENT;
    const batch = buildPlayCardBatch({
      playPath: action.path,
      cardName: pending.cardName,
      payment: payload.payment,
      branchIndex: payload.branchIndex,
      branchFor: payload.branchFor,
      preResponses: payload.preResponses,
      optionResponse: payload.optionResponse,
      stepResponses: payload.stepResponses,
      // ProjectInspection: append the chosen already-used action + its
      // composed responses → `[play, {card:chosen}, ...composed]`.
      repeat: payload.repeat,
    });
    // CORPORATE ESPIONAGE (DP10): the commit does not land on the table —
    // it DESCENDS into the Hydronetwork workspace's execution mode (the
    // task's own re-entry), where the target's retreat, their reward, the
    // owner's advance and the result summary play in the printed order.
    // The played-hero scene and the play-outcome claim are deliberately
    // NOT armed: the hydro flow owns the whole presentation (the card's
    // physical presence is the ctx source dock; the owner's stage-5 draw
    // is the hydro claim's).
    if (payload.espionage !== undefined) {
      // ONE PLAY, ONE EXECUTION — the hydro advance's own guard: while an execution stands (or its marker glides)
      // the commit owns the moment, and a second confirm is the same play posted twice.
      if (hydroFlowState.commit !== undefined || isHydroMarkerActive()) {
        return;
      }
      shell.beginEspionageExecution(payload.espionage);
      setWorkspaceFramePhase('hand', 'executing');
      shell.submitBatch(batch, pending.promptId);
      return;
    }
    // STAGED PLAY (docs/TILE_PLAY_STAGED_COMMIT.md): a play whose preview
    // carries a StagedPlacementModel submits NOTHING here. The tabletop
    // LANDING CEREMONY plays first (§8-bis — the card physically lands on
    // its family stack, presentational and reversible), then the batch
    // parks, the workspace steps aside, and the board runs the cell pick as
    // the play's LAST REVERSIBLE STEP — the confirm there is the one submit.
    // Deliberately not for a composed repeat (ProjectInspection's own card
    // places nothing; a copied action's placement is the copy's follow-up).
    // BOUNDARY (v1): only a HAND-rooted flow or a standalone band. A play
    // hosted inside the START deployment (start ⊃ hand — the play-from-hand
    // prelude) keeps today's flow: the staged success DISCARDS the yielded
    // frames, and a PHASE-anchored root must survive its inner flows.
    const stagedRoot = workspaceStackRootKind();
    // …and the LAW'S LIVE PLAY (RX36, a bill with a payment of its own — Helion / Luna): the hand stands as a STEP of
    // «Действия карт» (`card-actions ⊃ hand`), and the play it makes keeps every reversible door an ordinary play
    // has (the design rule of 2026-10-20). Not phase-anchored: the staged success may drop the yielded stack.
    const handRoot = stagedRoot === 'hand' ||
      (stagedRoot === 'card-actions' && workspaceFrameHost('hand') === 'card-actions' && resolutionPlayOf(shell.playerView.waitingFor) !== undefined);
    if (payload.staged !== undefined && payload.repeat === undefined && payload.composerDraft !== undefined &&
        (stagedRoot === undefined || handRoot)) {
      const arm: StagedPlayArm = {
        flow: 'play',
        cardName: pending.cardName,
        isEvent,
        batch,
        target: {kind: 'cell', placement: payload.staged},
        ...(payload.stagedCardTarget !== undefined ? {cardTarget: payload.stagedCardTarget} : {}),
        // The price the board's bar and plate name («Разыграть · 15 M€») — the composer's settled cost (T15 · CD).
        receipt: playReceiptOf(pending),
        ...(payload.armedSpends !== undefined && payload.armedSpends.length > 0 ? {armedSpends: payload.armedSpends} : {}),
        rewards: payload.rewards,
        draws: payload.draws ?? 0,
        deckCheck: false,
        pending,
        draft: payload.composerDraft,
        yieldedStack: false,
      };
      if (workspaceFrameDescended('hand') && !shell.playedOpen) {
        // The workspace host owns the landing stage — play the ceremony.
        void shell.beginStagedPlayLanding(pending, isEvent, arm);
      } else {
        // The standalone band has no landing stage to land on — hand the
        // screen to the board directly (the band's own dissolve is the
        // transition).
        shell.enterStagedPlacement(arm);
      }
      return;
    }
    // STAGED VOTE (docs/TURMOIL_REDUX_POLITICAL_DONATION.md): a play whose
    // preview carries a `delegateGrant` door submits NOTHING here either. The
    // same tabletop ritual plays (the card lands on its stack), then the
    // Parliament's vote mode unfolds INSIDE this workspace, out of the zone
    // the landing scene stood in; the resolution confirmed there is the
    // play's one submit, B there walks back to this composer. The SAME v1
    // boundary as the staged cell — a hand-rooted descent; everything else
    // (start ⊃ hand, the standalone band) submits as usual and meets the
    // grant LIVE, hosted by whatever flow raised it.
    if (payload.stagedVote !== undefined && payload.repeat === undefined && payload.composerDraft !== undefined &&
        handRoot && workspaceFrameDescended('hand') && !shell.playedOpen) {
      const arm: StagedPlayArm = {
        flow: 'play',
        cardName: pending.cardName,
        isEvent,
        batch,
        target: {kind: 'resolution', vote: payload.stagedVote},
        ...(payload.armedSpends !== undefined && payload.armedSpends.length > 0 ? {armedSpends: payload.armedSpends} : {}),
        draws: payload.draws ?? 0,
        deckCheck: false,
        pending,
        draft: payload.composerDraft,
        yieldedStack: false,
        receipt: playReceiptOf(pending),
      };
      // The ritual is the warm-up window: the table's illustrations are
      // decoded while the card lands, so the vote rises with its pictures in.
      preloadResolutionArt((shell.playerView.game.parliament?.slots ?? []).map((slot) => slot.resolution));
      void shell.beginStagedPlayLanding(pending, isEvent, arm);
      return;
    }
    // STAGED COLONY (Turmoil Redux TR07 — docs/TURMOIL_REDUX_COLONY_SPONSORS.md): a play whose preview carries a
    // `colonyPick` door submits NOTHING here. The same ritual plays, then the colony grid unfolds INSIDE this
    // workspace, out of the zone the landing scene stood in — every candidate showing where its marker lands; A
    // on a tile descends to its stage, A there is the play's one submit, B walks back one level. The SAME v1
    // boundary as the staged cell and the staged vote — everything else submits and meets the pick LIVE.
    if (payload.stagedColony !== undefined && payload.repeat === undefined && payload.composerDraft !== undefined &&
        handRoot && workspaceFrameDescended('hand') && !shell.playedOpen) {
      const arm: StagedPlayArm = {
        flow: 'play',
        cardName: pending.cardName,
        isEvent,
        batch,
        target: {kind: 'colony', pick: payload.stagedColony},
        ...(payload.armedSpends !== undefined && payload.armedSpends.length > 0 ? {armedSpends: payload.armedSpends} : {}),
        draws: payload.draws ?? 0,
        deckCheck: false,
        pending,
        draft: payload.composerDraft,
        yieldedStack: false,
        receipt: playReceiptOf(pending),
      };
      void shell.beginStagedPlayLanding(pending, isEvent, arm);
      return;
    }
    // ProjectInspection ENTERS through card PLAY, so it EXITS like a card
    // play — never into the Action Center (that surface is the Viron entry
    // point). The event card runs its played-hero scene FIRST (same as any
    // play, repeat tail already in the batch); a repeated REVEAL action
    // (SearchForLife / AsteroidDeflection) then presents its verdict as this
    // workspace's own next stage, AFTER the hero (the reveal is withheld
    // while `playedHeroHolds`). So the order is always: the card is seen
    // played, THEN the action result applies — inside the surface the press
    // was made in, exactly like every other outcome of a play.
    // `rewards` = the play's immediate resource gains (composer-extracted
    // from the server preview) — the hero scene's reward beat carries them
    // from the landed card onto the left panel, delta chips at contact.
    // HOST: a play composed INSIDE the hand workspace lands in the
    // workspace's own EMBEDDED «Разыграно» stage — the standalone overlay
    // never opens for it. A play with no descent behind it (the
    // playFromHand band) — or one made while the player's own table is
    // already open — keeps the overlay scenery.
    // «КАРЬЕРА» (Turmoil Redux TR04): the preview's SHOW step says the marker
    // will walk — the workspace the play runs in OWES that step from this
    // press on (its conclusion holds, its crumb names the coming stage) until
    // the answer's record arrives and is played there. Only the hand's own
    // descent hosts it; a play with no descent behind it (the standalone
    // band, an open table) lets the state update and the journal tell.
    if (payload.agendaWalk !== undefined && payload.agendaWalk.walked > 0 && workspaceFrameDescended('hand') && !shell.playedOpen) {
      // …with the table's answer to the walk's TR step (PL-002): held with that step, released after its chip.
      promiseAgendaWalk(pending.cardName, 'hand', payload.agendaWalkRail);
    }
    // «ДЕЛЕГАТЫ» (TR31): the preview's SHOW step says neutral cubes will be placed and a recount paid — the same
    // promise, with the play's own price as the rail's known move (the M€ row moves by both in one answer).
    if (payload.neutralRally !== undefined && workspaceFrameDescended('hand') && !shell.playedOpen) {
      promiseNeutralRally(pending.cardName, 'hand', payload.neutralRally.known);
    }
    armPlayedHero(pending.cardName, isEvent, {
      manualTableOpen: shell.playedOpen,
      rewards: payload.rewards,
      // The table's answer on the cards (К-S1): the holders the forecast promised, verified and flown by the scene.
      reactions: payload.reactions,
      rail: payload.rail,
      // The price the play takes OFF THE RAIL (X87's shipment): flown into the standing card before the lift.
      spends: payload.spends,
      // …and the card's own price in ALLOYS (PL-1841 ①): off the steel / titanium row into its printed cost.
      alloyPrice: payload.alloyPrice,
      // …and the price taken off a card the composer's own step chose (PL-268, TR52): off the answered target row.
      targetSpends: payload.targetSpends,
      // …and the card's price paid with CARD resources (PL-163 — a floater of Dirigibles, a mech of EVA): a token off
      // each pay row into the standing card's cost badge, in the same beat. What else this play moves on the same
      // holder (a gain landing on it, a woken reaction) is the check's known move.
      price: playCardPriceReward(payload.payment, [...(payload.rewards ?? []), ...(payload.reactions ?? []).map((r) => r.spec)]),
      host: workspaceFrameDescended('hand') && !shell.playedOpen ? 'workspace' : 'overlay',
      // THE PICTURE THE CARD WEARS: it lifts off the composer's stationary
      // hero (`normal` tier over the hand model) and lands on the receiving
      // stage's face (`thumb` tier over the committed tableau model) — the
      // proxy swaps at the apex, so the handoff compares identical faces.
      sourceFace: {lightweight: false, card: pending.input.cards.find((c) => c.name === pending.cardName)},
      landingFace: {lightweight: true, model: 'tableau'},
    });
    // EVERYTHING THIS PLAY SETS OFF STAYS INSIDE THE WORKSPACE IT WAS MADE
    // IN — the cards it draws, the pick it raises. Claimed in the same press
    // as the submit (nothing card-shaped can slip past and open a standalone
    // surface for a frame), by the ONE resolver every play door shares, and
    // OPTIMISTICALLY: a play that turns out to produce nothing embeddable is
    // reconciled away a tick after the response, whereas a missing claim
    // sends a full-bleed reveal over a workspace that has already let go.
    // …including a REPEATED action's verdict: the composed repeat says
    // structurally whether the branch it copied reveals a card, so «Проверка
    // проекта» hosts its «Результат вскрытия» itself instead of handing it to
    // the full-bleed modal over a workspace that had just produced it.
    claimPlayOutcome(pending.cardName, payload.draws ?? 0,
      {deckCheck: payload.repeat?.reveal === true});
    // The descent crosses its commit boundary HERE: the crumb's stage marker
    // goes amber (a committed step is a statement, not an invitation), the
    // depth model stops offering «back» for a move the server already has —
    // and the FRAME survives the round trip on the same fact. Between this
    // submit and the project's landing the server names no prompt at all, and
    // a claim that lapsed there would tear the hand out from under a card
    // that is still in the air.
    setWorkspaceFramePhase('hand', 'executing');
    // THE PLAY'S CARD PRICE (P86 · PL-1128 — P68's door carried to the play): a discard the composer pre-selected in
    // the album leaves the hand NOW, at the press — armed synchronously before the batch goes, its source the card's
    // body in the dock. The transport plays it as the hero's fourth shipment, before the lift. (A STAGED play parks
    // its batch and submits later — none of today's discarding plays is staged; such a play meets its scene live.)
    for (const d of payload.discards ?? []) {
      armPreselectedDiscard(d.names, d.meta);
    }
    // Stamped with the prompt the composer was OPENED on: a play composed for a prompt the server no longer holds is
    // refused as stale, never applied to whatever menu stands now.
    shell.submitBatch(batch, pending.promptId);
  }

  function submitInnerOption(found: {options: ReadonlyArray<unknown>, path: ReadonlyArray<number>} | undefined, targetTitle: string): boolean {
    if (found === undefined) {
      return false;
    }
    const options = found.options as ReadonlyArray<{type: string, title: string | Message}>;
    const innerIdx = options.findIndex((o) => o.type === 'option' && inputTitleText(o.title) === targetTitle);
    if (innerIdx === -1) {
      shell.showNotice('Unavailable right now');
      return false;
    }
    closeConsoleLayers();
    shell.submit(wrapPath([...found.path, innerIdx], {type: 'option' as const}));
    return true;
  }

  /**
   * HAND THE CRUMB'S TAIL ON to the coming effect stage — at the take, not
   * at the decision's mount. Between the batch leaving and the decision
   * arriving nobody owns the tail (the reveal's name dies with it, the
   * decision publishes a flush after its teleport), and falling back to the
   * composer's parked «РАЗЫГРАНО» there is a step BACKWARDS through a flow
   * that only moves forward — the same law the discard hand-off and the
   * on-press branch already follow. Idempotent: the decision publishes the
   * same key again on mount, and an unchanged string does not re-animate.
   */
  function handEffectStageOn(): void {
    const key = shell.rawEffectDecisionVm?.stageKey ?? '';
    if (key !== '') {
      setWorkspaceOutcomePhase(key);
    }
  }

  /**
   * THE CARD PLAY'S ONE ENDING — every way a play can finish routes here.
   *
   * A play can end in three places and each of them used to conclude itself:
   * the landing scene's closing beat, the colony follow-up's completion, and
   * (never, until now) the cards the play DREW. The third one is what made
   * the first wrong: the closing beat folded the workspace unconditionally,
   * so a card that drew cards let its own workspace dissolve and the batch
   * then arrived as a full-bleed reveal over the board.
   *
   * So the ending is the shared guarded conclusion, and it HOLDS while this
   * workspace still owes something — a nested step (the colony pick), a live
   * outcome of its own (the drawn batch, the buy prompt) or a park.
   *
   * The workspace it asks about is the one the play RAN IN: the hand when a
   * hand frame is standing (the composer's home, embedded or not), else the
   * start (a queue play with no hand step). Asking BOTH is wrong in exactly
   * one shape — the sponsor's ordinary play (`start ⊃ hand`, no follow-up),
   * where the thing nested inside the start IS the play's own hand step and
   * ending it is this beat's whole job.
   */
  function endPlayCardFlow(): void {
    const playedIn: WorkspaceFrameKind = workspaceFrameIndex('hand') !== -1 ? 'hand' : 'start';
    if (playedIn === 'hand') {
      shell.adoptPlayEffectDecision();
    }
    // THE LANDING SCENE LETS GO — but not into an empty frame. While this
    // workspace's own outcome is still on its way, the settled tableau stays
    // on screen and the arriving surface is what relieves it (the handoff in
    // `workspaceOutcomeEmbedded`); in every other case the composer goes NOW,
    // because a step that nests teleports into the very zone it occupies.
    const awaiting = workspaceOutcomeState.host === playedIn &&
      workspaceOutcomeClaimed() && workspaceOutcomeState.stage !== 'presenting';
    if (!awaiting) {
      pendingPlayCard.value = undefined;
    }
    shell.concludeWorkspaceFlowOrOwe(playedIn, false);
  }

  /** The composer and the landing proxy let go IN PLACE under a step risen from the commit (PL-084 / PL-120). */
  async function releasePlayComposerUnderStep(): Promise<void> {
    // The composer lets go of the BAR at the start of its fade (PL-084): from this frame the bar reads the
    // step's own contract («Выполняется…»), never «A РАЗЫГРАТЬ · B ОТМЕНА» over a frame past the commit. Only a
    // STANDING composer lets go (its unmount clears the flag — a release with no composer would latch).
    if (pendingPlayCard.value !== undefined) {
      releaseConsolePlayCardCommands();
    }
    const composer = ((shell.$refs.playConfirm ?? undefined) as {$refs?: {rootEl?: unknown}} | undefined)?.$refs?.rootEl;
    const proxy = typeof document === 'undefined' ? null : document.querySelector('.con-played-hero__proxy');
    const fades = [composer, proxy].flatMap((el) =>
      el instanceof HTMLElement && !consoleReducedMotionActive() && typeof el.animate === 'function' ?
        [el.animate([{opacity: 1}, {opacity: 0}], {duration: motionMs(STAGED_VOTE_RELEASE_MS), easing: 'ease-out', fill: 'forwards'})] : []);
    await Promise.all(fades.map((fade) => fade.finished.catch(() => undefined)));
    // The composer goes once its scene has let go — the play is made, there is nothing to roll back.
    pendingPlayCard.value = undefined;
  }

  // The play composer owns the ideological focus while open — the hand's
  // focus chrome behind it goes quiet (same rule as the fullscreen zoom).
  /**
   * FOCUS PREWARM — the dwell timer follows the browse cursor. Arming is
   * latest-wins (riffling across the hand fires zero requests); leaving the
   * hand / entering any pick mode cancels the pending dwell outright.
   */
  function whenFocusedPlayableHandCardChanges(name: CardName | undefined): void {
    if (name === undefined) {
      cancelHandPlayPrewarm();
    } else {
      armHandPlayPrewarm(shell.playerView, name);
    }
  }

  /** WATCH `pendingPlayCard` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenPendingPlayCardChanges(now: PendingPlayCard | undefined): void {
    document.body.classList.toggle('con-play-modal-open', now !== undefined);
    // THE DESCENT ENDS WITH THE COMPOSER, on every path — the B cancel, the
    // successful play (the composer closes under the lifted card), and a
    // prompt-identity change that moved the flow on. One place, so a phase
    // can never outlive its flow and leave the shelf parked behind nothing.
    //
    // THREE exceptions, and they are the same fact three times — something
    // this frame is CARRYING is still owed, and a host cannot fold under it:
    //  · a nested STEP (the played card's colony follow-up);
    //  · this play's own OUTCOME (the cards it drew, the pick it raised);
    //  · a step still OWED — its door is held behind the effect that arrived
    //    with it (one press, several effects). Folding here would retract the
    //    very zone that step is going to teleport into, and the grid would then
    //    open as a lateral screen instead of one level deeper.
    // Without the second one the composer's departure un-parked the browse
    // grid UNDERNEATH the embedded reveal: the hand shelf stood fully lit
    // behind the drawn card, the toolbar came back, and the crumb dropped
    // its tail — a decision surface floating over the screen it belongs to,
    // which is exactly the «modal that arrived» reading the embedding
    // exists to remove.
    if (now === undefined && !workspaceFrameHasNested('hand') && !shell.handOutcomeLive &&
        !shell.followUpStepOwed) {
      shell.foldHandStage();
    }
  }

  // A successfully played card leaves the hand with the server response —
  // release its held slot the moment it is genuinely gone (never a fake
  // return; the safety timer below covers a rejected play). Keyed on the
  // cheap membership computed, NOT on `handEntriesAll` — see its doc.
  function whenDepartingPlayCardGoneChanges(gone: boolean): void {
    if (gone) {
      clearDepartingPlayCard();
    }
  }

  /**
   * THE HANDOFF'S SECOND HALF — the play composer unmounts once its landing
   * tableau has finished leaving, and never a frame before.
   *
   * POST-flush deliberately: the composer's own release watcher runs LATER in
   * the same flush this fact first changes in (a child's watcher after its
   * parent's), so asked pre-flush the answer would be «nothing is showing»
   * one tick too early — and clearing there is the cut this replaces.
   */
  function whenPlayComposerReleasableChanges(releasable: boolean): void {
    if (releasable) {
      pendingPlayCard.value = undefined;
    }
  }

  return {
    pendingPlayCard,
    returningPlayCard,
    departingPlayCard,
    pendingClientPayment,
    pendingClientPick,
    playAction,
    playComposerReleasable,
    departingPlayCardGone,
    playEmbedTarget,
    playHeldForWorkspace,
    focusedPlayableHandCard,
    confirmBody,
    confirmOption,
    confirmEffects,
    confirmForecast,
    passReading,
    passLeftBehind,
    passFacts,
    confirmWarnings,
    confirmQuiet,
    acceptConfirm,
    confirmOptionOf,
    openPlayCard,
    openPlayCardFromHand,
    onPlayCardCancel,
    clearDepartingPlayCard,
    onPlayCardConfirmNative,
    submitInnerOption,
    handEffectStageOn,
    endPlayCardFlow,
    releasePlayComposerUnderStep,
    whenFocusedPlayableHandCardChanges,
    whenPendingPlayCardChanges,
    whenDepartingPlayCardGoneChanges,
    whenPlayComposerReleasableChanges,
  };
}

export type PlayCardController = ReturnType<typeof createPlayCardController>;
