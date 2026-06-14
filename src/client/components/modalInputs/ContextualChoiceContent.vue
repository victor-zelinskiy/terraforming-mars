<template>
  <!--
    Premium CONTEXTUAL choice modal — the replacement for the context-less
    "Select one option" list when a top-level OrOptions carries `choiceContext`
    (a triggered effect / on-play decision / deferred action). It frames the bare
    option list with the WHO + WHY the player was missing:

      - LEFT  : the SOURCE card / corporation (mini preview, click → fullscreen),
      - RIGHT : a kind chip ("Корпорация"), the source name, the TRIGGER line
                ("сработал эффект: …") and the choice instruction,
      - BELOW : the actual options, rendered by the (header-suppressed) shared
                ModernOptionPicker — so every option interaction (select → confirm,
                nested inputs, board picker, hand pick, skip split, rich result
                chips) is reused, never re-implemented.

    Mirrors the 2-column composition of CardActionConfirmContent so the two premium
    decision surfaces read as one design system. Submits byte-identical to the bare
    list (ModernOptionPicker owns the submission).
  -->
  <div class="contextual-choice" :class="'contextual-choice--' + modeClass">
    <div class="contextual-choice__frame">
      <div class="contextual-choice__corner contextual-choice__corner--tl" aria-hidden="true"></div>
      <div class="contextual-choice__corner contextual-choice__corner--tr" aria-hidden="true"></div>
      <div class="contextual-choice__corner contextual-choice__corner--bl" aria-hidden="true"></div>
      <div class="contextual-choice__corner contextual-choice__corner--br" aria-hidden="true"></div>

      <header class="contextual-choice__header">
        <span class="contextual-choice__kicker">
          <span class="contextual-choice__kicker-dot" aria-hidden="true"></span>
          <span class="contextual-choice__kicker-text" v-i18n>{{ kickerText }}</span>
        </span>
      </header>

      <div class="contextual-choice__top2">
        <!-- LEFT: source card (compact, click → fullscreen like everywhere). -->
        <aside v-if="sourceCardName !== undefined" class="contextual-choice__src">
          <span class="contextual-choice__src-label" v-i18n>Source</span>
          <button type="button"
                  class="contextual-choice__src-card"
                  :aria-label="$t('Open fullscreen')"
                  @click.capture.stop="openFullscreen"
                  data-test="contextual-choice-source">
            <Card :key="sourceCardName" :card="sourceCardModel" :autoTall="true" />
          </button>
        </aside>

        <!-- RIGHT: source kind + name + the trigger / instruction. -->
        <section class="contextual-choice__panel">
          <span class="contextual-choice__kind" :class="'contextual-choice__kind--' + sourceKind" v-i18n>{{ kindLabel }}</span>
          <h3 v-if="sourceCardName !== undefined" class="contextual-choice__title" v-i18n>{{ sourceCardName }}</h3>
          <h3 v-else class="contextual-choice__title" v-i18n>{{ titleText }}</h3>

          <div v-if="triggerText !== ''" class="contextual-choice__trigger">
            <span class="contextual-choice__trigger-label" v-i18n>Effect triggered</span>
            <p class="contextual-choice__trigger-text">{{ triggerText }}</p>
          </div>

          <p v-if="instructionText !== ''" class="contextual-choice__instruction">{{ instructionText }}</p>
        </section>
      </div>

      <!-- BELOW: the real options + select/confirm flow (shared component). -->
      <div class="contextual-choice__options">
        <ModernOptionPicker :playerView="playerView"
                            :playerinput="playerinput"
                            :onsave="onsave"
                            :hideHeader="true" />
      </div>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoomModal"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {OrOptionsModel, ChoiceContext} from '@/common/models/PlayerInputModel';
import {OrOptionsResponse} from '@/common/inputs/InputResponse';
import {Message} from '@/common/logs/Message';
import {translateText, translateMessage} from '@/client/directives/i18n';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import ModernOptionPicker from '@/client/components/modalInputs/ModernOptionPicker.vue';

// The default OrOptions title — when the prompt didn't set a meaningful one, the
// contextual frame's trigger line carries the "why", so the bare default reads as
// noise and is suppressed from the instruction line.
const DEFAULT_OR_TITLE = 'Select one option';

const KIND_LABEL: Record<ChoiceContext['source']['kind'], string> = {
  card: 'Card',
  corporation: 'Corporation',
  standardProject: 'Standard project',
  colony: 'Colony',
  system: 'Game effect',
};

// The kicker line by mode — what KIND of decision this is.
const MODE_KICKER: Record<NonNullable<ChoiceContext['mode']> | 'default', string> = {
  'optional-effect': 'Effect triggered',
  'effect-choice': 'Effect triggered',
  'attack': 'Choose a target',
  'reward': 'Collect a reward',
  'default': 'Make a choice',
};

function asText(m: string | Message | undefined): string {
  if (m === undefined) {
    return '';
  }
  return typeof m === 'string' ? translateText(m) : translateMessage(m);
}

export default defineComponent({
  name: 'ContextualChoiceContent',
  components: {Card, CardZoomModal, ModernOptionPicker},
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => OrOptionsModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: OrOptionsResponse) => void,
      required: true,
    },
  },
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
    };
  },
  computed: {
    context(): ChoiceContext | undefined {
      return this.playerinput.choiceContext;
    },
    sourceKind(): ChoiceContext['source']['kind'] {
      return this.context?.source.kind ?? 'system';
    },
    sourceCardName(): CardName | undefined {
      return this.context?.source.card;
    },
    sourceCardModel(): CardModel {
      return {name: this.sourceCardName} as CardModel;
    },
    kindLabel(): string {
      return KIND_LABEL[this.sourceKind];
    },
    modeClass(): string {
      return this.context?.mode ?? 'optional-effect';
    },
    kickerText(): string {
      const mode = this.context?.mode;
      return MODE_KICKER[mode ?? 'default'];
    },
    triggerText(): string {
      return asText(this.context?.trigger);
    },
    titleText(): string {
      return asText(this.playerinput.title);
    },
    // The OrOptions title becomes the choice INSTRUCTION (under the source name) —
    // unless it's the bare default, in which case the trigger line already says it.
    instructionText(): string {
      if (this.sourceCardName === undefined) {
        return '';
      }
      const raw = this.playerinput.title;
      if (typeof raw === 'string' && raw === DEFAULT_OR_TITLE) {
        return '';
      }
      return this.titleText;
    },
  },
  methods: {
    openFullscreen(): void {
      if (this.sourceCardName === undefined) {
        return;
      }
      this.zoomCard = this.sourceCardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
