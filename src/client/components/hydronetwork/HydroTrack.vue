<template>
  <!--
    Composed layout — no horizontal/vertical scroll, premium finish-zone:
      row 1:  0 → 1 → 2 → 3 → 4 → 5
                ↵ (carriage return)
      row 2:  6 → 7 → 8 → 9   ‖  [ FINISH: 10 · 11 ]
    The two VP finish slots live in a dedicated, status-styled zone at the END of
    the route (bottom-right), not under the start. A glowing return conduit links
    row 1 → row 2; an entry conduit links 9 → the finish-zone.
  -->
  <div class="hydro-track hydro-track--composed" role="list">
    <div class="hydro-track__row hydro-track__row--top">
      <template v-for="(vm, i) in topStages" :key="vm.position">
        <div v-if="i > 0" class="hydro-track__link" :class="linkClass(vm)" aria-hidden="true"></div>
        <HydroStageCell class="hydro-track__cell" :vm="vm" @select="$emit('select', $event)" />
      </template>
    </div>

    <div class="hydro-track__return" :class="linkClass(stages[6])" aria-hidden="true">
      <span class="hydro-track__return-line"></span>
      <span class="hydro-track__return-head">↵</span>
    </div>

    <div class="hydro-track__row hydro-track__row--bottom">
      <template v-for="(vm, i) in midStages" :key="vm.position">
        <div v-if="i > 0" class="hydro-track__link" :class="linkClass(vm)" aria-hidden="true"></div>
        <HydroStageCell class="hydro-track__cell" :vm="vm" @select="$emit('select', $event)" />
      </template>

      <div class="hydro-track__enter" :class="linkClass(stages[10])" aria-hidden="true"></div>

      <div class="hydro-track__finish">
        <div class="hydro-track__finish-head" v-i18n>Finish</div>
        <div class="hydro-track__finish-cells">
          <HydroStageCell v-for="vm in finishStages" :key="vm.position"
                          class="hydro-track__cell hydro-track__cell--finish" :vm="vm"
                          @select="$emit('select', $event)" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {HydroStageVM} from './hydroNetworkModel';
import HydroStageCell from './HydroStageCell.vue';

export default defineComponent({
  name: 'HydroTrack',
  components: {HydroStageCell},
  props: {
    stages: {
      type: Array as () => ReadonlyArray<HydroStageVM>,
      required: true,
    },
  },
  emits: ['select'],
  computed: {
    topStages(): ReadonlyArray<HydroStageVM> {
      return this.stages.slice(0, 6); // 0..5
    },
    midStages(): ReadonlyArray<HydroStageVM> {
      return this.stages.slice(6, 10); // 6..9
    },
    finishStages(): ReadonlyArray<HydroStageVM> {
      return this.stages.slice(10, 12); // 10 (2 VP) · 11 (5 VP)
    },
  },
  methods: {
    // The connector ENTERING this stage's position: done once travelled, route
    // when the selected move will pass through it.
    linkClass(vm: HydroStageVM | undefined): Record<string, boolean> {
      if (vm === undefined) {
        return {};
      }
      return {
        'hydro-track__link--done': vm.state === 'completed' || vm.state === 'current',
        'hydro-track__link--route': vm.state === 'route' || vm.state === 'target',
      };
    },
  },
});
</script>
