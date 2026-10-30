<template>
  <!-- WHAT ONE SEAT GOT — its TOTALS, one token per unit (`parliamentResultsModel.resultsTotalsOf`), never a chip per
       record (P71 · ledger CY). The ONE renderer of a seat's total, shared by the results card's ledger and the
       breakdown under it («ПОДРОБНОСТИ ВЫПЛАТ» — its «ИТОГО»), so the two surfaces can never disagree on what a seat got.
       The number is the loudest voice (weight and size, never light); an object (a tile, a parameter's step, a walk)
       and a skip are ONE record each, drawn by the one record renderer (`ConsoleSitPayoutPart`). The marks row under
       the tokens says WHERE they came from in icons only — a planet with its «×k», a party's seal, the crown. -->
  <span class="con-sit__totals" data-sit-totals>
    <span v-if="shown.length > 0 || hidden > 0" class="con-sit__totals-tokens">
      <template v-for="total in shown" :key="total.id">
        <span v-if="total.kind === 'unit' || total.kind === 'discard'" class="con-sit__total"
              :class="{'con-sit__total--loss': (total.amount ?? 0) < 0, 'con-sit__total--discard': total.kind === 'discard'}"
              data-sit-total :data-sit-total-kind="total.kind" :data-sit-total-unit="total.unit" :data-sit-total-amount="total.amount" :data-sit-total-records="total.records"
              :data-sit-total-production="total.production ? '' : undefined">
          <span v-if="total.kind === 'discard'" class="con-sit__total-discard" aria-hidden="true">⌫</span>
          <b class="con-sit__total-amount">{{ total.kind === 'discard' ? total.amount : signedAmount(total.amount) }}</b>
          <ConsoleYieldUnit v-if="total.units !== undefined" :classes="unitClasses(total)" extra="con-sit__total-unit" />
          <i v-else class="con-sit__total-unit" :class="unitClass(total)" aria-hidden="true"></i>
          <!-- A resource onto a card: the card's mini name (one recipient), or each recipient with its share. -->
          <span v-if="total.card !== undefined" class="con-sit__total-card" data-sit-total-card>{{ $t(total.card) }}</span>
          <span v-else-if="total.cards !== undefined" class="con-sit__total-card" data-sit-total-card>
            <span v-for="entry in total.cards" :key="entry.card" class="con-sit__total-card-entry">{{ $t(entry.card) }} +{{ entry.amount }}</span>
          </span>
        </span>
        <span v-else-if="total.kind === 'object' && total.part !== undefined" class="con-sit__total con-sit__total--object"
              data-sit-total data-sit-total-kind="object" :data-sit-total-unit="total.part.kind" data-sit-total-records="1">
          <!-- A colony BUILT (Colony Contest) names WHICH tile — its planet and name lead the record. -->
          <ConsoleSitPayoutPart :part="total.part" :leadsColony="total.part.kind === 'colony'" />
        </span>
      </template>
      <!-- THE FOLD (a theoretical edge the solver names): what does not fit is COUNTED, and X shows it. -->
      <span v-if="hidden > 0" class="con-sit__total con-sit__total--fold" data-sit-total-fold :data-sit-total-fold-count="hidden"><span class="con-sit__total-fold-mark" aria-hidden="true">⋯</span>+{{ hidden }}</span>
    </span>
    <span v-for="total in skips" :key="total.id" class="con-sit__total con-sit__total--skipped" data-sit-total data-sit-total-kind="skipped" data-sit-total-records="1">
      <ConsoleSitPayoutPart v-if="total.part !== undefined" :part="total.part" />
    </span>
    <span v-if="marks.length > 0" class="con-sit__marks" data-sit-total-sources>
      <span v-for="mark in marks" :key="markKey(mark)" class="con-sit__mark" data-sit-total-source :data-sit-total-source-kind="mark.kind"
            :data-sit-total-source-of="markOf(mark)">
        <template v-if="mark.kind === 'colony'">
          <span class="con-sit__part-planet" :class="planetClass(mark.colony)" aria-hidden="true"></span>
          <b v-if="mark.times !== undefined" class="con-sit__mark-times">×{{ mark.times }}</b>
        </template>
        <img v-else-if="mark.kind === 'party'" class="con-sit__emblem" :src="emblemUrl(mark.party)" alt="" />
        <svg v-else-if="mark.kind === 'winner'" class="con-sit__payout-crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>
      </span>
    </span>
  </span>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleYieldUnit from '@/client/components/console/parliament/ConsoleYieldUnit.vue';
import ConsoleSitPayoutPart from '@/client/components/console/parliament/ConsoleSitPayoutPart.vue';
import {OWN_KIND_UNIT, ResultsTotal, ResultsTotalSource, totalSourceKey} from '@/client/console/parliament/parliamentResultsModel';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

export default defineComponent({
  name: 'ConsoleSitTotals',
  components: {ConsoleYieldUnit, ConsoleSitPayoutPart},
  props: {
    totals: {type: Array as PropType<ReadonlyArray<ResultsTotal>>, required: true},
    /** The marks row (the card's) — where the totals came from. The breakdown prints its sources as lines instead. */
    marks: {type: Array as PropType<ReadonlyArray<ResultsTotalSource>>, default: () => []},
    /** The solver's fold: show only this many tokens, count the rest (undefined = all). */
    fold: {type: Number as PropType<number | undefined>, default: undefined},
  },
  computed: {
    tokens(): ReadonlyArray<ResultsTotal> {
      return this.totals.filter((t) => t.kind !== 'skipped');
    },
    shown(): ReadonlyArray<ResultsTotal> {
      return this.fold === undefined ? this.tokens : this.tokens.slice(0, this.fold);
    },
    hidden(): number {
      return this.tokens.length - this.shown.length;
    },
    skips(): ReadonlyArray<ResultsTotal> {
      return this.totals.filter((t) => t.kind === 'skipped');
    },
  },
  methods: {
    signedAmount(amount: number | undefined): string {
      const n = amount ?? 0;
      return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
    },
    /** The unit's own sprite — the production frame for a production step, a card resource's cube, the card. */
    unitClass(total: ResultsTotal): string {
      if (total.family === 'cardResource') {
        return total.unit === OWN_KIND_UNIT ? iconClassFor('wild') : iconClassFor(cardResourceKey(total.unit));
      }
      return iconClassFor(total.unit) + (total.production ? ' con-iyield__unit--prod' : '');
    },
    unitClasses(total: ResultsTotal): Array<string> {
      return (total.units ?? []).map((unit) => iconClassFor(cardResourceKey(unit)));
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    planetClass(colony: string): string {
      return colony.replace(' ', '-') + '-background';
    },
    markKey(mark: ResultsTotalSource): string {
      return totalSourceKey(mark);
    },
    markOf(mark: ResultsTotalSource): string | undefined {
      return mark.kind === 'colony' ? mark.colony : mark.kind === 'party' ? mark.party : undefined;
    },
  },
});
</script>
