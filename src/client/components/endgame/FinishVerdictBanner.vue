<template>
  <!--
    Iteration 17 §3 — the finish VERDICT as a visual tier banner (glyph + strong title +
    a short rich-text line), replacing the flat hero thesis string. The accent/glyph come
    from the verdict TYPE; the line uses the shared rich-text layer (hoverable terms).
  -->
  <div v-if="verdict !== undefined" class="eg-fv" :class="'eg-fv--' + verdict.type">
    <span class="eg-fv__glyph" aria-hidden="true">{{ verdict.glyph }}</span>
    <div class="eg-fv__body">
      <span class="eg-fv__title" v-i18n>{{ verdict.titleKey }}</span>
      <span class="eg-fv__line"><EndgameRichText :template="lineTemplate" :params="lineParams" /></span>
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
