<template>
  <!--
    Root of the premium END-OF-GAME experience. Mounted at App level (next to
    DraftFlowOverlay) so the `:key="playerkey"` remount on every server poll
    can't tear down the reveal / results overlay. Self-gates: App only mounts it
    when the viewed game has reached Phase.END. Builds the analytic model once
    from the view and drives the reveal → results → pill flow via endgameState.

    CONSOLE MODE (`consoleNative`): the console shell runs its OWN scoring
    ceremony (ConsoleEndgameWorkspace), so this component becomes a headless
    OVERLAY HOST — it never auto-plays a reveal, never renders the pill, and
    only mounts the detailed results overlay when the console's «Обзор партии»
    action opened it (restoreEndgameResults). Closing/minimizing the overlay
    simply returns to the console workspace underneath.
  -->
  <div class="eg-root">
    <!-- Hidden-VP games earn the suspenseful category-by-category reveal;
         every other game keeps the instant cinematic winner reveal. -->
    <FinalScoringReveal v-if="!consoleNative && state.revealActive && hiddenVpMode" :model="model" :player-order="playerOrder" :card-resources="cardResources" />

    <EndgameWinnerReveal v-else-if="!consoleNative && state.revealActive" :model="model" />

    <EndgameResultsOverlay v-else-if="state.resultsOpen && !state.minimized"
                           :model="model" :view="view" :viewer-color="viewerColor" />

    <button v-else-if="!consoleNative" type="button" class="eg-pill" :style="pillVars" @click="restore">
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
import {ViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import type {EndgameFact} from '@/common/events/endgameFacts';
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {cardResourcesFromView, endgameModelFromView} from '@/client/components/endgame/endgameViewAdapter';
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
    /** The console shell owns the scoring ceremony — this component is only
     *  the detailed-overlay host there (no reveal, no pill). */
    consoleNative: {type: Boolean, required: false, default: false},
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
    // Resource counts on each player's cards (for Vermin 2.0 — animals on Vermin, etc.).
    cardResources(): Partial<Record<Color, Partial<Record<CardName, number>>>> {
      return cardResourcesFromView(this.view);
    },
    model(): EndgameModel {
      return endgameModelFromView(this.view, this.facts);
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
    // Trigger the cinematic once, the first time an ended game is seen this
    // load — desktop only: in console mode the workspace owns the ceremony,
    // and an auto-begun reveal here would fight it for the screen.
    if (!this.consoleNative) {
      beginEndgameReveal();
    }
    this.fetchFacts();
  },
});
</script>
