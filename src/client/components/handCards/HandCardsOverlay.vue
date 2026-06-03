<template>
  <div class="hand-board-overlay" role="region" :aria-label="$t('Cards in hand')">
    <span class="hand-board-overlay__corner hand-board-overlay__corner--tl" aria-hidden="true"></span>
    <span class="hand-board-overlay__corner hand-board-overlay__corner--tr" aria-hidden="true"></span>
    <span class="hand-board-overlay__corner hand-board-overlay__corner--bl" aria-hidden="true"></span>
    <span class="hand-board-overlay__corner hand-board-overlay__corner--br" aria-hidden="true"></span>

    <header class="hand-board__header">
      <div class="hand-board__context">
        <span class="hand-board__glyph" aria-hidden="true"></span>
        <h2 class="hand-board__title" v-i18n>Cards in hand</h2>
        <span class="hand-board__player" :class="'player_translucent_bg_color_' + player.color">
          <span class="hand-board__player-dot" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
          {{ player.name }}
        </span>
        <span v-if="totalCount > 0" class="hand-board__total">{{ totalCount }}</span>
        <span v-if="totalCount > 0" class="hand-board__playable">
          <span class="hand-board__playable-dot" aria-hidden="true"></span>
          <span v-i18n>Can play</span>:&nbsp;{{ playableCount }}
        </span>
      </div>
      <button type="button" class="hand-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <HandCardsFilters
      v-if="totalCount > 0"
      :filter="filter"
      :availabilityChips="availabilityChips"
      :typeChips="typeChips"
      :tagChips="tagChips"
      @availability="setAvailability"
      @toggle-type="toggleType"
      @toggle-tag="toggleTag"
      @sort="setSort"
      @sort-dir="setSortDir" />

    <div class="hand-board__body">
      <HandCardsEmptyState v-if="emptyReason !== undefined" :reason="emptyReason" />
      <transition-group
        v-else
        appear
        name="hand-card-pop"
        tag="div"
        :class="['hand-board__grid', {'hand-board__grid--exiting': reflowDelay}]"
        @before-leave="onLeaveCapture">
        <HandCardItem
          v-for="entry in sorted"
          :key="entry.name"
          :entry="entry"
          @open="openCard"
          @play="$emit('play', $event)" />
      </transition-group>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined" ref="zoomModal" :card="zoomCard" @close="zoomCard = undefined">
        <template #actions>
          <button
            v-if="zoomPlayable"
            type="button"
            class="card-zoom-actions__btn card-zoom-actions__btn--primary hand-zoom-play"
            @click="playZoom">
            <span v-i18n>Play card</span>
          </button>
          <div v-else-if="zoomReason !== undefined" class="hand-zoom-reason">
            <HandCardReasonPopover :reason="zoomReason" />
          </div>
        </template>
      </CardZoomModal>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {
  AvailabilityChip,
  AvailabilityFilter,
  buildAvailabilityChips,
  buildHandEntries,
  buildTagChips,
  buildTypeChips,
  countPlayable,
  DEFAULT_HAND_FILTER,
  filterHandEntries,
  HandCardEntry,
  HandFilterState,
  HandSortDir,
  HandSortMode,
  HandTagChip,
  HandTypeChip,
  HandTypeKey,
  sortHandEntries,
} from '@/client/components/handCards/handCardModel';
import {UnplayableReason} from '@/client/components/handCards/cardPlayability';
import HandCardItem from '@/client/components/handCards/HandCardItem.vue';
import HandCardsFilters from '@/client/components/handCards/HandCardsFilters.vue';
import HandCardsEmptyState from '@/client/components/handCards/HandCardsEmptyState.vue';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

/**
 * Premium "cards in hand" overlay — the single modern surface for the
 * viewer's hand AND for starting a card play. Shows EVERY card the player
 * holds: playable cards bright with an active РАЗЫГРАТЬ button, unplayable
 * cards dimmed with a reason popover. Filters (availability / type / tag),
 * a sort dropdown, an adaptive grid with vertical scroll, and single-click
 * fullscreen (with a РАЗЫГРАТЬ in the fullscreen actions slot).
 *
 * Only ever mounted for the viewer's OWN seat (the server never sends
 * opponents' hand contents) — PlayerHome renders card-backs otherwise.
 * The authoritative "playable now" gate is `playableCardNames` (the
 * server's action-menu list); reasons are derived client-side.
 */
type DataModel = {
  filter: HandFilterState;
  zoomCard: CardModel | undefined;
  // True only for the render that follows a filter/sort change which REMOVES
  // at least one card. While set, the grid's `--exiting` class delays the
  // reflow (-move) and re-enter (-enter) transitions until the exit
  // animation has finished, so leaving cards never get overlapped by the
  // cards tightening into their place. Recomputed on every `sorted` change
  // (a pure re-sort or a widening filter leaves it false → snappy reflow),
  // so it never needs a timer to clear.
  reflowDelay: boolean;
};

export default defineComponent({
  name: 'HandCardsOverlay',
  components: {HandCardItem, HandCardsFilters, HandCardsEmptyState, HandCardReasonPopover, CardZoomModal},
  props: {
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    game: {
      type: Object as PropType<GameModel>,
      required: true,
    },
    cards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      required: true,
    },
    playableCardNames: {
      type: Object as PropType<ReadonlySet<CardName>>,
      required: true,
    },
    playActionAvailable: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['play', 'close'],
  data(): DataModel {
    return {
      filter: {...DEFAULT_HAND_FILTER},
      zoomCard: undefined,
      reflowDelay: false,
    };
  },
  computed: {
    entries(): ReadonlyArray<HandCardEntry> {
      return buildHandEntries(this.cards, this.game, this.player, this.playActionAvailable, this.playableCardNames);
    },
    sorted(): ReadonlyArray<HandCardEntry> {
      return sortHandEntries(filterHandEntries(this.entries, this.filter), this.filter.sort, this.filter.sortDir);
    },
    availabilityChips(): ReadonlyArray<AvailabilityChip> {
      return buildAvailabilityChips(this.entries, this.filter);
    },
    typeChips(): ReadonlyArray<HandTypeChip> {
      return buildTypeChips(this.entries, this.filter);
    },
    tagChips(): ReadonlyArray<HandTagChip> {
      return buildTagChips(this.entries, this.filter);
    },
    totalCount(): number {
      return this.entries.length;
    },
    playableCount(): number {
      return countPlayable(this.entries);
    },
    emptyReason(): 'none' | 'filtered' | undefined {
      if (this.totalCount === 0) {
        return 'none';
      }
      return this.sorted.length === 0 ? 'filtered' : undefined;
    },
    zoomEntry(): HandCardEntry | undefined {
      if (this.zoomCard === undefined) {
        return undefined;
      }
      return this.entries.find((e) => e.name === this.zoomCard?.name);
    },
    zoomPlayable(): boolean {
      return this.zoomEntry?.state.playable === true;
    },
    zoomReason(): UnplayableReason | undefined {
      return this.zoomEntry?.state.reason;
    },
  },
  watch: {
    // Decide BEFORE the grid re-renders whether the upcoming patch removes
    // any card. `flush: 'pre'` runs this ahead of the component's render
    // effect, so `reflowDelay` is already correct when the transition-group
    // applies its -move / -enter classes in the same patch. We only delay
    // the reflow when something actually leaves; a pure re-sort or a
    // widening filter (no exits) keeps it false so the move stays snappy.
    sorted: {
      flush: 'pre',
      handler(next: ReadonlyArray<HandCardEntry>, prev: ReadonlyArray<HandCardEntry>): void {
        const nextNames = new Set(next.map((e) => e.name));
        this.reflowDelay = prev.some((e) => !nextNames.has(e.name));
      },
    },
  },
  methods: {
    setAvailability(value: AvailabilityFilter): void {
      this.filter.availability = value;
    },
    toggleType(key: HandTypeKey): void {
      const hidden = this.filter.hiddenTypes.slice();
      const idx = hidden.indexOf(key);
      if (idx === -1) {
        hidden.push(key);
      } else {
        hidden.splice(idx, 1);
      }
      this.filter.hiddenTypes = hidden;
    },
    toggleTag(tag: Tag): void {
      const tags = this.filter.activeTags.slice();
      const idx = tags.indexOf(tag);
      if (idx === -1) {
        tags.push(tag);
      } else {
        tags.splice(idx, 1);
      }
      this.filter.activeTags = tags;
    },
    setSort(mode: HandSortMode): void {
      this.filter.sort = mode;
    },
    setSortDir(dir: HandSortDir): void {
      this.filter.sortDir = dir;
    },
    // Pin a leaving card to its exact grid spot before it goes
    // `position: absolute`, so it shrink-fades in place instead of
    // snapping to the grid origin (flying left + overlapping neighbours).
    // offsetLeft/Top are measured against the relative `.hand-board__grid`;
    // width/height preserve its footprint once it's out of grid flow.
    onLeaveCapture(el: Element): void {
      const node = el as HTMLElement;
      node.style.left = `${node.offsetLeft}px`;
      node.style.top = `${node.offsetTop}px`;
      node.style.width = `${node.offsetWidth}px`;
      node.style.height = `${node.offsetHeight}px`;
    },
    openCard(card: CardModel): void {
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs as {zoomModal?: {show: () => void}}).zoomModal?.show();
      });
    },
    playZoom(): void {
      const card = this.zoomCard;
      if (card === undefined) {
        return;
      }
      (this.$refs as {zoomModal?: {close: () => void}}).zoomModal?.close();
      this.zoomCard = undefined;
      this.$emit('play', card.name);
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') {
        return;
      }
      // Let an open fullscreen card (native <dialog>) take Escape first.
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      this.$emit('close');
    },
  },
  mounted(): void {
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
