<template>
  <section class="cmd-card">
    <div class="cmd-card__identity">
      <template v-if="identity !== undefined">
        <span class="cmd-card__cube" aria-hidden="true">
          <player-cube :color="identity.cubeColor" :size="34" :glow="true" :shadow="true" :overlay-symbol="false" />
        </span>
        <div class="cmd-card__id-text">
          <span class="cmd-card__id-label" v-i18n>Player</span>
          <span class="cmd-card__id-name">{{ identity.displayName }}</span>
        </div>
        <button type="button" class="cmd-card__edit" @click="$emit('edit-identity')">
          <span class="cmd-card__edit-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5 5.5 L18.5 9.5 M4 20 L4.6 16.4 L15 6 L18 9 L7.6 19.4 Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <span v-i18n>Change</span>
        </button>
      </template>
      <button v-else type="button" class="cmd-card__represent" @click="$emit('edit-identity')">
        <span v-i18n>Set your name</span>
      </button>
    </div>

    <div class="cmd-card__tr">
      <div class="cmd-card__tr-head">
        <span class="cmd-card__tr-label">TR Boost</span>
        <span class="cmd-card__tr-help" v-i18n>Additional starting Terraform Rating</span>
      </div>
      <tr-boost-gauge v-model="trBoost" />
    </div>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import TrBoostGauge from '@/client/components/create/premium/TrBoostGauge.vue';
import {ResolvedPlayerIdentity} from '@/client/components/mainMenu/identity/playerIdentity';
import {identityState} from '@/client/components/mainMenu/identity/identityState';
import {createGameState} from './createGameState';

export default defineComponent({
  name: 'PlayerCommandCard',
  components: {PlayerCube, TrBoostGauge},
  emits: ['edit-identity'],
  computed: {
    identity(): ResolvedPlayerIdentity | undefined {
      return identityState.identity;
    },
    trBoost: {
      get(): number {
        return createGameState.config.trBoost;
      },
      set(v: number) {
        createGameState.config.trBoost = v;
      },
    },
  },
});
</script>
