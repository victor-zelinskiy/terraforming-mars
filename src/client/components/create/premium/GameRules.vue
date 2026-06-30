<template>
  <div class="rule-toggles">
    <button
      v-for="r in visibleRules"
      :key="r.id"
      type="button"
      class="rule-toggle"
      :class="{'rule-toggle--on': value(r.id)}"
      :aria-pressed="value(r.id) ? 'true' : 'false'"
      @click="toggle(r.id)"
      @mouseenter="focusInfo(r.id)"
      @focus="focusInfo(r.id)"
    >
      <span class="rule-toggle__icon" aria-hidden="true" v-html="icon(r.icon)"></span>
      <span class="rule-toggle__text">
        <span class="rule-toggle__title" v-i18n>{{ r.labelKey }}</span>
        <span class="rule-toggle__help" v-i18n>{{ r.descKey }}</span>
      </span>
      <span class="rule-toggle__switch" aria-hidden="true"><span class="rule-toggle__knob"></span></span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PREMIUM_RULES, PremiumRuleMeta, PremiumRuleId} from './createGameMeta';
import {createGameState, setInfoFocus} from './createGameState';

const ICONS: Record<PremiumRuleMeta['icon'], string> = {
  draft: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="9" height="13" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 8 H19 M12.5 11 H19 M12.5 14 H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  dice: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7 H8 L16 17 H20 M16 14 L20 17 L16 20 M4 17 H8 L10 14.5 M14 9.5 L16 7 H20 M16 4 L20 7 L16 10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tr: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 9 H15 M12 9 V16 M9 16 H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  venus: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M12 14 V21 M9 18 H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

export default defineComponent({
  name: 'GameRules',
  computed: {
    visibleRules(): ReadonlyArray<PremiumRuleMeta> {
      const selected = createGameState.config.selectedExpansions;
      return PREMIUM_RULES.filter((r) => r.requiresExpansion === undefined || selected[r.requiresExpansion] === true);
    },
  },
  methods: {
    value(id: PremiumRuleId): boolean {
      return createGameState.config.rules[id];
    },
    toggle(id: PremiumRuleId): void {
      createGameState.config.rules[id] = !createGameState.config.rules[id];
      setInfoFocus({kind: 'rule', id});
    },
    focusInfo(id: PremiumRuleId): void {
      setInfoFocus({kind: 'rule', id});
    },
    icon(name: PremiumRuleMeta['icon']): string {
      return ICONS[name];
    },
  },
});
</script>
