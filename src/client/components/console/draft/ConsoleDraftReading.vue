<template>
  <!--
    THE PACKET SHOWCASE'S READING ROW (T10 · CE) — the card under the cursor
    read whole, on ONE line under the packet: its name in the row's hero
    voice · its PLAY cost (the server's, the printed one struck beside it when
    a discount moved it) · its printed tags · its VP · the requirement's
    verdict in the hand's own language. On the purchase the WALLET closes the
    row: «ПОКУПКА N × 3 = −M · У ВАС A → B», each number flipping on change.

    Hierarchy is typographic: the name is the brightest and heaviest voice,
    the facts are objects (an icon and its number), the verdict the quiet
    register of the availability block. Nothing here is a control.
  -->
  <div class="con-dread" data-draft-reading :data-draft-reading-card="reading?.name">
    <template v-if="reading !== undefined">
      <span class="con-dread__name" :key="reading.name">{{ $t(reading.name) }}</span>
      <span v-if="reading.cost !== undefined" class="con-dread__fact con-dread__cost" data-draft-reading-cost>
        <i class="resource_icon resource_icon--megacredits con-dread__mc" aria-hidden="true"></i>
        <b>{{ reading.cost }}</b>
        <s v-if="reading.printedCost !== undefined" class="con-dread__printed">{{ reading.printedCost }}</s>
      </span>
      <span v-if="reading.tags.length > 0" class="con-dread__fact con-dread__tags" data-draft-reading-tags>
        <i v-for="(tag, i) in reading.tags" :key="tag + i" class="con-dread__tag" :style="tagStyle(tag)" aria-hidden="true"></i>
      </span>
      <span v-if="reading.vp !== undefined" class="con-dread__fact con-dread__vp" data-draft-reading-vp>
        <ConsoleVpBadge class="con-dread__vpbadge" :label="$t('VP')" />
        <b>{{ reading.vp.kind === 'number' ? reading.vp.value : '*' }}</b>
      </span>
      <ConsoleCardAvailabilityPanel v-if="reading.availability !== undefined" class="con-dread__verdict"
                                    variant="line" :view="reading.availability" />
    </template>
    <span v-else-if="idle !== ''" class="con-dread__idle">{{ $t(idle) }}</span>
    <span v-if="wallet !== undefined" class="con-dread__wallet" :class="{'con-dread__wallet--over': !wallet.affordable}" data-draft-wallet>
      <span class="con-dread__wallet-kicker">{{ $t('Purchase') }}</span>
      <span class="con-dread__wallet-calc">
        <ConsoleFlipValue :value="wallet.count" flip-on-decrease class="con-dread__wallet-count" /><span class="con-dread__wallet-op">×</span>{{ wallet.perCard }}
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
import {Tag} from '@/common/cards/Tag';
import {DraftReading, DraftWallet} from '@/client/console/draft/draftReadingModel';
import {tagIconStyle} from '@/client/components/premiumCard/premiumCardIcons';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';

export default defineComponent({
  name: 'ConsoleDraftReading',
  components: {ConsoleCardAvailabilityPanel, ConsoleVpBadge, ConsoleFlipValue},
  props: {
    reading: {type: Object as PropType<DraftReading | undefined>, default: undefined},
    wallet: {type: Object as PropType<DraftWallet | undefined>, default: undefined},
    /** The row's line when no card is under the cursor (the wait) — an i18n key, '' for none. */
    idle: {type: String, default: ''},
  },
  methods: {
    tagStyle(tag: Tag): Record<string, string> {
      return tagIconStyle(tag);
    },
  },
});
</script>
