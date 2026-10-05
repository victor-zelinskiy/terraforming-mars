<template>
  <!--
    THE BUILD TRANSACTION'S WITNESS — what a probe reads off the DOM: the scene's phase while it plays, and the
    confession of a flight that could not be played (`degraded`, sticky until the next arm).

    A component of its OWN, so that a phase change re-renders this one node and nothing else. Neither the colonies
    section nor the cube's layer reads the phase in its render: published on the section's root, the phase made that
    whole surface re-render on the press and on every beat of an ORDINARY build (measured: the cube's proxy was born
    10–25 ms later than before). Pointer-inert, out of every layout (`hidden`).
  -->
  <i v-if="colonyBuildState.active || colonyBuildState.degraded"
     class="con-colonybuild__witness"
     hidden
     :data-colony-build-phase="colonyBuildState.active ? colonyBuildState.phase : undefined"
     :data-colony-build-degraded="colonyBuildState.degraded ? '' : undefined"></i>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';

export default defineComponent({
  name: 'ConsoleColonyBuildWitness',
  data() {
    return {colonyBuildState};
  },
});
</script>
