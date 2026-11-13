<template>
  <span v-for="g in gains" :key="g.kind" class="con-resgain" :data-result-gain="g.kind">
    <span class="con-resgain__plus" aria-hidden="true">+</span>
    <BarButtonIcon class="con-resgain__icon" :name="g.icon" />
    <span class="con-resgain__label">{{ $t(g.label) }}</span>
  </span>
  <span v-if="vp !== undefined" class="con-resgain con-resgain--vp" data-result-vp
        :data-printed-vp="vp.value" :data-vp-kind="vp.kind">
    <ConsoleVpBadge class="con-resgain__badge" :label="$t('VP')" />
    <b class="con-resgain__num" :class="{'con-resgain__num--word': vp.kind === 'variable'}">{{ vp.value }}</b>
    <span v-if="vp.formula !== undefined" class="con-resgain__formula" data-vp-formula>
      <img v-if="formulaTagIcon(vp.formula) !== undefined" class="con-resgain__formula-tag"
           :src="formulaTagIcon(vp.formula)" alt="" aria-hidden="true">
      <PremiumCountGlyph v-for="(glyph, gi) in countGlyphs(vp.formula)" :key="'vg' + gi"
                         class="con-composer__rescat-vpglyph" :glyph="glyph" data-vp-glyph />
      <span>{{ formulaOperandsText(vp.formula) }}</span>
      <span v-if="shortfallText(vp.formula) !== ''" class="con-resgain__formula-short">· {{ shortfallText(vp.formula) }}</span>
    </span>
  </span>
</template>

<script setup lang="ts">
/*
 * WHAT THE PLAY ADDS BEYOND ITS RESOURCES (P81 · the owner, 2026-11-01): chips IN the result, on the result chips'
 * own chassis — «+ [знак] Эффект», «+ [знак] Действие» (the same glyphs the «Эффекты» / «Действия карт» screens
 * wear), and the VP the card scores, the shield + «+N» (a «per X» card: the number NOW, its printed formula beside it,
 * quiet; a VP the play cannot know yet: «по условию»). Never the card's graphic a second time — the face beside the
 * sheet prints it; the chip says only that the card brings it.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * The result's NON-RESOURCE gains (P81 · the owner, 2026-11-01): a new effect, a new action, the VP — chips in the
 * «РЕЗУЛЬТАТ» row, one chassis with the resource chips. Pure presentation: the host derives what the card brings
 * (`cardHasPassiveEffect` / `cardHasAction` / the result's `vp` section — the server's projection).
 */
import {PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {ScoreFormula, formulaGlyph, formulaOperandsText, formulaTagIcon, shortfallText} from '@/client/console/scoreExplorerModel';

export type ResultGain = {kind: 'effect' | 'action', icon: string, label: string};
export type ResultVp = {kind: 'fixed' | 'formula' | 'variable', value: string, formula?: ScoreFormula};

defineOptions({name: 'ConsolePlayResultGains'});
defineProps({
  gains: {type: Array as PropType<ReadonlyArray<ResultGain>>, default: () => []},
  vp: {type: Object as PropType<ResultVp | undefined>, default: undefined},
});

function countGlyphs(formula: ScoreFormula) {
  const glyph = formulaGlyph(formula);
  return glyph?.kind === 'counted' ? [glyph.glyph] : [];
}
</script>
