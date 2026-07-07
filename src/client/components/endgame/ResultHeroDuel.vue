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
          <span class="eg-rhduel__line-val">
            <ExplainableBadge v-if="winnerLineDetail !== undefined" :label="winnerSide.style" :detail="winnerLineDetail" badge-class="eg-term eg-term--strategy" markless />
            <span v-else v-i18n>{{ winnerSide.style }}</span>
          </span>
        </div>
      </article>

      <div class="eg-rhduel__center">
        <div class="eg-rhduel__vs" aria-hidden="true">VS</div>
        <!-- MarsBot clock win: the finish is RULE-decided (the game reached
             its final generation), not a score comparison — say so instead of
             a misleading VP lead / tie-break line. -->
        <div v-if="model.automaClockWin" class="eg-rhduel__margin eg-rhduel__margin--clock">
          <span class="eg-rhduel__margin-lbl" v-i18n>Won on the clock — the final generation was reached</span>
        </div>
        <div v-else-if="model.margin > 0" class="eg-rhduel__margin">
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
          <span class="eg-rhduel__line-val">
            <ExplainableBadge v-if="runnerLineDetail !== undefined" :label="runnerSide.style" :detail="runnerLineDetail" badge-class="eg-term eg-term--strategy" markless />
            <span v-else v-i18n>{{ runnerSide.style }}</span>
          </span>
        </div>
      </article>
    </div>

    <FinishVerdictBanner v-if="model.finishVerdict !== undefined" :verdict="model.finishVerdict" />
  </section>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {themeForArchetype, StrategyVisualTheme} from '@/client/components/endgame/strategyVisualThemes';
import {strategyLabel} from '@/client/components/endgame/strategyArchetypes';
import {buildStrategyTermDetail, type ChipDetail} from '@/client/components/endgame/insightDetail';
import ExplainableBadge from '@/client/components/endgame/ExplainableBadge.vue';
import FinishVerdictBanner from '@/client/components/endgame/FinishVerdictBanner.vue';

type DuelSide = EndgamePlayerScore & {style?: string};

export default defineComponent({
  name: 'ResultHeroDuel',
  components: {ExplainableBadge, FinishVerdictBanner},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
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
    // §4/§5 — the "Main line" / "Answer" terms are hoverable (same detail as the story).
    winnerLineDetail(): ChipDetail | undefined {
      return this.lineDetail(this.winnerSide);
    },
    runnerLineDetail(): ChipDetail | undefined {
      return this.lineDetail(this.runnerSide);
    },
  },
  methods: {
    lineDetail(side: DuelSide): ChipDetail | undefined {
      const archetype = side.strategyProfile?.primary?.archetype;
      return archetype !== undefined ? buildStrategyTermDetail(this.model.players, side.color, archetype) : undefined;
    },
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
