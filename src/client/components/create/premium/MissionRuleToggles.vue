<template>
  <div class="rule-toggles">
    <button
      type="button"
      class="rule-toggle"
      :class="{'rule-toggle--on': draft}"
      :aria-pressed="draft ? 'true' : 'false'"
      @click="draft = !draft"
      @mouseenter="focusInfo('draft')"
      @focus="focusInfo('draft')"
    >
      <span class="rule-toggle__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3.5" y="6" width="9" height="13" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 8 H19 M12.5 11 H19 M12.5 14 H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      </span>
      <span class="rule-toggle__text">
        <span class="rule-toggle__title" v-i18n>Draft Variant</span>
        <span class="rule-toggle__help" v-i18n>Players pick cards through a draft.</span>
      </span>
      <span class="rule-toggle__switch" aria-hidden="true"><span class="rule-toggle__knob"></span></span>
    </button>

    <button
      type="button"
      class="rule-toggle"
      :class="{'rule-toggle--on': randomMA}"
      :aria-pressed="randomMA ? 'true' : 'false'"
      @click="randomMA = !randomMA"
      @mouseenter="focusInfo('randomMA')"
      @focus="focusInfo('randomMA')"
    >
      <span class="rule-toggle__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="9" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="9" cy="15" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/></svg>
      </span>
      <span class="rule-toggle__text">
        <span class="rule-toggle__title">Random Milestones/Awards</span>
        <span class="rule-toggle__help" v-i18n>Milestones and awards are chosen at random.</span>
      </span>
      <span class="rule-toggle__switch" aria-hidden="true"><span class="rule-toggle__knob"></span></span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {createGameState, setInfoFocus} from './createGameState';

export default defineComponent({
  name: 'MissionRuleToggles',
  computed: {
    draft: {
      get(): boolean {
        return createGameState.config.draftVariant;
      },
      set(v: boolean) {
        createGameState.config.draftVariant = v;
      },
    },
    randomMA: {
      get(): boolean {
        return createGameState.config.randomMilestonesAwards;
      },
      set(v: boolean) {
        createGameState.config.randomMilestonesAwards = v;
      },
    },
  },
  methods: {
    focusInfo(id: 'draft' | 'randomMA'): void {
      setInfoFocus({kind: 'rule', id});
    },
  },
});
</script>
