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
      <premium-main-menu v-if="screen === 'main-menu'"></premium-main-menu>
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
        No-remount update model (REMOUNT_ANIMATION_REWORK_DESIGN.md, Phase 1):
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
        Console Mode (CONSOLE_MODE_CONCEPT.md): a runtime SHELL SPLIT — the
        console-first TV shell mounts INSTEAD of PlayerHome, same game brain
        (playerView + its own headless WaitingFor transport). Toggled by the
        consented entry prompt / hold-Menu / `?console=1|0`.
      -->
      <ConsoleShell
        v-else-if="screen === 'player-home' && playerView !== undefined && consoleModeState.enabled"
        :player-view="playerView"
      ></ConsoleShell>
      <player-home
        v-else-if="screen === 'player-home' && playerView !== undefined"
        ref="playerHome"
        :player-view="playerView"
        :reset-epoch="playerkey"
        :key="playerHomeKey"
      ></player-home>
      <!--
        Draft / buy-cards modal lives HERE at App level (not inside
        player-home) so the `:key="playerkey"` remount that fires on
        every server response can't destroy it. As long as App is
        alive, this overlay stays mounted; its internal modal swaps
        between CardSelectionContent and DraftWaitingContent based
        on reactive playerView + module-level draftWaitState. The
        previous architecture (modal inside WaitingFor) was the
        root cause of the "modal closes when I press ВЫБРАТЬ" bug —
        every submit destroyed the modal, no flag could survive it.
      -->
      <!--
        CONSOLE MODE (CTS T2): every non-hand SelectCard prompt this overlay
        serves (draft / research buy / nested target picks) is handled by the
        console-native card browser inside ConsoleTaskHost — mounting both
        would double-render; the wait-between-picks state is the console
        banner. Desktop (consoleModeState.enabled === false) is untouched.
      -->
      <DraftFlowOverlay
        v-if="screen === 'player-home' && playerView !== undefined && !consoleModeState.enabled"
        :player-view="playerView"
        :waiting-on-players="playersWaitingFor" />
      <!--
        Unified start-of-game orchestration modal. App-level (like
        DraftFlowOverlay) so the playerkey remount can't destroy the flow
        mid-sequence. Self-gates via startGameFlowActive(playerView): only
        mounts in generation 1 while preludes / the corp first action are owed.
      -->
      <!--
        CONSOLE MODE (CTS T5): the start sequence (preludes / corp first
        action / Merger pick) is served by the console-native ConsoleStartScene
        — mounting this desktop orchestration modal too would double-render.
        Desktop (consoleModeState.enabled === false) is untouched.
      -->
      <StartGameFlowOverlay
        v-if="screen === 'player-home' && playerView !== undefined && !consoleModeState.enabled"
        :player-view="playerView"
        :waiting-on-players="playersWaitingFor" />
      <!--
        Premium "you drew cards" reveal modal. App-level (like DraftFlowOverlay)
        so the playerkey remount can't destroy the deal/collect animation or the
        per-card take progress mid-reveal. Driven entirely by the module-level
        drawnCardsState (reconciled from playerView.cardDrawReveals by the
        watcher above); mounts only while cards await a take.
      -->
      <!-- CONSOLE MODE (CTS T6): the reveal flows are served by the
           console-native ConsoleRevealOverlay — desktop untouched. -->
      <DrawCardRevealFlow
        v-if="screen === 'player-home' && playerView !== undefined && hasDrawReveal && !consoleModeState.enabled"
        :player-view="playerView" />
      <!--
        Premium REVEAL-RESULT overlay for deck-check actions (SearchForLife /
        AsteroidDeflectionSystem). App-level (like DraftFlowOverlay) so it survives
        the playerkey remount that the reveal-action response triggers — the result
        can't live inside <player-home>. Self-gates via revealResultState.active.
      -->
      <RevealResultOverlay
        v-if="screen === 'player-home' && playerView !== undefined && !consoleModeState.enabled"
        :player-view="playerView" />
      <!--
        Milestone/award post-confirm ceremony (desktop presentation). App-level
        so the playerkey remount can't tear it down mid-beat; self-gates via
        maCeremonyState (fires only when the fresh view proves the viewer's own
        claim/fund resolved). Console mode has its own cinematic in ConsoleShell.
      -->
      <MaCeremonyOverlay
        v-if="screen === 'player-home' && playerView !== undefined && !consoleModeState.enabled" />
      <!--
        End-of-generation Energy → Heat conversion transition. App-level (like
        DraftFlowOverlay) so the `:key="playerkey"` remount can't tear down the
        arrow / paired chips mid-animation. Self-gates via
        energyConversionState.active; positions itself from the live energy /
        heat resource-cell rects.
      -->
      <EnergyConversionOverlay
        v-if="screen === 'player-home' && playerView !== undefined" />
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
        :view="endgameView" />
      <!--
        Premium end-of-game experience. App-level (like DraftFlowOverlay) so the
        `:key="playerkey"` remount can't tear down the reveal / results overlay.
        Gated by `endgameView` (the active player/spectator view ONLY when the
        game has reached Phase.END), so it never shows mid-game.
      -->
      <EndgameExperience
        v-if="endgameView !== undefined"
        :view="endgameView"
        :viewer-color="endgameViewerColor" />
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

      <!--
        Premium journal side-panel. Mounted HERE (App level) — NOT inside
        <player-home> — so the `:key="playerkey"` remount that fires on
        every server response can't destroy it. As long as App is alive
        and the journal is open, the panel stays mounted, keeping its
        selected generation / scroll position / live-follow across board
        updates. Its own `v-if` (independent of the screen v-else-if chain
        above) gates it to the player-home screen + the module-level open
        flag. The board slide is driven separately by PlayerHome's
        `#player-home.journal-open` class (also reads journalState).
      -->
      <!-- Console mode has its OWN journal shell (ConsoleJournalPanel,
           mounted by ConsoleShell — same shared data source) — the desktop
           panel must not double-render behind it. -->
      <Transition name="journal-panel">
        <JournalPanel
          v-if="screen === 'player-home' && playerView !== undefined && journalState.open && !consoleModeState.enabled"
          :viewModel="playerView"
          :color="playerView.thisPlayer.color"
          :step="playerView.game.step"
          @close="journalState.open = false" />
      </Transition>

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

      <!--
        Read-only viewer for PUBLICLY revealed / shown cards (opened from a
        reveal notification's «Посмотреть» CTA or a journal reveal row). App-level
        so it survives the playerkey remount; driven by module-level
        revealViewerState.
      -->
      <RevealedCardsModal
        v-if="screen === 'player-home' && playerView !== undefined && !consoleModeState.enabled"
        :players="playerView.players" />

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
        Premium GAMEPAD layer (GAMEPAD_SUPPORT_DESIGN.md). App-level (like
        NotificationLayer) so the controller mode / focus survives the
        legacy-flag remount and every server response. Mounted on EVERY
        screen (full console lifecycle: menu → create → lobby → game →
        endgame — CONSOLE_MODE_CONCEPT.md). Fully inert until a pad button
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
const PlayerHome = defineAsyncComponent(() => import(/* webpackChunkName: "player-home" */ '@/client/components/PlayerHome.vue'));
const SpectatorHome = defineAsyncComponent(() => import(/* webpackChunkName: "spectator-home" */ '@/client/components/SpectatorHome.vue'));
const StartScreen = defineAsyncComponent(() => import(/* webpackChunkName: "start-screen" */ '@/client/components/StartScreen.vue'));
// Premium sci-fi launcher — the new default landing screen ('/'). The legacy
// StartScreen lives on at '/legacy'. Async so its background/assets only load
// when the menu is actually shown.
const PremiumMainMenu = defineAsyncComponent(() => import(/* webpackChunkName: "main-menu" */ '@/client/components/mainMenu/PremiumMainMenu.vue'));
// Premium "Mission Control" create-game screen — opened from the premium menu.
const PremiumCreateGame = defineAsyncComponent(() => import(/* webpackChunkName: "premium-create-game" */ '@/client/components/create/premium/PremiumCreateGame.vue'));
import DraftFlowOverlay from '@/client/components/DraftFlowOverlay.vue';
import StartGameFlowOverlay from '@/client/components/startGameFlow/StartGameFlowOverlay.vue';
import RematchLayer from '@/client/components/rematch/RematchLayer.vue';
import GameExitButton from '@/client/components/GameExitButton.vue';
import RevealResultOverlay from '@/client/components/actions/RevealResultOverlay.vue';
import MaCeremonyOverlay from '@/client/components/ma/MaCeremonyOverlay.vue';
import EnergyConversionOverlay from '@/client/components/feedback/EnergyConversionOverlay.vue';
import HazardCleanupOverlay from '@/client/components/feedback/HazardCleanupOverlay.vue';
import {
  detectEnergyConversion,
  endEnergyConversion,
  isEnergyConversionActive,
  runEnergyConversion,
} from '@/client/components/feedback/energyConversionTransition';
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
import JournalPanel from '@/client/components/journal/JournalPanel.vue';
import {journalState} from '@/client/components/journal/journalState';
import NotificationLayer from '@/client/components/notifications/NotificationLayer.vue';
import GamepadLayer from '@/client/components/gamepad/GamepadLayer.vue';
import {consoleModeState, requestConsoleFullscreen} from '@/client/console/consoleModeState';
import ConsoleLoadingScreen from '@/client/components/console/ConsoleLoadingScreen.vue';
import {beginLoading, consumeBootFlags, endLoading, failLoading, loadingScreenState} from '@/client/console/loadingScreenState';
const ConsoleShell = defineAsyncComponent(() => import(/* webpackChunkName: "console-shell" */ '@/client/components/console/ConsoleShell.vue'));
import TurnHandoffLayer from '@/client/components/overview/TurnHandoffLayer.vue';
import RevealedCardsModal from '@/client/components/notifications/RevealedCardsModal.vue';
import EffectDetailOverlay from '@/client/components/notifications/EffectDetailOverlay.vue';
import DrawCardRevealFlow from '@/client/components/drawnCards/DrawCardRevealFlow.vue';
import RealtimeLayer from '@/client/components/realtime/RealtimeLayer.vue';
import DesktopUpdateOverlay from '@/client/components/desktop/DesktopUpdateOverlay.vue';
import {initDesktopUpdates} from '@/client/components/desktop/desktopUpdateState';
import {perfMark} from '@/client/utils/perfMarks';
import {legacyRemountEnabled} from '@/client/utils/legacyRemount';
import {nextViewSnapshot} from '@/client/utils/viewSnapshotShare';
import {reconcileDrawnCards, hasVisibleReveal} from '@/client/components/drawnCards/drawnCardsState';
import AdditionalResourceDetailOverlay from '@/client/components/additionalResources/AdditionalResourceDetailOverlay.vue';
import {setLiveCardResources} from '@/client/components/card/liveCardResources';
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
type PlayerHomeOverlayRef = {
    activeOverlay?: unknown;
    coloniesOverlayOpen?: boolean;
}
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
    // Since the no-remount rework (REMOUNT_ANIMATION_REWORK_DESIGN.md) the
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
    'start-screen': StartScreen,
    'create-game-form': CreateGameForm,
    'load-game-form': LoadGameForm,
    'game-home': GameHome,
    'player-home': PlayerHome,
    'spectator-home': SpectatorHome,
    'game-end': GameEnd,
    'games-overview': GamesOverview,
    'card-list': CardList,
    'help': Help,
    'admin-home': AdminHome,
    'login-home': LoginHome,
    DraftFlowOverlay,
    StartGameFlowOverlay,
    RevealResultOverlay,
    MaCeremonyOverlay,
    EnergyConversionOverlay,
    HazardCleanupOverlay,
    RematchLayer,
    GameExitButton,
    EndgameExperience,
    ModalInputPlayground,
    EffectsPlayground,
    ActionsPlayground,
    PlayerCubePlayground,
    JournalPanel,
    NotificationLayer,
    GamepadLayer,
    ConsoleShell,
    ConsoleLoadingScreen,
    TurnHandoffLayer,
    RevealedCardsModal,
    EffectDetailOverlay,
    RealtimeLayer,
    DesktopUpdateOverlay,
    DrawCardRevealFlow,
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
    },
  },
  computed: {
    // Console Mode flag (module reactive) exposed to the template — drives
    // the ConsoleShell vs PlayerHome shell split (CONSOLE_MODE_CONCEPT.md).
    consoleModeState() {
      return consoleModeState;
    },
    loadingScreenState() {
      return loadingScreenState;
    },
    // True while a non-dismissed reveal batch exists — drives the App-level
    // reveal modal mount. Goes false the instant the last batch is taken
    // (dismissed client-side), so the modal closes without flashing empty.
    hasDrawReveal(): boolean {
      return hasVisibleReveal();
    },
    // Expose the module-level journal open flag to the template. Mounting
    // the panel HERE (not inside <player-home>) keeps it alive across the
    // `:key="playerkey"` remount that fires on every server response, so
    // the journal never closes itself and keeps its generation / scroll /
    // live-follow state. See journalState.ts + journal.less.
    journalState() {
      return journalState;
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
  },
  methods: {
    showAlert(title: string, message: string, cb: () => void = () => {}): void {
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

      fetch(url)
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`Error getting game data: ${resp.statusText}`);
          }
          return resp.json();
        })
        .then((model: ViewModel) => {
          /*
           * Re-entrancy guard for the energy→heat conversion transition: while
           * a conversion is animating we must NOT swap playerView (that would
           * pop the panel to its final values mid-animation and open the
           * next-phase modal over it). The poll loop keeps running, so the next
           * poll after the animation finishes commits fresh state.
           */
          if (isEnergyConversionActive() || isHazardCleanupActive()) {
            return;
          }
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
          const preserveOpenOverlay =
            path === paths.PLAYER &&
            app.playerView !== undefined &&
            this.playerHomeHasOpenOverlay();
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
            if (prevView !== undefined &&
                shouldHoldForTilePlacement(prevView.game.spaces, model.game.spaces)) {
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
          };

          /*
           * Energy→heat conversion gate (poll path). When ANOTHER player's
           * action advanced the game into production, the viewer's own
           * conversion arrives via this poll. Play the paired animation and
           * hold the commit (and therefore the research / draft / endgame
           * screen, which all key off playerView) until it finishes. The
           * re-entrancy guard above keeps a concurrent poll from committing
           * mid-animation.
           */
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
    playerHomeHasOpenOverlay(): boolean {
      const playerHome = this.$refs.playerHome as PlayerHomeOverlayRef | undefined;
      if (playerHome === undefined) {
        return false;
      }
      return (playerHome.activeOverlay !== null && playerHome.activeOverlay !== undefined) ||
        playerHome.coloniesOverlayOpen === true;
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
