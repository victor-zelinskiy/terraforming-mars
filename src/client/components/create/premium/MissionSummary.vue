<template>
  <aside class="mission-summary">
    <span class="mission-summary__corner mission-summary__corner--tl" aria-hidden="true"></span>
    <span class="mission-summary__corner mission-summary__corner--tr" aria-hidden="true"></span>

    <h2 class="mission-summary__title" v-i18n>Mission summary</h2>

    <div class="mission-summary__rows">
      <div class="mission-summary__row">
        <span class="mission-summary__label" v-i18n>Player</span>
        <span class="mission-summary__value">
          <template v-if="identity !== undefined">
            <span class="mission-summary__cube" aria-hidden="true">
              <player-cube :color="identity.cubeColor" :size="18" :glow="false" :shadow="false" :overlay-symbol="false" />
            </span>
            <span class="mission-summary__player-name">{{ identity.displayName }}</span>
          </template>
          <span v-else class="mission-summary__muted" v-i18n>Not set</span>
        </span>
      </div>

      <div class="mission-summary__row">
        <span class="mission-summary__label">TR Boost</span>
        <span class="mission-summary__value mission-summary__value--accent">+{{ config.trBoost }}</span>
      </div>

      <div class="mission-summary__row">
        <span class="mission-summary__label" v-i18n>Number of players</span>
        <span class="mission-summary__value">{{ config.playerCount }}</span>
      </div>

      <div class="mission-summary__row">
        <span class="mission-summary__label" v-i18n>Map</span>
        <span class="mission-summary__value capitalized" v-i18n>{{ mapLabel }}</span>
      </div>

      <div class="mission-summary__row mission-summary__row--exp">
        <span class="mission-summary__label" v-i18n>Expansions</span>
        <transition-group tag="span" class="mission-summary__exp-chips" name="summary-chip">
          <span
            v-for="e in enabledExpansions"
            :key="e.id"
            class="mission-summary__exp-chip"
            :data-hint="$t(e.name)"
          >
            <img class="mission-summary__exp-icon" :src="e.icon" :alt="$t(e.name)" />
          </span>
          <span v-if="enabledExpansions.length === 0" key="none" class="mission-summary__muted" v-i18n>Base only</span>
        </transition-group>
      </div>

      <div class="mission-summary__row">
        <span class="mission-summary__label" v-i18n>Draft Variant</span>
        <span class="mission-summary__flag" :class="{'mission-summary__flag--on': config.draftVariant}" v-i18n>{{ config.draftVariant ? 'On' : 'Off' }}</span>
      </div>

      <div class="mission-summary__row">
        <span class="mission-summary__label">Random Milestones/Awards</span>
        <span class="mission-summary__flag" :class="{'mission-summary__flag--on': config.randomMilestonesAwards}" v-i18n>{{ config.randomMilestonesAwards ? 'On' : 'Off' }}</span>
      </div>
    </div>

    <transition name="summary-err">
      <div v-if="error !== ''" class="mission-summary__error" v-i18n>{{ error }}</div>
    </transition>

    <div class="mission-summary__actions">
      <div class="mission-summary__cta-wrap" :data-hint="ctaHint">
        <button
          type="button"
          class="mission-summary__cta"
          :class="{'mission-summary__cta--busy': creating}"
          :disabled="creating"
          @click="$emit('create')"
        >
          <span v-if="creating" class="mission-summary__spinner" aria-hidden="true"></span>
          <span v-i18n>{{ creating ? 'Creating' : 'Create game' }}</span>
        </button>
      </div>
      <div class="mission-summary__secondary">
        <button type="button" class="mission-summary__ghost" @click="$emit('back')"><span v-i18n>Back</span></button>
        <button type="button" class="mission-summary__ghost" @click="$emit('reset')"><span v-i18n>Reset</span></button>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {ResolvedPlayerIdentity} from '@/client/components/mainMenu/identity/playerIdentity';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {createGameState, PremiumCreateGameState} from './createGameState';
import {PREMIUM_EXPANSIONS, expansionIcon, expansionName, mapNameSource} from './createGameMeta';
import {Expansion} from '@/common/cards/GameModule';
import {$t} from '@/client/directives/i18n';

export default defineComponent({
  name: 'MissionSummary',
  components: {PlayerCube},
  emits: ['create', 'back', 'reset', 'edit-identity'],
  computed: {
    identity(): ResolvedPlayerIdentity | undefined {
      return identityState.identity;
    },
    config(): PremiumCreateGameState {
      return createGameState.config;
    },
    creating(): boolean {
      return createGameState.creating;
    },
    error(): string {
      return createGameState.error;
    },
    mapLabel(): string {
      return this.config.mapMode === 'random-all' ? mapNameSource('random-all') : mapNameSource(this.config.mapId);
    },
    enabledExpansions(): Array<{id: Expansion, name: string, icon: string}> {
      return PREMIUM_EXPANSIONS
        .filter((e) => this.config.selectedExpansions[e.id] === true)
        .map((e) => ({id: e.id, name: expansionName(e.id), icon: expansionIcon(e.id)}));
    },
    ctaHint(): string {
      return this.identity === undefined ? $t('Set a player name first') : '';
    },
  },
});
</script>
