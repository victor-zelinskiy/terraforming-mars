<template>
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
        <PremiumPartyRequirementGlyph v-else-if="t.view.kind === 'partyWaiver'" class="pprq--waived con-armed__pprq con-armed__pprq--chip" />
        <span v-else class="con-armed__badge">{{ t.view.badge }}</span>
      </div>
      <div class="con-armfly__beat" :ref="(el) => setBeatRef(t.id, el as HTMLElement | null)"></div>
    </template>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE ONE-PLAY CLASS'S FLIGHT LAYER (TR49) — mounted once by the shell (a flight stage inside a teleported surface
 * inherits its containing block). Each token is the armed effect's own badge — the waiver's struck plate, «±2»,
 * «−8» — flown by the shared transfer director (`armedEffectFlight.ts`). Empty and free when nothing flies.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {onBeforeUnmount, onMounted} from 'vue';
import {$t} from '@/client/directives/i18n';
import {armedFlightState, registerArmedFlightStage} from '@/client/console/armedEffectFlight';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';

defineOptions({name: 'ConsoleArmedFlightLayer'});

const state = armedFlightState;
let unregister: (() => void) | undefined;
const chipEls = new Map<number, HTMLElement>();
const beatEls = new Map<number, HTMLElement>();

function setChipRef(id: number, el: HTMLElement | null): void {
  if (el === null) {
    chipEls.delete(id);
  } else {
    chipEls.set(id, el);
  }
}
function setBeatRef(id: number, el: HTMLElement | null): void {
  if (el === null) {
    beatEls.delete(id);
  } else {
    beatEls.set(id, el);
  }
}

onMounted(() => {
  unregister = registerArmedFlightStage({
    piece: (id: number) => {
      const chip = chipEls.get(id);
      return chip === undefined || !chip.isConnected ? undefined : {chip, beat: beatEls.get(id)};
    },
  });
});
onBeforeUnmount(() => {
  unregister?.();
});
</script>
