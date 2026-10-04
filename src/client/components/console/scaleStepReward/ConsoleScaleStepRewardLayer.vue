<template>
  <!--
    «ШАГ ШКАЛЫ ПЛАТИТ» — the shell-level stage of a card that answers each step
    of a scale (TR24 Venusian Census, Aphrodite; the director:
    scaleStepRewardBeat.ts). Mounted beside the other flight layers and never
    inside a teleported surface, so a fixed token resolves against the viewport.

    It draws only the TOKENS CONDENSING on the marker's rim — the ocean coin's
    anatomy with the data token's or the M€ coin's face — before each hands off
    to the shared Resource Transfer Framework's chip. Its root carries the
    scene's state for the probes (`data-scale-reward*`).

    `con-flight-to-board`: the tokens are born on the board; a workspace over
    the board covers them.
  -->
  <div v-if="scaleStepRewardState.phase !== 'idle' || scaleStepRewardState.degraded"
       class="con-scalepay con-flight-to-board" aria-hidden="true"
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

<script lang="ts">
import {defineComponent} from 'vue';
import {
  ScaleStepCoin, abortScaleStepRewards, registerScaleStepRewardStage, scaleStepRewardState,
} from '@/client/console/scaleStepReward/scaleStepRewardBeat';
import {OCEAN_COIN_SPARKS} from '@/client/console/tilePlacement/tilePlacementModel';

export default defineComponent({
  name: 'ConsoleScaleStepRewardLayer',
  data() {
    return {
      scaleStepRewardState,
      coinEls: new Map<number, HTMLElement>(),
      sparks: Array.from({length: OCEAN_COIN_SPARKS}, (_, i) => i),
      unregister: undefined as (() => void) | undefined,
    };
  },
  methods: {
    coinStyle(c: ScaleStepCoin): Record<string, string> {
      return {left: `${Math.round(c.at.x)}px`, top: `${Math.round(c.at.y)}px`};
    },
    setRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.coinEls.delete(id);
      } else {
        this.coinEls.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerScaleStepRewardStage({
      coins: (): ReadonlyArray<HTMLElement> => {
        const out: Array<HTMLElement> = [];
        for (const c of scaleStepRewardState.coins) {
          const el = this.coinEls.get(c.id);
          if (el !== undefined && el.isConnected) {
            out.push(el);
          }
        }
        return out;
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
    // Shell teardown / game switch mid-scene: every owed hold is paid at once.
    abortScaleStepRewards();
  },
});
</script>
