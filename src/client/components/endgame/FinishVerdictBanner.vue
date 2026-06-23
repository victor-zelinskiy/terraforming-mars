<template>
  <!--
    Iteration 17 §3 — the finish VERDICT as a visual tier banner (glyph + strong title +
    a short rich-text line), replacing the flat hero thesis string. The accent/glyph come
    from the verdict TYPE; the line uses the shared rich-text layer (hoverable terms).
  -->
  <div v-if="verdict !== undefined" class="eg-fv" :class="['eg-fv--' + verdict.type, 'eg-fv--tier-' + verdict.tier]">
    <span class="eg-fv__motif" aria-hidden="true"></span>
    <span class="eg-fv__glyph" aria-hidden="true">{{ verdict.glyph }}</span>
    <div class="eg-fv__body">
      <span class="eg-fv__title-row">
        <span class="eg-fv__title" v-i18n>{{ verdict.titleKey }}</span>
        <span v-if="verdict.tier === 'rare' || verdict.tier === 'legendary'" class="eg-fv__tier" v-i18n>Rare finish</span>
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

<script lang="ts">
import {defineComponent} from 'vue';
import type {FinishVerdict} from '@/client/components/endgame/finishVerdict';
import type {RichParam} from '@/client/components/endgame/endgameRichText';
import EndgameRichText from '@/client/components/endgame/EndgameRichText.vue';
import {$t} from '@/client/directives/i18n';

export default defineComponent({
  name: 'FinishVerdictBanner',
  components: {EndgameRichText},
  props: {
    verdict: {type: Object as () => FinishVerdict | undefined, required: false, default: undefined},
  },
  computed: {
    lineTemplate(): string {
      return this.verdict !== undefined ? $t(this.verdict.line.key) : '';
    },
    lineParams(): Array<RichParam> {
      return (this.verdict?.line.params ?? []).map((p) => ({
        text: p.t === 'raw' ? p.v : $t(p.v),
        kind: p.term?.kind,
        color: p.term?.color,
        detail: p.term?.detail,
        accent: p.term?.accent,
      }));
    },
  },
});
</script>
