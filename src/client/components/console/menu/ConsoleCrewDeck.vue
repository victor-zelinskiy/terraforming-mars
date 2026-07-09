<template>
  <div class="cm-deckbody cm-crew">
    <button
      v-for="(row, i) in rows"
      :key="rowKey(row, i)"
      type="button"
      class="cm-row"
      :class="rowClasses(row, i)"
      @click="$emit('activate', i)"
      @mousemove="$emit('hover', i)"
    >
      <!-- Human participant -->
      <template v-if="row.kind === 'human'">
        <span class="cm-row__num" aria-hidden="true">{{ row.index + 1 }}</span>
        <span class="cm-row__cube" :class="'player_bg_color_' + row.slot.color" aria-hidden="true"></span>
        <span class="cm-row__main">
          <span class="cm-row__name" :class="{'cm-row__name--missing': row.slot.name.trim() === ''}">
            {{ row.slot.name.trim() !== '' ? row.slot.name : $t('Name not set') }}
          </span>
          <span class="cm-row__sub">
            <span>{{ $t('Player') }}</span>
            <span v-if="row.nameIssue !== undefined" class="cm-row__issue">{{ $t(issueText(row.nameIssue)) }}</span>
          </span>
        </span>
        <span v-if="row.isCreator" class="cm-row__tag cm-row__tag--creator">{{ $t('Creator') }}</span>
        <span v-if="trBoostEnabled && row.slot.trBoost > 0" class="cm-row__tag cm-row__tag--tr">TR +{{ row.slot.trBoost }}</span>
      </template>

      <!-- MarsBot participant -->
      <template v-else-if="row.kind === 'bot'">
        <span class="cm-row__num cm-row__num--bot" aria-hidden="true">⌬</span>
        <span class="cm-row__cube cm-row__cube--bot" aria-hidden="true">⚙</span>
        <span class="cm-row__main">
          <span class="cm-row__name">{{ $t('MarsBot') }}</span>
          <span class="cm-row__sub">
            <span>{{ $t(difficultyLabel(row.difficulty)) }}</span>
            <span class="cm-row__dot" aria-hidden="true">·</span>
            <span>{{ $t('Takes its turns automatically') }}</span>
          </span>
        </span>
        <span class="cm-row__tag cm-row__tag--bot">{{ $t('Automa') }}</span>
      </template>

      <!-- Add participant -->
      <template v-else>
        <span class="cm-row__num cm-row__num--add" aria-hidden="true">+</span>
        <span class="cm-row__main">
          <span class="cm-row__name cm-row__name--add">{{ $t('Add participant') }}</span>
          <span class="cm-row__sub">
            <span v-if="row.reasonKey !== undefined" class="cm-row__issue">{{ $t(row.reasonKey) }}</span>
            <span v-else>{{ $t('A player or the MarsBot') }}</span>
          </span>
        </span>
      </template>
    </button>
  </div>
</template>

<script lang="ts">
/**
 * CREW deck renderer (console create) — the participant roster as big
 * console rows: humans (cube / name / creator + TR chips / name issue),
 * the MarsBot seat (difficulty + "plays itself"), and the ADD PARTICIPANT
 * plate. Pure presentation: cursor + activation come from the screen root.
 */
import {defineComponent, PropType} from 'vue';
import {CrewRow} from '@/client/console/menu/consoleCreateModel';
import {createGameState, SlotNameIssue} from '@/client/components/create/premium/createGameState';
import {botDifficultyMeta} from '@/client/components/create/premium/createGameMeta';
import {DifficultyLevel} from '@/common/automa/AutomaTypes';

export default defineComponent({
  name: 'ConsoleCrewDeck',
  props: {
    rows: {type: Array as PropType<ReadonlyArray<CrewRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  computed: {
    trBoostEnabled(): boolean {
      return createGameState.config.rules.trBoostEnabled;
    },
  },
  methods: {
    rowKey(row: CrewRow, i: number): string {
      if (row.kind === 'human') {
        return `h${row.index}`;
      }
      return row.kind === 'bot' ? 'bot' : `add${i}`;
    },
    rowClasses(row: CrewRow, i: number): Record<string, boolean> {
      return {
        'cm-row--cursor': i === this.cursor,
        'cm-row--shake': i === this.shakeRow,
        'cm-row--issue': (row.kind === 'human' && row.nameIssue !== undefined),
        'cm-row--disabled': row.kind === 'add' && !row.enabled,
        'cm-row--bot': row.kind === 'bot',
        'cm-row--add': row.kind === 'add',
      };
    },
    issueText(issue: SlotNameIssue): string {
      switch (issue) {
      case 'empty': return 'Fill in the player name';
      case 'invalid': return 'This name cannot be used';
      case 'duplicate': return 'Player names must be unique';
      }
    },
    difficultyLabel(id: DifficultyLevel): string {
      return botDifficultyMeta(id).labelKey;
    },
  },
});
</script>
