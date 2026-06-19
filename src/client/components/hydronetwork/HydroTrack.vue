<template>
  <div class="hydro-track" role="list">
    <template v-for="(vm, i) in stages" :key="vm.position">
      <div v-if="i > 0"
           class="hydro-track__link"
           :class="{
             'hydro-track__link--done': linkDone(vm),
             'hydro-track__link--route': linkRoute(vm),
           }"
           aria-hidden="true"></div>
      <HydroStageCell class="hydro-track__cell" :vm="vm" />
    </template>
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
  methods: {
    // The connector leading INTO this cell is "done" (already travelled) or part
    // of the planned route (will be travelled by the selected move).
    linkDone(vm: HydroStageVM): boolean {
      return vm.state === 'completed' || vm.state === 'current';
    },
    linkRoute(vm: HydroStageVM): boolean {
      return vm.state === 'route' || vm.state === 'target';
    },
  },
});
</script>
