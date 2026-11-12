<template>
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

<script setup lang="ts">
/*
 * «МАРС ТЕРРАФОРМИРОВАН» — THE TITLE PLATE of the terraformed scene (TR70 — `terraformedScene.ts`).
 * It stands in the BLEED ZONE UNDER THE DISC (the dock's clearance + the command bar's row, both receded
 * for the scene), never over the planet: the scene's subject is the real Mars with its three arcs, and the
 * plate names what the player is looking at — the kicker, the headline in the TV's hero size, the honest
 * claim («the current generation will be the last» only when the server says so; otherwise the three
 * parameters). It rises INSIDE the show (a short delay after the markers start gliding) and leaves with
 * the return. Reads from the scene's state, renders nothing before tact 3, owns no input.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed} from 'vue';
import {terraformedSceneState} from '@/client/console/terraformedScene/terraformedScene';
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleTerraformedTitle'});

const phase = computed((): string => terraformedSceneState.phase);
/** From the show to the end of the return — the leave transition carries it out. */
const visible = computed((): boolean => {
  return terraformedSceneState.phase === 'show' || terraformedSceneState.phase === 'return';
});
const final = computed((): boolean => terraformedSceneState.final);
const skipped = computed((): boolean => terraformedSceneState.skipped);
const claimKey = computed((): string => {
  return final.value ?
    'The current generation will be the last' :
    'Temperature, oxygen and oceans are complete';
});
</script>
