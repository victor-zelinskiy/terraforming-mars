<template>
  <div v-if="scaleStepRewardState.phase !== 'idle' || scaleStepRewardState.degraded"
       class="con-scalepay con-flight-to-board" data-flight-lands="board" aria-hidden="true"
       :data-scale-reward="scaleStepRewardState.phase"
       :data-scale-reward-seq="scaleStepRewardState.seq"
       :data-scale-reward-landed="scaleStepRewardState.landed"
       :data-scale-reward-degraded="scaleStepRewardState.degraded ? '1' : undefined">
    <div v-for="c in scaleStepRewardState.coins" :key="'coin-' + c.id"
         class="con-tileplace__oceancoin con-scalepay__token"
         :class="{'con-tileplace__oceancoin--data': c.kind === 'data'}"
         :data-scale-token="c.id"
         :style="coinStyle(c)"
         :ref="(el) => setRef(c.id, el as HTMLElement | null)">
      <div v-for="s in sparks" :key="s" class="con-tileplace__coin-spark"></div>
      <div class="con-tileplace__coin-ring"></div>
      <div class="con-tileplace__coin-body">
        <span class="con-tileplace__coin-value">+{{ c.amount }}</span>
        <div class="con-tileplace__coin-sheen"></div>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * «ШАГ ШКАЛЫ ПЛАТИТ» — the shell-level stage of a card that answers each step
 * of a scale (TR24 Venusian Census, Aphrodite; the director:
 * scaleStepRewardBeat.ts). Mounted beside the other flight layers and never
 * inside a teleported surface, so a fixed token resolves against the viewport.
 *
 * It draws only the TOKENS CONDENSING on the marker's rim — the ocean coin's
 * anatomy with the data token's or the M€ coin's face — before each hands off
 * to the shared Resource Transfer Framework's chip. Its root carries the
 * scene's state for the probes (`data-scale-reward*`).
 *
 * `con-flight-to-board` (+ `data-flight-lands="board"`): the coins condense
 * on the board and never leave it — the crossing to the rail is the transfer
 * chip's (born UNDER the shade on a covered board and handed to the lit
 * layer at the edge of the opening — T12 / CA); a workspace over the board
 * covers them.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {onBeforeUnmount, onMounted, ref} from 'vue';
import {
  ScaleStepCoin, abortScaleStepRewards, registerScaleStepRewardStage, scaleStepRewardState,
} from '@/client/console/scaleStepReward/scaleStepRewardBeat';
import {OCEAN_COIN_SPARKS} from '@/client/console/tilePlacement/tilePlacementModel';

defineOptions({name: 'ConsoleScaleStepRewardLayer'});

const coinEls = new Map<number, HTMLElement>();
const sparks = ref(Array.from({length: OCEAN_COIN_SPARKS}, (_, i) => i));
let unregister: (() => void) | undefined;

function coinStyle(c: ScaleStepCoin): Record<string, string> {
  return {left: `${Math.round(c.at.x)}px`, top: `${Math.round(c.at.y)}px`};
}
function setRef(id: number, el: HTMLElement | null): void {
  if (el === null) {
    coinEls.delete(id);
  } else {
    coinEls.set(id, el);
  }
}

onMounted(() => {
  unregister = registerScaleStepRewardStage({
    coins: (): ReadonlyArray<HTMLElement> => {
      const out: Array<HTMLElement> = [];
      for (const c of scaleStepRewardState.coins) {
        const el = coinEls.get(c.id);
        if (el !== undefined && el.isConnected) {
          out.push(el);
        }
      }
      return out;
    },
  });
});
onBeforeUnmount(() => {
  unregister?.();
  // Shell teardown / game switch mid-scene: every owed hold is paid at once.
  abortScaleStepRewards();
});
</script>
