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
        <span class="mb-face__text">
          <!-- A random set's B14 line (decision R7): the AWARD this push serves, then the push itself. -->
          <b v-if="line.award !== undefined" class="mb-face__award" :data-competition-award="line.award">{{ $t(line.award) }}:</b>
          {{ lineText(line) }}
        </span>
      </div>
    </div>
    <div class="mb-face__fate-note">{{ fateText }}</div>
  </div>
</template>

<script setup lang="ts">
/**
 * One MarsBot bonus card, rendered as the player will EXPERIENCE it in THIS
 * game: icon-anchored effect lines already resolved for the current expansion
 * set (never "with Venus it does X, otherwise Y"), plus an honest FATE chip +
 * note (destroyed / discarded / recurring — including the else-branch, so a
 * "destroyed on success" card sitting in the discard is never a mystery).
 * Shared by the desktop bot-board overlay, the console bonus detail and the
 * turn-theater reveal step — one face everywhere.
 */
import {computed, PropType} from 'vue';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {BonusCardContext, BonusCardEffectLine, BonusCardView, buildBonusCardView} from '@/common/automa/BonusCardData';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

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

defineOptions({name: 'BonusCardFace'});
const props = defineProps({
  id: {type: String as PropType<BonusCardId>, required: true},
  ctx: {type: Object as PropType<BonusCardContext>, required: true},
  /** TV-readable sizing (console). */
  large: {type: Boolean, default: false},
  /** Render the "removed from the game" treatment (the destroyed pile). */
  destroyed: {type: Boolean, default: false},
});

const view = computed((): BonusCardView => {
  return buildBonusCardView(props.id, props.ctx);
});
const fateLabel = computed((): string => {
  return FATE_LABEL[view.value.fate.kind];
});
const fateGlyph = computed((): string => {
  return FATE_GLYPH[view.value.fate.kind];
});
const fateText = computed((): string => {
  return translateTextWithParams(view.value.fate.text, [...(view.value.fate.params ?? [])]);
});
const fateHint = computed((): string => {
  return fateText.value;
});
function iconClass(key: string | undefined): string {
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
}
function glyph(key: string | undefined): string {
  return key !== undefined ? (GLYPHS[key] ?? '') : '';
}
function lineText(line: BonusCardEffectLine): string {
  // A ready Message (the server's generated helper sentence) — its label params translate through the one road.
  if (line.message !== undefined) {
    return translateMessage({message: line.message.message, data: line.message.data.map((d) => ({...d}))});
  }
  if (line.params !== undefined && line.params.length > 0) {
    return translateTextWithParams(line.text, [...line.params]);
  }
  return translateText(line.text);
}
</script>
