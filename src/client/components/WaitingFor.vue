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
  <template v-if="holdingForMarker || holdingForTilePlacement">
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
    <MandatoryInputModal v-if="useModalForCurrentInput"
                         :title="modalPillTitle">
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
                     :cancellable="false" />
    </div>
  </div>
</template>

<script lang="ts">
/* global RequestInit */

import {defineComponent} from 'vue';
import * as constants from '@/common/constants';
import raw_settings from '@/genfiles/settings.json';
import {vueRoot} from '@/client/components/vueRoot';
import {OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
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
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import WorldGovernmentModalContent from '@/client/components/WorldGovernmentModalContent.vue';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import PlacementBanner from '@/client/components/PlacementBanner.vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {clearIfPhaseLeftCardPick, clearDraftWaitPending, shouldPreserveCardPickModal} from '@/client/components/draftWaitState';
import {shouldPreserveInitialDraftOverlay} from '@/client/components/initialDraft/initialDraftSharedState';
import {shouldPreserveSaleOverlay} from '@/client/components/handCards/sellPatentsState';
import {handPlayPrompt} from '@/client/components/handCards/handPlayState';
import {standardProjectPlayPrompt} from '@/client/components/handCards/standardProjectPlayState';
import {startFlowCorpPrompt, startGameFlowActive} from '@/client/components/startGameFlow/startGameFlowState';
import {Message} from '@/common/logs/Message';
import {
  applyTilePlacementPreview,
  armPlacementAnimations,
  placementHoldDurationMs,
  shouldHoldForTilePlacement,
} from '@/client/components/board/tilePlacementAnimation';

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

// Titles of the regular per-turn action menu (`Player.getActions()` in
// Player.ts). This is the ONE top-level `OrOptions` that must NOT pop as a
// modal — it's driven by the fork's dedicated action buttons (and renders
// inline in the hidden legacy overlay as a fallback). Every OTHER top-level
// `or` is a card-play / forced-event sub-prompt and belongs in the modal.
const ACTION_MENU_TITLES: ReadonlySet<string> = new Set([
  'Take your first action',
  'Take your next action',
]);

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
  },
  methods: {
    getPlayerName(color: Color): string {
      const player = this.playerView.players.find((p) => p.color === color);
      return player ? player.name : color;
    },
    animateTitle() {
      if (!getPreferences().animated_title) {
        return;
      }

      const sequence = '\u25D1\u25D2\u25D0\u25D3';
      const first = document.title[0];
      const position = sequence.indexOf(first);
      let next = sequence[0];
      if (position !== -1 && position < sequence.length - 1) {
        next = sequence[position + 1];
      }
      document.title = next + ' ' + gameDocumentTitle(this.playerView.game);
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
        paths.PLAYER_INPUT + '?id=' + this.playerView.id,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: this.playerView.runId, ...out}),
        },
        wgtSubmit);
    },
    reset() {
      this.fetchPlayerInput(
        paths.RESET + '?id=' + this.playerView.id,
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
    fetchPlayerInput(url: string, options: RequestInit, wgtSubmit: boolean) {
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        console.warn('Server request in progress');
        return;
      }

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
            const markerHold = wgtSubmit && this.shouldHoldForMarkerAnimation(newView);
            const tileHold = shouldHoldForTilePlacement(
              this.playerView.game.spaces,
              newView.game.spaces,
            );
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
                markerHold ? WGT_MARKER_HOLD_MS : 0,
                tileHold ? placementHoldDurationMs() : 0,
              );
              try {
                await new Promise<void>((resolve) => setTimeout(resolve, holdMs));
              } finally {
                this.holdingForMarker = false;
                this.holdingForTilePlacement = false;
              }
            }
            this.updatePlayerView(newView);
            return;
          }

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
          root.screen = 'empty';
          root.playerView = playerView;
          root.playerkey++;
          root.screen = 'player-home';
        }
        if (this.playerView.game.phase === 'end' && window.location.pathname !== paths.THE_END) {
          window.location = window.location as any as (string & Location);
        }
        this.savedPlayerView = undefined;
      } else {
        this.savedPlayerView = playerView;
      }
    },
    waitForUpdate() {
      const vueApp = this;
      const root = vueRoot(this);
      clearTimeout(ui_update_timeout_id);
      const askForUpdate = () => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', paths.API_WAITING_FOR + window.location.search + '&gameAge=' + this.playerView.game.gameAge + '&undoCount=' + this.playerView.game.undoCount);
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
            const viewerHasPrompt = this.waitingfor !== undefined;

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
      ui_update_timeout_id = window.setTimeout(askForUpdate, raw_settings.waitingForTimeout);
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
      return player?.name ?? '';
    },
  },
  mounted() {
    document.title = gameDocumentTitle(this.playerView.game);
    window.clearInterval(documentTitleTimer);
    // Always poll — even when the viewer is mid-prompt — so other players'
    // status (cube spin, status label) stays in sync across simultaneous-
    // action phases (drafting / research / production interrupts). The poll
    // handler skips full refreshes while the viewer has a prompt to avoid
    // resetting partial input state.
    this.waitForUpdate();
    if (this.playerView.players.length > 1 && this.waitingfor !== undefined) {
      documentTitleTimer = window.setInterval(() => this.animateTitle(), 1000);
    }
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

