<!--
@console-shared LIVE — console native stands on this file, so it is NOT covered
by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
-->
<template>
  <div>
  <!--
    During the WGT 2-stage hold OR the Board Placement Animation hold
    (see fetchPlayerInput), we want the viewport to show JUST the
    board with the animating marker / freshly-placed tile — neither
    the dismissed WGT modal nor the upcoming next-phase modal. Bail
    with an empty render until both holds clear (after at most
    max(WGT_MARKER_HOLD_MS, placement hold)). The
    `isServerSideRequestInProgress` flag stays raised through the
    hold, so nothing else can trigger a submit during this window.
  -->
  <template v-if="holdingForMarker || holdingForTilePlacement || holdingForConversion || holdingForHazardCleanup || holdingForTradeFleet || holdingForHydroMarker || holdingForPlayedHero || holdingForPatentSale || holdingForTilePlacementHero || holdingForColonyBuild">
  </template>
  <template v-else-if="waitingfor === undefined">
    {{ $t('Not your turn to take any actions') }}
    <template v-if="playersWaitingFor.length > 0">
      (⌛ <span v-for="color in playersWaitingFor" class="log-player" :class="playerColorClass(color, 'bg')" :key="color">{{ getPlayerName(color) }}</span>)
    </template>
  </template>
  <div v-else class="wf-root">
    <template v-if="preferences().experimental_ui && playerView.game.phase === Phase.ACTION">
      <input type="checkbox" name="suspend" id="suspend-checkbox" v-model="suspend" v-on:change="updateSuspend">
      <label for="suspend-checkbox">
        <span v-i18n>Suspend</span>
      </label>
      <div v-if="showRefresh()">Refresh<span class="reset"></span></div>
    </template>

    <!--
      Mandatory-input modal route. When the top-level prompt is one of the
      types in MODAL_INPUT_TYPES (currently just `'payment'` while we pilot
      the pattern), host the input inside a centered modal instead of
      inline. The Actions section in the player home is hidden via the
      `is-modal-host` class so the inline factory below doesn't fight the
      modal for the same input. See CLAUDE.md "Mandatory-input modal pattern".
    -->
    <MandatoryInputModal v-if="useModalForCurrentInput && !modalSuppressed && !presentationHeld"
                         :title="modalPillTitle"
                         :suppressed="clientHandPickActive || playedPickActive">
      <!--
        World Government Terraforming is hosted via a dedicated button-grid
        component instead of generic OrOptions radios — see CLAUDE.md
        "Mandatory-input modal pattern". Click on a SelectOption button
        commits the choice instantly; click on the SelectSpace ("Add an
        ocean") button activates board pickup mode via the picker-mode
        mechanism (modal hides, planet becomes interactive).
      -->
      <WorldGovernmentModalContent v-if="wgtInput !== undefined"
                                   :playerView="playerViewForPrompt"
                                   :playerinput="wgtInput"
                                   :onsave="onsave" />
      <!--
        Premium-first host for every other modal-routed sub-prompt. Renders a
        modern component where one exists (OrOptions, SelectOption, …) and
        falls back to the legacy PlayerInputFactory otherwise, so a not-yet-
        migrated input type is still visible inside the modal instead of being
        buried in the hidden .legacy-ui-overlay.
      -->
      <ModalInputHost v-else
                      :playerView="playerViewForPrompt"
                      :playerinput="waitingfor"
                      :onsave="onsave" />
    </MandatoryInputModal>

    <!--
      PRESENTATION FLOW: while the player is being shown what just happened
      (the compact AI-turn card / the opened theater), a modal-routed prompt
      renders NOTHING — neither the modal nor the inline factory. The hold is
      bounded (the card's TTL / the theater close), after which the modal
      mounts normally. Console (modalSuppressed) keeps its byte-identical
      fallback rendering below.
    -->
    <template v-else-if="useModalForCurrentInput && presentationHeld && !modalSuppressed">
    </template>

    <player-input-factory v-else
                          :players="playerView.players"
                          :playerView="playerView"
                          :playerinput="waitingfor"
                          :onsave="onsave"
                          :showsave="true"
                          :showtitle="true" />

    <!--
      Mandatory placement banner. Renders the top-of-viewport
      "AWAITING PLACEMENT" pill (+ details modal on click) whenever the
      server's TOP-LEVEL pending input is a SelectSpace. The
      `PlayerInputFactory` above still mounts the legacy SelectSpace
      component so its `mounted()` hook can attach board click handlers
      and add `.board-space--available` to the highlighted tiles — but
      the legacy `.wf-select-space` prompt header is hidden by
      placement_banner.less so the player sees only the new banner.
      Cancellable=false here: the server is already in SelectSpace
      state, no take-back possible from the client side.
    -->
    <PlacementBanner v-if="topLevelSpaceInput !== undefined"
                     :title="topLevelSpaceInput.title"
                     :cancellable="topLevelSpaceInput.placementContext?.cancellable === true"
                     :reason="topLevelSpaceInput.placementContext?.reason"
                     @cancel="onPlacementCancel" />
    </div>
  </div>
</template>

<script lang="ts">
/* global RequestInit */

import {defineComponent, nextTick} from 'vue';
import * as constants from '@/common/constants';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import raw_settings from '@/genfiles/settings.json';
import {onRealtimeWake} from '@/client/components/realtime/realtimeSync';
import {realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {apiUrl, identitySearch} from '@/client/utils/runtimeConfig';
import {vueRoot} from '@/client/components/vueRoot';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {ACTION_MENU_TITLES} from '@/common/inputs/actionMenuTitles';
import {playerColorClass} from '@/common/utils/utils';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {SoundManager} from '@/client/utils/SoundManager';
import {WaitingForModel} from '@/common/models/WaitingForModel';
import {Phase} from '@/common/Phase';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {isPlayerId} from '@/common/Types';
import {InputResponse} from '@/common/inputs/InputResponse';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {Color} from '@/common/Color';
import {gameDocumentTitle} from '../utils/documentTitle';
import {setFaviconStatus, setFaviconTurnFrame} from '@/client/utils/favicon';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import WorldGovernmentModalContent from '@/client/components/WorldGovernmentModalContent.vue';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import PlacementBanner from '@/client/components/PlacementBanner.vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {clearIfPhaseLeftCardPick, clearDraftWaitPending, shouldPreserveCardPickModal} from '@/client/components/draftWaitState';
import {shouldPreserveInitialDraftOverlay} from '@/client/components/initialDraft/initialDraftSharedState';
import {shouldPreserveSaleOverlay} from '@/client/components/handCards/sellPatentsState';
import {handPlayPrompt} from '@/client/components/handCards/handPlayState';
import {isClientHandPickActive} from '@/client/components/handCards/handSelectState';
import {playedCardsPickState} from '@/client/components/playedCards/playedCardsPickState';
import {standardProjectPlayPrompt} from '@/client/components/handCards/standardProjectPlayState';
import {startFlowCorpPrompt, startGameFlowActive} from '@/client/components/startGameFlow/startGameFlowState';
import {freeAwardFundingPrompt} from '@/client/components/awards/awardFundingState';
import {Message} from '@/common/logs/Message';
import {
  applyTilePlacementPreview,
  armPlacementAnimations,
  placementHoldDurationMs,
  shouldHoldForTilePlacement,
} from '@/client/components/board/tilePlacementAnimation';
import {motionMs} from '@/client/components/motion/motionTokens';
import {nextViewSnapshot} from '@/client/utils/viewSnapshotShare';
import {
  detectEnergyConversion,
  endEnergyConversion,
  runEnergyConversion,
} from '@/client/components/feedback/energyConversionTransition';
import {primeStartSetupReveal} from '@/client/components/startGameFlow/startSetupRevealState';
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
import {consoleModeState} from '@/client/console/consoleModeState';
import {
  abortHydroMarker,
  detectHydroMarker,
  endHydroMarker,
  runHydroMarker,
} from '@/client/console/hydroMarker/consoleHydroMarker';
import {
  abortPatentSale,
  detectPatentSale,
  endPatentSale,
  runPatentSale,
} from '@/client/console/patentSale/consolePatentSale';
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
import {presentFreshBotTurns} from '@/client/components/marsbot/marsBotPresentation';
import {isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
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
 * remount for this many ms so the AnimatedScaleMarker on the affected
 * dial gets a clean window to glide from old → new value BEFORE the
 * next-phase modal (research / draft, action menu, etc.) opens and
 * potentially covers the board. Without this hold the impact of the
 * WGT pick is invisible — the response is fast, the next modal pops
 * the same frame, and the marker animation is occluded.
 *
 * 1100 ms = the marker's MAX_DURATION_MS (1280) minus the settle
 * window. The travel almost always finishes well within this; multi-
 * step traversals (e.g. Venus +2 across the apex) get the full tail.
 * Tuned to match user-perceptible "I saw it move" rather than the
 * full 1170 ms settle pulse — the rim flash starts on arrival and is
 * fine to clip against the next modal.
 */
const WGT_MARKER_HOLD_MS = 1100;

// The regular per-turn action menu (`Player.getActions()`) titles are the ONE
// shared source of truth (`@/common/inputs/actionMenuTitles`) — this is the ONE
// top-level `OrOptions` that must NOT pop as a modal (it's driven by the fork's
// dedicated action buttons + the inline legacy fallback). Every OTHER top-level
// `or` is a card-play / forced-event sub-prompt and belongs in the modal.

// PlayerInput types that ALWAYS render in the modal when they are the
// top-level prompt. These can only ever be mandatory sub-decisions (a card
// play, a forced game event, a payment) — never the per-turn action menu —
// so routing every instance to the modal is safe and makes them visible
// instead of buried in the hidden `.legacy-ui-overlay`.
//
// Deliberately NOT here (handled by dedicated surfaces outside the modal):
//   'card'    → DraftFlowOverlay (App level, survives playerkey++ remount)
//   'space'   → PlacementBanner (board picker)
//   'colony'  → ColoniesOverlay (auto-mounts on a SelectColony, even nested)
//   'initialCards' → InitialDraftFlowOverlay
const MODAL_INPUT_TYPES: ReadonlySet<PlayerInputModel['type']> = new Set([
  'payment',
  'option',
  'player',
  'amount',
  'resource',
  'resources',
  'productionToLose',
  'and',
  // A TOP-LEVEL `projectCard` is NOT the action menu (that's an `or` whose
  // `projectCard` is a nested option) — it's a card-driven "play a card / play
  // a standard project" sub-prompt (EccentricSponsor, EcologyExperts via
  // PlayProjectCard; EstablishedMethods via SelectStandardProjectToPlay). Route
  // it to the modal so it's visible (hosted via the legacy SelectProjectCardToPlay
  // form inside ModalInputHost's factory fallback) instead of buried in the
  // hidden legacy overlay.
  'projectCard',
  // Butterfly Effect (Ares) — shift the hazard-constraint thresholds. A bespoke
  // top-level input; route it to the modal so it's VISIBLE (hosted via the
  // ShiftAresGlobalParameters factory fallback inside ModalInputHost) instead of
  // buried in the hidden legacy overlay. A bespoke premium widget is a frontier.
  'aresGlobalParameters',
]);

function titleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) {
    return undefined;
  }
  return typeof title === 'string' ? title : title.message;
}

// Returns true when the given top-level PlayerInput should be hosted inside
// MandatoryInputModal.
//
//  - by `type`: any input in MODAL_INPUT_TYPES (always a mandatory sub-prompt).
//  - `'or'`: every top-level OrOptions EXCEPT the per-turn action menu. This
//    covers World Government Terraforming (rendered by a dedicated component
//    inside the modal) and every card-driven OrOptions (raise temp / raise
//    Venus, pick an attack target, choose an effect, …) which previously fell
//    into the hidden legacy radio stack.
function shouldRouteToModal(input: PlayerInputModel): boolean {
  if (MODAL_INPUT_TYPES.has(input.type)) {
    return true;
  }
  if (input.type === 'or') {
    const t = titleText(input.title);
    return t === undefined || !ACTION_MENU_TITLES.has(t);
  }
  return false;
}

let ui_update_timeout_id: number | undefined;
let documentTitleTimer: number | undefined;
let animationFrame = 0;

// The spinning ◑◒◐◓ symbol used to indicate it's your turn.
const TURN_SEQUENCE = '◑◒◐◓';

// On a desktop browser the favicon is visible in the tab, so we spin it there
// rather than cluttering the document title. Mobile browsers don't show tab
// favicons, so they keep animating the title instead.
function isDesktopBrowser(): boolean {
  return !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

type DataModel = {
  playersWaitingFor: Array<Color>
  suspend: boolean,
  savedPlayerView: PlayerViewModel | undefined;
  /*
   * True while we're mid-WGT 2-stage transition (see
   * `fetchPlayerInput`): the global-parameter values on the
   * playerView have been mutated in place so the dial markers
   * animate, and we're holding for WGT_MARKER_HOLD_MS before
   * committing the rest of the new playerView (which would open the
   * next-phase modal and potentially cover the marker mid-glide).
   *
   * While true the WGT modal is unmounted (so the player doesn't see
   * a dead modal they can no longer interact with), and the inline
   * factory branch is suppressed too — the viewport just shows the
   * board with the animating marker for the hold window.
   */
  holdingForMarker: boolean;
  /*
   * Counterpart hold for the Board Placement Animation Framework.
   * Raised when a server response brings a new tile (oceans /
   * greeneries / cities / special tiles) on the Mars board. While
   * true, the upcoming next-phase modal (payment, action menu,
   * etc.) is suppressed via the same empty-render branch that
   * `holdingForMarker` uses, so the eye stays on the board long
   * enough for the placement impact frame to land before resource
   * chips / scale markers / next prompt fire. See
   * src/client/components/board/tilePlacementAnimation.ts.
   */
  holdingForTilePlacement: boolean;
  /*
   * Counterpart hold for the energy→heat conversion transition (end of
   * generation). While true the next-phase modal is suppressed via the same
   * empty-render branch, so the research / draft / endgame screen can't open
   * over the paired "Energy −X → Heat +X" animation. Composed independently of
   * the marker / tile holds. See
   * src/client/components/feedback/energyConversionTransition.ts.
   */
  holdingForConversion: boolean;
  /*
   * Counterpart hold for the hazard-cleanup sequence (building over an erosion /
   * dust storm). While true the follow-up modal is suppressed via the same
   * empty-render branch, so a post-placement choice can't open over the cleanup
   * animation. Composed independently of the other holds. See
   * src/client/components/feedback/hazardCleanupTransition.ts.
   */
  holdingForHazardCleanup: boolean;
  /*
   * Counterpart hold for the console COLONY-TRADE launch cinematic (send a
   * trade fleet to the planet). While true the next prompt is suppressed via
   * the same empty-render branch, and the commit of the traded view (delta
   * chips / docked-fleet board state) is blocked until the ship DOCKS. Gated
   * on `tradeFleetState.active` (only ever true after the console shell arms
   * a flight), so desktop + every non-trade submit are unaffected. See
   * src/client/console/colonyFleet/consoleTradeFleet.ts.
   */
  holdingForTradeFleet: boolean;
  /*
   * Counterpart hold for the console HYDRONETWORK marker advance. Blocks the
   * commit (delta chips / new track position) until the marker glides to the
   * new stop and LOCKS IN. Gated on `hydroMarkerState.active` (only ever true
   * after the console shell arms an advance), so desktop + every non-hydro
   * submit are unaffected. See
   * src/client/console/hydroMarker/consoleHydroMarker.ts.
   */
  holdingForHydroMarker: boolean;
  /*
   * Console PLAYED-CARD HERO gate: the commit is held through the pre-commit
   * half of the "card lands on my tableau" scene (lift → arc → landing) —
   * delta chips fire only when the card has physically arrived. See
   * src/client/console/played/consolePlayedHero.ts.
   */
  holdingForPlayedHero: boolean;
  /*
   * Console PATENT-SALE gate: the commit is held until the trade terminal's
   * payout chip LANDS on the resource rail's M€ row — the new M€ value + the
   * standard delta chip appear exactly at the touchdown. Gated on
   * `patentSaleState.active` (only ever true after the console shell arms a
   * sale), so desktop + every non-sale submit are unaffected. See
   * src/client/console/patentSale/consolePatentSale.ts.
   */
  holdingForPatentSale: boolean;
  /*
   * Console TILE-PLACEMENT HERO gate: the commit is held through the tile's
   * physical flight + touchdown into the picked hex (the real board tile
   * paints silently under the landed proxy — the generic placement hold then
   * sees no remaining diff for that space and never double-animates). Gated
   * on `tilePlacementState.active` (only ever armed by the console-gated
   * SelectSpace submit), so desktop + every non-space submit are unaffected.
   * See src/client/console/tilePlacement/consoleTilePlacement.ts.
   */
  holdingForTilePlacementHero: boolean;
  /*
   * Console COLONY-BUILD HERO gate: the commit is held through the cube's
   * drop into the colony slot (the real filled-cell cube paints under the
   * settled proxy) + the one-time build bonus lift. Gated on
   * `colonyBuildState.active` (only ever armed by the console colonies-screen
   * Build confirm), so desktop + every non-build submit are unaffected.
   * See src/client/console/colonyBuild/consoleColonyBuild.ts.
   */
  holdingForColonyBuild: boolean;
  /*
   * Bound `visibilitychange` / `focus` handler. Browsers throttle (and
   * eventually freeze) the setTimeout poll chain in a backgrounded tab, so a
   * player on another tab/window would return to STALE state (e.g. an
   * opponent's spent M€ still showing as unspent). We force an immediate poll
   * when the game tab becomes visible/focused again. Stored so `unmounted`
   * (the component remounts on every server response via playerkey++) can
   * detach the exact same listener and not leak one per remount.
   */
  onVisibilityChange: (() => void) | undefined;
  /**
   * Unsubscribe handle for the realtime wake listener (Phase 4). A WS
   * GAME_STATE_INVALIDATED wakes the SAME guarded `waitForUpdate(true)` path as
   * a visibility/focus wake. Stored so `unmounted` detaches it exactly (the
   * component remounts on every server response via playerkey++).
   */
  realtimeWakeOff: (() => void) | undefined;
  /**
   * Set true in `unmounted` so the self-re-arming poll chain can't outlive the
   * component. `ui_update_timeout_id` is module-level and `askForUpdate` re-arms
   * itself via `waitForUpdate()`, so leaving a game to a NON-game screen (main
   * menu) — where no successor WaitingFor mounts to overwrite the shared timer —
   * used to leave an immortal `/api/waitingfor` poll chain hammering the server.
   * `waitForUpdate` bails on this flag, and an in-flight xhr's onload re-arm is
   * likewise suppressed.
   */
  pollStopped: boolean;
}

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

export default defineComponent({
  name: 'waiting-for',
  components: {
    MandatoryInputModal,
    WorldGovernmentModalContent,
    ModalInputHost,
    PlacementBanner,
  },
  props: {
    // Console Task System (CTS): when the console shell serves the current
    // prompt with its own native task surface it suppresses the desktop
    // modal RENDERING here (the transport / routing / holds are untouched).
    // Desktop never passes this — byte-identical behavior there.
    modalSuppressed: {
      type: Boolean,
      default: false,
    },
    playerView: {
      // ViewModel covers both PlayerViewModel (actual players) and the
      // narrower SpectatorModel — SpectatorHome.vue mounts WaitingFor
      // purely for its polling lifecycle and never triggers any prompts
      // (waitingfor is always undefined for spectators).
      type: Object as () => ViewModel,
      required: true,
    },
    waitingfor: {
      type: Object as () => PlayerInputModel | undefined,
      default: undefined,
    },
  },
  data(): DataModel {
    return {
      playersWaitingFor: [],
      suspend: false,
      savedPlayerView: undefined,
      holdingForMarker: false,
      holdingForTilePlacement: false,
      holdingForConversion: false,
      holdingForTradeFleet: false,
      holdingForHydroMarker: false,
      holdingForPlayedHero: false,
      holdingForPatentSale: false,
      holdingForTilePlacementHero: false,
      holdingForColonyBuild: false,
      holdingForHazardCleanup: false,
      onVisibilityChange: undefined,
      realtimeWakeOff: undefined,
      pollStopped: false,
    };
  },
  /*
   * Phase watcher — the SOLE clearing path for `draftWaitState`. Runs
   * immediately on mount so a freshly-mounted WaitingFor (after a
   * playerkey++ remount) reconciles the flag against the current
   * server phase right away. clearIfPhaseLeftCardPick is a no-op
   * while phase is RESEARCH / DRAFTING / INITIALDRAFTING, so during
   * the waiting window the flag stays raised across any number of
   * mount cycles. Once the server reports a non-card-pick phase
   * (ACTION / PRODUCTION / etc.), the flag clears and the modal
   * unmounts naturally on the next computed re-evaluation.
   *
   * If the game ends, defensively clear regardless of phase so we
   * never leave a stale flag behind on the next game.
   */
  watch: {
    'playerView.game.phase': {
      immediate: true,
      handler(newPhase: Phase) {
        if (newPhase === Phase.END) {
          clearDraftWaitPending();
        } else {
          clearIfPhaseLeftCardPick(newPhase);
        }
      },
    },
    /*
     * Turn presentation (document title / favicon / the ◑◒◐◓ title spinner)
     * used to be applied only in mounted() — correct while the playerkey
     * remount recreated this component on every server response. With the
     * no-remount update model the instance persists, so the presentation must
     * follow the PROMPT reactively: re-sync whenever `waitingfor` changes
     * (immediate covers the initial mount).
     */
    'waitingfor': {
      immediate: true,
      handler() {
        this.syncTurnPresentation();
      },
    },
  },
  methods: {
    getPlayerName(color: Color): string {
      const player = this.playerView.players.find((p) => p.color === color);
      return player ? player.name : color;
    },
    /*
     * Apply the turn presentation for the CURRENT prompt state: static
     * document title, favicon turn/idle status, and the multiplayer title
     * spinner interval (armed only while the viewer owes a REQUIRED prompt).
     * Called from the `waitingfor` watcher (immediate) — the reactive
     * replacement for the old mounted()-only application.
     */
    syncTurnPresentation(): void {
      document.title = gameDocumentTitle(this.playerView.game);
      // An optional prompt (draft re-pick) is not the viewer's turn to act.
      const hasRequiredPrompt = this.waitingfor !== undefined && this.waitingfor.optional !== true;
      if (getPreferences().experimental_ui) {
        setFaviconStatus(hasRequiredPrompt ? 'turn' : 'idle');
      }
      window.clearInterval(documentTitleTimer);
      if (this.playerView.players.length > 1 && hasRequiredPrompt) {
        documentTitleTimer = window.setInterval(() => this.animateTitle(), 1000);
      }
    },
    animateTitle() {
      if (!getPreferences().animated_title) {
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
        document.title = TURN_SEQUENCE[animationFrame] + ' ' + gameDocumentTitle(this.playerView.game);
      }
    },
    onsave(out: InputResponse) {
      /*
       * Capture whether the prompt the player is currently submitting
       * is the WGT OrOptions BEFORE we hand off to fetch — by the
       * time the response arrives, `this.waitingfor` may already have
       * been replaced (rare, but defensive).
       */
      const wgtSubmit = this.currentPromptIsWGT();
      this.fetchPlayerInput(
        apiUrl(paths.PLAYER_INPUT) + '?id=' + this.playerView.id,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: this.playerView.runId, ...out}),
        },
        wgtSubmit);
    },
    /**
     * Submit an ORDERED ARRAY of responses in one request (the action-preview
     * rework's "single final submit"). The server replays them in order against
     * each successive `waitingFor`; see `routes/PlayerInputBatch.ts`. The
     * response is a normal PlayerViewModel, so the same hold/animation + update
     * path as `onsave` applies; a leftover `waitingFor` (board placement /
     * divergence) renders through the existing routing.
     */
    onsaveBatch(responses: ReadonlyArray<InputResponse>) {
      this.fetchPlayerInput(
        apiUrl(paths.PLAYER_INPUT_BATCH) + '?id=' + this.playerView.id,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: this.playerView.runId, responses}),
        },
        false);
    },
    // Cancel a pending, cancellable tile placement (a pay-on-commit standard
    // project). Submits a CancelResponse; the server discards the placement
    // without charging and returns the player to the action menu.
    onPlacementCancel() {
      this.onsave({type: 'cancel'});
    },
    reset() {
      this.fetchPlayerInput(
        apiUrl(paths.RESET) + '?id=' + this.playerView.id,
        {method: 'GET'},
        false);
    },
    currentPromptIsWGT(): boolean {
      const wf = this.waitingfor;
      if (wf === undefined) {
        return false;
      }
      if (wf.type !== 'or') {
        return false;
      }
      return titleText(wf.title) === WGT_TITLE;
    },
    /**
     * Does the about-to-be-applied playerView change one of the three
     * global-parameter dials this fork's `AnimatedScaleMarker`
     * highlights? Used to decide whether the WGT 2-stage hold is worth
     * running. "Add an ocean" WGT picks land here with all three
     * values unchanged (the ocean placement comes later through a
     * SelectSpace prompt), so we skip the hold and let the next prompt
     * open instantly.
     */
    shouldHoldForMarkerAnimation(newView: PlayerViewModel): boolean {
      const oldGame = this.playerView.game;
      const newGame = newView.game;
      return oldGame.temperature !== newGame.temperature ||
        oldGame.oxygenLevel !== newGame.oxygenLevel ||
        oldGame.venusScaleLevel !== newGame.venusScaleLevel;
    },
    /**
     * Stage 1 of the WGT 2-stage transition: mutate JUST the three
     * global-parameter values on the currently-displayed playerView in
     * place. Vue 3 reactivity propagates each scalar change to the
     * Board's `:temperature` / `:oxygen_level` / `:venusScaleLevel`
     * props; the AnimatedScaleMarker watcher fires and starts gliding
     * the affected dial.
     *
     * We deliberately do NOT touch waitingfor, the player tableau, or
     * any of the dozens of other fields — the rest of the new view
     * lands at Stage 2 (the regular playerkey++ remount). The player
     * tableau may briefly show pre-WGT values for the hold window;
     * the player's attention is on the dial, not the tableau.
     */
    applyGlobalParamPreview(newView: PlayerViewModel): void {
      const oldGame = this.playerView.game;
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
    },
    /**
     * Seed the console REWARD HOLDS in the SAME SYNCHRONOUS BLOCK as the
     * commit below (never earlier — see the seeders' own contract). The panel
     * renders `committed − held`, so a hold seeded even ONE micro-task before
     * `updatePlayerView` lets Vue flush a frame of "PRE-commit value − reward"
     * — the metric visibly DIPS and AnimatedMetricValue honestly fires a
     * phantom −N chip (most visible on production, which isn't clamped at 0),
     * which the commit then undoes. Seeding here means Vue sees exactly ONE
     * transition (pre-reward → pre-reward: no chip), and the only real one is
     * each reward's release at its chip's touchdown → +N.
     *
     * Both calls are no-ops unless their transaction armed rewards (desktop
     * and every non-console flow never arm), so this is free everywhere else.
     */
    seedRewardHolds(): void {
      seedPlayedHeroRewardHold();
      seedTilePlacementRewardHold();
      seedColonyBuildRewardHold();
      seedColonyTradeRewardHold();
    },
    fetchPlayerInput(url: string, options: RequestInit, wgtSubmit: boolean) {
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        console.warn('Server request in progress');
        return;
      }
      // The player ACTED — playing on is an implicit acknowledgement of any
      // still-visible flow-holding card (the compact AI-turn notification),
      // so the follow-up prompt of THIS submit is never held behind it.
      acknowledgeFlowHoldingCards();

      root.isServerSideRequestInProgress = true;
      fetch(url, options)
        .then(async (response) => {
          if (response.ok) {
            const newView = await response.json() as PlayerViewModel;
            /*
             * Two independent holds compose here:
             *
             *   marker hold — WGT submit raised temperature / oxygen /
             *     venus. Mutates JUST those three scalars in place so
             *     AnimatedScaleMarker can glide unobstructed, blocks
             *     the next-phase modal opening for ~WGT_MARKER_HOLD_MS.
             *
             *   tile-placement hold — any submit (WGT, manual ocean
             *     placement, card-driven tile placement, action-menu
             *     tile drop) that introduces at least one new tile on
             *     the Mars board. Mutates JUST the affected spaces'
             *     tileType in place so BoardSpaceTile's watcher fires
             *     the impact + settle keyframes; suppresses the
             *     upcoming modal for `placementHoldDurationMs()`.
             *
             * Both previews apply if both conditions hold (e.g. a
             * future card that bumps temperature AND places a tile).
             * Actual hold = max of the two so the longer animation
             * doesn't get clipped by the shorter window.
             *
             * `isServerSideRequestInProgress` stays raised through the
             * whole hold (cleared in `.finally`), so nothing else can
             * submit while we're previewing.
             */
            /*
             * Console PLAYED-CARD HERO gate (the "card lands on my tableau"
             * scene). Detect the ARMED transaction (undefined on desktop /
             * every non-play submit — a no-op there); the detect VERIFIES the
             * server actually moved the card into the tableau, so a refused
             * play can never fake a success. HOLD the commit through the
             * pre-commit half (lift → overlay swap → arc → landing), so the
             * delta chips + the committed tableau land on a card that has
             * PHYSICALLY arrived; the post-commit half (reveal / result beat /
             * auto-close) runs on the next tick, mirroring the trade-fleet
             * and hydro-marker gates. Runs BEFORE the bot staging: the bot's
             * turn (which rides this same response) is presented only after
             * the player's own card has landed.
             */
            const playedHeroEvent = detectPlayedHero(newView);
            if (playedHeroEvent !== undefined) {
              this.holdingForPlayedHero = true;
              try {
                await runPlayedHero(newView);
              } finally {
                this.holdingForPlayedHero = false;
              }
            }
            /*
             * Console PATENT-SALE gate (the "cards feed the trade terminal"
             * scene). Detect the ARMED transaction (undefined on desktop /
             * every non-sale submit — a no-op there); the detect VERIFIES the
             * server actually removed the sold cards from the hand, so a
             * refused sale can never fake a payout. HOLD the commit until the
             * dispensed M€ chip LANDS on the resource rail — the new counter
             * value + the standard delta chip appear exactly at the touchdown;
             * the post-commit settle (chip absorbed, terminal retracts) runs
             * on the next tick, mirroring the trade-fleet / hero gates.
             */
            const patentSaleEvent = detectPatentSale(newView);
            if (patentSaleEvent !== undefined) {
              this.holdingForPatentSale = true;
              try {
                await runPatentSale();
              } finally {
                this.holdingForPatentSale = false;
              }
            }
            /*
             * Console TILE-PLACEMENT HERO gate. Detect the ARMED transaction
             * (undefined on desktop / every non-space submit); the detect
             * VERIFIES the server actually put a tile on the armed space and
             * CAPTURES the cell's printed bonus icons while it is still
             * uncovered. HOLD the commit through the flight + touchdown —
             * the real tile paints silently under the landed proxy via the
             * targeted preview, so the generic tile hold below sees no
             * remaining diff for that space (other fresh tiles in the same
             * response — a hazard spawning — still ride the existing path).
             * The printed bonuses commit under the panel reward hold; the
             * post-commit reward beat (icons rise → chips fly → delta chips
             * at contact) runs in endTilePlacement on the next tick.
             */
            const tileHeroEvent = detectTilePlacement(
              this.playerView.game?.spaces, newView.game?.spaces,
              {aresExtension: this.playerView.game?.gameOptions?.expansions?.ares === true});
            if (tileHeroEvent !== undefined) {
              this.holdingForTilePlacementHero = true;
              try {
                await runTilePlacement(this.playerView.game.spaces, newView.game.spaces);
              } finally {
                this.holdingForTilePlacementHero = false;
              }
            }
            /*
             * MarsBot turns (the MAIN path — ending your turn is what lets
             * the bot act, so its resolved turn(s) ride THIS response).
             * NOTIFICATION-FIRST with STAGED visual commits: when fresh bot
             * turns arrive, the latest view is NOT committed here — each
             * turn's visual footprint applies to the presented view when its
             * compact card is DELIVERED, and the LAST turn's delivery runs
             * the closure below (arming the placement animation for any
             * remaining fresh tiles). The marker/tile/conversion holds are
             * deliberately skipped on a staged response: the bot's tiles
             * animate per turn through the staging itself, and a transient
             * conversion marker is picked up by the next poll (the same
             * documented behaviour as the poll path).
             */
            if (presentFreshBotTurns(this.playerView, newView, {
              commitLatest: () => {
                // Console: the batch's LAST-turn tiles (this closure IS that
                // full commit) land with the premium remote flight — staged
                // in the same synchronous block, committed hidden, revealed
                // at each proxy's touchdown. No-op on desktop.
                stageRemotePlacements(this.playerView.game?.spaces, newView.game?.spaces, {
                  aresExtension: newView.game?.gameOptions?.expansions?.ares === true,
                  gamePhase: newView.game?.phase,
                  viewerColor: newView.thisPlayer?.color,
                });
                if (shouldHoldForTilePlacement(this.playerView.game.spaces, newView.game.spaces)) {
                  armPlacementAnimations();
                }
                this.seedRewardHolds();
                this.updatePlayerView(newView);
              },
            })) {
              // A staged bot response defers the commit to the bot pipeline —
              // the hero's post-commit half (reveal / result beat / close)
              // still runs so the landed card is never left proxy-frozen.
              if (playedHeroEvent !== undefined) {
                nextTick(() => {
                  void endPlayedHero();
                });
              }
              // …and the patent-sale settle, so a staged response never
              // leaves the landed chip / terminal frozen on screen.
              if (patentSaleEvent !== undefined) {
                nextTick(() => {
                  void endPatentSale();
                });
              }
              // …and the placement reward beat (the landed tile is already
              // painted; its printed bonuses still pay out honestly).
              if (tileHeroEvent !== undefined) {
                nextTick(() => {
                  void endTilePlacement();
                });
              }
              return;
            }
            /*
             * Start-of-game setup reveal. When this submit lands the ceremony
             * view (the corp just applied its bonuses + card payment), prime the
             * panel override at its baseline SYNCHRONOUSLY — before the commit —
             * so the left panel shows the pre-corp numbers, then reveals the corp
             * bonus + payment as explicit staged A-presses. Non-gating (the
             * ceremony is interactive); idempotent (dedup) with the poll path.
             */
            // The console retired the client-STAGED setup reveal: the deferred
            // corporationPlay + the hero landing carry the beat — chips fire
            // on the (held) commit. Desktop keeps the staged ceremony.
            if (playedHeroEvent === undefined && !consoleModeState.enabled) {
              primeStartSetupReveal(this.playerView, newView);
            }
            /*
             * Console REMOTE placements riding the viewer's OWN submit
             * response (a concurrent human's build that resolved while the
             * POST was in flight). Staged BEFORE the generic tile preview
             * below paints them: they commit hidden behind the reveal hold
             * and land with the premium remote flight at their proxy's
             * touchdown. The viewer's own armed placement was already
             * consumed by the tile hero above (its space is painted, so it
             * no longer diffs); hazards are excluded and keep the generic
             * ominous entrance. A no-op on desktop / no fresh tiles.
             */
            stageRemotePlacements(this.playerView.game?.spaces, newView.game?.spaces, {
              aresExtension: newView.game?.gameOptions?.expansions?.ares === true,
              gamePhase: newView.game?.phase,
              viewerColor: newView.thisPlayer?.color,
            });
            const markerHold = wgtSubmit && this.shouldHoldForMarkerAnimation(newView);
            const tileHold = shouldHoldForTilePlacement(
              this.playerView.game.spaces,
              newView.game.spaces,
            );
            /*
             * Energy→heat conversion hold (end of generation). Detect BEFORE
             * the marker/tile previews mutate the displayed view; claims the
             * dedup key so the poll path doesn't double-fire it. Runs as an
             * independent hold AFTER the marker/tile previews (production never
             * places tiles, so they don't co-occur in practice), then commits.
             */
            const conversionEvent = detectEnergyConversion(this.playerView, newView);
            // Building over a hazard zone (erosion / dust storm): play the premium
            // cleanup sequence (hazard dissolves → tile materialises → cost/TR
            // feedback) and hold the follow-up modal until it ends. Detected here
            // (a hazard→tile swap is NOT an `undefined→tile` placement, so the
            // tile-placement hold above never fires for it). Mutually exclusive
            // with the conversion in practice (placement vs production phase).
            const hazardCleanups = detectHazardCleanup(this.playerView, newView);
            if (markerHold || tileHold) {
              if (markerHold) {
                this.applyGlobalParamPreview(newView);
                this.holdingForMarker = true;
              }
              if (tileHold) {
                /*
                 * Arm the placement-animation gate BEFORE mutating
                 * the displayed spaces — observeTilePlacement on
                 * the BoardSpaceTile watcher fires synchronously
                 * from Vue's reactivity, so if we arm after the
                 * mutation the gate is still closed at the moment
                 * the watcher checks it and the animation gets
                 * silently skipped. Without this gate the very
                 * first render of the board on F5 / direct nav
                 * would also animate every existing tile, which
                 * looks like the game just restarted.
                 */
                armPlacementAnimations();
                applyTilePlacementPreview(
                  this.playerView.game.spaces,
                  newView.game.spaces,
                );
                this.holdingForTilePlacement = true;
              }
              const holdMs = Math.max(
                markerHold ? motionMs(WGT_MARKER_HOLD_MS) : 0,
                tileHold ? placementHoldDurationMs() : 0,
              );
              try {
                await new Promise<void>((resolve) => setTimeout(resolve, holdMs));
              } finally {
                this.holdingForMarker = false;
                this.holdingForTilePlacement = false;
              }
            }
            if (hazardCleanups.length > 0) {
              this.holdingForHazardCleanup = true;
              // The swap callback fires mid-sequence (after the hazard dissolves)
              // to reveal the new tile on the STILL-DISPLAYED old view; the full
              // view commits below. isServerSideRequestInProgress stays raised
              // through the await, so nothing else can submit during the sequence.
              await runHazardCleanup(
                hazardCleanups,
                () => applyHazardTileSwap(this.playerView.game.spaces, newView.game.spaces, hazardCleanups),
              );
            }
            if (conversionEvent !== undefined) {
              this.holdingForConversion = true;
              // The override seeds the change-feedback baselines on completion,
              // so committing right after shows the production REMAINDER chips,
              // not the full pre-conversion delta. isServerSideRequestInProgress
              // stays raised through the await (cleared in .finally).
              await runEnergyConversion(conversionEvent);
            }
            /*
             * Console COLONY-TRADE launch gate (send a trade fleet to the
             * planet). Detect the ARMED client flight (undefined on desktop /
             * every non-trade submit, so this is a no-op there): the ship is
             * already flying to the target berth; HOLD the commit until it
             * DOCKS, so the delta chips + docked-fleet board state land on a
             * ship that has arrived — never during the flight. Composed after
             * the other holds (a trade never places a tile / converts energy).
             */
            const tradeFleetEvent = detectTradeFleet();
            if (tradeFleetEvent !== undefined) {
              this.holdingForTradeFleet = true;
              await runTradeFleet();
            }
            /*
             * The colony-trade REWARD transaction (armed with the fleet at the
             * composer confirm): CLAIM this response's authoritative trade
             * manifest BEFORE the commit — claiming freezes the traded
             * colony's track display at its pre-trade position, and
             * seedRewardHolds() below hides the reward metrics, so the commit
             * that follows can never flash the reset track or the un-flown
             * rewards through. The reward waves themselves run POST-commit
             * (see the nextTick below). Undefined on desktop / every
             * non-armed trade — a pure no-op there.
             */
            const colonyTradeEvent = detectColonyTrade(newView);
            /*
             * Console HYDRONETWORK marker-advance gate. Detect the ARMED
             * client advance (undefined on desktop / non-hydro submits, so a
             * no-op there): the marker is already gliding to the new stop;
             * HOLD the commit until it LOCKS IN, so the delta chips + new
             * track position land on a marker that has arrived — never during
             * the glide. Composed after the other holds (an advance never
             * places a tile / converts energy / trades a colony).
             */
            const hydroMarkerEvent = detectHydroMarker();
            if (hydroMarkerEvent !== undefined) {
              this.holdingForHydroMarker = true;
              await runHydroMarker();
            }
            /*
             * Console COLONY-BUILD hero gate (build a colony from the colonies
             * screen). Detect the ARMED build (undefined on desktop / every
             * non-build submit): VERIFY the viewer's cube landed in the armed
             * colony's next slot + CAPTURE the slot's benefit glyph while it is
             * still rendered. HOLD the commit through the cube drop; the build
             * bonus commits under the panel reward hold, and the post-commit
             * reward beat (the glyph lifts → resource chips fly → delta chips at
             * contact, OR a card cover lifts via board-card-bonus) runs in
             * endColonyBuild next tick. A build response never carries fresh bot
             * turns (building doesn't end the turn), so it composes here with the
             * other client-armed colony-screen gates — never in the staged path.
             */
            const colonyBuildEvent = detectColonyBuild(this.playerView, newView);
            if (colonyBuildEvent !== undefined) {
              this.holdingForColonyBuild = true;
              try {
                await runColonyBuild();
              } finally {
                this.holdingForColonyBuild = false;
              }
            }
            this.seedRewardHolds();
            this.updatePlayerView(newView);
            if (hazardCleanups.length > 0) {
              this.holdingForHazardCleanup = false;
              nextTick(() => endHazardCleanup());
            }
            if (conversionEvent !== undefined) {
              this.holdingForConversion = false;
              // Clear the panel override on the next tick — AFTER the committed
              // (possibly remounted) panel reads the canonical final values and
              // fires the seeded production chips — so there's no value flash.
              nextTick(() => endEnergyConversion());
            }
            if (tradeFleetEvent !== undefined) {
              this.holdingForTradeFleet = false;
              // Hand the flight off AFTER the commit: the real docked ship
              // just materialized under the (gone) proxy — end on the next
              // tick so it gets the one-shot settle glow + the composer closes.
              nextTick(() => endTradeFleet());
            }
            if (colonyTradeEvent !== undefined) {
              // The reward waves start only now — the ship has docked, the
              // view committed (metrics held, track frozen): the trade income
              // physically leaves the «ТОРГОВАТЬ» cell, then the own colony
              // bonuses leave «БОНУС»; drawn cards ride the staged reveal and
              // the track reset glide follows the last confirmation.
              nextTick(() => {
                void runColonyTradeRewards();
              });
            }
            if (hydroMarkerEvent !== undefined) {
              this.holdingForHydroMarker = false;
              // Hand the advance off AFTER the commit: the real marker just
              // materialized on the new stop under the locked proxy — end on
              // the next tick so it gets the one-shot settle glow.
              nextTick(() => endHydroMarker());
            }
            if (colonyBuildEvent !== undefined) {
              // Post-commit handoff: the real filled-cell cube just painted
              // pixel-identical under the settled proxy — remove the proxy in
              // one frame + absorb the resting resource chip (its delta chip
              // fired on the commit). A card cover continues under board-card-bonus.
              nextTick(() => {
                void endColonyBuild();
              });
            }
            if (playedHeroEvent !== undefined) {
              // Post-commit half of the hero scene: the real slot just painted
              // under the proxy (identical geometry) — reveal, dissolve the
              // proxy, play the result beat, close the system-opened table.
              nextTick(() => {
                void endPlayedHero();
              });
            }
            if (patentSaleEvent !== undefined) {
              // Post-commit settle: the M€ counter just ticked + the delta
              // chip fired under the landed payout chip — absorb the chip
              // into the row (one-shot halo) and retract the terminal.
              nextTick(() => {
                void endPatentSale();
              });
            }
            if (tileHeroEvent !== undefined) {
              // The REWARD BEAT of the placement: the cell's printed icons
              // rise through the placed tile, become physical chips and pay
              // out — each touchdown releases its held metric (delta chip at
              // the contact). A bonus-less cell finishes instantly.
              nextTick(() => {
                void endTilePlacement();
              });
            }
            return;
          }

          // A rejected submit (bad request / unexpected) must RECALL any armed
          // trade fleet / hydro marker / bonus cover immediately (else it
          // hovers until the safety) — the action did not happen. No-op when
          // none armed (desktop).
          this.holdingForTradeFleet = false;
          abortTradeFleet();
          abortColonyTrade(); // …and the whole trade-reward transaction with it
          this.holdingForHydroMarker = false;
          abortHydroMarker();
          abortBoardCardBonus('return');
          // …and the played-card hero: the play did NOT happen — the armed
          // transaction unwinds with zero visual trace (the composer stays
          // open, its CTA re-arms via the shell's 'failed' watcher).
          this.holdingForPlayedHero = false;
          abortPlayedHero();
          // …and the patent sale: the terminal swallows nothing — the cards
          // return to the hand (un-blanked) and no chip is ever dispensed.
          this.holdingForPatentSale = false;
          abortPatentSale();
          // …and the tile-placement hero: the placement did NOT happen — no
          // tile flies, no bonus is ever collected, the board stays intact.
          this.holdingForTilePlacementHero = false;
          abortTilePlacement();
          // …and the colony-build hero: the build did NOT happen — no cube
          // drops, no bonus is collected, the colonies screen stays intact.
          this.holdingForColonyBuild = false;
          abortColonyBuild();
          const showAlert = vueRoot(this).showAlert;
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
          this.holdingForTradeFleet = false;
          abortTradeFleet(); // network failure — recall the fleet, restore the UI
          abortColonyTrade(); // …and the trade-reward transaction with it
          this.holdingForHydroMarker = false;
          abortHydroMarker(); // network failure — recall the marker too
          abortBoardCardBonus('return'); // …and the bonus cover, back onto its cell
          this.holdingForPlayedHero = false;
          abortPlayedHero(); // …and the played-card hero — no ghost card, ever
          this.holdingForPatentSale = false;
          abortPatentSale(); // …and the patent sale — the hand cards un-blank
          this.holdingForTilePlacementHero = false;
          abortTilePlacement(); // …and the tile hero — the board stays intact
          this.holdingForColonyBuild = false;
          abortColonyBuild(); // …and the colony-build hero — no ghost cube, ever
          root.showAlert('Error sending input,', CANNOT_CONTACT_SERVER);
          console.error(e);
        })
        .finally(() => {
          root.isServerSideRequestInProgress = false;
        });
    },
    updatePlayerView(playerView: PlayerViewModel | undefined) {
      if (this.suspend === false) {
        const root = vueRoot(this);
        // Structural sharing (viewSnapshotShare.ts): keep unchanged branches'
        // references so child components skip re-rendering; the root identity
        // still changes (watcher-identical to a wholesale swap).
        if (playerView !== undefined) {
          playerView = nextViewSnapshot(root.playerView, playerView);
        }
        /*
         * SKIP the playerkey++ remount when we're continuing within
         * a card-pick flow (`draftWaitState.pending && new state is
         * still card-pick`). Without skip, every server response
         * destroys the entire #player-home subtree (including the
         * MandatoryInputModal hosting our draft/buy UI), then
         * recreates a fresh one — which the player perceives as the
         * modal closing on submit. With skip, we just swap
         * playerView reactively and let the existing modal swap its
         * content between CardSelectionContent and DraftWaitingContent
         * via v-else-if in this template. One continuous modal
         * across the whole session.
         *
         * For every OTHER transition (action -> production, turn
         * end, action menu prompts, etc.) the playerkey++ remount
         * still fires, preserving the original "force re-render"
         * behaviour that the codebase relies on for those paths.
         */
        if (shouldPreserveCardPickModal(playerView) || shouldPreserveInitialDraftOverlay(playerView) || shouldPreserveSaleOverlay()) {
          root.playerView = playerView;
        } else {
          root.playerView = playerView;
          // Bump the transient-UI reset epoch (the former remount trigger) —
          // PlayerHome's resetEpoch watcher closes overlays / pending modals,
          // preserving the "submit resets the transient UI" contract.
          root.playerkey++;
        }
        this.savedPlayerView = undefined;
      } else {
        this.savedPlayerView = playerView;
      }
    },
    waitForUpdate(immediate = false) {
      // The component has unmounted (left the game screen) — do NOT re-arm the
      // poll chain. Without this an in-flight xhr's onload (or a queued alert
      // retry) would resurrect the self-re-arming timer after unmount and keep
      // polling `/api/waitingfor` forever from a non-game screen.
      if (this.pollStopped) {
        return;
      }
      const vueApp = this;
      const root = vueRoot(this);
      clearTimeout(ui_update_timeout_id);
      // The game is over — there is nothing left to poll for. Stopping the
      // chain here keeps the board (and the "Game over" banner) from being
      // re-fetched / remounted every tick after END; the endgame screen
      // already holds the final view. (`this.playerView` is reactive — see the
      // `playerView.game.phase` watcher — so this is true once the END view has
      // loaded, with or without a remount.)
      if (this.playerView.game.phase === Phase.END) {
        return;
      }
      const askForUpdate = () => {
        // Re-check at fire time: the phase can flip to END while this poll's
        // timer is pending (e.g. another player's action ended the game), so
        // bail without re-arming rather than firing one last needless refresh.
        if (this.playerView.game.phase === Phase.END) {
          return;
        }
        const xhr = new XMLHttpRequest();
        xhr.open('GET', apiUrl(paths.API_WAITING_FOR) + identitySearch() + '&gameAge=' + this.playerView.game.gameAge + '&undoCount=' + this.playerView.game.undoCount);
        xhr.onerror = function() {
          root.showAlert('Error fetching state', CANNOT_CONTACT_SERVER, () => vueApp.waitForUpdate());
        };
        xhr.onload = () => {
          if (xhr.status === statusCode.ok) {
            const result = xhr.response as WaitingForModel;
            this.playersWaitingFor = result.waitingFor;
            // Bubble the live "who's currently being waited on" list to
            // the root so siblings (left-panel cubes, status labels) can
            // react to it without doing a full playerView refresh.
            root.playersWaitingFor = result.waitingFor;

            // While the viewer is mid-prompt (`waitingfor !== undefined`)
            // a full refresh would reset their partial input state
            // (selected cards, etc.). Skip it — the bubbled list above
            // is enough to keep other players' cube/status in sync.
            //
            // EXCEPTION: an OPTIONAL prompt (draft re-pick, upstream #8151) is
            // NOT real mid-input — this fork suppresses its UI and shows the
            // "waiting for the other players" view, so there is no partial input
            // to protect. It MUST count as "no prompt" here, otherwise when the
            // server clears the optional re-pick and hands the viewer their next
            // REQUIRED prompt (the next draft set), the 'GO' below is skipped and
            // the player is stuck on the waiting view forever — a draft deadlock.
            const viewerHasPrompt = this.waitingfor !== undefined && this.waitingfor.optional !== true;

            if (result.result === 'GO') {
              if (!viewerHasPrompt) {
                // Their prompt just appeared — fetch the new view.
                root.updatePlayer();
                this.notify();
              }
            } else if (result.result === 'REFRESH') {
              if (!viewerHasPrompt) {
                // Game advanced and viewer isn't mid-input — safe to refresh.
                if (isPlayerId(this.playerView.id)) {
                  root.updatePlayer();
                } else {
                  root.updateSpectator();
                }
              }
            }
            /*
             * ALWAYS keep polling. Previously this path used `return`
             * after triggering a refresh, relying on the playerkey++
             * remount inside `updatePlayer` to re-arm polling via the
             * new WaitingFor instance's `mounted()` hook. The
             * `shouldPreserveCardPickModal` fix skips the remount for
             * draft / research card-pick transitions, which leaves
             * the OLD WaitingFor alive — and silently dead in the
             * polling loop. Players stuck on the draft waiting view
             * even after the server had moved them to the buy modal
             * was the user-visible symptom. Continuing the chain
             * here keeps it alive regardless of which path
             * `updatePlayer` takes.
             *
             * If a remount DOES fire (non-preserved transition), the
             * new WaitingFor's mounted() will call waitForUpdate()
             * which `clearTimeout`s the old chain's pending timer.
             * Only one polling chain runs at a time.
             */
            vueApp.waitForUpdate();
          } else {
            root.showAlert('Error with input', `Received unexpected response from server (${xhr.status}). This is often due to the server restarting.`, () => vueApp.waitForUpdate());
          }
        };
        xhr.responseType = 'json';
        xhr.send();
      };
      if (immediate) {
        // Poll RIGHT NOW instead of after waitingForTimeout. Used when the tab
        // regains visibility/focus: the background-throttled timer may be far
        // out (or frozen), so we fetch current state the instant the player
        // looks again. askForUpdate re-arms the normal chain when it returns.
        askForUpdate();
      } else {
        // Phase 6: stretch the poll to a long safety-net interval while the WS
        // is strictly healthy (and reduction is enabled); otherwise the safe
        // `waitingForTimeout`. Re-evaluated every re-arm, and a WS drop wakes an
        // immediate re-arm (onRealtimeWake -> waitForUpdate(true)) so we fall
        // back to the safe interval fast.
        ui_update_timeout_id = window.setTimeout(askForUpdate, realtimePollIntervalMs(raw_settings.waitingForTimeout));
      }
    },
    notify() {
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
          // ok so the native Notification doesn't work which will happen
          // try to use the service worker
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
    },
    updateSuspend() {
      if (this.suspend === false && this.savedPlayerView !== undefined) {
        this.updatePlayerView(this.savedPlayerView);
      }
    },
    showRefresh(): boolean {
      return this.suspend === true && this.savedPlayerView !== undefined;
    },
    playerName(color: Color) {
      const player = this.playerView.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : '';
    },
  },
  mounted() {
    // Turn presentation (title / favicon / spinner) is handled by the
    // `waitingfor` watcher (immediate) — see syncTurnPresentation().
    // Always poll — even when the viewer is mid-prompt — so other players'
    // status (cube spin, status label) stays in sync across simultaneous-
    // action phases (drafting / research / production interrupts). The poll
    // handler skips full refreshes while the viewer has a prompt to avoid
    // resetting partial input state.
    this.waitForUpdate();
    // Browsers throttle (and after ~5 min freeze) setTimeout in a backgrounded
    // tab, so the poll chain above stalls while the player is on another
    // tab/window — they'd come back to STALE state (the reported bug: an
    // opponent's M€ spent on a colony still shown as unspent until their turn).
    // Force an immediate poll the moment the game tab becomes visible/focused
    // again. The poll handler itself decides whether anything actually changed
    // (REFRESH/GO vs WAIT) and skips refreshes while the viewer is mid-prompt,
    // so this is safe and never disrupts partial input.
    this.onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        this.waitForUpdate(true);
      }
    };
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('focus', this.onVisibilityChange);
    // Realtime (Phase 4): a WS invalidation, once coalesced by the sync
    // coordinator, wakes the SAME guarded refresh as a visibility/focus wake.
    // The poll handler still decides GO/REFRESH/WAIT and skips full refreshes
    // while the viewer is mid-prompt, so this never disrupts partial input.
    // Polling remains the fallback; when realtime is disabled no wake ever fires.
    this.realtimeWakeOff = onRealtimeWake(() => this.waitForUpdate(true));
  },
  unmounted() {
    // Detach the exact listeners added in mounted() (a genuine unmount — game
    // boundary or the legacy tm_remount flag's per-response remount).
    if (this.onVisibilityChange !== undefined) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('focus', this.onVisibilityChange);
      this.onVisibilityChange = undefined;
    }
    if (this.realtimeWakeOff !== undefined) {
      this.realtimeWakeOff();
      this.realtimeWakeOff = undefined;
    }
    // Stop the title spinner on a genuine unmount. (Under the legacy remount
    // flag the successor instance's immediate `waitingfor` watcher re-arms it.)
    window.clearInterval(documentTitleTimer);
    // Stop the self-re-arming poll chain. `ui_update_timeout_id` is module-level
    // and `askForUpdate` re-arms itself, so without clearing it here (and
    // guarding `waitForUpdate` on `pollStopped`) leaving a game to a non-game
    // screen would leave an orphaned `/api/waitingfor` poller hammering forever.
    this.pollStopped = true;
    window.clearTimeout(ui_update_timeout_id);
    ui_update_timeout_id = undefined;
  },
  computed: {
    Phase(): typeof Phase {
      return Phase;
    },
    preferences(): typeof getPreferences {
      return getPreferences;
    },
    playerColorClass(): typeof playerColorClass {
      return playerColorClass;
    },
    // A nested "pick a card from hand" SelectCard (Mars University discard) handed
    // off to the КАРТЫ В РУКЕ overlay — suppress this modal (keep it mounted,
    // hidden) so the overlay below its z-index is interactable, then re-show.
    clientHandPickActive(): boolean {
      return isClientHandPickActive();
    },
    // A РАЗЫГРАНО board pick (a >3-candidate card-target, e.g. the Venus bonus
    // wild on-card pick) handed off to the played-cards overlay — suppress this
    // modal (keep it mounted, hidden) so the board below is interactable.
    playedPickActive(): boolean {
      return playedCardsPickState.active;
    },
    // PRESENTATION FLOW: the "player is reading what just happened" hold —
    // true while the compact AI-turn card is visible or the theater is open.
    // Reactive: reads the orchestrator's flags, so the modal mounts the
    // moment the hold clears (dismiss / TTL / theater close).
    presentationHeld(): boolean {
      return isMandatoryPromptsHeld();
    },
    useModalForCurrentInput(): boolean {
      /*
       * Modal hosted by WaitingFor handles non-card prompts
       * (payment, WGT). The card / waiting-state flow has moved to
       * `DraftFlowOverlay` mounted at App level.
       */
      const wf = this.waitingfor;
      if (wf === undefined) {
        return false;
      }
      // A top-level `projectCard` is hosted by a dedicated overlay, not the
      // modal: "play a card from hand" (EccentricSponsor / EcologyExperts,
      // candidates ⊆ hand) → КАРТЫ В РУКЕ overlay; "play a standard project"
      // (EstablishedMethods, candidates are standard projects) → Standard
      // Projects overlay. Suppress the modal route for both. (A degenerate
      // projectCard matching neither still falls back to the modal.)
      if (wf.type === 'projectCard' &&
          (handPlayPrompt(this.playerViewForPrompt) !== undefined ||
           standardProjectPlayPrompt(this.playerViewForPrompt) !== undefined)) {
        return false;
      }
      // The corporation first-action OrOptions ('Take first action of X
      // corporation') is hosted by StartGameFlowOverlay (App level) while the
      // start flow is active — suppress the modal route so ModernOptionPicker
      // doesn't also render it, and so the Pass option is never shown.
      if (startFlowCorpPrompt(this.playerViewForPrompt) !== undefined &&
          startGameFlowActive(this.playerViewForPrompt)) {
        return false;
      }
      // A FREE award-funding OrOptions (Vitor start action) is hosted by the
      // modern AwardsOverlay in free-sponsorship mode — suppress the generic
      // option modal so the player picks the award in its full visual context.
      if (freeAwardFundingPrompt(this.playerViewForPrompt) !== undefined) {
        return false;
      }
      return shouldRouteToModal(wf);
    },
    isWgtInput(): boolean {
      return this.wgtInput !== undefined;
    },
    // Narrowed reference to the current waitingfor when it's the WGT
    // prompt — typed as OrOptionsModel so the dedicated component receives
    // the right shape (the raw `waitingfor` prop is a union).
    wgtInput(): OrOptionsModel | undefined {
      const wf = this.waitingfor;
      if (wf === undefined || wf.type !== 'or') {
        return undefined;
      }
      return titleText(wf.title) === WGT_TITLE ? wf : undefined;
    },
    // PlayerViewModel narrow cast for child components that need
    // player-specific fields. By the time we hit this computed there's
    // always a waitingfor, which only exists for actual players (never
    // spectators) — so the cast is safe.
    playerViewForPrompt(): PlayerViewModel {
      return this.playerView as PlayerViewModel;
    },
    // Title fed into the modal so the minimized pill can show what
    // prompt is awaiting decision. Reads off the current waitingfor.
    // Draft / waiting-state titles are now driven by DraftFlowOverlay,
    // not this modal.
    modalPillTitle(): string | Message {
      return this.waitingfor?.title ?? '';
    },
    // Narrowed reference to the current waitingfor when it's a
    // top-level SelectSpace (server-driven mandatory tile placement —
    // standard projects, action card placements, etc.). Used to drive
    // the always-visible PlacementBanner. Nested SelectSpace prompts
    // (inside OrOptions like convert-plants or WGT) are NOT detected
    // here — those flows render their own banner (convert-plants from
    // PlayerHome) or use the modal picker-mode mechanism (WGT).
    topLevelSpaceInput(): SelectSpaceModel | undefined {
      const wf = this.waitingfor;
      if (wf === undefined || wf.type !== 'space') {
        return undefined;
      }
      return wf;
    },
  },
});

</script>

