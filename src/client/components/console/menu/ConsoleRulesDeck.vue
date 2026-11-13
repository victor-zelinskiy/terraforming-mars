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
        CAMPAIGN ONLY — the REWARD MODE of the whole campaign («Титулы» · «Тендеры»): a dial (◄ ► / A flips), heading
        the deck — what a mission's places earn is the campaign's own rule, never a sub-setting of another.
      -->
      <button
        v-else-if="row.kind === 'rewardMode'"
        type="button"
        class="cm-row cm-rule cm-rule--on cm-rule--reward"
        data-rule-sub="rewardMode"
        :data-reward-mode="row.mode"
        :class="{'cm-row--cursor': i === cursor, 'cm-row--shake': i === shakeRow}"
        @click="$emit('activate', i)"
        @mousemove="$emit('hover', i)"
      >
        <span class="cm-row__main">
          <span class="cm-row__name">{{ $t('Mission rewards') }}</span>
          <span class="cm-row__sub">
            <span class="cm-rule__desc">{{ $t(rewardModeDesc(row.mode)) }}</span>
          </span>
        </span>
        <span class="cm-field__value cm-field__value--stepper cm-rule__dial" aria-hidden="true">
          <span class="cm-field__arrow">◄</span>
          <span class="cm-field__stepval cm-rule__dial-value" data-reward-mode-value>{{ $t(rewardModeLabel(row.mode)) }}</span>
          <span class="cm-field__arrow">►</span>
        </span>
      </button>

      <!--
        CAMPAIGN ONLY, the «Тендеры» mode — HOW MANY tenders a bidding deals (the owner, 2026-11-08): a dial right under the
        reward mode, indented like every sub-setting; the sentence prints THIS table's numbers (cards dealt · seats that
        take one), so the player reads the rule in seats, never in a formula.
      -->
      <button
        v-else-if="row.kind === 'tenderOffer'"
        type="button"
        class="cm-row cm-rule cm-rule--sub cm-rule--on cm-rule--reward"
        data-rule-sub="tenderOffer"
        :data-tender-offer="row.offer"
        :class="{'cm-row--cursor': i === cursor, 'cm-row--shake': i === shakeRow}"
        @click="$emit('activate', i)"
        @mousemove="$emit('hover', i)"
      >
        <span class="cm-row__main">
          <span class="cm-row__name">{{ $t('Tenders per bidding') }}</span>
          <span class="cm-row__sub">
            <span class="cm-rule__desc">{{ tenderOfferDesc(row.offer, row.seats) }}</span>
          </span>
        </span>
        <span class="cm-field__value cm-field__value--stepper cm-rule__dial" aria-hidden="true">
          <span class="cm-field__arrow">◄</span>
          <span class="cm-field__stepval cm-rule__dial-value" data-tender-offer-value>{{ $t(tenderOfferLabel(row.offer)) }}</span>
          <span class="cm-field__arrow">►</span>
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

<script setup lang="ts">
/**
 * RULES deck renderer (console create) — the premium rule toggles as full-width
 * console rows with a large ON/OFF switch, plus two sub-setting rows: the
 * campaign's per-mission chance of «Случайные цели и награды» (a dial) and the
 * dev «Гарантированные карты» (admin + test mode), which drills in instead of
 * toggling. A conflicting rule (MarsBot compatibility) swaps its description
 * for the blocker reason and carries the red conflict rim. Pure presentation.
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {
  CampaignChanceRule, RulesDeckRow, campaignChanceRule, campaignRewardModeDesc, campaignRewardModeLabel, campaignTenderOfferLabel, campaignTenderOfferReading,
} from '@/client/console/menu/consoleCreateModel';
import {CampaignRewardMode, CampaignTenderOffer} from '@/common/campaign/tenders';
import {readingText} from '@/client/console/readingText';
import {MissionModifierId} from '@/common/campaign/CampaignTypes';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CAMPAIGN_MODIFIER_CHANCES, CampaignModifierChance} from '@/common/campaign/missionModifiers';

defineOptions({name: 'ConsoleRulesDeck'});
defineProps({
  rows: {type: Array as PropType<ReadonlyArray<RulesDeckRow>>, required: true},
  cursor: {type: Number, required: true},
  shakeRow: {type: Number, default: -1},
});
defineEmits(['activate', 'hover']);

const chances = computed((): ReadonlyArray<number> => {
  return CAMPAIGN_MODIFIER_CHANCES;
});
function rowKey(row: RulesDeckRow): string {
  if (row.kind === 'rule') {
    return `rule:${row.rule.meta.id}`;
  }
  return row.kind === 'chance' ? `chance:${row.id}` : row.kind;
}
function chanceRule(id: MissionModifierId): CampaignChanceRule {
  return campaignChanceRule(id);
}
function chanceIndex(chance: number): number {
  return CAMPAIGN_MODIFIER_CHANCES.indexOf(chance as CampaignModifierChance);
}
function rewardModeLabel(mode: CampaignRewardMode): string {
  return campaignRewardModeLabel(mode);
}
function rewardModeDesc(mode: CampaignRewardMode): string {
  return campaignRewardModeDesc(mode);
}
function tenderOfferLabel(offer: CampaignTenderOffer): string {
  return campaignTenderOfferLabel(offer);
}
/** The dial's sentence with THIS table's numbers — the one renderer of a reading with params (PL-160). */
function tenderOfferDesc(offer: CampaignTenderOffer, seats: number): string {
  const reading = campaignTenderOfferReading(offer, seats);
  return readingText({label: reading.key, params: [...reading.params]});
}
function blockerText(key: string): string {
  return automaBlockerText(key);
}
</script>
