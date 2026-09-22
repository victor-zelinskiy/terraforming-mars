<template>
  <!--
    THE COLONY LEDGER (Turmoil Redux — Colonial Affairs): the ONE reading of
    «gain all your colony bonuses k times», wherever a surface needs it — the
    vote panel (compact), the fullscreen inspector's footer (compact), the
    sitting's REWARD stage (hero, the ledger IS the stage's body) and the
    playground.

    Two tiers, one hierarchy. THE MULTIPLIER is the influence-yield block's
    own reading («[influence] 3 → ×3», «+1 if you win · step 3») — the same
    grammar every scaled effect reads in. THE ROWS are the player's tiles, in
    the table's order: the planet, the name, the PRINTED bonus of one repeat,
    «× k =», the row's total. Pluto's pair never merges: its row reads
    «k × (card → discard)». THE SUMS by unit close the block. A seat with no
    cube says so in words — never an empty box.

    Nothing here computes: the rows arrive from the SERVER's registry through
    `colonyLedgerModel.ts`, the states are the server's own records, the
    multiplier is the one shared formula. A row's «received» is the flight's
    landing (the stage hands it in), never the record's arrival.
  -->
  <div class="con-cledger" :class="['con-cledger--' + size, 'con-cledger--' + reading.context, {'con-cledger--empty': reading.empty}]"
       data-colony-ledger
       :data-colony-ledger-context="reading.context"
       :data-colony-ledger-multiplier="reading.multiplier"
       :data-colony-ledger-win="reading.winMultiplier"
       :data-colony-ledger-rows="reading.rows.length"
       :data-colony-ledger-empty="reading.empty ? '' : undefined">
    <span v-if="kicker !== undefined" class="con-cledger__kicker">{{ $t(kicker) }}</span>
    <!-- THE MULTIPLIER — the yield block's own line («×3», the win's suffix). -->
    <ConsoleInfluenceYield v-if="reading.yields.length > 0"
                           class="con-cledger__k"
                           :yields="reading.yields"
                           :oneNumber="reading.context === 'vote'"
                           :formula="false"
                           :captions="false"
                           size="compact"
                           data-colony-ledger-k />
    <!-- NO COLONIES: said in words, with the multiplier that would have applied. -->
    <span v-if="reading.empty" class="con-cledger__empty" data-colony-ledger-none>{{ $t(emptyKey) }}</span>
    <div v-else class="con-cledger__rows" data-colony-ledger-rows>
      <div v-for="row in reading.rows" :key="row.colony"
           class="con-cledger__row"
           :class="['con-cledger__row--' + rowState(row), {'con-cledger__row--active': activeColony === row.colony}]"
           :data-colony-row="row.colony"
           :data-colony-row-state="rowState(row)"
           :data-colony-row-total="row.total"
           :data-colony-row-active="activeColony === row.colony ? '' : undefined">
        <span class="con-cledger__planet" :class="planetClass(row.colony)" aria-hidden="true"></span>
        <b class="con-cledger__name">{{ $t(row.colony) }}</b>
        <!-- THE PRINTED BONUS of one repeat — the cell every chip of this row leaves from (`data-colony-bonus`). -->
        <span class="con-cledger__bonus" data-colony-bonus>
          <template v-if="row.bonus.kind === 'draw-discard'">
            <i class="con-cledger__unit" :class="cardsClass" aria-hidden="true"></i>
            <span class="con-cledger__arrow" aria-hidden="true">→</span>
            <span class="con-cledger__disc" aria-hidden="true">⌫</span>
          </template>
          <template v-else-if="row.bonus.kind === 'hud' && row.bonus.resource === undefined">
            <span class="con-cledger__desc">{{ $t(row.bonus.description) }}</span>
          </template>
          <template v-else>
            <b class="con-cledger__num">{{ signed(row.bonus.loss === true ? -row.bonus.amount : row.bonus.amount) }}</b>
            <i class="con-cledger__unit" :class="unitClass(row.bonus)" aria-hidden="true"></i>
          </template>
        </span>
        <span class="con-cledger__times" data-colony-row-times>× {{ row.multiplier }}</span>
        <!-- THE ROW'S TOTAL — Pluto's is the number of PAIRS; a description-only benefit repeats. -->
        <span class="con-cledger__total" data-colony-row-sum>
          <template v-if="row.bonus.kind === 'draw-discard' || (row.bonus.kind === 'hud' && row.bonus.resource === undefined)">
            <span class="con-cledger__eq" aria-hidden="true">=</span>
            <b class="con-cledger__num con-cledger__num--sum">{{ row.total }}</b>
            <span class="con-cledger__times-word">{{ $t(timesKey) }}</span>
          </template>
          <template v-else>
            <span class="con-cledger__eq" aria-hidden="true">=</span>
            <b class="con-cledger__num con-cledger__num--sum">{{ signed(row.bonus.loss === true ? -row.total : row.total) }}</b>
            <i class="con-cledger__unit" :class="unitClass(row.bonus)" aria-hidden="true"></i>
          </template>
        </span>
        <!-- THE STATE — only once the payout has run: the skip's reason, or the receipt. -->
        <span v-if="rowState(row) === 'skipped'" class="con-cledger__state con-cledger__state--skipped" data-colony-row-reason>✕ {{ $t(row.skipped ?? 'Skipped') }}</span>
        <span v-else-if="rowState(row) === 'received'" class="con-cledger__state con-cledger__state--received">✓ {{ $t('Received') }}</span>
      </div>
    </div>
    <!-- THE SUMS BY UNIT — what the ledger comes to (a skipped row adds nothing). -->
    <div v-if="!reading.empty && sums.length > 0" class="con-cledger__totals" data-colony-ledger-totals>
      <span class="con-cledger__totals-kicker">{{ $t(totalKey) }}</span>
      <span v-for="sum in sums" :key="sum.key" class="con-cledger__sum" :data-colony-ledger-sum="sum.key">
        <b class="con-cledger__num">{{ sum.text }}</b>
        <i v-if="sum.unit !== ''" class="con-cledger__unit" :class="sum.unit" aria-hidden="true"></i>
        <span v-if="sum.word !== undefined" class="con-cledger__times-word">{{ $t(sum.word) }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {ColonyLedgerBonus, ColonyLedgerRow} from '@/common/parliament/colonyLedger';
import {COLONY_LEDGER_EMPTY, COLONY_LEDGER_TOTAL, ColonyLedgerReading} from '@/client/console/parliament/colonyLedgerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

type Sum = {key: string, text: string, unit: string, word?: string};

export default defineComponent({
  name: 'ConsoleColonyLedger',
  components: {ConsoleInfluenceYield},
  props: {
    reading: {type: Object as PropType<ColonyLedgerReading>, required: true},
    /** `compact` in a panel / a footer, `normal` in a block, `hero` on the stage. */
    size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
    /** An i18n key over the block (the stage prints none — the band is its kicker). */
    kicker: {type: String as PropType<string | undefined>, default: undefined},
    /** The row whose wave is in the air right now (the stage marks exactly one). */
    activeColony: {type: String as PropType<string | undefined>, default: undefined},
    /**
     * The rows whose payout has LANDED — the stage's own fact (a chip's touchdown), so a row reads «received»
     * on the landing and never on the record's arrival. Absent: a paid record reads as received at once.
     */
    landedColonies: {type: Object as PropType<ReadonlySet<string> | undefined>, default: undefined},
  },
  computed: {
    emptyKey(): string {
      return COLONY_LEDGER_EMPTY;
    },
    totalKey(): string {
      return COLONY_LEDGER_TOTAL;
    },
    timesKey(): string {
      return 'time(s)';
    },
    cardsClass(): string {
      return iconClassFor('cards');
    },
    /** The sums as chips: stock by resource, production by resource, card resources by resource, cards, pairs, the rest. */
    sums(): Array<Sum> {
      const t = this.reading.totals;
      const out: Array<Sum> = [];
      for (const entry of t.stock) {
        out.push({key: `stock:${entry.resource}`, text: this.signed(entry.amount), unit: iconClassFor(entry.resource)});
      }
      for (const entry of t.production) {
        out.push({key: `production:${entry.resource}`, text: this.signed(entry.amount), unit: iconClassFor(entry.resource) + ' con-cledger__unit--prod'});
      }
      for (const entry of t.cardResources) {
        out.push({key: `card-resource:${entry.resource}`, text: this.signed(entry.amount), unit: iconClassFor(cardResourceKey(entry.resource))});
      }
      if (t.cards > 0) {
        out.push({key: 'cards', text: this.signed(t.cards), unit: iconClassFor('cards')});
      }
      if (t.pairs > 0) {
        out.push({key: 'pairs', text: String(t.pairs), unit: iconClassFor('cards') + ' con-cledger__unit--pair', word: 'card → discard'});
      }
      return out;
    },
  },
  methods: {
    signed(amount: number): string {
      return amount > 0 ? `+${amount}` : String(amount);
    },
    /** The state the row reads in: a recorded skip, a landed payout, else pending. */
    rowState(row: ColonyLedgerRow): 'pending' | 'received' | 'skipped' {
      if (row.state === 'skipped') {
        return 'skipped';
      }
      if (row.state !== 'paid') {
        return 'pending';
      }
      return this.landedColonies === undefined || this.landedColonies.has(row.colony) ? 'received' : 'pending';
    },
    planetClass(colony: string): string {
      return colony.replace(' ', '-') + '-background';
    },
    /** The icon of a bonus's unit — the console's own sprite families. */
    unitClass(bonus: ColonyLedgerBonus): string {
      switch (bonus.kind) {
      case 'stock': return iconClassFor(bonus.resource ?? 'megacredits');
      case 'production': return iconClassFor(bonus.resource ?? 'megacredits') + ' con-cledger__unit--prod';
      case 'card-resource': return bonus.resource === undefined ? iconClassFor('cards') : iconClassFor(cardResourceKey(bonus.resource));
      case 'cards': return iconClassFor('cards');
      case 'draw-discard': return iconClassFor('cards');
      case 'hud': return bonus.resource === undefined ? '' : iconClassFor(bonus.resource);
      }
    },
  },
});
</script>
