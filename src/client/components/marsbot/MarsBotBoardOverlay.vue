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
          <BonusCardFace v-else :id="automa.revealedCard.id" :ctx="ctx" />
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

      <!-- The open bonus piles: recurring (circulate) + discard (reshuffles later) + destroyed (gone). -->
      <section v-if="automa.recurringBonusCards.length > 0" class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Recurring bonus cards</h3>
        <p class="mb-board__hint" v-i18n>These cards never go to the discard — they are shuffled back into the action deck every generation</p>
        <div class="mb-board__bonuses">
          <BonusCardFace v-for="id in automa.recurringBonusCards" :key="id" :id="id" :ctx="ctx" />
        </div>
      </section>
      <section class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Bonus discard</h3>
        <p class="mb-board__hint" v-i18n>Resolved bonus cards rest here and are shuffled back in when the bonus deck runs out</p>
        <div v-if="automa.bonusDiscard.length === 0" class="mb-board__empty" v-i18n>Empty</div>
        <div v-else class="mb-board__bonuses">
          <BonusCardFace v-for="id in automa.bonusDiscard" :key="id" :id="id" :ctx="ctx" />
        </div>
      </section>
      <section v-if="automa.destroyedBonusCards.length > 0" class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>Destroyed bonus cards</h3>
        <p class="mb-board__hint" v-i18n>Destroyed cards are removed from the game permanently — they are never reshuffled</p>
        <div class="mb-board__bonuses">
          <BonusCardFace v-for="id in automa.destroyedBonusCards" :key="id" :id="id" :ctx="ctx" destroyed />
        </div>
      </section>

      <!-- How MarsBot plays — the teaching layer (shared with the console). -->
      <section class="mb-board__section">
        <h3 class="mb-board__label" v-i18n>How MarsBot plays</h3>
        <div class="mb-guide">
          <div v-for="section in guide" :key="section.id" class="mb-guide__block">
            <h4 class="mb-guide__title">
              <span class="mb-guide__glyph" aria-hidden="true">{{ section.glyph }}</span>
              <span v-i18n>{{ section.title }}</span>
            </h4>
            <p v-for="(body, i) in section.body" :key="i" class="mb-guide__body" v-i18n>{{ body }}</p>
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
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {DIFFICULTY_LABEL} from './marsBotView';
import {GuideSection, MarsBotGuideContext, marsBotGuide} from './marsBotGuide';
import MarsBotTracks from './MarsBotTracks.vue';
import BonusCardFace from './BonusCardFace.vue';
import Card from '@/client/components/card/Card.vue';

export default defineComponent({
  name: 'MarsBotBoardOverlay',
  components: {MarsBotTracks, BonusCardFace, Card},
  props: {
    automa: {type: Object as PropType<MarsBotModel>, required: true},
    botColor: {type: String as PropType<Color>, required: true},
    /** The expansion context — resolves the bonus-card faces + guide sections for THIS game. */
    ctx: {type: Object as PropType<MarsBotGuideContext>, required: true},
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
    guide(): ReadonlyArray<GuideSection> {
      return marsBotGuide(this.automa.difficulty, this.ctx);
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
