<template>
  <!-- QUICK-WHEEL FLIGHT STAGE — the fixed layer the committed slot's icon
       travels across (wheelFlight.ts). Always mounted, pointer-inert,
       decoration-only: it never serves a prompt and never blocks input. -->
  <div class="con-wheelflight" aria-hidden="true">
    <div v-show="flightState.request !== undefined" ref="proxy" class="con-wheelflight__proxy">
      <BarButtonIcon v-if="visual.barIcon !== undefined" :name="visual.barIcon" />
      <i v-else-if="visual.iconClass !== undefined" :class="visual.iconClass"></i>
      <span v-else-if="visual.glyph !== undefined" class="con-wheelflight__glyph">{{ visual.glyph }}</span>
    </div>
    <span ref="ember" class="con-wheelflight__ember"></span>
  </div>
</template>

<script lang="ts">
/**
 * The stage half of the quick wheel's shared-element transitions. The
 * director (wheelFlight.ts) owns all motion; this component only hosts the
 * two stage elements and re-runs the director when a request arms.
 *
 * GOTCHA (vue-path-watcher): the module store is mirrored into data() so the
 * `flightState.nonce` watcher resolves against the instance — a bare path
 * string over an un-mirrored module reactive silently never fires.
 */
import {defineComponent} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {wheelFlightState, runWheelFlight, WheelFlightVisual} from '@/client/console/quickWheel/wheelFlight';

export default defineComponent({
  name: 'ConsoleWheelFlightLayer',
  components: {BarButtonIcon},
  data() {
    return {
      flightState: wheelFlightState,
    };
  },
  computed: {
    visual(): WheelFlightVisual {
      return this.flightState.request?.visual ?? {};
    },
  },
  watch: {
    'flightState.nonce': function() {
      // The proxy renders this tick (v-show + the request's visual): pose and
      // run on nextTick so the icon component exists before the first frame.
      void this.$nextTick(() => {
        const proxy = this.$refs.proxy as HTMLElement | undefined;
        const ember = this.$refs.ember as HTMLElement | undefined;
        if (proxy !== undefined && ember !== undefined) {
          runWheelFlight({proxy, ember});
        }
      });
    },
  },
});
</script>
