<template>
  <!--
    Root of the premium END-OF-GAME experience. Mounted at App level (next to
    DraftFlowOverlay) so the `:key="playerkey"` remount on every server poll
    can't tear down the reveal / results overlay. Self-gates: App only mounts it
    when the viewed game has reached Phase.END. Builds the analytic model once
    from the view and drives the reveal → results → pill flow via endgameState.

    CONSOLE MODE (`consoleNative`): the console shell runs its OWN scoring
    ceremony AND its own «Обзор партии» analytics scene (both inside
    ConsoleEndgameWorkspace), so this component goes fully HEADLESS there —
    no auto reveal, no pill, and nothing in console mode opens the desktop
    results overlay any more. Its one console job is kicking off the shared
    endgame-facts fetch (endgameFactsCache).
  -->
  <div class="eg-root">
    <!-- Hidden-VP games earn the suspenseful category-by-category reveal;
         every other game keeps the instant cinematic winner reveal. -->
    <FinalScoringReveal v-if="!consoleNative && state.revealActive && hiddenVpMode" :model="model" :player-order="playerOrder" :card-resources="cardResources" />

    <EndgameWinnerReveal v-else-if="!consoleNative && state.revealActive" :model="model" />

    <!-- Desktop-only by construction: the console workspace owns its own
         «Обзор партии» scene, so the desktop overlay may never rise there. -->
    <EndgameResultsOverlay v-else-if="!consoleNative && state.resultsOpen && !state.minimized"
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
import {EndgameModel} from '@/client/components/endgame/endgameModel';
import {cardResourcesFromView, endgameModelFromView} from '@/client/components/endgame/endgameViewAdapter';
import {requestEndgameFacts, cachedEndgameFacts} from '@/client/components/endgame/endgameFactsCache';
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
  computed: {
    state() {
      return endgameState;
    },
    // Resource counts on each player's cards (for Vermin 2.0 — animals on Vermin, etc.).
    cardResources(): Partial<Record<Color, Partial<Record<CardName, number>>>> {
      return cardResourcesFromView(this.view);
    },
    model(): EndgameModel {
      // The analysis-ready facts arrive through the SHARED once-per-load
      // cache (the console endgame workspace reads the same fetch) —
      // graceful: base template analyzers until they land.
      return endgameModelFromView(this.view, cachedEndgameFacts(this.view.id));
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
  },
  mounted(): void {
    // Trigger the cinematic once, the first time an ended game is seen this
    // load — desktop only: in console mode the workspace owns the ceremony,
    // and an auto-begun reveal here would fight it for the screen.
    if (!this.consoleNative) {
      beginEndgameReveal();
    }
    requestEndgameFacts(this.view.id);
  },
});
</script>
