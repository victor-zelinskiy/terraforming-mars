<template>
  <!-- ONE PART OF ONE SEAT'S PAYOUT — the ONE renderer of a payout chip (an object and an amount, or a skip with its
       reason), shared by the results card's «ВЫПЛАТЫ» and the step under it, «ПОДРОБНОСТИ ВЫПЛАТ». Moved out of
       `ConsoleParliamentSitting` verbatim (2026-10-24), so the two surfaces can never print one record two ways. -->
  <span class="con-sit__part"
        :class="{'con-sit__part--skipped': part.skipped !== undefined, 'con-sit__part--colony': part.colony !== undefined}" :data-sit-part="part.kind"
        :data-sit-part-colony="part.colony">
    <!-- A COLONY-PAID part (Colonial Affairs) leads with its TILE — the panel groups a seat's parts by it,
         one planet + name per tile, the parts of that tile following (the ledger's own order). -->
    <span v-if="leadsColony" class="con-sit__part-colony" data-sit-part-tile>
      <span class="con-sit__part-planet" :class="planetClass(part.colony ?? '')" aria-hidden="true"></span>
      <b class="con-sit__part-colony-name">{{ $t(part.colony ?? '') }}</b>
    </span>
    <template v-if="part.skipped !== undefined">
      <!-- A LEVEL part at its target (Joint Research) is the rule working, not a skip: the calm
           phrase the band printed, then the server's reason. -->
      <span v-if="part.none !== undefined" class="con-parl__chip-dim" data-sit-part-none>{{ $t(part.none) }}</span>
      <span v-else class="con-parl__chip-dim">{{ $t('Skipped') }} · {{ $t(part.skipped.title) }}</span>
      <span class="con-sit__part-reason" data-sit-part-reason>{{ $t(part.skipped.reason) }}</span>
    </template>
    <template v-else>
      <img v-if="part.party !== undefined" class="con-sit__emblem" :src="emblemUrl(part.party)" alt="" />
      <i v-if="part.tile !== undefined" class="con-sit__door-tile" :class="'con-sit__door-tile--' + part.tile" aria-hidden="true"></i>
      <!-- THE WINNER'S OWN STEP OF A PARAMETER (Mohole Contest): the parameter's icon, the step it made
           (the scales already moved on the board — the row states the step) and the TR it paid the seat. -->
      <template v-if="part.parameter !== undefined">
        <!-- A placed TILE already draws its world (the door tile above) — one icon per fact. -->
        <i v-if="part.tile === undefined" class="con-sit__world-icon" :class="worldUnitClass(part.parameter.id)" aria-hidden="true"></i>
        <span class="con-sit__world" data-sit-part-parameter :data-sit-part-param="part.parameter.id" :data-sit-part-steps="part.amount">
          <b>{{ part.parameter.before }}{{ worldSuffix(part.parameter.id) }}</b>
          <span class="con-parl__chip-dim">→</span>
          <b>{{ part.parameter.after }}{{ worldSuffix(part.parameter.id) }}</b>
        </span>
        <b v-if="part.tr !== undefined && part.tr > 0" class="con-sit__part-stack" data-sit-part-tr>{{ trLabel(part.tr) }}</b>
      </template>
      <!-- A CITY TIER (Skyscrapers): the stack the cell became, the record's own height. -->
      <b v-else-if="part.stack !== undefined" class="con-sit__part-stack" data-sit-part-stack>×{{ part.stack }}</b>
      <!-- A TILE that moved no parameter and became no stack (a colony built for free, a city tile): the tile's
           own name — a tile has no amount, and the generic tail printed «0» for it. -->
      <b v-else-if="part.tile !== undefined" class="con-sit__part-stack" data-sit-part-tile-name>{{ $t(tileLabel(part.tile)) }}</b>
      <!-- A STEP OF THE CAREER (Reds Budget): the insignia, the marker's walk «3 → 4», and what the step paid —
           the TR, the card it dealt, or the M€ a seat with no hand took instead (MarsBot). -->
      <template v-else-if="part.walk !== undefined">
        <i class="career-step-glyph con-sit__part-career" aria-hidden="true"></i>
        <span class="con-sit__world" data-sit-part-walk :data-sit-part-walk-from="part.walk.from" :data-sit-part-walk-to="part.walk.to">
          <b>{{ part.walk.from }}</b>
          <span class="con-parl__chip-dim">→</span>
          <b>{{ part.walk.to }}</b>
        </span>
        <b v-if="part.tr !== undefined && part.tr > 0" class="con-sit__part-stack" data-sit-part-tr>{{ trLabel(part.tr) }}</b>
        <template v-if="part.drawn !== undefined && part.drawn > 0">
          <b data-sit-part-drawn>+{{ part.drawn }}</b>
          <i class="con-sit__part-unit" :class="netUnitClass('cards')" aria-hidden="true"></i>
        </template>
      </template>
      <!-- A HUD-side colony bonus reads by its printed description, signed where it prints an amount (a loss is negative). -->
      <template v-else-if="part.kind === 'colonyBonus'">
        <b v-if="part.unit !== ''">{{ signedAmount(part.amount) }}</b>
        <i v-if="part.unit !== ''" class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
        <span class="con-sit__part-reason" data-sit-part-description>{{ $t(part.description ?? '') }}</span>
      </template>
      <!-- A card thrown away (Pluto's second half): the discard mark, the card. -->
      <template v-else-if="part.kind === 'discard'">
        <span class="con-sit__part-discard" aria-hidden="true">⌫</span>
        <b>{{ part.amount }}</b>
        <i class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
      </template>
      <template v-else>
        <!-- Signed: a LEVY is a negative supply part («−10»), read with its sign, never as a skip;
             a short seat's take carries the shortfall's reason beside it. -->
        <b :class="{'con-sit__part-loss': (part.amount ?? 0) < 0}" :data-sit-part-amount="part.amount">{{ signedAmount(part.amount) }}</b>
        <!-- A unit of SEVERAL kinds («data or microbe») draws as ONE unit joined by «or»; every other part its one icon. -->
        <ConsoleYieldUnit v-if="part.units !== undefined" :classes="partUnitClasses(part)" extra="con-sit__part-unit" />
        <i v-else class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
        <span v-if="part.note !== undefined" class="con-sit__part-reason" data-sit-part-note>{{ $t(part.note) }}</span>
        <!-- A payout SPREAD over several cards names each recipient with its share — the list is the
             record's own (`cards`), never a recount; one recipient prints the sum alone. Where the kinds
             differ per card, each share wears its card's own icon. -->
        <!-- A payout that ASKED NOBODY (Sponsored Projects) says on how many cards it landed, never cut — then
             the KINDS it paid, each once (a short list); the names were the receipt's, which showed every face. -->
        <span v-if="part.eachCard !== undefined" class="con-sit__part-reason con-sit__part-each" data-sit-part-each :data-sit-part-each-count="part.eachCard">{{ eachCardText(part.eachCard) }}</span>
        <span v-if="part.eachCard !== undefined && part.cards !== undefined" class="con-sit__part-cards con-sit__part-cards--kinds" data-sit-part-cards>
          <i v-for="kind in eachKinds(part)" :key="kind" class="con-sit__part-unit con-sit__part-unit--card" :class="cardResourceClass(kind)" :data-sit-part-kind="kind" aria-hidden="true"></i>
        </span>
        <span v-else-if="part.cards !== undefined" class="con-sit__part-cards" data-sit-part-cards>
          <span v-for="entry in part.cards" :key="entry.card" class="con-sit__part-card" :data-sit-part-card="entry.card" :data-sit-part-card-resource="entry.resource">{{ $t(entry.card) }} +{{ entry.amount }}<i v-if="(part.units !== undefined || part.eachCard !== undefined) && entry.resource !== undefined" class="con-sit__part-unit con-sit__part-unit--card" :class="cardResourceClass(entry.resource)" aria-hidden="true"></i></span>
        </span>
      </template>
    </template>
  </span>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParameterMoveId} from '@/common/parliament/parameterMove';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleYieldUnit from '@/client/components/console/parliament/ConsoleYieldUnit.vue';
import {OWN_KIND_UNIT, ResultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {worldParameterUnit} from '@/client/console/parliament/worldMoveModel';
import {translateTextWithParams} from '@/client/directives/i18n';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

export default defineComponent({
  name: 'ConsoleSitPayoutPart',
  components: {ConsoleYieldUnit},
  props: {
    part: {type: Object as PropType<ResultsPayoutPart>, required: true},
    /** The first part of its colony among the seat's parts — it carries the tile's planet and name (the row groups by tile). */
    leadsColony: {type: Boolean, default: false},
  },
  methods: {
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    /** The parameter's own icon — the game's vocabulary, the same sprite the status strip prints. */
    worldUnitClass(parameter: ParameterMoveId): string {
      switch (parameter) {
      case 'oxygen': return 'wgt-icon wgt-icon--oxygen';
      case 'oceans': return 'wgt-icon wgt-icon--ocean';
      case 'venus': return 'wgt-icon wgt-icon--venus';
      case 'temperature': return 'wgt-icon wgt-icon--temperature';
      }
    },
    worldSuffix(parameter: ParameterMoveId): string {
      return worldParameterUnit(parameter);
    },
    /** «РТ +N» — the winner's own step's rating, in the one phrase every winner reading prints. */
    trLabel(tr: number): string {
      return translateTextWithParams('TR +${0}', [String(tr)]);
    },
    /** A tile part's own name (the winner's glyph vocabulary). */
    tileLabel(tile: NonNullable<ResultsPayoutPart['tile']>): string {
      switch (tile) {
      case 'ocean': return 'Ocean';
      case 'greenery': return 'Greenery';
      case 'colony': return 'Colony';
      case 'city': return 'City';
      }
    },
    planetClass(colony: string): string {
      return colony.replace(' ', '-') + '-background';
    },
    signedAmount(amount: number | undefined): string {
      const n = amount ?? 0;
      return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
    },
    netUnitClass(unit: string): string {
      return iconClassFor(unit);
    },
    /** The icon family of a payout part — the console's own sprites, the production frame where it is production. */
    partUnitClass(part: ResultsPayoutPart): string {
      if (part.unit === '') {
        return '';
      }
      if (part.kind === 'cardResource') {
        // «One of its own kind» (Sponsored Projects onto cards of several kinds): the face's «?» cube.
        return part.unit === OWN_KIND_UNIT ? iconClassFor('wild') : iconClassFor(cardResourceKey(part.unit));
      }
      return iconClassFor(part.unit) + (part.production ? ' con-iyield__unit--prod' : '');
    },
    /** The icons of a part of SEVERAL kinds — one per kind, in the declared order. */
    partUnitClasses(part: ResultsPayoutPart): Array<string> {
      return (part.units ?? []).map((unit) => iconClassFor(cardResourceKey(unit)));
    },
    /** «на 4 карты» — the count of cards a payout that asked nobody landed on. */
    eachCardText(count: number): string {
      return translateTextWithParams('on ${0} card(s)', [String(count)]);
    },
    /** The kinds a payout that asked nobody paid, each once, in the cards' order. */
    eachKinds(part: ResultsPayoutPart): Array<string> {
      return [...new Set((part.cards ?? []).flatMap((entry) => entry.resource === undefined ? [] : [entry.resource]))];
    },
    /** One recipient's own kind (a card-resource share). */
    cardResourceClass(resource: string): string {
      return iconClassFor(cardResourceKey(resource));
    },
  },
});
</script>
