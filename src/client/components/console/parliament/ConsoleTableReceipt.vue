<template>
  <!-- ══ КВИТАНЦИЯ СТОЛА (Turmoil Redux — Sponsored Projects RX40): a card payout that ASKED NOBODY, shown on the
       seat's own cards. The sitting's screen holds none of them, and the payout has no picker whose capsules a
       token could land on — so the receipt stands them in the reward stage's zone: the RECEIVING cards as ONE row
       of faces (the album's density — a face, its name, its capsule), each with the reading of its change under
       it («[kind] 2 → 3», «ПО 1 → 2» where the points move). The tokens are the director's (`beatReceipt`, the
       card-receive director's fifth host): born on the law's printed «?», landing on THIS face's capsule in turn;
       the capsule reads the touchdown (`cardResourceLanded`), never the record. Host-agnostic: it titles nothing
       (the band reads the payout), owns no input, scrolls nothing (one row, solved from the pane). ══ -->
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

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import Card from '@/client/components/card/CardFace.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceLanded} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {planReceiptRow, RECEIPT_CARD_W, ReceiptCard, TableReceipt, TableReceiptPhase} from '@/client/console/parliament/tableReceiptBeat';
import {artTierForWidth, CardArtTier} from '@/client/cards/cardArt';

export default defineComponent({
  name: 'ConsoleTableReceipt',
  components: {Card},
  props: {
    receipt: {type: Object as PropType<TableReceipt>, required: true},
    phase: {type: String as PropType<TableReceiptPhase>, default: ''},
  },
  data() {
    return {
      zoom: 0.6,
      gap: 24,
      fitted: false,
      observer: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    rowStyle(): Record<string, string> {
      return {'--con-receipt-zoom': String(this.zoom), '--con-receipt-gap': `${this.gap}px`};
    },
    /** The art file the solved face paints (its CSS width — the zoom is a CSS `zoom` on the natural face). */
    artTier(): CardArtTier {
      return artTierForWidth(RECEIPT_CARD_W * this.zoom);
    },
  },
  watch: {
    'receipt.key'(): void {
      void this.$nextTick(() => this.fit());
    },
  },
  mounted() {
    this.fit();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.fit());
      this.observer.observe(this.$refs.root as HTMLElement);
    }
  },
  beforeUnmount() {
    this.observer?.disconnect();
    this.observer = undefined;
  },
  methods: {
    /** THE ROW, solved from the pane's own box (never the card count alone): one line, the album's face at most. */
    fit(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const style = getComputedStyle(root);
      const availW = root.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      const availH = root.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0);
      if (availW <= 0 || availH <= 0) {
        return;
      }
      const tag = root.querySelector<HTMLElement>('.con-receipt__tag');
      const tagH = (tag?.offsetHeight ?? 0) + (parseFloat(getComputedStyle(root).rowGap) || 0);
      const plan = planReceiptRow({availW, availH, count: this.receipt.cards.length, ui: conUiScale(), tagH});
      this.zoom = Math.round(plan.zoom * 1000) / 1000;
      this.gap = Math.round(plan.gap);
      this.fitted = true;
    },
    /** The face's model: the card and what stands on it NOW — the record's «before» plus what has touched down. */
    modelOf(c: ReceiptCard): CardModel {
      return {name: c.card, resources: this.shownCount(c)} as CardModel;
    },
    shownCount(c: ReceiptCard): number {
      return c.before + Math.min(c.amount, cardResourceLanded(c.card));
    },
    landedOn(c: ReceiptCard): boolean {
      return cardResourceLanded(c.card) >= c.amount;
    },
    unitClass(c: ReceiptCard): string {
      return iconClassFor(c.iconKey);
    },
    vpMoves(c: ReceiptCard): boolean {
      return c.vp !== undefined && c.vp.from !== c.vp.to;
    },
  },
});
</script>
