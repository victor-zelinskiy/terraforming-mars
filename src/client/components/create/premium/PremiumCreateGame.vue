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
        <p class="pc-header__subtitle" v-i18n>Assemble your mission configuration</p>
      </div>
      <div class="pc-header__identity">
        <premium-identity-chip @open="editIdentity" />
      </div>
    </header>

    <div class="pc-deck">
      <div class="pc-deck__config">
        <player-command-card @edit-identity="editIdentity" />

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Number of players</h2></div>
          <player-count-selector v-model="playerCount" />
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Expansions</h2></div>
          <expansion-module-grid />
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Map</h2></div>
          <map-selection />
        </section>

        <section class="pc-section">
          <div class="pc-section__head"><span class="pc-section__tick" aria-hidden="true"></span><h2 class="pc-section__label" v-i18n>Game rules</h2></div>
          <mission-rule-toggles />
        </section>

        <create-info-panel />
      </div>

      <div class="pc-deck__summary">
        <mission-summary
          @create="onCreate"
          @back="onBack"
          @reset="onReset"
          @edit-identity="editIdentity" />
      </div>
    </div>

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
import {paths} from '@/common/app/paths';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import PremiumIdentityChip from '@/client/components/mainMenu/PremiumIdentityChip.vue';
import PremiumIdentityModal from '@/client/components/mainMenu/PremiumIdentityModal.vue';
import {identityState, ensureIdentityLoaded, setIdentity} from '@/client/components/mainMenu/identity/identityState';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';
import PlayerCommandCard from '@/client/components/create/premium/PlayerCommandCard.vue';
import PlayerCountSelector from '@/client/components/create/premium/PlayerCountSelector.vue';
import ExpansionModuleGrid from '@/client/components/create/premium/ExpansionModuleGrid.vue';
import MapSelection from '@/client/components/create/premium/MapSelection.vue';
import MissionRuleToggles from '@/client/components/create/premium/MissionRuleToggles.vue';
import MissionSummary from '@/client/components/create/premium/MissionSummary.vue';
import CreateInfoPanel from '@/client/components/create/premium/CreateInfoPanel.vue';
import {createGameState, resetCreateGameState} from './createGameState';
import {buildCreateGamePayloadFromPremiumState} from './buildCreateGamePayload';

export default defineComponent({
  name: 'PremiumCreateGame',
  components: {
    PremiumIdentityChip,
    PremiumIdentityModal,
    PlayerCommandCard,
    PlayerCountSelector,
    ExpansionModuleGrid,
    MapSelection,
    MissionRuleToggles,
    MissionSummary,
    CreateInfoPanel,
  },
  data() {
    return {
      modalOpen: false,
      // When true, a successful identity save proceeds straight to creation.
      pendingCreate: false,
    };
  },
  computed: {
    playerCount: {
      get(): number {
        return createGameState.config.playerCount;
      },
      set(v: number) {
        createGameState.config.playerCount = v;
      },
    },
    initialName(): string {
      return identityState.identity?.displayName ?? '';
    },
    initialColor(): Color {
      return identityState.identity?.cubeColor ?? DEFAULT_IDENTITY_COLOR;
    },
  },
  mounted() {
    setDocumentTitle('Create new game');
    ensureIdentityLoaded();
    resetCreateGameState();
    if (identityState.identity === undefined) {
      this.openModal(false);
    }
  },
  methods: {
    openModal(pendingCreate: boolean): void {
      this.pendingCreate = pendingCreate;
      this.modalOpen = true;
    },
    editIdentity(): void {
      this.openModal(false);
    },
    onModalSave(payload: {displayName: string, color: Color}): void {
      setIdentity(payload.displayName, payload.color);
      this.modalOpen = false;
      const proceed = this.pendingCreate;
      this.pendingCreate = false;
      if (proceed) {
        void this.doCreate();
      }
    },
    onModalClose(): void {
      this.modalOpen = false;
      this.pendingCreate = false;
    },
    onCreate(): void {
      if (identityState.identity === undefined) {
        this.openModal(true);
        return;
      }
      void this.doCreate();
    },
    onReset(): void {
      resetCreateGameState();
    },
    onBack(): void {
      window.location.assign('/');
    },
    colorName(c: Color): string {
      return this.$t(c.charAt(0).toUpperCase() + c.slice(1));
    },
    async doCreate(): Promise<void> {
      const identity = identityState.identity;
      if (identity === undefined) {
        return;
      }
      createGameState.error = '';
      createGameState.creating = true;
      try {
        const payload = buildCreateGamePayloadFromPremiumState(
          createGameState.config,
          identity,
          {colorName: (c) => this.colorName(c)},
        );
        const res = await fetch(paths.API_CREATEGAME, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {'Content-Type': 'application/json'},
        });
        const text = await res.text();
        let json: {id?: string} | undefined;
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
        if (!res.ok || json === undefined || json.id === undefined) {
          throw new Error('create-failed');
        }
        // Multiplayer game created — open the game home (existing navigation).
        window.location.assign('game?id=' + encodeURIComponent(json.id));
      } catch {
        createGameState.creating = false;
        createGameState.error = 'Could not create the game. Please try again.';
      }
    },
  },
});
</script>
