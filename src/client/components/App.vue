<template>
  <div :class="'topmost-'+screen">
    <!-- Dev-only modal-input visual playground (URL: ?modalPlayground). -->
    <ModalInputPlayground v-if="showModalPlayground" />
    <!-- Dev-only effects-overlay visual playground (URL: ?effectsPlayground). -->
    <EffectsPlayground v-if="showEffectsPlayground" />
    <!-- Dev-only actions-overlay visual playground (URL: ?actionsPlayground). -->
    <ActionsPlayground v-if="showActionsPlayground" />
    <!-- Dev-only player-cube visual playground (URL: ?cubePlayground). -->
    <PlayerCubePlayground v-if="showCubePlayground" />
    <!-- Dev-only premium-card-face showcase (URL: ?premiumCardsPlayground). -->
    <PremiumCardsPlayground v-if="showPremiumCardsPlayground" />
    <!-- Dev-only archive-entry (card lore) showcase (URL: ?lorePlayground). -->
    <CardLorePlayground v-if="showLorePlayground" />
    <!--
      Game-screen atmosphere backdrop. Mounted ONLY on in-game screens
      (player-home / spectator-home) — start / create / load / the-end
      each have their own backdrop styling and don't want the layered
      space scene. `v-if` keeps DOM cost zero outside game screens.
      The component itself uses `position: fixed; z-index: -50..-44`
      so it sits behind all UI without affecting layout / hitbox.
    -->
    <GameAtmosphere v-if="screen === 'player-home' || screen === 'spectator-home'" />
    <!-- PREMIUM LOADING SCREEN (P10): covers the deliberate game-boundary
         reload + the player-view boot fetch, hosts the fullscreen-restore
         prompt and the error/retry state. Above everything (its own z). -->
    <transition name="con-layer">
      <ConsoleLoadingScreen v-if="loadingScreenState.active" />
    </transition>
    <!-- APP BOOT LOADER: premium launch screen + GPU shader warm-up, shown once
         per session over everything (its own z=13000), then fades out. -->
    <transition name="boot-fade">
      <AppBootLoader v-if="bootWarmupState.active" />
    </transition>
    <section>
      <dialog id="alert-dialog" class="alert-dialog">
        <form method="dialog">
          <p id="alert-title" class="title" v-i18n>Error with input</p>
          <p id="alert-dialog-message"></p>
          <menu class="dialog-menu centered-content">
            <button id="alert-dialog-button" class="btn btn-lg btn-primary">OK</button>
          </menu>
        </form>
      </dialog>
    </section>
    <div class="main-container">
      <!--
        CONSOLE MODE (pre-game): the main menu + create-game screens have
        console-native shells — state-based pad navigation, own command bar,
        no DOM-focus dependence. Same routing/screen ids, same shared create
        state, so toggling the mode (hold Menu) swaps the shell in place.
      -->
      <console-main-menu
        v-if="screen === 'main-menu' && consoleModeState.enabled"
      ></console-main-menu>
      <premium-main-menu v-else-if="screen === 'main-menu'"></premium-main-menu>
      <console-create-game
        v-else-if="screen === 'premium-create-game' && consoleModeState.enabled"
      ></console-create-game>
      <premium-create-game
        v-else-if="screen === 'premium-create-game'"
      ></premium-create-game>
      <start-screen v-else-if="screen === 'start-screen'"></start-screen>
      <create-game-form
        v-else-if="screen === 'create-game-form'"
      ></create-game-form>
      <load-game-form v-else-if="screen === 'load'"></load-game-form>
      <game-home
        v-else-if="screen === 'game-home' && game !== undefined"
        :game="game"
      ></game-home>
      <!--
        No-remount update model (docs/REMOUNT_ANIMATION_REWORK_DESIGN.md, Phase 1):
        the game subtree is NOT keyed on `playerkey` anymore — a fresh
        playerView snapshot applies reactively and the tree lives across
        server responses. `playerkey` is passed as `reset-epoch` instead:
        PlayerHome watches it and performs the explicit transient-UI reset
        (close overlays / pending modals) exactly where the old remount used
        to fire — same bump sites, same preserve guards, same semantics.
        `playerHomeKey` is a constant unless the `tm_remount` rollback flag
        restores the legacy full-remount behavior.
      -->
      <!--
        Console Mode (docs/CONSOLE_MODE_CONCEPT.md): the ONE in-game shell.
        The frozen desktop <player-home> branch and its App-level overlay
        stack were CUT in desktop-removal wave 1 (2026-08-22) — console is
        unconditional now; the future desktop UI will be built FROM this
        shell. Files remain on disk until the later deletion waves.
      -->
      <ConsoleShell
        v-else-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView"
        :waiting-on-players="playersWaitingFor"
      ></ConsoleShell>
      <!-- Desktop-removal wave 1: DraftFlowOverlay / StartGameFlowOverlay /
           DrawCardRevealFlow / RevealResultOverlay / MaCeremonyOverlay (all
           gated `!consoleModeState.enabled`) were cut — the console serves
           every one of these flows natively (ConsoleTaskHost / start scene /
           ConsoleRevealOverlay / the MA ceremony in ConsoleShell). -->
      <!--
        End-of-generation Energy → Heat conversion transition. App-level (like
        DraftFlowOverlay) so the `:key="playerkey"` remount can't tear down the
        arrow / paired chips mid-animation. Self-gates via
        energyConversionState.active; positions itself from the live energy /
        heat resource-cell rects.
      -->
      <EnergyConversionOverlay
        v-if="screen === 'player-home' && playerView !== undefined" />
      <!-- Desktop-removal wave 1: BotTurnReviewOverlay cut — the console
           renders the same botTurnReviewState through ConsoleBotTurnReview. -->
      <!--
        Hazard-cleanup sequence overlay. App-level so it survives the playerkey
        remount; self-gates via hazardCleanupState.active; positions itself over
        the cleared board hex. Visible for own AND opponent cleanups (poll path).
      -->
      <HazardCleanupOverlay
        v-if="screen === 'player-home' || screen === 'spectator-home'" />
      <!--
        Detailed "additional resource" summary overlay. App-level (like the
        journal) so the `:key="playerkey"` remount can't tear it down while
        open. Driven entirely by module-level additionalResourcesState, which
        the ДОП. РЕСУРСЫ side panel writes when a row is clicked; the overlay
        re-resolves the live player by colour so it tracks resource changes.
      -->
      <AdditionalResourceDetailOverlay
        v-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView" />
      <!--
        Persistent "exit to main menu" corner button. App-level so it survives
        the playerkey remount AND is available during the initial draft (where
        the right sidebar isn't present). Hidden once the game is over — the
        endgame screen provides its own "to main menu" control then.
      -->
      <GameExitButton
        v-if="(screen === 'player-home' || screen === 'spectator-home') && endgameView === undefined" />
      <!--
        Rematch coordination layer. App-level (like the endgame experience) so it
        survives the `:key="playerkey"` remount and keeps polling `/api/game/rematch`
        while the game is over. Hosts the "accept rematch?" prompt + the "rematch
        ready" / "declined" notices. Its own `v-if` (independent of the endgame
        v-if/v-else-if screen chain below).
      -->
      <RematchLayer
        v-if="endgameView !== undefined"
        :view="endgameView"
        :headless="endgameConsoleNative" />
      <!--
        Premium end-of-game experience. App-level (like DraftFlowOverlay) so the
        `:key="playerkey"` remount can't tear down the reveal / results overlay.
        Gated by `endgameView` (the active player/spectator view ONLY when the
        game has reached Phase.END), so it never shows mid-game.

        CONSOLE NATIVE: the console shell runs its own scoring workspace, so
        there this component is only the detailed-overlay host («Обзор
        партии») — no auto reveal, no pill (see EndgameExperience).
      -->
      <EndgameExperience
        v-if="endgameView !== undefined"
        :view="endgameView"
        :viewer-color="endgameViewerColor"
        :console-native="endgameConsoleNative" />
      <spectator-home
        v-else-if="screen === 'spectator-home' && spectator !== undefined"
        :spectator="spectator"
        :key="'spectator-' + playerHomeKey"
      ></spectator-home>
      <game-end
        v-else-if="screen === 'the-end'"
        :player-view="playerView"
        :spectator="spectator"
      ></game-end>
      <games-overview
        v-else-if="screen === 'games-overview'"
      ></games-overview>
      <card-list v-else-if="screen === 'cards'"></card-list>
      <admin-home v-else-if="screen === 'admin'"></admin-home>
      <login-home v-else-if="screen === 'login-home'"></login-home>
      <help v-else-if="screen === 'help'"></help>

      <!-- Desktop-removal wave 1: the desktop JournalPanel cut — the console
           journal shell (ConsoleJournalPanel, mounted by ConsoleShell) reads
           the same shared journal data source. -->

      <!--
        Premium NOTIFICATION layer. App-level (like the journal) so the
        `:key="playerkey"` remount on every server response can't tear it
        down — the queue / seen-set / live cards must survive it. Surfaces
        important game events (opponents' plays, your turn, mandatory
        decisions, milestones, …) as floating sci-fi cards even when the
        journal is collapsed. Driven entirely by module-level
        notificationState + the same journal streams it links back to.
      -->
      <NotificationLayer
        v-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView" />

      <!--
        TurnHandoff presentation layer. App-level (like NotificationLayer) so it
        survives the `:key="playerkey"` remount. Drives the start-of-turn
        "command activation" on the active player's card (cube ignition +
        command brackets + a transient status burst), the inactivity-only idle
        reminder, and the optional handoff beam — the start of a turn becomes a
        change of interface STATE, not another toast.
      -->
      <TurnHandoffLayer
        v-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView" />

      <!-- Desktop-removal wave 1: the desktop RevealedCardsModal cut — the
           console serves reveal viewing through its own overlay family. -->

      <!--
        Per-effect detail modal opened from a «сработал эффект» notification —
        shows ONE card's passive effect (graphic + description + per-game stats),
        reusing the Эффекты overlay's EffectDetailsPanel.
      -->
      <EffectDetailOverlay
        v-if="screen === 'player-home' && playerView !== undefined"
        :viewer-id="playerView.id"
        :players="playerView.players" />

      <!--
        Phase 1 realtime transport layer (WebSocket diagnostics only — NO
        gameplay behaviour change). App-level so the singleton service survives
        the playerkey remount. Owns the realtime service lifecycle (start/stop
        tied to being on a game screen) + a dev-only connection-status chip.
        Gated by the client realtime flag (default OFF): inert when disabled.
      -->
      <RealtimeLayer
        v-if="(screen === 'player-home' || screen === 'spectator-home') && realtimeParticipantId !== ''"
        :participant-id="realtimeParticipantId" />

      <!--
        Premium GAMEPAD layer (docs/GAMEPAD_SUPPORT_DESIGN.md). App-level (like
        NotificationLayer) so the controller mode / focus survives the
        legacy-flag remount and every server response. Mounted on EVERY
        screen (full console lifecycle: menu → create → lobby → game →
        endgame — docs/CONSOLE_MODE_CONCEPT.md). Fully inert until a pad button
        is pressed; `?gp=0` / the gamepad_enabled preference kill it
        entirely (mouse/keyboard players byte-identical).
      -->
      <GamepadLayer v-if="screen !== 'empty'" :screen="screen" />
      <!-- Desktop-only (Electron) mandatory-update overlay. Inert on the web. -->
      <desktop-update-overlay />
    </div>
  </div>
</template>

<script lang="ts">
import {defineAsyncComponent, defineComponent, nextTick} from 'vue';
import * as constants from '@/common/constants';

const AdminHome = defineAsyncComponent(() => import(/* webpackChunkName: "admin" */ '@/client/components/admin/AdminHome.vue'));
const CardList = defineAsyncComponent(() => import(/* webpackChunkName: "card-list" */ '@/client/components/cardlist/CardList.vue'));
const CreateGameForm = defineAsyncComponent(() => import(/* webpackChunkName: "create-game" */ '@/client/components/create/CreateGameForm.vue'));
const GameEnd = defineAsyncComponent(() => import(/* webpackChunkName: "game-end" */ '@/client/components/GameEnd.vue'));
const GameHome = defineAsyncComponent(() => import(/* webpackChunkName: "game-home" */ '@/client/components/GameHome.vue'));
const GamesOverview = defineAsyncComponent(() => import(/* webpackChunkName: "games-overview" */ '@/client/components/GamesOverview.vue'));
const Help = defineAsyncComponent(() => import(/* webpackChunkName: "help" */ '@/client/components/help/Help.vue'));
const LoginHome = defineAsyncComponent(() => import(/* webpackChunkName: "login" */ '@/client/components/auth/LoginHome.vue'));
const LoadGameForm = defineAsyncComponent(() => import(/* webpackChunkName: "load-game" */ '@/client/components/LoadGameForm.vue'));
// Desktop-removal wave 1: the PlayerHome async chunk is no longer referenced —
// the console shell is the one in-game UI. The file (and its subtree) stays on
// disk until the deletion waves; nothing imports it, so nothing bundles it.
const SpectatorHome = defineAsyncComponent(() => import(/* webpackChunkName: "spectator-home" */ '@/client/components/SpectatorHome.vue'));
const StartScreen = defineAsyncComponent(() => import(/* webpackChunkName: "start-screen" */ '@/client/components/StartScreen.vue'));
// Premium sci-fi launcher — the new default landing screen ('/'). The legacy
// StartScreen lives on at '/legacy'. Async so its background/assets only load
// when the menu is actually shown.
const PremiumMainMenu = defineAsyncComponent(() => import(/* webpackChunkName: "main-menu" */ '@/client/components/mainMenu/PremiumMainMenu.vue'));
// Console-native pre-game shells (state-based pad navigation, no DOM focus) —
// mounted INSTEAD of the premium desktop screens while console mode is on.
const ConsoleMainMenu = defineAsyncComponent(() => import(/* webpackChunkName: "console-menu" */ '@/client/components/console/menu/ConsoleMainMenu.vue'));
const ConsoleCreateGame = defineAsyncComponent(() => import(/* webpackChunkName: "console-menu" */ '@/client/components/console/menu/ConsoleCreateGame.vue'));
// Premium "Mission Control" create-game screen — opened from the premium menu.
const PremiumCreateGame = defineAsyncComponent(() => import(/* webpackChunkName: "premium-create-game" */ '@/client/components/create/premium/PremiumCreateGame.vue'));
import AppBootLoader from '@/client/components/boot/AppBootLoader.vue';
import {bootWarmupState, shouldRunBootWarmup, beginBootWarmup} from '@/client/components/boot/bootWarmupState';
import RematchLayer from '@/client/components/rematch/RematchLayer.vue';
import GameExitButton from '@/client/components/GameExitButton.vue';
import EnergyConversionOverlay from '@/client/components/feedback/EnergyConversionOverlay.vue';
import HazardCleanupOverlay from '@/client/components/feedback/HazardCleanupOverlay.vue';
import {
  detectEnergyConversion,
  endEnergyConversion,
  isEnergyConversionActive,
  runEnergyConversion,
} from '@/client/components/feedback/energyConversionTransition';
import {isTradeFleetActive} from '@/client/console/colonyFleet/consoleTradeFleet';
import {isHydroMarkerActive} from '@/client/console/hydroMarker/consoleHydroMarker';
import {isPlayedHeroActive} from '@/client/console/played/consolePlayedHero';
import {isPatentSaleActive} from '@/client/console/patentSale/consolePatentSale';
import {isCardDiscardActive} from '@/client/console/cardDiscard/consoleCardDiscard';
import {isTilePlacementActive} from '@/client/console/tilePlacement/consoleTilePlacement';
import {presentFreshBotTurns} from '@/client/components/marsbot/marsBotPresentation';
import {armDeferredViewRefresh, disarmDeferredViewRefresh} from '@/client/components/deferredViewRefresh';
import {
  applyHazardTileSwap,
  detectHazardCleanup,
  endHazardCleanup,
  isHazardCleanupActive,
  runHazardCleanup,
} from '@/client/components/feedback/hazardCleanupTransition';
// Premium end-of-game experience (winner reveal + full-screen results). Async
// so its charts / tabs only download once a game actually ends.
const EndgameExperience = defineAsyncComponent(() => import(/* webpackChunkName: "endgame" */ '@/client/components/endgame/EndgameExperience.vue'));
const ModalInputPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "modal-input-playground" */ '@/client/components/modalInputs/ModalInputPlayground.vue'));
const EffectsPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "effects-playground" */ '@/client/components/effects/EffectsPlayground.vue'));
const ActionsPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "actions-playground" */ '@/client/components/actions/ActionsPlayground.vue'));
const PlayerCubePlayground = defineAsyncComponent(() => import(/* webpackChunkName: "player-cube-playground" */ '@/client/components/PlayerCubePlayground.vue'));
const PremiumCardsPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "premium-cards-playground" */ '@/client/components/premiumCard/PremiumCardsPlayground.vue'));
const CardLorePlayground = defineAsyncComponent(() => import(/* webpackChunkName: "card-lore-playground" */ '@/client/components/card/CardLorePlayground.vue'));
import NotificationLayer from '@/client/components/notifications/NotificationLayer.vue';
import GamepadLayer from '@/client/components/gamepad/GamepadLayer.vue';
import {consoleModeState, requestConsoleFullscreen} from '@/client/console/consoleModeState';
import {showConsoleAlert} from '@/client/console/consoleSystemAlertState';
import ConsoleLoadingScreen from '@/client/components/console/ConsoleLoadingScreen.vue';
import {beginLoading, consumeBootFlags, endLoading, failLoading, loadingScreenState} from '@/client/console/loadingScreenState';
const ConsoleShell = defineAsyncComponent(() => import(/* webpackChunkName: "console-shell" */ '@/client/components/console/ConsoleShell.vue'));
import TurnHandoffLayer from '@/client/components/overview/TurnHandoffLayer.vue';
import EffectDetailOverlay from '@/client/components/notifications/EffectDetailOverlay.vue';
import RealtimeLayer from '@/client/components/realtime/RealtimeLayer.vue';
import DesktopUpdateOverlay from '@/client/components/desktop/DesktopUpdateOverlay.vue';
import {initDesktopUpdates} from '@/client/components/desktop/desktopUpdateState';
import {perfMark} from '@/client/utils/perfMarks';
import {legacyRemountEnabled} from '@/client/utils/legacyRemount';
import {nextViewSnapshot} from '@/client/utils/viewSnapshotShare';
import {reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import AdditionalResourceDetailOverlay from '@/client/components/additionalResources/AdditionalResourceDetailOverlay.vue';
import {setLiveCardResources} from '@/client/components/card/liveCardResources';
import {bindPrivateScoreGame} from '@/client/components/overview/privateScoreState';
import GameAtmosphere from '@/client/components/GameAtmosphere.vue';
import {$t, setTranslationContext} from '@/client/directives/i18n';
import {paths} from '@/common/app/paths';
import {apiUrl, identitySearch} from '@/client/utils/runtimeConfig';
import {shouldPreserveCardPickModal} from '@/client/components/draftWaitState';
import {shouldPreserveInitialDraftOverlay} from '@/client/components/initialDraft/initialDraftSharedState';
import {shouldPreserveSaleOverlay} from '@/client/components/handCards/sellPatentsState';
import {
  armPlacementAnimations,
  shouldHoldForTilePlacement,
} from '@/client/components/board/tilePlacementAnimation';
import {shouldHoldForMarkerPlacement} from '@/client/components/board/markerPlacementAnimation';
import {shouldHoldForOwnerCubePlacement} from '@/client/components/board/cubeDropState';
import {stageRemotePlacements} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {endgameAvailable} from '@/client/components/endgame/endgameState';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {SimpleGameModel} from '@/common/models/SimpleGameModel';
import {SpectatorModel} from '@/common/models/SpectatorModel';
import {Color} from '@/common/Color';
import {isPlayerId, isSpectatorId} from '@/common/Types';
import {hasShowModal, showModal, windowHasHTMLDialogElement} from './HTMLDialogElementCompatibility';

import dialogPolyfill from 'dialog-polyfill';
import {setDocumentTitle} from '../utils/documentTitle';

type Screen = 'admin' |
            'create-game-form' |
            'cards' |
            'empty' |
            'game-home' |
            'games-overview' |
            'help' |
            'load' |
            'login-home' |
            'main-menu' |
            'premium-create-game' |
            'player-home' |
            'spectator-home' |
            'start-screen' |
            'the-end';
export type MainAppData = {
    screen: Screen;
    /**
     * player or spectator are set once the app component has loaded.
     * Vue only watches properties that exist initially. When we
     * use this property we can't trigger vue state without
     * a refactor.
     */
    spectator?: SpectatorModel;
    playerView?: PlayerViewModel;
    // The transient-UI RESET EPOCH. Historically this was the `:key` of
    // <player-home> — bumping it forced a full remount per server response.
    // Since the no-remount rework (docs/REMOUNT_ANIMATION_REWORK_DESIGN.md) the
    // subtree is no longer keyed on it: a bump now only triggers PlayerHome's
    // explicit `resetTransientUi()` (close overlays / pending modals — the
    // same reset the remount used to perform implicitly). The bump SITES and
    // the preserve guards around them are unchanged, so "when the UI resets"
    // is byte-identical to the legacy behavior. The `tm_remount` flag
    // (legacyRemount.ts) restores the old keyed-remount path.
    playerkey: number;
    isServerSideRequestInProgress: boolean;
    componentsVisibility: {[x: string]: boolean};
    game: SimpleGameModel | undefined;
    login: string | undefined;
    /**
     * Live list of players the SERVER is currently waiting on for input.
     * Updated every poll from `/api/waitingFor` (see WaitingFor.vue), even
     * while the viewer themselves is mid-prompt — that way the spinning
     * cube and status label stay in sync across simultaneous-action phases
     * (drafting / research) without forcing a full playerView refresh that
     * would reset the viewer's partial input state.
     */
    playersWaitingFor: ReadonlyArray<Color>;
}

// NOTE: this simplistic truncation to the last segment might cause issues if
// this page starts supporting paths more than one level deep.
function getLastPathSegment() {
  // Leave only the last part of /path
  return window.location.pathname.replace(/.*\//g, '');
}

export default defineComponent({
  name: 'App',
  data(): MainAppData {
    return {
      screen: 'empty',
      playerkey: 0,
      isServerSideRequestInProgress: false,
      componentsVisibility: {
        'milestones': true,
        'awards_list': true,
        'tags_concise': false,
        'pinned_player_0': false,
        'pinned_player_1': false,
        'pinned_player_2': false,
        'pinned_player_3': false,
        'pinned_player_4': false,
        'turmoil_parties': false,
      } as {[x: string]: boolean},
      game: undefined as SimpleGameModel | undefined,
      playerView: undefined,
      spectator: undefined,
      login: undefined,
      playersWaitingFor: [] as ReadonlyArray<Color>,
    };
  },
  components: {
    'premium-main-menu': PremiumMainMenu,
    'premium-create-game': PremiumCreateGame,
    'console-main-menu': ConsoleMainMenu,
    'console-create-game': ConsoleCreateGame,
    'start-screen': StartScreen,
    'create-game-form': CreateGameForm,
    'load-game-form': LoadGameForm,
    'game-home': GameHome,
    'spectator-home': SpectatorHome,
    'game-end': GameEnd,
    'games-overview': GamesOverview,
    'card-list': CardList,
    'help': Help,
    'admin-home': AdminHome,
    'login-home': LoginHome,
    AppBootLoader,
    EnergyConversionOverlay,
    HazardCleanupOverlay,
    RematchLayer,
    GameExitButton,
    EndgameExperience,
    ModalInputPlayground,
    EffectsPlayground,
    ActionsPlayground,
    PlayerCubePlayground,
    PremiumCardsPlayground,
    CardLorePlayground,
    NotificationLayer,
    GamepadLayer,
    ConsoleShell,
    ConsoleLoadingScreen,
    TurnHandoffLayer,
    EffectDetailOverlay,
    RealtimeLayer,
    DesktopUpdateOverlay,
    AdditionalResourceDetailOverlay,
    GameAtmosphere,
  },
  watch: {
    // P10: the loading curtain drops the moment a REAL screen is resolved
    // (menu screens resolve synchronously; game screens only after the
    // player view arrived — exactly the gap the curtain must cover). A
    // failed load keeps the curtain in its error/retry state instead.
    screen(now: Screen) {
      if (now !== 'empty' && loadingScreenState.active && loadingScreenState.error === '') {
        // A fast load can drop the curtain before the player used its
        // fullscreen-restore prompt — hand the restore to the shared
        // trusted-gesture retry instead (the next real click/key brings
        // fullscreen back; on the Xbox browser the pad sends real keys).
        if (loadingScreenState.fullscreenLost && consoleModeState.enabled) {
          requestConsoleFullscreen();
          loadingScreenState.fullscreenLost = false;
        }
        endLoading();
      }
    },
    // Single point that reconciles the server's reveal list into the
    // module-level drawnCardsState, regardless of WHICH update path replaced
    // playerView (poll App.update, POST-input WaitingFor.updatePlayerView,
    // DraftFlowOverlay, the reveal ack response, undo). playerView is replaced
    // wholesale each update so this shallow watch always fires. On initial
    // load / refresh the server queue is empty (transient) → no modal.
    playerView(view: PlayerViewModel | undefined) {
      reconcileDrawnCards(view?.cardDrawReveals ?? []);
      // Refresh the global name→live-resource map so card popups / fullscreens
      // (journal, etc.) render the real resource count, not 0. See
      // liveCardResources.ts. Fires on EVERY playerView replacement.
      setLiveCardResources(view);
      // Bind the PER-GAME "private score" preference to this game (the viewer's
      // participant id). Idempotent — only a real game switch re-loads the
      // stored value; leaving the game (view undefined) resets it to OFF. The
      // central spot both shells (console + desktop) share.
      bindPrivateScoreGame(view?.id);
    },
  },
  computed: {
    // Console Mode flag (module reactive) exposed to the template — drives
    // the ConsoleShell vs PlayerHome shell split (docs/CONSOLE_MODE_CONCEPT.md).
    consoleModeState() {
      return consoleModeState;
    },
    loadingScreenState() {
      return loadingScreenState;
    },
    bootWarmupState() {
      return bootWarmupState;
    },
    // Participant id (playerId or spectatorId) for the realtime transport layer.
    // Empty string when not on a game screen, which keeps the layer inert.
    realtimeParticipantId(): string {
      return this.playerView?.id ?? this.spectator?.id ?? '';
    },
    // The `:key` of <player-home> / <spectator-home>. A CONSTANT by default —
    // the game subtree persists across server responses and updates reactively
    // (`playerkey` rides in as the `reset-epoch` prop instead). The legacy
    // rollback flag (`?remount=1` / localStorage tm_remount=1) rebinds the key
    // to `playerkey`, restoring the historical full-remount-per-update model.
    playerHomeKey(): number | string {
      return legacyRemountEnabled() ? this.playerkey : 'stable';
    },
    // Dev-only: render the modal-input visual playground when the URL carries
    // `?modalPlayground` (or `&modalPlayground`). Never shown in normal play.
    showModalPlayground(): boolean {
      return window.location.search.includes('modalPlayground');
    },
    // Dev-only: render the effects-overlay playground when the URL carries
    // `?effectsPlayground`. Never shown in normal play.
    showEffectsPlayground(): boolean {
      return window.location.search.includes('effectsPlayground');
    },
    // Dev-only: render the actions-overlay playground when the URL carries
    // `?actionsPlayground`. Never shown in normal play.
    showActionsPlayground(): boolean {
      return window.location.search.includes('actionsPlayground');
    },
    // Dev-only: render the player-cube playground when the URL carries
    // `?cubePlayground`. Never shown in normal play.
    showCubePlayground(): boolean {
      return window.location.search.includes('cubePlayground');
    },
    // Dev-only: render the premium-card-face showcase when the URL carries
    // `?premiumCardsPlayground`. Never shown in normal play.
    showPremiumCardsPlayground(): boolean {
      return window.location.search.includes('premiumCardsPlayground');
    },
    // Dev-only: render the archive-entry (card lore) showcase when the URL
    // carries `?lorePlayground`. Never shown in normal play.
    showLorePlayground(): boolean {
      return window.location.search.includes('lorePlayground');
    },
    // The active view (player or spectator) ONLY when its game has ended —
    // drives the App-level EndgameExperience mount. Undefined mid-game.
    endgameView(): ViewModel | undefined {
      if (this.screen === 'player-home' && endgameAvailable(this.playerView)) {
        return this.playerView;
      }
      if (this.screen === 'spectator-home' && endgameAvailable(this.spectator)) {
        return this.spectator;
      }
      return undefined;
    },
    endgameViewerColor(): Color | undefined {
      if (this.screen === 'player-home') {
        return this.playerView?.thisPlayer?.color;
      }
      if (this.screen === 'spectator-home') {
        return this.spectator?.color;
      }
      return undefined;
    },
    // The CONSOLE SHELL owns the post-game (its own scoring workspace): the
    // desktop endgame surfaces go headless there. Spectators have no console
    // shell — they keep the full desktop experience even with console mode on.
    endgameConsoleNative(): boolean {
      return this.screen === 'player-home' && consoleModeState.enabled;
    },
  },
  methods: {
    showAlert(title: string, message: string, cb: () => void = () => {}): void {
      // Console mode: the native <dialog> OK button is unreachable by the pad,
      // so a server error froze the shell. Route to the pad-navigable
      // console-native alert instead (dismiss with A/B).
      if (consoleModeState.enabled) {
        showConsoleAlert(title, message, cb);
        return;
      }
      const dialogElement: HTMLElement | null = document.getElementById('alert-dialog');
      const buttonElement: HTMLElement | null = document.getElementById('alert-dialog-button');
      const messageElement: HTMLElement | null = document.getElementById('alert-dialog-message');
      const titleElement: HTMLElement | null = document.getElementById('alert-dialog-title');
      if (buttonElement !== null && titleElement !== null && messageElement !== null && dialogElement !== null && hasShowModal(dialogElement)) {
        messageElement.innerHTML = $t(message);
        titleElement.textContent = $t(title);
        const handler = () => {
          buttonElement.removeEventListener('click', handler);
          cb();
        };
        buttonElement.addEventListener('click', handler);
        showModal(dialogElement);
      } else {
        alert(message);
        cb();
      }
    },
    setVisibilityState(targetVar: string, isVisible: boolean) {
      if (isVisible === this.getVisibilityState(targetVar)) {
        return;
      }
      (this as unknown as MainAppData).componentsVisibility[targetVar] = isVisible;
    },
    getVisibilityState(targetVar: string): boolean {
      return (this as unknown as MainAppData).componentsVisibility[targetVar] ? true : false;
    },
    update(path: typeof paths.PLAYER | typeof paths.SPECTATOR): void {
      const currentPathname = getLastPathSegment();
      const app = this as unknown as MainAppData;

      const url = apiUrl('api/' + path) + identitySearch().replace('&noredirect', '');

      // Ingest-phase marks (perfMarks — no-ops unless ?perf=1): the probe reads
      // fetch → json → commit → flush deltas off these to attribute a model
      // update's cost between network/server, parse, reactive apply and render.
      perfMark('ingest:fetch:start');
      fetch(url)
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`Error getting game data: ${resp.statusText}`);
          }
          perfMark('ingest:fetch:resp');
          return resp.json();
        })
        .then((model: ViewModel) => {
          perfMark('ingest:json:done');
          /*
           * Re-entrancy guard for live scene transitions: while one is
           * animating we must NOT swap playerView (that would pop panels to
           * their final values mid-animation and open the next-phase modal
           * over a running scene).
           *
           * ⚠️ A REFUSED REFRESH IS A DEBT, NEVER A DROP. This response
           * routinely carries the player's own next prompt (the bot's paced
           * turn resolves ~200 ms after a turn-ending card play and lands
           * exactly while that play's cinematic runs), and the WS wake that
           * triggered this fetch is already consumed — with a healthy socket
           * the next fallback poll is ~20 s away. Dropping the model here
           * measured 21.4 s from «screen free» to «control back». So the
           * refusal parks a retry that re-runs `update()` the moment the
           * scenes release (bounded — see deferredViewRefresh.ts).
           */
          const sceneBlocked = () =>
            isEnergyConversionActive() || isHazardCleanupActive() || isTradeFleetActive() ||
            isHydroMarkerActive() || isPlayedHeroActive() || isPatentSaleActive() ||
            isCardDiscardActive() || isTilePlacementActive();
          if (sceneBlocked()) {
            armDeferredViewRefresh(sceneBlocked, () => this.update(path));
            return;
          }
          // A refresh is committing — any parked retry is superseded by it.
          disarmDeferredViewRefresh();
          /*
           * Same skip-remount logic as WaitingFor.updatePlayerView:
           * if we're continuing within a card-pick flow, swap
           * playerView reactively without bumping playerkey so the
           * MandatoryInputModal hosting the draft / buy UI stays
           * mounted. Spectator updates always remount (no
           * draft-modal lifecycle to preserve for them).
           */
          const preserveCardPickModal =
            path === paths.PLAYER &&
            (shouldPreserveCardPickModal(model as PlayerViewModel) ||
             shouldPreserveInitialDraftOverlay(model as PlayerViewModel) ||
             shouldPreserveSaleOverlay());
          /*
           * Informational overlays (cards, played cards, achievements,
           * awards, effects, actions, colonies, VP) live inside
           * <player-home>. A poll-driven update from another player's action
           * used to bump playerkey and destroy that subtree, resetting
           * PlayerHome.data().activeOverlay / coloniesOverlayOpen to closed.
           *
           * Skip only THIS App.update remount path while an overlay is already
           * open. The fresh playerView is still swapped reactively, so board,
           * side panels and the overlay contents update in place. Own action
           * POST responses still go through WaitingFor.updatePlayerView(), so
           * the existing "submit from overlay closes the overlay" behavior is
           * preserved.
           */
          // Desktop-removal wave 1: PlayerHome (and its overlay stack) no
          // longer mounts, so there is no desktop overlay left to preserve.
          const preserveOpenOverlay = false;
          /*
           * Arm the Board Placement Animation gate if this polling
           * update introduces a new tile vs. the currently displayed
           * spaces — this is the path that fires when ANOTHER player
           * places a tile (your client just polled and got back a
           * playerView with their new tile). Without arming, the
           * playerkey++ remount below would re-mount BoardSpaceTile
           * with the new tileType but the animation gate would still
           * be closed (it only opens for the local player's own
           * submits via WaitingFor.fetchPlayerInput), and observers
           * would see the tile pop in instantly.
           *
           * Skipped on initial load (`app.playerView === undefined` /
           * `app.spectator === undefined`) — that's the F5 case
           * where the whole board hydrates at once; armed should
           * stay false so existing tiles silently establish their
           * baseline rather than triggering N parallel impact rings.
           */
          const prevView = (path === paths.PLAYER ? app.playerView : app.spectator) as ViewModel | undefined;

          const commit = () => {
            perfMark('playerView:commit');
            /*
             * Console: fresh tiles from OTHER players (this poll path is how
             * an opponent's placement arrives; the staged bot batch's LAST
             * turn also commits through this closure) land with the premium
             * REMOTE flight. Staged in this SAME synchronous block as the
             * commit below, so the tiles commit HIDDEN behind the reveal
             * hold and each becomes visible at its proxy's touchdown — the
             * generic impact entrance below then only serves hazards. A
             * no-op on desktop / reduced motion / no fresh tiles.
             */
            stageRemotePlacements(prevView?.game.spaces, model.game.spaces, {
              aresExtension: model.game.gameOptions?.expansions?.ares === true,
              gamePhase: model.game.phase,
              viewerColor: (model as PlayerViewModel).thisPlayer?.color,
            });
            // …and an OVERLAY MARKER an opponent just placed (a cathedral in
            // one of their cities) gets its own landing instead of popping in —
            // as does a PLAYER MARKER on an empty cell (their Land Claim / an
            // Arcadian community), which is a colour-only diff and so matches
            // neither of the tile-shaped predicates.
            if (prevView !== undefined &&
                (shouldHoldForTilePlacement(prevView.game.spaces, model.game.spaces) ||
                 shouldHoldForMarkerPlacement(prevView.game.spaces, model.game.spaces) ||
                 shouldHoldForOwnerCubePlacement(prevView.game.spaces, model.game.spaces))) {
              armPlacementAnimations();
            }
            // Structural sharing (viewSnapshotShare.ts): the assigned tree is
            // content-identical to the fresh snapshot, but unchanged branches
            // keep their previous references so child components skip
            // re-rendering. The ROOT identity still changes, so this watcher-
            // visible commit behaves exactly like a wholesale swap.
            if (path === paths.PLAYER) {
              app.playerView = nextViewSnapshot(app.playerView, model as PlayerViewModel);
              setTranslationContext(app.playerView);
            } else if (path === paths.SPECTATOR) {
              app.spectator = nextViewSnapshot(app.spectator, model as SpectatorModel);
              setLiveCardResources(app.spectator);
            }
            if (!preserveCardPickModal && !preserveOpenOverlay) {
              app.playerkey++;
            }
            // When the user navigated directly to /the-end, keep that screen.
            if (currentPathname === paths.THE_END) {
              app.screen = 'the-end';
            } else if (path === paths.PLAYER) {
              app.screen = 'player-home';
            } else if (path === paths.SPECTATOR) {
              app.screen = 'spectator-home';
            }
            if (currentPathname !== path && currentPathname !== paths.THE_END) {
              window.history.replaceState(
                model,
                `${constants.APP_NAME} - Game`,
                `${path}?id=${model.id}`,
              );
            }
            perfMark('ingest:commit:done');
            void nextTick(() => perfMark('ingest:flush:done'));
          };

          /*
           * MarsBot turns (poll path) — NOTIFICATION-FIRST, and STAGED only
           * when there is something to SEQUENCE. A response carrying SEVERAL
           * fresh turns is not committed here: it is buffered by the staging
           * window, and each turn's visual footprint (tiles / parameters /
           * resource deltas) applies to the PRESENTED view exactly when that
           * turn's compact card is DELIVERED; the LAST pending turn's delivery
           * performs this full `commit`. Consequences never precede their
           * explanation, and the queued turns' changes are never visible ahead
           * of their card. While a window is open, later polls only refresh the
           * buffered latest (also handled inside — returns true).
           *
           * A response carrying ONE fresh turn falls through to the immediate
           * commit like any other: there is no order to keep, and buffering it
           * only made the player wait out the card's own delivery for their own
           * next prompt. So does a response with no fresh turns and no window.
           */
          if (path === paths.PLAYER &&
              presentFreshBotTurns(prevView, model as PlayerViewModel, {commitLatest: commit})) {
            return;
          }
          /*
           * Energy→heat conversion gate (poll path). When ANOTHER player's
           * action advanced the game into production, the viewer's own
           * conversion arrives via this poll. Play the paired animation and
           * hold the commit (and therefore the research / draft / endgame
           * screen, which all key off playerView) until it finishes. The
           * re-entrancy guard above keeps a concurrent poll from committing
           * mid-animation.
           */
          // Desktop-removal wave 1: the desktop staged setup reveal
          // (primeStartSetupReveal) is gone — the console carries the beat
          // through the deferred corporationPlay + hero landing.
          const conversionEvent = path === paths.PLAYER ?
            detectEnergyConversion(prevView, model as PlayerViewModel) :
            undefined;
          if (conversionEvent !== undefined) {
            runEnergyConversion(conversionEvent).then(() => {
              commit();
              nextTick(() => endEnergyConversion());
            });
            return;
          }
          /*
           * Hazard-cleanup gate (poll path). When ANOTHER player builds over a
           * hazard, the viewer (or a spectator) sees it via this poll — play the
           * cleanup sequence and hold the commit until it finishes, so the
           * opponent's cleanup is just as legible as the viewer's own. The
           * re-entrancy guard above stops a concurrent poll committing mid-run;
           * the shared dedup set stops a double-run with the viewer's own submit.
           */
          const hazardCleanups = detectHazardCleanup(prevView, model as ViewModel);
          if (hazardCleanups.length > 0 && prevView !== undefined) {
            runHazardCleanup(
              hazardCleanups,
              () => applyHazardTileSwap(prevView.game.spaces, model.game.spaces, hazardCleanups),
            ).then(() => {
              commit();
              nextTick(() => endHazardCleanup());
            });
            return;
          }
          commit();
        })
        .catch((err) => {
          // Under the loading curtain the failure becomes the premium
          // error/retry state (P10) — never a bare browser alert there.
          if (loadingScreenState.active) {
            failLoading('Error getting game data');
          } else {
            alert('Error getting game data');
          }
          console.error(err);
        });
    },
    updatePlayer() {
      this.update(paths.PLAYER);
    },
    updateSpectator() {
      this.update(paths.SPECTATOR);
    },
    // In-app SPA routing: resolve the `screen` (and trigger the right data load)
    // from the CURRENT url. Called on initial mount, on in-app navigation
    // (`navigateInApp`), and on browser back/forward (`popstate`). Faithfully
    // reproduces the historical mount-time resolution.
    applyRoute(): void {
      const currentPathname = getLastPathSegment();
      const app = this as unknown as MainAppData & {updatePlayer(): void; updateSpectator(): void};
      if (currentPathname === paths.PLAYER) {
        app.updatePlayer();
      } else if (currentPathname === paths.THE_END) {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id') || '';
        if (isPlayerId(id)) {
          app.updatePlayer();
        } else if (isSpectatorId(id)) {
          app.updateSpectator();
        } else {
          alert('Bad id URL parameter.');
        }
      } else if (currentPathname === paths.GAME) {
        const url = apiUrl(paths.API_GAME) + identitySearch();
        fetch(url)
          .then((resp) => {
            if (!resp.ok) {
              throw new Error(`Error getting game data: ${resp.statusText}`);
            }
            return resp.json();
          })
          .then((appGame: SimpleGameModel) => {
            app.screen = 'game-home';
            app.game = appGame;
            window.history.replaceState(
              appGame,
              `${constants.APP_NAME} - Game`,
              `${paths.GAME}?id=${appGame.id}`,
            );
          })
          .catch((err) => {
            alert('Error getting game data');
            console.error(err);
          });
      } else if (currentPathname === paths.GAMES_OVERVIEW) {
        app.screen = 'games-overview';
      } else if (currentPathname === paths.NEW_GAME) {
        app.screen = 'create-game-form';
      } else if (currentPathname === paths.NEW_GAME_PREMIUM) {
        app.screen = 'premium-create-game';
      } else if (currentPathname === paths.LOAD) {
        app.screen = 'load';
      } else if (currentPathname === paths.CARDS) {
        app.screen = 'cards';
      } else if (currentPathname === paths.HELP) {
        app.screen = 'help';
      } else if (currentPathname === paths.LEGACY) {
        app.screen = 'start-screen';
      } else if (currentPathname === paths.SPECTATOR) {
        app.updateSpectator();
      } else if (currentPathname === paths.ADMIN) {
        app.screen = 'admin';
      } else if (currentPathname === paths.LOGIN) {
        app.screen = 'login-home';
      } else {
        app.screen = 'main-menu';
      }
    },
    // Navigate WITHOUT a full page reload: push a history entry, then re-resolve
    // the screen from the new url. Used by the premium home↔create transitions
    // (SPA-clean, Electron-ready). The GAME-BOUNDARY navigations (enter/leave a
    // game) intentionally stay full reloads for now — a fresh page guarantees
    // clean per-game module state; making them in-app needs a
    // resetGameSessionState() audit (see WEBSOCKET_MIGRATION_PLAN §E-Phase 13).
    navigateInApp(path: string): void {
      window.history.pushState({}, '', path);
      this.applyRoute();
    },
    onPopState(): void {
      this.applyRoute();
    },
  },
  mounted() {
    setDocumentTitle();
    // Premium launch screen + GPU shader warm-up — ONCE per session (survives the
    // in-game reloads via sessionStorage). Overlays everything at z=13000 while it
    // compiles the heavy Graphite pipelines; it does NOT block route/data loading
    // (the real screen loads underneath and is revealed when the loader fades out).
    if (shouldRunBootWarmup()) {
      beginBootWarmup();
    }
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(document.getElementById('alert-dialog') as HTMLDialogElement);
    }
    // P10: raise the loading curtain BEFORE the first route resolution —
    // either continuing the previous page's handoff (join / create / exit
    // navigations set the sessionStorage flags) or covering a direct /
    // reconnect load of a game page. The player never sees a raw texture.
    const bootStage = consumeBootFlags();
    const pathNow = getLastPathSegment();
    if (bootStage !== undefined) {
      beginLoading(bootStage);
    } else if (pathNow === paths.PLAYER || pathNow === paths.SPECTATOR || pathNow === paths.THE_END) {
      beginLoading('sync');
    }
    this.applyRoute();
    // Browser back/forward re-resolves the screen in-app (no reload) for the
    // navigations that use navigateInApp. App is the root and never unmounts,
    // so no removal is needed.
    window.addEventListener('popstate', this.onPopState);
    // Desktop (Electron) update subscription — inert on the web (no desktopBridge).
    initDesktopUpdates();
  },
});
</script>
