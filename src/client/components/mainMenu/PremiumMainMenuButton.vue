<template>
  <component
    :is="tag"
    class="pmm-btn"
    :class="[`pmm-btn--${variant}`]"
    :href="href"
    :type="href === undefined ? 'button' : undefined"
    @click="onClick"
  >
    <!-- Decorative chrome layers (outer rim, inner plate, sweep). Marked
         aria-hidden so the accessible name is just the label. -->
    <span class="pmm-btn__frame" aria-hidden="true"></span>
    <span class="pmm-btn__plate" aria-hidden="true"></span>
    <span class="pmm-btn__sweep" aria-hidden="true"></span>

    <span class="pmm-btn__icon-cell" aria-hidden="true">
      <span class="pmm-btn__icon">
        <!-- globe + plus (create game) -->
        <svg v-if="icon === 'globe-plus'" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="14" cy="16" r="9" stroke="currentColor" stroke-width="1.6"/>
          <ellipse cx="14" cy="16" rx="3.9" ry="9" stroke="currentColor" stroke-width="1.2" opacity="0.8"/>
          <line x1="5" y1="16" x2="23" y2="16" stroke="currentColor" stroke-width="1.2" opacity="0.8"/>
          <path d="M6.6 11.2 C9.6 12.8 18.4 12.8 21.4 11.2" stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
          <path d="M6.6 20.8 C9.6 19.2 18.4 19.2 21.4 20.8" stroke="currentColor" stroke-width="1.1" opacity="0.55"/>
          <circle cx="25" cy="8" r="5.4" fill="rgba(6,11,18,0.92)" stroke="currentColor" stroke-width="1.6"/>
          <line x1="25" y1="5.4" x2="25" y2="10.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
          <line x1="22.4" y1="8" x2="27.6" y2="8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
        </svg>

        <!-- users (join) -->
        <svg v-else-if="icon === 'users'" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="11.5" r="4.6" stroke="currentColor" stroke-width="1.6"/>
          <path d="M4.5 25.5 C4.5 20.6 8 17.6 12 17.6 C16 17.6 19.5 20.6 19.5 25.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          <circle cx="22.6" cy="13" r="3.6" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>
          <path d="M20.4 18.6 C24 18.2 27.5 20.8 27.5 25" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>
        </svg>

        <!-- cards (cards list) -->
        <svg v-else-if="icon === 'cards'" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="6.5" y="9" width="12.5" height="17" rx="2.2" stroke="currentColor" stroke-width="1.5" transform="rotate(-9 12.75 17.5)" opacity="0.72"/>
          <rect x="13" y="7" width="12.5" height="17" rx="2.2" fill="rgba(6,11,18,0.55)" stroke="currentColor" stroke-width="1.6" transform="rotate(8 19.25 15.5)"/>
          <line x1="16.4" y1="12" x2="22.6" y2="12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" transform="rotate(8 19.25 15.5)"/>
          <line x1="16.4" y1="15" x2="22.6" y2="15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" transform="rotate(8 19.25 15.5)"/>
        </svg>

        <!-- book / manual (how to play) -->
        <svg v-else-if="icon === 'book'" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 9.4 C13 7.6 8.6 7.4 5.5 8.4 L5.5 23.2 C8.6 22.2 13 22.4 16 24.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M16 9.4 C19 7.6 23.4 7.4 26.5 8.4 L26.5 23.2 C23.4 22.2 19 22.4 16 24.2" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <line x1="16" y1="9.4" x2="16" y2="24.2" stroke="currentColor" stroke-width="1.4" opacity="0.7"/>
          <path d="M8.4 12.4 C10 11.9 12 11.9 13.4 12.4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.55"/>
          <path d="M18.6 12.4 C20 11.9 22 11.9 23.6 12.4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity="0.55"/>
        </svg>

        <!-- power (Electron ВЫЙТИ — P10) -->
        <svg v-else-if="icon === 'power'" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10.2 10.2 A9 9 0 1 0 21.8 10.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="16" y1="6" x2="16" y2="15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </span>
    </span>

    <span class="pmm-btn__body">
      <span class="pmm-btn__label" v-i18n>{{ label }}</span>
      <span v-if="sublabel !== undefined" class="pmm-btn__sublabel" v-i18n>{{ sublabel }}</span>
    </span>

    <span class="pmm-btn__chevron" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9 6 L15 12 L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </component>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

export type MenuButtonIcon = 'globe-plus' | 'users' | 'cards' | 'book' | 'power';
export type MenuButtonVariant = 'primary' | 'secondary';

export default defineComponent({
  name: 'PremiumMainMenuButton',
  props: {
    // English source label — translated in place via the v-i18n directive.
    label: {type: String, required: true},
    // Optional smaller second line under the label.
    sublabel: {type: String, default: undefined},
    icon: {type: String as PropType<MenuButtonIcon>, required: true},
    variant: {type: String as PropType<MenuButtonVariant>, default: 'secondary'},
    // When set the button renders as an <a> and navigates. When omitted it is a
    // real <button> that emits `activate` (used for stubbed / coming-soon flows).
    href: {type: String as PropType<string | undefined>, default: undefined},
  },
  emits: ['activate'],
  computed: {
    tag(): string {
      return this.href === undefined ? 'button' : 'a';
    },
  },
  methods: {
    onClick(): void {
      if (this.href === undefined) {
        this.$emit('activate');
      }
    },
  },
});
</script>
