<template>
  <!--
    Console rich-sentence renderer — the endgame narrative voice in console
    dress. Walks the SAME structural tokens the desktop story uses
    (buildNarrativeTokens over a translated template + typed params): player
    names in their colour, strategy/card terms in a calm accent, score numbers
    emphasised. NO hover popovers — console detail is focus-driven, and a
    sentence must read complete on its own from the couch.
  -->
  <span class="con-ovrich">
    <template v-for="(tok, i) in tokens" :key="i">
      <template v-if="tok.type === 'text'">{{ tok.text }}</template>
      <span v-else
            class="con-ovrich__term"
            :class="['con-ovrich__term--' + tok.kind, {'con-ovrich__term--accent': tok.accent}]"
            :style="tok.color !== undefined ? {'--ov-pc': hex(tok.color)} : {}">{{ tok.text }}</span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {buildNarrativeTokens, NarrativeToken, RichParam} from '@/client/components/endgame/endgameRichText';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {$t} from '@/client/directives/i18n';
import type {OvSentence} from '@/client/console/endgame/consoleOverviewModel';

export default defineComponent({
  name: 'ConsoleOvRich',
  props: {
    sentence: {type: Object as PropType<OvSentence>, required: true},
  },
  computed: {
    tokens(): Array<NarrativeToken> {
      const params: Array<RichParam> = this.sentence.params.map((p) => ({
        text: p.t === 'raw' ? p.v : $t(p.v),
        kind: p.term?.kind,
        color: p.term?.color,
        accent: p.term?.accent,
      }));
      return buildNarrativeTokens($t(this.sentence.key), params);
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
  },
});
</script>
