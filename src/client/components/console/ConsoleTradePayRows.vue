<template>
  <!--
    «СПОСОБ ОПЛАТЫ» — the payment paths of a trade, as ROWS. ONE component for
    every stage that composes a trade: the colony focus stage and the
    fleet-dock stage (a trade is paid the same way whatever it is made with —
    `tradePayModel.ts` is the one row model behind it).

    It is a FRAGMENT on purpose: the heading, the rows and the receipt are
    siblings of the stage's own decision rows inside ONE scroll column, so a
    wrapper would be one more box for the column's rhythm to disagree with.

    The component draws; the stage owns the cursor, the selection and the
    commit (it passes `focusedIndex` / `chosenIndex` and reads `focusedEl()`
    to keep the cursor's row in view).
  -->
  <div v-if="heading" class="con-colfocus__sec-title">{{ $t('Payment method') }}</div>
  <div v-for="entry in rows" :key="'p' + entry.index"
       class="con-colfocus__payrow"
       :class="{
         'con-colfocus__payrow--focused': focusedIndex === entry.index,
         'con-colfocus__payrow--chosen': chosenIndex === entry.index,
         // THE FEE IS FIXED by the entry (a card action / a party action walked
         // in here), and a fixed fee is not a list: the other paths are not
         // merely unpickable, they are unreachable — the model filters them out.
         'con-colfocus__payrow--locked': lockedIndex === entry.index,
       }"
       :data-pay-index="entry.index"
       :ref="focusedIndex === entry.index ? 'focusedRow' : undefined">
    <span class="con-colfocus__payrow-pick" aria-hidden="true">
      <span v-if="chosenIndex === entry.index" class="con-colfocus__payrow-dot"></span>
    </span>
    <!-- The FLEXIBLE family declares itself BEFORE any step: the ⚡/🔩 icon
         pair (never a lone energy icon over a family steel may pay) — present
         exactly while the Delta Works substitution is live in this trade. -->
    <template v-if="entry.index === energyIndex && energyMixLive">
      <i class="con-colfocus__payrow-icon resource_icon resource_icon--energy con-task__opt-res" aria-hidden="true"></i>
      <span class="con-colfocus__payrow-slash" aria-hidden="true">/</span>
      <i class="con-colfocus__payrow-icon resource_icon resource_icon--steel con-task__opt-res" aria-hidden="true"></i>
    </template>
    <i v-else-if="entry.iconClass !== ''" class="con-colfocus__payrow-icon" :class="entry.iconClass" aria-hidden="true"></i>
    <span class="con-colfocus__payrow-title">{{ entry.title }}</span>
    <!-- The CHOSEN flexible family shows its compact draft («⚡2 + 🔩1») in
         place of the stale energy-only delta; with several valid mixes the
         NEXT STEP is named honestly — the composition itself is edited on the
         payment substep, never inline in this list. -->
    <template v-if="entry.index === chosenIndex && mix !== undefined">
      <span class="con-colfocus__payrow-mix">
        <i class="resource_icon resource_icon--energy" aria-hidden="true"></i><b>{{ mix.energy }}</b>
        <span aria-hidden="true">+</span>
        <i class="resource_icon resource_icon--steel" aria-hidden="true"></i><b>{{ mix.steel }}</b>
      </span>
      <span v-if="mixAdjustable" class="con-colfocus__payrow-next">{{ $t('Next: payment composition') }}</span>
    </template>
    <span v-else-if="entry.preview !== ''" class="con-colfocus__payrow-delta">{{ entry.preview }}</span>
  </div>
  <div v-for="(d, i) in disabled" :key="'d' + i" class="con-colfocus__payrow con-colfocus__payrow--off">
    <span class="con-colfocus__payrow-pick" aria-hidden="true"></span>
    <i v-if="d.iconClass !== ''" class="con-colfocus__payrow-icon" :class="d.iconClass" aria-hidden="true"></i>
    <span class="con-colfocus__payrow-title">{{ d.title }}</span>
    <span class="con-colfocus__payrow-reason">{{ d.reason }}</span>
  </div>
  <!-- PAST THE COMMIT the server takes the options away, but the stage is
       still resolving the move the player made ON IT — so it keeps showing
       WHAT WAS CHOSEN. Blanking the zone here left a hole under a flying
       reward and read as the screen forgetting the decision the moment it was
       taken. -->
  <div v-if="held !== undefined && rows.length === 0"
       class="con-colfocus__payrow con-colfocus__payrow--chosen con-colfocus__payrow--locked"
       data-pay-receipt>
    <span class="con-colfocus__payrow-pick" aria-hidden="true">
      <span class="con-colfocus__payrow-dot"></span>
    </span>
    <i v-if="held.iconClass !== ''" class="con-colfocus__payrow-icon" :class="held.iconClass" aria-hidden="true"></i>
    <span class="con-colfocus__payrow-title">{{ held.title }}</span>
    <!-- A mix commit keeps showing the ACTUAL composition it was paid with —
         never the energy-first preview the family's row advertised before the
         dial. -->
    <span v-if="held.mix !== undefined" class="con-colfocus__payrow-mix">
      <template v-if="held.mix.energy > 0">
        <i class="resource_icon resource_icon--energy" aria-hidden="true"></i><b>{{ held.mix.energy }}</b>
      </template>
      <span v-if="held.mix.energy > 0 && held.mix.steel > 0" aria-hidden="true">+</span>
      <template v-if="held.mix.steel > 0">
        <i class="resource_icon resource_icon--steel" aria-hidden="true"></i><b>{{ held.mix.steel }}</b>
      </template>
    </span>
    <span v-else-if="held.preview !== ''" class="con-colfocus__payrow-delta">{{ held.preview }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {TradePayDisabledEntry, TradePayEntry, TradePayRow} from '@/client/console/colonyTrade/tradePayModel';

export default defineComponent({
  name: 'ConsoleTradePayRows',
  // A fragment has no single root for attributes to fall through to.
  inheritAttrs: false,
  props: {
    /** Draw the «СПОСОБ ОПЛАТЫ» heading (the stage decides: it belongs to the ROWS, not to the mode). */
    heading: {type: Boolean, default: false},
    /** The paths the player can take (`visibleTradePayRows` — the server's index rides along). */
    rows: {type: Array as PropType<ReadonlyArray<TradePayRow>>, default: () => []},
    /** The refused paths, each with the server's reason. */
    disabled: {type: Array as PropType<ReadonlyArray<TradePayDisabledEntry>>, default: () => []},
    /** The chosen path (the server's option index). */
    chosenIndex: {type: Number, default: -1},
    /** The path the entry pins the fee to (`-1` = every path is the player's). */
    lockedIndex: {type: Number, default: -1},
    /** The path under the cursor (`-1` = the cursor is elsewhere). */
    focusedIndex: {type: Number, default: -1},
    /** The energy family's option index (the ⚡/🔩 pair lands there while the substitution is live). */
    energyIndex: {type: Number, default: -1},
    energyMixLive: {type: Boolean, default: false},
    /** The chosen flexible family's draft — the mix the fee would be paid with right now. */
    mix: {type: Object as PropType<{energy: number, steel: number} | undefined>, default: undefined},
    /** Several valid mixes exist: the row names the next step. */
    mixAdjustable: {type: Boolean, default: false},
    /** The RECEIPT: what was chosen, shown once the list itself is gone (past the commit). */
    held: {type: Object as PropType<TradePayEntry | undefined>, default: undefined},
  },
  methods: {
    /** The row under the cursor — the stage keeps it in view. */
    focusedEl(): HTMLElement | undefined {
      const el = this.$refs.focusedRow as HTMLElement | Array<HTMLElement> | undefined;
      return Array.isArray(el) ? el[0] : el;
    },
  },
});
</script>
