<template>
  <!--
    THE SOURCE DOCK — the console's ONE answer to «почему этот промт пришёл?».

    Every decision surface that can name an origin renders THIS, so the answer
    always looks the same and always sits in the same place:

      ИСТОЧНИК
      [ the real premium card face ]        ← the source IS a card
        …or…
      [ ◈ КОЛОНИЯ · Ганимед ]              ← the source is not a card

    Two sizes, one grammar. `full` is for a surface whose SUBJECT is the card
    (a contextual choice — the decision is about that card). `compact` is for a
    surface whose subject is something else — a resource dial, a production
    row, a list — which the card merely PRODUCED; there the card must be
    recognisable and never out-weigh the thing being answered.

    It draws NO inspect affordance of its own: the verb lives in the ONE bottom
    command bar (X on a choice, L3 everywhere else), and a second badge under
    the art said the same thing in a different word.
  -->
  <div class="con-src" :class="{
         'con-src--compact': compact,
         'con-src--chip': chip,
         'con-src--plate': plateOnly,
         'con-src--hazard': view.tone === 'hazard',
       }">
    <div v-if="!chip" class="con-src__label">{{ $t('Source') }}</div>

    <div v-if="cardName !== undefined" class="con-src__card">
      <Card :card="{name: cardName}" :key="cardName" />
    </div>

    <!-- A non-card source keeps the dock's shape: same label, same slot, a
         plate instead of a card. Never an empty column and never silence.
         The CHIP layout renders this same plate for a CARD source too — one
         line naming it — because a surface with no room for a card face still
         owes the player the answer, and a second visual vocabulary for the
         same sentence is how four of these drifted apart in the first place. -->
    <div v-else class="con-src__plate">
      <span class="con-src__plate-mark" aria-hidden="true">◈</span>
      <span class="con-src__plate-kind">{{ $t(chip ? 'Source' : view.kindKey) }}</span>
      <span v-if="nameText !== ''" class="con-src__plate-sep" aria-hidden="true">·</span>
      <span v-if="nameText !== ''" class="con-src__plate-name">{{ nameText }}</span>
    </div>

    <div v-if="view.ruleKey !== undefined && !chip" class="con-src__rule">{{ $t(view.ruleKey) }}</div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation only. WHICH source a prompt has and how to describe it is
 * decided by the pure model (`promptSource.ts`), so this file contains no
 * marker knowledge and no text heuristics — and a new server marker is wired
 * in exactly one place.
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {PromptSourceView} from '@/client/console/promptSource';

export default defineComponent({
  name: 'ConsoleSourceDock',
  components: {Card},
  props: {
    view: {type: Object as PropType<PromptSourceView>, required: true},
    /** The card is CONTEXT, not the subject (a dial / a list / a distribution). */
    compact: {type: Boolean, default: false},
    /**
     * ONE LINE instead of a dock — for a host with no room for a card face
     * (the board's placement-context panel, which is ~17rem wide and already
     * carries a variable-height consequences preview). The card is named, not
     * drawn; the command bar still opens the real face fullscreen.
     */
    chip: {type: Boolean, default: false},
  },
  computed: {
    /** The plate is the CHIP's only body, and a non-card source's always. */
    plateOnly(): boolean {
      return this.cardName === undefined;
    },
    /** The card face to draw — none in chip mode (it names, never draws). */
    cardName(): CardName | undefined {
      return this.chip ? undefined : this.view.card;
    },
    nameText(): string {
      // The chip is ONE line, so its value must always say something: the card
      // when there is one, else the source's own name, else its kind. A chip
      // reading a bare «ИСТОЧНИК» with nothing after it is worse than none.
      const name: string | Message | undefined =
        this.chip && this.view.card !== undefined ? this.view.card : this.view.name;
      if (name === undefined) {
        return this.chip ? translateText(this.view.kindKey) : '';
      }
      return typeof name === 'string' ? translateText(name) : translateMessage(name);
    },
  },
});
</script>
