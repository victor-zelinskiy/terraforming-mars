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
  registerTradeFleetHandle, setTradeFleetLaunchPending, setTradeFleetPhase, tradeFleetState,
} from '@/client/console/colonyFleet/consoleTradeFleet';
import {runTradeFleetFlight, FleetPhaseName} from '@/client/console/colonyFleet/tradeFleetDirector';
import {probeTick} from '@/client/console/probeTick';

/**
 * Read a fresh, stable rect for a launch/berth anchor (a bounded probe). Ticks
 * on `probeTick` — the next frame OR a short timer — never on a bare rAF: on a
 * quiet or slow compositor (a 4K headless frame, a throttled handheld) a rAF
 * probe outlived the server's answer and the flight never started.
 */
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
        probeTick(poll);
      } else {
        done(ok ? r : undefined);
      }
    };
    probeTick(poll);
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
      // THE MEASUREMENT WINDOW: a director is about to exist, and the gate waits
      // for it (`setTradeFleetLaunchPending`) — every exit below closes it.
      setTradeFleetLaunchPending(true);
      // Wait for the ship element to mount (v-if flips with `active`).
      await this.$nextTick();
      const ship = this.$refs.ship as HTMLElement | undefined;
      if (ship === undefined || ship === null) {
        setTradeFleetLaunchPending(false);
        return;
      }
      const target = tradeFleetState.target;
      // Resolve the launch anchor (the fleet dock's own pad — always top
      // right, alive through the focus descent) + the berth. The FOCUS
      // STAGE's ORBITAL berth on the hero planet leads when the stage is up
      // (the trade resolves on the stage — iteration 2); the overview tile's
      // dock is the fallback. A missing anchor degrades to a graceful
      // no-flight (the controller's dock still resolves the gate).
      // ⚠️ MEASURED ladder, never `a ?? b`: `??` only falls through on a
      // MISSING element, so a focus-stage berth that exists but has collapsed
      // (a fold in flight) would win the query and the ship would dock at
      // nothing while the visible tile berth was never tried.
      const [from, to] = await Promise.all([
        stableRect(() => document.querySelector<HTMLElement>('[data-fleet-launch]')),
        stableRect(() => (target?.kind === 'card' ? this.cardBerthEl(target.card) : this.berthEl(target?.colonyName ?? ''))),
      ]);
      if (!tradeFleetState.active) {
        setTradeFleetLaunchPending(false);
        return; // aborted while probing
      }
      if (from === undefined || to === undefined) {
        // No believable anchors (edge layout): skip the visual, but the
        // controller phases still advance so the gate resolves on dock.
        setTradeFleetPhase('approach');
        setTradeFleetLaunchPending(false);
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
      setTradeFleetLaunchPending(false);
    },
    esc(name: string): string {
      return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
    },
    /** The FIRST berth that genuinely has a box — the focus stage's orbital
     *  berth leads (the trade resolves on the stage), the overview tile's
     *  dock is the fallback. Measured, never `??`. */
    berthEl(colony: string): HTMLElement | null {
      const key = this.esc(colony);
      let fallback: HTMLElement | null = null;
      for (const sel of [`.con-colfocus [data-fleet-berth="${key}"]`, `[data-fleet-berth="${key}"]`]) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
          const r = el.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) {
            return el;
          }
          fallback = fallback ?? el;
        }
      }
      return fallback;
    },
    /**
     * A FLEET-DOCK CARD's berth (Turmoil Redux TR06 — a trade whose fleet goes
     * to a card): the fleet lands ON THE ▲ of the card's printed effect, the
     * mark slot the premium face reserves there (`[data-fleet-berth="card:…"]`,
     * always laid out, empty while the dock is free). The ladder is MEASURED:
     * the hero face on the dock stage leads (the trade resolves there), the
     * dock's own tile in the «ПРИЧАЛЫ» column follows; with neither standing
     * there is no flight (the phases still advance — the gate resolves), and
     * never a document-wide guess (a card face in some other surface is not
     * where this trade is happening).
     */
    cardBerthEl(card: string): HTMLElement | null {
      const key = this.esc('card:' + card);
      for (const sel of [`.con-fleetdock [data-fleet-berth="${key}"]`, `.con-colonies__docks [data-fleet-berth="${key}"]`]) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
          const r = el.getBoundingClientRect();
          if (r.width > 2 && r.height > 2) {
            return el;
          }
        }
      }
      return null;
    },
  },
  beforeUnmount() {
    registerTradeFleetHandle(undefined);
  },
});
</script>
