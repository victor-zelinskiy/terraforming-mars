<template>
  <!--
    Iteration 17 §4 — the unified inline rich-text renderer. Walks structural tokens
    (from buildNarrativeTokens) and renders plain runs + interactive TERMS: player names
    in colour, hoverable strategy/card terms (reusing ExplainableBadge's accessible
    popover), and accented numbers. No v-html, no prose parsing.
  -->
  <span class="eg-richtext">
    <template v-for="(tok, i) in tokens" :key="i">
      <template v-if="tok.type === 'text'">{{ tok.text }}</template>
      <ExplainableBadge
        v-else-if="tok.detail !== undefined"
        :label="tok.text"
        :detail="tok.detail"
        :badge-class="'eg-term eg-term--' + tok.kind"
        :style="tok.color !== undefined ? {'--eg-pc': hex(tok.color)} : {}" />
      <span
        v-else
        class="eg-term"
        :class="['eg-term--' + tok.kind, {'eg-term--accent': tok.accent}]"
        :style="tok.color !== undefined ? {'--eg-pc': hex(tok.color)} : {}">{{ tok.text }}</span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {buildNarrativeTokens, RichParam, NarrativeToken} from '@/client/components/endgame/endgameRichText';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import ExplainableBadge from '@/client/components/endgame/ExplainableBadge.vue';

export default defineComponent({
  name: 'EndgameRichText',
  components: {ExplainableBadge},
  props: {
    // The already-translated i18n template (with ${n} placeholders).
    template: {type: String, required: true},
    // The already-translated render params (some carrying interactive term metadata).
    params: {type: Array as () => ReadonlyArray<RichParam>, required: true},
  },
  computed: {
    tokens(): Array<NarrativeToken> {
      return buildNarrativeTokens(this.template, this.params);
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
  },
});
</script>
