<template>
  <div class="con-lawst" :class="{'con-lawst--hero': hero, 'con-lawst--both': both}" data-parl-vote-standing>
    <span v-if="standing.kicker !== undefined" class="con-lawst__kicker" data-parl-standing-kicker>{{ $t(standing.kicker) }}</span>
    <!-- THE PASSIVE — first: a law that both stands and acts reads under the passive's kicker -->
    <div v-if="passive !== undefined" class="con-lawst__row" data-parl-standing="passive" :data-standing-kind="passive.kind">
      <span v-if="both" class="con-lawst__label">{{ $t('Effect') }}</span>
      <span v-if="passive.kind === 'cardDiscount'" class="con-lawst__line">
        <b class="con-lawst__num" data-standing-discount>−{{ passive.amount }}</b>
        <i class="con-lawst__unit" :class="iconClass('megacredits')" aria-hidden="true"></i>
        <span class="con-lawst__slash" aria-hidden="true">/</span>
        <PremiumCountGlyph v-for="tag in passive.tags" :key="tag" class="con-lawst__tag" :glyph="{kind: 'tag', tag}" />
        <span v-if="passive.inHand !== undefined" class="con-lawst__words" data-standing-in-hand>{{ inHandText(passive.inHand) }}</span>
      </span>
      <span v-else-if="passive.kind === 'resourceValue'" class="con-lawst__line">
        <span v-for="row in passive.rows" :key="row.resource" class="con-lawst__gain" :data-standing-value="row.resource">
          <i class="con-lawst__unit" :class="iconClass(row.resource)" aria-hidden="true"></i>
          <span class="con-lawst__from">{{ row.now }}</span><span class="con-lawst__arrow" aria-hidden="true">→</span><b class="con-lawst__num">{{ row.after }}</b>
        </span>
        <span v-if="passive.stockGain !== undefined" class="con-lawst__words" data-standing-stock>{{ stockText(passive.stockGain) }}</span>
      </span>
      <template v-else-if="passive.kind === 'tagsPerInfluence'">
        <span class="con-lawst__line">
          <b class="con-lawst__num" data-standing-tags>+{{ passive.now }}</b>
          <PremiumCountGlyph class="con-lawst__tag" :glyph="{kind: 'tag', tag: passive.tag}" />
          <span class="con-lawst__words">{{ $t(whenActing) }}</span>
        </span>
        <span v-if="passive.ifWin !== undefined" class="con-lawst__suffix" data-standing-suffix>
          <b class="con-lawst__suffix-num">+{{ passive.ifWin - passive.now }}</b>
          <span class="con-lawst__suffix-words">{{ $t(winWords) }}</span>
        </span>
      </template>
      <span v-else class="con-lawst__rule con-lawst__rule--passive" data-standing-rule>{{ $t(passive.text) }}</span>
    </div>
    <!-- THE ACTION -->
    <div v-if="action !== undefined" class="con-lawst__row" data-parl-standing="action">
      <span v-if="both" class="con-lawst__label">{{ $t('Action') }}</span>
      <span class="con-lawst__line">
        <template v-if="action.bill !== undefined">
          <s v-if="action.bill.price !== action.bill.printed" class="con-lawst__struck" data-standing-printed>{{ action.bill.printed }}</s>
          <b class="con-lawst__num" data-standing-price>{{ action.bill.price }}</b>
          <i class="con-lawst__unit" :class="iconClass('megacredits')" aria-hidden="true"></i>
          <span class="con-lawst__arrow" aria-hidden="true">→</span>
          <span v-for="(gain, i) in action.gains" :key="'g' + i" class="con-lawst__gain">
            <b class="con-lawst__num">+{{ gain.amount }}</b><i class="con-lawst__unit" :class="iconClass(gain.icon)" aria-hidden="true"></i>
          </span>
          <span v-if="action.buys !== undefined" class="con-lawst__words">{{ $t(action.buys) }}</span>
        </template>
        <span class="con-lawst__uses" :class="{'con-lawst__uses--lead': action.bill === undefined}" data-standing-uses :data-standing-uses-now="action.uses.now">{{ usesText }}</span>
      </span>
      <span v-if="action.rule !== undefined" class="con-lawst__rule">{{ $t(action.rule) }}</span>
      <span v-if="actionSuffix !== undefined" class="con-lawst__suffix" data-standing-suffix>
        <b class="con-lawst__suffix-num">{{ actionSuffix.num }}</b>
        <i v-if="actionSuffix.icon !== undefined" class="con-lawst__suffix-unit" :class="iconClass(actionSuffix.icon)" aria-hidden="true"></i>
        <span class="con-lawst__suffix-words">{{ $t(winWords) }}</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * WHILE ENACTED (P77 · DH, `lawStandingModel.ts`) — what a law gives the reading's seat for as long as it stands, in
 * the vote panel's number grammar: an action's PRICE at the seat's influence and what it buys, how many times a
 * generation; a passive's number by its term (the discount and the viewer's cards it would cheapen, a unit's new
 * value and the stock it lifts, the tags it lends at the seat's influence) — or the law's rule where no number exists.
 * The win's change is ONE quiet suffix line under its number, never a second plate. Under an enactment payout the
 * part names itself («ПОКА ПРИНЯТА»); a law that pays nothing at the enactment speaks through this alone, at the
 * plate's voice size (`hero`). Nothing here computes: the model decided, this draws.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {ReadingPerson} from '@/client/console/parliament/influenceYieldModel';
import {suffixWinKey} from '@/client/console/parliament/voteInfoModel';
import {
  ActionStanding, DISCOUNT_IN_HAND, LawStanding, ONCE_A_GENERATION, PassiveStanding, STOCK_GAIN, TAGS_WHEN_ACTING, USES_A_GENERATION,
} from '@/client/console/parliament/lawStandingModel';

defineOptions({name: 'ConsoleLawStanding'});
const props = defineProps({
  standing: {type: Object as PropType<LawStanding>, required: true},
  /** Whose reading this is — the win's words follow it («если победите» / «если победит»). */
  person: {type: String as PropType<ReadingPerson>, default: 'you'},
});

const action = computed((): ActionStanding | undefined => {
  return props.standing.action;
});
const passive = computed((): PassiveStanding | undefined => {
  return props.standing.passive;
});
/** The law that pays nothing at the enactment: this part IS the plate's voice. */
const hero = computed((): boolean => {
  return props.standing.kicker === undefined;
});
/** An action AND a passive — each row names itself. */
const both = computed((): boolean => {
  return action.value !== undefined && passive.value !== undefined;
});
const usesText = computed((): string => {
  const standingAction = action.value;
  if (standingAction === undefined) {
    return '';
  }
  return standingAction.uses.declared || standingAction.bill !== undefined ?
    translateTextWithParams(USES_A_GENERATION, [String(standingAction.uses.now)]) :
    translateText(ONCE_A_GENERATION);
});
/** The win's change to the action: the price it takes off, else the count it adds. */
const actionSuffix = computed((): {num: string, icon?: string} | undefined => {
  const standingAction = action.value;
  if (standingAction === undefined) {
    return undefined;
  }
  if (standingAction.bill?.priceIfWin !== undefined) {
    return {num: `−${standingAction.bill.price - standingAction.bill.priceIfWin}`, icon: 'megacredits'};
  }
  if (standingAction.uses.ifWin !== undefined) {
    return {num: `×${standingAction.uses.ifWin}`};
  }
  return undefined;
});
const winWords = computed((): string => {
  return suffixWinKey(props.person);
});
const whenActing = TAGS_WHEN_ACTING;

const iconClass = iconClassFor;
function inHandText(n: number): string {
  return translateTextWithParams(DISCOUNT_IN_HAND, [String(n)]);
}
function stockText(n: number): string {
  return translateTextWithParams(STOCK_GAIN, [String(n)]);
}
</script>
