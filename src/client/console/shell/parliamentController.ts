/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PARLIAMENT CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed, ref} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {isReduxParty, REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {consoleCardActionsUi, partyTileKey, resetCardActionsFilter} from '@/client/console/consoleCardActions';
import {submitInput, SubmitTicket} from '@/client/console/transport/gameTransport';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ConsoleHandEntry} from '@/client/components/console/consoleHandSectionTypes';
import {ConsoleColonyPick} from '@/client/components/console/consoleColoniesSectionTypes';
import ConsoleParliamentSection from '@/client/components/console/ConsoleParliamentSection.vue';
import {ParliamentInspectRequest} from '@/client/console/parliament/parliamentInspect';
import {preloadResolutionArt} from '@/client/console/parliament/parliamentArtTier';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {agendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {neutralRallyFlow} from '@/client/console/parliament/neutralRally';
import {HostedParliamentStepKind, hostedStepOwedTo} from '@/client/console/parliament/hostedParliamentStep';
import {clearSupportDiscard, promiseSupportDiscard} from '@/client/console/parliament/supportDiscard';
import {parliamentSittingLive, sittingTailPlacementOf, sittingTailVenusBonusOf} from '@/client/console/parliament/consoleSittingFlow';
import {sittingRiseOwed} from '@/client/console/parliament/sittingRise';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {parliamentPlayerName, resolutionPlayOf} from '@/client/console/parliament/consoleParliamentModel';
import {SittingInvitationFacts, sittingInvitationFacts} from '@/client/console/parliament/sittingInvitation';
import {closePhaseRoot, phaseRootAnywhere, enterWorkspace, goBoardHome, popWorkspaceFrame, pushWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameServes, setWorkspaceFrameStage, workspaceFrameDescended, workspaceFrameIndex, workspaceFrameMounted, workspaceFrameRenders, workspaceFrameSlot, workspaceStackTop, workspaceFrameAnchor, workspaceFrameHost, workspaceFrameKnown, workspaceFrameTarget, workspaceSceneOnStage, FrameAnchor, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {draftMandatoryFlowBeat} from '@/client/console/draft/consoleDraftFlow';
import {Phase} from '@/common/Phase';
import {armPlayedHero, isPlayedHeroActive, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {CardType} from '@/common/cards/CardType';
import {consoleStartState} from '@/client/console/consoleStartState';
import {bonusActionOwed} from '@/client/console/bonusAction';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {partyEffectZoomEntry, resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {openConsoleCardZoom, ZoomOrigin} from '@/client/console/consoleCardZoom';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {ConsoleTask, taskFor, DELEGATE_GRANT_STEP_STAGE, AGENDA_WALK_STEP_STAGE, AGENDA_WALK_SEAT_STEP_STAGE, NEUTRAL_RALLY_STEP_STAGE, partyStepStageOf} from '@/client/console/consoleTaskRouter';
import {promptSourceResolution, sittingAskResolution} from '@/client/console/promptSource';
import {sittingReactionOf} from '@/client/console/parliament/agendaReaction';
import {tableAnswerAskOf} from '@/client/console/parliament/tableAnswerBeat';
import {chairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {setConsoleTaskHandoffPending} from '@/client/console/consoleLeakDetector';
import {beginGovScaleClose} from '@/client/console/consoleGovScaleFocus';
import {ShellTaskDestination} from '@/client/console/shellTaskSurface';
import {workspaceClaimsColonyRevealBatch, releaseWorkspaceOutcome, retainWorkspaceOutcomeForNextBatch, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {colonyBonusPayout, colonyBonusPayoutArmed, colonyBonusPayoutLive, colonyBonusPayoutOf, finishColonyBonusPayout, payoutDiscardDue, payoutPromptColony, payoutUntaken, resetColonyBonusPayout} from '@/client/console/colonyLedger/colonyBonusPayout';
import {railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {railRewardPending, type RailReward} from '@/client/console/resourceTransfer/railReward';
import {discardExchangeRailKey} from '@/client/console/cardDiscard/discardExchangeBeat';
import {playCardPriceReward} from '@/client/console/consoleActionCommit';
import {getCard} from '@/client/cards/ClientCardManifest';
import {consoleState, closeConsoleLayers} from '@/client/console/consoleRouter';
import {surfaceLeaveHook, surfaceLeaveCancelledHook} from '@/client/console/surfaceMotion/surfaceMotionDirector';
import {beginLawPlayLanding, lawPlayLandingOf, lawPlayStagedDoor, type LawPlayDetail} from '@/client/console/consolePlayPick';
import {resolutionTileKey} from '@/client/console/parliament/partyActionKey';
import {handoffPendingEntries} from '@/client/console/shell/shellFlowState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {MandatoryBeat, acknowledgeMandatoryBeat} from '@/client/console/consoleMandatoryGate';
import {PromptSurface} from '@/client/console/consolePromptAdmission';
import {screenHandoffOwed, waitScreenHandoff} from '@/client/console/screenHandoff';
import {stagedPlayState, stagedPlayActive, stagedVoteOf, stagedStepHost, clearStagedPlay} from '@/client/console/stagedPlay';
import type {StagedPlayArm, StagedPlayTarget, StagedReceipt} from '@/client/console/stagedPlay';
import type {StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {PendingPlayCard, PendingClientPayment, PARLIAMENT_LEAVE_NET_MS, PARLIAMENT_STEP_LEAVE_MS} from '@/client/console/shell/shellShared';
import type {StagedController} from '@/client/console/shell/stagedController';
import type {CardActionsController} from '@/client/console/shell/cardActionsController';
import type {StartController} from '@/client/console/shell/startController';
import type {MaController} from '@/client/console/shell/maController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {NoticeController} from '@/client/console/shell/noticeController';
import type {SeatController} from '@/client/console/shell/seatController';

/** The hosted step's own leave fade — named, so a re-show finds and cancels it (`parliamentShown`). */
const PARLIAMENT_STEP_LEAVE_ID = 'parliament-step-leave';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type ParliamentPort = {
  $refs: Record<string, unknown>,
  admits(surface: PromptSurface): boolean,
  beginStagedLawLanding: UnwrapRef<StagedController['beginStagedLawLanding']>,
  cancelStagedPlay: UnwrapRef<StagedController['cancelStagedPlay']>,
  cardActionsDissolveArmed: UnwrapRef<CardActionsController['cardActionsDissolveArmed']>,
  commitStagedTail: UnwrapRef<StagedController['commitStagedTail']>,
  concludeWorkspaceFlowOrOwe(kind: WorkspaceFrameKind, servedPromptHolds?: boolean): boolean,
  continueStartWalkInPlace: UnwrapRef<StartController['continueStartWalkInPlace']>,
  deferShellTask(destination: ShellTaskDestination): void,
  endCardActionsWithHostedStep(): void,
  endHandWithHostedStep(colonyPick?: ConsoleColonyPick): void,
  enterStagedHostedStep(arm: StagedPlayArm, frame: Parameters<typeof pushWorkspaceFrame>[0]): Promise<void>,
  enterWorkspaceAfterHandoff(kind: WorkspaceFrameKind, opts: {anchor: FrameAnchor}): void,
  focusFirstSelectableHandCard(): void,
  game: UnwrapRef<MaController['game']>,
  handDissolveArmed: boolean,
  readonly handEntries: ReadonlyArray<ConsoleHandEntry>,
  hostedStepEntered(): boolean,
  readonly hostTask: ConsoleTask | undefined,
  readonly mandatoryBeat: MandatoryBeat | undefined,
  openHandWithReveal(opts?: {keepTask?: boolean, overlay?: boolean}): Promise<void>,
  pendingClientPayment: PendingClientPayment | undefined,
  pendingPlayCard: PendingPlayCard | undefined,
  playedOpen: UnwrapRef<PlayedController['playedOpen']>,
  readonly playerView: PlayerViewModel,
  releasePlayComposerUnderStep(): Promise<void>,
  restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean,
  showNotice: UnwrapRef<NoticeController['showNotice']>,
  submit(response: unknown): SubmitTicket,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
};

export function createParliamentController(shell: ParliamentPort) {
  // ── state ────────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * «ПРИЁМКА»: the reveal instance was last re-homed into the PARLIAMENT's draw stage — latched past the take (the
   * batch leaves the queue before the take's staged seam fires), so its two completion seams know the batch was
   * nobody's workspace outcome and fold nothing (the Parliament's own flow goes on from the take).
   */
  const revealParliamentLatch = ref(false);
  /** The Parliament section's leave is in flight: the frame is out of the stack, the section still mounted (v3 В1). */
  const parliamentLeaving = ref(false);
  /**
   * THE WARM MOUNT IS ARMED FROM THE COMPOSER'S READING PAUSE (PL-127): the composer declared a hosted step and
   * its own unfold has settled — the Parliament's surface is mounted invisible NOW, while nothing moves, not in
   * the frame of the press (measured at 4K: the mount cost the press frame 320–410 ms of forced style and
   * layout — a sticky A). Cleared with the declaration (the composer closed, another card).
   */
  const parliamentWarmArmed = ref(false);
  const parliamentWarmTimer = ref(undefined as number | undefined);
  /** The zone the Parliament was hosted in, LATCHED for its leave: the frame pops first, and a leaving step
   *  re-rendered as a standalone band (`con-ws`, its own head) is the flash the embed contract forbids. */
  const parliamentEmbedLatch = ref('');
  /** The staged door the section last served, LATCHED for its leave: the arm is cleared in the very write
   *  that ends the step, and a leaving mode re-read as the viewer's own lobby vote re-words itself mid-fade. */
  const stagedVoteLatch = ref(undefined as {vote: StagedVoteModel, receipt: StagedReceipt | undefined, flow: 'play' | 'action'} | undefined);
  /** …and the hosted Parliament's release rides that dissolve instead of fading on its own under it. */
  const parliamentLeaveRelease = ref(undefined as (() => void) | undefined);
  /** …and its bounded net: a leave that never reports back may not latch the surface for the session. */
  const parliamentLeaveNet = ref(undefined as number | undefined);
  /** Each show / hide edge of the section bumps it: a leave's release is honoured only by its own edge. */
  const parliamentLeaveToken = ref(0);
  /**
   * THE LAW'S CARD LANDS IN ITS STAGE (PL-726 — RX36): the action commit's fold, OWED to the played-hero scene. The
   * awaiting handoff resolved while the card was still landing; the scene's own `closing` runs this (the workspace
   * dissolves with the landed tableau inside it). Cleared by whoever runs it, or by a refusal.
   */
  const lawPlayFold = ref(undefined as (() => void) | undefined);

  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * SOMETHING THE PLAYER IS STILL WORKING THROUGH OWNS THE FOREGROUND — so no
   * prompt-routed DOOR may open into it. While busy, a pending shell-section
   * prompt is held BEHIND what is running; a watcher opens the serving surface
   * the moment this clears (else it'd be a stranded prompt).
   *
   * It is the `followUp` ADMISSION, not a list of its own. The hand-rolled
   * version listed the reveal, the presentation hold, the played hero and the
   * card arrival — and had drifted from the policy it was paraphrasing by four
   * signals (a PENDING reveal batch, the tile-placement hero, a live discard
   * transaction, and the watchdog's staleness mask). That is precisely the
   * drift `consolePromptAdmission` exists to end: one table, one evaluation.
   */
  const consoleForegroundBusy = computed((): boolean => {
    return !shell.admits('followUp');
  });

  /**
   * THE SITTING HOSTS THE BONUS ITS WINNER'S STEP EARNED (P89 · ledger EJ): the winner's rewarded Venus step on the
   * alternative board asks the track's bonus inside the political phase — the engine's tail of the seat's own step
   * (`sittingTailVenusBonusOf`: the bonus marker + the server's `pending` on this seat). A step of the reward page
   * like the law's own picks: the ONE bonus surface stands in the sitting's stage zone once the field has opened (the
   * wave that arrived with it has flown), never a band over the Parliament. Not an outcome claim — the sitting is no
   * outcome host; its own walk holds the page (`sittingRewardSettled`) and its planet beat waits for the answer.
   */
  const sittingHostsVenusBonus = computed((): boolean => {
    const phase = shell.game.parliament?.phase;
    return shell.game.phase === Phase.PARLIAMENT && workspaceFrameKnown('parliament') &&
      sittingTailVenusBonusOf(shell.playerView.waitingFor, phase, shell.thisPlayer?.color);
  });

  /**
   * World Government Terraforming ("Government Support") — the ONE choice
   * prompt that gets the dedicated premium 2×2 briefing panel instead of
   * the generic ConsoleTaskHost list. Never during a client payment.
   */
  const govSupportActive = computed((): boolean => {
    const task = shell.hostTask;
    return shell.pendingClientPayment === undefined &&
      task?.kind === 'choice' && task.flavor === 'wgt';
  });

  /** The server LEDGER's own answer, unmediated by any client latch — the
   *  edge the `bonusActionLedgerOwed` watcher closes the window on. */
  const bonusActionLedgerOwed = computed((): boolean => {
    return bonusActionOwed(shell.playerView);
  });

  /**
   * THE PARLIAMENT'S SITTING FRAME (Turmoil Redux) — the draft's lifecycle
   * contract: a PHASE-anchored root whose rising edge opens NOTHING (the flow
   * beat's announce + the player's A — or the generation scene's rise — stand
   * it up) and whose falling edge closes it. Live while the sitting stands FOR
   * THIS SEAT (the server's per-seat `parliament.phase`: the chain running, or
   * at `done` until the seat's own «Закрыть заседание») — never the game's
   * phase, which has moved on to the next generation by then.
   */
  const parliamentSittingFrameLive = computed((): boolean => {
    return parliamentSittingLive(shell.playerView);
  });

  /** The Parliament frame is in the stack (the section's `v-show`) — invariant 1's presence, read as visibility. */
  const parliamentShown = computed((): boolean => {
    return workspaceFrameRenders('parliament');
  });

  /**
   * THE HOSTED STEP IS WARMED (PL-127, the owner's decision 2026-10-10). A Parliament a card's play OWES the hand
   * — a walk of the Agenda track (TR04 / TR37), a rally of neutral delegates (TR31): promised at the press,
   * recorded with the answer, entered from the landing's commit — is mounted INVISIBLE in the hand's own zone
   * from the press, while the landing ritual plays: laid out, fitted, its art decoded. The frame's push then
   * UNVEILS the same instance (one class flip + the step's own CSS entry) instead of mounting six plaques, the
   * track and the cards in the very frame the eye is on the docked card (measured at 4K: the rise's whole budget
   * was that mount). Presence stays the stack's: the warm mount has no frame, serves nothing, owns no input, is
   * inert to the leak detector (`data-surface-warm`), and leaves with a refused play (the promise is dropped).
   * Never while a Parliament is KNOWN (live or parked — a second instance would reset the flow record the
   * parked one keeps), and only once the hand has published the zone the step will stand in.
   */
  const parliamentWarm = computed((): boolean => {
    return !workspaceFrameKnown('parliament') && !parliamentLeaving.value &&
      workspaceFrameDescended('hand') && workspaceFrameSlot('hand') !== '' &&
      (hostedStepOwedTo('hand') || parliamentWarmArmed.value);
  });

  /** …and the section stays MOUNTED through its leave (v3 В1): presence, or the leave still playing over the latched surface — or the warm mount. */
  const parliamentMounted = computed((): boolean => {
    return parliamentShown.value || parliamentLeaving.value || parliamentWarm.value;
  });

  /**
   * THE PARLIAMENT AS A HOSTED STEP — the zone of the frame below it (the
   * colonies' `[data-embed-slot="colonies-parliament"]` for the Redux
   * Venus's delegate grant). `undefined` = the Parliament stands in its own
   * band, as it always did. The stack's teleport chain, nothing more.
   * WARM (PL-127): the hand's zone — the very selector the pushed frame will
   * resolve, so the push changes no `to` and the teleport never re-resolves.
   */
  const parliamentEmbedTarget = computed((): string | undefined => {
    return workspaceFrameTarget('parliament') ?? (parliamentWarm.value ? workspaceFrameSlot('hand') : undefined);
  });

  const parliamentEmbedActive = computed((): boolean => {
    return parliamentEmbedTarget.value !== undefined || (parliamentLeaving.value && parliamentEmbedLatch.value !== '');
  });

  /** The Parliament stands as the screen itself — the top of the stack, on stage, no step of another flow (ledger HC). */
  const parliamentStandsAsRoot = computed((): boolean => {
    return workspaceStackTop()?.kind === 'parliament' && workspaceSceneOnStage('parliament') && !parliamentEmbedActive.value &&
      !consoleState.task.deferred;
  });

  /** The teleport target — the live zone, or the latched one while a hosted step is still dissolving. */
  const parliamentEmbedTeleportTo = computed((): string => {
    return parliamentEmbedTarget.value ?? (parliamentLeaving.value && parliamentEmbedLatch.value !== '' ? parliamentEmbedLatch.value : 'body');
  });

  /** A Turmoil Redux vote's BILL is the live prompt (the server's marker, never a title). */
  const parliamentBillStanding = computed((): boolean => {
    return shell.hostTask?.kind === 'payment' &&
      (shell.playerView.waitingFor as SelectPaymentModel | undefined)?.votePayment !== undefined;
  });

  /**
   * AN ENACTED RESOLUTION'S ASK is the live host prompt (Turmoil Redux): a
   * pick / a choice whose structural source is a resolution while the
   * political phase is on — the server's own markers, never a title. It
   * belongs INSIDE the Parliament's SITTING (its reward stage's zone), like
   * the vote's bill belongs inside the vote step.
   */
  const parliamentStageTask = computed((): boolean => {
    return shell.hostTask !== undefined && parliamentStagePrompt.value;
  });

  /**
   * A TABLE'S ANSWER TO A WALK OF THE CAREER (TR78 Arwind Inc. — `agendaWalkPrompt`: the quest's step, the sitting's
   * winner step, a law's step) while the Parliament stands: a step of the flow that walked the marker, hosted on the
   * ANSWER STAGE's zone (`[data-embed-slot="parliament-answer"]` — the asker on the hero, the pick / the layout
   * beside it), never a band over it. A reload has no quest flow to stand in — the quest's question is then served
   * where any live pick is; the sitting's stands again in its layer.
   */
  const parliamentAnswerTask = computed((): boolean => {
    const ask = tableAnswerAskOf(shell.playerView.waitingFor);
    return shell.hostTask !== undefined && ask !== undefined && workspaceFrameMounted('parliament') &&
      (ask.cause !== 'quest' || chairmanQuestFlow.live);
  });

  /**
   * THE SITTING'S OWN ASK WAITS FOR ITS SITTING (the soft gates): the pass that ran the law carries the law's first
   * ask of this seat — a pick, a take, the winner's build, a tile — in the same response, applied over the board home
   * BEFORE any stage stands to host it. An ask of the sitting belongs to a step the flow has not reached yet: the
   * stage gate holds every door to it (the colonies, the host, the board) until the sitting stands — or its rise is
   * given up (`sittingRise.ts`) — so it opens INSIDE the stage, never as a screen of its own.
   */
  const sittingRiseGatesPrompt = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    const phase = shell.game.parliament?.phase;
    if (!sittingRiseOwed() || wf === undefined || phase === undefined || shell.game.phase !== Phase.PARLIAMENT) {
      return false;
    }
    // …and a table's answer to a step of the Career the sitting walked (TR78 — the winner's step, a law's step).
    // …and the Venus bonus the seat's own rewarded Venus step earned (P89 · ledger EJ): a step of the same reward page.
    return sittingAskResolution(wf) !== undefined || sittingReactionOf(wf) !== undefined ||
      sittingTailPlacementOf(wf, phase, shell.thisPlayer?.color) || sittingTailVenusBonusOf(wf, phase, shell.thisPlayer?.color);
  });

  /**
   * The same ask by the RAW prompt — not admission-gated: the mandatory
   * plate's A (`openMandatoryAnnounce`) must know where the press goes in the
   * very tick it releases the gate, before `hostTask` has re-derived.
   */
  const parliamentStagePrompt = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    // A law's own ask — or a table's answer to a step of the Career the sitting walked (TR78 Arwind Inc.: the winner's
    // step, where the chain WAITS on it; a law's seat step, RX39): the same zone of the same stage.
    return wf !== undefined && wf.type !== 'space' && (sittingAskResolution(wf) !== undefined || sittingReactionOf(wf) !== undefined) &&
      shell.game.phase === Phase.PARLIAMENT && shell.game.parliament?.phase !== undefined;
  });

  /**
   * «THE LEDGER PAYS» HOLDS THIS CLAIM (TR23 Habitat Science — «gain all your
   * colony bonuses»): the action workspace's live claim is the armed payout's
   * own, and the payout is not over. Keyed on the CARD the server names on
   * every artifact of the payout (`via`), never on «some payout exists».
   */
  const ledgerPayoutClaimed = computed((): boolean => {
    return workspaceOutcomeState.host === 'card-actions' && colonyBonusPayoutLive() &&
      colonyBonusPayoutOf(workspaceOutcomeState.sourceCard);
  });

  /**
   * THE PAYOUT'S DISCARD IS OWED TO THIS LIVE ACTION WORKSPACE — Pluto's
   * «take 1, then discard 1» paid by a card: the server's own markers (the
   * discard's source is the paying card, `colonyRepeat` names the tile), the
   * armed payout, the frame on screen. It is a STEP of the action
   * (`card-actions ⊃ hand`), never an interruption to announce and never the
   * colony workspace's (that is the `colonyBonus` marker's routing).
   */
  const ledgerDiscardStepOwed = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    return colonyBonusPayoutLive() && wf?.discardPrompt !== undefined &&
      payoutPromptColony(wf, colonyBonusPayout.sourceCard) !== undefined &&
      workspaceFrameMounted('card-actions') && taskFor(shell.playerView)?.kind === 'handSelect';
  });

  const ledgerDiscardStepDue = computed((): boolean => {
    return ledgerDiscardStepOwed.value &&
      payoutDiscardDue({waitingFor: shell.playerView.waitingFor, untaken: payoutUntaken, inFlight: false});
  });

  /** The payout's workspace is gone for good (not parked): nobody is left to play it. */
  const ledgerPayoutOrphaned = computed((): boolean => {
    return colonyBonusPayoutArmed() && !workspaceFrameKnown('card-actions');
  });

  /** The invitation plate's two facts and the winner's display name (the bot's seat by its localized name). */
  const sittingInvitationFields = computed((): {invitation?: SittingInvitationFacts, invitationWinnerName?: string} => {
    const invitation = sittingInvitationFacts(shell.game.parliament);
    if (invitation === undefined) {
      return {};
    }
    return {
      invitation,
      invitationWinnerName: invitation.winner === undefined ? undefined : parliamentPlayerName(shell.playerView.players, invitation.winner),
    };
  });

  /**
   * STAGED PLAY's synthetic SelectSpace — byte-shaped like the server's own
   * prompt so the ONE placement resolver (`placementSpaceModel`) and every
   * consumer behind it (binder, reticle, dossier, kicker, planet focus,
   * source view) work unchanged. `placementContext` is synthesized
   * cancellable: nothing has been submitted, so B genuinely undoes.
   */
  /**
   * STAGED VOTE (Turmoil Redux TR03 — a card that places a delegate by being
   * played): the staged prompt the Parliament's vote mode serves while the
   * resolution is chosen. The staged store's SECOND kind of target; the
   * section reads it as the bridge's second source of a grant.
   */
  const stagedVoteModel = computed((): StagedVoteModel | undefined => {
    return stagedVoteOf(stagedPlayState.arm);
  });

  /** …and the card's price as the composer settled it — the mode's locked receipt. */
  const stagedVoteReceipt = computed((): StagedReceipt | undefined => {
    return stagedVoteModel.value === undefined ? undefined : stagedPlayState.arm?.receipt;
  });

  /**
   * WHAT THE SECTION READS: the live staged door — or, while the section is
   * LEAVING, the door it stood on (the same law as its `frozenView`: a
   * leaving surface reads nothing live). Only the section's props take the
   * latch; every shell decision keeps reading the live arm.
   */
  const parliamentStagedVote = computed((): StagedVoteModel | undefined => {
    return stagedVoteModel.value ?? (parliamentLeaving.value ? stagedVoteLatch.value?.vote : undefined);
  });

  const parliamentStagedReceipt = computed((): StagedReceipt | undefined => {
    return stagedVoteModel.value !== undefined ? stagedVoteReceipt.value :
      (parliamentLeaving.value ? stagedVoteLatch.value?.receipt : undefined);
  });

  /** …and the FLOW the staged door commits (a play — TR03; a card's action — TR15: A «Подтвердить»), latched the same way. */
  const parliamentStagedFlow = computed((): 'play' | 'action' => {
    const flow = stagedVoteModel.value !== undefined ? stagedPlayState.arm?.flow :
      (parliamentLeaving.value ? stagedVoteLatch.value?.flow : undefined);
    // A card played THROUGH A LAW (RX36) is a PLAY at its door: A reads «Разыграть карту».
    return flow === 'action' ? 'action' : 'play';
  });

  /**
   * THE STAGED VOTE'S COMMIT WAS REFUSED (the transport's abort battery
   * cleared `committing` with the arm still standing): the falling edge the
   * watcher below gives the mode back on. A SUCCESS never reads true here —
   * the settle clears the arm in the same write.
   */
  const stagedVoteCommitting = computed((): boolean => {
    return stagedVoteModel.value !== undefined && stagedPlayState.committing;
  });

  /**
   * THE WINNER'S TILE WAITS FOR THE PLAYER'S OWN PRESS (Turmoil Redux, «Заседание
   * v2»): a resolution-sourced placement raised while the sitting's stage
   * STANDS is held behind the stage's «К полю» — the hexes stay dark, the
   * stack stays, the reward stage reads the tile. The press opens the door
   * (`consoleParliamentUi.boardDoorOpen`); a parked sitting (the player is
   * already on the board) never closes it, and the placement's end resets it.
   */
  const parliamentPlacementDoorClosed = computed((): boolean => {
    const wf = shell.playerView.waitingFor;
    const phase = shell.game.parliament?.phase;
    if (wf?.type !== 'space' || shell.game.phase !== Phase.PARLIAMENT || phase === undefined) {
      return false;
    }
    // The ENGINE'S TAIL of the seat's own step (the 0 °C ocean of the winner's temperature step — Mohole
    // Contest) stands behind the SAME door: admitted the moment it arrives, it took the screen before the
    // step's own wave had flown (the section unmounted under it and flushed the wave unplayed). The
    // difference is WHO opens the door — the sitting's walk, once its page is quiet, never a press.
    const own = promptSourceResolution(wf) !== undefined || sittingTailPlacementOf(wf, phase, shell.thisPlayer?.color);
    // …and while the sitting is AWAY for another seat's tile (PL-764) the door stays shut: the section is unmounted,
    // but the stage it left is coming back, and the seat's own tile is still read on it first.
    // …and while the sitting is still on its WAY UP (the soft gates: the pass that ran the law is applied over the board
    // home — the seat's tile arrives with it, before any stage stands to hold it).
    // …and from the press that ENTERS the sitting until its stage stands (the frame is in the stack a flush before the
    // section has mounted — an open door there handed the tile to the board under the arriving sitting).
    const sittingEntering = workspaceFrameIndex('parliament') !== -1;
    return own && (consoleParliamentUi.stageStanding || consoleParliamentUi.worldTripHoldsDoor || sittingRiseOwed() || sittingEntering) &&
      !consoleParliamentUi.boardDoorOpen;
  });

  /**
   * THE ACTION WORKSPACE STILL OWES THE ENACTED LAW'S ACTION A STEP (Turmoil Redux, RX36): its card is landing in this
   * stage (PL-726 — the workspace folds on the scene's own `closing`, never on the answer), or the law's LIVE PLAY
   * (PL-727 — the card pick a bill with a payment of its own raised after it) stands. Structural: the landing record
   * and the server's marker, never a title. (A party's discard is `politicalDiscardOwed` — an `owed-step`.)
   */
  const lawStepOwed = computed((): boolean => {
    // …until the scene's CLOSING: with the card's outcome CLAIMED (`claimLawPlayOutcome`) the workspace concludes on that beat
    // itself (the card-actions `lawPlayHeroPhase` watcher) — the landing record outlives it only to `idle`.
    return (lawPlayLandingOf() !== undefined && workspaceFrameMounted('card-actions') && playedHeroState.phase !== 'closing') ||
      lawLivePlayStepOwed.value;
  });

  /**
   * THE REDS' DISCARD IS OWED TO THIS LIVE ACTION WORKSPACE (Turmoil Redux): the party's discard is owed to the card
   * composer that committed it (`politicalDiscardOwed`) and the hand prompt stands. What `armPartyDiscardStep` and
   * `openPartyDiscardStep` act on.
   */
  const partyDiscardStepOwed = computed((): boolean => {
    return politicalDiscardOwed.value && taskFor(shell.playerView)?.kind === 'handSelect';
  });

  /**
   * «ОДИН ФРЕЙМВОРК» (Turmoil Redux): the discard a party's action OWES after its draw, owed to the CARD composer
   * that committed it — the server's own marker at stage `discard`, for the party whose key the workspace's descent
   * draft carries (structural: the marker and the draft, never a title, never a flow record of its own). A step of
   * `card-actions` the conclusion holds for (`owed-step`) until the hand opens in the composer's zone.
   */
  /** A party discard's PAYOUT is still owed to this workspace — awaited from the submit, or held on the rail. */
  const politicalPayoutOwed = computed((): boolean => {
    return consoleCardActionsUi.payoutAwaited || railRewardPending(discardExchangeRailKey(consoleCardActionsUi.draft?.cardName ?? ''));
  });

  const politicalDiscardOwed = computed((): boolean => {
    const marker = shell.playerView.waitingFor?.partyActionPrompt;
    return marker !== undefined && marker.stage === 'discard' &&
      consoleCardActionsUi.draft?.cardName === partyTileKey(marker.party) && workspaceFrameMounted('card-actions');
  });

  /**
   * THE LAW'S LIVE PLAY IS A STEP OF THE ACTION WORKSPACE (RX36, PL-727): a bill with a payment of its own raised the
   * card pick AFTER it — the server's marker at stage `play`, for the law this workspace committed. The hand opens INSIDE
   * that frame, never as a screen of its own over the board.
   */
  const lawLivePlayStepOwed = computed((): boolean => {
    const play = resolutionPlayOf(shell.playerView.waitingFor);
    // The descent the workspace carries is the law's (the card composer — «один фреймворк»).
    return play !== undefined && workspaceFrameMounted('card-actions') &&
      consoleCardActionsUi.draft?.cardName === resolutionTileKey(play.resolution);
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  // ── the Parliament workspace (Turmoil Redux) ─────────────────────────
  /** A vote / party action / seat pick — the section built the byte-identical response. */
  function submitParliament(response: InputResponse): void {
    // A STAGED VOTE's confirm is the PLAY's one submit (Turmoil Redux TR03):
    // the parked batch posts with this party answer — already ADDRESSED to the
    // card by the bridge (`stagedFor`) — as its tail. Decided HERE, in the one
    // funnel every parliament answer goes through, never in the component.
    if (stagedVoteOf(stagedPlayState.arm) !== undefined && response.type === 'party' && response.stagedFor !== undefined) {
      commitStagedVote(response);
      return;
    }
    submitInput(response);
  }

  /** L3 «Источник» inside the vote mode — the CARD whose play (or effect) places this delegate, opened over the mode (which stays mounted). */
  function inspectParliamentSource(card: CardName): void {
    openConsoleCardZoom([{name: card}], 0, undefined, undefined, {statusLabel: 'Source'});
  }

  /**
   * X in the Parliament: the fullscreen inspector over a resolution or a
   * party's effect. The request names the PHYSICAL element the subject
   * stands in (the card lifts out of it and returns into it — one object,
   * never a source under the dim beside an enlarged copy), and — for a
   * resolution the viewer may vote on — the A verb the fullscreen offers:
   * the SAME vote step the overview's A opens, the card flying from the
   * viewer into the step's hero slot (the play-from-hand handoff).
   */
  function inspectParliament(request: ParliamentInspectRequest): void {
    if (request.kind === 'party') {
      // All six parties in ONE viewer, LB/RB paging them in the tier's order (registry R-19):
      // the party the player pressed X on lifts out of its own tile; the others open textually.
      const resolveOrigin = request.origin;
      const parties = REDUX_PARTIES as ReadonlyArray<ReduxParty>;
      const index = Math.max(0, parties.indexOf(request.party));
      const origin: ZoomOrigin = resolveOrigin === undefined ?
        {kind: 'textual'} :
        {kind: 'physical', resolve: (i) => i === index ? (resolveOrigin() ?? null) : null};
      openConsoleCardZoom(parties.map((p) => partyEffectZoomEntry(p)), index, undefined, undefined, {origin, counterInFooter: true});
      return;
    }
    // The vote mode's three proposals in one viewer, in the order they
    // stand (LB/RB page them, the mode's selection follows), with the vote
    // mode's own A — or a single enacted card, read-only. The position rides
    // the footer: the card keeps the size it has on its own.
    const entries = request.ids.map((id) => resolutionZoomEntry(id));
    const resolveAt = request.origin;
    const origin: ZoomOrigin = resolveAt === undefined ?
      {kind: 'textual'} :
      {kind: 'physical', resolve: (index) => resolveAt(index) ?? null, onBrowse: request.onBrowse};
    openConsoleCardZoom(entries, Math.max(0, Math.min(entries.length - 1, request.index)), undefined, undefined, {
      origin,
      vote: request.vote,
      counterInFooter: entries.length > 1,
    });
  }

  /**
   * A PARTY ACTION FROM THE PARLIAMENT (Turmoil Redux) — the second door
   * into the ONE execution point every party action has: the action
   * workspace stands INSIDE the Parliament for its span (`parliament ⊃
   * card-actions`, the host handing the scene over — the header reads
   * «⚖ ПАРЛАМЕНТ › ИНДУСТРИАЛИСТЫ › НАСТРОЙКА») and opens DIRECTLY on the
   * party's composer: same rows, same validation, same preview, same commit
   * beat, same result as the wheel's «ДЕЙСТВИЯ КАРТ» door. Only the origin
   * and the return differ: a cancel and a finished flow both pop back into
   * the Parliament, whose focus is exactly where the player left it. The
   * action's own follow-ups (the Unity trade's colonies, the Reds' discard)
   * nest inside the action workspace as they do from the menu.
   */
  function openParliamentPartyAction(party: ReduxParty): void {
    shell.deferShellTask('card-actions');
    resetCardActionsFilter();
    consoleCardActionsUi.openWith = {party};
    pushWorkspaceFrame({
      kind: 'card-actions',
      subject: party,
      stage: focusKicker('setup'),
      phase: 'configure',
      serves: [],
      anchor: {type: 'always'},
    });
  }

  /**
   * THE ENACTED RESOLUTION'S ACTION FROM THE PARLIAMENT (Open IP Trade) —
   * the party door's twin: the same action workspace nested inside the
   * Parliament, opened DIRECTLY on the law's stage («⚖ ПАРЛАМЕНТ › ОТКРЫТАЯ
   * ТОРГОВЛЯ ПАТЕНТАМИ › ВЫБОР»), the same prompt, the same commit, the same
   * ending back in the Parliament.
   */
  function openParliamentResolutionAction(target: {resolution: string, party: ReduxParty}): void {
    shell.deferShellTask('card-actions');
    resetCardActionsFilter();
    consoleCardActionsUi.openWith = {party: target.party, resolution: target.resolution};
    pushWorkspaceFrame({
      kind: 'card-actions',
      subject: resolutionName(target.resolution),
      stage: focusKicker('setup'),
      phase: 'configure',
      serves: [],
      anchor: {type: 'always'},
    });
  }

  /**
   * A Parliament flow ended (the server answered): a finished flow LEAVES,
   * never folds back to browse. The SITTING's ending is the phase's own end:
   * its frame is PHASE-anchored, so the guarded conclusion would keep it —
   * the root is closed here and by the `parliamentSittingFrameLive`
   * watcher's falling edge (the draft's lifecycle contract).
   */
  /**
   * «К ПОЛЮ» (Turmoil Redux, v2): the ONE door from the sitting's reward stage
   * to the winner's tile. Opening it makes the held placement admissible;
   * the `placementActive` rising edge then does what a placement always does
   * — the parliament root declares `yieldsToBoard`, so the stack steps aside
   * and comes back to the reward stage after the landing. Never automatic.
   */
  function openParliamentBoardDoor(): void {
    if (shell.playerView.waitingFor?.type !== 'space') {
      return;
    }
    consoleParliamentUi.boardDoorOpen = true;
  }

  /**
   * «К ДРАФТУ» — THE SITTING HANDS THE SCREEN TO THE NEXT WORKSPACE (the owner, 2026-10-30: «нажатие A в конце заседания
   * сразу переводит туда, бесшовно, без мигания и промежуточных состояний»). The results page's A was pressed as the
   * door (`consoleParliamentUi.closeInto`) and the answer that ended the seat's sitting carries the draft's beat: the
   * beat is ACKNOWLEDGED here — in the same flush, so its plate never renders — and the draft enters LATERALLY over the
   * Parliament, which keeps its frozen results pose (the section's leave latch) until that very swap: one surface
   * dissolves as the other arrives, never the board home between them. The handover asks the screen director first
   * (`enterWorkspaceAfterHandoff` — a card still flying, the generation counter's flip). Returns false when there is no
   * such door (a plain close, the WGT step first, the final sitting): the root closes as it always did.
   */
  function handSittingToDraft(): boolean {
    const into = consoleParliamentUi.closeInto;
    consoleParliamentUi.closeInto = undefined;
    if (into === undefined || workspaceFrameKnown('draft')) {
      return false;
    }
    const beat = draftMandatoryFlowBeat(shell.playerView);
    if (beat === undefined) {
      return false;
    }
    acknowledgeMandatoryBeat(beat.key);
    // ONE SWAP, ONE FLUSH: `enterWorkspace` keeps a surviving PHASE root (the sitting's), so the Parliament's root is
    // closed explicitly in the same synchronous block — its leave and the draft's entrance play together, and no
    // render ever stands between them.
    const swap = (): void => {
      if (phaseRootAnywhere('parliament')) {
        closePhaseRoot('parliament');
      }
      closeConsoleLayers();
      if (!workspaceFrameKnown('draft')) {
        enterWorkspace('draft', {anchor: {type: 'phase', phase: 'draft'}});
      }
    };
    if (!screenHandoffOwed()) {
      swap();
      return true;
    }
    // THE BOARD IS OWED ITS STORY FIRST (a bot's / a seat's tile of the law landing after the sitting, a scale story):
    // the story plays only on a board the player can see, so the Parliament steps aside to the board — the one honest
    // intermediate state, it has something to show — and the draft follows by itself once the board is quiet (no
    // plate, no second press: the beat is already acknowledged).
    if (screenHandoffOwed({only: ['board-story', 'remote-landing']})) {
      if (phaseRootAnywhere('parliament')) {
        closePhaseRoot('parliament');
      }
      closeConsoleLayers();
      shell.enterWorkspaceAfterHandoff('draft', {anchor: {type: 'phase', phase: 'draft'}});
      return true;
    }
    // Something else is still owed on THIS screen (a card flying into the dock, the counter's flip): the Parliament
    // stays in its frozen results pose until it has landed — bounded and named by the director — then the swap.
    handoffPendingEntries.add('draft');
    setConsoleTaskHandoffPending(true);
    void waitScreenHandoff('sitting-into-draft', {alive: () => shell.playerView?.game !== undefined}).then((outcome) => {
      handoffPendingEntries.delete('draft');
      setConsoleTaskHandoffPending(handoffPendingEntries.size > 0);
      if (outcome === 'dead') {
        if (phaseRootAnywhere('parliament')) {
          closePhaseRoot('parliament');
        }
        return;
      }
      swap();
    });
    return true;
  }

  /** The Parliament's leave has played (v3 В1): the section may unmount now — nothing of it is on screen. */
  function onParliamentAfterLeave(): void {
    window.clearTimeout(parliamentLeaveNet.value);
    parliamentLeaveNet.value = undefined;
    parliamentLeaving.value = false;
  }

  /** The frame came back mid-leave (a restore, a re-open): the section is live again — drop the freeze with the director's. */
  function onParliamentLeaveCancelled(el: Element): void {
    surfaceLeaveCancelledHook(el);
    parliamentLeaving.value = false;
  }

  /** «Осмотреть» on a Mars Parliament card: the workspace opens on its browse layer, as it stands now. */
  function onNotificationOpenParliament(): void {
    if (shell.playerView.game.parliament === undefined) {
      return;
    }
    if (!shell.restoreParkedWorkspace('parliament') && !workspaceFrameKnown('parliament')) {
      enterWorkspace('parliament', {anchor: {type: 'always'}});
    }
  }

  function onParliamentFlowComplete(kind: string): void {
    if (kind === 'seat') {
      return;
    }
    if (kind === 'sitting') {
      if (!parliamentSittingLive(shell.playerView) && phaseRootAnywhere('parliament')) {
        closePhaseRoot('parliament');
        closeConsoleLayers();
      }
      return;
    }
    // THE STAGED VOTE'S STEP IS OVER (its cubes have landed, or its answer is
    // parked behind another prompt): the step and the play it belonged to end
    // TOGETHER — the hand's one guarded conclusion takes the whole stack, so
    // the surface leaves as one (the Parliament dissolves inside its host's
    // own leave, never a frame of the hand's empty stage in between).
    if (stagedVoteOf(stagedPlayState.arm) !== undefined) {
      endStagedVote();
      return;
    }
    // «КАРЬЕРА» (TR04) / «ДЕЛЕГАТЫ» (TR31): the outcome shown inside the hand
    // is over — the step and the play it was the outcome of end TOGETHER (the
    // hand's one guarded conclusion takes the whole stack; the surface leaves
    // as one). A record played by a stand-alone Parliament never reports here
    // (no pose).
    if (kind === 'walk' || kind === 'rally') {
      if (workspaceFrameHost('parliament') === 'hand') {
        shell.endHandWithHostedStep();
        return;
      }
      // «КАРЬЕРА» inside the START (TRP1 — a Prelude's walk): the step LEAVES, one level, and the opening goes on
      // with its queue (the next Prelude's prompt arrived with the walk's own answer; the start serves it).
      if (workspaceFrameHost('parliament') === 'start') {
        popWorkspaceFrame();
        return;
      }
      shell.concludeWorkspaceFlowOrOwe('parliament');
      return;
    }
    // A HOSTED STEP (the delegate grant's vote inside the colonies): the step
    // LEAVES — one level — and the host goes on with its own ending (its owed
    // conclusion re-fires the moment `nested` falls). Never the lateral
    // conclusion, which would take the host down with it.
    if (workspaceFrameHost('parliament') !== undefined && workspaceFrameAnchor('parliament')?.type === 'prompt') {
      // THE START'S VOTE STEP, WITH A WALK BEHIND IT (TRP1 Lobbying Campaign — «add 2 delegates to a resolution,
      // advance your Agenda marker 1 step»): the vote's answer carried the walk's record, owed to the start. The
      // step does not leave — it CONTINUES in place, one stage deeper («ГОЛОСОВАНИЕ» → «КАРЬЕРА» on the same
      // section, the frame past its commit), and leaves once the walk has been read (`'walk'` above).
      if (workspaceFrameHost('parliament') === 'start' && agendaWalkFlow.owed?.host === 'start' && !agendaWalkFlow.live) {
        shell.continueStartWalkInPlace();
        return;
      }
      // …and a card's LIVE door hosted by the hand (a staged tail the server
      // re-asked, a reload) ends the play it was a step of: the hand frame
      // holds nothing else, so its one ending is asked with the step's.
      if (workspaceFrameHost('parliament') === 'hand' && workspaceFrameDescended('hand') && shell.pendingPlayCard === undefined) {
        shell.endHandWithHostedStep();
        return;
      }
      // …and a card ACTION's live door hosted by «Действия карт» (TR15 — a staged tail the server re-asked, a
      // reload, the live grant of a commit made outside the staged boundary) ends the action it was a step of:
      // a finished action LEAVES, never folds back to the composer it was confirmed in.
      if (workspaceFrameHost('parliament') === 'card-actions') {
        shell.endCardActionsWithHostedStep();
        return;
      }
      popWorkspaceFrame();
      return;
    }
    shell.concludeWorkspaceFlowOrOwe('parliament');
  }

  // ── the console-native card-action center (ConsoleCardActions.vue) ────
  // It owns the whole flow (list · inspector · composer) and builds the
  // byte-identical activation batch itself; the shell only POSTs + closes.
  /**
   * A LAW THAT PLAYS A CARD (RX36 Live Experiments): the card LEAVES FROM THE SLOT it stands in on the law's stage
   * and lands as any play does — the scene armed before the batch, on the composer's own promise (its gains, its
   * rail half, the table's answer, its price paid with card resources). No visual success before the server's word.
   * Asked by every road a law's commit takes (the card composer's `submit-batch` — «один фреймворк»).
   */
  function armLawPlayLanding(detail: LawPlayDetail | undefined): void {
    const play = detail?.play;
    if (play !== undefined && !isPlayedHeroActive()) {
      const isEvent = getCard(play.cardName)?.type === CardType.EVENT;
      // THE LAW'S PRICE IS A DEPARTURE OF ITS OWN (PL-725): one answer charges the law's 6 M€ and the card's price,
      // and one «−17» told neither. The law's token leaves the rail FIRST, into the printed cost on the law's face (the
      // stage's hero); the card's price is then the commit's ordinary chip at the landing. Every other check of the
      // scene that reads the M€ row counts the law's price as a known move of the same answer.
      const billMc = detail?.lawBill?.megacredits ?? 0;
      const mcRow = railRowKey({channel: 'stock', resource: 'megacredits'});
      const withBill = (reward: RailReward | undefined): RailReward | undefined => reward === undefined || billMc <= 0 ? reward :
        {...reward, known: {...(reward.known ?? {}), [mcRow]: (reward.known?.[mcRow] ?? 0) - billMc}};
      const billKnown: Record<string, number> = {...(play.scene.known ?? {})};
      // The table's answer on the rail (the ruling party's M€) rides the same response — a known move of the bill too.
      for (const spec of play.scene.rail?.reactions ?? []) {
        if (spec.channel === 'stock') {
          const row = railRowKey(spec);
          billKnown[row] = (billKnown[row] ?? 0) + (spec.direction === 'loss' ? -spec.amount : spec.amount);
        }
      }
      // THE CARD LANDS IN THE LAW'S STAGE (PL-726): the scene's `workspace` host — the stage's decision column becomes
      // the receiving stage, the workspace folds only once the scene has told its story (`lawPlayFoldOwed`). A table the
      // player had open by hand keeps the classic scenery.
      const inStage = workspaceFrameMounted('card-actions') && !shell.playedOpen && detail?.lawBill !== undefined;
      if (inStage && detail?.lawBill !== undefined) {
        beginLawPlayLanding({card: play.cardName, resolution: detail.lawBill.resolution});
      }
      armPlayedHero(play.cardName, isEvent, {
        manualTableOpen: shell.playedOpen,
        sourceSelector: '[data-law-play-face]',
        rewards: play.scene.rewards,
        reactions: play.scene.reactions,
        rail: withBill(play.scene.rail),
        spends: withBill(play.scene.spends),
        alloyPrice: play.scene.alloyPrice,
        targetSpends: play.scene.targetSpends,
        price: playCardPriceReward(play.payment, [...(play.scene.rewards ?? []), ...(play.scene.reactions ?? []).map((r) => r.spec)]),
        ...(billMc > 0 ? {
          bill: {
            reward: {cause: [{channel: 'stock', resource: 'megacredits', amount: billMc, direction: 'loss'}], reactions: [], known: billKnown},
            targetSelector: '.con-cardactions .con-composer__actlaw',
          },
        } : {}),
        host: inStage ? 'workspace' : 'overlay',
        sourceFace: {lightweight: true},
        landingFace: {lightweight: true, model: 'tableau'},
      });
    }
  }

  /**
   * Government Support scale param (temp/oxygen/venus): CLOSE the panel
   * first, THEN submit — so the board scale glide + accent (see the
   * commit in the playerView watcher) play on a clean board, and the next
   * modal is held until that beat finishes. Snap to the board so the scale
   * is what shows while the panel dismisses.
   */
  function onGovSupportLeafConfirm(payload: {response: unknown, param: string}): void {
    goBoardHome();
    closeConsoleLayers();
    consoleState.task.deferred = false;
    beginGovScaleClose(payload.param, () => shell.submit(payload.response));
  }

  /**
   * OPEN the announced interruptive mandatory beat (the player pressed B on
   * the announcement — consoleMandatoryGate). Acknowledging the beat releases
   * the gate: a reveal / host / corp-first modal auto-mounts once its
   * suppression clears, and a shell-section task (hand discard / colony /
   * play-from-hand) is opened onto its surface.
   */
  /**
   * THE REDS' DISCARD IS THE NEXT STEP OF THE ACTION THAT DREW THE CARDS
   * (Turmoil Redux), never an interruption to announce: the press that drew
   * them is the acknowledgement (the reveal's own `openDiscardPick` law), so
   * the beat is acknowledged at the take and the hand opens as a STEP of the
   * action workspace — in the composer's own zone, under one crumb
   * («… › КРАСНЫЕ › СБРОС КАРТ») — once the intake has landed every card
   * (`consoleForegroundBusy`'s falling edge; now, if it already has). No
   * overlapping animations: the album lifts the cards out of a dock they
   * have finished arriving in.
   */
  function armPartyDiscardStep(): void {
    const beat = shell.mandatoryBeat;
    if (beat !== undefined && beat.taskKind === 'handSelect') {
      acknowledgeMandatoryBeat(beat.key);
    }
    consoleState.task.deferred = false;
    if (!consoleForegroundBusy.value) {
      openPartyDiscardStep();
    }
  }

  function continueLedgerPayoutAfterTake(): void {
    const next = drawnCardsState.events.find((e) =>
      !e.dismissed && e.cards.length - e.takenIndices.size > 0 && workspaceClaimsColonyRevealBatch(e));
    retainWorkspaceOutcomeForNextBatch(next?.cards.length ?? 0);
    if (ledgerDiscardStepOwed.value) {
      consoleState.task.deferred = false;
      if (!consoleForegroundBusy.value) {
        openLedgerDiscardStep();
      }
    }
  }

  /**
   * The hand as the payout's «СБРОС» step of the live action workspace
   * (idempotent). Opens only when the discard is DUE — its pair's card taken,
   * its row paying; until then the door stays shut and nothing else may open
   * for that prompt (the three callers: the take, the foreground's falling
   * edge, the `ledgerDiscardStepDue` rising edge).
   */
  function openLedgerDiscardStep(): void {
    if (!ledgerDiscardStepDue.value) {
      return;
    }
    if (workspaceFrameKnown('hand')) {
      shell.focusFirstSelectableHandCard();
      return;
    }
    // A DISCARD OPENS THE REAL HAND (the owner, 2026-10-25 — «принцип физичности карт»): the cards lift out of the
    // dock they lie in into the album, never an album of copies over a dock that stays full.
    void shell.openHandWithReveal({keepTask: true});
    if (workspaceFrameHost('hand') === 'card-actions') {
      setWorkspaceFrameStage('hand', 'Discarding');
    }
    shell.focusFirstSelectableHandCard();
  }

  /** The hand as a STEP of the live action workspace (idempotent). */
  /**
   * THE LAW'S LIVE PLAY (RX36, PL-727) opens as a step of the action workspace: the album over the live pick, in
   * the stage's own zone, its crumb's tail the slot's pick's own word («… › ЖИВЫЕ ЭКСПЕРИМЕНТЫ › ВЫБОР»). The cards
   * unfold from the dock they lie in (the hand's reveal) — never re-dealt.
   */
  function openLawLivePlayStep(): void {
    if (!lawLivePlayStepOwed.value) {
      return;
    }
    if (!workspaceFrameKnown('hand')) {
      void shell.openHandWithReveal({keepTask: true});
    }
    if (workspaceFrameHost('hand') === 'card-actions') {
      setWorkspaceFrameStage('hand', 'Selection');
    }
    const firstPlayable = shell.handEntries.findIndex((e) => e.playable);
    consoleState.handIndex = firstPlayable !== -1 ? firstPlayable : 0;
  }

  function openPartyDiscardStep(): void {
    if (!partyDiscardStepOwed.value) {
      return;
    }
    if (workspaceFrameKnown('hand')) {
      shell.focusFirstSelectableHandCard();
      return;
    }
    // The Reds' discard opens the REAL hand: the dock → album flight every other hand pick plays (2026-10-25).
    void shell.openHandWithReveal({keepTask: true});
    if (workspaceFrameHost('hand') === 'card-actions') {
      setWorkspaceFrameStage('hand', 'Card discard');
    }
    shell.focusFirstSelectableHandCard();
  }

  /**
   * THE STAGED HANDOFF TO THE PARLIAMENT — the vote's third door. The batch
   * parks, a Parliament frame is pushed INTO the hand's own stage zone (the
   * one section instance, embedded — its vote mode mounts straight into its
   * pose off the staged prompt), and the landing scene LETS GO where it
   * stands: the composer and the landed card's proxy dissolve while the vote
   * mode's entrance surfaces out of the same rect (release → unfold → reveal,
   * never a swap). Only once the old surface is fully gone is the composer
   * unmounted — the hand's frame keeps its subject (the card) and its zone
   * the whole time, so the crumb never loses the card's name. Input is
   * absorbed by the landing transaction until then.
   */
  async function enterStagedVote(arm: StagedPlayArm): Promise<void> {
    await shell.enterStagedHostedStep(arm, {
      kind: 'parliament',
      subject: '',
      // The staged party pick's MODE names the step: a resolution («ГОЛОСОВАНИЕ») or a support area (TR12 —
      // «САНКЦИИ»); the prompt's own marker says which.
      stage: partyStepStageOf(stagedVoteOf(arm)?.prompt),
      phase: 'configure',
      // It serves no prompt — none exists yet; a re-asked grant earns `party`
      // in `settleStagedVote`.
      serves: [],
      anchor: {type: 'always'},
      nest: workspaceFrameKnown('parliament'),
      sourceCard: arm.cardName,
    });
  }

  async function enterHostedParliamentStep(kind: HostedParliamentStepKind): Promise<void> {
    // ONE entrance for both hosted outcomes (TR04's walk, TR31's rally): the record owed to the hand, not yet live.
    const owed = kind === 'walk' ? agendaWalkFlow.owed : neutralRallyFlow.owed;
    const live = kind === 'walk' ? agendaWalkFlow.live : neutralRallyFlow.live;
    if (owed === undefined || owed.host !== 'hand' || live || !workspaceFrameDescended('hand') || shell.hostedStepEntered()) {
      return;
    }
    setWorkspaceFramePhase('hand', 'committed');
    pushWorkspaceFrame({
      kind: 'parliament',
      subject: '',
      // A walk whose play took the CHAIR first (TR76) opens on that beat — «КРЕСЛО», then «КАРЬЕРА» (the section's crumb).
      stage: kind === 'walk' ? (agendaWalkFlow.owed?.seat === undefined ? AGENDA_WALK_STEP_STAGE : AGENDA_WALK_SEAT_STEP_STAGE) : NEUTRAL_RALLY_STEP_STAGE,
      phase: 'executing',
      serves: [],
      anchor: {type: 'always'},
      nest: workspaceFrameKnown('parliament'),
      sourceCard: owed.card ?? '',
    });
    await shell.releasePlayComposerUnderStep();
  }

  /**
   * THE STAGED VOTE'S COMMIT — A in the vote mode. The one POST of the whole
   * play: `[projectCard + payment, …pre-collected, {party, stagedFor}]`. The
   * frames cross their commit boundary (the hand's beat absorbs a second A,
   * the step's crumb goes amber), the play's outcome is claimed as for any
   * play (a triggered draw belongs to this workspace) — and NO played-hero is
   * armed: the landing ritual was the play's, and it has already been seen.
   */
  function commitStagedVote(response: InputResponse): void {
    // A SUPPORT-AREA pick (TR12): the area this press empties is PROMISED — its cubes are held on the plaque and
    // out of the pool by the apply block's seed, and the mode plays them off on the stage it was confirmed on.
    const staged = stagedVoteOf(stagedPlayState.arm);
    if (staged?.prompt.supportPrompt !== undefined && response.type === 'party' && isReduxParty(response.partyName)) {
      promiseSupportDiscard({party: response.partyName, card: staged.sourceCard});
    }
    shell.commitStagedTail(response);
  }

  /**
   * A version move under a staged vote. Before the commit the world moved
   * under an unsent play (the staged preview is void → back to the composer,
   * or the play turned out to be made already); after it the answer is in
   * and the door settles into one of its three honest outcomes.
   */
  function reconcileStagedVoteWorldMove(): void {
    const arm = stagedPlayState.arm;
    if (arm === undefined) {
      return;
    }
    // «Our commit is in» — a PLAY's card on the table, an ACTION recorded as used this generation (its card is
    // on the table the whole time, so tableau membership could never witness it).
    const me = shell.playerView.thisPlayer;
    const played = arm.flow === 'action' ?
      me.actionsThisGeneration.includes(arm.cardName) : me.tableau.some((c) => c.name === arm.cardName);
    if (stagedPlayState.committing || played) {
      settleStagedVote(arm);
      return;
    }
    shell.cancelStagedPlay();
    shell.showNotice('Game state changed');
  }

  /**
   * THE THREE OUTCOMES OF A STAGED VOTE'S COMMIT (the staged cell's
   * §9-quater, mirrored). The play itself is real in all three.
   *  · LANDED — the viewer's delegate stands on the table: the mode's own
   *    landing plays (the section reads the answer), and its `flow-complete`
   *    ends the step and the play together (`endStagedVote`).
   *  · RE-ASKED — the server dropped the tail as stale and the card's grant
   *    stands LIVE: the standing mode becomes that live door in place — the
   *    frame earns the prompt, nothing closes and nothing opens.
   *  · PARKED — another prompt stands in front of the card's own: nothing
   *    landed, so nothing flies; the step leaves (the mode reports
   *    `flow-complete` with no landing) and the delegate arrives with the
   *    ordinary update once the server's drain lands the parked answer.
   */
  function settleStagedVote(arm: StagedPlayArm): void {
    const wf = shell.playerView.waitingFor;
    // The card's own party question stands LIVE again — its delegate grant (TR03 / TR15) or its area pick (TR12).
    const reAsked = wf?.type === 'party' && (wf.votePrompt?.source === 'grant' || wf.supportPrompt !== undefined || wf.delegatePrompt !== undefined) &&
      wf.choiceContext?.source.kind === 'card' && wf.choiceContext.source.card === arm.cardName;
    if (reAsked) {
      const host = stagedStepHost(arm) ?? 'hand';
      clearStagedPlay();
      // The door is LIVE from here on: nothing of the staged one may come
      // back for this section's eventual leave (the latch is a leave's, and
      // the step is not leaving).
      stagedVoteLatch.value = undefined;
      setWorkspaceFrameServes('parliament', ['party']);
      setWorkspaceFramePhase('parliament', 'committed');
      setWorkspaceFramePhase(host, 'committed');
      const frame = workspaceStackTop();
      if (frame !== undefined && frame.kind === 'parliament') {
        frame.anchor = {type: 'prompt', promptType: 'party'};
      }
      return;
    }
    // LANDED / PARKED: the arm stands until the mode reports its flow
    // complete (`onParliamentFlowComplete` → `endStagedVote`) — it is what
    // names the step as this play's. `committing` stays set: a second A and
    // every B are absorbed until then.
    if (!stagedPlayState.committing) {
      // The commit's answer was lost and a forced update brought the truth
      // (the card is on the table): the mode never saw an answer of its own,
      // so the step simply ends.
      endStagedVote();
    }
  }

  /** The staged vote's step and the play it belonged to end together — the hand's one guarded conclusion takes the whole stack. */
  function endStagedVote(): void {
    const flow = stagedPlayState.arm?.flow;
    clearStagedPlay();
    // A support-area pick's own holds (TR12) end with the step that played them — idempotent.
    clearSupportDiscard();
    // (A card played THROUGH A LAW — RX36 — ends the same way: its step stood in «Действия карт».)
    if (flow === 'action' || flow === 'law') {
      shell.endCardActionsWithHostedStep();
      return;
    }
    shell.endHandWithHostedStep();
  }

  /**
   * THE STAGED ACTION VOTE (Turmoil Redux TR15 — «3 data from here → a delegate on a resolution»): the ACTION
   * flow's resolution door. The batch parks (the head ACTIVATES the card), and the Parliament is pushed as a
   * STEP of «Действия карт» — into the composer's own layer — through the ONE staged entry
   * (`enterStagedHostedStep`). The vote mode's confirm is the action's one POST (`commitStagedTail`, the
   * addressed `party` tail), B there walks back to the composer, the three honest outcomes are the play's.
   */
  function onCardActionsStagedVote(payload: {batch: ReadonlyArray<unknown>, staged: StagedVoteModel, cardName: CardName, nodeIndex: number, receipt: StagedReceipt | undefined}): void {
    if (stagedPlayActive()) {
      return;
    }
    const arm: StagedPlayArm = {
      flow: 'action',
      cardName: payload.cardName,
      isEvent: false,
      batch: payload.batch,
      target: {kind: 'resolution', vote: payload.staged},
      draws: 0,
      deckCheck: false,
      ...(payload.receipt === undefined ? {} : {receipt: payload.receipt}),
      actionRestore: {cardName: payload.cardName, nodeIndex: payload.nodeIndex, composer: undefined},
      yieldedStack: false,
    };
    preloadResolutionArt((shell.playerView.game.parliament?.slots ?? []).map((slot) => slot.resolution));
    void shell.enterStagedHostedStep(arm, {
      kind: 'parliament',
      subject: '',
      stage: DELEGATE_GRANT_STEP_STAGE,
      phase: 'configure',
      // It serves no prompt — none exists yet; a re-asked grant earns `party` in `settleStagedVote`.
      serves: [],
      anchor: {type: 'always'},
      nest: workspaceFrameKnown('parliament'),
      sourceCard: arm.cardName,
    });
  }

  /**
   * A LAW'S PLAY WITH A REVERSIBLE DOOR (RX36 Live Experiments — the design rule of 2026-10-20: a play made
   * THROUGH the law keeps every pre-select and every reversible step an ordinary play has). The law's commit sends
   * NOTHING when the composed play carries a door: the landing ritual lands the card in the law's stage (the
   * receiving stage the direct commit lands in), then the door opens exactly where an ordinary play's opens — the
   * cell on the board (the stage steps aside), the delegate or the colony as a step INSIDE the law's stage. That
   * door's confirm is the one POST of the law's batch; B walks back to the law's stage with its slot as it was.
   */
  function onCardActionsStagedLawPlay(response: InputResponse | ReadonlyArray<InputResponse> | ReadonlyArray<unknown>, detail?: LawPlayDetail): void {
    const play = detail?.play;
    const law = detail?.lawBill;
    const door = lawPlayStagedDoor(play);
    if (play === undefined || law === undefined || door === undefined || stagedPlayActive() || isPlayedHeroActive()) {
      return;
    }
    const composed = play.composed ?? {};
    const target: StagedPlayTarget | undefined =
      door === 'cell' && composed.staged !== undefined ? {kind: 'cell', placement: composed.staged} :
        door === 'resolution' && composed.stagedVote !== undefined ? {kind: 'resolution', vote: composed.stagedVote} :
          door === 'colony' && composed.stagedColony !== undefined ? {kind: 'colony', pick: composed.stagedColony} : undefined;
    if (target === undefined) {
      return;
    }
    const arm: StagedPlayArm = {
      flow: 'law',
      cardName: play.cardName,
      isEvent: getCard(play.cardName)?.type === CardType.EVENT,
      batch: Array.isArray(response) ? [...response] : [response],
      target,
      ...(composed.stagedCardTarget !== undefined ? {cardTarget: composed.stagedCardTarget} : {}),
      ...(composed.armedSpends !== undefined && composed.armedSpends.length > 0 ? {armedSpends: composed.armedSpends} : {}),
      rewards: play.scene.rewards,
      draws: play.scene.draws ?? 0,
      deckCheck: false,
      // The step's LOCKED RECEIPT: what the one POST will charge — the law's price and the card's, together.
      receipt: {amount: law.megacredits + play.cost, icon: 'megacredits'},
      lawRestore: {resolution: law.resolution},
      yieldedStack: false,
    };
    if (target.kind === 'resolution') {
      preloadResolutionArt((shell.playerView.game.parliament?.slots ?? []).map((slot) => slot.resolution));
    }
    void shell.beginStagedLawLanding(arm);
  }

  // Start-of-game setup reveal: while the ceremony is DEFERRED (B → inspect the
  // board), suspend the panel override so the left rail shows the REAL applied
  // state (not a mid-reveal staged snapshot). Restored on return.
  /**
   * A PAID VOTE's bill with no Parliament on screen (a reload, a resumed
   * session): the bill belongs INSIDE the vote step, so the Parliament
   * opens around it — the section re-forms the step from the server's own
   * marker and the bill teleports into the step's zone. A PARKED Parliament
   * (B on the bill) is known and stays parked: the board-home card is its
   * one way back.
   */
  function whenParliamentBillStandingChanges(on: boolean): void {
    if (on && !workspaceFrameKnown('parliament') && !consoleState.task.deferred) {
      enterWorkspace('parliament');
    }
  }

  // A shell-section prompt (hand-select discard/reveal / colony / play-from-
  // hand / award) can arrive BEHIND a blocking foreground presentation (the
  // Pluto draw+discard shows the drawn-cards reveal first; a bot-turn holding
  // card / theater can also be up). While busy, the prompt-change watcher's
  // section-open is skipped (`shellTask` is held). When the LAST such
  // presentation clears, open the serving surface so the still-pending prompt
  // isn't left with NO surface (the stranded guard). Respects an explicit
  // defer (the player chose to inspect the board).
  /**
   * A LEDGER PAYOUT WITH NOBODY LEFT TO PLAY IT (TR23): its action workspace
   * is gone — not parked, gone (the game moved on, a reset). Whatever the
   * rail still holds is released at once and the record is dropped: a hold
   * nobody will ever land is a counter frozen for good.
   */
  function whenLedgerPayoutOrphanedChanges(orphaned: boolean): void {
    if (orphaned) {
      finishColonyBonusPayout();
      resetColonyBonusPayout();
    }
  }

  /** The payout's discard has come DUE (the pair's card is taken, the row pays): the hand opens as the action's step. */
  function whenLedgerDiscardStepDueChanges(due: boolean): void {
    if (due && !consoleForegroundBusy.value && !consoleState.task.deferred) {
      openLedgerDiscardStep();
    }
  }

  /** WATCH `parliamentSittingFrameLive` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenParliamentSittingFrameLiveChanges(live: boolean): void {
    if (!live && phaseRootAnywhere('parliament')) {
      if (handSittingToDraft()) {
        return;
      }
      closePhaseRoot('parliament');
      // …and the layers the sitting stood over close with it. This used to ride the section's own
      // `flow-complete`, which the v3 leave latch no longer emits (the surface keeps its last coherent
      // view and simply leaves) — the intent belongs to whoever ends the phase, and that is here.
      closeConsoleLayers();
    }
  }

  /**
   * THE PARLIAMENT'S LEAVE (v3 В1). The frame left the stack while the section stood: keep the section
   * MOUNTED (pre-flush, so the render that drops the frame never unmounts it) and play the director's
   * own section dissolve on the LIVE element; its end unmounts. The element is marked `headless` first,
   * so the `v-if` removal that follows plays no SECOND leave over an already-faded surface.
   * A re-show (a restore, a board yield coming back) clears the latch — the flag can never outlive its
   * own leave, and a leave that never starts is bounded by a named net.
   */
  function whenParliamentEmbedTargetChanges(target: string | undefined): void {
    if (target !== undefined) {
      parliamentEmbedLatch.value = target;
    }
  }

  // SYNC: the step's ending clears the arm and drops the frame in one write —
  // the latch is taken when the door is ARMED, never on the way out.
  function whenStagedVoteModelChanges(vote: StagedVoteModel | undefined): void {
    if (vote !== undefined) {
      stagedVoteLatch.value = {vote, receipt: stagedPlayState.arm?.receipt, flow: stagedPlayState.arm?.flow === 'action' ? 'action' : 'play'};
    }
  }

  /** The section's leave, mirrored for a surface that entered over it (`whenParliamentSurfaceGone` — P89 · EA). */
  function whenParliamentLeavingChanges(leaving: boolean): void {
    consoleParliamentUi.surfaceLeaving = leaving;
  }

  /** WATCH `parliamentShown` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenParliamentShownChanges(shown: boolean, was: boolean): void {
    window.clearTimeout(parliamentLeaveNet.value);
    parliamentLeaveNet.value = undefined;
    // Every edge retires the leave before it: a release still owed by an older leave answers for a section that is
    // no longer leaving.
    const token = ++parliamentLeaveToken.value;
    const el = ((shell.$refs.parliamentSection ?? undefined) as {$el?: unknown} | undefined)?.$el;
    if (shown) {
      // RE-SHOWN MID-LEAVE (B, then A again inside the step's dissolve — the same instance is still mounted, the
      // `v-if` never fell): the leave's WAAPI fade keeps its `fill: 'forwards'` and would finish the re-entered step
      // at opacity 0 — a live, input-owning vote nobody can see, the setup released under it (an empty stage for
      // good; the box probe B → 90 ms → A, 2 / 2). The stale fade is cancelled, so the step stands at its CSS
      // opacity again, and its release (the token above) never runs over the live section.
      if (el instanceof HTMLElement && typeof el.getAnimations === 'function') {
        el.getAnimations().filter((a) => a.id === PARLIAMENT_STEP_LEAVE_ID).forEach((a) => a.cancel());
      }
      parliamentLeaveRelease.value = undefined;
      parliamentLeaving.value = false;
      parliamentEmbedLatch.value = parliamentEmbedTarget.value ?? '';
      return;
    }
    if (!was || !(el instanceof HTMLElement)) {
      parliamentLeaving.value = false;
      return;
    }
    parliamentLeaving.value = true;
    const release = (): void => {
      if (token !== parliamentLeaveToken.value) {
        return; // a later edge (the step re-shown) owns the section now
      }
      window.clearTimeout(parliamentLeaveNet.value);
      parliamentLeaveNet.value = undefined;
      parliamentLeaveRelease.value = undefined;
      el.dataset.motionVariant = 'headless';
      parliamentLeaving.value = false;
      parliamentEmbedLatch.value = '';
      stagedVoteLatch.value = undefined;
    };
    parliamentLeaveNet.value = window.setTimeout(release, PARLIAMENT_LEAVE_NET_MS);
    // ITS HOST IS LEAVING WITH IT (the staged vote's end — the hand's own
    // dissolve, `handLeaveHook`): the step rides that ONE motion. Fading here
    // too would multiply the two alphas — the Parliament gone before its own
    // frame — so the release is handed to the host's leave (the net above
    // still bounds it).
    if (shell.handDissolveArmed || shell.cardActionsDissolveArmed) {
      parliamentLeaveRelease.value = release;
      return;
    }
    // A HOSTED step carries no motion id (the embed contract strips it), so the
    // director's hook would release at once and the surface would vanish in
    // one frame inside its host's zone. Its leave is a short dissolve in place
    // — the same beat the host's zone plays around it — never a band phrase.
    if (el.dataset.motionSurface === undefined) {
      if (consoleReducedMotionActive() || typeof el.animate !== 'function') {
        release();
        return;
      }
      el.animate([{opacity: 1}, {opacity: 0}],
        {id: PARLIAMENT_STEP_LEAVE_ID, duration: motionMs(PARLIAMENT_STEP_LEAVE_MS), easing: 'ease-out', fill: 'forwards'})
        .finished.then(release, release);
      return;
    }
    surfaceLeaveHook(el, release);
  }

  /** WATCH `stagedVoteCommitting` — the reaction's body (the shell's `watch` table delegates here, in its order). */
  function whenStagedVoteCommittingChanges(now: boolean, was: boolean): void {
    if (now || !was || stagedVoteModel.value === undefined) {
      return;
    }
    const section = (shell.$refs.parliamentSection ?? undefined) as InstanceType<typeof ConsoleParliamentSection> | undefined;
    section?.resetSubmitting();
    // A refused support-area pick (TR12) promised nothing that happened.
    clearSupportDiscard();
    // The step's HOST takes its decision back — the hand's play, «Действия карт»'s action (TR15).
    const host = stagedStepHost() ?? 'hand';
    setWorkspaceFramePhase(host, 'configure');
    if (host === 'hand' && workspaceOutcomeState.host === 'hand') {
      releaseWorkspaceOutcome('staged-vote-refused');
    }
  }

  /**
   * THE BONUS WINDOW CLOSED — the LEDGER says the last bonus action is spent.
   *
   * Cleared HERE, in the always-mounted shell, and deliberately not in the
   * scene: the scene is UNMOUNTED for the whole window (that is what the
   * latch does), so a watcher of its own could never observe the end of it.
   * Clearing it is what lets `startFrameLive` rise again and bring the
   * workspace back to finish the preparation.
   *
   * No debounce, and none would be honest: the ledger is server state that
   * drops only when the action is FULLY resolved, so — unlike the prompt
   * marker — it cannot blink between two legs of one card play.
   */
  function whenBonusActionLedgerOwedChanges(owed: boolean): void {
    if (!owed && consoleStartState.bonusAct.stage !== 'idle') {
      consoleStartState.bonusAct = {stage: 'idle', source: undefined, corpDone: false};
    }
  }

  return {
    revealParliamentLatch,
    parliamentLeaving,
    parliamentWarmArmed,
    parliamentWarmTimer,
    parliamentEmbedLatch,
    stagedVoteLatch,
    parliamentLeaveRelease,
    parliamentLeaveNet,
    parliamentLeaveToken,
    lawPlayFold,
    consoleForegroundBusy,
    sittingHostsVenusBonus,
    govSupportActive,
    bonusActionLedgerOwed,
    parliamentSittingFrameLive,
    parliamentShown,
    parliamentWarm,
    parliamentMounted,
    parliamentEmbedTarget,
    parliamentEmbedActive,
    parliamentStandsAsRoot,
    parliamentEmbedTeleportTo,
    parliamentBillStanding,
    parliamentStageTask,
    parliamentAnswerTask,
    sittingRiseGatesPrompt,
    parliamentStagePrompt,
    ledgerPayoutClaimed,
    ledgerDiscardStepOwed,
    ledgerDiscardStepDue,
    ledgerPayoutOrphaned,
    sittingInvitationFields,
    stagedVoteModel,
    stagedVoteReceipt,
    parliamentStagedVote,
    parliamentStagedReceipt,
    parliamentStagedFlow,
    stagedVoteCommitting,
    parliamentPlacementDoorClosed,
    lawStepOwed,
    partyDiscardStepOwed,
    politicalPayoutOwed,
    politicalDiscardOwed,
    lawLivePlayStepOwed,
    submitParliament,
    inspectParliamentSource,
    inspectParliament,
    openParliamentPartyAction,
    openParliamentResolutionAction,
    openParliamentBoardDoor,
    handSittingToDraft,
    onParliamentAfterLeave,
    onParliamentLeaveCancelled,
    onNotificationOpenParliament,
    onParliamentFlowComplete,
    armLawPlayLanding,
    onGovSupportLeafConfirm,
    armPartyDiscardStep,
    continueLedgerPayoutAfterTake,
    openLedgerDiscardStep,
    openLawLivePlayStep,
    openPartyDiscardStep,
    enterStagedVote,
    enterHostedParliamentStep,
    commitStagedVote,
    reconcileStagedVoteWorldMove,
    settleStagedVote,
    endStagedVote,
    onCardActionsStagedVote,
    onCardActionsStagedLawPlay,
    whenParliamentBillStandingChanges,
    whenLedgerPayoutOrphanedChanges,
    whenLedgerDiscardStepDueChanges,
    whenParliamentSittingFrameLiveChanges,
    whenParliamentEmbedTargetChanges,
    whenStagedVoteModelChanges,
    whenParliamentLeavingChanges,
    whenParliamentShownChanges,
    whenStagedVoteCommittingChanges,
    whenBonusActionLedgerOwedChanges,
  };
}

export type ParliamentController = ReturnType<typeof createParliamentController>;
