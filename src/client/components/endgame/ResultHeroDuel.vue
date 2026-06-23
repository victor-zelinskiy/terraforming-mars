<template>
  <!--
    Rework §2.1 — the DUEL result block. Both players read as equal participants in a
    head-to-head; the MARGIN is the central focal element; the winner is crowned + glows,
    the runner-up keeps a calm second state. Corporations are shown. A short thesis (the
    Story DNA headline) sits underneath. No category bars (§1).
  -->
  <section class="eg-rhduel" :class="'eg-theme--' + theme.motif" :style="{'--eg-theme': theme.accent}">
    <span class="eg-rhduel__motif eg-motif" aria-hidden="true"></span>
    <!-- §1 — a true head-to-head: winner | CENTRAL margin | runner-up. -->
    <div class="eg-rhduel__row">
      <article class="eg-rhduel__player eg-rhduel__player--left eg-rhduel__player--winner"
               :style="{'--eg-pc': hex(winnerSide.color)}">
        <div class="eg-rhduel__crown" aria-hidden="true">♛</div>
        <div class="eg-rhduel__pname">
          <span class="eg-rhduel__dot" :class="'player_bg_color_' + winnerSide.color"></span>
          <span class="eg-rhduel__name">{{ winnerSide.name }}</span>
          <span v-if="isViewer(winnerSide.color)" class="eg-rhduel__you" v-i18n>You</span>
        </div>
        <div v-if="corp(winnerSide) !== ''" class="eg-rhduel__corp" v-i18n>{{ corp(winnerSide) }}</div>
        <div class="eg-rhduel__total">{{ winnerSide.total }}<span class="eg-rhduel__unit" v-i18n>VP</span></div>
        <div v-if="winnerSide.style !== undefined" class="eg-rhduel__line">
          <span class="eg-rhduel__line-lbl" v-i18n>Main line</span>
          <span class="eg-rhduel__line-val" v-i18n>{{ winnerSide.style }}</span>
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

      <article class="eg-rhduel__player eg-rhduel__player--right"
               :style="{'--eg-pc': hex(runnerSide.color)}">
        <div class="eg-rhduel__pname">
          <span class="eg-rhduel__dot" :class="'player_bg_color_' + runnerSide.color"></span>
          <span class="eg-rhduel__name">{{ runnerSide.name }}</span>
          <span v-if="isViewer(runnerSide.color)" class="eg-rhduel__you" v-i18n>You</span>
        </div>
        <div v-if="corp(runnerSide) !== ''" class="eg-rhduel__corp" v-i18n>{{ corp(runnerSide) }}</div>
        <div class="eg-rhduel__total">{{ runnerSide.total }}<span class="eg-rhduel__unit" v-i18n>VP</span></div>
        <div v-if="runnerSide.style !== undefined" class="eg-rhduel__line">
          <span class="eg-rhduel__line-lbl" v-i18n>Answer</span>
          <span class="eg-rhduel__line-val" v-i18n>{{ runnerSide.style }}</span>
        </div>
      </article>
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

type DuelSide = EndgamePlayerScore & {style?: string};

export default defineComponent({
  name: 'ResultHeroDuel',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
    // Iteration 15 — the impact-correct hero thesis (composed upstream, already translated).
    thesis: {type: String, required: false, default: ''},
  },
  computed: {
    // Winner on the LEFT, runner-up on the RIGHT, the margin between them (§1).
    sides(): Array<DuelSide> {
      const [a, b] = this.model.players;
      const ordered = a.isWinner ? [a, b] : [b, a];
      return ordered.map((p) => ({...p, style: this.styleOf(p)}));
    },
    winnerSide(): DuelSide {
      return this.sides[0];
    },
    runnerSide(): DuelSide {
      return this.sides[1];
    },
    theme(): StrategyVisualTheme {
      return themeForArchetype(this.model.winner?.strategyProfile?.primary?.archetype);
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
