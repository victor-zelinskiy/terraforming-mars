<template>
  <!--
    THE PACKET SHOWCASE'S READING ROW (T10 · CE) — ONE quiet line under the
    packet: the card under the cursor's NAME and, only when there is
    something to say, the requirement's verdict in the hand's own language.
    On the purchase the WALLET closes the row: «ПОКУПКА N × 3 = −M · У ВАС
    A → B», each number flipping on change.

    The row never repeats the face: cost (already discounted), tags, VP and
    its condition are printed on the card right above it, large. The first
    cut listed them all here and read as overload (the owner, 2026-10-23).
    Nothing here is a control.
  -->
  <div class="con-dread" data-draft-reading :data-draft-reading-card="reading?.name">
    <template v-if="reading !== undefined">
      <span class="con-dread__name" :key="reading.name">{{ $t(reading.name) }}</span>
      <ConsoleCardAvailabilityPanel v-if="reading.availability !== undefined" class="con-dread__verdict"
                                    variant="line" :view="reading.availability" />
    </template>
    <span v-else-if="idle !== ''" class="con-dread__idle">{{ $t(idle) }}</span>
    <span v-if="wallet !== undefined" class="con-dread__wallet" :class="{'con-dread__wallet--over': !wallet.affordable}" data-draft-wallet>
      <span class="con-dread__wallet-kicker">{{ $t('Purchase') }}</span>
      <span class="con-dread__wallet-calc">
        <ConsoleFlipValue :value="wallet.count" flip-on-decrease class="con-dread__wallet-count" /><span class="con-dread__wallet-op">×</span><span class="con-price-hint" data-purchase-price :data-hint="wallet.priceHint">{{ wallet.perCard }}</span>
        <span class="con-dread__wallet-op">=</span>
        <b class="con-dread__wallet-total">−<ConsoleFlipValue :value="wallet.total" flip-on-decrease accent="gold" /></b>
        <i class="resource_icon resource_icon--megacredits con-dread__mc" aria-hidden="true"></i>
      </span>
      <span class="con-dread__wallet-sep" aria-hidden="true"></span>
      <span class="con-dread__wallet-kicker">{{ $t('You have') }}</span>
      <span class="con-dread__wallet-calc">
        {{ wallet.onHand }}<span class="con-dread__wallet-op">→</span><b class="con-dread__wallet-after"><ConsoleFlipValue :value="wallet.after" flip-on-decrease /></b>
        <i class="resource_icon resource_icon--megacredits con-dread__mc" aria-hidden="true"></i>
      </span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {DraftReading, DraftWallet} from '@/client/console/draft/draftReadingModel';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';

export default defineComponent({
  name: 'ConsoleDraftReading',
  components: {ConsoleCardAvailabilityPanel, ConsoleFlipValue},
  props: {
    reading: {type: Object as PropType<DraftReading | undefined>, default: undefined},
    wallet: {type: Object as PropType<DraftWallet | undefined>, default: undefined},
    /** The row's line when no card is under the cursor (the wait) — an i18n key, '' for none. */
    idle: {type: String, default: ''},
  },
});
</script>
