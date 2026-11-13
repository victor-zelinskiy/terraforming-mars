<template>
  <div class="fsr-insp" :class="'fsr-cat--' + content.accent"
       @mouseenter="$emit('keep')" @mouseleave="$emit('release')">
    <div class="fsr-insp__head">
      <span class="fsr-insp__dot" aria-hidden="true"></span>
      <span class="fsr-insp__name" v-i18n>{{ content.label }}</span>
      <span v-if="content.playerName !== ''" class="fsr-insp__player">
        <span class="fsr-insp__player-dot" :class="'player_bg_color_' + content.playerColor" aria-hidden="true"></span>
        {{ content.playerName }}
      </span>
      <span v-if="content.playerName !== ''" class="fsr-insp__total">{{ signed(content.total) }}</span>
    </div>
    <div class="fsr-insp__desc" v-i18n>{{ content.description }}</div>

    <!-- Compare mode (pill hover): per-player totals for this category. -->
    <div v-if="content.playerName === ''" class="fsr-insp__compare">
      <div v-for="row in content.compare" :key="row.color" class="fsr-insp__cmp-row">
        <span class="fsr-insp__player-dot" :class="'player_bg_color_' + row.color" aria-hidden="true"></span>
        <span class="fsr-insp__cmp-name">{{ row.name }}</span>
        <span class="fsr-insp__cmp-val">{{ signed(row.value) }}</span>
      </div>
    </div>

    <template v-else>
      <!-- Sub-category breakdown (TR sub-parts / card families). -->
      <div v-if="content.subRows.length > 0" class="fsr-insp__subs">
        <div v-for="sub in content.subRows" :key="sub.key" class="fsr-insp__sub" :class="'fsr-cat--' + sub.accent">
          <span class="fsr-insp__sub-dot" aria-hidden="true"></span>
          <span class="fsr-insp__sub-label" v-i18n>{{ sub.label }}</span>
          <span class="fsr-insp__sub-val">{{ signed(sub.value) }}</span>
        </div>
      </div>

      <!-- Cards that scored — each with a hover card preview, sorted by VP desc. -->
      <div v-if="content.cards.length > 0" class="fsr-insp__cards">
        <div v-if="content.cardsLabel !== ''" class="fsr-insp__section-head" v-i18n>{{ content.cardsLabel }}</div>
        <div v-for="(c, i) in content.cards" :key="c.name + ':' + i"
             class="fsr-insp__card-row" :class="{'fsr-insp__card-row--neg': c.vp < 0}"
             @mouseenter="onCardEnter(c.name, $event)" @mouseleave="onCardLeave">
          <span class="fsr-insp__card-name" v-i18n>{{ cardLabel(c.name) }}</span>
          <span v-if="c.kindLabel !== ''" class="fsr-insp__card-kind" v-i18n>{{ c.kindLabel }}</span>
          <span v-if="c.resourcesText !== undefined" class="fsr-insp__card-res">{{ c.resourcesText }}</span>
          <span class="fsr-insp__card-vp">{{ signed(c.vp) }}</span>
        </div>
        <div v-if="content.hint !== ''" class="fsr-insp__hint" v-i18n>{{ content.hint }}</div>
      </div>

      <!-- Sources (milestones / awards / penalties / tracks). -->
      <div v-if="content.sources.length > 0" class="fsr-insp__sources">
        <div v-if="content.sourcesLabel !== ''" class="fsr-insp__section-head" v-i18n>{{ content.sourcesLabel }}</div>
        <div v-for="(s, i) in content.sources" :key="i" class="fsr-insp__src-row" :class="{'fsr-insp__src-row--neg': s.vp < 0}">
          <span class="fsr-insp__src-text">{{ s.text }}</span>
          <span class="fsr-insp__src-vp">{{ signed(s.vp) }}</span>
        </div>
      </div>
    </template>

    <CardPreviewPopover v-if="previewName !== undefined" :name="previewName" :visible="previewVisible" :anchor="previewAnchor" />
  </div>
</template>

<script setup lang="ts">
/*
 * Rich, interactive explainability panel for the final-scoring reveal. Shown
 * when a category is hovered/focused: a per-player breakdown (sub-categories,
 * the cards that scored with a hover card-preview, milestone/award/penalty
 * sources) — or a cross-player comparison when a top pill is hovered.
 *
 * Interactive: the cursor can move INTO the panel (it emits keep/release so the
 * host's close timer bridges the gap). Card rows reuse the journal's premium
 * `CardPreviewPopover` on hover — no bespoke card render.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {ref} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {FinalScoringInspectorContent} from '@/client/components/endgame/finalScoringRevealModel';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vI18n} from '@/client/directives/vDirectives';

const HOVER_DELAY = 150;

defineOptions({name: 'FinalScoringInspector'});
defineProps({
  content: {type: Object as () => FinalScoringInspectorContent, required: true},
});
defineEmits(['keep', 'release']);

const flow = useFlowScope('final-scoring-inspector');
const previewName = ref<CardName | undefined>(undefined);
const previewVisible = ref(false);
const previewAnchor = ref<DOMRect | undefined>(undefined);
let cancelHover: () => void = () => {};
function signed(v: number): string {
  return v >= 0 ? '+' + v : String(v);
}
function cardLabel(name: CardName): string {
  return name.split(':')[0];
}
function onCardEnter(name: CardName, evt: Event): void {
  const el = evt.currentTarget as HTMLElement | null;
  if (el === null || typeof el.getBoundingClientRect !== 'function') {
    return;
  }
  previewName.value = name;
  previewAnchor.value = el.getBoundingClientRect();
  clearTimer();
  cancelHover = flow.after(HOVER_DELAY, 'the card row\'s hover delay', () => {
    previewVisible.value = true;
  });
}
function onCardLeave(): void {
  clearTimer();
  previewVisible.value = false;
}
function clearTimer(): void {
  cancelHover();
}
</script>
