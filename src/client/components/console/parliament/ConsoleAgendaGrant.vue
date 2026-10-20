<template>
  <!--
    A STEP OF THE CAREER A LAW GRANTS THE SEATS (Turmoil Redux — Reds Budget:
    «each player advances their Agenda marker 1 step»): ONE graphic block
    wherever a surface names it — the vote panel's own-effect block, the
    inspector, the results, the playground. The twin of `ConsoleTileGrant`.

    THE BODY is the step as the track prints it: the career INSIGNIA (the one
    picture of a step — glossary § 4a), then for every step the law walks the
    marker to the step's NODE with its number (the track's own disc — a bare
    numeral reads as a count, never as a place) and what that step PAYS —
    «+1 [TR]», «+1 [card]» (MarsBot: «+1 [M€] вместо карты»), or the
    influence level it sets (the glyph with the level, law 14). Before the vote
    a win's forecast follows in its own quiet segment: the winner's step of the
    sitting comes FIRST, so «если победите: +2 шага» with both nodes. At the end
    of the track the caption says so — never a silent nothing.

    Nothing here computes: the reading arrives from `agendaGrantModel.ts`.
  -->
  <div class="con-agrant"
       :class="['con-agrant--' + size, 'con-agrant--' + variant, 'con-agrant--' + reading.context, {
         'con-agrant--end': atEnd,
         'con-agrant--skipped': reading.skipped !== undefined,
       }]"
       data-agenda-grant
       :data-agenda-context="reading.context"
       :data-agenda-position="reading.position"
       :data-agenda-next="firstStep?.to"
       :data-agenda-gift="firstGift?.kind"
       :data-agenda-win-steps="reading.ifWin?.length"
       :data-agenda-skipped="reading.skipped">
    <span v-if="variant !== 'inline'" class="con-agrant__head">
      <i class="career-step-glyph con-agrant__glyph" aria-hidden="true"></i>
      <span class="con-agrant__label">{{ label }}</span>
      <span v-if="caption !== ''" class="con-agrant__caption" data-agenda-caption>{{ caption }}</span>
    </span>
    <span class="con-agrant__body">
      <template v-if="variant === 'inline'">
        <i class="career-step-glyph con-agrant__glyph" aria-hidden="true"></i>
        <b class="con-agrant__name">{{ label }}</b>
      </template>
      <span v-for="step in steps" :key="'s' + step.to" class="con-agrant__step" data-agenda-step :data-agenda-step-to="step.to" :data-agenda-step-gift="step.gift.kind">
        <span class="con-agrant__arrow" aria-hidden="true">→</span>
        <i class="con-agrant__node" aria-hidden="true">{{ step.to }}</i>
        <template v-if="step.gift.kind === 'influence'">
          <span class="con-agrant__inf"><i class="con-agrant__inf-icon" aria-hidden="true"></i><b>{{ step.gift.level }}</b></span>
        </template>
        <template v-else>
          <b class="con-agrant__amount">+1</b>
          <i class="con-agrant__unit" :class="giftClass(step.gift)" aria-hidden="true"></i>
          <span v-if="step.gift.kind === 'megacredits'" class="con-agrant__instead">{{ $t('instead of a card') }}</span>
        </template>
      </span>
      <span v-if="variant === 'inline' && caption !== ''" class="con-agrant__caption con-agrant__caption--inline" data-agenda-caption>{{ caption }}</span>
      <!-- THE WIN's FORECAST (before the vote): the winner's step of the sitting first, then the law's — both nodes. -->
      <span v-if="winSteps.length > 0" class="con-agrant__win" data-agenda-win>
        <span class="con-agrant__win-text">{{ winLabel }}</span>
        <span v-for="step in winSteps" :key="'w' + step.to" class="con-agrant__win-step" :data-agenda-win-to="step.to">
          <i class="con-agrant__node con-agrant__node--win" aria-hidden="true">{{ step.to }}</i>
          <span v-if="step.gift.kind === 'influence'" class="con-agrant__inf"><i class="con-agrant__inf-icon" aria-hidden="true"></i><b>{{ step.gift.level }}</b></span>
          <template v-else>
            <b class="con-agrant__amount">+1</b>
            <i class="con-agrant__unit" :class="giftClass(step.gift)" aria-hidden="true"></i>
          </template>
        </span>
      </span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {
  AgendaGrantReading, agendaGrantCaptionOf, agendaGrantLabelKey, agendaGrantWinKey, AgendaStepGift, agendaStepGiftOf,
} from '@/client/console/parliament/agendaGrantModel';
import {ReadingPerson} from '@/client/console/parliament/influenceYieldModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type ShownStep = {to: number, gift: AgendaStepGift};

export default defineComponent({
  name: 'ConsoleAgendaGrant',
  props: {
    reading: {type: Object as PropType<AgendaGrantReading>, required: true},
    /** `compact` in a footer / a vote block, `normal` in a panel, `hero` on a stage. */
    size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
    /** WHOSE reading this is — the viewer's own, or another seat's (the caption follows). */
    person: {type: String as PropType<ReadingPerson>, default: 'you'},
    /** `block` — the head and the body; `inline` — the body and the caption on ONE line (a host's own row). */
    variant: {type: String as PropType<'block' | 'inline'>, default: 'block'},
    /** Print the win's forecast (the vote panel and the inspector do; a results row has no «if»). */
    withWin: {type: Boolean, default: true},
  },
  computed: {
    label(): string {
      const head = agendaGrantLabelKey(this.reading.grant);
      return translateTextWithParams(head.key, [...head.params]);
    },
    /** The steps the body draws: the record's walk once applied, else what the law's step(s) give from here. */
    steps(): Array<ShownStep> {
      const reading = this.reading;
      const noHand = reading.noHand === true;
      if (reading.walked !== undefined) {
        return reading.walked.steps.map((step) => ({to: step.to, gift: agendaStepGiftOf(step, noHand)}));
      }
      return (reading.ahead ?? []).map((step) => ({to: step.to, gift: agendaStepGiftOf(step, noHand)}));
    },
    firstStep(): ShownStep | undefined {
      return this.steps[0];
    },
    firstGift(): AgendaStepGift | undefined {
      return this.firstStep?.gift;
    },
    /** The win's extra steps — what the forecast ADDS beyond `ahead` is the whole forecast (both steps are drawn). */
    winSteps(): Array<ShownStep> {
      if (!this.withWin || this.reading.ifWin === undefined) {
        return [];
      }
      const noHand = this.reading.noHand === true;
      return this.reading.ifWin.map((step) => ({to: step.to, gift: agendaStepGiftOf(step, noHand)}));
    },
    winLabel(): string {
      const key = agendaGrantWinKey(this.reading, this.person);
      return key === undefined ? '' : translateTextWithParams(key.key, [...key.params]);
    },
    atEnd(): boolean {
      return this.reading.context !== 'reference' && this.reading.context !== 'applied' && (this.reading.ahead ?? []).length === 0;
    },
    caption(): string {
      const caption = agendaGrantCaptionOf(this.reading, this.person);
      if (caption === undefined) {
        return '';
      }
      const text = caption.params === undefined ? translateText(caption.key) : translateTextWithParams(caption.key, [...caption.params]);
      return this.reading.generation === undefined ? text : `${translateTextWithParams('Generation ${0}', [String(this.reading.generation)])} · ${text}`;
    },
  },
  methods: {
    giftClass(gift: AgendaStepGift): string {
      switch (gift.kind) {
      case 'tr': return iconClassFor('tr');
      case 'card': return iconClassFor('cards');
      case 'megacredits': return iconClassFor('megacredits');
      case 'influence': return '';
      }
    },
  },
});
</script>
