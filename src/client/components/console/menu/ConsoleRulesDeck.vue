<template>
  <div class="cm-deckbody cm-rules">
    <button
      v-for="(row, i) in rows"
      :key="row.meta.id"
      type="button"
      class="cm-row cm-rule"
      :class="{
        'cm-row--cursor': i === cursor,
        'cm-row--shake': i === shakeRow,
        'cm-rule--on': row.value,
        'cm-row--conflict': row.conflictKey !== undefined,
      }"
      @click="$emit('activate', i)"
      @mousemove="$emit('hover', i)"
    >
      <span class="cm-row__main">
        <span class="cm-row__name">{{ $t(row.meta.labelKey) }}</span>
        <span class="cm-row__sub">
          <span v-if="row.conflictKey !== undefined" class="cm-row__issue">{{ $t(blockerText(row.conflictKey)) }}</span>
          <span v-else class="cm-rule__desc">{{ $t(row.meta.descKey) }}</span>
        </span>
      </span>
      <span class="cm-toggle" :class="{'cm-toggle--on': row.value}" aria-hidden="true">
        <span class="cm-toggle__state">{{ $t(row.value ? 'On' : 'Off') }}</span>
        <span class="cm-toggle__track"><span class="cm-toggle__knob"></span></span>
      </span>
    </button>
  </div>
</template>

<script lang="ts">
/**
 * RULES deck renderer (console create) — the six premium rule toggles as
 * full-width console rows with a large ON/OFF switch. A conflicting rule
 * (MarsBot compatibility) swaps its description for the blocker reason and
 * carries the red conflict rim. Pure presentation.
 */
import {defineComponent, PropType} from 'vue';
import {RuleRow} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';

export default defineComponent({
  name: 'ConsoleRulesDeck',
  props: {
    rows: {type: Array as PropType<ReadonlyArray<RuleRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  methods: {
    blockerText(key: string): string {
      return automaBlockerText(key);
    },
  },
});
</script>
