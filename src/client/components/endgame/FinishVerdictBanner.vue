<template>
  <div v-if="verdict !== undefined" class="eg-fv"
       :class="['eg-fv--p-' + verdict.pattern, 'eg-fv--s-' + verdict.scale, 'eg-fv--r-' + verdict.rarity]">
    <span class="eg-fv__motif" aria-hidden="true"></span>
    <span class="eg-fv__glyph" aria-hidden="true">{{ verdict.glyph }}</span>
    <div class="eg-fv__body">
      <span class="eg-fv__title-row">
        <span class="eg-fv__title" v-i18n>{{ verdict.titleKey }}</span>
        <span v-if="isRare" class="eg-fv__tier" v-i18n>{{ verdict.rarity === 'legendary' ? 'Legendary finish' : 'Rare finish' }}</span>
      </span>
      <span class="eg-fv__line"><EndgameRichText :template="lineTemplate" :params="lineParams" /></span>
      <div v-if="verdict.chips.length > 0" class="eg-fv__chips">
        <span v-for="(ch, i) in verdict.chips" :key="i" class="eg-chip" :class="'eg-chip--' + (ch.tone || 'neutral')">
          <template v-if="ch.t === 'raw'">{{ ch.v }}</template><span v-else v-i18n>{{ ch.v }}</span><span v-if="ch.label !== undefined"> <span v-i18n>{{ ch.label }}</span></span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * THE TEMPLATE (the comment that opened it — it starts with its root now):
 *
 * Iteration 17 §3 — the finish VERDICT as a visual tier banner (glyph + strong title +
 * a short rich-text line), replacing the flat hero thesis string. The accent/glyph come
 * from the verdict TYPE; the line uses the shared rich-text layer (hoverable terms).
 */
import {computed} from 'vue';
import type {FinishVerdict} from '@/client/components/endgame/finishVerdict';
import type {RichParam} from '@/client/components/endgame/endgameRichText';
import EndgameRichText from '@/client/components/endgame/EndgameRichText.vue';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'FinishVerdictBanner'});
const props = defineProps({
  verdict: {type: Object as () => FinishVerdict | undefined, required: false, default: undefined},
});

const isRare = computed((): boolean => props.verdict?.rarity === 'rare' || props.verdict?.rarity === 'legendary');
const lineTemplate = computed((): string => props.verdict !== undefined ? $t(props.verdict.line.key) : '');
const lineParams = computed((): Array<RichParam> => {
  return (props.verdict?.line.params ?? []).map((p) => ({
    text: p.t === 'raw' ? p.v : $t(p.v),
    kind: p.term?.kind,
    color: p.term?.color,
    detail: p.term?.detail,
    accent: p.term?.accent,
  }));
});
</script>
