<template>
  <div class="con-divledger" :class="'con-divledger--' + tier" data-dividend-ledger>
    <!--
      THE WHOLE «ДИВИДЕНДЫ» BOX of a further corporation, read LIVE (the owner, 2026-10-27).
      ONE composition of plates on one chassis, each a kicker over its body: the MECHANIC
      (the dividend's name · its printed rule · the formula's live terms, each with the VP it
      pays now) · the TWO GOALS side by side (threshold, prize, a meter, «Взята» / «Ещё N») ·
      the TOTAL the dividend pays with its goals. Every number is the server's
      (`botDividendReading`); every value stands on the plates' one right edge. A reached goal
      is drawn by MATERIAL — a gold kant, a filled meter, the seal and the word — never a glow.
    -->
    <section class="con-divledger__plate con-divledger__plate--formula" data-dividend-formula>
      <div class="con-divledger__head">
        <span class="con-divledger__name" data-dividend-name>{{ $t(reading.name) }}</span>
        <span class="con-divledger__when">{{ $t('Dividend pays at the end of the game') }}</span>
      </div>
      <div class="con-divledger__rule">
        <p v-for="(line, i) in reading.rule" :key="i"
           class="con-divledger__rule-line"
           :class="{'con-divledger__rule-line--muted': line.muted}">{{ ruleText(line) }}</p>
      </div>
      <div class="con-divledger__terms">
        <div v-for="(term, i) in reading.terms" :key="i"
             class="con-divledger__term"
             :class="{'con-divledger__term--zero': term.vp === 0}"
             data-dividend-term
             :data-term-vp="term.vp">
          <span class="con-divledger__term-label">{{ $t(term.label) }}</span>
          <span class="con-divledger__term-calc">{{ say(term.formula.label, ...term.formula.params) }}</span>
          <span class="con-divledger__term-vp">{{ term.vp }}</span>
        </div>
      </div>
    </section>

    <div class="con-divledger__caption">
      <span class="con-divledger__kicker">{{ $t('Dividend goals') }}</span>
      <span class="con-divledger__measure">
        <span class="con-divledger__measure-label">{{ $t(reading.operand.label) }}</span>
        <span class="con-divledger__measure-count" data-dividend-count>{{ reading.operand.count }}</span>
      </span>
    </div>
    <div class="con-divledger__goals">
      <div v-for="goal in reading.goals" :key="goal.ordinal"
           class="con-divledger__plate con-divledger__goal"
           :class="{'con-divledger__goal--reached': goal.reached}"
           :data-dividend-goal="goal.ordinal"
           :data-goal-reached="goal.reached ? 'true' : 'false'">
        <div class="con-divledger__head">
          <span class="con-divledger__goal-name">{{ say('Dividend goal ${0}', goal.ordinal) }}</span>
          <span class="con-divledger__seal" aria-hidden="true">{{ goal.reached ? '✓' : '' }}</span>
        </div>
        <div class="con-divledger__goal-terms">
          <span class="con-divledger__at" data-goal-at>{{ say('Dividend goal at ${0}', goal.at) }}</span>
          <span class="con-divledger__prize" data-goal-vp>{{ say('Dividend goal prize: +${0} VP', goal.vp) }}</span>
        </div>
        <div class="con-divledger__meter" aria-hidden="true">
          <span class="con-divledger__fill" :style="{transform: `scaleX(${goal.fill})`}"></span>
        </div>
        <span class="con-divledger__state" data-goal-state>{{ goal.reached ? $t('Dividend goal reached') : say('Dividend goal: ${0} to go', goal.remaining) }}</span>
      </div>
    </div>

    <div class="con-divledger__plate con-divledger__total" data-dividend-total>
      <span class="con-divledger__total-words">
        <span class="con-divledger__total-label">{{ $t(final ? 'Dividend total' : 'Dividend total now') }}</span>
        <span class="con-divledger__total-parts">{{ say('Dividend formula ${0} + goals ${1}', reading.formulaVp, reading.goalsVp) }}</span>
      </span>
      <span class="con-divledger__total-value">
        <ConsoleVpBadge class="con-divledger__badge" :label="$t('VP')" />
        <span class="con-divledger__total-number" data-dividend-vp>{{ reading.totalVp }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {BotDividendReading, BotDividendRuleLine} from '@/client/components/marsbot/botDividendReading';
import {RulesLengthTier} from '@/client/components/console/consoleCardRules';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';

export default defineComponent({
  name: 'ConsoleBotDividendLedger',
  components: {ConsoleVpBadge},
  props: {
    reading: {type: Object as PropType<BotDividendReading>, required: true},
    /** The rules panel's reading tier — the ledger tightens with it. */
    tier: {type: String as PropType<RulesLengthTier>, default: 'regular'},
    /** The game is over — the total is the final one, not «now». */
    final: {type: Boolean, default: false},
  },
  methods: {
    /** A parameterised key read with its numbers. */
    say(key: string, ...params: ReadonlyArray<number>): string {
      return translateTextWithParams(key, params.map(String));
    },
    /** A printed rule line — its template with the box's own printed numbers. */
    ruleText(line: BotDividendRuleLine): string {
      return line.params.length > 0 ? translateTextWithParams(line.text, [...line.params]) : translateText(line.text);
    },
  },
});
</script>
