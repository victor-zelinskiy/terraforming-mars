<template>
  <!--
    Dev-only QA page (?effectsPlayground). Two tabs:
      • ALL EFFECTS  — mounts the real EffectsOverlay as if a player had played
        EVERY in-scope effect card at once (adaptive layout + edge-case eyeball),
        with a second mock player to exercise the read-only player context.
      • FLAGGED / NEEDS WORK — the diagnostic list of cards whose passive effect
        has NO clean render node (auto-detected: in-scope active/corp, no action,
        no effect graphic, no override) + the cards covered by a TEXT override.
        Click a card to inspect the real card fullscreen and decide a descriptor.
  -->
  <div class="effects-playground">
    <div class="effects-playground__bar">
      <span class="effects-playground__title">EFFECTS OVERLAY — PLAYGROUND</span>
      <button class="effects-playground__tab"
              :class="{'effects-playground__tab--active': tab === 'all'}"
              @click="tab = 'all'">All effects ({{ allCount }})</button>
      <button class="effects-playground__tab"
              :class="{'effects-playground__tab--active': tab === 'flagged'}"
              @click="tab = 'flagged'">Flagged / needs work ({{ flaggedCount }})</button>
    </div>

    <template v-if="tab === 'all'">
      <div class="effects-playground__bar effects-playground__bar--sub">
        <span class="effects-playground__hint">{{ allCount }} in-scope effects (Base / CorpEra / Promo / Venus / Colonies / Prelude)</span>
        <button class="effects-playground__btn" @click="open = !open">{{ open ? 'Close' : 'Open' }} overlay</button>
        <button class="effects-playground__btn" @click="togglePlayer">Switch player ({{ displayedPlayer.name }})</button>
      </div>
      <EffectsOverlay v-if="open"
                      :displayedPlayer="displayedPlayer"
                      :viewerColor="viewerColor"
                      @close="open = false" />
    </template>

    <div v-else class="effects-playground__flagged">
      <p class="effects-playground__flag-intro">
        Cards flagged during analysis: their passive effect has no clean
        <code>effect()</code> render node, so the generic scan can't surface its
        graphic. Click a card to inspect the real card and decide a descriptor.
      </p>

      <section v-if="overrideRows.length > 0" class="effects-playground__flag-section">
        <h3 class="effects-playground__flag-head">Covered via custom override ({{ overrideRows.length }})</h3>
        <div v-for="r in overrideRows"
             :key="r.name"
             class="flag-row flag-row--ok"
             @click="openCard(r.name)"
             :data-test="'flag-override-' + r.name">
          <span class="flag-row__name" v-i18n>{{ r.name }}</span>
          <span class="flag-row__meta">{{ r.kind }} · {{ r.module }}</span>
          <span class="flag-row__status flag-row__status--ok">OVERRIDE</span>
        </div>
      </section>

      <section v-if="candidateRows.length > 0" class="effects-playground__flag-section">
        <h3 class="effects-playground__flag-head">No effect graphic — review / needs descriptor ({{ candidateRows.length }})</h3>
        <div v-for="r in candidateRows"
             :key="r.name"
             class="flag-row flag-row--todo"
             @click="openCard(r.name)"
             :data-test="'flag-todo-' + r.name">
          <span class="flag-row__name" v-i18n>{{ r.name }}</span>
          <span class="flag-row__meta">{{ r.kind }} · {{ r.module }}</span>
          <span class="flag-row__status flag-row__status--todo">NO ICONS</span>
        </div>
      </section>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoom"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {MODULE_NAMES} from '@/common/cards/GameModule';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  allScopeEffectCardNames,
  overriddenEffectCards,
  flaggedEffectCandidates,
} from '@/client/components/effects/effectExtraction';
import EffectsOverlay from '@/client/components/effects/EffectsOverlay.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type FlagRow = {name: CardName, kind: string, module: string};

function mockPlayer(color: Color, name: string, tableau: ReadonlyArray<CardModel>): PublicPlayerModel {
  return {color, name, tableau} as unknown as PublicPlayerModel;
}

function rowInfo(name: CardName): FlagRow {
  const card = getCard(name);
  return {
    name,
    kind: card?.type === CardType.CORPORATION ? 'Corporation' : 'Card',
    module: card !== undefined ? MODULE_NAMES[card.module] : '',
  };
}

type DataModel = {
  tab: 'all' | 'flagged';
  open: boolean;
  selectedColor: Color;
  players: ReadonlyArray<PublicPlayerModel>;
  allCount: number;
  viewerColor: Color;
  zoomCard: CardModel | undefined;
};

export default defineComponent({
  name: 'EffectsPlayground',
  components: {EffectsOverlay, CardZoomModal},
  data(): DataModel {
    const all: ReadonlyArray<CardModel> = allScopeEffectCardNames().map((name) => ({name} as CardModel));
    const players = [
      mockPlayer('red', 'All effects', all),
      mockPlayer('blue', 'Few effects', all.slice(0, 6)),
    ];
    return {
      tab: 'all',
      open: true,
      selectedColor: 'red',
      players,
      allCount: all.length,
      viewerColor: 'red',
      zoomCard: undefined,
    };
  },
  computed: {
    displayedPlayer(): PublicPlayerModel {
      return this.players.find((p) => p.color === this.selectedColor) ?? this.players[0];
    },
    overrideRows(): ReadonlyArray<FlagRow> {
      return overriddenEffectCards().map(rowInfo);
    },
    candidateRows(): ReadonlyArray<FlagRow> {
      return flaggedEffectCandidates().map(rowInfo);
    },
    flaggedCount(): number {
      return this.overrideRows.length + this.candidateRows.length;
    },
  },
  methods: {
    togglePlayer(): void {
      this.selectedColor = this.selectedColor === 'red' ? 'blue' : 'red';
    },
    openCard(name: CardName): void {
      this.zoomCard = {name} as CardModel;
      nextTick(() => {
        (this.$refs.zoom as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
