<template>
  <!--
    Dev-only QA page (?effectsPlayground). Mounts the real EffectsOverlay as if a
    player had played EVERY in-scope effect card + corporation at once, so the
    adaptive layout + edge cases can be eyeballed in one shot. A second mock
    player with a small subset exercises the in-overlay player switcher.
  -->
  <div class="effects-playground">
    <div class="effects-playground__bar">
      <span class="effects-playground__title">EFFECTS OVERLAY — PLAYGROUND</span>
      <span class="effects-playground__hint">{{ allCount }} in-scope effects (Base / CorpEra / Promo / Venus / Colonies / Prelude)</span>
      <button class="effects-playground__btn" @click="open = !open">{{ open ? 'Close' : 'Open' }} overlay</button>
      <button class="effects-playground__btn" @click="togglePlayer">Switch player ({{ displayedPlayer.name }})</button>
    </div>

    <EffectsOverlay v-if="open"
                    :displayedPlayer="displayedPlayer"
                    :viewerColor="viewerColor"
                    @close="open = false" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {allScopeEffectCardNames} from '@/client/components/effects/effectExtraction';
import EffectsOverlay from '@/client/components/effects/EffectsOverlay.vue';

// Minimal stand-in — EffectsOverlay only reads color / name / tableau.
function mockPlayer(color: Color, name: string, tableau: ReadonlyArray<CardModel>): PublicPlayerModel {
  return {color, name, tableau} as unknown as PublicPlayerModel;
}

type DataModel = {
  open: boolean;
  selectedColor: Color;
  players: ReadonlyArray<PublicPlayerModel>;
  allCount: number;
  viewerColor: Color;
};

export default defineComponent({
  name: 'EffectsPlayground',
  components: {EffectsOverlay},
  data(): DataModel {
    const all: ReadonlyArray<CardModel> = allScopeEffectCardNames().map((name) => ({name} as CardModel));
    const players = [
      mockPlayer('red', 'All effects', all),
      mockPlayer('blue', 'Few effects', all.slice(0, 6)),
    ];
    return {
      open: true,
      selectedColor: 'red',
      players,
      allCount: all.length,
      viewerColor: 'red',
    };
  },
  computed: {
    displayedPlayer(): PublicPlayerModel {
      return this.players.find((p) => p.color === this.selectedColor) ?? this.players[0];
    },
  },
  methods: {
    togglePlayer(): void {
      this.selectedColor = this.selectedColor === 'red' ? 'blue' : 'red';
    },
  },
});
</script>
