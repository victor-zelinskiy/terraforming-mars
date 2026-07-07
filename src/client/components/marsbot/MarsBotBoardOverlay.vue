<template>
  <div class="mb-board-overlay">
    <span class="mb-board-overlay__corner mb-board-overlay__corner--tl" aria-hidden="true"></span>
    <span class="mb-board-overlay__corner mb-board-overlay__corner--tr" aria-hidden="true"></span>

    <header class="mb-board__head">
      <span class="mb-board__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <h2 class="mb-board__title" v-i18n>MarsBot board</h2>
      <span class="mb-board__difficulty" :class="'mb-panel__difficulty--' + automa.difficulty" v-i18n>{{ difficultyLabel }}</span>
      <span class="mb-board__spacer"></span>
      <button type="button" class="mb-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <div class="mb-board__scroll">
      <!-- The card being resolved right now (a mid-turn human sub-prompt). -->
      <section v-if="automa.revealedCard !== undefined" class="mb-board__section mb-board__section--revealed">
        <h3 class="mb-board__label" v-i18n>Being resolved now</h3>
        <div class="mb-board__revealed">
          <template v-if="automa.revealedCard.kind === 'project'">
            <Card :card="{name: automa.revealedCard.name}" :key="automa.revealedCard.name" lightweight />
          </template>
          <div v-else class="mb-bonus mb-bonus--revealed">
            <span class="mb-bonus__name" v-i18n>{{ bonusName(automa.revealedCard.id) }}</span>
            <span class="mb-bonus__text" v-i18n>{{ bonusText(automa.revealedCard.id) }}</span>
          </div>
        </div>
      </section>

      <!-- The printed board: tracks with the bot cube + regression markers. -->
      <section class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Tracks</h3>
        <MarsBotTracks :tracks="automa.tracks" :botColor="botColor" />
      </section>

      <!-- Decks + supply readout. -->
      <section class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Supply</h3>
        <div class="mb-board__stats">
          <div class="mb-board__stat">
            <span class="mb-board__stat-value">{{ automa.actionDeckSize }}</span>
            <span class="mb-board__stat-label" v-i18n>Action deck</span>
          </div>
          <div class="mb-board__stat">
            <span class="mb-board__stat-value">{{ automa.bonusDeckSize }}</span>
            <span class="mb-board__stat-label" v-i18n>Bonus deck</span>
          </div>
          <div class="mb-board__stat">
            <span class="mb-board__stat-value">{{ automa.playedPile.length }}</span>
            <span class="mb-board__stat-label" v-i18n>Played cards</span>
          </div>
          <div class="mb-board__stat">
            <span class="mb-board__stat-value">{{ automa.floaters }}</span>
            <span class="mb-board__stat-label" v-i18n>Floaters</span>
          </div>
          <div v-if="automa.secondFleetUnlocked !== undefined" class="mb-board__stat">
            <span class="mb-board__stat-value">{{ automa.secondFleetUnlocked ? 2 : 1 }}</span>
            <span class="mb-board__stat-label" v-i18n>Trade fleets</span>
          </div>
        </div>
      </section>

      <!-- Colonies shipping storage areas. -->
      <section v-if="storageEntries.length > 0" class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Shipping storage</h3>
        <div class="mb-board__storage">
          <span v-for="s in storageEntries" :key="s.colony" class="mb-board__storage-chip">
            <span class="mb-board__storage-name" v-i18n>{{ s.colony }}</span>
            <span class="mb-board__storage-count">×{{ s.count }}</span>
          </span>
        </div>
      </section>

      <!-- The open bonus piles: discard (reshuffles later) + destroyed (gone). -->
      <section class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Bonus discard</h3>
        <div v-if="automa.bonusDiscard.length === 0" class="mb-board__empty" v-i18n>Empty</div>
        <div v-else class="mb-board__bonuses">
          <div v-for="id in automa.bonusDiscard" :key="id" class="mb-bonus">
            <span class="mb-bonus__name" v-i18n>{{ bonusName(id) }}</span>
            <span class="mb-bonus__text" v-i18n>{{ bonusText(id) }}</span>
          </div>
        </div>
      </section>
      <section v-if="automa.destroyedBonusCards.length > 0" class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Destroyed bonus cards</h3>
        <div class="mb-board__bonuses">
          <div v-for="id in automa.destroyedBonusCards" :key="id" class="mb-bonus mb-bonus--destroyed">
            <span class="mb-bonus__name" v-i18n>{{ bonusName(id) }}</span>
            <span class="mb-bonus__text" v-i18n>{{ bonusText(id) }}</span>
            <span class="mb-bonus__destroyed-chip" v-i18n>Removed from the game</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The full MarsBot printed board — the "inspection / details on demand"
 * surface (the tracks deliberately do NOT live on the main screen). Opened
 * from the MarsBot sidebar panel; closes like every other view overlay.
 * Everything rendered here is OPEN information from `GameModel.automa`:
 * tracks, deck COUNTS, the open discard piles, storage. Face-down contents
 * never reach this model.
 */
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {bonusCardInfo} from '@/common/automa/BonusCardData';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {DIFFICULTY_LABEL} from './marsBotView';
import MarsBotTracks from './MarsBotTracks.vue';
import Card from '@/client/components/card/Card.vue';

export default defineComponent({
  name: 'MarsBotBoardOverlay',
  components: {MarsBotTracks, Card},
  props: {
    automa: {type: Object as PropType<MarsBotModel>, required: true},
    botColor: {type: String as PropType<Color>, required: true},
  },
  emits: ['close'],
  computed: {
    difficultyLabel(): string {
      return DIFFICULTY_LABEL[this.automa.difficulty];
    },
    storageEntries(): Array<{colony: string, count: number}> {
      const storage = this.automa.shippingStorage;
      if (storage === undefined) {
        return [];
      }
      return Object.entries(storage)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
        .map(([colony, count]) => ({colony, count}));
    },
  },
  methods: {
    bonusName(id: BonusCardId): string {
      return bonusCardInfo(id).name;
    },
    bonusText(id: BonusCardId): string {
      return bonusCardInfo(id).text;
    },
  },
  mounted() {
    document.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey);
  },
  data() {
    return {
      onKey: (e: KeyboardEvent) => {
        if (e.code === 'Escape') {
          this.$emit('close');
        }
      },
    };
  },
});
</script>
