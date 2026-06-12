<template>
  <div :class="'topmost-'+screen">
    <!-- Dev-only modal-input visual playground (URL: ?modalPlayground). -->
    <ModalInputPlayground v-if="showModalPlayground" />
    <!-- Dev-only effects-overlay visual playground (URL: ?effectsPlayground). -->
    <EffectsPlayground v-if="showEffectsPlayground" />
    <!-- Dev-only actions-overlay visual playground (URL: ?actionsPlayground). -->
    <ActionsPlayground v-if="showActionsPlayground" />
    <!--
      Game-screen atmosphere backdrop. Mounted ONLY on in-game screens
      (player-home / spectator-home) — start / create / load / the-end
      each have their own backdrop styling and don't want the layered
      space scene. `v-if` keeps DOM cost zero outside game screens.
      The component itself uses `position: fixed; z-index: -50..-44`
      so it sits behind all UI without affecting layout / hitbox.
    -->
    <GameAtmosphere v-if="screen === 'player-home' || screen === 'spectator-home'" />
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
      <start-screen v-if="screen === 'start-screen'"></start-screen>
      <create-game-form
        v-else-if="screen === 'create-game-form'"
      ></create-game-form>
      <load-game-form v-else-if="screen === 'load'"></load-game-form>
      <game-home
        v-else-if="screen === 'game-home' && game !== undefined"
        :game="game"
      ></game-home>
      <player-home
        v-else-if="screen === 'player-home' && playerView !== undefined"
        ref="playerHome"
        :player-view="playerView"
        :key="playerkey"
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
      <DraftFlowOverlay
        v-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView"
        :waiting-on-players="playersWaitingFor" />
      <!--
        Unified start-of-game orchestration modal. App-level (like
        DraftFlowOverlay) so the playerkey remount can't destroy the flow
        mid-sequence. Self-gates via startGameFlowActive(playerView): only
        mounts in generation 1 while preludes / the corp first action are owed.
      -->
      <StartGameFlowOverlay
        v-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView"
        :waiting-on-players="playersWaitingFor" />
      <!--
        Premium "you drew cards" reveal modal. App-level (like DraftFlowOverlay)
        so the playerkey remount can't destroy the deal/collect animation or the
        per-card take progress mid-reveal. Driven entirely by the module-level
        drawnCardsState (reconciled from playerView.cardDrawReveals by the
        watcher above); mounts only while cards await a take.
      -->
      <DrawCardRevealFlow
        v-if="screen === 'player-home' && playerView !== undefined && hasDrawReveal"
        :player-view="playerView" />
      <!--
        Premium REVEAL-RESULT overlay for deck-check actions (SearchForLife /
        AsteroidDeflectionSystem). App-level (like DraftFlowOverlay) so it survives
        the playerkey remount that the reveal-action response triggers — the result
        can't live inside <player-home>. Self-gates via revealResultState.active.
      -->
      <RevealResultOverlay
        v-if="screen === 'player-home' && playerView !== undefined"
        :player-view="playerView" />
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
        :key="'spectator-' + playerkey"
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
      <Transition name="journal-panel">
        <JournalPanel
          v-if="screen === 'player-home' && playerView !== undefined && journalState.open"
          :viewModel="playerView"
          :color="playerView.thisPlayer.color"
          :step="playerView.game.step"
          @close="journalState.open = false" />
      </Transition>
    </div>
  </div>
</template>

<script lang="ts">
import {defineAsyncComponent, defineComponent} from 'vue';
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
import DraftFlowOverlay from '@/client/components/DraftFlowOverlay.vue';
import StartGameFlowOverlay from '@/client/components/startGameFlow/StartGameFlowOverlay.vue';
import RevealResultOverlay from '@/client/components/actions/RevealResultOverlay.vue';
// Premium end-of-game experience (winner reveal + full-screen results). Async
// so its charts / tabs only download once a game actually ends.
const EndgameExperience = defineAsyncComponent(() => import(/* webpackChunkName: "endgame" */ '@/client/components/endgame/EndgameExperience.vue'));
const ModalInputPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "modal-input-playground" */ '@/client/components/modalInputs/ModalInputPlayground.vue'));
const EffectsPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "effects-playground" */ '@/client/components/effects/EffectsPlayground.vue'));
const ActionsPlayground = defineAsyncComponent(() => import(/* webpackChunkName: "actions-playground" */ '@/client/components/actions/ActionsPlayground.vue'));
import JournalPanel from '@/client/components/journal/JournalPanel.vue';
import {journalState} from '@/client/components/journal/journalState';
import DrawCardRevealFlow from '@/client/components/drawnCards/DrawCardRevealFlow.vue';
import {reconcileDrawnCards, hasVisibleReveal} from '@/client/components/drawnCards/drawnCardsState';
import AdditionalResourceDetailOverlay from '@/client/components/additionalResources/AdditionalResourceDetailOverlay.vue';
import {setLiveCardResources} from '@/client/components/card/liveCardResources';
import GameAtmosphere from '@/client/components/GameAtmosphere.vue';
import {$t, setTranslationContext} from '@/client/directives/i18n';
import {paths} from '@/common/app/paths';
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
    // playerKey might seem to serve no function, but it's basically an arbitrary value used
    // to force a rerender / refresh.
    // See https://michaelnthiessen.com/force-re-render/
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
    EndgameExperience,
    ModalInputPlayground,
    EffectsPlayground,
    ActionsPlayground,
    JournalPanel,
    DrawCardRevealFlow,
    AdditionalResourceDetailOverlay,
    GameAtmosphere,
  },
  watch: {
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

      const url = 'api/' + path + window.location.search.replace('&noredirect', '');

      fetch(url)
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`Error getting game data: ${resp.statusText}`);
          }
          return resp.json();
        })
        .then((model: ViewModel) => {
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
          if (prevView !== undefined &&
              shouldHoldForTilePlacement(prevView.game.spaces, model.game.spaces)) {
            armPlacementAnimations();
          }
          if (path === paths.PLAYER) {
            app.playerView = model as PlayerViewModel;
            setTranslationContext(app.playerView);
          } else if (path === paths.SPECTATOR) {
            app.spectator = model as SpectatorModel;
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
        })
        .catch((err) => {
          alert('Error getting game data');
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
  },
  mounted() {
    setDocumentTitle();
    if (!windowHasHTMLDialogElement()) {
      dialogPolyfill.registerDialog(document.getElementById('alert-dialog') as HTMLDialogElement);
    }
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
      const url = paths.API_GAME + window.location.search;
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
    } else if (currentPathname === paths.LOAD) {
      app.screen = 'load';
    } else if (currentPathname === paths.CARDS) {
      app.screen = 'cards';
    } else if (currentPathname === paths.HELP) {
      app.screen = 'help';
    } else if (currentPathname === paths.SPECTATOR) {
      app.updateSpectator();
    } else if (currentPathname === paths.ADMIN) {
      app.screen = 'admin';
    } else if (currentPathname === paths.LOGIN) {
      app.screen = 'login-home';
    } else {
      app.screen = 'start-screen';
    }
  },
});
</script>
