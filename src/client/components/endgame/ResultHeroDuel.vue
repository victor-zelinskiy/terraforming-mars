<template>
  <!--
    Rework §2.1 — the DUEL result block. Both players read as equal participants in a
    head-to-head; the MARGIN is the central focal element; the winner is crowned + glows,
    the runner-up keeps a calm second state. Corporations are shown. A short thesis (the
    Story DNA headline) sits underneath. No category bars (§1).
  -->
  <section class="eg-rhduel" :class="'eg-theme--' + theme.motif" :style="{'--eg-theme': theme.accent}">
    <span class="eg-rhduel__motif eg-motif" aria-hidden="true"></span>
    <div class="eg-rhduel__row">
      <article v-for="(p, side) in sides" :key="p.color"
               class="eg-rhduel__player"
               :class="['eg-rhduel__player--' + (side === 0 ? 'left' : 'right'), {'eg-rhduel__player--winner': p.isWinner}]"
               :style="{'--eg-pc': hex(p.color)}">
        <div v-if="p.isWinner" class="eg-rhduel__crown" aria-hidden="true">♛</div>
        <div class="eg-rhduel__pname">
          <span class="eg-rhduel__dot" :class="'player_bg_color_' + p.color"></span>
          <span class="eg-rhduel__name">{{ p.name }}</span>
          <span v-if="isViewer(p.color)" class="eg-rhduel__you" v-i18n>You</span>
        </div>
        <div v-if="corp(p) !== ''" class="eg-rhduel__corp" v-i18n>{{ corp(p) }}</div>
        <div class="eg-rhduel__total">{{ p.total }}<span class="eg-rhduel__unit" v-i18n>VP</span></div>
        <div v-if="p.style !== undefined" class="eg-rhduel__style">
          <span class="eg-rhduel__style-dot" aria-hidden="true"></span>
          <span v-i18n>{{ p.style }}</span>
        </div>
      </article>

      <div class="eg-rhduel__center">
        <div class="eg-rhduel__vs" aria-hidden="true">VS</div>
        <div v-if="model.margin > 0" class="eg-rhduel__margin">
          <span class="eg-rhduel__margin-val">+{{ model.margin }}</span>
          <span class="eg-rhduel__margin-lbl" v-i18n>Lead</span>
        </div>
        <div v-else class="eg-rhduel__margin eg-rhduel__margin--tie">
          <span class="eg-rhduel__margin-lbl" v-i18n>Decided on M€</span>
        </div>
      </div>
    </div>

    <p v-if="thesis !== ''" class="eg-rhduel__thesis">{{ thesis }}</p>
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {themeForArchetype, StrategyVisualTheme} from '@/client/components/endgame/strategyVisualThemes';
import {strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {$t} from '@/client/directives/i18n';

type DuelSide = EndgamePlayerScore & {style?: string};

export default defineComponent({
  name: 'ResultHeroDuel',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  computed: {
    // Winner on the LEFT for a stable, readable head-to-head.
    sides(): Array<DuelSide> {
      const [a, b] = this.model.players;
      const ordered = a.isWinner ? [a, b] : [b, a];
      return ordered.map((p) => ({...p, style: this.styleOf(p)}));
    },
    theme(): StrategyVisualTheme {
      return themeForArchetype(this.model.winner?.strategyProfile?.primary?.archetype);
    },
    thesis(): string {
      const dna = this.model.storyDna;
      return dna !== undefined ? $t(dna.headlineKey) : '';
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    isViewer(color: Color): boolean {
      return this.viewerColor === color;
    },
    corp(p: EndgamePlayerScore): string {
      return p.corporations.join(' / ');
    },
    styleOf(p: EndgamePlayerScore): string | undefined {
      const prim = p.strategyProfile?.primary;
      return prim !== undefined ? strategyLabel(prim.archetype) : undefined;
    },
  },
});
</script>
