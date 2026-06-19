<template>
  <div class="hydro-stage"
       role="listitem"
       tabindex="0"
       :data-hydro-pos="vm.position"
       :class="[
         'hydro-stage--' + vm.state,
         {
           'hydro-stage--vp': vm.stage.vp !== undefined,
           'hydro-stage--start': vm.position === 0,
           'hydro-stage--occupied': vm.occupiedByOther,
           'hydro-stage--illegal': vm.state === 'target' && !vm.targetLegal,
           'hydro-stage--rewarded': vm.rewardedByViewer,
           'hydro-stage--skipped': vm.skippedByViewer,
           'hydro-stage--skip-reward': vm.willSkipReward,
           'hydro-stage--selected': vm.isSelected,
         },
       ]"
       @click="$emit('select', vm.position)"
       @keydown.enter.prevent="$emit('select', vm.position)"
       @keydown.space.prevent="$emit('select', vm.position)">
    <!-- Requirement / identity row. -->
    <div class="hydro-stage__req">
      <div v-if="vm.stage.tag !== undefined" class="hydro-stage__tag resource-tag" :class="'tag-' + vm.stage.tag" aria-hidden="true"></div>
      <div v-else-if="vm.stage.vp !== undefined" class="hydro-stage__vp">
        <span class="hydro-stage__vp-num">{{ vm.stage.vp }}</span>
        <span class="hydro-stage__vp-unit" v-i18n>VP</span>
      </div>
      <div v-else class="hydro-stage__start" aria-hidden="true">⚑</div>
      <span class="hydro-stage__index">{{ vm.position }}</span>
      <!-- Viewer history badge: stopped+rewarded (✓) vs jumped over (↷). -->
      <span v-if="vm.rewardedByViewer" class="hydro-stage__badge hydro-stage__badge--reward" aria-hidden="true">✓</span>
      <span v-else-if="vm.skippedByViewer" class="hydro-stage__badge hydro-stage__badge--skip" aria-hidden="true">↷</span>
    </div>

    <!-- Stage name. -->
    <div class="hydro-stage__name" v-i18n>{{ vm.stage.nameKey }}</div>

    <!-- Reward. -->
    <div class="hydro-stage__reward" :class="{'hydro-stage__reward--gain': vm.state === 'target', 'hydro-stage__reward--skip': vm.willSkipReward}">
      <template v-if="vm.stage.rewardOptions.length > 1">
        <HydroReward :chips="vm.stage.rewardOptions[0]" :compact="true" />
        <span class="hydro-stage__or" v-i18n>or</span>
        <HydroReward :chips="vm.stage.rewardOptions[1]" :compact="true" />
      </template>
      <HydroReward v-else-if="vm.stage.rewardOptions.length === 1" :chips="vm.stage.rewardOptions[0]" :compact="true" />
      <span v-else class="hydro-stage__no-reward" aria-hidden="true">—</span>
      <span v-if="vm.willSkipReward" class="hydro-stage__skip-tag" v-i18n>skipped</span>
    </div>

    <!-- Player markers. -->
    <div class="hydro-stage__markers">
      <span v-for="m in vm.markers" :key="m.color"
            class="hydro-stage__marker"
            :class="['player_bg_color_' + m.color, {'hydro-stage__marker--viewer': m.isViewer}]"
            aria-hidden="true"></span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {HydroStageVM} from './hydroNetworkModel';
import HydroReward from './HydroReward.vue';

export default defineComponent({
  name: 'HydroStageCell',
  components: {HydroReward},
  props: {
    vm: {
      type: Object as () => HydroStageVM,
      required: true,
    },
  },
  emits: ['select'],
});
</script>
