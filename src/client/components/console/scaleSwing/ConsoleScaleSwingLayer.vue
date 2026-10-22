<template>
  <!--
    «ОБРАТНЫЙ ХОД» — the shell-level stage of a PARAMETER SWING (TR47
    Ecological Experiment; the director: scaleSwing/scaleSwingDirector.ts).
    Mounted beside the other flight layers and never inside a teleported
    surface, so a fixed tag resolves against the viewport.

    It draws only the TAGS — the fall's «−1 · РТ остаётся» beside the marker
    that just stepped down (or under the status strip's readout of a scale with
    no marker on the board — the ocean count), a limit's «МАКС.» where the
    parameter stands. The markers glide and the HUD flips by themselves (the
    board and the strip read the swing's presented values); the rating tokens
    ride the shared Resource Transfer Framework. Its root carries the scene's
    state for the probes (`data-scale-swing*`).

    `con-flight-to-board`: the tags belong to the board; a workspace over the
    board covers them (the scene plays only over a board the player can see).
  -->
  <div v-if="scaleSwingState.phase !== 'idle'"
       class="con-scaleswing con-flight-to-board" data-flight-lands="board" aria-hidden="true"
       :data-scale-swing="scaleSwingState.phase"
       :data-scale-swing-seq="scaleSwingState.seq"
       :data-scale-swing-leg="scaleSwingState.leg || undefined"
       :data-scale-swing-played="scaleSwingState.played.join(',')"
       :data-scale-swing-degraded="scaleSwingState.degraded ? '1' : undefined">
    <TransitionGroup name="con-scaleswing-tag">
      <div v-for="tag in scaleSwingState.tags" :key="tag.id"
           class="con-scaleswing__tag"
           :class="['con-scaleswing__tag--' + tag.kind, 'con-scaleswing__tag--at-' + tag.anchor]"
           :style="{left: `${Math.round(tag.x)}px`, top: `${Math.round(tag.y)}px`}"
           :data-scale-swing-tag="tag.accent"
           :data-scale-swing-kind="tag.kind">
        <template v-if="tag.kind === 'down'">
          <span class="con-scaleswing__delta">−{{ tag.amount }}{{ tag.unit }}</span>
          <span class="con-scaleswing__sep">·</span>
          <span class="con-scaleswing__note">{{ $t('the TR stays') }}</span>
        </template>
        <span v-else class="con-scaleswing__limit">{{ $t(tag.kind === 'max' ? 'MAX' : 'MIN') }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {resetScaleSwing, scaleSwingState} from '@/client/console/scaleSwing/scaleSwingDirector';

export default defineComponent({
  name: 'ConsoleScaleSwingLayer',
  data() {
    return {scaleSwingState};
  },
  beforeUnmount() {
    // Shell teardown / game switch mid-scene: the display lets go and every held rating is paid at once.
    resetScaleSwing();
  },
});
</script>
