<template>
  <!--
    Root of the premium END-OF-GAME experience. Mounted at App level (next to
    DraftFlowOverlay) so the `:key="playerkey"` remount on every server poll
    can't tear down the reveal / results overlay. Self-gates: App only mounts it
    when the viewed game has reached Phase.END. Builds the analytic model once
    from the view and drives the reveal → results → pill flow via endgameState.
  -->
  <div class="eg-root">
    <EndgameWinnerReveal v-if="state.revealActive" :model="model" />

    <EndgameResultsOverlay v-else-if="state.resultsOpen && !state.minimized"
                           :model="model" :view="view" :viewer-color="viewerColor" />

    <button v-else type="button" class="eg-pill" :style="pillVars" @click="restore">
      <span class="eg-pill__pulse" aria-hidden="true"></span>
      <span class="eg-pill__label" v-i18n>Game results</span>
      <span v-if="model.winner !== undefined" class="eg-pill__winner">
        <span class="eg-pill__dot" :class="'player_bg_color_' + model.winner.color"></span>
        {{ model.winner.name }} · {{ model.winner.total }}<span v-i18n>VP</span>
      </span>
      <span class="eg-pill__expand" aria-hidden="true">⤢</span>
    </button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildEndgameModel, EndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {endgameState, beginEndgameReveal, restoreEndgameResults} from '@/client/components/endgame/endgameState';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import EndgameWinnerReveal from '@/client/components/endgame/EndgameWinnerReveal.vue';
import EndgameResultsOverlay from '@/client/components/endgame/EndgameResultsOverlay.vue';

export default defineComponent({
  name: 'EndgameExperience',
  components: {EndgameWinnerReveal, EndgameResultsOverlay},
  props: {
    view: {type: Object as () => ViewModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  computed: {
    state() {
      return endgameState;
    },
    model(): EndgameModel {
      const game = this.view.game;
      const inputs: Array<EndgamePlayerInput> = this.view.players
        .filter((p) => p.victoryPointsBreakdown !== undefined)
        .map((p) => ({
          color: p.color,
          name: p.name,
          corporations: this.corporationsOf(p),
          megacredits: p.megacredits,
          breakdown: p.victoryPointsBreakdown,
          vpByGeneration: p.victoryPointsByGeneration ?? [],
          globalSteps: p.globalParameterSteps ?? {},
        }));
      return buildEndgameModel(inputs, {
        hasMoon: game.moon !== undefined,
        hasPathfinders: game.pathfinders !== undefined,
        hasVenus: game.gameOptions.expansions.venus === true,
        generation: game.generation,
        soloWin: game.isSoloModeWin,
      });
    },
    pillVars(): Record<string, string> {
      const hex = this.model.winner !== undefined ? endgamePlayerHex(this.model.winner.color) : '#6ab0e6';
      return {'--eg-pc': hex};
    },
  },
  methods: {
    corporationsOf(p: PublicPlayerModel): Array<string> {
      return p.tableau
        .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
        .map((card) => card.name);
    },
    restore(): void {
      restoreEndgameResults();
    },
  },
  mounted(): void {
    // Trigger the cinematic once, the first time an ended game is seen this load.
    beginEndgameReveal();
  },
});
</script>
