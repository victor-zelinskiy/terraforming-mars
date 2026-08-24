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
 *      cleanly on a refusal/network failure.
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

import {reactive, nextTick} from 'vue';
import * as constants from '@/common/constants';
import raw_settings from '@/genfiles/settings.json';
import {onRealtimeWake} from '@/client/components/realtime/realtimeSync';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {apiUrl, identitySearch} from '@/client/utils/runtimeConfig';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {SoundManager} from '@/client/utils/SoundManager';
import {WaitingForModel} from '@/common/models/WaitingForModel';
import {Phase} from '@/common/Phase';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {InputResponse} from '@/common/inputs/InputResponse';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
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
  ownerCubeHoldDurationMs,
  shouldHoldForOwnerCubePlacement,
} from '@/client/components/board/cubeDropState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {nextViewSnapshot} from '@/client/utils/viewSnapshotShare';
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
} from '@/client/console/colonyFleet/consoleTradeFleet';
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
  seedPlayedHeroRewardHold,
} from '@/client/console/played/consolePlayedHero';
import {stagePlayedCardReturns} from '@/client/console/played/playedCardReturn';
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
} from '@/client/console/patentSale/consolePatentSale';
import {
  abortStdProjectCommit,
  detectStdProjectCommit,
  runStdProjectCommit,
} from '@/client/console/consoleStdProjectCommit';
import {
  abortCardDiscard,
  detectCardDiscard,
  endCardDiscard,
  runCardDiscard,
} from '@/client/console/cardDiscard/consoleCardDiscard';
import {
  abortTilePlacement,
  detectTilePlacement,
  endTilePlacement,
  runTilePlacement,
  seedTilePlacementRewardHold,
} from '@/client/console/tilePlacement/consoleTilePlacement';
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
import {abortBotAttackCommit} from '@/client/console/botAttack/botAttackState';
import {presentFreshBotTurns} from '@/client/components/marsbot/marsBotPresentation';
// The GAME START WORKSPACE holds the deployment across prompt gaps. While it
// does, a submit's response must COMMIT INLINE: the staged-bot pipeline
// defers the commit to notification deliveries the start scene suppresses —
// the view then only advances via the poll, seconds late, and every armed
// hero (the corporation / prelude landing) times out into a TELEPORT. The
// bot's setup turns present normally with the first post-start response.
import {startSceneHeld} from '@/client/console/consoleStartState';
import {acknowledgeFlowHoldingCards} from '@/client/components/notifications/notificationState';
import {
  applyHazardTileSwap,
  detectHazardCleanup,
  endHazardCleanup,
  runHazardCleanup,
} from '@/client/components/feedback/hazardCleanupTransition';

const WGT_TITLE = 'Select action for World Government Terraforming';

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

// The spinning ◑◒◐◓ symbol used to indicate it's your turn.
const TURN_SEQUENCE = '◑◒◐◓';

// On a desktop browser the favicon is visible in the tab, so we spin it there
// rather than cluttering the document title. Mobile browsers don't show tab
// favicons, so they keep animating the title instead.
function isDesktopBrowser(): boolean {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function titleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) {
    return undefined;
  }
  return typeof title === 'string' ? title : title.message;
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
});

/** Every transport cinematic gate — the disjunction the board binder (and any
 *  other admission reader) suppresses on. The console placement admission
 *  hold composes at the READER (it is a prompt-admission fact, not a
 *  transport hold). */
export function transportHolding(): boolean {
  const h = transportHolds;
  return h.marker || h.tilePlacement || h.conversion || h.hazardCleanup ||
    h.tradeFleet || h.hydroMarker || h.playedHero || h.patentSale ||
    h.stdProject || h.cardDiscard || h.tilePlacementHero || h.colonyBuild;
}

/** Reactive transport facts surfaces may read (never write). */
export const transportState = reactive({
  playersWaitingFor: [] as Array<Color>,
});

let root: TransportRoot | undefined;
let ui_update_timeout_id: number | undefined;
let documentTitleTimer: number | undefined;
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
}

/** Stop the transport (leaving the game screen / END). Detaches everything. */
export function stopGameTransport(): void {
  if (onVisibilityChange !== undefined) {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onVisibilityChange);
    onVisibilityChange = undefined;
  }
  if (realtimeWakeOff !== undefined) {
    realtimeWakeOff();
    realtimeWakeOff = undefined;
  }
  window.clearInterval(documentTitleTimer);
  pollStopped = true;
  window.clearTimeout(ui_update_timeout_id);
  ui_update_timeout_id = undefined;
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
  window.clearInterval(documentTitleTimer);
  if (currentView().players.length > 1 && hasRequiredPrompt) {
    documentTitleTimer = window.setInterval(() => animateTitle(), 1000);
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
export function submitInput(out: InputResponse): void {
  /*
   * Capture whether the prompt the player is currently submitting is the WGT
   * OrOptions BEFORE we hand off to fetch — by the time the response
   * arrives, the current waitingFor may already have been replaced (rare,
   * but defensive).
   */
  const wgtSubmit = currentPromptIsWGT();
  fetchPlayerInput(
    apiUrl(paths.PLAYER_INPUT) + '?id=' + currentView().id,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({runId: currentView().runId, ...out}),
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
 */
export function submitBatch(responses: ReadonlyArray<InputResponse>): void {
  fetchPlayerInput(
    apiUrl(paths.PLAYER_INPUT_BATCH) + '?id=' + currentView().id,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({runId: currentView().runId, responses}),
    },
    false);
}

/** Cancel a pending, cancellable tile placement (a pay-on-commit standard
 *  project). Submits a CancelResponse; the server discards the placement
 *  without charging and returns the player to the action menu. */
export function cancelPlacement(): void {
  submitInput({type: 'cancel'});
}

function currentPromptIsWGT(): boolean {
  const wf = currentWaitingFor();
  if (wf === undefined || wf.type !== 'or') {
    return false;
  }
  return titleText(wf.title) === WGT_TITLE;
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
function seedRewardHolds(): void {
  seedPlayedHeroRewardHold();
  seedTilePlacementRewardHold();
  seedColonyBuildRewardHold();
  seedColonyTradeRewardHold();
  seedHydroMarkerRewardHold();
}

function fetchPlayerInput(url: string, options: RequestInit, wgtSubmit: boolean): void {
  const r = theRoot();
  if (r.isServerSideRequestInProgress) {
    console.warn('Server request in progress');
    return;
  }
  // The player ACTED — playing on is an implicit acknowledgement of any
  // still-visible flow-holding card (the compact AI-turn notification), so
  // the follow-up prompt of THIS submit is never held behind it.
  acknowledgeFlowHoldingCards();

  r.isServerSideRequestInProgress = true;
  fetch(url, options)
    .then(async (response) => {
      if (response.ok) {
        const newView = await response.json() as PlayerViewModel;
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
        if (playedHeroEvent !== undefined) {
          // The play's RETURN BEAT (Astra Mechanica): work out from the
          // authoritative diff which cards travelled table → hand and
          // withhold them from the dock NOW, so the commit below cannot
          // show them in the pack before they have physically flown there.
          stagePlayedCardReturns(currentView(), newView);
          transportHolds.playedHero = true;
          try {
            await runPlayedHero(newView);
          } finally {
            transportHolds.playedHero = false;
          }
        }
        /*
         * Console PATENT-SALE gate (the "cards feed the trade terminal"
         * scene). HOLD the commit until the dispensed M€ chip LANDS on the
         * resource rail — the new counter value + the standard delta chip
         * appear exactly at the touchdown.
         */
        const patentSaleEvent = detectPatentSale(newView);
        if (patentSaleEvent !== undefined) {
          transportHolds.patentSale = true;
          try {
            await runPatentSale();
          } finally {
            transportHolds.patentSale = false;
          }
        }
        /*
         * Console TERMINAL STANDARD-PROJECT gate. HOLD the commit while the
         * pressed row's gold sweep runs, and release it AT ITS PEAK: the
         * counters and their delta chips then land on the crest of the
         * confirmation, which is the causal order the player reads.
         */
        if (detectStdProjectCommit()) {
          transportHolds.stdProject = true;
          try {
            await runStdProjectCommit();
          } finally {
            transportHolds.stdProject = false;
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
        const discardEvent = detectCardDiscard(newView);
        if (discardEvent !== undefined) {
          transportHolds.cardDiscard = true;
          try {
            await runCardDiscard();
          } finally {
            transportHolds.cardDiscard = false;
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
          });
        if (tileHeroEvent !== undefined) {
          transportHolds.tilePlacementHero = true;
          try {
            await runTilePlacement(currentView().game.spaces, newView.game.spaces);
          } finally {
            transportHolds.tilePlacementHero = false;
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
          transportHolds.tradeFleet = true;
          await runTradeFleet();
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
            });
            if (shouldHoldForTilePlacement(currentView().game.spaces, newView.game.spaces)) {
              armPlacementAnimations();
            }
            seedRewardHolds();
            applyPlayerView(newView);
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
          // …and the docked trade fleet: the ship has landed (the gate
          // above awaited the dock); release the proxy now — the staged
          // pipeline commits the docked board state with the bot's last
          // turn, and the trade-reward transaction (already claimed)
          // continues from that commit via the shell's playerView watcher.
          if (tradeFleetEvent !== undefined) {
            transportHolds.tradeFleet = false;
            void nextTick(() => endTradeFleet());
          }
          return;
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
        // A PLAYER MARKER claimed an empty cell (Land Claim, an Arcadian
        // community): a colour-only diff — the cube popped in without this.
        // A claim collects NOTHING, so this branch stays a pure landing.
        const ownerCubeHold = shouldHoldForOwnerCubePlacement(
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
            cathedralHold ? markerPlacementHoldDurationMs() : 0,
            ownerCubeHold ? ownerCubeHoldDurationMs() : 0,
          );
          try {
            await new Promise<void>((resolve) => setTimeout(resolve, holdMs));
          } finally {
            transportHolds.marker = false;
            transportHolds.tilePlacement = false;
          }
        }
        if (hazardCleanups.length > 0) {
          transportHolds.hazardCleanup = true;
          // The swap callback fires mid-sequence (after the hazard
          // dissolves) to reveal the new tile on the STILL-DISPLAYED old
          // view; the full view commits below.
          await runHazardCleanup(
            hazardCleanups,
            () => applyHazardTileSwap(currentView().game.spaces, newView.game.spaces, hazardCleanups),
          );
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
          await runEnergyConversion(conversionEvent, {leadInMs: conversionLeadInMs});
        }
        /*
         * Console HYDRONETWORK marker-advance gate. The marker is already
         * gliding to the new stop; HOLD the commit until it LOCKS IN.
         * Composed after the other holds (an advance never places a tile /
         * converts energy / trades a colony).
         */
        const hydroMarkerEvent = detectHydroMarker();
        if (hydroMarkerEvent !== undefined) {
          transportHolds.hydroMarker = true;
          await runHydroMarker();
        }
        /*
         * Console COLONY-BUILD hero gate. VERIFY the viewer's cube landed
         * in the armed colony's next slot + CAPTURE the slot's benefit
         * glyph while it is still rendered. HOLD the commit through the
         * cube drop. A build response never carries fresh bot turns
         * (building doesn't end the turn), so it composes here — never in
         * the staged path.
         */
        const colonyBuildEvent = detectColonyBuild(currentView(), newView);
        if (colonyBuildEvent !== undefined) {
          transportHolds.colonyBuild = true;
          try {
            await runColonyBuild();
          } finally {
            transportHolds.colonyBuild = false;
          }
        }
        seedRewardHolds();
        applyPlayerView(newView);
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
          // through the placed tile, become physical chips and pay out.
          void nextTick(() => {
            void endTilePlacement();
          });
        }
        return;
      }

      // A rejected submit (bad request / unexpected) must RECALL every armed
      // console transaction immediately (else it hovers until the safety) —
      // the action did not happen. No-op when none armed.
      abortAllConsoleTransactions();
      const showAlert = r.showAlert.bind(r);
      if (response.status === statusCode.badRequest) {
        const resp = await response.json() as AppErrorResponse;
        let cb = () => {};
        if (resp.id === INVALID_RUN_ID) {
          cb = () => setTimeout(() => window.location.reload(), 100);
        }
        showAlert('Error with input', resp.message, cb);
      } else {
        showAlert('Error processing response', 'Unexpected response from server. Please try again.');
        console.error(response.statusText);
      }
    })
    .catch((e) => {
      // Network failure — same full unwind as a refusal: no ghost card, no
      // ghost cube, no gold, no credit; every composer CTA re-arms.
      abortAllConsoleTransactions();
      r.showAlert('Error sending input,', CANNOT_CONTACT_SERVER);
      console.error(e);
    })
    .finally(() => {
      r.isServerSideRequestInProgress = false;
      /*
       * ⚠️ RE-ASK THE SERVER THE MOMENT THIS SUBMIT IS FULLY PROCESSED.
       *
       * A turn-ending submit's commit is HELD through its own cinematic
       * (`await runPlayedHero` and friends), and the world moves DURING
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
  // …and the colony-build hero: no cube drops, no bonus is collected.
  transportHolds.colonyBuild = false;
  abortColonyBuild();
  // …and the blue-action COMMIT: the activation was rejected — the beat
  // tears down, the composer's CTA unlocks (abortNonce), the captures stay.
  abortConsoleActionCommit();
  abortBotAttackCommit(); // …and the MarsBot attack — the commit row re-opens
}

/** Apply a fresh view: structural sharing + the transient-UI reset epoch. */
function applyPlayerView(playerView: PlayerViewModel | undefined): void {
  const r = theRoot();
  // Structural sharing (viewSnapshotShare.ts): keep unchanged branches'
  // references so child components skip re-rendering; the root identity
  // still changes (watcher-identical to a wholesale swap).
  if (playerView !== undefined) {
    playerView = nextViewSnapshot(r.playerView as PlayerViewModel, playerView);
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
  clearTimeout(ui_update_timeout_id);
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
    xhr.open('GET', apiUrl(paths.API_WAITING_FOR) + identitySearch() + '&gameAge=' + currentView().game.gameAge + '&undoCount=' + currentView().game.undoCount);
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

        if (result.result === 'GO') {
          if (!viewerHasPrompt) {
            // Their prompt just appeared — fetch the new view.
            r.updatePlayer();
            notifyTurn();
          }
        } else if (result.result === 'REFRESH') {
          if (!viewerHasPrompt) {
            // Game advanced and viewer isn't mid-input — safe to refresh.
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
    ui_update_timeout_id = window.setTimeout(askForUpdate, realtimePollIntervalMs(raw_settings.waitingForTimeout));
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
  transportState.playersWaitingFor = [];
  for (const key of Object.keys(transportHolds) as Array<keyof typeof transportHolds>) {
    transportHolds[key] = false;
  }
}
