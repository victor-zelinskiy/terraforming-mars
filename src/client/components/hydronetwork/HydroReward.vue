<template>
  <span class="hydro-reward" :class="{'hydro-reward--compact': compact}">
    <template v-for="(chip, i) in chips" :key="i">
      <!-- Standard resource gain (steel / plants / titanium / mc …). -->
      <span v-if="chip.resource !== undefined && chip.production !== true" class="hydro-reward__chip">
        <span v-if="(chip.amount ?? 1) !== 1" class="hydro-reward__amt">{{ chip.amount }}</span>
        <span class="hydro-reward__icon" :class="iconClassFor(chip.resource)" aria-hidden="true"></span>
      </span>

      <!-- Production gain — icon inside a brown production frame. -->
      <span v-else-if="chip.resource !== undefined" class="hydro-reward__chip">
        <span v-if="(chip.amount ?? 1) !== 1" class="hydro-reward__amt">{{ chip.amount }}</span>
        <span class="hydro-reward__prod">
          <span class="hydro-reward__icon" :class="iconClassFor(chip.resource)" aria-hidden="true"></span>
        </span>
      </span>

      <!-- Specials. -->
      <span v-else-if="chip.special === 'plants-per-plant-tag'" class="hydro-reward__chip hydro-reward__chip--special">
        <span class="hydro-reward__icon resource_icon resource_icon--plants" aria-hidden="true"></span>
        <span class="hydro-reward__per" aria-hidden="true">/</span>
        <span class="hydro-reward__tag resource-tag tag-plant" aria-hidden="true"></span>
        <span v-if="!compact" class="hydro-reward__label" v-i18n>{{ SPECIAL_LABEL['plants-per-plant-tag'] }}</span>
      </span>

      <span v-else-if="chip.special === 'add-2-animals'" class="hydro-reward__chip hydro-reward__chip--special">
        <span class="hydro-reward__amt">2</span>
        <span class="hydro-reward__icon card-resource card-resource-animal" aria-hidden="true"></span>
        <span v-if="!compact" class="hydro-reward__label" v-i18n>{{ SPECIAL_LABEL['add-2-animals'] }}</span>
      </span>

      <span v-else-if="chip.special === 'jovian-tag'" class="hydro-reward__chip hydro-reward__chip--special">
        <span class="hydro-reward__tag resource-tag tag-jovian" aria-hidden="true"></span>
        <span v-if="!compact" class="hydro-reward__label" v-i18n>{{ SPECIAL_LABEL['jovian-tag'] }}</span>
      </span>

      <span v-else-if="chip.special === 'draw-4-keep-2'" class="hydro-reward__chip hydro-reward__chip--special">
        <span class="hydro-reward__icon resource_icon resource_icon--cards" aria-hidden="true"></span>
        <span class="hydro-reward__mini">4→2</span>
        <span v-if="!compact" class="hydro-reward__label" v-i18n>{{ SPECIAL_LABEL['draw-4-keep-2'] }}</span>
      </span>

      <span v-else-if="chip.special === 'reuse-blue-action'" class="hydro-reward__chip hydro-reward__chip--special">
        <span class="hydro-reward__glyph" aria-hidden="true">↻</span>
        <span v-if="!compact" class="hydro-reward__label" v-i18n>{{ SPECIAL_LABEL['reuse-blue-action'] }}</span>
      </span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {HydroRewardChip, HydroSpecialReward} from './hydroStages';

// English i18n keys for the abstract reward effects (translated by the overlay).
const SPECIAL_LABEL: Record<HydroSpecialReward, string> = {
  'plants-per-plant-tag': '1 plant per plant tag',
  'draw-4-keep-2': 'Look at 4 cards, take up to 2',
  'reuse-blue-action': 'Reuse a blue card action',
  'jovian-tag': 'Gain a Jovian tag',
  'add-2-animals': 'Add 2 animals to a card',
};

export default defineComponent({
  name: 'HydroReward',
  props: {
    chips: {
      type: Array as () => ReadonlyArray<HydroRewardChip>,
      required: true,
    },
    compact: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {SPECIAL_LABEL};
  },
  methods: {
    iconClassFor,
  },
});
</script>
