/*
 * THE GAME TRANSPORT — @console-shared LIVE, the module the whole in-game
 * client stands on. Extracted from the headless `WaitingFor.vue` (the last
 * load-bearing legacy file) in the transport rework; the component that
 * remains is `ConsoleBoardBinder.vue` — props, the SelectSpace board binder
 * and lifecycle delegation, nothing else.
 *
 * Responsibilities (unchanged from the headless component, moved verbatim):
 *   1. THE POLL CHAIN — `/api/waitingfor` GO/REFRESH/WAIT with the
 *      viewer-mid-prompt guard, END-phase stop, visibility/focus wakes and
 *      the realtime (WebSocket) wake. The WS INVALIDATED push is the PRIMARY
 *      update signal (Phase 12, default ON end to end); the poll is the
 *      bounded safety net — stretched to LONG_POLL_MS while the socket is
 *      strictly healthy, the safe `waitingForTimeout` otherwise.
 *   2. THE SUBMIT FUNNEL — `submitInput` / `submitBatch` / `cancelPlacement`
 *      → POST /player/input(-batch), then the console cinematic-gate
 *      pipeline: each armed transaction detects against the authoritative
 *      response, HOLDS the commit through its physical scene, and unwinds
 *      cleanly on a refusal/network failure. ONE SUBMIT IS ONE SCOPE with
 *      its machine (`submitMachine.ts` — architecture v2, lifecycle 4): the
 *      funnel is busy exactly while that scope lives, a press it cannot take
 *      is a typed refusal in the caller's hand (`SubmitTicket`), every gate
 *      is a bounded child, and every submit settles exactly once.
 *   3. THE VIEW APPLY — structural sharing (`nextViewSnapshot`) + the
 *      transient-UI reset epoch (`playerkey`), with the card-pick preserve
 *      guards.
 *   4. TURN PRESENTATION — document title / favicon / the ◑◒◐◓ spinner and
 *      the your-turn notification.
 *
 * The module drives a narrow TransportRoot contract (the App root instance
 * satisfies it) injected at `startGameTransport` — nothing here imports the
 * root, so the module is unit-testable with a fake.
 */
/* global RequestInit */

import {nextTick, reactive, shallowRef} from 'vue';
import * as constants from '@/common/constants';
import raw_settings from '@/genfiles/settings.json';
import {onRealtimeWake} from '@/client/components/realtime/realtimeSync';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {midPromptRefreshEnabled, serverAheadOfView} from '@/client/components/realtime/viewFreshness';
import {registerTruthWitness} from '@/client/console/presentationLedger';
import {apiUrl, identitySearch} from '@/client/utils/runtimeConfig';
import {PlayerViewModel, PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {SoundManager} from '@/client/utils/SoundManager';
import {WaitingForModel} from '@/common/models/WaitingForModel';
import {Phase} from '@/common/Phase';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {InputResponse} from '@/common/inputs/InputResponse';
import {INVALID_RUN_ID, STALE_PROMPT, AppErrorResponse} from '@/common/app/AppErrorId';
import {Color} from '@/common/Color';
import {gameDocumentTitle} from '@/client/utils/documentTitle';
import {setFaviconStatus, setFaviconTurnFrame} from '@/client/utils/favicon';
import {shouldPreserveCardPickModal} from '@/client/components/draftWaitState';
import {shouldPreserveInitialDraftOverlay} from '@/client/components/initialDraft/initialDraftSharedState';
import {shouldPreserveSaleOverlay} from '@/client/components/handCards/sellPatentsState';
import {
  applyTilePlacementPreview,
  armPlacementAnimations,
  placementHoldDurationMs,
  shouldHoldForTilePlacement,
} from '@/client/components/board/tilePlacementAnimation';
import {
  applyMarkerPlacementPreview,
  markerPlacementHoldDurationMs,
  shouldHoldForMarkerPlacement,
} from '@/client/components/board/markerPlacementAnimation';
import {
  applyOwnerCubePlacementPreview,
  clockwiseFromTop,
  freshOwnerCubeIds,
  landOwnerCubesInTurn,
  ownerCubeHoldDurationMs,
  shouldHoldForOwnerCubePlacement,
} from '@/client/components/board/cubeDropState';
import {holdAnimationWhile} from '@/client/components/presentation/animationHold';
import {motionMs} from '@/client/components/motion/motionTokens';
import {nextViewSnapshot} from '@/client/utils/viewSnapshotShare';
import {checkPostCommitChoice, checkPreselectReask, notePreselectBatch} from '@/client/console/preselectWitness';
import {notePromptSubmit, notePromptView} from '@/client/console/promptSequence';
import {
  detectDeferredGenerationFlip, detectGenerationScene, markGenerationConversion, runGenerationFlip, runGenerationIncomeFlights, seedGenerationIncomeHold,
} from '@/client/console/generationScene/generationScene';
import {seedTerraformedScene} from '@/client/console/terraformedScene/terraformedScene';
import {
  detectEnergyConversion,
  endEnergyConversion,
  runEnergyConversion,
} from '@/client/components/feedback/energyConversionTransition';
import {
  abortTradeFleet,
  detectTradeFleet,
  endTradeFleet,
  runTradeFleet,
  tradeFleetState,
} from '@/client/console/colonyFleet/consoleTradeFleet';
import {fleetDockOwedCard, seedFleetDockHold} from '@/client/console/colonyTrade/fleetDockScene';
import {seedActionCommitRail} from '@/client/console/consoleActionCommitRail';
import {seedMaPriceRail} from '@/client/console/maPriceRail';
import {seedFirstActionRail} from '@/client/console/startFirstActionRail';
import {seedVpShares} from '@/client/console/scoreCell/vpShareLedger';
import {
  abortColonyTrade,
  detectColonyTrade,
  runColonyTradeRewards,
  seedColonyTradeRewardHold,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {
  abortPlayedHero,
  detectPlayedHero,
  endPlayedHero,
  runPlayedHero,
  shipPlayDiscard,
  seedPlayedHeroRewardHold,
} from '@/client/console/played/consolePlayedHero';
import {stagePlayedCardReturns} from '@/client/console/played/playedCardReturn';
import {seedBonusGainRewardHold} from '@/client/console/startBonusGain';
import {seedParliamentRewardHold} from '@/client/console/parliament/parliamentRewardBeat';
import {enterParliamentSittingHolds, seedParliamentSittingHolds} from '@/client/console/parliament/parliamentSittingSeed';
import {seedBannerCubeHolds} from '@/client/console/parliament/bannerCubeScene';
import {noteSittingRise} from '@/client/console/parliament/sittingRise';
import {seedScaleStepRewardHolds} from '@/client/console/scaleStepReward/scaleStepRewardBeat';
import {openReactionSeedBlock, seedCardReactionHolds, snapshotRailHolds} from '@/client/console/cardReaction/cardReactionDirector';
import {detectTableAnswerPayout, endTableAnswerPayout, runTableAnswerPayout, seedTableAnswers} from '@/client/console/parliament/tableAnswerBeat';
import {seedScaleStepRatingHold} from '@/client/console/scaleStepReward/scaleStepRatingBeat';
import {seedVenusBonusCellHold} from '@/client/console/scaleStepReward/venusBonusCellBeat';
import {seedCellResourceHolds} from '@/client/console/cellResource/cellResourceBeat';
import {seedParameterSwings} from '@/client/console/scaleSwing/scaleSwingDirector';
import {heldStock as heldRailStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY} from '@/client/console/resourceTransfer/resourceTransferModel';
import {seedDeckDrawHold} from '@/client/console/deckDraw/consoleDeckDraw';
import {seedRevealRewardHold} from '@/client/console/revealHandoff';
import {seedChairmanQuestHolds} from '@/client/console/parliament/consoleChairmanQuest';
import {seedAgendaWalkHolds} from '@/client/console/parliament/agendaWalk';
import {seedNeutralRallyHolds} from '@/client/console/parliament/neutralRally';
import {seedSupportDiscardHolds} from '@/client/console/parliament/supportDiscard';
import {seedDelegateRemovalHolds} from '@/client/console/parliament/delegateRemoval';
import {clearColonyTrackMove, seedColonyTrackMoveHolds} from '@/client/console/colonyTrade/colonyTrackMove';
import {
  colonyRosterState, detectColonyRosterChange, disarmColonyRoster, runColonyRosterCeremony, seedColonyRosterHolds,
} from '@/client/console/colonyRoster/consoleColonyRoster';
import {detectColonyCity, disarmColonyCity, runColonyCity, seedColonyCityHolds} from '@/client/console/colonyCity/consoleColonyCity';
import {seedRivalVotes} from '@/client/console/parliament/parliamentRivalVotes';
import {consoleModeState} from '@/client/console/consoleModeState';
import {rollbackHydroCommit} from '@/client/console/hydroFlow/consoleHydroFlow';
import {
  abortHydroMarker,
  detectHydroMarker,
  endHydroMarker,
  runHydroMarker,
  seedHydroMarkerRewardHold,
} from '@/client/console/hydroMarker/consoleHydroMarker';
import {
  abortPatentSale,
  detectPatentSale,
  endPatentSale,
  runPatentSale,
  seedPatentSaleRewardHold,
} from '@/client/console/patentSale/consolePatentSale';
import {seedPoliticalDiscardExchange} from '@/client/console/cardDiscard/discardExchangeBeat';
import {seedPreludeBurnRewardHold} from '@/client/console/deckPick/preludeBurnReward';
import {notePreludeChainView} from '@/client/console/deckPick/preludePlayChain';
import {
  detectResolutionPayout,
  endResolutionPayout,
  runResolutionPayout,
} from '@/client/console/parliament/consoleResolutionPayout';
import {
  detectPromptReceive, disarmPromptReceive, endPromptReceive, runPromptReceive,
} from '@/client/console/cardReceive/promptReceive';
import {
  abortStdProjectCommit,
  detectStdProjectCommit,
  runStdProjectCommit,
} from '@/client/console/consoleStdProjectCommit';
import {
  abortCardDiscard,
  detectCardDiscard,
  endCardDiscard,
  cardDiscardDeparted,
  runCardDiscard,
} from '@/client/console/cardDiscard/consoleCardDiscard';
import {
  abortTilePlacement,
  detectTilePlacement,
  endTilePlacement,
  measureBoardHexRect,
  runTilePlacement,
  seedTilePlacementRewardHold,
} from '@/client/console/tilePlacement/consoleTilePlacement';
import {rollbackPlacementCommit} from '@/client/console/tilePlacement/placementFlow';
import {
  abortStagedPlayCommit,
  seedStagedPlayRewardHold,
  runStagedSealWave,
  stagedSealPending,
} from '@/client/console/stagedPlay';
import {
  abortNomadMove,
  detectNomadMove,
  endNomadMove,
  runNomadMove,
  seedNomadMoveRewardHold,
  stageRemoteNomadMove,
} from '@/client/console/nomads/consoleNomadMove';
import {
  abortColonyBuild,
  detectColonyBuild,
  endColonyBuild,
  runColonyBuild,
  seedColonyBuildRewardHold,
} from '@/client/console/colonyBuild/consoleColonyBuild';
import {stageRemotePlacements} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {abortBoardCardBonus} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {abortConsoleActionCommit} from '@/client/console/consoleActionCommit';
import {resetColonyBonusPayout, seedColonyBonusPayoutHolds} from '@/client/console/colonyLedger/colonyBonusPayout';
import {abortBotAttackCommit} from '@/client/console/botAttack/botAttackState';
import {abortStartTender} from '@/client/console/consoleStartState';
import {clearDecisionPickAnswered} from '@/client/console/effectDecision/effectDecisionState';
import {presentFreshBotTurns} from '@/client/components/marsbot/marsBotPresentation';
import {registerBotTurnApplied} from '@/client/components/marsbot/marsBotStagedCommits';
// The GAME START WORKSPACE holds the deployment across prompt gaps. While it
// does, a submit's response must COMMIT INLINE: the staged-bot pipeline
// defers the commit to notification deliveries the start scene suppresses —
// the view then only advances via the poll, seconds late, and every armed
// hero (the corporation / prelude landing) times out into a TELEPORT. The
// bot's setup turns present normally with the first post-start response.
import {startSceneHeld} from '@/client/console/consoleStartState';
import {acknowledgeFlowHoldingCards} from '@/client/components/notifications/notificationState';
import {registerLivenessRelease} from '@/client/console/consoleLiveness';
import {FlowScope} from '@/client/console/kernel/flowScope';
import {consoleAppScope, sessionChild} from '@/client/console/session/consoleSession';
import {FlowActor, startFlowActor} from '@/client/console/kernel/flowMachine';
import {submitMachine, SubmitStatus} from '@/client/console/transport/submitMachine';
import {announceSubmitTicket, SubmitSettle, SubmitTicket} from '@/client/console/transport/submitTicket';
import {
  applyHazardTileSwap,
  detectHazardCleanup,
  endHazardCleanup,
  runHazardCleanup,
} from '@/client/components/feedback/hazardCleanupTransition';
import {span} from '@/client/console/session/sessionWaits';

/*
 * After a World Government Terraforming choice that bumps a global
 * parameter (temperature / oxygen / venus), hold the playerkey++
 * reset epoch for this many ms so the AnimatedScaleMarker on the affected
 * dial gets a clean window to glide from old → new value BEFORE the
 * next-phase surface (research / draft, action menu, etc.) opens and
 * potentially covers the board. Without this hold the impact of the
 * WGT pick is invisible — the response is fast, the next surface pops
 * the same frame, and the marker animation is occluded.
 */
const WGT_MARKER_HOLD_MS = 1100;

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

/** The words of the server's silence (the `sending` state's bound — `submitMachine.ts`), named. */
const SERVER_NOT_RESPONDING_TITLE = 'The server is not responding';
const SERVER_NOT_RESPONDING = 'The server has not answered your move for a minute. It may still be processing it — the game will reload its current state.';

/**
 * The poll request's own give-up horizon. `/api/waitingfor` answers
 * immediately (GO/REFRESH/WAIT — the server never holds it open), so any
 * request older than this is a hung socket, not a slow answer. Well above
 * every honest LAN round trip, far below the OS TCP give-up that used to be
 * the only bound on a half-dead link.
 */
const POLL_XHR_TIMEOUT_MS = 15_000;

// The spinning ◑◒◐◓ symbol used to indicate it's your turn.
const TURN_SEQUENCE = '◑◒◐◓';

// On a desktop browser the favicon is visible in the tab, so we spin it there
// rather than cluttering the document title. Mobile browsers don't show tab
// favicons, so they keep animating the title instead.
function isDesktopBrowser(): boolean {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * The narrow root contract the transport drives. The App root instance
 * satisfies it structurally; tests pass a fake.
 */
export interface TransportRoot {
  playerView: ViewModel;
  playerkey: number;
  playersWaitingFor: Array<Color>;
  isServerSideRequestInProgress: boolean;
  updatePlayer(): void;
  showAlert(title: string, message: string, cb?: () => void): void;
}

/** The console cinematic-gate holds — the windows in which a server response
 *  is being physically presented and the next prompt must not paint. */
export const transportHolds = reactive({
  marker: false,
  tilePlacement: false,
  conversion: false,
  hazardCleanup: false,
  tradeFleet: false,
  hydroMarker: false,
  playedHero: false,
  patentSale: false,
  stdProject: false,
  cardDiscard: false,
  tilePlacementHero: false,
  colonyBuild: false,
  /** The colony ROSTER ceremony of the player's own flow (a tile replaced / added / removed — TR10, Aridor, the solo trim). */
  colonyRoster: false,
  /** A CITY landing on a colony tile in the player's own flow (TR22 Nova City) — the commit is held to the frame of contact. */
  colonyCity: false,
  nomadMove: false,
  resolutionPayout: false,
  /** The answer of a live «on which card» pick is played as a scene (TR53 iteration — `cardReceive/promptReceive.ts`). */
  promptReceive: false,
  /** A walk's LAYOUT answered on the answer stage (TR78 — `parliament/tableAnswerBeat.ts`): the commit is held to the touchdowns. */
  tableAnswer: false,
  /** THE GENERATION SCENE's pre-commit beat — the counter's flip (TR61 — `generationScene/generationScene.ts`). */
  generationScene: false,
});

/** Every transport cinematic gate — the disjunction the board binder (and any
 *  other admission reader) suppresses on. The console placement admission
 *  hold composes at the READER (it is a prompt-admission fact, not a
 *  transport hold). */
export function transportHolding(): boolean {
  const h = transportHolds;
  return h.marker || h.tilePlacement || h.conversion || h.hazardCleanup || h.generationScene ||
    h.tradeFleet || h.hydroMarker || h.playedHero || h.patentSale ||
    h.stdProject || h.cardDiscard || h.tilePlacementHero || h.colonyBuild || h.colonyRoster || h.colonyCity ||
    h.nomadMove || h.resolutionPayout || h.promptReceive || h.tableAnswer;
}

/**
 * Read-only diagnostic facts for the e2e readiness probe (`e2eReadiness.ts`).
 * Renders nothing, drives nothing — a snapshot consumer only. `undefined`
 * before the transport starts (menu screens, the pre-mount gap).
 */
export function transportDiagFacts(): {
  gameAge: number,
  undoCount: number,
  waitingForType: string | undefined,
  promptId: number | undefined,
  requestInProgress: boolean,
  holding: boolean,
} | undefined {
  if (root === undefined) {
    return undefined;
  }
  const v = currentView();
  const wf = currentWaitingFor();
  return {
    gameAge: v.game.gameAge,
    undoCount: v.game.undoCount,
    waitingForType: wf?.type,
    promptId: wf?.promptId,
    requestInProgress: root.isServerSideRequestInProgress === true,
    holding: transportHolding(),
  };
}

/** Reactive transport facts surfaces may read (never write). */
export const transportState = reactive({
  playersWaitingFor: [] as Array<Color>,
  /** The REACTIVE mirror of the root's `isServerSideRequestInProgress` — written at the funnel's two edges only. */
  requestInProgress: false,
  /** When the funnel closed (epoch ms) — the liveness arbiter reads the request's age. */
  requestSince: 0,
  /** The server ANSWERED this request (its gates are what still holds the funnel) — the arbiter may release it. */
  responseArrived: false,
  /** Where the standing submit is — the machine's own state, mirrored (`idle` = the funnel is free). */
  phase: 'idle' as 'idle' | 'sending' | 'presenting',
  /** Presses REFUSED because the funnel was busy (evidence — a surface that offers a verb the funnel would refuse). */
  refusedWhileBusy: 0,
});

/**
 * THE SUPERVISOR'S RELEASE (the liveness ladder's rung 22): a submit that stands with the server's answer already in
 * hand is held by its own presentation — an awaited scene. The holds that scene waits on were expired a rung earlier; a
 * GATE that still stands is ended as expired, and THE COMMIT GOES ON WITHOUT IT: the rest of the pipeline runs and the
 * answer is applied by the chain that owns it (the old release only lowered the flag — the hung chain, if it ever
 * woke, applied a view older than the one re-fetched meanwhile). With no gate standing the presentation is hung
 * somewhere else and the submit is abandoned (`RELEASE` → `abandoned` — the funnel reopens, the truth is re-fetched).
 * A request still ON THE WIRE is never cut here — its own bound (the server's silence) decides that one.
 */
export function releaseTransportFunnel(): string {
  const submit = liveSubmit.value;
  if (root === undefined || submit === undefined) {
    return '';
  }
  const ageS = Math.round((Date.now() - transportState.requestSince) / 1000);
  if (submit.flow.snapshot.value.value !== 'presenting') {
    return `request on the wire for ${ageS}s — left to the network`;
  }
  if (submit.gates.size > 0) {
    const names = [...submit.gates].map((gateScope) => gateScope.label);
    for (const gateScope of [...submit.gates]) {
      gateScope.end({how: 'expired', bound: 'released by the supervisor'});
    }
    return `funnel released after ${ageS}s (the answer arrived; its gate «${names.join('», «')}» never let go) — the commit goes on without it`;
  }
  submit.flow.send({type: 'RELEASE'});
  return `funnel released after ${ageS}s (the answer arrived; its presentation never ended) — the view re-fetched`;
}

registerLivenessRelease({rank: 22, name: 'transport', release: releaseTransportFunnel});

// A STAGED MarsBot turn's delivery tells the card reactions THAT turn woke (P46 Colony Trade Hub — a human's
// «when any colony is placed» on the bot's build): the records under the turn's own root (`correlationId` ===
// `root.actionId`), seeded in the delivery's own block — the turn's card names them in its «why» band at the same
// moment, and the run's full commit later finds them claimed (one telling, never two).
registerBotTurnApplied((presented, latest, turn) => {
  const root = turn.correlationId;
  if (root === undefined) {
    return;
  }
  seedCardReactionHolds(presented as PlayerViewModel, latest as PlayerViewModel, snapshotRailHolds(), {only: (r) => r.root.actionId === root});
});

/**
 * THE SUBMIT FUNNEL IS BUSY — a request is on the wire, or its answer is still being presented behind a cinematic
 * gate (`isServerSideRequestInProgress` stays raised through every hold): `fetchPlayerInput` REFUSES a second submit
 * meanwhile. A surface that launches a cinematic FOR a submit asks this first — a flight for a press the funnel will
 * drop is a token into nothing (the start's «Наследие» row pressed right after the bought cards' payment: its cards
 * lifted off, the grant was never sent, and they hung in the air until the intake's budget dipped them). Reactive
 * (the mirror), so a command bar may read it in a computed and dim the verb the funnel would refuse.
 */
export function transportRequestInProgress(): boolean {
  return transportState.requestInProgress;
}

let root: TransportRoot | undefined;
/**
 * THE POLL'S NEXT LOOK — a GUARANTEED release of the transport's scope (architecture v2 — PLAN §10): the chain is the
 * game's fallback liveness, so its next look can never be silently taken back with its owner (a scope re-homed under
 * it would have ended the chain for good) — it comes at its time, or at once when the scope ends un-disarmed; the
 * teardown disarms it first. `disarmPoll` is where `clearTimeout(ui_update_timeout_id)` stood.
 */
let disarmPoll: () => void = () => {};
/** The tab title's spinner — an owned tick of the transport's scope. */
let stopTitleSpinner: () => void = () => {};
let animationFrame = 0;
/**
 * Set true in `stopGameTransport` so the self-re-arming poll chain can't
 * outlive the game screen. `askForUpdate` re-arms itself via
 * `waitForUpdate()`, so leaving a game to a NON-game screen (main menu) —
 * where no successor transport starts to overwrite the shared timer — would
 * otherwise leave an immortal `/api/waitingfor` poll chain hammering the
 * server. `waitForUpdate` bails on this flag, and an in-flight xhr's onload
 * re-arm is likewise suppressed.
 */
let pollStopped = true;
let onVisibilityChange: (() => void) | undefined;
let realtimeWakeOff: (() => void) | undefined;
let freshnessWitnessOff: (() => void) | undefined;

// ── ONE SUBMIT = ONE SCOPE (architecture v2, lifecycle 4) ───────────────────────────────────────────────────────────

export type {SubmitSettle, SubmitTicket} from '@/client/console/transport/submitTicket';

type LiveSubmit = {
  scope: FlowScope<'submit'>,
  flow: FlowActor<typeof submitMachine>,
  /** The gates playing right now (the supervisor's release ends them). */
  gates: Set<FlowScope>,
};

let transportFlow: FlowScope<'transport'> | undefined;
const liveSubmit = shallowRef<LiveSubmit | undefined>(undefined);
const settleListeners = new Set<(settle: SubmitSettle) => void>();

function transportScope(): FlowScope<'transport'> {
  transportFlow = sessionChild(transportFlow, 'transport');
  return transportFlow;
}

/**
 * EVERY SUBMIT SETTLES HERE — applied, staged, refused, failed, silent, abandoned. What a surface keeps «while my
 * answer is on its way» (a `submitting` flag, a sealed pose, a dimmed verb) resets on this, whichever way the answer
 * went — the refusal battery could only recall the transactions somebody had listed in it.
 */
export function onSubmitSettled(listener: (settle: SubmitSettle) => void): () => void {
  settleListeners.add(listener);
  return () => settleListeners.delete(listener);
}

/**
 * A gate's own bound. Deliberately ABOVE the hold registry's ceiling (35 s) and so above every scene's own safety: the
 * scene's owner ends its wedge first (its `expire`), and this is only what guarantees that a gate — whatever its
 * module does — cannot hold a submit for ever.
 */
export const GATE_MAX_MS = 45_000;

function submitStatusOf(flow: FlowActor<typeof submitMachine>): SubmitStatus {
  const snapshot = flow.snapshot.value;
  return snapshot.status === 'done' ? snapshot.value as SubmitStatus : 'abandoned';
}

/**
 * ONE CINEMATIC GATE of a submit's presentation, as a BOUNDED CHILD of the submit: its `transportHolds` flag is the
 * child's life (raised here, lowered on every way out — `keep` leaves it up for the gates whose flag stands until
 * the commit), a scene that THROWS is that child's failed end (said once by the kernel — the commit goes on; it used
 * to surface as a «network error» with the view never applied), a scene that never ends is ended by its bound or by
 * the supervisor's release, and the pipeline moves on. Returns `false` only when the SUBMIT itself is over (abandoned,
 * the transport stopped) — the caller stops: nothing of this answer may be applied any more.
 */
async function gate(submit: LiveSubmit, hold: keyof typeof transportHolds, run: () => unknown, options?: {keep?: boolean}): Promise<boolean> {
  transportHolds[hold] = true;
  let gateScope: FlowScope | undefined;
  const outcome = await submit.scope.run(hold, (scope) => {
    gateScope = scope;
    submit.gates.add(scope);
    return run();
  }, {kind: 'gate', bound: {ms: GATE_MAX_MS, quiet: 'named by the transport'}});
  if (gateScope !== undefined) {
    submit.gates.delete(gateScope);
  }
  if (options?.keep !== true) {
    transportHolds[hold] = false;
  }
  if (outcome.status === 'expired') {
    console.warn(`[transport] gate «${hold}» of ${submit.scope.id} outlived its bound (${outcome.bound}) — the commit goes on without it`);
  }
  return submit.scope.ended === undefined;
}

function theRoot(): TransportRoot {
  if (root === undefined) {
    throw new Error('game transport used before startGameTransport');
  }
  return root;
}

function currentView(): PlayerViewModel {
  return theRoot().playerView as PlayerViewModel;
}

function currentWaitingFor(): PlayerInputModel | undefined {
  return currentView().waitingFor;
}

/**
 * Start the transport for the game screen. Idempotent-ish: a second start
 * re-points the root and re-arms the chain (the binder mounts once per game
 * entry; ConsoleShell keeps it mounted for the whole session).
 */
export function startGameTransport(transportRoot: TransportRoot): void {
  root = transportRoot;
  pollStopped = false;
  // A fresh game (or a game switch) starts with no decision CHAIN — an idle view by definition. Only the chain: a
  // decision modal may already be standing (its head mounts BEFORE this binder in the shell's template), and wiping
  // its presentation here once left the next decision with no predecessor to differ from.
  notePromptView(undefined);
  // Always poll — even when the viewer is mid-prompt — so other players'
  // status (cube spin, status label) stays in sync across simultaneous-
  // action phases (drafting / research / production interrupts). The poll
  // handler skips full refreshes while the viewer has a prompt to avoid
  // resetting partial input state.
  waitForUpdate();
  // Browsers throttle (and after ~5 min freeze) setTimeout in a backgrounded
  // tab, so the poll chain above stalls while the player is on another
  // tab/window — they'd come back to STALE state. Force an immediate poll the
  // moment the game tab becomes visible/focused again. The poll handler
  // itself decides whether anything actually changed (REFRESH/GO vs WAIT)
  // and skips refreshes while the viewer is mid-prompt, so this is safe and
  // never disrupts partial input.
  onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      waitForUpdate(true);
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onVisibilityChange);
  // Realtime: a WS invalidation, once coalesced by the sync coordinator,
  // wakes the SAME guarded refresh as a visibility/focus wake. The poll
  // handler still decides GO/REFRESH/WAIT and skips full refreshes while the
  // viewer is mid-prompt, so this never disrupts partial input. Polling
  // remains the fallback; when realtime is disabled no wake ever fires.
  realtimeWakeOff = onRealtimeWake(() => waitForUpdate(true));
  // THE FRESHNESS WITNESS (presentation ledger): the applied view stayed
  // behind the WS-advertised cursor past the grace window — a consumed wake,
  // a refused refresh, a dropped model. Whatever ate the primary path, the
  // heal re-runs the SAME guarded check; the guard itself decides what (if
  // anything) to do with it. This is the debt net under «a refused refresh
  // is a DEBT» — it can never fetch redundantly (the guarded check compares
  // cursors server-side) and never bypasses a guard.
  freshnessWitnessOff = registerTruthWitness({
    id: 'view-freshness',
    lying: () => !pollStopped && root !== undefined &&
      (root.playerView as PlayerViewModel | undefined)?.game !== undefined &&
      !root.isServerSideRequestInProgress &&
      serverAheadOfView(currentView().game),
    graceMs: 3000,
    heal: () => waitForUpdate(true),
  });
}

/** Stop the transport (leaving the game screen / END). Detaches everything. */
export function stopGameTransport(): void {
  if (freshnessWitnessOff !== undefined) {
    freshnessWitnessOff();
    freshnessWitnessOff = undefined;
  }
  if (onVisibilityChange !== undefined) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onVisibilityChange);
    onVisibilityChange = undefined;
  }
  if (realtimeWakeOff !== undefined) {
    realtimeWakeOff();
    realtimeWakeOff = undefined;
  }
  stopTitleSpinner();
  stopTitleSpinner = () => {};
  pollStopped = true;
  disarmPoll();
  disarmPoll = () => {};
  // The transport's scope ends with the game screen — a submit still standing is over with it (its funnel reopens,
  // its gates are cancelled, its ticket settles `abandoned`).
  transportFlow?.end({how: 'cancelled', reason: 'the game screen left'});
  transportFlow = undefined;
  root = undefined;
}

/*
 * Apply the turn presentation for the CURRENT prompt state: static document
 * title, favicon turn/idle status, and the multiplayer title spinner
 * interval (armed only while the viewer owes a REQUIRED prompt). Called from
 * the binder's `waitingfor` watcher (immediate).
 */
export function syncTurnPresentation(): void {
  if (root === undefined || (root.playerView as PlayerViewModel | undefined)?.game === undefined) {
    return;
  }
  document.title = gameDocumentTitle(currentView().game);
  // An optional prompt (draft re-pick) is not the viewer's turn to act.
  const wf = currentWaitingFor();
  const hasRequiredPrompt = wf !== undefined && wf.optional !== true;
  if (getPreferences().experimental_ui) {
    setFaviconStatus(hasRequiredPrompt ? 'turn' : 'idle');
  }
  stopTitleSpinner();
  stopTitleSpinner = () => {};
  if (currentView().players.length > 1 && hasRequiredPrompt) {
    stopTitleSpinner = transportScope().every(1000, 'the tab title\'s spinner', () => animateTitle());
  }
}

function animateTitle(): void {
  if (!getPreferences().animated_title || root === undefined) {
    return;
  }
  animationFrame = (animationFrame + 1) % TURN_SEQUENCE.length;
  const experimental = getPreferences().experimental_ui;
  // The favicon annotation is an experimental feature.
  if (experimental) {
    setFaviconTurnFrame(animationFrame);
  }
  // Existing behavior spins the symbol in the document title. With
  // experimental UI on a desktop browser we show it only in the tab favicon
  // instead; otherwise keep animating the title.
  if (!(experimental && isDesktopBrowser())) {
    document.title = TURN_SEQUENCE[animationFrame] + ' ' + gameDocumentTitle(currentView().game);
  }
}

/** Submit ONE input response (the whole console funnels through here). */
export function submitInput(out: InputResponse): SubmitTicket {
  // The decision sequence: this press opens (or continues) a chain — the prompt it raises is its follow-up.
  notePromptSubmit();
  /*
   * Capture whether the prompt the player is currently submitting is the WGT
   * OrOptions BEFORE we hand off to fetch — by the time the response
   * arrives, the current waitingFor may already have been replaced (rare,
   * but defensive).
   */
  const wgtSubmit = currentPromptIsWGT();
  return fetchPlayerInput(
    apiUrl(paths.PLAYER_INPUT) + '?id=' + currentView().id,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      // `promptId` = the DISPLAYED prompt's identity stamp: the server refuses
      // the submit (STALE_PROMPT) when its live prompt is a different one — an
      // answer must never be applied to a prompt the player was not looking at.
      body: JSON.stringify({runId: currentView().runId, promptId: currentWaitingFor()?.promptId, ...out}),
    },
    wgtSubmit);
}

/**
 * Submit an ORDERED ARRAY of responses in one request (the action-preview
 * rework's "single final submit"). The server replays them in order against
 * each successive `waitingFor`; see `routes/PlayerInputBatch.ts`. The
 * response is a normal PlayerViewModel, so the same hold/animation + update
 * path as `submitInput` applies; a leftover `waitingFor` (board placement /
 * divergence) renders through the existing routing.
 *
 * `composedFor` — the serial of the prompt the batch was COMPOSED against, when
 * the composing surface outlives a round trip (the play composer is opened on
 * one action menu and confirmed later). Omitted, the prompt standing now is
 * the stamp, exactly as before.
 */
export function submitBatch(responses: ReadonlyArray<InputResponse>, composedFor?: number): SubmitTicket {
  // The «re-asked» witness remembers what this batch answered (`preselectWitness.ts`).
  notePreselectBatch(responses);
  notePromptSubmit();
  return fetchPlayerInput(
    apiUrl(paths.PLAYER_INPUT_BATCH) + '?id=' + currentView().id,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      // Same identity stamp as submitInput — the batch's head answers the
      // displayed prompt, so the whole batch rides or falls with its identity.
      // …and a batch composed against an EARLIER prompt carries THAT prompt's
      // serial: once every other seat has passed, two action menus in a row are
      // indistinguishable to the eye, and a play posted against the second one
      // was applied to it («Unknown card name Corporate Espionage», 2026-10-23)
      // instead of being refused as stale.
      body: JSON.stringify({runId: currentView().runId, promptId: composedFor ?? currentWaitingFor()?.promptId, responses}),
    },
    false);
}

/** Cancel a pending, cancellable tile placement (a pay-on-commit standard
 *  project). Submits a CancelResponse; the server discards the placement
 *  without charging and returns the player to the action menu. */
export function cancelPlacement(): SubmitTicket {
  return submitInput({type: 'cancel'});
}

/** The viewer's six stock rows, as a view reads them (the tile hero's price check — PL-306). */
function stockReadingOf(player: PublicPlayerModel | undefined): Record<string, number> {
  if (player === undefined) {
    return {};
  }
  return {
    megacredits: player.megacredits, steel: player.steel, titanium: player.titanium,
    plants: player.plants, energy: player.energy, heat: player.heat,
  };
}

function currentPromptIsWGT(): boolean {
  const wf = currentWaitingFor();
  if (wf === undefined || wf.type !== 'or') {
    return false;
  }
  // The World Government's question by its marker (P67 · GK — never its title).
  return (wf as OrOptionsModel).worldGovernmentPrompt !== undefined;
}

/**
 * Does the about-to-be-applied playerView change one of the three
 * global-parameter dials this fork's `AnimatedScaleMarker` highlights? Used
 * to decide whether the WGT 2-stage hold is worth running. "Add an ocean"
 * WGT picks land here with all three values unchanged (the ocean placement
 * comes later through a SelectSpace prompt), so we skip the hold and let the
 * next prompt open instantly.
 */
function shouldHoldForMarkerAnimation(newView: PlayerViewModel): boolean {
  const oldGame = currentView().game;
  const newGame = newView.game;
  return oldGame.temperature !== newGame.temperature ||
    oldGame.oxygenLevel !== newGame.oxygenLevel ||
    oldGame.venusScaleLevel !== newGame.venusScaleLevel;
}

/**
 * Stage 1 of the WGT 2-stage transition: mutate JUST the three
 * global-parameter values on the currently-displayed playerView in place.
 * Vue 3 reactivity propagates each scalar change to the Board's props; the
 * AnimatedScaleMarker watcher fires and starts gliding the affected dial.
 * The rest of the new view lands at Stage 2 (the regular commit).
 */
function applyGlobalParamPreview(newView: PlayerViewModel): void {
  const oldGame = currentView().game;
  const newGame = newView.game;
  if (oldGame.temperature !== newGame.temperature) {
    oldGame.temperature = newGame.temperature;
  }
  if (oldGame.oxygenLevel !== newGame.oxygenLevel) {
    oldGame.oxygenLevel = newGame.oxygenLevel;
  }
  if (oldGame.venusScaleLevel !== newGame.venusScaleLevel) {
    oldGame.venusScaleLevel = newGame.venusScaleLevel;
  }
}

/**
 * Seed the console REWARD HOLDS in the SAME SYNCHRONOUS BLOCK as the commit
 * (never earlier — see the seeders' own contract). The panel renders
 * `committed − held`, so a hold seeded even ONE micro-task before the commit
 * lets Vue flush a frame of "PRE-commit value − reward" — the metric visibly
 * DIPS and AnimatedMetricValue honestly fires a phantom −N chip, which the
 * commit then undoes. Seeding here means Vue sees exactly ONE transition,
 * and the only real one is each reward's release at its chip's touchdown.
 *
 * All calls are no-ops unless their transaction armed rewards.
 */
function seedRewardHolds(newView?: PlayerViewModel): void {
  // The rating held BEFORE this block — what this response's own owners hold is measured against it (PL-330).
  const ratingHeldBefore = heldRailStock(RATING_RAIL_KEY);
  // …and EVERY rail row held before it («СРАБАТЫВАНИЕ КАРТЫ»): the card-reaction seeder, run after every host, tells a
  // reaction row a host holds (its answer — the host's flight asks for the reactor) from one nobody holds (its own chain).
  const railHeldBefore = snapshotRailHolds();
  // ONE ANSWER (P82): every host that seeds below belongs to this block — its flight later asks for THIS block's reactors.
  openReactionSeedBlock();
  // THE GENERATION SCENE's income (TR61): the rows the seat's own production record names keep their pre-income
  // values until each token's touchdown — a no-op unless a scene is armed (the detect claimed the record).
  seedGenerationIncomeHold(currentView(), newView);
  // The DECK COUNTER (PL-088): a new batch of cards off the project deck stays on the counter until the flight that
  // deals it — the same block as the commit, or the HUD paints the smaller count and the flight's hold flips it back up.
  seedDeckDrawHold(currentView(), newView);
  // A card PLAY's gains, and its rail half (PL-001 for plays): the direct TR and the table's answer, held only when
  // the two views keep the promise the press armed — the landing scene's reward beat flies them.
  seedPlayedHeroRewardHold(currentView(), newView);
  seedTilePlacementRewardHold();
  seedStagedPlayRewardHold();
  seedNomadMoveRewardHold();
  seedColonyBuildRewardHold();
  seedColonyTradeRewardHold();
  // A PATENT SALE's answers to its answers (TR46 → Martian Fiber's M€): held on the rail from this commit until their
  // own chip, born on the answering card beside the terminal, touches down (`consolePatentSale.ts`).
  seedPatentSaleRewardHold();
  // A BURNT PRELUDE's 15 M€ (PL-1469 — the mid-game prelude pick, P91): held on the rail from the answer that paid them
  // until the token born on the burnt card's face touches down (`deckPick/preludeBurnReward.ts`).
  seedPreludeBurnRewardHold(currentView(), newView);
  // …and a prelude chain whose hand is gone (not merely aside for the board) is over (PL-1467).
  notePreludeChainView();
  // A PARTY ACTION'S DISCARD answered in the card composer (the Reds' «2 M€ per tag»): its payout is held on the rail
  // from this commit until each token, born on the plaque's printed M€ icon, touches down (`discardExchangeBeat.ts`).
  seedPoliticalDiscardExchange(currentView(), newView);
  // A trade whose fleet landed on a DOCK CARD (TR06 Water Hauling, TR26 UNMI
  // Liner): the card's own scene holds whatever the response raised until the
  // workspace has left, and a reward that lands ON THE RAIL (the Liner's TR)
  // is held on the rail until its token touches down — both seeded here, in
  // the apply block, and only while the dock's stage stands
  // (`fleetDockScene.ts`; the rail half checks its promise against the views).
  // A card reward the landing response did not pay yet (TR27: its target asked live, or parked behind another
  // question) is seeded again on the response that pays it — the trade's fleet has long since landed by then.
  seedFleetDockHold(tradeFleetState.active ? tradeFleetState.card : fleetDockOwedCard(), currentView(), newView);
  // A CARD ACTION's rail half (PL-001 for actions — `consoleActionCommitRail.ts`): the branch's direct TR, the
  // capsule moves of a timeline row (TR28) and the table's answer, held only when the two views keep the promise
  // the press armed; the shell's handoff flies them.
  seedActionCommitRail(currentView(), newView);
  // A MILESTONE / AWARD's PRICE (PL-1621): held on its rows from the view that pays it until the detail stage flies it
  // into its printed price, before the ceremony (`maPriceRail.ts`).
  seedMaPriceRail(currentView(), newView);
  // The START STAGE's first action (TR81 — the third ATTACHED host of the card-reaction framework): its own rail gains
  // and the table's answer to them (Lotus Innovations' data on itself), held and DECLARED here so the reaction seeder
  // below attaches the reactor to the stage, which brings it forward out of its seat (`startFirstActionRail.ts`).
  seedFirstActionRail(currentView(), newView);
  seedHydroMarkerRewardHold();
  // The «Фора» window's gains — the ONE seeder that needs BOTH views: a claim
  // is armed at the press, but the window's AUTO-resolve is only knowable by
  // comparing the bonus ledger before and after, and its M€ amount is read off
  // the COMMITTED hand (the server's own arithmetic). The flight itself waits
  // for the workspace to be back on screen, so this only holds the panel and
  // leaves the beat owed.
  seedBonusGainRewardHold(currentView(), newView);
  // The PARLIAMENT SITTING's reward (Turmoil Redux): the records the enacted
  // resolution just paid this seat, and the viewer's Agenda TR bonus — held on
  // the rail until the sitting's own beat flies them (only while the sitting
  // is on screen; else the counters tick with this very commit).
  // FIRST: a response that RAN the sitting (the soft gates — the pass carries it) covers the board until the sitting
  // stands, so what the law did on the board waits for the sitting's own world beat (`sittingRise.ts`).
  noteSittingRise(currentView(), newView);
  // A NEW sitting drops the old holds BEFORE anything of this response seeds its own (the reward ledger's included).
  enterParliamentSittingHolds(newView);
  seedParliamentRewardHold(currentView(), newView);
  // …and the sitting's DISPLAY holds (v2): the table as it stood before the
  // barrier opened / the area was refreshed — the tiers keep it until the
  // director's beats have moved every object. The SAME block as the commit,
  // or the new state paints for a frame before its beat.
  seedParliamentSittingHolds(currentView(), newView);
  // …and a cube that appeared on a party's BANNER (Septem Tribus:redux — the first action, a won resolution): held
  // off the plaques until its flight lands in the socket (`bannerCubeScene.ts`).
  seedBannerCubeHolds(currentView(), newView);
  // …and «ПРЕДСЕДАТЕЛЬСТВО»'s own (the chairman quest's gate answer): the
  // office and the Agenda step the answer produced, held until their beats
  // have moved them. Seeded LAST — the reward ledger's own `enterSitting('')`
  // runs above and would flush an Agenda bonus seeded before it.
  seedChairmanQuestHolds(currentView(), newView);
  // «МАРС ТЕРРАФОРМИРОВАН» (TR70 — `terraformedScene.ts`): the SERVER's word (`game.isTerraformed` flipping between
  // the two views) arms the scene and holds the scales' last step in the park until the scene's stage stands —
  // every road a view arrives by goes through this block, so an own move, a rival's and a staged bot turn alike.
  seedTerraformedScene(currentView(), newView);
  // …and «КАРЬЕРА»'s (a card's walk of the Agenda track, TR04): the marker held on its old step and every
  // paying step's bonus owed — ONLY when the hand that played the card (or an open Parliament) is there to
  // play it; seeded after the quest's for the same reason as the quest's after the ledger's.
  seedAgendaWalkHolds(currentView(), newView);
  // …and «ДЕЛЕГАТЫ»'s (a card's rally of neutral delegates, TR31): the new ribbon cubes hidden, the plaques and the
  // pool at their old counts, the winning marker where it stood, the M€ row held for the recount — ONLY when the
  // hand that played the card (or an open Parliament) is there to play it.
  seedNeutralRallyHolds(currentView(), newView);
  // …and a STRIPPED POPULAR SUPPORT AREA (TR12 Party Sanctions — «discard all neutral delegates from ONE area»): the
  // promised area keeps its cubes on the plaque and the common supply its old count until the mode that confirmed it
  // flies them — ONLY while that mode stands (a hold nobody plays would freeze the area).
  seedSupportDiscardHolds(currentView(), newView);
  // …and a figure a card took off the table (TR72): its place and its destination held until the flight lands it.
  seedDelegateRemovalHolds(currentView(), newView);
  // …and a CHOSEN COLONY TRACK's move (TR07 Colony Sponsors — «move its marker to the highest position»):
  // the promised tile held on its old cell until the stage it was confirmed on plays the glide — ONLY while
  // that stage stands (a hold nobody plays would freeze the track).
  seedColonyTrackMoveHolds(currentView(), newView);
  // …and a CHANGED COLONY ROSTER somebody else caused (a tile replaced / added / removed while this screen shows
  // the colony grid): the table as presented stays the old one until the grid has played the planet out and in.
  // The player's OWN change was played by its gate above with the commit held, and is never seeded again.
  seedColonyRosterHolds(currentView(), newView);
  // …and a CITY that came to lie on a colony tile (TR22 Nova City) which nobody on this screen played — a rival's, or
  // the player's own PARKED tail landing later: withheld on its seat and landed there, ONLY while a measurable seat
  // of that tile stands on screen. The player's OWN landing was played by its gate with the commit held to the
  // contact, and is never seeded again.
  seedColonyCityHolds(currentView(), newView);
  // …and ANOTHER SEAT'S DELEGATE that arrived with this response (a rival's
  // vote, MarsBot's Party Politics / Lobbying): its ribbon cube is hidden
  // and its flight queued in this very block, or it paints before it flies.
  seedRivalVotes(currentView(), newView);
  // …and a DECK-CHECK VERDICT that pays a stock reward (TR13 «+5 M€»): the rail
  // keeps the pre-reward number until the verdict's «OK» flies the chip in.
  seedRevealRewardHold(currentView(), newView);
  // …and a CARD's COLONY-BONUS PAYOUT («the ledger pays» — TR23 Habitat Science): every chips row of the ledger the
  // player pressed on keeps its pre-payout number on the rail until its own chip lands — the supply rows with the
  // press's answer, a resource onto a card with the response that actually carries it. Armed at the press only.
  seedColonyBonusPayoutHolds(currentView(), newView);
  // …and what a SCALE STEP paid (TR24 Venusian Census, Aphrodite — «each time the scale is terraformed»): the
  // viewer's own counter keeps its pre-payout number until each token born at the marker has landed.
  seedScaleStepRewardHolds(currentView(), newView);
  // …and the RATING a scale step the viewer made pays (TR41 Plasma Fans — a scale step from a card action, a play's
  // scale step, a standard project's): the rating cell keeps its pre-step number until the token born on the marker
  // has landed, the Greens' answer ticks a beat after it. Seeded LAST — after every owner that holds the rating for a
  // cause of its own (a direct TR, a tile's), so a rating is never held twice: what they held in THIS block is
  // subtracted from the rise, so the scales' own steps still fly beside an ocean's TR (PL-330).
  // …preceded by a PARAMETER SWING (TR47 «ОБРАТНЫЙ ХОД» — the server's record of «up and back»): the scene's start
  // is presented from this very block, and a raise that arrived together with its fall flies its rating itself.
  seedParameterSwings(currentView(), newView);
  seedScaleStepRatingHold(currentView(), newView, heldRailStock(RATING_RAIL_KEY) - ratingHeldBefore);
  // …and the alternative Venus board's BONUS the player just chose (P89 · EE, PL-1436): its rows keep their pre-bonus
  // numbers until each token born on the bonus CELL the step reached has landed — after the step's own rating.
  seedVenusBonusCellHold(currentView(), newView);
  // …and a CELL'S CHOSEN STANDARD RESOURCE (Amazonis Planitia — the cell asked, the answer is the server's record): the
  // row keeps its number until the token born on the cell has landed (another seat's flies to its plaque).
  seedCellResourceHolds(currentView(), newView);
  // …and WHICH CARD REACTED («СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК», TR80 Hartlan Heating): the server's record of every
  // card effect that fired in this response (`cardReactions`). A row a host above holds is the host's answer — its
  // flight asks this module for the reactor; a row nobody holds is held HERE and flown by the reactor's own chain.
  // …and «ОТВЕТ СТОЛА» (TR78 Arwind Inc.): a card of the table answered a walk of the Career with units that LANDED —
  // held on the capsules and DECLARED here, so the reaction seeder below attaches the record to the answer stage the
  // flow that walked the marker opens (the quest's, the sitting's, a card's walk); nobody standing → the chain's own.
  seedTableAnswers(currentView(), newView);
  seedCardReactionHolds(currentView(), newView, railHeldBefore);
  // …and THE SCORE CELL (TR55 — «every point comes from its own cause»), the very LAST: the server's two breakdowns are
  // attributed, what every writer above holds in this block is netted out, a share a host claimed is held for its own
  // token, every other share ticks now with its cause named beside the cell (docs/claude/console/score-cell.md).
  seedVpShares(currentView(), newView);
}

/**
 * THE PRESENTATION OF AN ANSWER — the console cinematic-gate pipeline, then the commit. Each armed transaction
 * detects against the AUTHORITATIVE response (a refused move can never fake a success), HOLDS the commit through its
 * physical scene (`gate` — a bounded child of the submit), and hands its post-commit half to the next tick. Order is
 * load-bearing and documented per gate. The funnel stays busy through every hold (the submit's scope lives), so
 * nothing else can submit while a scene is presenting.
 *
 * Returns how the answer went: `applied` (committed here), `staged` (the MarsBot pipeline commits it with the bot's
 * last turn) or `over` (the submit ended under it — nothing of this answer is applied any more).
 */
async function presentAnswer(submit: LiveSubmit, newView: PlayerViewModel, wgtSubmit: boolean): Promise<'applied' | 'staged' | 'over'> {
  /*
   * The console cinematic-gate pipeline. Each armed transaction
   * detects against the AUTHORITATIVE response (a refused move can
   * never fake a success), HOLDS the commit through its physical
   * scene, and hands its post-commit half to the next tick. Order is
   * load-bearing and documented per gate. `isServerSideRequestInProgress`
   * stays raised through every hold (cleared in `.finally`), so
   * nothing else can submit while a scene is presenting.
   */
  /*
   * Console PLAYED-CARD HERO gate (the "card lands on my tableau"
   * scene). HOLD the commit through the pre-commit half (lift →
   * overlay swap → arc → landing), so the delta chips + the committed
   * tableau land on a card that has PHYSICALLY arrived. Runs BEFORE
   * the bot staging: the bot's turn (which rides this same response)
   * is presented only after the player's own card has landed.
   */
  const playedHeroEvent = detectPlayedHero(newView);
  /*
   * THE PLAY'S CARD PRICE (P86 — PL-1128): a discard the play composer PRE-SELECTED is armed at the press and
   * is the play's PRICE — the server discards it FIRST. So it is detected HERE, before the hero, and its ONE
   * scene (the shared discard transaction — the discard gate below never plays it a second time) starts beside
   * the hero's shipment: the hero lifts once the packet has LEFT the dock (`shipPlayDiscard`), the packet lands
   * on the pile while the card flies. Price before result, no beat of its own.
   */
  const playDiscardEvent = playedHeroEvent !== undefined ? detectCardDiscard(newView) : undefined;
  let playDiscardGate: Promise<boolean> | undefined;
  if (playDiscardEvent !== undefined) {
    playDiscardGate = gate(submit, 'cardDiscard', () => runCardDiscard());
    shipPlayDiscard(cardDiscardDeparted());
  }
  if (playedHeroEvent !== undefined) {
    // The play's RETURN BEAT (Astra Mechanica): work out from the
    // authoritative diff which cards travelled table → hand and
    // withhold them from the dock NOW, so the commit below cannot
    // show them in the pack before they have physically flown there.
    stagePlayedCardReturns(currentView(), newView);
    // The applied view rides along: the shipment beat (the price the play takes off the rail) checks
    // its promise against the diff of the two before it flies — before anything is committed.
    if (!await gate(submit, 'playedHero', () => runPlayedHero(newView, currentView()))) {
      return 'over';
    }
  }
  if (playDiscardGate !== undefined && !await playDiscardGate) {
    return 'over';
  }
  /*
   * Console PATENT-SALE gate (the "cards feed the trade terminal"
   * scene). HOLD the commit until the dispensed M€ chip LANDS on the
   * resource rail — the new counter value + the standard delta chip
   * appear exactly at the touchdown.
   */
  /*
   * Console RESOLUTION-PAYOUT gate (Turmoil Redux). The viewer answered an
   * enacted resolution's card-resource pick and the server RECORDED the
   * payout: HOLD the commit while the chip flies from the stage's payout
   * reading onto the chosen candidate (still on screen — the pick is the
   * standing view), so the stage leaves on a card that has visibly
   * received it. Detected from the authoritative outcome record only.
   */
  const resolutionPayoutEvent = detectResolutionPayout(currentView(), newView);
  if (resolutionPayoutEvent !== undefined) {
    if (!await gate(submit, 'resolutionPayout', () => runResolutionPayout(resolutionPayoutEvent))) {
      return 'over';
    }
  }
  /*
   * Console LIVE-PICK RECEIVE gate (TR53 iteration «ресурс на карту — один стандарт»). The viewer answered a
   * live «on which card» pick (`resourceGainPrompt` — an Ares adjacency, a cell's printed bonus, a foreign
   * trade's colony bonus, a card's gift) and the card really took it: HOLD the commit while the answer plays
   * as a SCENE — the chosen card presented, the token out of its real source (the paying cell, the planet, the
   * source card's printed icon) onto its capsule, the read, the card home — instead of the draft's dive. The
   * field family plays the SERVER's record (`cardAdjacencyPayouts`, `asked`).
   */
  const promptReceiveEvent = detectPromptReceive(currentView(), newView);
  if (promptReceiveEvent !== undefined) {
    if (!await gate(submit, 'promptReceive', () => runPromptReceive(promptReceiveEvent))) {
      return 'over';
    }
  }
  /*
   * Console TABLE-ANSWER LAYOUT gate (TR78 — «ОТВЕТ СТОЛА»): the viewer laid a walk's units out over its holders
   * (the family's distribution, asked by a card of the table) and the server RECORDED the landing: HOLD the commit
   * while the tokens leave the asker's face on the answer stage onto the chosen capsules (the layout is the
   * standing view). Detected from the authoritative reaction record only.
   */
  const tableAnswerEvent = detectTableAnswerPayout(currentView(), newView);
  if (tableAnswerEvent !== undefined) {
    if (!await gate(submit, 'tableAnswer', () => runTableAnswerPayout(tableAnswerEvent))) {
      return 'over';
    }
  }
  const patentSaleEvent = detectPatentSale(newView);
  if (patentSaleEvent !== undefined) {
    if (!await gate(submit, 'patentSale', () => runPatentSale())) {
      return 'over';
    }
  }
  /*
   * Console TERMINAL STANDARD-PROJECT gate. HOLD the commit while the
   * pressed row's gold sweep runs, and release it AT ITS PEAK: the
   * counters and their delta chips then land on the crest of the
   * confirmation, which is the causal order the player reads.
   */
  if (detectStdProjectCommit()) {
    if (!await gate(submit, 'stdProject', () => runStdProjectCommit())) {
      return 'over';
    }
  }
  /*
   * Console CARD-DISCARD gate — the ONE "a card physically leaves the
   * hand" scene every discard ends at. HOLD the commit until the
   * cards have LANDED on the pile; the scene closes the pick surface
   * itself at its hand-off phase, and only then does the shorter hand
   * commit. Runs ABOVE the bot staging on purpose: a discard can be
   * the last thing a turn does, so its response carries the bot's
   * turns, and an early `return` down there would skip everything
   * below it.
   */
  const discardEvent = playDiscardEvent ?? detectCardDiscard(newView);
  if (discardEvent !== undefined && playDiscardEvent === undefined) {
    if (!await gate(submit, 'cardDiscard', () => runCardDiscard())) {
      return 'over';
    }
  }
  /*
   * Console TILE-PLACEMENT HERO gate. VERIFIES the server actually put
   * a tile on the armed space and CAPTURES the cell's printed bonus
   * icons while it is still uncovered. HOLD the commit through the
   * flight + touchdown — the real tile paints silently under the
   * landed proxy via the targeted preview, so the generic tile hold
   * below sees no remaining diff for that space.
   */
  const tileHeroEvent = detectTilePlacement(
    currentView().game?.spaces, newView.game?.spaces,
    {
      aresExtension: currentView().game?.gameOptions?.expansions?.ares === true,
      // The server's own ocean-adjacency breakdown for this response.
      // Accepted only when it names the space we armed — the scene
      // never re-derives board adjacency or the M€ rule.
      oceanBonus: newView.lastOceanBonus,
      // …and its Ares adjacency manifest: WHICH neighbouring tile paid
      // WHAT to WHOM — the adjacency beat's authority, same principle.
      aresGrants: newView.game?.aresAdjacencyGrants,
      viewerColor: newView.thisPlayer?.color,
      // …and what the enacted LAW paid on THIS cell (Development Craze
      // repeats the engine's bonuses, Forestry Support makes the
      // neighbouring groves pay): the law's own wave.
      lawPayout: newView.lastPlacementLawPayout,
      // …and the server's move ring: a MOVE the hero plays claims its
      // own record, so the remote stage can never replay it.
      tileMoves: newView.game?.tileMoves,
      // …and what the MOVE itself paid beyond the cell (TR39: its rating, the
      // table's measured answer) — the landing's own last beats, held to the
      // touchdown and paid in the engine's order; nothing re-derived.
      moveReward: newView.lastTileMoveReward,
      // …and its per-neighbour card payouts (TR21: the data the cities paid onto the chosen
      // card) — the hero plays THIS cell's record and claims it; the card's face comes from the tableau.
      cardPayouts: newView.game?.cardAdjacencyPayouts,
      prevCardPayouts: currentView().game?.cardAdjacencyPayouts,
      viewerCards: newView.thisPlayer?.tableau,
      // …and the viewer's stock in both views: the price a conversion pays off the rail (PL-306) is flown only
      // when its row moved by exactly that price plus what the placement pays back.
      viewerStock: {before: stockReadingOf(currentView().thisPlayer), after: stockReadingOf(newView.thisPlayer)},
      // …and the server's record of what the cell's printed bonus PAID — a multiple (TR79 Ferrus Academy) plays the
      // printed beat once per multiple, never a guessed «×2».
      placements: newView.game?.tilePlacements,
    });
  if (tileHeroEvent !== undefined) {
    if (!await gate(submit, 'tilePlacementHero', () => runTilePlacement(currentView().game.spaces, newView.game.spaces))) {
      return 'over';
    }
  }
  /*
   * Console MARS NOMADS MOVE gate. VERIFIES the server actually moved
   * the camp onto the armed space (the from→to diff) and CAPTURES the
   * destination's printed bonus icons while the displayed board still
   * shows the pre-move state. HOLD the commit through lift + hop +
   * touchdown — the real destination token paints silently under the
   * settled proxy (targeted preview + marker-baseline pre-adoption),
   * so the marker hold below sees no remaining nomad diff.
   */
  const nomadMoveEvent = detectNomadMove(
    currentView().game?.spaces, newView.game?.spaces,
    // …and the server's own ocean-adjacency breakdown for this response:
    // a camp that moves next to water is paid by that water exactly as a
    // build is, so it plays the SAME coin beat (accepted only when the
    // manifest names the destination we armed).
    {oceanBonus: newView.lastOceanBonus});
  if (nomadMoveEvent !== undefined) {
    if (!await gate(submit, 'nomadMove', () => runNomadMove(currentView().game.spaces, newView.game.spaces))) {
      return 'over';
    }
  }
  /*
   * Console COLONY-TRADE launch gate (send a trade fleet to the
   * planet). The ship is already flying to the target berth; HOLD the
   * commit until it DOCKS. Runs BEFORE the bot staging: a trade that
   * ENDS the turn carries the bot's turns in this same response, and
   * the ship must dock — and the trade transaction must claim its
   * manifest — before the bot's story starts.
   */
  const tradeFleetEvent = detectTradeFleet();
  if (tradeFleetEvent !== undefined) {
    if (!await gate(submit, 'tradeFleet', () => runTradeFleet(), {keep: true})) {
      return 'over';
    }
  }
  /*
   * The colony-trade REWARD transaction: CLAIM this response's
   * authoritative trade manifest BEFORE any commit path — claiming
   * freezes the traded colony's track display at its pre-trade
   * position and marks the tradeId, so the reveal batch can never be
   * grabbed by the deck-draw scene, whichever path (gated commit
   * below or the staged bot pipeline) applies the view.
   */
  const colonyTradeEvent = detectColonyTrade(newView);
  /*
   * THE GENERATION SCENE (TR61): the seat's OWN production record on the
   * new view — detected and CLAIMED before either commit path, so a
   * re-fetched view never replays it. The gated path below plays the whole
   * phrase (flip → conversion → income → rise); a STAGED response (fresh
   * bot turns) commits in the closure, so there the flip is the strip's
   * own reaction to the committed view and the income flies after it.
   */
  const generationScene = detectGenerationScene(currentView(), newView);
  // …and the flip a seat's SITTING deferred: owed to the screen at the seat's own close (P89 · EA).
  detectDeferredGenerationFlip(currentView(), newView);
  /*
   * MarsBot turns (the MAIN path — ending your turn is what lets the
   * bot act, so its resolved turn(s) ride THIS response).
   * NOTIFICATION-FIRST with STAGED visual commits: when fresh bot
   * turns arrive, the latest view is NOT committed here — each turn's
   * visual footprint applies to the presented view when its compact
   * card is DELIVERED, and the LAST turn's delivery runs the closure
   * below. The marker/tile/conversion holds are deliberately skipped
   * on a staged response: the bot's tiles animate per turn through
   * the staging itself.
   */
  if (!startSceneHeld() && presentFreshBotTurns(currentView(), newView, {
    commitLatest: () => {
      // Console: the batch's LAST-turn tiles (this closure IS that
      // full commit) land with the premium remote flight — staged in
      // the same synchronous block, committed hidden, revealed at
      // each proxy's touchdown.
      stageRemotePlacements(currentView().game?.spaces, newView.game?.spaces, {
        aresExtension: newView.game?.gameOptions?.expansions?.ares === true,
        gamePhase: newView.game?.phase,
        viewerColor: newView.thisPlayer?.color,
        aresGrants: newView.game?.aresAdjacencyGrants,
        tileMoves: newView.game?.tileMoves,
        cardPayouts: newView.game?.cardAdjacencyPayouts,
        prevCardPayouts: currentView().game?.cardAdjacencyPayouts,
        viewerCards: newView.thisPlayer?.tableau,
        placements: newView.game?.tilePlacements,
        prevPlacements: currentView().game?.tilePlacements,
        players: {before: currentView().players ?? [], after: newView.players ?? []},
      });
      // …and a nomad camp that moved in the batch (a concurrent human's
      // move riding the bot's turns): commit hidden, hop at reveal.
      stageRemoteNomadMove(currentView().game?.spaces, newView.game?.spaces, {
        gamePhase: newView.game?.phase,
      });
      if (shouldHoldForTilePlacement(currentView().game.spaces, newView.game.spaces)) {
        armPlacementAnimations();
      }
      seedRewardHolds(newView);
      applyPlayerView(newView);
      if (generationScene !== undefined) {
        // The staged path has no pre-commit beat: the strip flips off the commit, the income flies after it.
        void nextTick(() => {
          void runGenerationIncomeFlights(() => currentView());
        });
      }
    },
  })) {
    // A staged bot response defers the commit to the bot pipeline —
    // each gate's post-commit half still runs so nothing is left
    // proxy-frozen on screen.
    if (playedHeroEvent !== undefined) {
      void nextTick(() => {
        void endPlayedHero();
      });
    }
    if (patentSaleEvent !== undefined) {
      void nextTick(() => {
        void endPatentSale();
      });
    }
    if (resolutionPayoutEvent !== undefined) {
      void nextTick(() => endResolutionPayout());
    }
    if (promptReceiveEvent !== undefined) {
      void nextTick(() => endPromptReceive());
    }
    if (tableAnswerEvent !== undefined) {
      void nextTick(() => endTableAnswerPayout());
    }
    if (discardEvent !== undefined) {
      void nextTick(() => {
        void endCardDiscard();
      });
    }
    if (tileHeroEvent !== undefined) {
      void nextTick(() => {
        void endTilePlacement();
      });
    }
    if (nomadMoveEvent !== undefined) {
      void nextTick(() => {
        void endNomadMove();
      });
    }
    // …and the docked trade fleet: the ship has landed (the gate
    // above awaited the dock); release the proxy now — the staged
    // pipeline commits the docked board state with the bot's last
    // turn, and the trade-reward transaction (already claimed)
    // continues from that commit via the shell's playerView watcher.
    if (tradeFleetEvent !== undefined) {
      transportHolds.tradeFleet = false;
      void nextTick(() => endTradeFleet());
    }
    return 'staged';
  }
  /*
   * Console REMOTE placements riding the viewer's OWN submit response
   * (a concurrent human's build that resolved while the POST was in
   * flight). Staged BEFORE the generic tile preview below paints
   * them: they commit hidden behind the reveal hold and land with the
   * premium remote flight at their proxy's touchdown. The viewer's
   * own armed placement was already consumed by the tile hero above;
   * hazards are excluded and keep the generic ominous entrance.
   */
  stageRemotePlacements(currentView().game?.spaces, newView.game?.spaces, {
    aresExtension: newView.game?.gameOptions?.expansions?.ares === true,
    gamePhase: newView.game?.phase,
    viewerColor: newView.thisPlayer?.color,
    aresGrants: newView.game?.aresAdjacencyGrants,
    // …and the server's word that a removal + a landing are ONE move (TR14
    // — a parked pin landing, a concurrent human's move): never paired by geometry.
    tileMoves: newView.game?.tileMoves,
    // …and the server's per-neighbour card payouts (TR21 — another seat's cities paying their card).
    cardPayouts: newView.game?.cardAdjacencyPayouts,
    prevCardPayouts: currentView().game?.cardAdjacencyPayouts,
    viewerCards: newView.thisPlayer?.tableau,
    // …and the record of who placed each tile and what the cell paid them (the tile language).
    placements: newView.game?.tilePlacements,
    prevPlacements: currentView().game?.tilePlacements,
    players: {before: currentView().players ?? [], after: newView.players ?? []},
  });
  // …and a REMOTE nomad hop riding the viewer's own submit response (a
  // concurrent human's move that resolved while the POST was in
  // flight). The viewer's own armed move was already consumed by the
  // nomad gate above; an undo restore also lands here (the camp
  // honestly walks back).
  stageRemoteNomadMove(currentView().game?.spaces, newView.game?.spaces, {
    gamePhase: newView.game?.phase,
  });
  const markerHold = wgtSubmit && shouldHoldForMarkerAnimation(newView);
  const tileHold = shouldHoldForTilePlacement(
    currentView().game.spaces,
    newView.game.spaces,
  );
  // An OVERLAY MARKER landed on an existing tile (St. Joseph's
  // cathedral): NOT an `undefined → tile` placement, so neither the
  // generic tile hold above nor the console hero ever fires for it —
  // without this the marker popped in together with the prompt it
  // causes.
  const cathedralHold = shouldHoldForMarkerPlacement(
    currentView().game.spaces,
    newView.game.spaces,
  );
  // Measured NOW — the preview below mutates the displayed spaces, and
  // a duration read after it would see no landed markers left. The diff
  // picks the longest landing this response contains (a nomads first
  // landing outlasts the cathedral's drop).
  const cathedralHoldMs = cathedralHold ? markerPlacementHoldDurationMs(
    currentView().game.spaces, newView.game.spaces) : 0;
  // A PLAYER MARKER claimed an empty cell (Land Claim, an Arcadian
  // community): a colour-only diff — the cube popped in without this.
  // A claim collects NOTHING, so this branch stays a pure landing.
  // …and the markers a LANDING brought (TR79 Ferrus Academy's ring of cubes around its first city) land IN TURN,
  // one by one, after the city and its own cube — never one frame (`landOwnerCubesInTurn`, awaited below).
  // The viewer's OWN ring rides its own city (the hero); a rival's ring was claimed by the remote stage above and
  // lands after the rival's city does.
  const freshOwnerCubes = freshOwnerCubeIds(currentView().game.spaces, newView.game.spaces).length;
  const ownerCubeRing = tileHeroEvent !== undefined && freshOwnerCubes > 0;
  const ownerCubeHold = !ownerCubeRing && shouldHoldForOwnerCubePlacement(
    currentView().game.spaces,
    newView.game.spaces,
  );
  /*
   * Energy→heat conversion hold (end of generation). Detect BEFORE
   * the marker/tile previews mutate the displayed view; claims the
   * dedup key so the poll path doesn't double-fire it.
   */
  const conversionEvent = detectEnergyConversion(currentView(), newView);
  // Building over a hazard zone (erosion / dust storm): play the
  // premium cleanup sequence and hold the follow-up until it ends. (A
  // hazard→tile swap is NOT an `undefined→tile` placement, so the
  // tile-placement hold above never fires for it.)
  const hazardCleanups = detectHazardCleanup(currentView(), newView);
  if (markerHold || tileHold || cathedralHold || ownerCubeHold) {
    if (markerHold) {
      applyGlobalParamPreview(newView);
      transportHolds.marker = true;
    }
    if (tileHold) {
      /*
       * Arm the placement-animation gate BEFORE mutating the
       * displayed spaces — observeTilePlacement on the BoardSpaceTile
       * watcher fires synchronously from Vue's reactivity, so if we
       * arm after the mutation the gate is still closed at the moment
       * the watcher checks it and the animation gets silently
       * skipped. Without this gate the very first render of the board
       * on F5 / direct nav would also animate every existing tile.
       */
      armPlacementAnimations();
      applyTilePlacementPreview(
        currentView().game.spaces,
        newView.game.spaces,
      );
      transportHolds.tilePlacement = true;
    }
    if (cathedralHold) {
      // Arm BEFORE mutating the spaces — same ordering contract as
      // the tile branch above.
      armPlacementAnimations();
      applyMarkerPlacementPreview(
        currentView().game.spaces,
        newView.game.spaces,
      );
      transportHolds.tilePlacement = true;
    }
    if (ownerCubeHold) {
      // Same ordering contract as the two branches above.
      armPlacementAnimations();
      applyOwnerCubePlacementPreview(
        currentView().game.spaces,
        newView.game.spaces,
      );
      transportHolds.tilePlacement = true;
    }
    const holdMs = Math.max(
      markerHold ? motionMs(WGT_MARKER_HOLD_MS) : 0,
      tileHold ? placementHoldDurationMs() : 0,
      // The FULL landing (not the shorter perceptual window): the
      // prompt this marker causes opens strictly after it settles.
      cathedralHoldMs,
      ownerCubeHold ? ownerCubeHoldDurationMs() : 0,
    );
    try {
      await submit.scope.sleep(holdMs);
    } finally {
      transportHolds.marker = false;
      transportHolds.tilePlacement = false;
    }
    if (submit.scope.ended !== undefined) {
      return 'over';
    }
  }
  if (ownerCubeRing) {
    // THE RING (TR79): every fresh cube held hidden with its colour, then set down one by one, clockwise from the
    // top of the city it rings (the hero's own cell when it placed one) — the commit waits for the LAST contact,
    // and the registry knows the scene owns the foreground (the start's completion barrier waits on it too).
    transportHolds.tilePlacement = true;
    const pivotRect = tileHeroEvent !== undefined ? measureBoardHexRect(tileHeroEvent.spaceId) : undefined;
    const centreOf = (id: string) => {
      const r = measureBoardHexRect(id);
      return r === undefined ? undefined : {x: r.x + r.w / 2, y: r.y + r.h / 2};
    };
    const ringLanded = await gate(submit, 'tilePlacement', () =>
      holdAnimationWhile('owner-cube-ring', landOwnerCubesInTurn(currentView().game.spaces, newView.game.spaces, {
        order: (ids) => clockwiseFromTop(ids, centreOf, pivotRect === undefined ? undefined : {x: pivotRect.x + pivotRect.w / 2, y: pivotRect.y + pivotRect.h / 2}),
        wait: (ms) => span(ms),
        scale: motionMs,
      })));
    if (!ringLanded) {
      return 'over';
    }
  }
  if (hazardCleanups.length > 0) {
    transportHolds.hazardCleanup = true;
    // The swap callback fires mid-sequence (after the hazard
    // dissolves) to reveal the new tile on the STILL-DISPLAYED old
    // view; the full view commits below.
    if (!await gate(submit, 'hazardCleanup', () => runHazardCleanup(
      hazardCleanups,
      () => applyHazardTileSwap(currentView().game.spaces, newView.game.spaces, hazardCleanups),
    ), {keep: true})) {
      return 'over';
    }
  }
  /*
   * THE GENERATION SCENE, beat 1 (TR61): the counter FLIPS first — the
   * displayed view's generation is set ahead of the commit (the marker
   * hold's own precedent) and the strip's completion signal releases the
   * beat. The conversion gate below is the scene's second beat.
   */
  if (generationScene !== undefined) {
    if (!await gate(submit, 'generationScene', () => runGenerationFlip(generationScene, currentView()))) {
      return 'over';
    }
    markGenerationConversion();
  }
  if (conversionEvent !== undefined) {
    transportHolds.conversion = true;
    // The override seeds the change-feedback baselines on completion,
    // so committing right after shows the production REMAINDER chips,
    // not the full pre-conversion delta.
    //
    // HANDOFF beat (console): when the conversion was ANSWERED on a
    // console prompt surface (the Supercapacitors amount — the still-
    // displayed old view names it), that surface hides on the sync
    // `active` flip and needs its leave to finish before the visible
    // motion starts. The automatic conversion keeps 0.
    const conversionLeadInMs =
      consoleModeState.enabled && currentWaitingFor()?.type === 'amount' ?
        motionMs(320) : 0;
    if (!await gate(submit, 'conversion', () => runEnergyConversion(conversionEvent, {leadInMs: conversionLeadInMs}), {keep: true})) {
      return 'over';
    }
  }
  /*
   * Console HYDRONETWORK marker-advance gate. The marker is already
   * gliding to the new stop; HOLD the commit until it LOCKS IN.
   * Composed after the other holds (an advance never places a tile /
   * converts energy / trades a colony).
   */
  const hydroMarkerEvent = detectHydroMarker();
  if (hydroMarkerEvent !== undefined) {
    if (!await gate(submit, 'hydroMarker', () => runHydroMarker(), {keep: true})) {
      return 'over';
    }
  }
  /*
   * Console COLONY-BUILD hero gate. VERIFY the viewer's cube landed
   * in the armed colony's next slot + CAPTURE the slot's benefit
   * glyph while it is still rendered. HOLD the commit through the
   * cube drop. A build response never carries fresh bot turns
   * (building doesn't end the turn), so it composes here — never in
   * the staged path.
   */
  /*
   * Console COLONY-ROSTER gate (the player's OWN change of the table —
   * TR10 Fringe Colony, Aridor's first action, the solo setup trim).
   * VERIFY the answer carries the armed change; HOLD the commit while
   * the stage plays it (the leaving planet lets go, the new one
   * docks). Composed BEFORE the build hero: a colony built by the same
   * answer lands on the planet that has just docked.
   */
  const colonyRosterBuilds = colonyRosterState.armed?.builds === true;
  const colonyRosterEvent = detectColonyRosterChange(currentView(), newView);
  if (colonyRosterEvent !== undefined) {
    if (!await gate(submit, 'colonyRoster', () => runColonyRosterCeremony(colonyRosterEvent, colonyRosterBuilds))) {
      return 'over';
    }
  }
  /*
   * Console COLONY-CITY gate (the player's OWN city laid on a colony
   * tile — TR22 Nova City). VERIFY the answer carries exactly the armed
   * tile on the armed colony tile; HOLD the commit while the piece
   * materializes above its seat and descends. The gate opens AT THE
   * FRAME OF CONTACT — the commit applies under the proxy, so every
   * counter a trigger moves ticks after the touch by itself; the cube,
   * the count and the read play past the gate under the scene's own hold.
   */
  const colonyCityEvent = detectColonyCity(currentView(), newView);
  if (colonyCityEvent !== undefined) {
    if (!await gate(submit, 'colonyCity', () => runColonyCity(colonyCityEvent))) {
      return 'over';
    }
  }
  const colonyBuildEvent = detectColonyBuild(currentView(), newView);
  if (colonyBuildEvent !== undefined) {
    if (!await gate(submit, 'colonyBuild', () => runColonyBuild())) {
      return 'over';
    }
  }
  seedRewardHolds(newView);
  applyPlayerView(newView);
  if (resolutionPayoutEvent !== undefined) {
    // Post-commit: the committed view carries the paid count (and has
    // taken the picker away) — the landing tick's scope may close now.
    void nextTick(() => endResolutionPayout());
  }
  if (tableAnswerEvent !== undefined) {
    void nextTick(() => endTableAnswerPayout());
  }
  if (promptReceiveEvent !== undefined) {
    // Post-commit: the pick is gone and the card is home — its seal, its recede and its ticks let go.
    void nextTick(() => endPromptReceive());
  } else {
    // An armed press whose answer did not verify (or did not come with this response) leaves no pose behind.
    disarmPromptReceive();
  }
  if (hazardCleanups.length > 0) {
    transportHolds.hazardCleanup = false;
    void nextTick(() => endHazardCleanup());
  }
  if (conversionEvent !== undefined) {
    transportHolds.conversion = false;
    // Clear the panel override on the next tick — AFTER the committed
    // panel reads the canonical final values and fires the seeded
    // production chips — so there's no value flash.
    void nextTick(() => endEnergyConversion());
  }
  if (generationScene !== undefined) {
    // Beat 3 — the income FLIES after the commit (the real values stand under the held rows), then the scene
    // concludes (beat 4: the research rises). After the conversion's own end, in the same tick order.
    void nextTick(() => {
      void runGenerationIncomeFlights(() => currentView());
    });
  }
  if (tradeFleetEvent !== undefined) {
    transportHolds.tradeFleet = false;
    // Hand the flight off AFTER the commit: the real docked ship just
    // materialized under the (gone) proxy — end on the next tick so
    // it gets the one-shot settle glow + the composer closes.
    void nextTick(() => endTradeFleet());
  }
  if (colonyTradeEvent !== undefined) {
    // The reward waves start only now — the ship has docked, the view
    // committed (metrics held, track frozen): the trade income
    // physically leaves the «ТОРГОВАТЬ» cell, then the own colony
    // bonuses leave «БОНУС»; drawn cards ride the staged reveal and
    // the track reset glide follows the last confirmation.
    void nextTick(() => {
      void runColonyTradeRewards();
    });
  }
  if (hydroMarkerEvent !== undefined) {
    transportHolds.hydroMarker = false;
    // Hand the advance off AFTER the commit: the real marker just
    // materialized on the new stop under the locked proxy.
    void nextTick(() => endHydroMarker());
  }
  if (colonyBuildEvent !== undefined) {
    // Post-commit handoff: the real filled-cell cube just painted
    // pixel-identical under the settled proxy — remove the proxy in
    // one frame + absorb the resting resource chip.
    void nextTick(() => {
      void endColonyBuild();
    });
  }
  if (playedHeroEvent !== undefined) {
    // Post-commit half of the hero scene: the real slot just painted
    // under the proxy (identical geometry) — reveal, dissolve the
    // proxy, play the result beat, close the system-opened table.
    void nextTick(() => {
      void endPlayedHero();
    });
  }
  if (patentSaleEvent !== undefined) {
    // Post-commit settle: absorb the chip into the row (one-shot
    // halo) and retract the terminal.
    void nextTick(() => {
      void endPatentSale();
    });
  }
  if (discardEvent !== undefined) {
    // Post-commit half of the discard: hold the pile's
    // acknowledgement for a beat, then withdraw the tray.
    void nextTick(() => {
      void endCardDiscard();
    });
  }
  if (tileHeroEvent !== undefined) {
    // The REWARD BEAT of the placement: the cell's printed icons rise
    // through the placed tile, become physical chips and pay out —
    // then a STAGED play's own card gains fly from the same tile
    // (the card-seal wave; no-op unless a staged commit armed one).
    void nextTick(() => {
      void endTilePlacement().then(() => runStagedSealWave());
    });
  } else if (stagedSealPending()) {
    // A staged commit whose placement hero degraded (a parked space
    // tail, an unmeasurable board) still owes the card's gains — the
    // wave itself degrades honestly when the hex can't be measured.
    void nextTick(() => {
      void runStagedSealWave();
    });
  }
  if (nomadMoveEvent !== undefined) {
    // The REWARD + RESTORE beats of the move: the displaced icons
    // become physical chips and pay out, then the cell's printed
    // bonuses materialize back — the field is not exhausted.
    void nextTick(() => {
      void endNomadMove();
    });
  }
  return 'applied';
}

let presenter: typeof presentAnswer = presentAnswer;

function fetchPlayerInput(url: string, options: RequestInit, wgtSubmit: boolean): SubmitTicket {
  const r = theRoot();
  const standing = liveSubmit.value;
  if (standing !== undefined) {
    // THE FUNNEL IS BUSY — the press is REFUSED and the caller holds the refusal (inventory R11: it used to be this
    // console line and nothing else, with whatever the caller had armed for the press left standing).
    transportState.refusedWhileBusy++;
    console.warn(`[transport] submit refused — ${standing.scope.id} is ${String(standing.flow.snapshot.value.value)} for ` +
      `${Math.round((Date.now() - transportState.requestSince) / 1000)}s (server request in progress)`);
    const refused: SubmitTicket = {accepted: false, id: '', reason: 'busy', settled: Promise.resolve({id: '', status: 'rejected'})};
    announceSubmitTicket(refused);
    return refused;
  }
  // The player ACTED — playing on is an implicit acknowledgement of any
  // still-visible flow-holding card (the compact AI-turn notification), so
  // the follow-up prompt of THIS submit is never held behind it.
  acknowledgeFlowHoldingCards();

  const scope = transportScope().open('submit');
  const flow = startFlowActor(scope, submitMachine, {endScopeOnDone: false});
  const request = typeof AbortController === 'function' ? new AbortController() : undefined;
  const submit: LiveSubmit = {scope, flow, gates: new Set()};
  liveSubmit.value = submit;
  r.isServerSideRequestInProgress = true;
  transportState.requestInProgress = true;
  transportState.requestSince = Date.now();
  transportState.responseArrived = false;
  transportState.phase = 'sending';
  let settle: (result: SubmitSettle) => void = () => {};
  const settled = new Promise<SubmitSettle>((resolve) => {
    settle = resolve;
  });
  // THE FUNNEL REOPENS — once, on every way a submit ends: the scope's end is the old `.finally`, and it can no longer
  // be skipped by a chain that never comes back.
  scope.defer(() => {
    if (liveSubmit.value === submit) {
      liveSubmit.value = undefined;
    }
    r.isServerSideRequestInProgress = false;
    transportState.requestInProgress = false;
    transportState.phase = 'idle';
    const result: SubmitSettle = {id: scope.id, status: submitStatusOf(flow)};
    settle(result);
    for (const listener of [...settleListeners]) {
      try {
        listener(result);
      } catch (error) {
        console.warn('[transport] a settle listener threw', error);
      }
    }
    /*
     * ⚠️ RE-ASK THE SERVER THE MOMENT THIS SUBMIT IS FULLY PROCESSED.
     *
     * A turn-ending submit's commit is HELD through its own cinematic
     * (`runPlayedHero` and friends), and the world moves DURING
     * that hold: the bot's paced turn resolves ~200 ms in and its
     * GAME_STATE_INVALIDATED wake fires `/api/waitingfor` while the
     * current waitingFor still reads the OLD prompt — so the GO is
     * skipped as «viewer mid-input» and the one wake is consumed for
     * nothing. With a healthy WS the next fallback poll is ~20 s away:
     * measured 21.4 s from the play's confirm to control back, with the
     * screen free at 3.8 s.
     *
     * A skipped refresh is a DEBT. The submit's processing end is the one
     * moment the staleness is guaranteed gone (the commit either landed
     * or was refused), so the guarded check re-runs HERE — the viewer-
     * mid-prompt guard then reads fresh state and the GO is honoured. On
     * an ordinary submit (the response carried the next prompt) the
     * re-check costs one WAIT round trip and changes nothing.
     */
    waitForUpdate(true);
  });
  flow.actor.subscribe((snapshot) => {
    if (snapshot.value === 'presenting') {
      transportState.phase = 'presenting';
    } else if (snapshot.value === 'silent') {
      // THE SERVER'S SILENCE (the `sending` state's bound): only the silence before the server's answer — the request
      // is cancelled, its `catch` says so in so many words and re-fetches.
      console.warn(`[transport] the server did not answer the submit for ${Math.round((Date.now() - transportState.requestSince) / 1000)}s — the request is cancelled, the state re-fetched`);
      request?.abort();
    } else if (snapshot.value === 'abandoned' && scope.ended === undefined) {
      // The presentation never ended and no gate was standing to release: the submit is over. Whatever hangs can no
      // longer apply anything (`presentAnswer` stops at its next step); the funnel reopens and the truth is re-fetched.
      console.warn(`[transport] ${scope.id} abandoned — its presentation never ended; the funnel reopens, the state is re-fetched`);
      for (const key of Object.keys(transportHolds) as Array<keyof typeof transportHolds>) {
        transportHolds[key] = false;
      }
      scope.end({how: 'expired', bound: 'its presentation never ended'});
      r.updatePlayer();
    }
  });
  fetch(url, request === undefined ? options : {...options, signal: request.signal})
    .then(async (response) => {
      transportState.responseArrived = true;
      if (response.ok) {
        // THE SERVER SPOKE: the bound of its silence stands down, the presentation's own begins.
        flow.send({type: 'ANSWERED'});
        const newView = await response.json() as PlayerViewModel;
        if (scope.ended !== undefined) {
          return;
        }
        const outcome = await presenter(submit, newView, wgtSubmit);
        if (outcome === 'applied') {
          flow.send({type: 'PRESENTED'});
        } else if (outcome === 'staged') {
          flow.send({type: 'STAGED'});
        }
        return;
      }

      flow.send({type: 'REFUSED'});
      // A rejected submit (bad request / unexpected) must RECALL every armed
      // console transaction immediately (else it hovers until the safety) —
      // the action did not happen. No-op when none armed.
      abortAllConsoleTransactions();
      const showAlert = r.showAlert.bind(r);
      if (response.status === statusCode.badRequest) {
        const resp = await response.json() as AppErrorResponse;
        let cb = () => {};
        if (resp.id === INVALID_RUN_ID) {
          // The page REPLACES itself — said out loud first (the e2e harness's `productReloadGuard` names a reload the
          // product made on its own: every page-side witness of the run went with the old document).
          cb = () => {
            console.warn('[transport] reload — INVALID_RUN_ID: the server game is a different run than this page\'s');
            consoleAppScope().guarantee(100, 'the reload after INVALID_RUN_ID', () => window.location.reload());
          };
        }
        if (resp.id === STALE_PROMPT) {
          /*
           * The submit answered a prompt the server has since REPLACED (a
           * reloaded game rebuilt its action menu, an undo, a bot turn). The
           * poll chain deliberately never refreshes while the viewer shows a
           * prompt («mid-input»), so WITHOUT this forced refetch the stale
           * view stands forever and every retry fails the same way — the
           * original unrecoverable form of this bug. Refresh NOW, not in the
           * alert's OK callback: the healing must not depend on the player
           * pressing anything.
           */
          r.updatePlayer();
        }
        showAlert('Error with input', resp.message, cb);
      } else {
        showAlert('Error processing response', 'Unexpected response from server. Please try again.');
        console.error(response.statusText);
      }
    })
    .catch((e) => {
      if (scope.ended !== undefined) {
        // The submit was already over (abandoned, the transport stopped) — what its chain threw afterwards is said,
        // and unwinds nothing: the transactions on screen may be a later submit's.
        console.warn(`[transport] ${scope.id} threw after its end`, e);
        return;
      }
      const silent = flow.snapshot.value.value === 'silent';
      flow.send({type: 'FAILED'});
      // Network failure — same full unwind as a refusal: no ghost card, no
      // ghost cube, no gold, no credit; every composer CTA re-arms.
      abortAllConsoleTransactions();
      if (silent) {
        // THE SERVER NEVER ANSWERED: say exactly that, and let the next view tell whether the move landed anyway.
        r.showAlert(SERVER_NOT_RESPONDING_TITLE, SERVER_NOT_RESPONDING, () => waitForUpdate(true));
        r.updatePlayer();
        return;
      }
      r.showAlert('Error sending input,', CANNOT_CONTACT_SERVER);
      console.error(e);
    })
    .finally(() => scope.end());
  const ticket: SubmitTicket = {accepted: true, id: scope.id, settled};
  announceSubmitTicket(ticket);
  return ticket;
}

/** The full refusal/network unwind battery — every armed console
 *  transaction recalls cleanly, in the documented order. */
function abortAllConsoleTransactions(): void {
  transportHolds.tradeFleet = false;
  abortTradeFleet();
  abortColonyTrade(); // …and the whole trade-reward transaction with it
  transportHolds.hydroMarker = false;
  abortHydroMarker();
  rollbackHydroCommit(); // the refused advance did not happen — the draft returns
  abortBoardCardBonus('return');
  // …and the played-card hero: the play did NOT happen — the armed
  // transaction unwinds with zero visual trace (the composer stays open,
  // its CTA re-arms via the shell's 'failed' watcher).
  transportHolds.playedHero = false;
  abortPlayedHero();
  // …and the resolution payout: nothing was recorded, nothing flies.
  transportHolds.resolutionPayout = false;
  endResolutionPayout();
  // …and a walk's layout answered on the answer stage (TR78): the same.
  transportHolds.tableAnswer = false;
  endTableAnswerPayout();
  // …and a live pick's answer: the server refused it — the candidates stand as they were (no seal, no recede).
  transportHolds.promptReceive = false;
  disarmPromptReceive();
  // …and the patent sale: the terminal swallows nothing — the cards return
  // to the hand (un-blanked) and no chip is ever dispensed.
  transportHolds.patentSale = false;
  abortPatentSale();
  // …and the terminal standard project: the press pose unwinds, the gold
  // NEVER plays and nothing is credited.
  transportHolds.stdProject = false;
  abortStdProjectCommit();
  // …and the card discard: the server kept the cards — nothing is seized.
  transportHolds.cardDiscard = false;
  abortCardDiscard();
  // …and the tile-placement hero: no tile flies, no bonus is collected.
  transportHolds.tilePlacementHero = false;
  abortTilePlacement();
  // …and the two-phase placement flow: the refused commit returns the player
  // to their LOCKED cell (context intact) and re-arms the board wiring the
  // submit funnel tore down. No-op unless a placement commit was in flight.
  rollbackPlacementCommit();
  // …and a STAGED play's commit: the batch never landed, so the staged play
  // is simply «not yet sent» again — still cancellable, still retryable.
  abortStagedPlayCommit();
  // …and a chosen colony track's move (TR07): the answer was refused, nothing moved — no promise, no hold.
  clearColonyTrackMove();
  // …and a colony ROSTER change (TR10, Aridor, the solo trim): the answer was refused — no arm, no ceremony; the
  // draft of the leaving tile stays (the player is still choosing).
  transportHolds.colonyRoster = false;
  disarmColonyRoster();
  // …and a city on a colony tile (TR22): the answer was refused — no arm, no landing, the door stands as it was.
  transportHolds.colonyCity = false;
  disarmColonyCity();
  // …and the nomad move: the camp never lifts off, nothing is collected.
  transportHolds.nomadMove = false;
  abortNomadMove();
  // …and the colony-build hero: no cube drops, no bonus is collected.
  transportHolds.colonyBuild = false;
  abortColonyBuild();
  // …and the blue-action COMMIT: the activation was rejected — the beat
  // tears down, the composer's CTA unlocks (abortNonce), the captures stay.
  abortConsoleActionCommit();
  // …and the ledger payout that press armed (TR23): the activation never happened — nothing is owed, nothing is held.
  resetColonyBonusPayout();
  abortBotAttackCommit(); // …and the MarsBot attack — the commit row re-opens
  abortStartTender(); // …and a campaign tender answered from the start's «НАСЛЕДИЕ» stage: the busy instance, the opening restructuring and the armed pick restore let go
  clearDecisionPickAnswered(); // …and an album that IS a decision: the answer was refused, the album re-opens
}

/** Apply a fresh view: structural sharing + the transient-UI reset epoch. */
function applyPlayerView(playerView: PlayerViewModel | undefined): void {
  const r = theRoot();
  // Structural sharing (viewSnapshotShare.ts): keep unchanged branches'
  // references so child components skip re-rendering; the root identity
  // still changes (watcher-identical to a wholesale swap).
  if (playerView !== undefined) {
    playerView = nextViewSnapshot(r.playerView as PlayerViewModel, playerView);
    // A question the last batch already answered must never stand again (the pre-select law's witness) — and a
    // choice the commit should have collected must never be asked after it («strictly pre-select», TR51).
    checkPreselectReask(playerView.waitingFor);
    checkPostCommitChoice(playerView.waitingFor);
    // A player idle again (no prompt / the action menu) ends the decision chain (`promptSequence.ts`).
    notePromptView(playerView.waitingFor);
  }
  // The card-pick preserve guards: they gate the playerkey RESET EPOCH
  // (transient console/App state), not a remount.
  if (shouldPreserveCardPickModal(playerView) || shouldPreserveInitialDraftOverlay(playerView) || shouldPreserveSaleOverlay()) {
    r.playerView = playerView as ViewModel;
  } else {
    r.playerView = playerView as ViewModel;
    // Bump the transient-UI reset epoch (the former remount trigger).
    r.playerkey++;
  }
}

/**
 * (Re-)arm the guarded update check. `immediate` fires it NOW — used by the
 * visibility/focus wakes, the realtime (WS) wake and the post-submit re-ask;
 * otherwise the chain re-arms on the poll interval (stretched while the WS
 * is strictly healthy — see realtimePollIntervalMs).
 */
export function waitForUpdate(immediate = false): void {
  // The transport has stopped (left the game screen) — do NOT re-arm.
  if (pollStopped || root === undefined) {
    return;
  }
  // No view on the root yet (a unit-test root, or a start racing the boot
  // fetch) — the chain has nothing to compare against; the binder re-starts
  // the transport when a real view exists.
  if ((root.playerView as PlayerViewModel | undefined)?.game === undefined) {
    return;
  }
  const r = theRoot();
  disarmPoll();
  // The game is over — there is nothing left to poll for. Stopping the chain
  // here keeps the board from being re-fetched every tick after END; the
  // endgame screen already holds the final view.
  if (currentView().game.phase === Phase.END) {
    return;
  }
  const askForUpdate = () => {
    // Re-check at fire time: the phase can flip to END while this poll's
    // timer is pending (another player's action ended the game), so bail
    // without re-arming rather than firing one last needless refresh.
    if (pollStopped || root === undefined || currentView().game.phase === Phase.END) {
      return;
    }
    const xhr = new XMLHttpRequest();
    // The DISPLAYED prompt rides along (`promptId`): a prompt swapped under the page with no game-age move (the research
    // phase; an answer over another channel) is a change the server can only see if told what the page shows.
    const shownPrompt = currentWaitingFor()?.promptId;
    xhr.open('GET', apiUrl(paths.API_WAITING_FOR) + identitySearch() + '&gameAge=' + currentView().game.gameAge + '&undoCount=' + currentView().game.undoCount +
      (shownPrompt !== undefined ? '&promptId=' + shownPrompt : ''));
    // ⚠️ THE CHAIN'S LIVENESS RIDES THIS ONE REQUEST. The re-arm lives in
    // onload/onerror — with no timeout, a request that neither answers nor
    // fails (a half-dead LAN host: the WS flapping while TCP quietly hangs)
    // freezes the WHOLE chain for the OS's own give-up horizon: no
    // `playersWaitingFor` bubbles (the status chips show a stale actor on
    // every screen at the table), no GO (the viewer's own prompt arrives
    // minutes late). The answer itself is instant server-side (GO/REFRESH/
    // WAIT — the «long poll» is the client-side INTERVAL), so a bounded
    // timeout is pure liveness. Quiet retry, never an alert: a poll timeout
    // is a network hiccup, and the next cycle is the retry.
    xhr.timeout = POLL_XHR_TIMEOUT_MS;
    xhr.ontimeout = () => {
      // Immediate retry: the link just proved unhealthy, so the stretched
      // WS-healthy interval must not add its 20 s on top of the 15 lost.
      // One request is in flight at a time, so this can never stampede.
      waitForUpdate(true);
    };
    xhr.onerror = function() {
      r.showAlert('Error fetching state', CANNOT_CONTACT_SERVER, () => waitForUpdate());
    };
    xhr.onload = () => {
      if (pollStopped || root === undefined) {
        return;
      }
      if (xhr.status === statusCode.ok) {
        const result = xhr.response as WaitingForModel;
        // Bubble the live "who's currently being waited on" list to the
        // root so siblings (status strip pills, cubes) can react to it
        // without doing a full playerView refresh.
        transportState.playersWaitingFor = result.waitingFor;
        r.playersWaitingFor = result.waitingFor;

        // While the viewer is mid-prompt a full refresh would reset their
        // partial input state (selected cards, etc.). Skip it — the bubbled
        // list above is enough to keep other players' status in sync.
        //
        // EXCEPTION: an OPTIONAL prompt (draft re-pick, upstream #8151) is
        // NOT real mid-input — this fork suppresses its UI and shows the
        // waiting view, so there is no partial input to protect. It MUST
        // count as "no prompt" here, otherwise when the server clears the
        // optional re-pick and hands the viewer their next REQUIRED prompt
        // (the next draft set), the 'GO' below is skipped and the player is
        // stuck on the waiting view forever — a draft deadlock.
        const wf = currentWaitingFor();
        const viewerHasPrompt = wf !== undefined && wf.optional !== true;
        /*
         * MID-PROMPT REFRESH (mechanism A of presentation-reconciliation).
         * Historically a GO/REFRESH landing while the viewer held a prompt
         * was DROPPED — so for as long as a player aimed a tile placement,
         * no remote change reached them at all (another player's tile stayed
         * invisible, the scales stale), the WS wake was consumed for
         * nothing, and the world arrived up to LONG_POLL_MS late. Now the
         * refresh APPLIES: `App.update`'s prompt-preserving epoch rule keeps
         * partial input alive when the fetched view carries the SAME
         * `promptId` (the ordinary case — the viewer's prompt object stood
         * untouched on the server), and a CHANGED promptId applies with the
         * ordinary reset epoch, which is exactly what the STALE_PROMPT
         * healing would have done one failed submit later.
         *
         * Guards: only on a real change (the server's own `changed` cursor
         * bit — GO answers on every poll, so without it this would re-fetch
         * once per interval), never while this client's own submit is in
         * flight (the response's cinematic diffs must see the view they were
         * armed against), and behind the `?midpromptrefresh=0` kill switch.
         */
        const midPromptRefresh = viewerHasPrompt &&
          midPromptRefreshEnabled() &&
          !r.isServerSideRequestInProgress &&
          (result.changed === true || serverAheadOfView(currentView().game));

        if (result.result === 'GO') {
          if (!viewerHasPrompt) {
            // Their prompt just appeared — fetch the new view.
            r.updatePlayer();
            notifyTurn();
          } else if (midPromptRefresh) {
            r.updatePlayer();
          }
        } else if (result.result === 'REFRESH') {
          if (!viewerHasPrompt || midPromptRefresh) {
            // Game advanced — refresh. Off-prompt this is the historical
            // path; mid-prompt it rides the prompt-preserving apply.
            r.updatePlayer();
          }
        }
        /*
         * ALWAYS keep polling — whichever path `updatePlayer` takes, this
         * chain stays the one live poller (a re-arm clears the pending
         * timer, so only one chain runs at a time).
         */
        waitForUpdate();
      } else {
        r.showAlert('Error with input', `Received unexpected response from server (${xhr.status}). This is often due to the server restarting.`, () => waitForUpdate());
      }
    };
    xhr.responseType = 'json';
    xhr.send();
  };
  if (immediate) {
    // Poll RIGHT NOW instead of after the interval. Used when the tab
    // regains visibility/focus, on a WS wake, and after a submit fully
    // processes: the background-throttled timer may be far out (or frozen),
    // so we fetch current state the instant it matters. askForUpdate
    // re-arms the normal chain when it returns.
    askForUpdate();
  } else {
    // Stretch the poll to a long safety-net interval while the WS is
    // strictly healthy (and reduction is enabled); otherwise the safe
    // `waitingForTimeout`. Re-evaluated every re-arm, and a WS drop wakes
    // an immediate re-arm so we fall back to the safe interval fast.
    disarmPoll = transportScope().guarantee(realtimePollIntervalMs(raw_settings.waitingForTimeout), 'the poll\'s next look', askForUpdate);
  }
}

function notifyTurn(): void {
  if (getPreferences().enable_sounds) {
    SoundManager.playActivePlayerSound();
  }

  if (Notification.permission !== 'granted') {
    Notification.requestPermission();
  } else if (Notification.permission === 'granted') {
    const notificationOptions = {
      icon: 'favicon.ico',
      body: 'It\'s your turn!',
    };
    const notificationTitle = constants.APP_NAME;
    try {
      new Notification(notificationTitle, notificationOptions);
    } catch (e) {
      // The native Notification doesn't work (some platforms) — try the
      // service worker.
      if (!window.isSecureContext || !navigator.serviceWorker) {
        return;
      }
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(notificationTitle, notificationOptions);
      }).catch((err) => {
        // avoid promise going uncaught
        console.warn('Failed to display notification with serviceWorker', err);
      });
    }
  }
}

/** Test-only: reset module state between specs. */
export function __resetGameTransportForTesting(): void {
  stopGameTransport();
  presenter = presentAnswer;
  settleListeners.clear();
  transportState.phase = 'idle';
  transportState.requestInProgress = false;
  transportState.responseArrived = false;
  transportState.refusedWhileBusy = 0;
  transportState.playersWaitingFor = [];
  for (const key of Object.keys(transportHolds) as Array<keyof typeof transportHolds>) {
    transportHolds[key] = false;
  }
}

/** Test-only: replace the presentation of an answer (the gate pipeline needs a whole game on screen); `undefined` puts
 *  the real one back. The fake gets the real `gate` so a spec can play a scene of its own as a bounded child. */
export function __setTransportPresenterForTesting(
  fake: ((newView: PlayerViewModel, gateOf: (hold: keyof typeof transportHolds, run: () => unknown, options?: {keep?: boolean}) => Promise<boolean>) => Promise<'applied' | 'staged' | 'over'>) | undefined,
): void {
  presenter = fake === undefined ? presentAnswer : (submit, newView) => fake(newView, (hold, run, options) => gate(submit, hold, run, options));
}
