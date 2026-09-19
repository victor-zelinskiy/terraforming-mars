<template>
  <!-- THE PARLIAMENT'S FLIGHT LAYER — the SHELL-mounted stage of every proxy
       the Parliament flies (a delegate cube from a real place to a real place,
       a resolution being DEALT, the enacted card moving, a parked card): a
       body-level fixed layer, so a flight survives the section's own
       transforms, its stage's clip and its unmount (a flight layer inside a
       teleported / receding surface inherits its containing block —
       docs/claude/console/workspace-band.md § A FLYING CARD). The specs come
       from `parliamentFlights.ts`; the sitting director launches and lands them.

       A CARD WITH A FACE IS A PHYSICAL BODY (Card3DInner): the premium face
       (the SAME lightweight vm the slot draws — face parity), the deck's back
       and a lit paper edge on a `preserve-3d` body under a perspective owner —
       a dealt card is born face-down and TURNS in flight; a moving enacted
       card is born face-up. Never `opacity` on the body (it flattens the 3D). -->
  <div class="con-parl-flightlayer" aria-hidden="true">
    <div v-for="f in flights.flights" :key="f.id" class="con-parl__flight" :ref="(el) => setFlightEl(f.id, el as HTMLElement | null)" :data-parl-flight="f.id">
      <PlayerCube v-if="f.color !== 'neutral'" :color="f.color" :size="f.size" />
      <PlayerCube v-else color="neutral" steel :size="f.size" />
    </div>
    <div v-for="f in flights.cardFlights" :key="f.id"
         class="con-parl__flight con-parl__flight--card"
         :class="{'con-parl__flight--face': f.face !== undefined, 'con-card3d-outer': f.face !== undefined}"
         :style="{width: f.width + 'px', height: f.height + 'px'}"
         :ref="(el) => setFlightEl(f.id, el as HTMLElement | null)"
         :data-parl-flight="f.id"
         :data-parl-flight-face="f.face?.name"
         :data-parl-flight-body="f.face === undefined ? 'back' : '3d'">
      <span v-if="f.face === undefined" class="con-parl__cardback"></span>
      <!-- GSAP OWNS THE BODY'S TRANSFORM from the first tick (`setCard3DFace`),
           never a Vue `:style` binding: a re-render of this list (a sibling's
           drop) re-applies every bound inline style, and a card turning in
           flight snapped back to its birth pose mid-turn (measured: the last
           dealt card's samples ended at rotateY 180). A face-down card is
           invisible (`autoAlpha: 0`) until its launch, so its first frame's
           side is never seen. -->
      <div v-else class="con-card3d con-deal-proxy__flip">
        <div class="con-card3d__face con-deal-proxy__face">
          <div class="con-parl__flight-face" :style="{zoom: f.width / 320}">
            <premium-card-face :vmOverride="f.face" :lightweight="true" :inert="true" />
          </div>
        </div>
        <div class="con-card3d__back con-deal-proxy__back"><span class="con-parl__cardback"></span></div>
        <div class="con-card3d__edge" aria-hidden="true"></div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent} from 'vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {parliamentFlights, setFlightEl} from '@/client/console/parliament/parliamentFlights';

/** The proxies of the Parliament's flights, rendered by the SHELL from the flight module's reactive specs. */
export default defineComponent({
  name: 'ConsoleParliamentFlightLayer',
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
