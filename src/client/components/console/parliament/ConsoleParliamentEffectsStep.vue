<template>
  <div class="con-parl-fx"
       :class="{'con-parl-fx--no-actions': model.actions.length === 0, 'con-parl-fx--sparse': model.actions.length + model.standing.length <= 2}"
       data-parl-effects-step :data-parl-effects-cursor="cursor">
    <!-- ══ THE INNER STEP «ВАШИ ЭФФЕКТЫ» (Парламент v8 § 6, the mock `c1`): the FULL list of what the parliament gives the
         viewer, opened from the overview's block — ДЕЙСТВИЯ on the left, ПОСТОЯННЫЕ ЭФФЕКТЫ on the right. It stands on
         the CHAMBER's rect (the chamber and the table recede under it; the career stays), it titles nothing (the crumb
         names it — «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ»), and it carries no verb (the bar's A uses the action under the cursor —
         the same door the bench's A opens). ══ -->
    <section class="con-parl-fx__col con-parl-fx__col--actions" data-parl-effects-actions>
      <header class="con-parl-fx__head">
        <span class="con-parl-fx__kicker con-parl-fx__kicker--action">
          <svg class="con-parl-fx__glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.6 1 3.4 9.1h3.9L6.2 15l6.4-8.4H8.6z" /></svg>{{ $t('Actions') }}
        </span>
        <span v-if="model.actions.length > 0" class="con-parl-fx__sum">{{ actionSummary }}</span>
      </header>
      <div class="con-parl-fx__list">
        <article v-for="entry in model.actions" :key="entry.key"
                 class="con-parl-fx__tile con-parl-fx__tile--action"
                 :class="['con-parl-fx__tile--' + entry.state, {'con-parl-fx__tile--focus': cursor === entry.key}]"
                 :style="{'--parl-accent': accentOf(entry.party)}"
                 :data-parl-fx-entry="entry.key" :data-parl-fx-state="entry.state" :data-party="entry.party">
          <div class="con-parl-fx__tilehead">
            <img class="con-parl-fx__seal" :src="emblemOf(entry.party)" alt="" />
            <span class="con-parl-fx__title">
              <span class="con-parl-fx__name">{{ nameOf(entry) }}</span>
              <span class="con-parl-fx__why">{{ readingOf(entry.whyReading) }}</span>
            </span>
          </div>
          <div class="con-parl-fx__graphic">
            <ConsolePartyFormula v-if="entry.renderData !== undefined" :party="entry.party" :renderRoot="entry.renderData" size="wide" />
            <PremiumMechanicsPanel v-else-if="entry.mechanics !== undefined" class="con-parl-fx__law" :mechanics="entry.mechanics" />
          </div>
          <p v-if="entry.rule !== ''" class="con-parl-fx__rule">{{ $t(entry.rule) }}</p>
          <footer class="con-parl-fx__foot">
            <span class="con-parl-fx__cadence" :data-parl-fx-uses="entry.usesPerGeneration">{{ cadenceOf(entry.usesPerGeneration, entry.usesLeft) }}</span>
            <span class="con-parl-fx__state" :class="'con-parl-fx__state--' + entry.state" :data-parl-effects-action="entry.state">
              {{ $t(entry.state === 'used' ? 'action used' : entry.state === 'ready' ? 'action available' : 'action not now') }}
            </span>
          </footer>
        </article>
        <p v-if="model.actions.length === 0" class="con-parl-fx__empty" data-parl-fx-empty="actions">{{ $t('No parliament action is yours') }}</p>
      </div>
    </section>
    <section class="con-parl-fx__col con-parl-fx__col--standing" data-parl-effects-standing>
      <header class="con-parl-fx__head">
        <span class="con-parl-fx__kicker con-parl-fx__kicker--effect">
          <svg class="con-parl-fx__glyph con-parl-fx__glyph--inf" viewBox="0 0 24 12" aria-hidden="true"><path d="M6 1.5a4.5 4.5 0 1 0 0 9c3.6 0 8.4-9 12-9a4.5 4.5 0 1 1 0 9C14.4 10.5 9.6 1.5 6 1.5z" /></svg>{{ $t('Standing effects') }}
        </span>
        <span class="con-parl-fx__sum">{{ model.standing.length }}</span>
      </header>
      <div class="con-parl-fx__grid" :class="{'con-parl-fx__grid--one': model.standing.length <= 1}">
        <article v-for="entry in model.standing" :key="entry.key"
                 class="con-parl-fx__tile con-parl-fx__tile--effect"
                 :class="{'con-parl-fx__tile--focus': cursor === entry.key}"
                 :style="{'--parl-accent': accentOf(entry.party)}"
                 :data-parl-fx-entry="entry.key" :data-party="entry.party">
          <div class="con-parl-fx__tilehead">
            <img class="con-parl-fx__seal" :src="emblemOf(entry.party)" alt="" />
            <span class="con-parl-fx__title">
              <span class="con-parl-fx__name">{{ nameOf(entry) }}</span>
              <span class="con-parl-fx__why">{{ readingOf(entry.whyReading) }}</span>
            </span>
          </div>
          <div class="con-parl-fx__graphic">
            <ConsolePartyFormula v-if="entry.renderData !== undefined" :party="entry.party" :renderRoot="entry.renderData" size="wide" />
            <PremiumMechanicsPanel v-else-if="entry.mechanics !== undefined" class="con-parl-fx__law" :mechanics="entry.mechanics" />
          </div>
          <p v-if="entry.rule !== ''" class="con-parl-fx__rule">{{ $t(entry.rule) }}</p>
          <footer class="con-parl-fx__foot"><span class="con-parl-fx__cadence con-parl-fx__cadence--effect">{{ $t('standing') }}</span></footer>
        </article>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {EffectsStepEntry, EffectsStepModel, EffectWhyReading} from '@/client/console/parliament/parliamentEffectsStepModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleParliamentEffectsStep',
  components: {ConsolePartyFormula, PremiumMechanicsPanel},
  props: {
    model: {type: Object as PropType<EffectsStepModel>, required: true},
    /** The entry under the cursor (its key). */
    cursor: {type: String, default: ''},
  },
  computed: {
    actionSummary(): string {
      const ready = this.model.actions.filter((a) => a.state === 'ready').length;
      const used = this.model.actions.filter((a) => a.state === 'used').length;
      return translateTextWithParams('${0} available · ${1} used', [String(ready), String(used)]);
    },
  },
  methods: {
    accentOf(party: ReduxParty): string {
      return partyAccent(party);
    },
    emblemOf(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    nameOf(entry: EffectsStepEntry): string {
      return translateText(entry.kind === 'party' ? partyNameKey(entry.party) : entry.name);
    },
    cadenceOf(uses: number, left?: number): string {
      if (uses <= 1) {
        return translateText('once a generation');
      }
      // A law taken more than once (RX37) reads what is still left once a use is spent — words, never a colour.
      return left !== undefined && left > 0 && left < uses ?
        translateTextWithParams('${0} times a generation · ${1} left', [String(uses), String(left)]) :
        translateTextWithParams('${0} times a generation', [String(uses)]);
    },
    readingOf(reading: EffectWhyReading): string {
      return reading.params.length === 0 ? translateText(reading.key) : translateTextWithParams(reading.key, reading.params.map((p) => translateText(p)));
    },
  },
});
</script>
