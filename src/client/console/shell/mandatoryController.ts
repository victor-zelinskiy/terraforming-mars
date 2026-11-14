/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE MANDATORY CONTROLLER — taken out of ConsoleShell.vue (architecture v2).
 */
import type {UnwrapRef} from 'vue';
import {computed} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {DiscardPromptMeta} from '@/common/models/PlayerInputModel';
import {botTurnReviewState} from '@/client/components/marsbot/botTurnReviewState';
import {isMandatoryPromptsHeldByScreen} from '@/client/components/presentation/presentationFlow';
import {blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {isTransientBeat} from '@/client/console/workspaceBeatStall';
import {notificationFeedReadForDecision, acknowledgeFlowHoldingCards} from '@/client/components/notifications/notificationState';
import {maFocusState} from '@/client/console/consoleMaFocus';
import {parliamentSittingFlowBeat, sittingTailPlacementOf} from '@/client/console/parliament/consoleSittingFlow';
import {heldSittingKey, sittingSeededLive} from '@/client/console/parliament/parliamentSittingSeed';
import {SittingInvitationFacts} from '@/client/console/parliament/sittingInvitation';
import {FINALE_KICKER, FINALE_RETURN, FINALE_TITLE} from '@/client/console/finalGreenery/finalGreeneryModel';
import {restoreFinaleSession} from '@/client/console/finalGreenery/finalGreenerySession';
import {PromptTone, promptToneOf} from '@/client/console/promptTone';
import {ConsoleRevealMode} from '@/client/components/console/consoleRevealOverlayTypes';
import {frameServing, restoreWorkspaceStack, workspaceFrameIndex, workspaceFrameMounted, workspaceFramePhase, workspaceFrameAnchor, workspaceFrameKnownPhase, workspaceFrameParked, workspaceStackCollapsed, workspaceSceneOnStage, FrameAnchor, WorkspaceFrameKind} from '@/client/console/consoleWorkspaceStack';
import {isCardDiscardActive} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyResolutionFocusIntent, colonyResolutionUi} from '@/client/console/colonyTrade/colonyResolution';
import {handRevealState} from '@/client/console/handDock/handRevealState';
import {isHandRevealEpisodeRunning, resetHandReveal} from '@/client/console/handDock/handRevealDirector';
import {draftMandatoryFlowBeat} from '@/client/console/draft/consoleDraftFlow';
import {externalDrawIntakeKey, externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';
import {Phase} from '@/common/Phase';
import {colonyFocusState, openColonyFocus} from '@/client/console/consoleColoniesModel';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ConsoleTask, taskFor, taskMinimizable, SHELL_SECTION_KINDS, corpFirstActionInStartFlow} from '@/client/console/consoleTaskRouter';
import {promptSourceResolution} from '@/client/console/promptSource';
import {sittingReactionOf} from '@/client/console/parliament/agendaReaction';
import {ConsoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {setStartSetupRevealSuspended} from '@/client/components/startGameFlow/startSetupRevealState';
import {setConsoleTaskDeferred} from '@/client/console/consoleLeakDetector';
import {govScaleFocusState} from '@/client/console/consoleGovScaleFocus';
import {navigationDefersShellTask, ShellTaskDestination} from '@/client/console/shellTaskSurface';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {ColonyName} from '@/common/colonies/ColonyName';
import {consoleState} from '@/client/console/consoleRouter';
import {consoleHandPickState} from '@/client/console/consoleHandPick';
import {deferredDiscardKey, freshCardsForDeferredDiscard} from '@/client/console/deferredDiscardFresh';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {infoModeState} from '@/client/console/infoModeState';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {journalState} from '@/client/components/journal/journalState';
import {MandatoryBeat, MandatoryFlowBeat, mandatoryBeatFor, heldFlowWorkspaceOf, isMandatoryBeatHeld, isMandatoryBeatPresented, forceMandatoryBeacon, isMandatoryBeaconForced, acknowledgeMandatoryBeat, markMandatoryBeatPresented, noteMandatoryBeatIdentity, isResolutionAsk} from '@/client/console/consoleMandatoryGate';
import type {ColonyController} from '@/client/console/shell/colonyController';
import type {FinaleController} from '@/client/console/shell/finaleController';
import type {ParliamentController} from '@/client/console/shell/parliamentController';
import type {PlacementController} from '@/client/console/shell/placementController';
import type {PlayedController} from '@/client/console/shell/playedController';
import type {HydroController} from '@/client/console/shell/hydroController';
import type {StartController} from '@/client/console/shell/startController';
import type {SeatController} from '@/client/console/shell/seatController';
import {setQuestionAside, takeUpQuestion} from '@/client/console/setAside';

/**
 * WHAT THIS CONTROLLER READS OF THE REST OF THE SHELL — its port. Every member here is a dependency the monolith
 * hid behind `this`; a row marked WRITTEN is state this domain changes but does not own (the next thing to untangle).
 */
export type MandatoryPort = {
  $nextTick(fn?: () => void): Promise<void>,
  readonly activeTaskSummary: ConsoleTaskSummary | undefined,
  colonyBonusCardPick: UnwrapRef<ColonyController['colonyBonusCardPick']>,
  colonyFollowUpLive: UnwrapRef<ColonyController['colonyFollowUpLive']>,
  colonyResolutionColonyName: UnwrapRef<ColonyController['colonyResolutionColonyName']>,
  colonyResolutionLive: UnwrapRef<ColonyController['colonyResolutionLive']>,
  colonyResolutionSignals: UnwrapRef<ColonyController['colonyResolutionSignals']>,
  readonly consoleRevealMode: ConsoleRevealMode | undefined,
  readonly deckPickBelongsToWorkspace: boolean,
  readonly discardMeta: DiscardPromptMeta | undefined,
  readonly effectDecisionBelongsToWorkspace: boolean,
  enterColonyBonusStage: UnwrapRef<ColonyController['enterColonyBonusStage']>,
  enterWorkspaceAfterHandoff(kind: WorkspaceFrameKind, opts: {anchor: FrameAnchor}): void,
  finaleCollapsed: UnwrapRef<FinaleController['finaleCollapsed']>,
  finaleSessionEngaged: UnwrapRef<FinaleController['finaleSessionEngaged']>,
  game: UnwrapRef<SeatController['game']>,
  readonly handPickActive: boolean,
  readonly handSelectSingle: boolean,
  readonly hostTask: ConsoleTask | undefined,
  ledgerDiscardStepOwed: UnwrapRef<ParliamentController['ledgerDiscardStepOwed']>,
  readonly nativeCompositeTask: ConsoleTask | undefined,
  nomadMoveHolds: UnwrapRef<PlacementController['nomadMoveHolds']>,
  openShellTaskSurface(task: ConsoleTask): void,
  parliamentStandsAsRoot: UnwrapRef<ParliamentController['parliamentStandsAsRoot']>,
  placementActive: UnwrapRef<PlacementController['placementActive']>,
  playedHeroHolds: UnwrapRef<PlayedController['playedHeroHolds']>,
  playedTableVisible: UnwrapRef<PlayedController['playedTableVisible']>,
  readonly playerView: PlayerViewModel,
  readonly rawDrawnRevealPending: boolean,
  replayHandOpenReveal(): Promise<void>,
  restoreParkedWorkspace(kind: WorkspaceFrameKind): boolean,
  seatAwardFundingSurface(): void,
  settleColonyFollowUp: UnwrapRef<ColonyController['settleColonyFollowUp']>,
  settleHydroResolution: UnwrapRef<HydroController['settleHydroResolution']>,
  readonly shellTask: ConsoleTask | undefined,
  readonly shellTaskOnSurface: boolean,
  sittingInvitationFields: UnwrapRef<ParliamentController['sittingInvitationFields']>,
  startDeferSummary: UnwrapRef<StartController['startDeferSummary']>,
  startDiscardStepOwed: UnwrapRef<StartController['startDiscardStepOwed']>,
  startSceneServes: UnwrapRef<StartController['startSceneServes']>,
  startTask: UnwrapRef<StartController['startTask']>,
  readonly taskBelongsToWorkspace: boolean,
  thisPlayer: UnwrapRef<SeatController['thisPlayer']>,
  tilePlacementHolds: UnwrapRef<PlacementController['tilePlacementHolds']>,
  readonly venusBonusBelongsToWorkspace: boolean,
  viewerForcedReaction: UnwrapRef<SeatController['viewerForcedReaction']>,
};

export function createMandatoryController(shell: MandatoryPort) {
  // ── derived ──────────────────────────────────────────────────────────────────────────────────────────────────────
  /** The live question is SET ASIDE while the player stands on the very surface that answers it (see the watcher). */
  const deferredWhileOnOwnSurface = computed((): boolean => {
    return consoleState.task.deferred && shell.shellTask !== undefined && shell.shellTaskOnSurface &&
      !workspaceStackCollapsed() && !shell.finaleCollapsed;
  });

  /**
   * Pending FLOW-scoped mandatory actions, in the ONE deterministic order
   * (`mandatoryBeatFor` presents the first; a task beat outranks them all).
   * Today: the between-generations research (the draft's picks + the buy,
   * or the buy alone without a draft — TR61). A new must-open workspace flow
   * contributes its own derivation here — never an auto-`enterWorkspace`.
   * The ONE sanctioned conclusion that stands a flow up by itself is the
   * GENERATION SCENE's last beat (`generationScene.ts`): the player has just
   * watched their income arrive, the research rising from that scene IS the
   * continuation (the owner's decision 6а), and the scene acknowledges this
   * beat under its own hold so no plate can appear in the gap.
   */
  const mandatoryFlowBeats = computed((): ReadonlyArray<MandatoryFlowBeat> => {
    const out: Array<MandatoryFlowBeat> = [];
    // THE PARLIAMENT'S SITTING (Turmoil Redux) comes FIRST — the rules' order: it stands between the production and
    // the next generation's research. Announced once per sitting; every ask of the enacted resolution and the one
    // confirmation ride this ONE beat (`consoleSittingFlow`). Since the soft gates the next generation already runs
    // on the server while this seat reads its sitting, and the draft's beat derives nothing until the seat closes
    // it (`betweenGenResearchLive`) — so the draft can never rise over an open sitting.
    const sitting = parliamentSittingFlowBeat(shell.playerView);
    if (sitting !== undefined) {
      out.push(sitting);
    }
    const draft = draftMandatoryFlowBeat(shell.playerView);
    if (draft !== undefined) {
      out.push(draft);
    }
    return out;
  });

  /** The current mandatory action beat (never a reveal). */
  const mandatoryBeat = computed((): MandatoryBeat | undefined => {
    const wf = shell.playerView.waitingFor;
    let task = taskFor(shell.playerView);
    // Inside the START FLOW the corporation's first action is the Game
    // Start Workspace's own stage — a seamless continuation of the
    // deployment, exactly like the `startSequence` prompts (which are never
    // gated: their full-screen flow IS the presentation). Announcing it
    // would put a plate in front of a scene that is already standing on it;
    // the collapsed workspace's way back is the deferred card, not a beat.
    // Outside the start flow (the mid-game merger chain) it stays an
    // interruptive beat and the confirm modal serves it, exactly as before.
    if (task?.kind === 'corpFirstAction' && corpFirstActionInStartFlow(shell.playerView)) {
      task = undefined;
    }
    // «THE LEDGER PAYS» (TR23): the discard of a card's colony-bonus payout is
    // a STEP of the action workspace whose ledger is paying — raised by the
    // server with the press's own answer, rows before its turn. It is never
    // an interruption: no plate, no beacon over the workspace that owes it,
    // no gate on a door the walk itself opens (`ledgerDiscardStepDue`).
    if (task?.kind === 'handSelect' && shell.ledgerDiscardStepOwed) {
      task = undefined;
    }
    // …and so is a START PRELUDE's own discard (P55 · FN): a step of the start workspace that played it.
    if (task?.kind === 'handSelect' && shell.startDiscardStepOwed) {
      task = undefined;
    }
    // THE FINALE SESSION owns its own prompt (PL-303): once the player is in the finale, the greenery prompt
    // coming back — after a landing, after another seat's triggered answer — is the CONTINUATION of what they
    // are doing, never a new interruption to announce; the board takes the pick by itself. The first prompt
    // (no session yet) and a prompt returning to a MINIMIZED session are announced as before.
    if (task?.kind === 'choice' && wf?.finalGreeneryPrompt !== undefined && shell.finaleSessionEngaged) {
      task = undefined;
    }
    // THE CHAIRMAN'S GATE IN THE PARLIAMENT THE PLAYER STANDS IN (ledger HC, the field lock of 2026-11-07): the plate
    // exists to BRING the player to the Parliament without cutting a card's cinematic. A player already standing in
    // it — the vote that completed the quest, the gate riding the vote's own answer — is where the gate is answered:
    // the section's door opens it there, and a beat announced over it held the gate behind a plate that never paints
    // over a workspace, the conclusion waiting for the answer, the answer for the plate.
    if (task?.kind === 'chairmanQuest' && shell.parliamentStandsAsRoot) {
      task = undefined;
    }
    // …and the GENERAL LAW those rows are cases of (the wait graph's harvest of 2026-11-09: a plate held Pluto's colony
    // discard and a Venus trade's bonus behind it while the colonies frame SERVING that very question stood on screen
    // past its commit — the plate waiting for the frame to leave, the frame for the question, the question for the
    // plate; the graph broke it 11× in one shard): a question whose own frame stands on top, on stage, inside its flow
    // (past the commit — never a browse the player opened, where a mandatory pick must still be announced) is a STEP
    // of what the player is doing, never an interruption to announce.
    // «On top» is the frame OR a step it hosts (every frame above it in the live stack is nested in it — a lateral
    // move resets the stack): the colonies frame pushes the very hand that answers its discard, and a rule keyed on
    // the bare top let the beat come back the moment that hand stood — born held, its gate closed the hand's select
    // mode, and the player stood in a browse album over a question nothing asked (CI 2026-11-09, run 42626840874:
    // `console-pluto-settlements` foreign · «СБРОС 2 ИЗ 2», 3/3). A parked frame is not on top (index −1).
    if (task !== undefined) {
      const own = frameServing(task.kind);
      const phase = own === undefined ? undefined : workspaceFramePhase(own.kind);
      if (own !== undefined && workspaceFrameIndex(own.kind) !== -1 && workspaceSceneOnStage(own.kind) &&
          phase !== undefined && (phase === 'committed' || isTransientBeat(phase))) {
        task = undefined;
      }
    }
    // The EXTERNAL-DRAW take is ONE demand for the whole batch: every take
    // RE-ISSUES the prompt with the remainder (a new title, a new prompt
    // identity), and a beat keyed on the prompt would run a fresh
    // pending → presented cycle per take — the plate re-announcing over the
    // very workspace serving it, and its A-branch swallowing the next take.
    // Key it on the INTAKE's stable identity instead: acknowledged once at
    // the open, gone with the last take; a SECOND intake is a new id and a
    // legitimately fresh cycle.
    const external = externalDrawTakeOf(wf);
    const taskKey = task?.kind === 'externalDraw' && external !== undefined ?
      `externalDraw:${externalDrawIntakeKey(external)}` :
      promptIdentityKey(wf);
    return mandatoryBeatFor({
      task,
      taskKey,
      forcedReaction: shell.viewerForcedReaction,
      // An ENACTED RESOLUTION's ask (Turmoil Redux) is always announced: the
      // plate names the resolution, A opens the choice (the payout pick in
      // the Parliament, the winner's ocean on the board). A prompt of the
      // law's own ACTION (the bill of Trade Industries) is the player's own
      // move and is never announced — `isResolutionAsk` tells the two apart.
      // …and the table's answer to the sitting's winner step of the Career (TR78) is a step of the SAME sitting.
      resolutionPrompt: isResolutionAsk(wf) || sittingReactionOf(wf) !== undefined,
      flows: mandatoryFlowBeats.value,
    });
  });

  /** The beat's stable identity, for the latch-invalidation watcher ('' = none). */
  const mandatoryBeatKey = computed((): string => {
    return mandatoryBeat.value?.key ?? '';
  });

  /** The current beat is HELD (announced, not yet OPENED by the player). While
   *  held, its surface is suppressed — only the chip status + the announcement
   *  show; A opens it. Equivalent to `taskGateHeld`: a TASK beat holds its own
   *  prompt closed, and a FLOW beat (the draft) holds the prompts its
   *  workspace would serve (the pick / buy card browser), so nothing legacy
   *  can rise while the workspace waits for its explicit open. */
  const mandatoryGateHeld = computed((): boolean => {
    return isMandatoryBeatHeld(mandatoryBeat.value);
  });

  /** The held beat suppresses its task surface (shellTask / hostTask). */
  const taskGateHeld = computed((): boolean => {
    return mandatoryGateHeld.value;
  });

  /**
   * THE WORKSPACE THE STANDING FLOW PLATE OPENS — `undefined` when no flow beat is held.
   *
   * A flow's plate («ПАРЛАМЕНТ · Заседание», the draft's) has one verb — «open the flow's workspace» — and
   * `openMandatoryAnnounce` is THE door into it (the sitting's stage, the draft's entrance; nothing auto-enters).
   * The player has other roads to the same workspace: the wheel's «Парламент» is a view as much as an action screen.
   * Taken while the plate stood, that road opened the workspace BESIDE the door: the beat stayed held behind a
   * workspace that hid its plate, the question's follow-up door asked the gate, the frame waited for its question —
   * plate → surface → question → plate, a dead screen until the wait graph confirmed the cycle and acknowledged the
   * beat seconds later, and a sitting that then ran without its own telling (FREEZE ZERO, the monkey's baseline
   * `fz0 · eden-alliance-enact-remote`: `wait-graph/cycle/announce:parliament:genN/question:parliamentphase/
   * surface:parliament`). The lateral entry reads this and takes the plate's door instead
   * (`workspaceController.enterOrRestoreWorkspace`): one workspace, one door, whatever the player pressed.
   */
  const heldFlowWorkspace = computed((): WorkspaceFrameKind | undefined => {
    return heldFlowWorkspaceOf(mandatoryBeat.value);
  });

  /**
   * A LIVE PROMPT WHOSE SURFACE HIDES ITSELF WHILE THE TASK IS DEFERRED — the
   * families of «B СВЕРНУТЬ», stated ONCE.
   *
   * Every one of these `v-if`s carries `!consoleState.task.deferred`, so the
   * panel is gone the moment the player minimizes it and the board-home card
   * is the only door back. A family missing here is therefore not a cosmetic
   * gap but a SOFT-LOCK — and a silent one, since a deferred task is
   * deliberately invisible to the leak detector.
   *
   * That is what the DEDICATED COMPOSITE family (`nativeCompositeTask` — the
   * Venus bonus, spend-heat, the planetary thresholds, «оставь K из N») paid
   * for: it is neither host-served nor a section nor a scene, and those three
   * were the only families the predicate used to name. «Разместите бонус
   * шкалы Венеры» → B → the panel folded and nothing ever brought it back.
   *
   * TWO HALVES, and both are load-bearing: the live read (family by family,
   * so each keeps its own admission gate) and `taskMinimizable` — the
   * exhaustive-over-`TaskKind` anchor that says the kind is one the player
   * can fold away at all. A kind no family claims fails the router spec at
   * build time; a family yielding a kind that cannot be minimized offers no
   * card, which is the honest answer (there is nothing set aside).
   */
  const minimizableTaskLive = computed((): boolean => {
    const task = shell.hostTask ?? shell.shellTask ?? shell.startTask ?? shell.nativeCompositeTask;
    return task !== undefined && taskMinimizable(task.kind);
  });

  /** A task the player OPENED then DEFERRED (set aside) — the "return" state
   *  of the unified mandatory prompt (replaces the legacy amber chip). */
  const mandatoryDeferredActive = computed((): boolean => {
    // The START WORKSPACE has no live task while the table finishes its
    // setup (the server holds everyone), and a minimized workspace with no
    // task used to have NO announcement at all — the player could not get
    // back to their own start. It SERVES throughout (the lifetime hold),
    // and that is exactly the right signal here.
    return (minimizableTaskLive.value || shell.startSceneServes ||
      // A PARKED STACK always offers its way back: its frames are alive and
      // the board-home card is the only door to them. Keying this off an
      // ADMITTED task alone is how a live decision became unreachable
      // whenever the admission gate happened to be holding.
      workspaceStackCollapsed()) &&
      consoleState.task.deferred ||
      // A MINIMIZED FINALE with no prompt of its own standing (another seat decides) still offers its way back.
      (shell.finaleCollapsed && !mandatoryGateHeld.value);
  });

  /**
   * The player is on the MAIN board view and has opened NOTHING of their own
   * — not the hand carousel / a sheet / the journal / an overlay / a zoom / an
   * inspection / a placement. Deliberately free of the animation + foreground
   * HOLDS: this is the player's own context, not the presentation's.
   *
   * Two consumers that must never drift apart: the announcement's visibility
   * (below) and the foreground watchdog's scope. The watchdog only acts here,
   * because "no serving surface is rendered" is a lie the moment the player
   * opens a screen of their own over a legitimately claimed foreground.
   */
  const boardHomeIdle = computed((): boolean => {
    return consoleState.section === 'board' &&
      consoleCardZoom.card === undefined &&
      !journalState.open &&
      consoleState.sheet === undefined &&
      consoleState.quick === undefined &&
      consoleState.confirm === undefined &&
      !consoleState.fallbackActive &&
      !consoleState.inspecting &&
      !consoleState.scaleInspecting &&
      !shell.placementActive &&
      // The finale context standing is the player's own context, like a placement (a foreign prompt yields it).
      !shell.finaleSessionEngaged &&
      !botTurnReviewState.open &&
      !govScaleFocusState.holding &&
      !govScaleFocusState.closing &&
      // «РАЗЫГРАНО» and the Information workspace stand OVER the board without moving the section (the
      // board stays the section beneath them) — the board is not the surface the player is looking at, so a
      // collapsed prompt's plate and its A belong to the board, never to a table the player opened on top
      // (the owner, 2026-11-01: a collapsed draft came back on A pressed on a category of the table).
      !shell.playedTableVisible &&
      !infoModeState.open;
  });

  /**
   * MAY THE CURRENT BEAT'S FIRST PRESENTATION HAPPEN NOW? The pending →
   * presented transition of the mandatory-action lifecycle (the watcher
   * below latches it). It waits for the card ON SCREEN to have had its read
   * beat (`notificationFeedReadForDecision` — never for the QUEUE: the queue
   * presents beside the standing plate) and for every running presentation
   * beat of the SCREEN (theater / animation holds / reveals / heroes); a
   * flow-holding bot card holds it for that same read beat, never its TTL
   * (PL-290 — the whole feed in front of a decision was the 23 s pause before
   * the final greenery). Deliberately NOT gated on the player's location:
   * the presentation moment is one; WHERE the player stands only decides
   * the FORM (the plate on the board home, the chip beacon elsewhere).
   */
  const mandatoryPresentationReady = computed((): boolean => {
    return mandatoryGateHeld.value &&
      !isMandatoryBeatPresented(mandatoryBeat.value) &&
      notificationFeedReadForDecision() &&
      !isMandatoryPromptsHeldByScreen() &&
      // BLOCKING holds only — a notification-only hold is a STORY (a step's rating waiting for the board, a card's
      // reaction, the score's shares), and a decision never waits on a story: the step-rating's hold stands for as
      // long as the board is COVERED, and the surface covering it was the one waiting for this very decision to be
      // announced (the Venus trade's discard, 2026-10-31 — the cycle the liveness audit named).
      blockingAnimationHoldCount() === 0 &&
      shell.consoleRevealMode === undefined &&
      !shell.rawDrawnRevealPending &&
      !shell.playedHeroHolds &&
      !shell.tilePlacementHolds &&
      !shell.nomadMoveHolds;
  });

  /**
   * THE MANDATORY ACTION IS PAST ITS FIRST PRESENTATION — the plate/chip pair
   * may signal. Two shapes, both "already met the player": a fresh HELD beat
   * whose presentation has happened (the latch), and a DEFERRED task (the
   * player opened it themselves — deferral IS a presented state, so it never
   * re-waits behind the feed).
   */
  const mandatoryActionPresented = computed((): boolean => {
    return (mandatoryGateHeld.value && isMandatoryBeatPresented(mandatoryBeat.value)) ||
      mandatoryDeferredActive.value;
  });

  const mandatoryAnnounceVisible = computed((): boolean => {
    // ONE premium surface for BOTH states: a fresh HELD decision (opens with
    // A) and a DEFERRED one (returns with A). Board-home + idle either way.
    //
    // ASYMMETRY (load-bearing): the strict quiet — the settled notification
    // feed, the presentation holds, the animation holds — applies ONLY to
    // the FIRST presentation (mandatoryPresentationReady). Once presented,
    // a mandatory action is a STANDING state: a new toast / bot card / board
    // animation presents beside it and must not blink it away, re-queue it
    // or replay its entrance. The plate still yields to the player's own
    // location (boardHomeIdle — the chip carries it elsewhere) and to the
    // viewer's own full-bleed cinematics (a reveal / hero owns the screen).
    return mandatoryActionPresented.value &&
      boardHomeIdle.value &&
      shell.consoleRevealMode === undefined &&
      !shell.rawDrawnRevealPending &&
      !shell.playedHeroHolds &&
      !shell.tilePlacementHolds &&
      !shell.nomadMoveHolds;
  });

  /**
   * The viewer's TOP CHIP carries the pending-decision beacon while the CTA
   * card is NOT on screen (the player parked in another section / screen /
   * modal / a zoom — anywhere `mandatoryAnnounceVisible` is false): the chip
   * is then the ONE reminder of the awaited decision. RAW (undebounced) —
   * the strip debounces engagement so a transient off-screen window (an
   * animation about to end on the board home) never flashes the beacon, and
   * releases INSTANTLY when the announce card takes over — the two surfaces
   * never double-signal.
   */
  const mandatoryChipAttention = computed((): boolean => {
    // Presented-only, like the plate: while the notification feed is still
    // playing the pending action stays entirely silent (no plate AND no
    // beacon) — the first presentation is ONE moment, whichever form the
    // player's location gives it.
    //
    // This is the PENDING half only. Whether the decision is ANSWERABLE right
    // now is the strip's own `viewerAwaited` (the very status its pill
    // renders), so a chip can never read «ОЖИДАЕТ» and flash for attention in
    // the same breath. Deliberately not duplicated here: this shell has no
    // second opinion about the chip's status to offer.
    return mandatoryActionPresented.value &&
      !mandatoryAnnounceVisible.value &&
      // THE DIRECTOR'S BEACON (a BLIND announce — `forceMandatoryBeacon`): lit even where a surface claims to serve it,
      // because the director has just seen that nothing does.
      (!promptServedWhereIStand.value || isMandatoryBeaconForced(mandatoryBeat.value));
  });

  /**
   * IS THE PLAYER STANDING WHERE THE PROMPT IS ANSWERED?
   *
   * The attention beacon reads «you owe a decision and it is NOT on the
   * screen you are looking at». It used to derive that by NEGATING a
   * rendering condition (`!mandatoryAnnounceVisible`) — and everything in
   * that condition which is not about location (`!isAnimationHoldActive()`,
   * `!presentationHeld`, `consoleRevealMode === undefined`, …) therefore
   * became a reason to raise the alarm. An embedded reveal / draw / pick
   * inside a workspace lights up every one of them, so the chip flashed
   * amber while the player was looking straight at the decision.
   *
   * Two honest signals, both already maintained:
   *  · `shellTaskOnSurface` — for the shell-section kinds it covers;
   *  · a PRESENTING workspace claim — the surface is teleported into the
   *    workspace the player is standing in, which is the definition of
   *    «here». (The start workspace projects onto neither navigation axis,
   *    so `section` cannot answer this and never could.)
   */
  const promptServedWhereIStand = computed((): boolean => {
    return shell.shellTaskOnSurface ||
      (workspaceOutcomeState.host !== undefined &&
        workspaceOutcomeState.stage === 'presenting' && promptOwnedByClaim.value) ||
      promptServedByStandingFrame.value;
  });

  /**
   * …and a claim is «here» only for a prompt it OWNS. Presenting its own draw says nothing about a question another
   * seat's move raised meanwhile: counted as «here», the beacon stayed dark over a question no surface showed (the
   * field lock of 2026-11-02 — a rival's ocean woke Neptunian Power Consultants while the Lagrange Observatory card
   * was still landing in the hand; the plate stands only on the board home, so the decision was announced nowhere).
   */
  const promptOwnedByClaim = computed((): boolean => {
    return shell.taskBelongsToWorkspace || shell.effectDecisionBelongsToWorkspace ||
      shell.venusBonusBelongsToWorkspace || shell.deckPickBelongsToWorkspace;
  });

  /**
   * THE THIRD HONEST FORM OF «здесь»: a workspace that is ON SCREEN and is
   * ENTITLED to answer the standing prompt.
   *
   * `shellTaskOnSurface` covers the shell-section kinds and the claim covers
   * an outcome being presented; neither knows about a prompt a workspace
   * serves in its own scene — the Hydronetwork's card-granted bonus offer is
   * exactly that. Without this the top chip flashed for attention at a player
   * standing on the very decision it was pointing them to.
   *
   * LIVE frames only, deliberately. A PARKED frame serves the prompt too
   * (that is what keeps it out of the leak detector), but the player has
   * walked away from it — which is precisely when the beacon is the only
   * reminder they have.
   */
  const promptServedByStandingFrame = computed((): boolean => {
    const task = taskFor(shell.playerView);
    if (task === undefined) {
      return false;
    }
    const frame = frameServing(task.kind);
    return frame !== undefined && workspaceFrameIndex(frame.kind) !== -1;
  });

  /** The prompt card's copy (one consoleTaskSummary source, so nothing can
   *  diverge). The A-verb relabels by STATE: «Открыть» for a fresh held
   *  decision, «Вернуться к решению» for a deferred one. */
  const mandatoryAnnounceView = computed((): {kicker: string, ask: string, sourceCard: CardName | undefined, sourceResolution: string | undefined, openLabel: string, tone: PromptTone,
    invitation?: SittingInvitationFacts, invitationWinnerName?: string} => {
    // THE SITTING'S ONE PLATE (Turmoil Redux): whatever prompt of the phase
    // is standing (a gate, the resolution's pick / take), the beat announces
    // the SITTING — kicker «ПАРЛАМЕНТ», ask «Заседание» — and A opens it; a
    // resolution that is asking is still named as the source.
    const beat = mandatoryBeat.value;
    if (beat?.flow === 'parliament-phase' && mandatoryGateHeld.value) {
      return {
        kicker: translateText('Parliament'),
        // The ask names the SITTING, once, under the «ПАРЛАМЕНТ» kicker — the generation is the HUD's own pill
        // right above the plate; the verb is the family's («Открыть», the command bar carries «Открыть заседание»).
        // Measured (registry R-35): «Парламент собрался · поколение 1» + «Открыть заседание» made the plate 676 px,
        // the whole band between the off-Mars spaces (560 px at 1080, 470 px on the Deck) and then some.
        ask: translateText('Sitting'),
        sourceCard: undefined,
        sourceResolution: shell.activeTaskSummary?.sourceResolution,
        openLabel: 'Open',
        tone: 'neutral',
        // THE FACTS UNDER THE ASK (P51 · FG — the owner): the resolution being enacted and the winner of the vote,
        // ALWAYS, read off the server's records (`sittingInvitation.ts`); «Заседание» stays the ask (R-35).
        ...shell.sittingInvitationFields,
      };
    }
    // THE MINIMIZED FINALE (no live task of its own — another seat decides, or the seat's next prompt is on
    // its way): the plate names the phase and the way back.
    if (shell.finaleCollapsed && !mandatoryGateHeld.value) {
      return {
        kicker: translateText(FINALE_KICKER),
        ask: translateText(FINALE_TITLE),
        sourceCard: undefined,
        sourceResolution: undefined,
        openLabel: FINALE_RETURN,
        tone: 'neutral',
      };
    }
    return {
      kicker: deferKicker.value,
      ask: deferAsk.value,
      sourceCard: deferSourceCard.value,
      // An enacted RESOLUTION asked (Turmoil Redux): the plate names it as the source.
      sourceResolution: shell.activeTaskSummary?.sourceResolution,
      // A kind may NAME its own press when «Открыть» undersells it (a colony
      // bonus delivery: «Забрать карту» — the press answers the prompt AND
      // takes the player to the colony that paid).
      openLabel: mandatoryGateHeld.value ?
        (shell.activeTaskSummary?.openKey ?? 'Open') :
        deferReturnLabel.value,
      // The decision's CHARACTER is told BEFORE it is opened (`promptTone.ts`): an attack or a forced loss announced
      // off-turn reads as one on the plate, never as one more neutral «Открыть».
      tone: promptToneOf(shell.playerView.waitingFor).tone,
    };
  });

  /**
   * R3 IS «DECIDE AFTER THE DRAW» of the open pick right now (2026-10-15): a single pick answering a table question
   * that may wait for a draw (`request.defer`). Never while a discard cinematic is playing.
   */
  const handPickDeferLive = computed((): boolean => {
    return shell.handPickActive && shell.handSelectSingle && consoleHandPickState.request?.defer !== undefined && !isCardDiscardActive();
  });

  /**
   * The cards THE DRAW JUST BROUGHT, in the album of a discard the player LEFT FOR AFTER THE DRAW (2026-10-15): the
   * composer armed its askers and the hand it left at the commit; the live question of that asker, in that action,
   * marks the newcomers «НОВАЯ КАРТА» (`deferredDiscardFresh`).
   */
  const deferredDiscardFresh = computed((): ReadonlyArray<string> => {
    // A composer's own PRE-SELECT (before the commit) has nothing fresh; the live decision's album (`directPick`)
    // rides the same bridge and is exactly the reader.
    if (shell.handPickActive && consoleHandPickState.request?.leaving === 'none') {
      return [];
    }
    return freshCardsForDeferredDiscard(shell.discardMeta?.source?.card, shell.playerView.cardsInHand.map((c) => c.name),
      deferredDiscardKey(shell.playerView.game.generation, shell.playerView.thisPlayer.actionsTakenThisGame));
  });

  /** P15: the deferred-chip return verb, by what is actually pending. */
  const deferReturnLabel = computed((): string => {
    // A PARKED SITTING is what the card brings back (the soft gates: the pass ran the sitting, the player collapsed it
    // mid-walk) — the law's take it may owe is a step INSIDE it, never the thing the player returns to.
    if (shell.playerView?.game.phase === Phase.PARLIAMENT && workspaceFrameParked('parliament')) {
      return 'Return to the sitting';
    }
    return shell.startDeferSummary?.returnKey ?? shell.activeTaskSummary?.returnKey ?? 'Return to the decision';
  });

  /** The deferred chip's classification chip ("ОПЛАТА" / "ДРАФТ"). */
  const deferKicker = computed((): string => {
    const start = shell.startDeferSummary;
    if (start !== undefined) {
      return translateText(start.kickerKey);
    }
    return translateText(shell.activeTaskSummary?.kickerKey ?? 'Awaiting decision');
  });

  /** The deferred chip's CONCRETE ask ("Сбросьте 1 карту") — the whole point. */
  const deferAsk = computed((): string => {
    const start = shell.startDeferSummary;
    if (start !== undefined) {
      return translateText(start.askKey);
    }
    const ask = shell.activeTaskSummary?.ask;
    if (ask === undefined) {
      return '';
    }
    return typeof ask === 'string' ? translateText(ask) : translateMessage(ask);
  });

  /** The card that ASKS, when the server named one — rendered as a chip. */
  const deferSourceCard = computed((): CardName | undefined => {
    return shell.activeTaskSummary?.sourceCard;
  });

  // ── verbs ────────────────────────────────────────────────────────────────────────────────────────────────────────
  function openMandatoryAnnounce(): void {
    const beat = mandatoryBeat.value;
    if (beat === undefined) {
      return;
    }
    acknowledgeMandatoryBeat(beat.key);
    // THE PRESS IS THE PLAYER PLAYING ON (PL-290): a flow-holding bot card still on screen is acknowledged here, as
    // a submit acknowledges it — else the surface the press opens waits behind that card's TTL (the host's
    // `presentation` admission holds while one stands and no surface is up), a dead A of up to five seconds.
    acknowledgeFlowHoldingCards();
    // A MINIMIZED FINALE whose prompt stands again (PL-303): the plate's A is the way BACK into the session — the
    // minimize's defer flag lets go and the context returns; the session's own watcher then hands the pick to the
    // board (nothing else opens here — the finale has no surface of its own).
    if (shell.playerView.waitingFor?.finalGreeneryPrompt !== undefined && shell.finaleCollapsed) {
      takeUpQuestion('restored');
      restoreFinaleSession();
      return;
    }
    // A FLOW beat runs its own open route — the ONE door into the workspace
    // (the auto-enter on the phase flip is gone). The acknowledge above has
    // already dropped `mandatoryGateHeld` synchronously, so a second A finds
    // no plate and no branch; the frame guard makes even a raced double
    // press idempotent (one frame, one entrance cinematic, one transition).
    if (beat.flow === 'draft') {
      shell.enterWorkspaceAfterHandoff('draft', {anchor: {type: 'phase', phase: 'draft'}});
      return;
    }
    // THE PARLIAMENT'S SITTING (Turmoil Redux): the press walks the player
    // INTO the Parliament's sitting flow — the ONE door for the whole
    // political phase (its pick / take are stages of that flow; nothing
    // auto-enters, exactly like the draft). A PARKED sitting comes back as
    // it was. The SITTING'S OWN tile (the law's — the winner's, a seat's, the
    // engine's tail of the seat's step) is a stage of it too: the press opens
    // the sitting, and its reward page holds the tile behind «К полю» (sitting
    // law 4 — the soft gates bring that tile with the very pass that ran the
    // law, before any stage stood) — while this session SAW the sitting arrive
    // (`sittingSeededLive`: its walk is still to play). With no memory of it
    // (a reload on the tile) the sitting lands in its final poses and the tile
    // is the board's at once, as is a FOREIGN placement: it comes alive the
    // moment the acknowledge above releases it, and the sitting resumes after
    // the landing (`yieldsToBoard`).
    if (beat.flow === 'parliament-phase') {
      const wf = shell.playerView.waitingFor;
      const phase = shell.game.parliament?.phase;
      const ownTile = wf?.type === 'space' && phase !== undefined && sittingSeededLive(heldSittingKey()) &&
        (promptSourceResolution(wf) !== undefined || sittingTailPlacementOf(wf, phase, shell.thisPlayer?.color));
      if (!ownTile && (shell.placementActive || wf?.type === 'space')) {
        return;
      }
      if (!shell.restoreParkedWorkspace('parliament')) {
        shell.enterWorkspaceAfterHandoff('parliament', {anchor: {type: 'phase', phase: Phase.PARLIAMENT}});
      }
      return;
    }
    const task = taskFor(shell.playerView);
    if (task !== undefined && SHELL_SECTION_KINDS.has(task.kind)) {
      shell.openShellTaskSurface(task);
      return;
    }
    // A COLONY BONUS THE VIEWER MUST PLACE is a host task by shape (a card
    // target pick) and a colony payout by meaning, so the press walks them to
    // the colony that is paying — the same door Pluto's cards use. The pick
    // itself then teleports into that stage's zone (the claim admits `pick`),
    // so «кто-то поторговал на моей колонии» is ONE screen: the planet, whose
    // trade it was, and the choice — never a band over an unrelated view.
    const bonusPick = shell.colonyBonusCardPick;
    if (bonusPick !== undefined) {
      shell.enterColonyBonusStage(bonusPick.colonyName);
      return;
    }
    // Other host tasks (choice/player/amount/…) auto-mount ConsoleTaskHost
    // once the gate releases — nothing else to open here.
  }

  /**
   * THE PLATE YIELDS (Э3, the chairman quest's field shape generalized): a held plate in a cycle names a question
   * whose OWN surface already stands on screen — the player is where it is answered, so the beat is acknowledged and
   * the surface serves it in place; elsewhere the beacon is lit (the screen director's cure) and the press stays the
   * player's. Never the plate's A pressed on their behalf.
   */
  function yieldAnnounceInCycle(): string {
    const beat = mandatoryBeat.value;
    const task = taskFor(shell.playerView);
    if (beat === undefined || !mandatoryGateHeld.value) {
      return '';
    }
    const home = task === undefined ? undefined : frameServing(task.kind);
    if (home !== undefined && workspaceSceneOnStage(home.kind)) {
      acknowledgeMandatoryBeat(beat.key);
      return `acknowledged ${beat.key} — «${home.kind}» stands and serves it in place`;
    }
    if (!isMandatoryBeaconForced(beat)) {
      forceMandatoryBeacon(beat.key);
      return `lit the beacon of ${beat.key}`;
    }
    return '';
  }

  /** Navigating away from a shell task's surface DEFERS it (the prompt card
   *  flips to its «Вернуться к решению» state). The DESTINATION is required:
   *  a navigation TO the question's own surface is the opposite of «away»
   *  and never defers it (`shellTaskSurface.ts` law 1 — the hand opened for
   *  Eccentric Sponsor's play-from-hand deferred the very prompt it opened
   *  for, and refused every A with «сначала завершите текущее действие»). */
  function deferShellTask(destination: ShellTaskDestination): void {
    if (shell.shellTask !== undefined && !consoleState.task.deferred &&
      navigationDefersShellTask(shell.shellTask, destination)) {
      setQuestionAside('navigation');
    }
  }

  /** Return to a DEFERRED task — clear the defer + re-open its surface (a
   *  shell-section task; host / start scenes re-render via their own v-if).
   *  Shared by the prompt card's A and the global B-back. */
  function restoreDeferredTask(): void {
    takeUpQuestion('restored');
    // THE MINIMIZED FINALE comes back as it stood (the context, the camera); a standing prompt's pick follows
    // through the session's own watcher.
    if (shell.finaleCollapsed) {
      restoreFinaleSession();
      return;
    }
    // A PARKED STACK comes back exactly as it was — same depth, same
    // decision, same picks and no second trip to the server. That is the
    // entire difference between «свернуть» and «закрыть», and it is one
    // call instead of a branch per workspace (the action centre's claim,
    // the hand step inside the start, …), each of which had to re-derive
    // which surface to re-open.
    if (workspaceStackCollapsed()) {
      // A parked OPEN-HAND step replays the premium dock → grid reveal on
      // its way back (the physical twin of the collapse's gather). The
      // phase is seated BEFORE the frames return: the section watcher sees
      // a director-owned transition instead of an untracked open, which
      // would paint the finished grid one frame early.
      // …a BROWSE hand only. A park taken from a committed stage comes back
      // TO that stage, with its shelf still parked behind it and its pack
      // already home — replaying the dock → grid reveal there would fly the
      // whole hand out into a grid that is not on screen. (The phase is read
      // through the PARK: the live stack does not hold this frame yet.)
      const handComesBack = workspaceFrameParked('hand') &&
        workspaceFrameKnownPhase('hand') === 'browse' &&
        !isHandRevealEpisodeRunning() && !consoleReducedMotionActive();
      if (handComesBack) {
        handRevealState.phase = 'opening';
        handRevealState.holdSlots = true;
        handRevealState.chrome = 'held';
      }
      restoreWorkspaceStack();
      // A PROMPT-PUSHED COLONIES STEP WHOSE FOLLOW-UP ENDED WHILE IT WAS PARKED hands the screen back now — the same
      // law as `resumeStackFromBoardAndSettle` for the yield. Its falling edge fired against a parked stack, or the
      // hosted hand-over's dwell was cut by the park (`alive` reads the LIVE stack), and nothing else will pop it: the
      // CI field lock of 2026-11-03 — the solo opening's «remove a colony tile», answered inside the start, B pressed
      // during the receipt's dwell, then A «Вернуться к решению» restored a colony grid nothing asked for, and the
      // start never released (`console-colony-entry-probe` A, `console-pristar` A — «board home never became live»).
      if (workspaceFrameAnchor('colonies')?.type === 'prompt' && !shell.colonyFollowUpLive) {
        shell.settleColonyFollowUp();
      }
      if (handComesBack) {
        if (consoleState.section === 'hand') {
          void shell.replayHandOpenReveal();
        } else {
          // The restored depth doesn't project the hand after all — undo
          // the seeded hold, or every slot stays invisible forever.
          resetHandReveal();
        }
      }
      // A COLONY RESOLUTION comes back on its focus stage (the section's
      // unmount closed it with the park): the source, the payout zone and
      // the «СБРОШЕНО» seat live there — never the overview grid. During
      // the FULL-STAGE DISCARD the hand owns the room instead: reopening
      // the focus here painted the whole colony composition OVER the
      // discard grid (the reported two-screens overlay).
      if (shell.colonyResolutionLive && workspaceFrameMounted('colonies') &&
          !colonyFocusState.open && !colonyResolutionUi.discardStage) {
        const name = shell.colonyResolutionColonyName;
        if (name !== '') {
          // The act's own stage (never `'inspect'` — that is the dossier,
          // which hosts no payout zone; see `colonyResolutionFocusIntent`).
          openColonyFocus(name as ColonyName,
            colonyResolutionFocusIntent(shell.colonyResolutionSignals, name));
        }
      }
      // A restored HOSTED funding step (the start's awards scene step)
      // re-seats its suspended pre-commit detail — the screen wrote it to
      // the draft on its park unmount; without this the restore lands on
      // the browse grid with the player's half-made choice silently gone.
      if (workspaceFrameMounted('awards') && maFocusState.draft !== undefined &&
          shell.shellTask?.kind === 'awardFunding') {
        shell.seatAwardFundingSurface();
      }
      return;
    }
    // NO PARK, A SHELL TASK STILL OWED: open its surface — the start
    // workspace serving or not. `shellTask` never names a start-own prompt
    // (the first action in the start flow is excluded at its source) and
    // `openShellTaskSurface` already stands a step INSIDE the start where one
    // belongs (the hand, the awards, the colonies) and a sheet OVER its root.
    // Gated on `!startSceneServes`, a deferral that took no park (a lateral
    // visit, an older minimize) came back to a start that serves nothing of
    // its own: the scene let go, and the prompt was stranded on the board.
    if (shell.hostTask === undefined && shell.shellTask !== undefined) {
      shell.openShellTaskSurface(shell.shellTask);
    }
  }

  // (An enacted resolution's ask never auto-enters the Parliament: the
  // political phase is ONE announced flow — the plate names the sitting, and
  // `openMandatoryAnnounce` — the player's A — is the one door, exactly like
  // the draft; the ask is then a step INSIDE the open sitting.)
  function whenConsoleStateTaskDeferredChanges(deferred: boolean): void {
    setStartSetupRevealSuspended(deferred);
    // Mirror into the leak detector: a deferred task is deliberately set aside
    // (never stranded), and its serving card (`.con-mandatory`) is hidden off
    // the board home — the detector reads this flag instead of a DOM surface.
    // Both default to false and stay synced on every change; the detector's
    // stop-reset covers unmount, so no immediate sync is needed.
    setConsoleTaskDeferred(deferred);
    // …AND THE HYDRO RESOLUTION RE-ASKS ON THE WAY BACK. A park is not a
    // completion, but it is not a cancellation either: the committed move's
    // busy signals can fall quiet WHILE the stack is parked (a board
    // excursion), and no edge fires on the restore. See
    // `settleHydroResolution`.
    if (!deferred) {
      void shell.$nextTick(() => shell.settleHydroResolution());
    }
  }

  /**
   * STANDING ON THE ANSWER UN-DEFERS IT (the WG Project lock of 2026-11-07, game p5aa8b7f — ledger HC): «set aside»
   * is a fact about WHERE the player is, never a latch that outlives it. A door that opened the question's own
   * surface while marking it set aside (the hand's reveal door, before 057d56ca00) left the prompt refusing every A
   * with «Сначала завершите текущее действие» — the guard for «something is owed elsewhere» standing in front of the
   * very answer it was owed — for 45 minutes. Whatever door brought the player here, standing on the surface that
   * answers the live question clears the mark. A PARKED stack keeps it (`parked ⇒ deferred` — a fresh instance
   * beside a park is read-only by contract), and so does a minimized finale.
   */
  function whenDeferredWhileOnOwnSurfaceChanges(on: boolean): void {
    if (on && consoleState.task.deferred) {
      console.info(`[task-deferred] standing on the answer of «${shell.shellTask?.kind ?? ''}» — no longer set aside`);
      takeUpQuestion('on-its-surface');
    }
  }

  // The beat IDENTITY changed (answered / invalidated / superseded) — retire
  // the latches that referred to the old one, so a completed action leaves
  // nothing stale and a NEXT action runs its own pending → presented cycle
  // (including re-waiting out the notification feed, per the boundary rule).
  function whenMandatoryBeatKeyChanges(key: string): void {
    noteMandatoryBeatIdentity(key === '' ? undefined : key);
    // A NEW beat can be born already-ready (feed settled, nothing playing),
    // and beat A's latch → ready false → beat B → ready true can all happen
    // inside one flush — a value-equality watcher then observes true → true
    // and never fires. Latch here too; same predicate, same latch, so the
    // two writers cannot disagree.
    const beat = mandatoryBeat.value;
    if (beat !== undefined && mandatoryPresentationReady.value) {
      markMandatoryBeatPresented(beat.key);
    }
  }

  // The pending → presented transition. A WATCHER, not a computed side
  // effect: presentation is a one-way latch keyed by the beat, and this is
  // its single writer. Firing on the rising edge only — once latched, the
  // readiness predicate goes false by itself (isMandatoryBeatPresented).
  function whenMandatoryPresentationReadyChanges(ready: boolean): void {
    const beat = mandatoryBeat.value;
    if (ready && beat !== undefined) {
      markMandatoryBeatPresented(beat.key);
    }
  }

  return {
    deferredWhileOnOwnSurface,
    mandatoryFlowBeats,
    mandatoryBeat,
    mandatoryBeatKey,
    mandatoryGateHeld,
    taskGateHeld,
    heldFlowWorkspace,
    minimizableTaskLive,
    mandatoryDeferredActive,
    boardHomeIdle,
    mandatoryPresentationReady,
    mandatoryActionPresented,
    mandatoryAnnounceVisible,
    mandatoryChipAttention,
    promptServedWhereIStand,
    promptOwnedByClaim,
    promptServedByStandingFrame,
    mandatoryAnnounceView,
    handPickDeferLive,
    deferredDiscardFresh,
    deferReturnLabel,
    deferKicker,
    deferAsk,
    deferSourceCard,
    openMandatoryAnnounce,
    yieldAnnounceInCycle,
    deferShellTask,
    restoreDeferredTask,
    whenConsoleStateTaskDeferredChanges,
    whenDeferredWhileOnOwnSurfaceChanges,
    whenMandatoryBeatKeyChanges,
    whenMandatoryPresentationReadyChanges,
  };
}

export type MandatoryController = ReturnType<typeof createMandatoryController>;
