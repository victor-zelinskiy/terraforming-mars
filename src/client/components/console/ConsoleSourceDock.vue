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
         'con-src--plate': view.card === undefined,
         'con-src--hazard': view.tone === 'hazard',
       }">
    <div class="con-src__label">{{ $t('Source') }}</div>

    <div v-if="view.card !== undefined" class="con-src__card">
      <Card :card="{name: view.card}" :key="view.card" />
    </div>

    <!-- A non-card source keeps the dock's shape: same label, same slot, a
         plate instead of a card. Never an empty column and never silence. -->
    <div v-else class="con-src__plate">
      <span class="con-src__plate-mark" aria-hidden="true">◈</span>
      <span class="con-src__plate-kind">{{ $t(view.kindKey) }}</span>
      <span v-if="nameText !== ''" class="con-src__plate-sep" aria-hidden="true">·</span>
      <span v-if="nameText !== ''" class="con-src__plate-name">{{ nameText }}</span>
    </div>

    <div v-if="view.ruleKey !== undefined" class="con-src__rule">{{ $t(view.ruleKey) }}</div>
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
  },
  computed: {
    nameText(): string {
      const name: string | Message | undefined = this.view.name;
      if (name === undefined) {
        return '';
      }
      return typeof name === 'string' ? translateText(name) : translateMessage(name);
    },
  },
});
</script>
