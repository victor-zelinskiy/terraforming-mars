<template>
  <div class="pmm-identity-chip" :class="{'pmm-identity-chip--empty': identity === undefined}" :style="accentStyle">
    <template v-if="identity !== undefined">
      <span class="pmm-identity-chip__glow" aria-hidden="true"></span>
      <span class="pmm-identity-chip__cube" aria-hidden="true">
        <player-cube :color="identity.cubeColor" :size="26" :glow="true" :shadow="true" :overlay-symbol="false" />
      </span>
      <span class="pmm-identity-chip__text">
        <span class="pmm-identity-chip__label" v-i18n>Player</span>
        <span class="pmm-identity-chip__name">{{ identity.displayName }}</span>
      </span>
      <button type="button" class="pmm-identity-chip__edit" :aria-label="$t('Change')" @click="$emit('open')">
        <span class="pmm-identity-chip__edit-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14.5 5.5 L18.5 9.5 M4 20 L4.6 16.4 L15 6 L18 9 L7.6 19.4 Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="pmm-identity-chip__edit-label" v-i18n>Change</span>
      </button>
    </template>

    <button v-else type="button" class="pmm-identity-chip__create" @click="$emit('open')">
      <span class="pmm-identity-chip__create-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="8.5" r="3.6" stroke="currentColor" stroke-width="1.7"/>
          <path d="M3.6 19 C3.6 15.4 6.4 13 10 13 C11.1 13 12.1 13.2 13 13.7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          <path d="M18 14 V20 M15 17 H21" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="pmm-identity-chip__create-label" v-i18n>Set your name</span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {ResolvedPlayerIdentity} from '@/client/components/mainMenu/identity/playerIdentity';
import {identityState} from '@/client/components/mainMenu/identity/identityState';

// Soft accent tint per colour for the chip rim/glow — kept in sync with the
// player palette (PlayerCube.BASE_RGB / variables.less). Display only.
const ACCENT: Record<Color, string> = {
  red: '233, 78, 60',
  green: '70, 200, 110',
  yellow: '210, 200, 70',
  blue: '70, 150, 255',
  black: '150, 158, 172',
  purple: '170, 100, 255',
  orange: '244, 150, 70',
  pink: '244, 130, 190',
  bronze: '200, 150, 96',
  neutral: '200, 150, 96',
};

export default defineComponent({
  name: 'PremiumIdentityChip',
  components: {PlayerCube},
  emits: ['open'],
  computed: {
    identity(): ResolvedPlayerIdentity | undefined {
      return identityState.identity;
    },
    accentStyle(): Record<string, string> {
      const rgb = this.identity !== undefined ? (ACCENT[this.identity.cubeColor] ?? ACCENT.neutral) : '127, 200, 240';
      return {'--chip-accent': rgb};
    },
  },
});
</script>
