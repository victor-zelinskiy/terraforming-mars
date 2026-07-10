<template>
  <!--
    TRADE FLEET LAYER — the ONE app-level stage the console colony-trade
    launch flies on (mounted once in ConsoleShell, above the console surfaces
    and below the command bar). A flight SURVIVES the trade composer closing
    beneath it (consoleTradeFleet.ts owns the beats; tradeFleetDirector the
    GSAP). The ship is a hero-mode ColonyFleetIcon whose colour + engine state
    ride the controller.

    Pointer-inert, clipped (the flight can never create scrollable overflow),
    empty & free when nothing flies. All motion lives in the director.
  -->
  <div class="con-fleet-layer" aria-hidden="true">
    <div v-if="tradeFleetState.active" ref="ship" class="con-fleet-ship">
      <ColonyFleetIcon :color="tradeFleetState.color || 'blue'" mode="hero" :state="shipState" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import ColonyFleetIcon, {FleetShipState} from '@/client/components/colonies/ColonyFleetIcon.vue';
import {
  registerTradeFleetHandle, setTradeFleetPhase, tradeFleetState,
} from '@/client/console/colonyFleet/consoleTradeFleet';
import {runTradeFleetFlight, FleetPhaseName} from '@/client/console/colonyFleet/tradeFleetDirector';

/** Read a fresh, stable rect for a launch/berth anchor (bounded rAF probe). */
function stableRect(resolve: () => HTMLElement | null): Promise<DOMRect | undefined> {
  return new Promise((done) => {
    let tries = 0;
    let last = '';
    const poll = () => {
      tries++;
      const el = resolve();
      const r = el !== null ? el.getBoundingClientRect() : undefined;
      const ok = r !== undefined && r.width > 4 && r.height > 4;
      const sig = ok ? `${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` : '';
      if (ok && sig === last) {
        done(r);
        return;
      }
      last = sig;
      if (tries < 40) {
        requestAnimationFrame(poll);
      } else {
        done(ok ? r : undefined);
      }
    };
    requestAnimationFrame(poll);
  });
}

export default defineComponent({
  name: 'ConsoleTradeFleetLayer',
  components: {ColonyFleetIcon},
  data() {
    return {tradeFleetState};
  },
  computed: {
    /** Map the controller phase → the ship's engine state. */
    shipState(): FleetShipState {
      switch (tradeFleetState.phase) {
      case 'launch': return 'launch';
      case 'transit':
      case 'approach': return 'flight';
      case 'dock':
      case 'ack': return 'docked';
      default: return 'idle';
      }
    },
  },
  watch: {
    /** A fresh launch (armTradeFleet bumped the nonce): run the flight. */
    'tradeFleetState.nonce'() {
      void this.launch();
    },
  },
  methods: {
    async launch(): Promise<void> {
      if (!tradeFleetState.active || typeof window === 'undefined') {
        return;
      }
      // Wait for the ship element to mount (v-if flips with `active`).
      await this.$nextTick();
      const ship = this.$refs.ship as HTMLElement | undefined;
      if (ship === undefined || ship === null) {
        return;
      }
      const colony = tradeFleetState.colonyName;
      // Resolve the launch anchor (the composer's fleet emblem) + the berth
      // (the target colony tile) — both are laid out (the grid sits behind the
      // composer). A missing anchor degrades to a graceful no-flight (the
      // controller's dock still resolves the gate).
      const [from, to] = await Promise.all([
        stableRect(() => document.querySelector<HTMLElement>('[data-fleet-launch]')),
        stableRect(() => document.querySelector<HTMLElement>(`[data-fleet-berth="${this.esc(colony)}"]`)),
      ]);
      if (!tradeFleetState.active) {
        return; // aborted while probing
      }
      if (from === undefined || to === undefined) {
        // No believable anchors (edge layout): skip the visual, but the
        // controller phases still advance so the gate resolves on dock.
        setTradeFleetPhase('approach');
        return;
      }
      const handle = runTradeFleetFlight({
        ship,
        from,
        to,
        reduced: tradeFleetState.reducedMotion,
        onPhase: (phase: FleetPhaseName) => setTradeFleetPhase(phase),
      });
      registerTradeFleetHandle(handle);
    },
    esc(name: string): string {
      return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
    },
  },
  beforeUnmount() {
    registerTradeFleetHandle(undefined);
  },
});
</script>
