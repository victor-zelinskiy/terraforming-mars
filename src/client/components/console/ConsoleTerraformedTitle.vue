<template>
  <!-- «МАРС ТЕРРАФОРМИРОВАН» — THE TITLE PLATE of the terraformed scene (TR70 — `terraformedScene.ts`).
       It stands in the BLEED ZONE UNDER THE DISC (the dock's clearance + the command bar's row, both receded
       for the scene), never over the planet: the scene's subject is the real Mars with its three arcs, and the
       plate names what the player is looking at — the kicker, the headline in the TV's hero size, the honest
       claim («the current generation will be the last» only when the server says so; otherwise the three
       parameters). It rises INSIDE the show (a short delay after the markers start gliding) and leaves with
       the return. Reads from the scene's state, renders nothing before tact 3, owns no input. -->
  <transition name="con-terraformed">
    <div v-if="visible"
         class="con-terraformed"
         :class="{'con-terraformed--final': final, 'con-terraformed--skipped': skipped}"
         role="status"
         :aria-label="$t('Terraforming complete')"
         data-terraformed-title
         :data-terraformed-phase="phase">
      <div class="con-terraformed__plate">
        <div class="con-terraformed__kicker">{{ $t('Terraforming complete') }}</div>
        <div class="con-terraformed__name">{{ $t('Mars is terraformed') }}</div>
        <div class="con-terraformed__claim">{{ $t(claimKey) }}</div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import {$t} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleTerraformedTitle',
  computed: {
    phase(): string {
      return terraformedSceneState.phase;
    },
    /** From the show to the end of the return — the leave transition carries it out. */
    visible(): boolean {
      return terraformedSceneState.phase === 'show' || terraformedSceneState.phase === 'return';
    },
    final(): boolean {
      return terraformedSceneState.final;
    },
    skipped(): boolean {
      return terraformedSceneState.skipped;
    },
    claimKey(): string {
      return this.final ?
        'The current generation will be the last' :
        'Temperature, oxygen and oceans are complete';
    },
  },
  methods: {
    $t,
  },
});
</script>
