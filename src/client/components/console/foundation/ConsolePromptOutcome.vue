<template>
  <!-- THE CONSEQUENCE FOOTER — what confirming does to the player, in the decision's own tone, at the plate's foot
       (beside where every verb lives: the command bar under it). ONE line with a reserved height: choosing re-flows
       nothing above it.
         [emblem] ВЫ ПОТЕРЯЕТЕ   [prod M€] −1  +3 → +2                    1 / 2
       Nothing chosen yet → the footer says what is still owed, never a blank. -->
  <div class="con-prompt-outcome" :class="'con-prompt-outcome--' + tone" data-prompt-outcome :data-prompt-outcome-tone="tone"
       role="status">
    <span class="con-prompt-outcome__label">
      <ConsolePromptEmblem :tone="tone" class="con-prompt-outcome__emblem" />
      <span>{{ $t(labelKeyOrDefault) }}</span>
    </span>
    <span class="con-prompt-outcome__items">
      <template v-if="items.length > 0">
        <span v-for="item in items" :key="item.key" class="con-prompt-outcome__item" :data-prompt-outcome-item="item.key">
          <span class="con-prompt-outcome__icon" :class="{'con-prompt-outcome__icon--prod': item.prod === true}">
            <i :class="item.iconClass" aria-hidden="true"></i>
          </span>
          <b class="con-prompt-outcome__delta" :class="item.delta < 0 ? 'con-prompt-outcome__delta--minus' : 'con-prompt-outcome__delta--plus'">{{ signed(item.delta) }}</b>
          <span v-if="item.from !== undefined && item.to !== undefined" class="con-prompt-outcome__fromto">
            {{ item.from }}<span class="con-prompt-outcome__arrow" aria-hidden="true">→</span>{{ item.to }}
          </span>
        </span>
      </template>
      <span v-else class="con-prompt-outcome__pending">{{ pending }}</span>
    </span>
    <span v-if="meter !== undefined" class="con-prompt-outcome__meter"
          :class="{'con-prompt-outcome__meter--ready': meter.done === meter.of}" data-prompt-meter>
      <b>{{ meter.done }}</b><span class="con-prompt-outcome__meter-of">/ {{ meter.of }}</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsolePromptEmblem from '@/client/components/console/foundation/ConsolePromptEmblem.vue';
import {PromptTone, promptOutcomeLabelKey} from '@/client/console/promptTone';

/** One consequence of the confirm: a pool, its signed delta and `current → resulting`. */
export type PromptOutcomeItem = {
  key: string;
  /** The pool's icon classes (`resource_icon resource_icon--steel`, …). */
  iconClass: string;
  /** A PRODUCTION pool — the icon sits on the production plate. */
  prod?: boolean;
  delta: number;
  from?: string;
  to?: string;
};

/**
 * @console-shared LIVE — the prompt-modal family's consequence footer
 * (`console_prompt.less`). Presentation only: the host computes the items from
 * the SAME numbers its rows show, so the footer can never disagree with them.
 */
export default defineComponent({
  name: 'ConsolePromptOutcome',
  components: {ConsolePromptEmblem},
  props: {
    tone: {type: String as PropType<PromptTone>, required: true},
    items: {type: Array as PropType<ReadonlyArray<PromptOutcomeItem>>, default: () => []},
    /** What is still owed when nothing is chosen yet (already translated). */
    pending: {type: String, default: ''},
    /** The budget readout («1 / 2»), when the decision has one. */
    meter: {type: Object as PropType<{done: number, of: number} | undefined>, default: undefined},
    /** Overrides the tone's label key (English i18n key). */
    labelKey: {type: String, default: ''},
  },
  computed: {
    labelKeyOrDefault(): string {
      return this.labelKey !== '' ? this.labelKey : promptOutcomeLabelKey(this.tone);
    },
  },
  methods: {
    signed(n: number): string {
      return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
    },
  },
});
</script>
