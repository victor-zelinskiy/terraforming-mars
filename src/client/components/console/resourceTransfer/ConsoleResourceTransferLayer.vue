<template>
  <!--
    RESOURCE TRANSFER STAGE — the fixed, app-level layer of the shared
    "receiving resources" language (consoleResourceTransfer /
    resourceTransferDirector). Mounted once in ConsoleShell; empty & free
    when nothing flies.

    Each flight is a PHYSICAL chip built from the game's REAL resource art —
    never a bespoke animation icon:
     - a standard-resource chip = the panel's own `resource_icon` sprite;
     - a PRODUCTION chip = the same sprite seated in the printed brown
       production plate (the card language — unmistakably production);
     - a card-resource chip = the round `card-resource` token sprite;
     - megacredits = the gold M€ tile with the amount printed ON it (the
       canonical M€ reading), «+N» centred.
    Every chip carries its amount — «+1» included — in a contrast-managed
    plate that reads on any resource colour at TV distance.
  -->
  <!-- `con-flight-to-board` rides ONLY a board-sourced wave (a cell's printed
       bonus, an Ares/ocean payout, a nomad reward, a remote landing's income):
       under an open workspace / the endgame scene such a wave recedes with
       the board it was born on (see the z ladder in console.less) — while a
       workspace-sourced wave (a played card, the sale, an action commit)
       keeps flying over the panel whose story it is. -->
  <div v-if="resourceTransferState.flights.length > 0" class="con-transfer"
       :class="{'con-flight-to-board': boardSourced}" aria-hidden="true">
    <template v-for="f in resourceTransferState.flights" :key="f.id">
      <div class="con-transfer__chip"
           :class="chipClass(f.spec)"
           :data-transfer-id="f.id"
           :data-transfer-direction="f.spec.direction ?? 'gain'"
           :ref="(el) => setChipRef(f.id, el as HTMLElement | null)">
        <!-- THE VP TOKEN (TR55): the score cell's own emblem — the gold shield the cell wears — with its «±N» seat. -->
        <ConsoleVpBadge v-if="isVp(f.spec)" class="con-transfer__vpface" :label="$t('VP')" />
        <i v-else-if="!isMegacredits(f.spec)" class="con-transfer__icon" :class="iconClass(f.spec)"></i>
        <!-- A LOSS reads «−N»: the same token, the same seat, the sign of what actually happened. -->
        <span class="con-transfer__amt" :class="{'con-transfer__amt--mc': isMegacredits(f.spec)}">{{ f.spec.direction === 'loss' ? '−' : '+' }}{{ f.spec.amount }}</span>
      </div>
      <div class="con-transfer__beat"
           :class="{'con-transfer__beat--production': f.spec.channel === 'production', 'con-transfer__beat--vp': isVp(f.spec)}"
           :ref="(el) => setBeatRef(f.id, el as HTMLElement | null)"></div>
      <!-- THE RECEIVER ANNOUNCES ITSELF (T06 — «ожидает»): a thin ring in the resource's tone over the destination
           from the token's birth to its touchdown (the director places it on the receiver's resting box). -->
      <div v-if="f.spec.direction !== 'loss'"
           class="con-transfer__expect"
           :data-expect-resource="f.spec.resource"
           :ref="(el) => setExpectRef(f.id, el as HTMLElement | null)"></div>
    </template>
  </div>
  <!-- THE FLIGHTS' TRAIL ON SCREEN (T09, decision 8 — `?trail=1`): the last events of the transfer trail — the seeds'
       verdicts (`rail:seed`), the halves' ends (`rail:end`), every flight's ends, the fold's waits — so a report from the
       couch («the price flew into nowhere») comes with WHY. A diagnostic, read-only, never a surface. -->
  <ol v-if="trailOn" class="con-transfer-trail" data-transfer-trail aria-hidden="true">
    <li v-for="(line, i) in trailLines" :key="i" class="con-transfer-trail__line">{{ line }}</li>
  </ol>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {resourceTransferState, registerResourceTransferStage, transferTrailState, transferTrailTail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {TransferStagePiece} from '@/client/console/resourceTransfer/resourceTransferDirector';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {isVpTransfer} from '@/client/console/resourceTransfer/resourceTransferModel';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';

export default defineComponent({
  name: 'ConsoleResourceTransferLayer',
  components: {ConsoleVpBadge},
  data() {
    return {
      resourceTransferState,
      unregister: undefined as (() => void) | undefined,
      chipEls: new Map<number, HTMLElement>(),
      beatEls: new Map<number, HTMLElement>(),
      expectEls: new Map<number, HTMLElement>(),
      transferTrailState,
      trailOn: typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('trail') === '1',
    };
  },
  computed: {
    /** The trail's last events, one line each (`?trail=1`): «t ev detail», the detail clipped to one line. */
    trailLines(): Array<string> {
      if (!this.trailOn) {
        return [];
      }
      void this.transferTrailState.seq;
      return transferTrailTail(24).map((e) => {
        const detail = e.detail === undefined ? '' : JSON.stringify(e.detail);
        return `${e.t} ${e.runId ?? '·'} ${e.ev} ${detail.length > 140 ? detail.slice(0, 140) + '…' : detail}`;
      });
    },
    /** Any live chip of a board-sourced run — the whole layer recedes for the
     *  span (concurrent mixed waves are rare and the demotion is cosmetic). */
    boardSourced(): boolean {
      return this.resourceTransferState.flights.some((f) => f.fromBoard);
    },
  },
  methods: {
    /** The score cell's VP token (TR55). */
    isVp(spec: ResourceTransferSpec): boolean {
      return isVpTransfer(spec);
    },
    isMegacredits(spec: ResourceTransferSpec): boolean {
      return spec.channel === 'stock' && spec.resource === 'megacredits';
    },
    chipClass(spec: ResourceTransferSpec): Record<string, boolean> {
      return {
        'con-transfer__chip--mc': this.isMegacredits(spec),
        'con-transfer__chip--production': spec.channel === 'production',
        'con-transfer__chip--cardres': spec.channel === 'card-resource',
        // THE VP TOKEN (TR55) — the score cell's emblem, its own geometry.
        'con-transfer__chip--vp': isVpTransfer(spec),
        // A LOSS leaves the panel for the source — the same token in the loss tone (quiet, never celebrated).
        'con-transfer__chip--loss': spec.direction === 'loss',
      };
    },
    /** The game's ONE icon resolver — the chip shows the real resource art. */
    iconClass(spec: ResourceTransferSpec): string {
      return iconClassFor(spec.resource);
    },
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
    setExpectRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.expectEls.delete(id);
      } else {
        this.expectEls.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerResourceTransferStage({
      piece: (id: number): TransferStagePiece | undefined => {
        const chip = this.chipEls.get(id);
        if (chip === undefined || !chip.isConnected) {
          return undefined;
        }
        return {chip, beat: this.beatEls.get(id), expect: this.expectEls.get(id)};
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
  },
});
</script>
