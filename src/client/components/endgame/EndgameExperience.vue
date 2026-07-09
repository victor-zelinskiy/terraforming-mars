<template>
  <!--
    Root of the premium END-OF-GAME experience. Mounted at App level (next to
    DraftFlowOverlay) so the `:key="playerkey"` remount on every server poll
    can't tear down the reveal / results overlay. Self-gates: App only mounts it
    when the viewed game has reached Phase.END. Builds the analytic model once
    from the view and drives the reveal → results → pill flow via endgameState.
  -->
  <div class="eg-root">
    <!-- Hidden-VP games earn the suspenseful category-by-category reveal;
         every other game keeps the instant cinematic winner reveal. -->
    <FinalScoringReveal v-if="state.revealActive && hiddenVpMode" :model="model" :player-order="playerOrder" :card-resources="cardResources" />

    <EndgameWinnerReveal v-else-if="state.revealActive" :model="model" />

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
import {CardResource} from '@/common/CardResource';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import type {EndgameFact} from '@/common/events/endgameFacts';
import {getCard} from '@/client/cards/ClientCardManifest';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildEndgameModel, EndgameModel, EndgamePlayerInput} from '@/client/components/endgame/endgameModel';
import {decomposePlayerCardVp, type CardDecl} from '@/client/components/endgame/cardScoreContribution';
import type {StrategyInput, ResourceTotals} from '@/client/components/endgame/strategyArchetypes';
import {endgameState, beginEndgameReveal, restoreEndgameResults} from '@/client/components/endgame/endgameState';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import EndgameWinnerReveal from '@/client/components/endgame/EndgameWinnerReveal.vue';
import EndgameResultsOverlay from '@/client/components/endgame/EndgameResultsOverlay.vue';
import FinalScoringReveal from '@/client/components/endgame/FinalScoringReveal.vue';

export default defineComponent({
  name: 'EndgameExperience',
  components: {EndgameWinnerReveal, EndgameResultsOverlay, FinalScoringReveal},
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
          // The Automa seat localizes («Бот») — the whole endgame stack
          // (hero, reveal lanes, narrative) inherits the display name here.
          name: participantDisplayName(p),
          // The RAW server name is kept so the narrative can match the server's
          // award-funder log tokens (which use the raw name) back to a player.
          rawName: p.name,
          corporations: this.corporationsOf(p),
          megacredits: p.megacredits,
          breakdown: p.victoryPointsBreakdown,
          vpByGeneration: p.victoryPointsByGeneration ?? [],
          globalSteps: p.globalParameterSteps ?? {},
          // Iteration 11 — final-inventory + production bridge (leftover stock + profile).
          leftover: {steel: p.steel, titanium: p.titanium, heat: p.heat, plants: p.plants, energy: p.energy},
          production: {
            megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
            plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
          },
          // Rework §4–§20 — the strategy-archetype raw inputs (needs the card manifest).
          strategyInput: this.strategyInputFor(p),
        }));
      // MarsBot clock win: entering the final generation means the human lost
      // regardless of totals (Automa rules) — the bot is the forced winner.
      const automaClockWinner = game.automa?.instantWin === true ?
        this.view.players.find((p) => p.isMarsBot === true)?.color :
        undefined;
      return buildEndgameModel(inputs, {
        hasMoon: game.moon !== undefined,
        hasPathfinders: game.pathfinders !== undefined,
        hasVenus: game.gameOptions.expansions.venus === true,
        generation: game.generation,
        soloWin: game.isSoloModeWin,
        automaClockWinner,
        facts: this.facts,
        playerCards: this.playerCards,
        cardResources: this.cardResources,
      });
    },
    pillVars(): Record<string, string> {
      const hex = this.model.winner !== undefined ? endgamePlayerHex(this.model.winner.color) : '#6ab0e6';
      return {'--eg-pc': hex};
    },
    // Hidden-VP mode (an OPT-IN: the game was created with "Show real-time VP"
    // OFF, so opponents' VP were hidden all game). Only meaningful with
    // opponents to hide from, so solo is excluded. Drives the suspenseful
    // final-scoring reveal in place of the instant winner cinematic.
    hiddenVpMode(): boolean {
      return this.view.game.gameOptions.showOtherPlayersVP === false && this.view.players.length > 1;
    },
    // Neutral lane order for the reveal (seating order) so the lanes don't spoil
    // the result by ranking the winner first.
    playerOrder(): ReadonlyArray<Color> {
      return this.view.players.map((p) => p.color);
    },
  },
  methods: {
    corporationsOf(p: PublicPlayerModel): Array<string> {
      return p.tableau
        .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
        .map((card) => card.name);
    },
    // The minimal manifest declaration the VP decomposition needs (injected, keeps the
    // pure module manifest-free).
    cardDecl(name: string): CardDecl | undefined {
      const c = getCard(name as CardName);
      if (c === undefined) {
        return undefined;
      }
      return {victoryPoints: c.victoryPoints, resourceType: c.resourceType, tags: c.tags, type: c.type};
    },
    // Build the per-player strategy-archetype inputs from the view + the card manifest
    // (rework §4–§20): tag counts (already on the model), colonies owned, the best-effort
    // card-VP decomposition, and accumulated card resources by type.
    strategyInputFor(p: PublicPlayerModel): StrategyInput {
      const totals: ResourceTotals = {animals: 0, microbes: 0, floaters: 0, animalCards: 0, microbeCards: 0, floaterCards: 0};
      for (const card of p.tableau) {
        const def = getCard(card.name);
        const n = card.resources ?? 0;
        if (def?.resourceType === CardResource.ANIMAL) {
          totals.animalCards++; totals.animals += n;
        } else if (def?.resourceType === CardResource.MICROBE) {
          totals.microbeCards++; totals.microbes += n;
        } else if (def?.resourceType === CardResource.FLOATER) {
          totals.floaterCards++; totals.floaters += n;
        }
      }
      const coloniesOwned = (this.view.game.colonies ?? [])
        .filter((c) => c.colonies.includes(p.color))
        .map((c) => c.name);
      const details = p.victoryPointsBreakdown?.detailsCards ?? [];
      const {bySource, contributions} = decomposePlayerCardVp(details, this.cardResources[p.color] ?? {}, (name) => this.cardDecl(name));
      // §10 — keep the positive per-card contributions for the hover breakdown (top cards).
      const cardContributions = contributions
        .filter((c) => c.totalVp > 0)
        .map((c) => ({cardName: c.cardName, totalVp: c.totalVp, source: c.source, confidence: c.confidence}));
      return {tags: p.tags ?? {}, coloniesOwned, cardVp: bySource, resourceTotals: totals, cardContributions};
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
      fetch(apiUrl(paths.API_GAME_ENDGAME_FACTS) + '?id=' + encodeURIComponent(id))
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
