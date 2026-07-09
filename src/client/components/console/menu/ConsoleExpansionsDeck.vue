<template>
  <div class="cm-deckbody cm-expansions">
    <button
      v-for="(row, i) in rows"
      :key="row.meta.id"
      type="button"
      class="cm-exp"
      :class="{
        'cm-exp--cursor': i === cursor,
        'cm-row--shake': i === shakeRow,
        'cm-exp--on': row.value,
        'cm-exp--conflict': row.conflictKey !== undefined,
      }"
      @click="$emit('activate', i)"
      @mousemove="$emit('hover', i)"
    >
      <span class="cm-exp__icon" aria-hidden="true">
        <img :src="icon(row.meta.id)" alt="" draggable="false" />
      </span>
      <span class="cm-exp__main">
        <span class="cm-exp__name">{{ $t(row.meta.labelKey) }}</span>
        <span v-if="row.conflictKey !== undefined" class="cm-exp__issue">{{ $t(blockerText(row.conflictKey)) }}</span>
      </span>
      <span class="cm-exp__state" :class="{'cm-exp__state--on': row.value}">
        {{ $t(row.value ? 'On' : 'Off') }}
      </span>
    </button>
  </div>
</template>

<script lang="ts">
/**
 * EXPANSIONS deck renderer (console create) — the seven in-scope modules as
 * a 2-column grid of big toggle plates (icon / name / ON-OFF state chip).
 * A MarsBot conflict shows the blocker reason inline. Pure presentation;
 * the 2D cursor math lives in the model (`deckNavStep`).
 */
import {defineComponent, PropType} from 'vue';
import {ExpansionRow} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import {expansionIcon} from '@/client/components/create/premium/createGameMeta';
import {Expansion} from '@/common/cards/GameModule';

export default defineComponent({
  name: 'ConsoleExpansionsDeck',
  props: {
    rows: {type: Array as PropType<ReadonlyArray<ExpansionRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  methods: {
    icon(id: Expansion): string {
      return expansionIcon(id);
    },
    blockerText(key: string): string {
      return automaBlockerText(key);
    },
  },
});
</script>
