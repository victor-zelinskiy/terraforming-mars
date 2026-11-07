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
        CAMPAIGN ONLY — a rolled rule's SUB-setting («Случайные цели и награды»,
        «Случайные места для тайлов»): the chance each mission of the route
        rolls the rule. A dial (◄ ► / A cycles), not a switch; indented under
        its parent rule like every sub-setting.
      -->
      <button
        v-else-if="row.kind === 'chance'"
        type="button"
        class="cm-row cm-rule cm-rule--sub cm-rule--on"
        :data-rule-sub="chanceRule(row.id).sub"
        :class="{'cm-row--cursor': i === cursor, 'cm-row--shake': i === shakeRow}"
        @click="$emit('activate', i)"
        @mousemove="$emit('hover', i)"
      >
        <span class="cm-row__main">
          <span class="cm-row__name">{{ $t('Chance per mission') }}</span>
          <span class="cm-row__sub">
            <span class="cm-rule__desc">{{ $t(chanceRule(row.id).descKey) }}</span>
          </span>
        </span>
        <span class="cm-field__value cm-field__value--stepper cm-rule__dial" aria-hidden="true">
          <span class="cm-field__arrow">◄</span>
          <span class="cm-field__stepval cm-rule__dial-value">{{ row.chance }}%</span>
          <span class="cm-field__arrow">►</span>
          <span class="cm-field__gauge">
            <span v-for="(c, n) in chances" :key="c" class="cm-field__gauge-seg" :class="{'cm-field__gauge-seg--on': n <= chanceIndex(row.chance)}"></span>
          </span>
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
 * console rows with a large ON/OFF switch, plus two sub-setting rows: the
 * campaign's per-mission chance of «Случайные цели и награды» (a dial) and the
 * dev «Гарантированные карты» (admin + test mode), which drills in instead of
 * toggling. A conflicting rule (MarsBot compatibility) swaps its description
 * for the blocker reason and carries the red conflict rim. Pure presentation.
 */
import {defineComponent, PropType} from 'vue';
import {CampaignChanceRule, RulesDeckRow, campaignChanceRule} from '@/client/console/menu/consoleCreateModel';
import {MissionModifierId} from '@/common/campaign/CampaignTypes';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CAMPAIGN_MODIFIER_CHANCES, CampaignModifierChance} from '@/common/campaign/missionModifiers';

export default defineComponent({
  name: 'ConsoleRulesDeck',
  components: {GamepadGlyph},
  props: {
    rows: {type: Array as PropType<ReadonlyArray<RulesDeckRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  computed: {
    chances(): ReadonlyArray<number> {
      return CAMPAIGN_MODIFIER_CHANCES;
    },
  },
  methods: {
    rowKey(row: RulesDeckRow): string {
      if (row.kind === 'rule') {
        return `rule:${row.rule.meta.id}`;
      }
      return row.kind === 'chance' ? `chance:${row.id}` : row.kind;
    },
    chanceRule(id: MissionModifierId): CampaignChanceRule {
      return campaignChanceRule(id);
    },
    chanceIndex(chance: number): number {
      return CAMPAIGN_MODIFIER_CHANCES.indexOf(chance as CampaignModifierChance);
    },
    blockerText(key: string): string {
      return automaBlockerText(key);
    },
  },
});
</script>
