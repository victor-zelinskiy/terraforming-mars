<template>
  <div class="cm-deckbody cm-rules">
    <template v-for="(row, i) in rows" :key="rowKey(row)">
      <button
        v-if="row.kind === 'rule'"
        type="button"
        class="cm-row cm-rule"
        :class="{
          'cm-row--cursor': i === cursor,
          'cm-row--shake': i === shakeRow,
          'cm-rule--on': row.rule.value,
          'cm-row--conflict': row.rule.conflictKey !== undefined,
        }"
        @click="$emit('activate', i)"
        @mousemove="$emit('hover', i)"
      >
        <span class="cm-row__main">
          <span class="cm-row__name">{{ $t(row.rule.meta.labelKey) }}</span>
          <span class="cm-row__sub">
            <span v-if="row.rule.conflictKey !== undefined" class="cm-row__issue">{{ $t(blockerText(row.rule.conflictKey)) }}</span>
            <span v-else class="cm-rule__desc">{{ $t(row.rule.meta.descKey) }}</span>
          </span>
        </span>
        <span class="cm-toggle" :class="{'cm-toggle--on': row.rule.value}" aria-hidden="true">
          <span class="cm-toggle__state">{{ $t(row.rule.value ? 'On' : 'Off') }}</span>
          <span class="cm-toggle__track"><span class="cm-toggle__knob"></span></span>
        </span>
      </button>

      <!--
        The test-mode SUB-setting. Indented under its parent and marked DEV: it
        is not a rule variant, and it is not a switch — the value is a count and
        A drills into the picker.
      -->
      <button
        v-else
        type="button"
        class="cm-row cm-rule cm-rule--sub"
        :class="{'cm-row--cursor': i === cursor, 'cm-row--shake': i === shakeRow, 'cm-rule--on': row.count > 0}"
        @click="$emit('activate', i)"
        @mousemove="$emit('hover', i)"
      >
        <span class="cm-row__main">
          <span class="cm-row__name">
            <span class="cm-rule__devtag" aria-hidden="true">DEV</span>
            {{ $t('Guaranteed cards') }}
          </span>
          <span class="cm-row__sub">
            <span class="cm-rule__desc">{{ $t('Put cards on top of the decks so they land in the first hand dealt.') }}</span>
          </span>
        </span>
        <span class="cm-rule__count" :class="{'cm-rule__count--on': row.count > 0}">
          <span class="cm-rule__count-value">{{ row.count > 0 ? row.count : $t('None') }}</span>
          <GamepadGlyph control="confirm" />
        </span>
      </button>
    </template>
  </div>
</template>

<script lang="ts">
/**
 * RULES deck renderer (console create) — the premium rule toggles as full-width
 * console rows with a large ON/OFF switch, plus the ONE dev sub-setting row
 * («Гарантированные карты», admin + test mode) which drills in instead of
 * toggling. A conflicting rule (MarsBot compatibility) swaps its description
 * for the blocker reason and carries the red conflict rim. Pure presentation.
 */
import {defineComponent, PropType} from 'vue';
import {RulesDeckRow} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleRulesDeck',
  components: {GamepadGlyph},
  props: {
    rows: {type: Array as PropType<ReadonlyArray<RulesDeckRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  methods: {
    rowKey(row: RulesDeckRow): string {
      return row.kind === 'rule' ? `rule:${row.rule.meta.id}` : 'devCards';
    },
    blockerText(key: string): string {
      return automaBlockerText(key);
    },
  },
});
</script>
