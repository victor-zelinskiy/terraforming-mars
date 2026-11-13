<template>
  <div ref="root" class="con-receipt" :style="rowStyle" :data-receipt-phase="phase" :data-receipt-cards="receipt.cards.length" data-table-receipt>
    <div class="con-receipt__row">
      <div v-for="c in receipt.cards" :key="c.card" class="con-receipt__card"
           :class="{'con-receipt__card--landed': landedOn(c)}"
           :data-receipt-card="c.card" :data-receipt-kind="c.iconKey" :data-receipt-count="shownCount(c)"
           :data-receipt-landed="landedOn(c) ? '' : undefined">
        <div class="con-receipt__face">
          <!-- The face mounts once the row is SOLVED, in the tier its solved width paints (warmed at the seed) — a
               face mounted at the guess and re-pointed by the fit would fade its art in twice. -->
          <Card v-if="fitted" :card="modelOf(c)" :lightweight="true" :inert="true" :artTier="artTier" />
        </div>
        <div class="con-receipt__tag">
          <span class="con-receipt__count" data-receipt-change>
            <i class="con-receipt__unit" :class="unitClass(c)" aria-hidden="true"></i>
            <b class="con-receipt__from">{{ c.before }}</b>
            <span class="con-receipt__arrow" aria-hidden="true">→</span>
            <b class="con-receipt__to">{{ c.before + c.amount }}</b>
          </span>
          <span class="con-receipt__vp" :class="{'con-receipt__vp--none': !vpMoves(c)}" :data-receipt-vp="vpMoves(c) ? `${c.vp?.from}-${c.vp?.to}` : undefined">
            <template v-if="vpMoves(c)">
              <span class="con-receipt__vp-word">{{ $t('VP') }}</span>
              <b>{{ c.vp?.from }}</b><span class="con-receipt__arrow" aria-hidden="true">→</span><b class="con-receipt__to">{{ c.vp?.to }}</b>
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * ══ КВИТАНЦИЯ СТОЛА (Turmoil Redux — Sponsored Projects RX40): a card payout that ASKED NOBODY, shown on the
 * seat's own cards. The sitting's screen holds none of them, and the payout has no picker whose capsules a
 * token could land on — so the receipt stands them in the reward stage's zone: the RECEIVING cards as ONE row
 * of faces (the album's density — a face, its name, its capsule), each with the reading of its change under
 * it («[kind] 2 → 3», «ПО 1 → 2» where the points move). The tokens are the director's (`beatReceipt`, the
 * card-receive director's fifth host): born on the law's printed «?», landing on THIS face's capsule in turn;
 * the capsule reads the touchdown (`cardResourceLanded`), never the record. Host-agnostic: it titles nothing
 * (the band reads the payout), owns no input, scrolls nothing (one row, solved from the pane). ══
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/CardFace.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceLanded} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {planReceiptRow, RECEIPT_CARD_W, ReceiptCard, TableReceipt, TableReceiptPhase} from '@/client/console/parliament/tableReceiptBeat';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';
import {$t} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleTableReceipt'});
const props = defineProps({
  receipt: {type: Object as PropType<TableReceipt>, required: true},
  phase: {type: String as PropType<TableReceiptPhase>, default: ''},
});

const root = useTemplateRef<HTMLElement>('root');
const zoom = ref(0.6);
const gap = ref(24);
const fitted = ref(false);
let observer: ResizeObserver | undefined;
const rowStyle = computed((): Record<string, string> => {
  return {'--con-receipt-zoom': String(zoom.value), '--con-receipt-gap': `${gap.value}px`};
});
/** The art file the solved face paints (its CSS width — the zoom is a CSS `zoom` on the natural face). */
const artTier = computed((): CardArtTier => {
  return artTierForWidth(RECEIPT_CARD_W * zoom.value);
});
/** THE ROW, solved from the pane's own box (never the card count alone): one line, the album's face at most. */
function fit(): void {
  const rootNow = root.value;
  if (rootNow === null) {
    return;
  }
  const style = getComputedStyle(rootNow);
  const availW = rootNow.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
  const availH = rootNow.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
  if (availW <= 0 || availH <= 0) {
    return;
  }
  const tag = rootNow.querySelector<HTMLElement>('.con-receipt__tag');
  const tagH = (tag?.offsetHeight ?? 0) + (parseFloat(getComputedStyle(rootNow).rowGap) || 0);
  const plan = planReceiptRow({availW, availH, count: props.receipt.cards.length, ui: conUiScale(), tagH});
  zoom.value = Math.round(plan.zoom * 1000) / 1000;
  gap.value = Math.round(plan.gap);
  fitted.value = true;
}
/** The face's model: the card and what stands on it NOW — the record's «before» plus what has touched down. */
function modelOf(c: ReceiptCard): CardModel {
  return {name: c.card, resources: shownCount(c)} as CardModel;
}
function shownCount(c: ReceiptCard): number {
  return c.before + Math.min(c.amount, cardResourceLanded(c.card));
}
function landedOn(c: ReceiptCard): boolean {
  return cardResourceLanded(c.card) >= c.amount;
}
function unitClass(c: ReceiptCard): string {
  return iconClassFor(c.iconKey);
}
function vpMoves(c: ReceiptCard): boolean {
  return c.vp !== undefined && c.vp.from !== c.vp.to;
}

watch(() => props.receipt.key, (): void => {
  void nextTick(() => fit());
});
onMounted(() => {
  fit();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => fit());
    const el = root.value;
    if (el === null) {
      return;
    }
    observer.observe(el);
  }
});
onBeforeUnmount(() => {
  observer?.disconnect();
  observer = undefined;
});
</script>
