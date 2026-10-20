<template>
  <div class="con-parl-qd con-parl-qd--career" data-parl-career-dossier role="dialog" :aria-label="$t('Agenda track')">
    <!-- ══ THE CAREER'S DOSSIER (Парламент v8 § 7, the mock `d2`): X on the career reads the TRACK — every seat's place
         (its step and its influence) · the ladder of twelve tiles with their rewards and the markers on them · «§ ПРАВИЛА»
         (influence, the steps' rewards, where influence works) in words. Read-only; B or X closes. ══ -->
    <section class="con-parl-qd__side" data-parl-cd-seats>
      <span class="con-parl-qd__kicker">{{ $t('Standing') }}</span>
      <div class="con-parl-qd__race">
        <div v-for="seat in seats" :key="seat.color" class="con-parl-qd__row con-parl-qd__row--seat"
             :class="{'con-parl-qd__row--me': seat.color === viewerColor}" :data-parl-cd-seat="seat.color">
          <PlayerCube :color="seat.color" :size="cubePx(14)" :glow="false" />
          <span class="con-parl-qd__row-name">{{ seat.name }}</span>
          <span class="con-parl-qd__row-step">{{ stepText(seat.agenda) }}</span>
          <span class="con-parl-qd__coin" :aria-label="$t('Influence')"><i class="con-parl-qd__coin-glyph" aria-hidden="true"></i><b>{{ seat.influence }}</b></span>
        </div>
      </div>
      <div class="con-parl-qd__note">
        <!-- The LEGEND of the career insignia: the one place that says what «+1 [insignia]» means wherever it is printed. -->
        <span class="con-parl-qd__label"><i class="career-step-glyph" aria-hidden="true"></i>{{ $t('A step of the career is given by') }}</span>
        <p class="con-parl-qd__text">{{ $t('the vote won · the chairman quest · the effects of cards') }}</p>
      </div>
    </section>
    <section class="con-parl-qd__hero con-parl-qd__hero--ladder" data-parl-cd-ladder>
      <span class="con-parl-qd__kicker con-parl-qd__kicker--gold"><i class="career-step-glyph" aria-hidden="true"></i>{{ $t('Agenda track') }}</span>
      <div class="con-parl-qd__ladder">
        <div class="con-parl-qd__rung con-parl-qd__rung--start">
          <span class="con-parl-qd__rung-cubes"><PlayerCube v-for="c in view.agendaStart" :key="c" :color="c" :size="cubePx(15)" :glow="false" /></span>
          <span class="con-parl-qd__rung-label">{{ $t('Career start') }}</span>
        </div>
        <div v-for="step in view.agenda" :key="step.index" class="con-parl-qd__rung"
             :class="'con-parl-qd__rung--' + step.step.kind" :data-parl-cd-step="step.index">
          <span class="con-parl-qd__rung-n">{{ step.index }}</span>
          <span class="con-parl-qd__rung-cubes"><PlayerCube v-for="c in step.cubes" :key="c" :color="c" :size="cubePx(15)" :glow="false" /></span>
          <span v-if="step.step.kind === 'influence'" class="con-parl-qd__coin con-parl-qd__coin--rung"><i class="con-parl-qd__coin-glyph" aria-hidden="true"></i><b>{{ step.step.influence }}</b></span>
          <i v-else-if="step.step.kind === 'tr'" class="con-parl-qd__rung-res resource_icon resource_icon--rating" aria-hidden="true"></i>
          <i v-else class="con-parl-qd__rung-res con-parl-qd__rung-res--card resource_icon resource_icon--cards" aria-hidden="true"></i>
          <!-- An influence rung is its COIN (the level struck inside it) — the words are the TR and the card rungs'. -->
          <span v-if="step.step.kind !== 'influence'" class="con-parl-qd__rung-label">{{ rewardText(step) }}</span>
        </div>
      </div>
    </section>
    <section class="con-parl-qd__side con-parl-qd__side--rules" data-parl-cd-rules>
      <span class="con-parl-qd__kicker"><span class="con-parl-qd__section-mark" aria-hidden="true">§</span>{{ $t('Rules') }}</span>
      <div class="con-parl-qd__rule">
        <span class="con-parl-qd__tag">{{ $t('Influence') }}</span>
        <p class="con-parl-qd__text">{{ $t('Your influence is the highest influence level you reached on the track: steps 1–2 give 1, 3–4 give 2, 5–7 give 3, 8–11 give 4, step 12 gives 5. Some cards and colonies add to it.') }}</p>
      </div>
      <div class="con-parl-qd__rule">
        <span class="con-parl-qd__tag con-parl-qd__tag--reward">{{ $t('Step rewards') }}</span>
        <p class="con-parl-qd__text">{{ $t('A step pays its reward the moment the marker lands on it: 1 TR or 1 card.') }}</p>
      </div>
      <div class="con-parl-qd__rule">
        <span class="con-parl-qd__tag con-parl-qd__tag--cyan">{{ $t('Where influence works') }}</span>
        <p class="con-parl-qd__text">{{ $t('The effects of enacted resolutions scale with your influence.') }}</p>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {ParliamentAgendaStepVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleParliamentCareerDossier',
  components: {PlayerCube},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  computed: {
    /** Every seat that holds delegates, with its step and its influence (the server's numbers). */
    seats(): ReadonlyArray<{color: Color, name: string, agenda: number, influence: number}> {
      return this.view.players.filter((p) => p.participates).map((p) => ({color: p.color, name: p.name, agenda: p.agenda, influence: p.influence}));
    },
  },
  methods: {
    stepText(agenda: number): string {
      return agenda === 0 ? translateText('Career start') : translateTextWithParams('step ${0}', [String(agenda)]);
    },
    /** A TR or a card rung's reward in words (an influence rung is its coin). */
    rewardText(step: ParliamentAgendaStepVm): string {
      return translateText(step.step.kind === 'tr' ? '+1 TR' : '+1 card');
    },
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
  },
});
</script>
