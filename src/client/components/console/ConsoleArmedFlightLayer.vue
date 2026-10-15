<template>
  <!-- THE ONE-PLAY CLASS'S FLIGHT LAYER (TR49) — mounted once by the shell (a flight stage inside a teleported surface
       inherits its containing block). Each token is the armed effect's own badge — the waiver's struck plate, «±2»,
       «−8» — flown by the shared transfer director (`armedEffectFlight.ts`). Empty and free when nothing flies. -->
  <div class="con-armfly" :class="{'con-armfly--idle': state.tokens.length === 0}" aria-hidden="true"
       data-armed-flight :data-armed-flight-trail="state.trail.join(' ')">
    <template v-for="t in state.tokens" :key="t.id">
      <div class="con-armfly__chip"
           :data-armfly-id="t.id"
           :data-armfly-direction="t.direction"
           :data-armfly-source="t.view.source"
           :ref="(el) => setChipRef(t.id, el as HTMLElement | null)">
        <!-- The token IS the dock chip it becomes (or was): the spark + the effect's badge on the class's capsule — never
             a bare plate, which read as part of the card's own printed plate it was born on (the 4K storyboard). -->
        <span class="con-armfly__spark" aria-hidden="true">⚡</span>
        <span v-if="t.view.kind === 'requirementWaiver'" class="con-armed__struck">{{ $t('Reqs') }}</span>
        <span v-else class="con-armed__badge">{{ t.view.badge }}</span>
      </div>
      <div class="con-armfly__beat" :ref="(el) => setBeatRef(t.id, el as HTMLElement | null)"></div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {armedFlightState, registerArmedFlightStage} from '@/client/console/armedEffectFlight';

export default defineComponent({
  name: 'ConsoleArmedFlightLayer',
  data() {
    return {
      state: armedFlightState,
      unregister: undefined as (() => void) | undefined,
      chipEls: new Map<number, HTMLElement>(),
      beatEls: new Map<number, HTMLElement>(),
    };
  },
  methods: {
    setChipRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.chipEls.delete(id);
      } else {
        this.chipEls.set(id, el);
      }
    },
    setBeatRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.beatEls.delete(id);
      } else {
        this.beatEls.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerArmedFlightStage({
      piece: (id: number) => {
        const chip = this.chipEls.get(id);
        return chip === undefined || !chip.isConnected ? undefined : {chip, beat: this.beatEls.get(id)};
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
