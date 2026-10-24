<template>
  <!-- «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24) — the step one level below the results card's «ВЫПЛАТЫ»: WHY every seat
       got exactly what it got. A TABLE PER RULE of the enacted law (`payoutDetailsModel.ts`): the head prints the rule
       in the card's own formula, a row per seat prints the seat's RECORDED reading (the same `ConsoleInfluenceYield` the
       vote panel read before the vote — influence, what was counted, the sum before the cap, the levy at its head and the
       day's net at its tail) and what actually reached it (the results card's own chips, `ConsoleSitPayoutPart`). A part
       for the winner of the vote alone wears the crown and names the other seats ONCE — never a «0» per seat. The step
       titles nothing: the crumb names it («ЗАСЕДАНИЕ › ИТОГИ · ВЫПЛАТЫ»). Overflow lives in the ONE scroll primitive. -->
  <div class="con-sitpd" data-sit-payout-details>
    <ConsoleScrollArea ref="scroll" class="con-sitpd__scroll" contentClass="con-sitpd__body">
      <section v-for="section in details.sections" :key="section.id" class="con-sitpd__section"
               :class="{'con-sitpd__section--winner': section.winnerOnly}"
               :data-sitpd-section="section.id" :data-sitpd-kind="section.kind" :data-sitpd-winner-only="section.winnerOnly ? '' : undefined">
        <header class="con-sitpd__head">
          <span class="con-sitpd__kicker">
            <svg v-if="section.winnerOnly" class="con-sitpd__crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>
            <img v-if="section.party !== undefined" class="con-sitpd__emblem" :src="emblemUrl(section.party)" alt="" />
            {{ $t(sectionTitle(section)) }}
          </span>
          <!-- THE RULE in the card's own formula — the constant every row below is read against. -->
          <ConsoleInfluenceYield v-if="section.effect !== undefined" class="con-sitpd__rule" :yields="[ruleYield(section.effect)]" size="compact" :captions="false" data-sitpd-rule />
          <span v-else-if="section.recipients !== undefined" class="con-sitpd__rule-text" data-sitpd-rule>{{ grantRuleText(section.recipients) }}</span>
          <span v-else-if="section.kind === 'winner' && details.winner !== undefined" class="con-sitpd__rule-text" data-sitpd-rule>{{ winnerVotesText }}</span>
        </header>
        <div class="con-sitpd__table" role="table">
          <div class="con-sitpd__row con-sitpd__row--head" role="row">
            <span role="columnheader">{{ $t('Player') }}</span>
            <span role="columnheader">{{ $t('Calculation') }}</span>
            <span role="columnheader">{{ $t('Received') }}</span>
          </div>
          <div v-for="row in section.rows" :key="row.player" class="con-sitpd__row" role="row"
               :class="{'con-sitpd__row--me': row.player === viewerColor}" :data-sitpd-seat="row.player">
            <span class="con-sitpd__who" role="cell">
              <i class="con-parl__seat-dot" :class="'player_bg_color_' + row.player" aria-hidden="true"></i>
              <b class="con-sitpd__name">{{ nameOf(row.player) }}</b>
              <svg v-if="row.winner" class="con-sitpd__crown con-sitpd__crown--seat" viewBox="0 0 24 16" aria-hidden="true" data-sitpd-winner><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>
            </span>
            <span class="con-sitpd__why" role="cell">
              <ConsoleInfluenceYield v-if="row.reading !== undefined" :yields="[row.reading]" :formula="false" :captions="false"
                                     :levy="row.levy" :person="row.player === viewerColor ? 'you' : 'they'" size="compact" data-sitpd-reading />
              <span v-else-if="row.grant !== undefined" class="con-sitpd__grant" :class="'con-sitpd__grant--' + row.grant.eligibility"
                    :data-sitpd-grant="row.grant.eligibility">{{ grantRowText(row.grant) }}</span>
              <span v-else-if="section.kind === 'winner'" class="con-sitpd__grant con-sitpd__grant--winner">{{ $t('Winner of the vote') }}</span>
              <span v-else-if="section.kind === 'reaction'" class="con-sitpd__grant">{{ $t('The ruling party answers') }}</span>
              <span v-else class="con-parl__chip-dim">—</span>
            </span>
            <span class="con-sitpd__got" role="cell">
              <ConsoleSitPayoutPart v-for="part in row.parts" :key="part.id" :part="part" :leadsColony="leadsColony(row.parts, part)" />
            </span>
          </div>
        </div>
        <!-- A PART FOR THE WINNER ALONE: the other paid seats were never owed it — said ONCE, never a «0» per seat. -->
        <p v-if="section.notOwed.length > 0" class="con-sitpd__notowed" data-sitpd-not-owed>
          <span v-for="color in section.notOwed" :key="color" class="con-sitpd__notowed-seat">
            <i class="con-parl__seat-dot" :class="'player_bg_color_' + color" aria-hidden="true"></i>{{ nameOf(color) }}
          </span>
          <span class="con-sitpd__notowed-why">{{ $t('Not owed — for the winner of the vote only') }}</span>
        </p>
      </section>
    </ConsoleScrollArea>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, InfluenceYield, referenceYield} from '@/common/parliament/influenceScaling';
import {GrantRecipients} from '@/common/parliament/seatGrant';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsoleSitPayoutPart from '@/client/components/console/parliament/ConsoleSitPayoutPart.vue';
import {parliamentPlayerName} from '@/client/console/parliament/consoleParliamentModel';
import {PayoutDetails, PayoutDetailsRow, PayoutDetailsSection} from '@/client/console/parliament/payoutDetailsModel';
import {ResultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import {translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleSittingPayoutDetails',
  components: {ConsoleScrollArea, ConsoleInfluenceYield, ConsoleSitPayoutPart},
  props: {
    details: {type: Object as PropType<PayoutDetails>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  computed: {
    /** «Победитель голосования · голосов: 3» — the winner sections' head. */
    winnerVotesText(): string {
      return translateTextWithParams('Winner of the vote · ${0} votes', [String(this.details.winner?.votes ?? 0)]);
    },
  },
  methods: {
    nameOf(color: Color): string {
      return parliamentPlayerName(this.players, color);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    /** The rule as the card prints it — the reference reading of the effect (no seat, no number). */
    ruleYield(effect: InfluenceScaledEffect): InfluenceYield {
      return referenceYield(effect);
    },
    sectionTitle(section: PayoutDetailsSection): string {
      switch (section.kind) {
      case 'rule': return section.winnerOnly ? 'Reward for the winner of the vote' : 'Resolution effect';
      case 'levy': return 'What the law takes';
      case 'winner': return 'Reward for the winner of the vote';
      case 'grant': return 'Resolution effect';
      case 'reaction': return 'The ruling party answers';
      case 'other': return section.title ?? 'Resolution effect';
      }
    },
    /** The rule of WHO a grant follows — the line the table's rows are read against. */
    grantRuleText(recipients: GrantRecipients): string {
      return recipients.kind === 'threshold' ?
        translateTextWithParams('The winner and every seat with influence ${0}+', [String(recipients.influenceAtLeast)]) :
        translateTextWithParams('For every player', []);
    },
    /** Which clause took the seat in — or passed it over — with the influence it was read at. */
    grantRowText(grant: NonNullable<PayoutDetailsRow['grant']>): string {
      switch (grant.eligibility) {
      case 'winner': return translateTextWithParams('Winner of the vote', []);
      case 'everyone': return translateTextWithParams('For every player', []);
      case 'influence': return translateTextWithParams('Influence ${0} — at or over the line ${1}', [String(grant.influence ?? 0), String(grant.line ?? 0)]);
      case 'none': return translateTextWithParams('Influence ${0} — under the line ${1}', [String(grant.influence ?? 0), String(grant.line ?? 0)]);
      }
    },
    leadsColony(parts: ReadonlyArray<ResultsPayoutPart>, part: ResultsPayoutPart): boolean {
      if (part.colony === undefined) {
        return false;
      }
      const index = parts.indexOf(part);
      return index <= 0 || parts[index - 1].colony !== part.colony;
    },
    /** The right stick / ↑↓ scroll a long table — the host drives it (`ConsoleScrollArea.scrollByPx`). */
    scrollBy(dy: number): void {
      (this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined)?.scrollByPx?.(dy);
    },
  },
});
</script>
