<template>
  <!--
    A TWO-TAB "remove animals OR plants from any player" picker (Virus). The tabs
    switch the target CATEGORY; each tab lists its VALID targets with a
    `current → resulting` impact, so the player sees EXACTLY what is removed and
    from whom BEFORE the single submit. Selecting a target captures ONE top-level
    OrOptions response (the indices are server-computed). Reuses ActionTargetCard
    for the animal cards (grouped by owner); the plant players are rich target rows.
  -->
  <div class="virus-tabs">
    <div class="virus-tabs__bar" role="tablist">
      <button v-if="model.animal"
              type="button"
              class="virus-tabs__tab"
              :class="{'virus-tabs__tab--active': activeTab === 'animal'}"
              role="tab"
              :aria-selected="activeTab === 'animal'"
              @click="activeTab = 'animal'">
        <span class="virus-tabs__tab-icon" :class="iconClass(model.animal.icon)" aria-hidden="true"></span>
        <span class="virus-tabs__tab-label" v-i18n>{{ text(model.animal.label) }}</span>
        <span class="virus-tabs__tab-count">{{ animalCount }}</span>
      </button>
      <button v-if="model.plant"
              type="button"
              class="virus-tabs__tab"
              :class="{'virus-tabs__tab--active': activeTab === 'plant'}"
              role="tab"
              :aria-selected="activeTab === 'plant'"
              @click="activeTab = 'plant'">
        <span class="virus-tabs__tab-icon" :class="iconClass(model.plant.icon)" aria-hidden="true"></span>
        <span class="virus-tabs__tab-label" v-i18n>{{ text(model.plant.label) }}</span>
        <span class="virus-tabs__tab-count">{{ model.plant.targets.length }}</span>
      </button>
    </div>

    <!-- Animals — a card pick (grouped by owner), no auto-select (the OR branch
         must be a conscious choice). -->
    <div v-if="activeTab === 'animal' && model.animal" class="virus-tabs__panel">
      <ActionTargetCard :input="model.animal.input"
                        :playerView="playerView"
                        :amount="-model.animal.amount"
                        :autoSelect="false"
                        :selectedName="selectedAnimalName"
                        @change="onAnimalChange" />
    </div>

    <!-- Plants — rich player target rows. A PROTECTED player is shown as a greyed,
         non-selectable row with its reason (never hidden), so the attacker sees it. -->
    <div v-else-if="activeTab === 'plant' && model.plant" class="virus-tabs__panel virus-tabs__plants">
      <button v-for="t in model.plant.targets"
              :key="t.color"
              type="button"
              class="virus-plant"
              :class="{'virus-plant--selected': !t.disabled && selectedPlantIndex === t.optionIndex, 'virus-plant--disabled': t.disabled}"
              :disabled="t.disabled === true"
              @click="t.disabled ? undefined : selectPlant(t.optionIndex)">
        <span class="virus-plant__id">
          <span class="virus-plant__dot" :class="'player_bg_color_' + t.color" aria-hidden="true"></span>
          <span class="virus-plant__name">{{ t.name }}</span>
        </span>
        <span v-if="t.disabled" class="virus-plant__reason" v-i18n>{{ text(t.reason ?? '') }}</span>
        <template v-else>
          <span class="virus-plant__impact">
            <span class="virus-plant__icon" :class="iconClass(model.plant.icon)" aria-hidden="true"></span>
            <span class="virus-plant__cur">{{ t.current }}</span>
            <span class="virus-plant__arrow" aria-hidden="true">→</span>
            <span class="virus-plant__res">{{ t.resulting }}</span>
          </span>
          <span class="virus-plant__pick" :class="{'virus-plant__pick--on': selectedPlantIndex === t.optionIndex}">
            <span v-if="selectedPlantIndex === t.optionIndex" class="virus-plant__tick" aria-hidden="true">✓</span>
            <span v-i18n>{{ selectedPlantIndex === t.optionIndex ? 'Selected' : 'Select' }}</span>
          </span>
        </template>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {InputResponse, SelectCardResponse} from '@/common/inputs/InputResponse';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';

/**
 * Hosts a `tabbedTargets` step (Virus). Emits `select` with the chosen target's
 * top-level OrOptions response — the parent (HandCardPaymentContent) captures it
 * as the step's response and replays it in the play batch. `selected` (owned by
 * the parent) drives the highlight + the readiness gate.
 */
export default defineComponent({
  name: 'TabbedRemovalPicker',
  components: {ActionTargetCard},
  props: {
    model: {
      type: Object as PropType<TabbedTargetsStep>,
      required: true,
    },
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    // The captured response (a top-level `{type:'or', index, response}`), or undefined.
    selected: {
      type: Object as PropType<InputResponse | undefined>,
      default: undefined,
    },
  },
  emits: ['select'],
  data() {
    return {
      // Open on whichever tab exists (animals first), or the tab of the current
      // selection if one was already made.
      activeTab: (this.model.animal !== undefined ? 'animal' : 'plant') as 'animal' | 'plant',
    };
  },
  computed: {
    animalCount(): number {
      return this.model.animal?.input.cards.length ?? 0;
    },
    // The selected animal card name (when the captured response is the animal branch).
    selectedAnimalName(): CardName | undefined {
      const r = this.selected;
      if (r?.type === 'or' && this.model.animal !== undefined && r.index === this.model.animal.branchIndex) {
        const inner = r.response;
        if (inner?.type === 'card' && inner.cards.length > 0) {
          return inner.cards[0];
        }
      }
      return undefined;
    },
    // The selected plant target's OrOptions index (when the captured response is a
    // plant option).
    selectedPlantIndex(): number | undefined {
      const r = this.selected;
      if (r?.type === 'or' && r.response?.type === 'option') {
        return r.index;
      }
      return undefined;
    },
  },
  methods: {
    text(m: string | Message): string {
      return typeof m === 'string' ? m : m.message;
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    // ActionTargetCard emits {type:'card', cards:[name]} — wrap it as the animal
    // OrOptions branch (the SelectCard is nested at branchIndex).
    onAnimalChange(resp: SelectCardResponse): void {
      if (this.model.animal === undefined) {
        return;
      }
      this.$emit('select', {type: 'or', index: this.model.animal.branchIndex, response: resp} as InputResponse);
    },
    selectPlant(optionIndex: number): void {
      this.$emit('select', {type: 'or', index: optionIndex, response: {type: 'option'}} as InputResponse);
    },
  },
});
</script>

<style scoped lang="less">
.virus-tabs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

// The category switch — two clearly-separated tabs, the active one cyan-lit.
.virus-tabs__bar {
  display: flex;
  gap: 8px;
}
.virus-tabs__tab {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 12px;
  border-radius: 9px;
  border: 1px solid rgba(120, 200, 255, 0.22);
  background: rgba(18, 36, 52, 0.5);
  color: #cfe6f3;
  font-size: 13px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  &:hover { border-color: rgba(120, 220, 255, 0.55); background: rgba(26, 52, 74, 0.62); }
  &--active {
    border-color: rgba(120, 230, 255, 0.95);
    background: rgba(30, 70, 100, 0.7);
    box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.5), 0 0 16px rgba(80, 200, 255, 0.2);
    color: #eaf6ff;
  }
}
.virus-tabs__tab-icon {
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex: 0 0 auto;
}
.virus-tabs__tab-label { font-weight: 600; }
.virus-tabs__tab-count {
  min-width: 20px;
  padding: 0 7px;
  border-radius: 999px;
  background: rgba(120, 200, 255, 0.18);
  color: #bfe6ff;
  font-size: 11.5px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.virus-tabs__panel { min-width: 0; }
.virus-tabs__plants {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

// A plant target row — player identity on the left, the `plants → plants` impact
// in the middle, the pick affordance on the right.
.virus-plant {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 13px;
  border-radius: 10px;
  border: 1px solid rgba(120, 200, 255, 0.2);
  background: rgba(16, 32, 48, 0.5);
  color: #d8ecf7;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  &:hover { border-color: rgba(120, 220, 255, 0.6); background: rgba(24, 48, 70, 0.62); }
  &--selected {
    border-color: rgba(120, 230, 255, 0.95);
    background: rgba(30, 70, 100, 0.68);
    box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.5), 0 0 16px rgba(80, 200, 255, 0.2);
  }
  // A protected (non-selectable) opponent — shown for information, greyed + inert.
  &--disabled {
    cursor: not-allowed;
    opacity: 0.55;
    filter: saturate(0.5);
    border-style: dashed;
    border-color: rgba(150, 170, 190, 0.3);
    background: rgba(20, 28, 38, 0.45);
    &:hover { border-color: rgba(150, 170, 190, 0.3); background: rgba(20, 28, 38, 0.45); }
  }
}
// The "can't target" reason on a disabled row (e.g. plants are protected).
.virus-plant__reason {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(214, 226, 238, 0.7);
  text-transform: uppercase;
}
.virus-plant__id {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  flex: 1 1 auto;
  min-width: 0;
}
.virus-plant__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex: 0 0 auto;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25), 0 0 6px rgba(0, 0, 0, 0.5);
}
.virus-plant__name {
  font-size: 13.5px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.virus-plant__impact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.virus-plant__icon {
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex: 0 0 auto;
}
.virus-plant__cur { color: rgba(220, 236, 247, 0.72); }
.virus-plant__arrow { color: #ff9f96; font-weight: 700; }
.virus-plant__res { color: #ff9f96; }
.virus-plant__pick {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: 0 0 auto;
  padding: 5px 12px;
  border-radius: 7px;
  border: 1px solid rgba(120, 200, 255, 0.4);
  background: rgba(20, 40, 56, 0.7);
  color: #d7eef5;
  font-size: 12px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  &--on {
    border-color: rgba(120, 230, 255, 0.9);
    background: rgba(40, 90, 120, 0.8);
    color: #eaf9ff;
  }
}
.virus-plant__tick { color: #7af2ff; font-size: 12px; line-height: 1; }
</style>
