<template>
  <!-- «ПОДРОБНОСТИ ВЫПЛАТ» (the owner, 2026-10-24; P71 · ledger CY) — the step one level below the results card's ledger:
       WHY every seat got exactly what it got. A BREAKDOWN PER SEAT (`payoutDetailsModel.ts`): over the columns, ONE strip
       of the LAW (its formula once, its rule of WHO, the seats a winner-only part was never owed to — once); then a column
       per seat read top-down as a derivation, its blocks aligned with the other seats' (a subgrid of rows): the head, the
       INFLUENCE the law read with what it was MADE OF (the server's snapshot — the Career, every giver by name) and what it
       MEANT for this law, a line per SOURCE (a colony tile, the levy, a part, the winner's reward, the party's answer)
       with the records' own chips, and ИТОГО — the very renderer of the card's ledger (`ConsoleSitTotals`). The step titles
       nothing: the crumb names it («ЗАСЕДАНИЕ › ИТОГИ · ВЫПЛАТЫ»). Overflow lives in the ONE scroll primitive; nothing here
       is focusable — X stays «back to the card». -->
  <div class="con-sitpd" data-sit-payout-details>
    <header class="con-sitpd__law" data-sitpd-law>
      <!-- THE RULE in the card's own formula — the constant every column below is read against. -->
      <ConsoleInfluenceYield v-for="effect in details.law.effects" :key="effect.id" class="con-sitpd__rule" :yields="[ruleYield(effect)]"
                             size="compact" :captions="false" data-sitpd-rule :data-sitpd-rule-effect="effect.id" />
      <span v-if="details.law.recipients !== undefined" class="con-sitpd__rule-text" data-sitpd-rule>{{ grantRuleText(details.law.recipients) }}</span>
      <span v-else-if="details.law.effects.length === 0 && details.winner !== undefined" class="con-sitpd__rule-text" data-sitpd-rule>{{ winnerVotesText }}</span>
      <!-- A PART FOR THE WINNER ALONE: the other paid seats were never owed it — said ONCE, never a «0» per seat. -->
      <p v-if="details.law.notOwed.length > 0" class="con-sitpd__notowed" data-sitpd-not-owed>
        <span class="con-sitpd__notowed-why">{{ $t('Not owed — for the winner of the vote only') }}:</span>
        <span v-for="color in details.law.notOwed" :key="color" class="con-sitpd__notowed-seat">
          <i class="con-parl__seat-dot" :class="'player_bg_color_' + color" aria-hidden="true"></i>{{ nameOf(color) }}
        </span>
      </p>
    </header>
    <ConsoleScrollArea ref="scroll" class="con-sitpd__scroll" contentClass="con-sitpd__body">
      <div class="con-sitpd__seats" :style="{'--sitpd-seats': details.seats.length}">
        <article v-for="seat in details.seats" :key="seat.player" class="con-sitpd__seat"
                 :class="{'con-sitpd__seat--me': seat.player === viewerColor, 'con-sitpd__seat--winner': seat.winner}" :data-sitpd-seat="seat.player">
          <!-- 1. HEAD — who, the crown and the votes of the winner of the vote. -->
          <header class="con-sitpd__head">
            <span class="con-sitpd__who">
              <i class="con-parl__seat-dot" :class="'player_bg_color_' + seat.player" aria-hidden="true"></i>
              <b class="con-sitpd__name">{{ nameOf(seat.player) }}</b>
            </span>
            <span v-if="seat.winner" class="con-sitpd__winner" data-sitpd-winner>
              <svg class="con-sitpd__crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>{{ winnerVotesText }}
            </span>
          </header>
          <!-- 2. INFLUENCE — only where the law read it: the number, what it was MADE OF (the snapshot), what it MEANT. -->
          <section class="con-sitpd__block con-sitpd__influence">
            <template v-if="seat.influence !== undefined">
              <span class="con-sitpd__kicker">{{ $t('Influence') }}</span>
              <span class="con-sitpd__influence-total" data-sitpd-influence :data-sitpd-influence-total="seat.influence.total">
                <i class="con-sitpd__influence-glyph" aria-hidden="true"></i><b>{{ seat.influence.total }}</b>
              </span>
              <span v-if="seat.influence.composition !== undefined" class="con-sitpd__composition">
                <span class="con-sitpd__term" data-sitpd-influence-source="career" :data-sitpd-influence-amount="seat.influence.composition.track">
                  {{ $t('Agenda track') }} <b>{{ seat.influence.composition.track }}</b>
                  <span class="con-sitpd__term-step">· {{ stepText(seat.influence.composition.agendaStep) }}</span>
                </span>
                <span v-for="(source, i) in seat.influence.composition.sources" :key="i" class="con-sitpd__term con-sitpd__term--giver"
                      data-sitpd-influence-source="giver" :data-sitpd-influence-giver="source.source" :data-sitpd-influence-amount="source.amount">
                  {{ source.source === undefined ? $t('Other influence') : $t(source.source) }} <b>{{ signed(source.amount) }}</b>
                </span>
              </span>
              <!-- WHAT IT MEANT for this law — the seat's RECORDED reading of every influence-scaled part (no recount). -->
              <ConsoleInfluenceYield v-for="meaning in seat.influence.meanings" :key="meaning.effect.id" class="con-sitpd__meaning"
                                     :yields="[meaning]" :formula="false" :captions="false" :person="seat.player === viewerColor ? 'you' : 'they'"
                                     size="compact" data-sitpd-meaning :data-sitpd-meaning-effect="meaning.effect.id" />
              <span v-if="seat.influence.grant !== undefined" class="con-sitpd__grant" :class="'con-sitpd__grant--' + seat.influence.grant.eligibility"
                    data-sitpd-meaning :data-sitpd-grant="seat.influence.grant.eligibility">{{ grantRowText(seat.influence.grant) }}</span>
            </template>
          </section>
          <!-- 3. FROM WHAT — a line per source, the records' own chips (the one record renderer). -->
          <section class="con-sitpd__block con-sitpd__lines">
            <span class="con-sitpd__kicker">{{ $t('Where it came from') }}</span>
            <div v-for="line in seat.lines" :key="line.id" class="con-sitpd__line" data-sitpd-line :data-sitpd-line-kind="line.kind" :data-sitpd-line-id="line.id">
              <span class="con-sitpd__line-label">
                <template v-if="line.kind === 'colony'">
                  <span class="con-sit__part-planet" :class="planetClass(line.colony ?? '')" aria-hidden="true"></span>
                  <b>{{ $t(line.colony ?? '') }}</b>
                  <span v-if="line.times !== undefined" class="con-sitpd__times" data-sitpd-line-times>×{{ line.times }}</span>
                  <span v-if="line.cubes !== undefined" class="con-sitpd__cubes">{{ cubesText(line.cubes) }}</span>
                </template>
                <template v-else-if="line.kind === 'reaction'">
                  <img v-if="line.party !== undefined" class="con-sitpd__emblem" :src="emblemUrl(line.party)" alt="" />{{ $t('The ruling party answers') }}
                </template>
                <template v-else-if="line.kind === 'winner'">
                  <svg class="con-sitpd__crown" viewBox="0 0 24 16" aria-hidden="true"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>{{ $t('Reward for the winner of the vote') }}
                </template>
                <template v-else-if="line.kind === 'levy'">{{ $t('What the law takes') }}</template>
                <template v-else-if="line.kind === 'other'">{{ $t(line.title ?? 'Resolution effect') }}</template>
                <template v-else>{{ $t('Resolution effect') }}</template>
              </span>
              <ConsoleInfluenceYield v-if="line.reading !== undefined || line.levy !== undefined" class="con-sitpd__reading"
                                     :yields="line.reading === undefined ? [] : [line.reading]" :formula="false" :captions="false" :levy="line.levy"
                                     :person="seat.player === viewerColor ? 'you' : 'they'" size="compact" data-sitpd-reading />
              <span v-if="line.grant !== undefined" class="con-sitpd__grant" :class="'con-sitpd__grant--' + line.grant.eligibility"
                    :data-sitpd-grant="line.grant.eligibility">{{ grantRowText(line.grant) }}</span>
              <!-- A tile's records merge into its totals (Pluto's pairs: «+3 [card] · ⌫3»); every other line its records. -->
              <ConsoleSitTotals v-if="line.kind === 'colony'" class="con-sitpd__got" :totals="line.totals" />
              <span v-else-if="line.levy === undefined" class="con-sitpd__got">
                <ConsoleSitPayoutPart v-for="part in line.parts" :key="part.id" :part="part" />
              </span>
            </div>
          </section>
          <!-- 4. ИТОГО — the card's own totals, by the card's own renderer. -->
          <footer class="con-sitpd__block con-sitpd__total" data-sitpd-total>
            <span class="con-sitpd__kicker">{{ $t('Seat total') }}</span>
            <ConsoleSitTotals :totals="seat.totals" />
          </footer>
        </article>
      </div>
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
import ConsoleSitTotals from '@/client/components/console/parliament/ConsoleSitTotals.vue';
import {parliamentPlayerName} from '@/client/console/parliament/consoleParliamentModel';
import {PayoutDetails, PayoutDetailsGrant} from '@/client/console/parliament/payoutDetailsModel';
import {translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleSittingPayoutDetails',
  components: {ConsoleScrollArea, ConsoleInfluenceYield, ConsoleSitPayoutPart, ConsoleSitTotals},
  props: {
    details: {type: Object as PropType<PayoutDetails>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  computed: {
    /** «Победитель голосования · голосов: 3». */
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
    planetClass(colony: string): string {
      return colony.replace(' ', '-') + '-background';
    },
    signed(n: number): string {
      return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
    },
    /** «шаг 3» — the Career step the influence was read at. */
    stepText(step: number): string {
      return translateTextWithParams('step ${0}', [String(step)]);
    },
    cubesText(cubes: number): string {
      return translateTextWithParams('cubes: ${0}', [String(cubes)]);
    },
    /** The rule as the card prints it — the reference reading of the effect (no seat, no number). */
    ruleYield(effect: InfluenceScaledEffect): InfluenceYield {
      return referenceYield(effect);
    },
    /** The rule of WHO a grant follows — the line the columns are read against. */
    grantRuleText(recipients: GrantRecipients): string {
      return recipients.kind === 'threshold' ?
        translateTextWithParams('The winner and every seat with influence ${0}+', [String(recipients.influenceAtLeast)]) :
        translateTextWithParams('For every player', []);
    },
    /** Which clause took the seat in — or passed it over — with the influence it was read at. */
    grantRowText(grant: PayoutDetailsGrant): string {
      switch (grant.eligibility) {
      case 'winner': return translateTextWithParams('Winner of the vote', []);
      case 'everyone': return translateTextWithParams('For every player', []);
      case 'influence': return translateTextWithParams('Influence ${0} — at or over the line ${1}', [String(grant.influence ?? 0), String(grant.line ?? 0)]);
      case 'none': return translateTextWithParams('Influence ${0} — under the line ${1}', [String(grant.influence ?? 0), String(grant.line ?? 0)]);
      }
    },
    /** The right stick / ↑↓ scroll a long breakdown — the host drives it (`ConsoleScrollArea.scrollByPx`). */
    scrollBy(dy: number): void {
      (this.$refs.scroll as {scrollByPx?: (dy: number) => void} | undefined)?.scrollByPx?.(dy);
    },
  },
});
</script>
