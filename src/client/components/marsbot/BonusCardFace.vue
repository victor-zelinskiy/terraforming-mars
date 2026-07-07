<template>
  <div class="mb-face" :class="{'mb-face--large': large, 'mb-face--destroyed': destroyed}">
    <header class="mb-face__head">
      <span class="mb-face__name">{{ $t(view.name) }}</span>
      <span class="mb-face__fate" :class="'mb-face__fate--' + view.fate.kind" :data-hint="fateHint">
        <span class="mb-face__fate-glyph" aria-hidden="true">{{ fateGlyph }}</span>
        <span v-i18n>{{ fateLabel }}</span>
      </span>
    </header>
    <div class="mb-face__lines">
      <div v-for="(line, i) in view.lines" :key="i" class="mb-face__line" :class="{'mb-face__line--muted': line.muted}">
        <span class="mb-face__icon-slot" aria-hidden="true">
          <i v-if="iconClass(line.icon) !== ''" class="mb-face__icon" :class="iconClass(line.icon)"></i>
          <span v-else-if="glyph(line.icon) !== ''" class="mb-face__glyph">{{ glyph(line.icon) }}</span>
        </span>
        <span class="mb-face__text">{{ lineText(line) }}</span>
      </div>
    </div>
    <div class="mb-face__fate-note">{{ fateText }}</div>
  </div>
</template>

<script lang="ts">
/**
 * One MarsBot bonus card, rendered as the player will EXPERIENCE it in THIS
 * game: icon-anchored effect lines already resolved for the current expansion
 * set (never "with Venus it does X, otherwise Y"), plus an honest FATE chip +
 * note (destroyed / discarded / recurring — including the else-branch, so a
 * "destroyed on success" card sitting in the discard is never a mystery).
 * Shared by the desktop bot-board overlay, the console bonus detail and the
 * turn-theater reveal step — one face everywhere.
 */
import {defineComponent, PropType} from 'vue';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BonusCardContext, BonusCardEffectLine, BonusCardView, buildBonusCardView} from '@/common/automa/BonusCardData';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/** MarsBot-specific icon keys the shared vocabulary doesn't cover. */
const OWN_ICONS: Record<string, string> = {
  city: 'mb-ico mb-ico--city',
  greenery: 'mb-ico mb-ico--greenery',
  ocean: 'mb-ico mb-ico--ocean',
  temperature: 'mb-ico mb-ico--temperature',
  venus: 'mb-ico mb-ico--venus',
  floater: 'mb-ico mb-ico--floater',
};

/** Concept glyphs with no sprite (kept sober — one symbol, tinted by CSS). */
const GLYPHS: Record<string, string> = {
  milestone: '🏆',
  award: '🏅',
  vp: '★',
  neural: '◈',
  deck: '▤',
  colony: '◉',
  trade: '⇄',
  animal: '◆',
};

const FATE_LABEL: Record<BonusCardView['fate']['kind'], string> = {
  'discard': 'To the discard',
  'destroyOnSuccess': 'Destroyed on success',
  'alwaysDestroy': 'Destroyed',
  'recurring': 'Every generation',
  'conditional': 'Destroyed conditionally',
};

const FATE_GLYPH: Record<BonusCardView['fate']['kind'], string> = {
  'discard': '↩',
  'destroyOnSuccess': '◈',
  'alwaysDestroy': '✕',
  'recurring': '⟳',
  'conditional': '◈',
};

export default defineComponent({
  name: 'BonusCardFace',
  props: {
    id: {type: String as PropType<BonusCardId>, required: true},
    ctx: {type: Object as PropType<BonusCardContext>, required: true},
    /** TV-readable sizing (console). */
    large: {type: Boolean, default: false},
    /** Render the "removed from the game" treatment (the destroyed pile). */
    destroyed: {type: Boolean, default: false},
  },
  computed: {
    view(): BonusCardView {
      return buildBonusCardView(this.id, this.ctx);
    },
    fateLabel(): string {
      return FATE_LABEL[this.view.fate.kind];
    },
    fateGlyph(): string {
      return FATE_GLYPH[this.view.fate.kind];
    },
    fateText(): string {
      return translateTextWithParams(this.view.fate.text, [...(this.view.fate.params ?? [])]);
    },
    fateHint(): string {
      return this.fateText;
    },
  },
  methods: {
    iconClass(key: string | undefined): string {
      if (key === undefined) {
        return '';
      }
      if (OWN_ICONS[key] !== undefined) {
        return OWN_ICONS[key];
      }
      if (GLYPHS[key] !== undefined) {
        return '';
      }
      return iconClassFor(key);
    },
    glyph(key: string | undefined): string {
      return key !== undefined ? (GLYPHS[key] ?? '') : '';
    },
    lineText(line: BonusCardEffectLine): string {
      if (line.params !== undefined && line.params.length > 0) {
        return translateTextWithParams(line.text, [...line.params]);
      }
      return translateText(line.text);
    },
  },
});
</script>
