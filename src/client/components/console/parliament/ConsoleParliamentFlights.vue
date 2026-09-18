<template>
  <!-- THE DELEGATE FLIGHTS — cubes on their way from a real place to a real
       place (a body-level fixed layer, measured rects, one proxy per cube),
       and a RESOLUTION being dealt: the deck's back, born on the pile's top
       card and grown into its slot (the face reveals on the touchdown); with a
       face it is THE ENACTED CARD on its way from the voting area to the
       government — the ONE visible instance while it moves (its slot is
       empty, the government's face waits hidden until the touchdown).
       The specs come from `parliamentFlights.ts`; the sitting director's
       shell-level flight layer replaces this renderer. -->
  <Teleport to="body">
    <div v-for="f in flights.flights" :key="f.id" class="con-parl__flight" :ref="(el) => setFlightEl(f.id, el as HTMLElement | null)" :data-parl-flight="f.id" aria-hidden="true">
      <PlayerCube v-if="f.color !== 'neutral'" :color="f.color" :size="f.size" />
      <PlayerCube v-else color="neutral" steel :size="f.size" />
    </div>
    <div v-for="f in flights.cardFlights" :key="f.id" class="con-parl__flight con-parl__flight--card" :class="{'con-parl__flight--face': f.face !== undefined}" :style="{width: f.width + 'px', height: f.height + 'px'}" :ref="(el) => setFlightEl(f.id, el as HTMLElement | null)" :data-parl-flight="f.id" :data-parl-flight-face="f.face?.name" aria-hidden="true">
      <span v-if="f.face === undefined" class="con-parl__cardback"></span>
      <div v-else class="con-parl__flight-face" :style="{zoom: f.width / 320}">
        <premium-card-face :vmOverride="f.face" :lightweight="true" :inert="true" />
      </div>
    </div>
  </Teleport>
</template>
<script lang="ts">
import {defineComponent} from 'vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {parliamentFlights, setFlightEl} from '@/client/console/parliament/parliamentFlights';

/** The proxies of the Parliament's flights, rendered from the flight module's reactive specs. */
export default defineComponent({
  name: 'ConsoleParliamentFlights',
  components: {PlayerCube},
  computed: {
    flights() {
      return parliamentFlights;
    },
  },
  methods: {
    setFlightEl(id: string, el: HTMLElement | null): void {
      setFlightEl(id, el);
    },
  },
});
</script>
