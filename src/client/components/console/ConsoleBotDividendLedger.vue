<template>
  <div class="con-divledger" :class="['con-divledger--' + tier, {'con-divledger--concise': concise}]" data-dividend-ledger>
    <!--
      THE WHOLE «ДИВИДЕНДЫ» BOX of a further corporation, read LIVE (the owner, 2026-10-27).
      ONE composition of plates on one chassis, each a kicker over its body: the MECHANIC
      (the dividend's name · its printed rule · the formula's live terms, each with the VP it
      pays now) · the GOAL as ONE quiet scale of three tiers (the owner, 2026-10-28: «одна шкала
      с тремя делениями, последнее в конце» — the goal must not outshout the mechanic): the
      operand's count, the scale, each tier's threshold and prize under its notch, one line
      naming what the next tier still needs · the TOTAL the dividend pays with its goal. Every
      number is the server's (`botDividendReading`). A reached tier is drawn by MATERIAL — a
      solid notch, the gold of its part of the scale, its prize in gold — never a glow.
    -->
    <section class="con-divledger__plate con-divledger__plate--formula" data-dividend-formula>
      <div class="con-divledger__head">
        <span class="con-divledger__name" data-dividend-name>{{ $t(reading.name) }}</span>
        <span v-if="!concise" class="con-divledger__when">{{ $t('Dividend pays at the end of the game') }}</span>
      </div>
      <div v-if="!concise" class="con-divledger__rule">
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

    <section class="con-divledger__plate con-divledger__goal" data-dividend-goal-scale :data-goal-tiers-reached="reachedTiers">
      <div class="con-divledger__head">
        <span class="con-divledger__kicker" data-dividend-goal-name>{{ goalName }}</span>
        <span class="con-divledger__measure">
          <span class="con-divledger__measure-label">{{ $t(reading.goal.operand.label) }}</span>
          <span class="con-divledger__measure-count" data-dividend-count>{{ reading.goal.operand.count }}</span>
        </span>
      </div>
      <!-- The scale: three equal segments, one per tier — the last notch stands at the end. Gold is what is
           PAID (up to the last reached notch), the quiet cyan the progress toward the next one. -->
      <div class="con-divledger__scale" aria-hidden="true">
        <span class="con-divledger__track">
          <span class="con-divledger__fill con-divledger__fill--progress" :style="{transform: `scaleX(${reading.goal.progress})`}"></span>
          <span class="con-divledger__fill con-divledger__fill--paid" :style="{transform: `scaleX(${reachedTiers / 3})`}"></span>
        </span>
        <span v-for="tier in reading.goal.tiers" :key="tier.ordinal"
              class="con-divledger__notch"
              :class="{'con-divledger__notch--reached': tier.reached}"
              :style="{left: `${(tier.ordinal / 3) * 100}%`}"></span>
      </div>
      <div class="con-divledger__tiers">
        <div v-for="tier in reading.goal.tiers" :key="tier.ordinal"
             class="con-divledger__tier"
             :class="{'con-divledger__tier--reached': tier.reached}"
             :data-dividend-goal="tier.ordinal"
             :data-goal-reached="tier.reached ? 'true' : 'false'">
          <span class="con-divledger__at" data-goal-at>{{ say('Dividend goal at ${0}', tier.at) }}</span>
          <span class="con-divledger__prize" data-goal-vp>{{ say('Dividend goal prize: +${0} VP', tier.vp) }}</span>
        </div>
      </div>
      <span v-if="!concise" class="con-divledger__state" data-goal-state>{{ stateText }}</span>
    </section>

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
    /**
     * The CONCISE reading (the game overview's context column, the owner 2026-10-30: «лаконично и премиально, не
     * перегружено»): the printed rule's prose, «pays at the end» and the goal's «still needed» line stay with the
     * inspection; the live terms, the goal's scale and the total — formula + goals — stand.
     */
    concise: {type: Boolean, default: false},
  },
  computed: {
    /** The goal's own name — «Цель «Титановые рудники»». */
    goalName(): string {
      return translateTextWithParams('Dividend goal «${0}»', [translateText(this.reading.goal.name)]);
    },
    /** How many of the three tiers are paid. */
    reachedTiers(): number {
      return this.reading.goal.tiers.filter((tier) => tier.reached).length;
    },
    /** ONE line for the whole goal: what the next tier still needs and what it adds — or that all three are paid. */
    stateText(): string {
      const next = this.reading.goal.next;
      return next === undefined ?
        translateText('Dividend goals: all reached') :
        translateTextWithParams('Dividend goal: ${0} to go for +${1} VP', [String(next.remaining), String(next.vp)]);
    },
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
