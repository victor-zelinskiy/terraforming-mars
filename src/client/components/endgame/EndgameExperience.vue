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
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {paths} from '@/common/app/paths';
import type {EndgameFact} from '@/common/events/endgameFacts';
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
  data() {
    return {
      // The analysis-ready facts, fetched once after mount (graceful: the model uses
      // the base template analyzers until they arrive / if the fetch is unavailable).
      facts: undefined as ReadonlyArray<EndgameFact> | undefined,
    };
  },
  computed: {
    state() {
      return endgameState;
    },
    playerCards(): Partial<Record<Color, ReadonlyArray<CardName>>> {
      const out: Partial<Record<Color, ReadonlyArray<CardName>>> = {};
      for (const p of this.view.players) {
        out[p.color] = p.tableau.map((c) => c.name);
      }
      return out;
    },
    // Resource counts on each player's cards (for Vermin 2.0 — animals on Vermin, etc.).
    cardResources(): Partial<Record<Color, Partial<Record<CardName, number>>>> {
      const out: Partial<Record<Color, Partial<Record<CardName, number>>>> = {};
      for (const p of this.view.players) {
        const byCard: Partial<Record<CardName, number>> = {};
        for (const c of p.tableau) {
          if (c.resources !== undefined && c.resources > 0) {
            byCard[c.name] = c.resources;
          }
        }
        out[p.color] = byCard;
      }
      return out;
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
        facts: this.facts,
        playerCards: this.playerCards,
        cardResources: this.cardResources,
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
    // Fetch the analysis-ready facts ONCE (the server builds them from the event
    // stream). Best-effort: any failure / missing fetch leaves the base insights.
    fetchFacts(): void {
      const id = this.view.id;
      if (id === undefined || typeof fetch !== 'function') {
        return;
      }
      fetch(paths.API_GAME_ENDGAME_FACTS + '?id=' + encodeURIComponent(id))
        .then((r) => (r.ok ? r.json() : undefined))
        .then((f) => {
          if (Array.isArray(f)) {
            this.facts = f as ReadonlyArray<EndgameFact>;
          }
        })
        .catch(() => { /* the base template insights remain */ });
    },
  },
  mounted(): void {
    // Trigger the cinematic once, the first time an ended game is seen this load.
    beginEndgameReveal();
    this.fetchFacts();
  },
});
</script>
