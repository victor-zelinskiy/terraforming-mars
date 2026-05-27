<template>
  <div>
  <template v-if="waitingfor === undefined">
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
      <player-input-factory v-else
                            :players="playerView.players"
                            :playerView="playerView"
                            :playerinput="waitingfor"
                            :onsave="onsave"
                            :showsave="true"
                            :showtitle="true" />
    </MandatoryInputModal>

    <player-input-factory v-else
                          :players="playerView.players"
                          :playerView="playerView"
                          :playerinput="waitingfor"
                          :onsave="onsave"
                          :showsave="true"
                          :showtitle="true" />
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
import {Message} from '@/common/logs/Message';

const WGT_TITLE = 'Select action for World Government Terraforming';

// Title strings (from the server-side prompt) that identify specific
// OrOptions prompts which should pop as a modal. Matched by exact equality
// after unwrapping `Message` objects to their `.message` field. See
// CLAUDE.md "Mandatory-input modal pattern".
const MODAL_OR_TITLES: ReadonlySet<string> = new Set([
  WGT_TITLE,
]);

// PlayerInput types that ALWAYS render in the modal regardless of title
// (used for `'payment'`-style prompts where every instance is mandatory).
const MODAL_INPUT_TYPES: ReadonlySet<PlayerInputModel['type']> = new Set([
  'payment',
]);

function titleText(title: string | Message | undefined): string | undefined {
  if (title === undefined) return undefined;
  return typeof title === 'string' ? title : title.message;
}

// Returns true when the given top-level PlayerInput is one of the
// "mandatory choice" prompts we route through MandatoryInputModal.
//
// Two-layer detection:
//  - by `type`: any input whose type unconditionally belongs in a modal
//    (currently `'payment'`).
//  - by title: specific `OrOptions` prompts that share the generic `'or'`
//    type with the regular action menu but should be modal'd (World
//    Government Terraforming is the first).
function shouldRouteToModal(input: PlayerInputModel): boolean {
  if (MODAL_INPUT_TYPES.has(input.type)) return true;
  if (input.type === 'or') {
    const t = titleText(input.title);
    if (t !== undefined && MODAL_OR_TITLES.has(t)) return true;
  }
  return false;
}

let ui_update_timeout_id: number | undefined;
let documentTitleTimer: number | undefined;

type DataModel = {
  playersWaitingFor: Array<Color>
  suspend: boolean,
  savedPlayerView: PlayerViewModel | undefined;
}

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

export default defineComponent({
  name: 'waiting-for',
  components: {
    MandatoryInputModal,
    WorldGovernmentModalContent,
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
    };
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
      this.fetchPlayerInput(
        paths.PLAYER_INPUT + '?id=' + this.playerView.id,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: this.playerView.runId, ...out}),
        });
    },
    reset() {
      this.fetchPlayerInput(
        paths.RESET + '?id=' + this.playerView.id,
        {method: 'GET'});
    },
    fetchPlayerInput(url: string, options: RequestInit) {
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        console.warn('Server request in progress');
        return;
      }

      root.isServerSideRequestInProgress = true;
      fetch(url, options)
        .then(async (response) => {
          if (response.ok) {
            this.updatePlayerView(await response.json());
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
        root.screen = 'empty';
        root.playerView = playerView;
        root.playerkey++;
        root.screen = 'player-home';
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
                return;
              }
            } else if (result.result === 'REFRESH') {
              if (!viewerHasPrompt) {
                // Game advanced and viewer isn't mid-input — safe to refresh.
                if (isPlayerId(this.playerView.id)) {
                  root.updatePlayer();
                } else {
                  root.updateSpectator();
                }
                return;
              }
            }
            // WAIT, or viewer is mid-prompt — keep polling without refresh.
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
      return this.waitingfor !== undefined && shouldRouteToModal(this.waitingfor);
    },
    isWgtInput(): boolean {
      return this.wgtInput !== undefined;
    },
    // Narrowed reference to the current waitingfor when it's the WGT
    // prompt — typed as OrOptionsModel so the dedicated component receives
    // the right shape (the raw `waitingfor` prop is a union).
    wgtInput(): OrOptionsModel | undefined {
      const wf = this.waitingfor;
      if (wf === undefined || wf.type !== 'or') return undefined;
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
    // prompt is awaiting decision. Reads straight off the current
    // waitingfor — same string the modal title bar would show.
    modalPillTitle(): string | Message {
      return this.waitingfor?.title ?? '';
    },
  },
});

</script>

