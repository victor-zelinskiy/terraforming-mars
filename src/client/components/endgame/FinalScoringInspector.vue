<template>
  <!--
    Rich, interactive explainability panel for the final-scoring reveal. Shown
    when a category is hovered/focused: a per-player breakdown (sub-categories,
    the cards that scored with a hover card-preview, milestone/award/penalty
    sources) — or a cross-player comparison when a top pill is hovered.

    Interactive: the cursor can move INTO the panel (it emits keep/release so the
    host's close timer bridges the gap). Card rows reuse the journal's premium
    `CardPreviewPopover` on hover — no bespoke card render.
  -->
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
        <div class="fsr-insp__section-head" v-i18n>{{ content.cardsLabel }}</div>
        <div v-for="(c, i) in content.cards" :key="c.name + ':' + i"
             class="fsr-insp__card-row" :class="{'fsr-insp__card-row--neg': c.vp < 0}"
             @mouseenter="onCardEnter(c.name, $event)" @mouseleave="onCardLeave">
          <span class="fsr-insp__card-name" v-i18n>{{ cardLabel(c.name) }}</span>
          <span class="fsr-insp__card-kind" v-i18n>{{ c.kindLabel }}</span>
          <span v-if="c.resourcesText !== undefined" class="fsr-insp__card-res">{{ c.resourcesText }}</span>
          <span class="fsr-insp__card-vp">{{ signed(c.vp) }}</span>
        </div>
        <div v-if="content.hint !== ''" class="fsr-insp__hint" v-i18n>{{ content.hint }}</div>
      </div>

      <!-- Sources (milestones / awards / penalties / tracks). -->
      <div v-if="content.sources.length > 0" class="fsr-insp__sources">
        <div class="fsr-insp__section-head" v-i18n>{{ content.sourcesLabel }}</div>
        <div v-for="(s, i) in content.sources" :key="i" class="fsr-insp__src-row" :class="{'fsr-insp__src-row--neg': s.vp < 0}">
          <span class="fsr-insp__src-text">{{ s.text }}</span>
          <span class="fsr-insp__src-vp">{{ signed(s.vp) }}</span>
        </div>
      </div>
    </template>

    <CardPreviewPopover v-if="previewName !== undefined" :name="previewName" :visible="previewVisible" :anchor="previewAnchor" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {FinalScoringInspectorContent} from '@/client/components/endgame/finalScoringRevealModel';
import CardPreviewPopover from '@/client/components/journal/CardPreviewPopover.vue';

const HOVER_DELAY = 150;

export default defineComponent({
  name: 'FinalScoringInspector',
  components: {CardPreviewPopover},
  props: {
    content: {type: Object as () => FinalScoringInspectorContent, required: true},
  },
  emits: ['keep', 'release'],
  data() {
    return {
      previewName: undefined as CardName | undefined,
      previewVisible: false,
      previewAnchor: undefined as DOMRect | undefined,
      hoverTimer: undefined as number | undefined,
    };
  },
  methods: {
    signed(v: number): string {
      return v >= 0 ? '+' + v : String(v);
    },
    cardLabel(name: CardName): string {
      return name.split(':')[0];
    },
    onCardEnter(name: CardName, evt: Event): void {
      const el = evt.currentTarget as HTMLElement | null;
      if (el === null || typeof el.getBoundingClientRect !== 'function') {
        return;
      }
      this.previewName = name;
      this.previewAnchor = el.getBoundingClientRect();
      this.clearTimer();
      this.hoverTimer = window.setTimeout(() => {
        this.previewVisible = true;
      }, HOVER_DELAY);
    },
    onCardLeave(): void {
      this.clearTimer();
      this.previewVisible = false;
    },
    clearTimer(): void {
      if (this.hoverTimer !== undefined) {
        window.clearTimeout(this.hoverTimer);
        this.hoverTimer = undefined;
      }
    },
  },
  beforeUnmount(): void {
    this.clearTimer();
  },
});
</script>
