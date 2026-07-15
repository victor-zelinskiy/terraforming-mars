<template>
  <!--
    PATENT-SALE HERO STAGE — the fixed, app-level layer of the "cards feed
    the trade terminal, the terminal pays" scene (consolePatentSale /
    patentSaleDirector). Mounted for the WHOLE transaction (arm → done), so:
     - the card flights survive the sale UI closing beneath them;
     - the leak detector counts `.con-sale-hero` as the serving surface
       while the scene briefly holds the follow-up prompt.

    Anatomy:
     - the WELL hosts the card proxies (the shared lite-face + flip chassis)
       and carries the clip line at the terminal's slit mouth — a sinking
       card vanishes INTO the table, never fades in mid-air;
     - the TERMINAL is the slim trade mechanism at the table edge (kicker +
       slit + working scanline + rim glow);
     - the dispensed M€ CHIP flies on the SHARED resource-transfer stage
       (ConsoleResourceTransferLayer) — the one language of receiving
       resources — spawned from this terminal's slit.
  -->
  <div v-if="patentSaleState.active" class="con-sale-hero" aria-hidden="true">
    <div ref="well" class="con-sale-hero__well">
      <div v-for="f in patentSaleState.flights"
           :key="f.id"
           class="con-sale-hero__proxy"
           :ref="(el) => setProxyRef(f.id, el as HTMLElement | null)">
        <div class="con-deal-proxy__flip" :ref="(el) => setFlipRef(f.id, el as HTMLElement | null)">
          <div class="con-deal-proxy__face">
            <ConsoleCardFaceLite :name="f.name" />
          </div>
          <div class="con-deal-proxy__back">
            <div class="con-card-back con-card-back--flyer"></div>
          </div>
        </div>
      </div>
    </div>
    <!-- The payout M€ chip itself is NOT here — it flies on the shared
         resource-transfer stage (ConsoleResourceTransferLayer), spawned
         from this terminal's slit: one visual language of receiving
         resources, sale and card play alike. -->
    <div ref="terminal" class="con-sale-hero__terminal">
      <span class="con-sale-hero__kicker" v-i18n>Patent sale</span>
      <div ref="slit" class="con-sale-hero__slit">
        <div ref="scan" class="con-sale-hero__scan"></div>
      </div>
      <div ref="glow" class="con-sale-hero__glow"></div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {patentSaleState, registerPatentSaleStage} from '@/client/console/patentSale/consolePatentSale';
import {SaleStageEls, SaleProxyEls} from '@/client/console/patentSale/patentSaleDirector';

export default defineComponent({
  name: 'ConsolePatentSaleLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      patentSaleState,
      unregister: undefined as (() => void) | undefined,
      // Function-ref maps (v-for order is not guaranteed across patches).
      proxyEls: new Map<number, HTMLElement>(),
      flipEls: new Map<number, HTMLElement>(),
    };
  },
  methods: {
    setProxyRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.proxyEls.delete(id);
      } else {
        this.proxyEls.set(id, el);
      }
    },
    setFlipRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.flipEls.delete(id);
      } else {
        this.flipEls.set(id, el);
      }
    },
  },
  mounted() {
    // Live element getter — the orchestrator reads it after its own
    // nextTick, so the refs are always current for the active flights.
    this.unregister = registerPatentSaleStage({
      els: (): SaleStageEls | undefined => {
        const well = this.$refs.well as HTMLElement | undefined;
        const terminal = this.$refs.terminal as HTMLElement | undefined;
        const slit = this.$refs.slit as HTMLElement | undefined;
        if (well === undefined || terminal === undefined || slit === undefined || !well.isConnected) {
          return undefined;
        }
        const proxies: Array<SaleProxyEls> = [];
        for (const f of patentSaleState.flights) {
          const root = this.proxyEls.get(f.id);
          if (root !== undefined && root.isConnected) {
            proxies.push({id: f.id, root, flip: this.flipEls.get(f.id)});
          }
        }
        return {
          well,
          terminal,
          slit,
          scan: this.$refs.scan as HTMLElement | undefined,
          glow: this.$refs.glow as HTMLElement | undefined,
          proxies,
        };
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
