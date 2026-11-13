<template>
  <div v-if="resourceTransferState.flights.length > 0" class="con-transfer con-transfer--under" data-transfer-under aria-hidden="true"></div>
  <div v-if="resourceTransferState.flights.length > 0" class="con-transfer" data-transfer-lit aria-hidden="true">
    <template v-for="f in resourceTransferState.flights" :key="f.id">
      <ConsoleTeleport defer to="[data-transfer-under]" :disabled="layerOf(f.id, 'chip') !== 'under'">
        <div class="con-transfer__chip"
             :class="chipClass(f.spec)"
             :data-transfer-id="f.id"
             :data-transfer-direction="f.spec.direction ?? 'gain'"
             :data-transfer-layer="layerOf(f.id, 'chip')"
             :ref="(el) => setChipRef(f.id, el as HTMLElement | null)">
          <!-- THE VP TOKEN (TR55): the score cell's own emblem — the gold shield the cell wears — with its «±N» seat. -->
          <ConsoleVpBadge v-if="isVp(f.spec)" class="con-transfer__vpface" :label="$t('VP')" />
          <i v-else-if="!isMegacredits(f.spec)" class="con-transfer__icon" :class="iconClass(f.spec)"></i>
          <!-- A LOSS reads «−N»: the same token, the same seat, the sign of what actually happened. -->
          <span class="con-transfer__amt" :class="{'con-transfer__amt--mc': isMegacredits(f.spec)}">{{ f.spec.direction === 'loss' ? '−' : '+' }}{{ f.spec.amount }}</span>
        </div>
      </ConsoleTeleport>
      <ConsoleTeleport defer to="[data-transfer-under]" :disabled="layerOf(f.id, 'end') !== 'under'">
        <div class="con-transfer__beat"
             :class="{'con-transfer__beat--production': f.spec.channel === 'production', 'con-transfer__beat--vp': isVp(f.spec)}"
             :ref="(el) => setBeatRef(f.id, el as HTMLElement | null)"></div>
        <!-- THE RECEIVER ANNOUNCES ITSELF (T06 — «ожидает»): a thin ring in the resource's tone over the destination
             from the token's birth to its touchdown (the director places it on the receiver's resting box). -->
        <div v-if="f.spec.direction !== 'loss'"
             class="con-transfer__expect"
             :data-expect-resource="f.spec.resource"
             :ref="(el) => setExpectRef(f.id, el as HTMLElement | null)"></div>
      </ConsoleTeleport>
    </template>
  </div>
  <ol v-if="trailOn" class="con-transfer-trail" data-transfer-trail aria-hidden="true">
    <!-- THE FLIGHTS' TRAIL ON SCREEN (T09, decision 8 — `?trail=1`): the last events of the transfer trail — the seeds'
         verdicts (`rail:seed`), the halves' ends (`rail:end`), every flight's ends, the fold's waits — so a report from the
         couch («the price flew into nowhere») comes with WHY. A diagnostic, read-only, never a surface. -->
    <li v-for="(line, i) in trailLines" :key="i" class="con-transfer-trail__line">{{ line }}</li>
  </ol>
</template>

<script setup lang="ts">
/*
 * RESOURCE TRANSFER STAGE — the fixed, app-level layer of the shared
 * "receiving resources" language (consoleResourceTransfer /
 * resourceTransferDirector). Mounted once in ConsoleShell; empty & free
 * when nothing flies.
 *
 * Each flight is a PHYSICAL chip built from the game's REAL resource art —
 * never a bespoke animation icon:
 *  - a standard-resource chip = the panel's own `resource_icon` sprite;
 *  - a PRODUCTION chip = the same sprite seated in the printed brown
 *    production plate (the card language — unmistakably production);
 *  - a card-resource chip = the round `card-resource` token sprite;
 *  - megacredits = the gold M€ tile with the amount printed ON it (the
 *    canonical M€ reading), «+N» centred.
 * Every chip carries its amount — «+1» included — in a contrast-managed
 * plate that reads on any resource colour at TV distance.
 *
 * THE TWO PAINTS (T12 / CA — «жетон никогда не красится под поверхностью, на которую садится»). Two fixed twin
 *       layers in ONE coordinate space: the LIT layer over every surface a token can land on (the rail, the strip, a
 *       seat's plaque, the dock — see the z map in console_resource_transfer.less) and its SHADED twin under the shade,
 *       where a token born on a board cell under a standing workspace starts (the board's own background story, the
 *       09-03 alarm). The director hands a token between them where it leaves the covered area: the SAME element moves
 *       (`<Teleport :disabled>` — Vue keeps the node, its transform, its tweens), so a handover is never a jump. The
 *       destination's marks (the contact beat, the receiver's ring) stand in the destination's paint.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';
import {resourceTransferState, registerResourceTransferStage, transferTrailState, transferTrailTail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {TransferStagePiece} from '@/client/console/resourceTransfer/resourceTransferDirector';
import {TransferPaintLayer} from '@/client/console/resourceTransfer/resourceTransferModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {isVpTransfer} from '@/client/console/resourceTransfer/resourceTransferModel';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleResourceTransferLayer'});

let unregister: (() => void) | undefined;
const chipEls = ref(new Map<number, HTMLElement>());
const beatEls = ref(new Map<number, HTMLElement>());
const expectEls = ref(new Map<number, HTMLElement>());
/** Which twin layer each flight's token (`chip`) and its destination's marks (`end`) paint in — the director's to set. */
const layers = ref<Record<string, TransferPaintLayer>>({});
const trailOn = ref(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('trail') === '1');

/** The trail's last events, one line each (`?trail=1`): «t ev detail», the detail clipped to one line. */
const trailLines = computed((): Array<string> => {
  if (!trailOn.value) {
    return [];
  }
  void transferTrailState.seq;
  return transferTrailTail(24).map((e) => {
    const detail = e.detail === undefined ? '' : JSON.stringify(e.detail);
    return `${e.t} ${e.runId ?? '·'} ${e.ev} ${detail.length > 140 ? detail.slice(0, 140) + '…' : detail}`;
  });
});

/** The layer a flight's part paints in (lit until the director says otherwise). */
function layerOf(id: number, part: 'chip' | 'end'): TransferPaintLayer {
  return layers.value[`${part}:${id}`] ?? 'lit';
}
/** The score cell's VP token (TR55). */
function isVp(spec: ResourceTransferSpec): boolean {
  return isVpTransfer(spec);
}
function isMegacredits(spec: ResourceTransferSpec): boolean {
  return spec.channel === 'stock' && spec.resource === 'megacredits';
}
function chipClass(spec: ResourceTransferSpec): Record<string, boolean> {
  return {
    'con-transfer__chip--mc': isMegacredits(spec),
    'con-transfer__chip--production': spec.channel === 'production',
    'con-transfer__chip--cardres': spec.channel === 'card-resource',
    // THE VP TOKEN (TR55) — the score cell's emblem, its own geometry.
    'con-transfer__chip--vp': isVpTransfer(spec),
    // A LOSS leaves the panel for the source — the same token in the loss tone (quiet, never celebrated).
    'con-transfer__chip--loss': spec.direction === 'loss',
  };
}
/** The game's ONE icon resolver — the chip shows the real resource art. */
function iconClass(spec: ResourceTransferSpec): string {
  return iconClassFor(spec.resource);
}
function setChipRef(id: number, el: HTMLElement | null): void {
  if (el === null) {
    chipEls.value.delete(id);
    // The flight is gone: its layers go with it (a later flight with this id paints lit until told otherwise).
    delete layers.value[`chip:${id}`];
    delete layers.value[`end:${id}`];
  } else {
    chipEls.value.set(id, el);
  }
}
function setBeatRef(id: number, el: HTMLElement | null): void {
  if (el === null) {
    beatEls.value.delete(id);
  } else {
    beatEls.value.set(id, el);
  }
}
function setExpectRef(id: number, el: HTMLElement | null): void {
  if (el === null) {
    expectEls.value.delete(id);
  } else {
    expectEls.value.set(id, el);
  }
}

onMounted(() => {
  unregister = registerResourceTransferStage({
    piece: (id: number): TransferStagePiece | undefined => {
      const chip = chipEls.value.get(id);
      if (chip === undefined || !chip.isConnected) {
        return undefined;
      }
      return {
        chip, beat: beatEls.value.get(id), expect: expectEls.value.get(id),
        setLayer: (part: 'chip' | 'end', layer: TransferPaintLayer) => {
          layers.value[`${part}:${id}`] = layer;
        },
      };
    },
  });
});
onBeforeUnmount(() => {
  unregister?.();
});
</script>
