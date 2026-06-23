<template>
  <!--
    Rework §2.2 — the 3+ player result block. Winner large; a compact top-3 leaderboard;
    the margin to second place; a short thesis (the Story DNA headline). No duel composition
    (it doesn't scale), no category bars (§1).
  -->
  <section class="eg-rhmulti" :class="'eg-theme--' + theme.motif" :style="{'--eg-theme': theme.accent}">
    <span class="eg-rhmulti__motif eg-motif" aria-hidden="true"></span>
    <div class="eg-rhmulti__head">
      <div v-if="winner !== undefined" class="eg-rhmulti__winner" :style="{'--eg-pc': hex(winner.color)}">
        <div class="eg-rhmulti__crown" aria-hidden="true">♛</div>
        <div class="eg-rhmulti__wname">
          <span class="eg-rhmulti__dot" :class="'player_bg_color_' + winner.color"></span>
          <span class="eg-rhmulti__name">{{ winner.name }}</span>
          <span v-if="isViewer(winner.color)" class="eg-rhmulti__you" v-i18n>You</span>
        </div>
        <div v-if="corp(winner) !== ''" class="eg-rhmulti__corp" v-i18n>{{ corp(winner) }}</div>
        <div class="eg-rhmulti__total">{{ winner.total }}<span class="eg-rhmulti__unit" v-i18n>VP</span></div>
        <div v-if="model.margin > 0" class="eg-rhmulti__lead">
          <span class="eg-rhmulti__lead-val">+{{ model.margin }}</span>
          <span class="eg-rhmulti__lead-lbl" v-i18n>ahead of second place</span>
        </div>
        <div v-else class="eg-rhmulti__lead eg-rhmulti__lead--tie" v-i18n>Decided on M€</div>
      </div>

      <ol class="eg-rhmulti__board">
        <li v-for="p in top3" :key="p.color" class="eg-rhmulti__row"
            :class="{'eg-rhmulti__row--winner': p.isWinner, 'eg-rhmulti__row--you': isViewer(p.color)}"
            :style="{'--eg-pc': hex(p.color)}">
          <span class="eg-rhmulti__place">{{ p.place }}</span>
          <span class="eg-rhmulti__rdot" :class="'player_bg_color_' + p.color"></span>
          <span class="eg-rhmulti__rname">{{ p.name }}</span>
          <span v-if="p.style !== undefined" class="eg-rhmulti__rstyle" v-i18n>{{ p.style }}</span>
          <span class="eg-rhmulti__rtotal">{{ p.total }}<span class="eg-rhmulti__unit" v-i18n>VP</span></span>
        </li>
      </ol>
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
import FinishVerdictBanner from '@/client/components/endgame/FinishVerdictBanner.vue';

type BoardRow = EndgamePlayerScore & {style?: string};

export default defineComponent({
  name: 'ResultHeroMultiplayer',
  components: {FinishVerdictBanner},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  computed: {
    winner(): EndgamePlayerScore | undefined {
      return this.model.winner;
    },
    top3(): Array<BoardRow> {
      return this.model.players.slice(0, 3).map((p) => ({...p, style: this.styleOf(p)}));
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
