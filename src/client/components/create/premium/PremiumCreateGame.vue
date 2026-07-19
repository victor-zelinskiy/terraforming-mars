<template>
  <div class="premium-create">
    <div class="pc-bg" aria-hidden="true"></div>
    <div class="pc-vignette" aria-hidden="true"></div>
    <div class="pc-grid" aria-hidden="true"></div>

    <header class="pc-header">
      <button type="button" class="pc-header__back" @click="onBack">
        <span class="pc-header__back-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 6 L9 12 L15 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span v-i18n>Back</span>
      </button>
      <div class="pc-header__titles">
        <h1 class="pc-header__title" v-i18n>Create new game</h1>
        <p class="pc-header__subtitle" v-i18n>Set up the players, map and rules of the party</p>
      </div>
      <div class="pc-header__identity">
        <premium-identity-chip @open="editIdentity" />
      </div>
    </header>

    <div class="pc-deck">
      <div class="pc-deck__config">
        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Game mode</h2></div>
          <game-mode-selector />
        </section>

        <section v-if="!marsBotMode" class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Number of players</h2></div>
          <player-count-selector v-model="playerCount" />
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Party players</h2></div>
          <player-slots />
          <button
            v-if="!marsBotMode"
            type="button"
            class="pc-botseat"
            :class="{'pc-botseat--on': seatMarsBot}"
            role="switch"
            :aria-checked="seatMarsBot ? 'true' : 'false'"
            @click="toggleSeatBot"
          >
            <span class="pc-botseat__toggle" aria-hidden="true"></span>
            <span class="pc-botseat__label" v-i18n>Seat MarsBot in this party</span>
          </button>
          <mars-bot-slot v-if="marsBotMode || seatMarsBot" />
          <p v-if="seatMarsBot" class="pc-botseat__note" v-i18n>Automa in multiplayer: the official rules are designed for solo play. This mode adapts the Automa as an additional participant of a multiplayer party.</p>
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Game rules</h2></div>
          <game-rules />
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Expansions</h2></div>
          <expansion-module-grid />
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Map</h2></div>
          <map-compact-card />
        </section>
      </div>

      <div class="pc-deck__summary">
        <aside class="briefing">
          <span class="briefing__corner briefing__corner--tl" aria-hidden="true"></span>
          <span class="briefing__corner briefing__corner--tr" aria-hidden="true"></span>
          <h2 class="briefing__title" v-i18n>Party briefing</h2>
          <div class="briefing__scroll">
            <party-briefing />
            <div class="briefing__sep" aria-hidden="true"></div>
            <create-info-panel />
          </div>
          <briefing-actions @create="onCreate" @back="onBack" @reset="onReset" />
        </aside>
      </div>
    </div>

    <transition name="pc-restore">
      <div v-if="settingsRestored" class="pc-restore-notice" role="status">
        <span class="pc-restore-notice__dot" aria-hidden="true"></span>
        <span class="pc-restore-notice__text" v-i18n>Restored your last settings</span>
        <button type="button" class="pc-restore-notice__reset" @click="onReset"><span v-i18n>Reset</span></button>
        <button type="button" class="pc-restore-notice__close" :aria-label="dismissLabel" @click="dismissRestoreNotice">
          <span aria-hidden="true">&times;</span>
        </button>
      </div>
    </transition>

    <map-picker-overlay v-if="mapPickerOpen" />

    <premium-identity-modal
      v-if="modalOpen"
      :initial-name="initialName"
      :initial-color="initialColor"
      @save="onModalSave"
      @close="onModalClose" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {vueRoot} from '@/client/components/vueRoot';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import PremiumIdentityChip from '@/client/components/mainMenu/PremiumIdentityChip.vue';
import PremiumIdentityModal from '@/client/components/mainMenu/PremiumIdentityModal.vue';
import {identityState, ensureIdentityLoaded, setIdentity} from '@/client/components/mainMenu/identity/identityState';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';
import GameModeSelector from '@/client/components/create/premium/GameModeSelector.vue';
import MarsBotSlot from '@/client/components/create/premium/MarsBotSlot.vue';
import PlayerCountSelector from '@/client/components/create/premium/PlayerCountSelector.vue';
import PlayerSlots from '@/client/components/create/premium/PlayerSlots.vue';
import GameRules from '@/client/components/create/premium/GameRules.vue';
import ExpansionModuleGrid from '@/client/components/create/premium/ExpansionModuleGrid.vue';
import MapCompactCard from '@/client/components/create/premium/MapCompactCard.vue';
import MapPickerOverlay from '@/client/components/create/premium/MapPickerOverlay.vue';
import PartyBriefing from '@/client/components/create/premium/PartyBriefing.vue';
import CreateInfoPanel from '@/client/components/create/premium/CreateInfoPanel.vue';
import BriefingActions from '@/client/components/create/premium/BriefingActions.vue';
import {createGameState, resetCreateGameState, setPlayerCount, applyCreatorIdentity, canCreateGame,
  restoreCreateGameState, clearSavedCreateGameState, setSeatMarsBot} from './createGameState';
import {submitPremiumCreateGame} from './submitCreateGame';
import {$t} from '@/client/directives/i18n';

// How long the calm "restored your last settings" notice lingers before it
// fades on its own (ms). Player interaction (Reset / dismiss) clears it sooner.
const RESTORE_NOTICE_MS = 7000;

export default defineComponent({
  name: 'PremiumCreateGame',
  components: {
    PremiumIdentityChip,
    PremiumIdentityModal,
    GameModeSelector,
    MarsBotSlot,
    PlayerCountSelector,
    PlayerSlots,
    GameRules,
    ExpansionModuleGrid,
    MapCompactCard,
    MapPickerOverlay,
    PartyBriefing,
    CreateInfoPanel,
    BriefingActions,
  },
  data() {
    return {
      modalOpen: false,
      // The calm "restored your last settings" notice (non-blocking, auto-fading).
      settingsRestored: false,
      restoreNoticeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    playerCount: {
      get(): number {
        return createGameState.config.players.length;
      },
      set(v: number) {
        setPlayerCount(v);
      },
    },
    marsBotMode(): boolean {
      return createGameState.config.gameMode === 'marsbot';
    },
    seatMarsBot(): boolean {
      return createGameState.config.gameMode === 'multiplayer' && createGameState.config.seatMarsBot;
    },
    mapPickerOpen(): boolean {
      return createGameState.mapPickerOpen;
    },
    initialName(): string {
      return identityState.identity?.displayName ?? createGameState.config.players[0]?.name ?? '';
    },
    initialColor(): Color {
      return identityState.identity?.cubeColor ?? createGameState.config.players[0]?.color ?? DEFAULT_IDENTITY_COLOR;
    },
    dismissLabel(): string {
      return $t('Dismiss');
    },
  },
  mounted() {
    setDocumentTitle('Create new game');
    ensureIdentityLoaded();
    // Restore the last created setup; fall back to a fresh default when there
    // is nothing saved (or a corrupt blob). The creator seat always reflects the
    // current launcher identity, restored or not.
    const restored = restoreCreateGameState();
    if (!restored) {
      resetCreateGameState();
    }
    const id = identityState.identity;
    if (id !== undefined) {
      applyCreatorIdentity(id.displayName, id.cubeColor);
    } else {
      this.modalOpen = true;
    }
    if (restored) {
      this.markSettingsRestored();
    }
  },
  beforeUnmount() {
    this.clearRestoreNoticeTimer();
  },
  methods: {
    toggleSeatBot(): void {
      setSeatMarsBot(!createGameState.config.seatMarsBot);
    },
    editIdentity(): void {
      this.modalOpen = true;
    },
    onModalSave(payload: {displayName: string, color: Color}): void {
      setIdentity(payload.displayName, payload.color);
      applyCreatorIdentity(payload.displayName, payload.color);
      this.modalOpen = false;
    },
    onModalClose(): void {
      this.modalOpen = false;
    },
    onReset(): void {
      clearSavedCreateGameState();
      resetCreateGameState();
      const id = identityState.identity;
      if (id !== undefined) {
        applyCreatorIdentity(id.displayName, id.cubeColor);
      }
      this.dismissRestoreNotice();
    },
    markSettingsRestored(): void {
      this.settingsRestored = true;
      this.clearRestoreNoticeTimer();
      this.restoreNoticeTimer = setTimeout(() => {
        this.settingsRestored = false;
        this.restoreNoticeTimer = undefined;
      }, RESTORE_NOTICE_MS);
    },
    dismissRestoreNotice(): void {
      this.settingsRestored = false;
      this.clearRestoreNoticeTimer();
    },
    clearRestoreNoticeTimer(): void {
      if (this.restoreNoticeTimer !== undefined) {
        clearTimeout(this.restoreNoticeTimer);
        this.restoreNoticeTimer = undefined;
      }
    },
    onBack(): void {
      // In-app SPA transition back to the premium main menu (no page reload).
      vueRoot(this).navigateInApp('/');
    },
    onCreate(): void {
      if (canCreateGame()) {
        void submitPremiumCreateGame();
      }
    },
  },
});
</script>
