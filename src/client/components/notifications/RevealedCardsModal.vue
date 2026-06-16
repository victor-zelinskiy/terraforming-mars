<template>
  <Teleport to="body">
    <Transition name="reveal-viewer">
      <div v-if="open && reveal !== undefined"
           class="reveal-viewer"
           :class="'reveal-viewer--' + reveal.origin"
           @click.self="close">
        <div class="reveal-viewer__card" role="dialog" aria-modal="true" :aria-label="$t(title)">
          <span class="reveal-viewer__tick reveal-viewer__tick--tl" aria-hidden="true"></span>
          <span class="reveal-viewer__tick reveal-viewer__tick--br" aria-hidden="true"></span>

          <header class="reveal-viewer__head">
            <div class="reveal-viewer__title-row">
              <span class="reveal-viewer__glyph" aria-hidden="true">{{ glyph }}</span>
              <span class="reveal-viewer__title" v-i18n>{{ title }}</span>
              <button type="button" class="reveal-viewer__close" :aria-label="$t('Close')" @click="close">✕</button>
            </div>
            <div class="reveal-viewer__sub">
              <span v-if="reveal.actor !== undefined"
                    class="journal-player reveal-viewer__actor"
                    :class="'player_translucent_bg_color_' + reveal.actor">
                <span class="journal-player__dot" :class="'player_bg_color_' + reveal.actor" aria-hidden="true"></span>
                <span class="journal-player__name">{{ actorName }}</span>
              </span>
              <JournalCardChip v-if="reveal.source !== undefined" :name="reveal.source" />
              <span class="reveal-viewer__chip">{{ reveal.cards.length }}&nbsp;<span v-i18n>cards</span></span>
              <span class="reveal-viewer__chip reveal-viewer__chip--origin" v-i18n>{{ originLabel }}</span>
              <span class="reveal-viewer__chip reveal-viewer__chip--result" v-i18n>{{ resultLabel }}</span>
            </div>
          </header>

          <div class="reveal-viewer__grid" :class="{'reveal-viewer__grid--few': reveal.cards.length <= 3}">
            <div v-for="(name, i) in reveal.cards"
                 :key="i"
                 class="reveal-viewer__slot"
                 @click.capture.stop="openZoom(i)">
              <Card :card="{name}" />
            </div>
          </div>

          <footer class="reveal-viewer__foot">
            <button type="button" class="reveal-viewer__done" @click="close">
              <span v-i18n>Close</span>
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- Fullscreen browser of the revealed cards (read-only). -->
    <CardZoomModal
      v-if="zoomCard !== undefined"
      :card="zoomCard"
      :cards="zoomCards"
      @navigate="onZoomNav"
      @close="zoomCard = undefined" />
  </Teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import {revealViewerState, closeRevealViewer} from '@/client/components/notifications/revealViewerState';

/**
 * Read-only viewer for cards a player publicly revealed (from the deck) or
 * showed (from hand). NO selection / play / discard — only look + close. Opened
 * from a reveal notification's «Посмотреть» CTA or a journal reveal row. Adaptive:
 * a centred row for ≤3 cards, a wrapping grid for 4+. Click a card → fullscreen
 * (the existing `CardZoomModal`, which becomes a left/right browser across the
 * revealed set). App-level (Teleport) so it survives the playerkey remount.
 */
export default defineComponent({
  name: 'RevealedCardsModal',
  components: {Card, CardZoomModal, JournalCardChip},
  props: {
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      default: () => [],
    },
  },
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
    };
  },
  computed: {
    open(): boolean {
      return revealViewerState.open;
    },
    reveal() {
      return revealViewerState.reveal;
    },
    title(): string {
      return this.reveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards';
    },
    glyph(): string {
      return this.reveal?.origin === 'hand' ? '👁' : '◇';
    },
    originLabel(): string {
      return this.reveal?.origin === 'hand' ? 'from hand' : 'from deck';
    },
    resultLabel(): string {
      switch (this.reveal?.result) {
      case 'discarded': return 'discarded';
      case 'shown': return 'shown';
      case 'kept': return 'kept';
      default: return 'revealed';
      }
    },
    actorName(): string {
      const a = this.reveal?.actor;
      if (a === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === a)?.name ?? a;
    },
    zoomCards(): ReadonlyArray<CardModel> {
      return (this.reveal?.cards ?? []).map((name) => ({name}));
    },
  },
  watch: {
    open(isOpen: boolean): void {
      if (isOpen) {
        window.addEventListener('keydown', this.onKey);
      } else {
        window.removeEventListener('keydown', this.onKey);
        this.zoomCard = undefined;
      }
    },
  },
  methods: {
    close(): void {
      closeRevealViewer();
    },
    openZoom(index: number): void {
      const names = this.reveal?.cards;
      if (names === undefined || names[index] === undefined) {
        return;
      }
      this.zoomCard = {name: names[index]};
    },
    onZoomNav(card: CardModel): void {
      this.zoomCard = card;
    },
    onKey(e: KeyboardEvent): void {
      // Let the fullscreen viewer own Escape while it's open.
      if (e.key === 'Escape' && this.zoomCard === undefined) {
        this.close();
      }
    },
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKey);
  },
});
</script>
