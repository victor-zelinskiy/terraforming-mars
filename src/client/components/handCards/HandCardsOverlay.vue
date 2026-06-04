<template>
  <div class="hand-board-overlay"
       :class="{'hand-board-overlay--mandatory-select': selectActive}"
       role="region"
       :aria-label="$t('Cards in hand')">
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
        <span
          v-if="totalCount > 0 && !saleActive && !selectActive"
          class="hand-board__playable"
          :class="{'hand-board__playable--zero': playableCount === 0}">
          <span class="hand-board__playable-dot" aria-hidden="true"></span>
          <span v-i18n>Can play</span>:&nbsp;{{ playableCount }}
        </span>
      </div>
      <!-- Sell-patents mode toggle. Visible only when the standard project is
           offered (or already active); active styling while in sale mode. -->
      <button
        v-if="(sellPatentsAvailable || saleActive) && !selectActive"
        type="button"
        class="hand-board__sale-toggle"
        :class="{'hand-board__sale-toggle--active': saleActive}"
        :aria-pressed="saleActive"
        @click="toggleSaleMode">
        <span class="hand-board__sale-toggle-dot" aria-hidden="true"></span>
        <span class="hand-board__sale-toggle-label" v-i18n>Patent sale</span>
      </button>
      <button type="button" class="hand-board__close" :aria-label="$t('Close')" @click="$emit('close')">✕</button>
    </header>

    <!-- Sale-mode strip: premium mode indicator + summary + ПРОДАТЬ / ОТМЕНИТЬ.
         Makes it unmistakable this is the "Sell patents" standard project, not
         a card play. -->
    <transition name="hand-sale-strip">
      <div v-if="saleActive" class="hand-sale-strip">
        <div class="hand-sale-strip__mode">
          <span class="hand-sale-strip__glyph" aria-hidden="true"></span>
          <div class="hand-sale-strip__text">
            <span class="hand-sale-strip__title">
              <span v-i18n>Patent sale</span><span class="hand-sale-strip__kind">&nbsp;·&nbsp;<span v-i18n>a standard project</span></span>
            </span>
            <!-- Info text stays plain text ("… 1 M€ per card") so the gold
                 megacredit coin lives ONLY in the CTA button (no visual dup). -->
            <span class="hand-sale-strip__hint">{{ saleHint }}</span>
          </div>
        </div>
        <div class="hand-sale-strip__actions">
          <!-- Summary in plain text ("Получите: 5 M€") — the coin is reserved
               for the primary CTA button below. -->
          <span class="hand-sale-strip__summary">{{ saleSummaryLabel }}</span>
          <button
            type="button"
            class="hand-sale-confirm-btn"
            :disabled="!canConfirmSale"
            @click="confirmSale">
            <span class="hand-sale-confirm-btn__glow" aria-hidden="true"></span>
            <span class="hand-sale-confirm-btn__label">
              <span v-i18n>Sell</span>
              <template v-if="saleSelectedCount > 0">
                <span class="hand-sale-confirm-btn__count">{{ saleSelectedCount }}</span>
                <span class="hand-sale-confirm-btn__sep" aria-hidden="true">·</span>
                <span class="hand-sale-confirm-btn__gain">+<span class="mc-coin mc-coin--sm">{{ salePayout }}</span></span>
              </template>
            </span>
          </button>
          <button type="button" class="hand-sale-cancel-btn" @click="cancelSale" v-i18n>Cancel sale</button>
        </div>
      </div>
    </transition>

    <!-- Mandatory hand-select strip: the game is waiting for the player to pick
         cards FROM their hand (discard / reveal / keep / copy). Cyan accent (vs
         the amber sell strip) + the server's prompt title + ПОДТВЕРДИТЬ. There
         is NO cancel — the prompt is mandatory; the header ✕ minimizes it to a
         pill so the player can inspect the board, never dismiss it. -->
    <transition name="hand-sale-strip">
      <div v-if="selectActive" class="hand-select-strip">
        <div class="hand-select-strip__mode">
          <span class="hand-select-strip__glyph" aria-hidden="true"></span>
          <div class="hand-select-strip__text">
            <span class="hand-select-strip__title">{{ selectTitleText }}</span>
            <span class="hand-select-strip__hint">{{ selectCounterLabel }}</span>
          </div>
        </div>
        <div class="hand-select-strip__actions">
          <button
            type="button"
            class="hand-select-confirm-btn"
            :disabled="!canConfirmSelect"
            @click="confirmSelect">
            <span class="hand-select-confirm-btn__glow" aria-hidden="true"></span>
            <span class="hand-select-confirm-btn__label">
              {{ selectButtonLabel }}
              <span v-if="selectSelectedCount > 0" class="hand-select-confirm-btn__count">{{ selectSelectedCount }}</span>
            </span>
          </button>
        </div>
      </div>
    </transition>

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

    <div ref="body" class="hand-board__body">
      <HandCardsEmptyState v-if="emptyReason !== undefined" :reason="emptyReason" :saleMode="saleActive" />
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
          :saleMode="saleActive || selectActive"
          :selected="isSelected(entry.name)"
          :dissolving="dissolving.includes(entry.name)"
          @open="openCard"
          @play="$emit('play', $event)"
          @toggle-select="toggleSelect" />
      </transition-group>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined" ref="zoomModal" :card="zoomCard" @close="zoomCard = undefined">
        <template #actions>
          <button
            v-if="(saleActive || selectActive) && zoomCard !== undefined"
            type="button"
            class="card-zoom-actions__btn card-zoom-actions__btn--primary hand-zoom-sell"
            :class="{'hand-zoom-sell--selected': zoomSelected}"
            @click="toggleSelectZoom">
            <span v-i18n>{{ zoomSelected ? 'Deselect' : 'Select' }}</span>
          </button>
          <button
            v-else-if="zoomPlayable"
            type="button"
            class="card-zoom-actions__btn card-zoom-actions__btn--primary hand-zoom-play"
            @click="playZoom">
            <span v-i18n>Play now</span>
          </button>
          <!-- Soft block (not your turn / finish current action): a calm
               disabled РАЗЫГРАТЬ + a single one-liner, not the requirements
               list. -->
          <div v-else-if="zoomBlock === 'soft'" class="hand-zoom-softblock">
            <button type="button" class="card-zoom-actions__btn hand-zoom-play-disabled" disabled>
              <span v-i18n>Play now</span>
            </button>
            <span v-if="zoomSoftText !== ''" class="hand-zoom-softblock__text">{{ zoomSoftText }}</span>
          </div>
          <div v-else-if="zoomReasons.length > 0" class="hand-zoom-reason">
            <HandCardReasonPopover :reasons="zoomReasons" heading="Cannot play now" />
          </div>
        </template>
      </CardZoomModal>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, markRaw, nextTick, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
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
import {HandCardBlock} from '@/client/components/handCards/cardPlayability';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {translateText, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {
  sellPatentsState,
  enterSellPatents,
  exitSellPatents,
  toggleSellSelection,
  isSelectedForSale,
  sellPatentsPayout,
  SELL_PATENTS_RATE,
} from '@/client/components/handCards/sellPatentsState';
import {
  handSelectState,
  toggleHandSelectSelection,
  isSelectedForHandSelect,
} from '@/client/components/handCards/handSelectState';
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
 * server's action-menu list); the WHY-unplayable reasons are produced
 * authoritatively on the server and ride on each card model
 * (`card.unplayableReasons`).
 */
// Adaptive card scale (HandCardsOverlay.fit). Cards start LARGE and the
// engine only scales DOWN to fit the available height — a small hand reads
// roomy/comfortable, a big hand stays compact, and vertical scroll is the
// last resort (only when even MIN overflows).
const HAND_ZOOM_MAX = 0.82; // comfortable / large (few cards, wide screen)
const HAND_ZOOM_MAX_NARROW = 0.66; // cap on narrow screens
const HAND_ZOOM_MIN = 0.5; // compact floor before scroll kicks in

// Premium sell-patents exit: the chosen cards dissolve IN PLACE for this long
// BEFORE the sale is submitted, so the player sees a deliberate disappearance
// (not an instant vanish). The submit then removes them + reflows the rest.
// Keep in sync with the `hand-card-sale-dissolve` keyframe duration.
const SALE_DISSOLVE_MS = 490;

type DataModel = {
  filter: HandFilterState;
  zoomCard: CardModel | undefined;
  // ResizeObserver on the scroll body (markRaw — must not be made reactive).
  resizeObserver: ResizeObserver | undefined;
  // rAF debounce flag for fit().
  fitScheduled: boolean;
  // Timer handle for the post-animation deferred re-fit (filter/sort changes).
  fitTimer: number | undefined;
  // True only for the render that follows a filter/sort change which REMOVES
  // at least one card. While set, the grid's `--exiting` class delays the
  // reflow (-move) and re-enter (-enter) transitions until the exit
  // animation has finished, so leaving cards never get overlapped by the
  // cards tightening into their place. Recomputed on every `sorted` change
  // (a pure re-sort or a widening filter leaves it false → snappy reflow),
  // so it never needs a timer to clear.
  reflowDelay: boolean;
  // Card names currently playing their sell-patents dissolve (before submit).
  dissolving: ReadonlyArray<CardName>;
  // Timer handle for the dissolve → submit hand-off.
  saleTimer: number | undefined;
};

export default defineComponent({
  name: 'HandCardsOverlay',
  components: {HandCardItem, HandCardsFilters, HandCardsEmptyState, HandCardReasonPopover, CardZoomModal},
  props: {
    player: {
      type: Object as PropType<PublicPlayerModel>,
      required: true,
    },
    cards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      required: true,
    },
    // (The full hand carries its own server-derived unplayableReasons.)
    playableCardNames: {
      type: Object as PropType<ReadonlySet<CardName>>,
      required: true,
    },
    playActionAvailable: {
      type: Boolean,
      required: true,
    },
    // True when the server is waiting on THIS player for some input (any
    // `waitingFor`). Lets an otherwise-playable card distinguish "not your
    // turn" from "your turn, but finish the current action first".
    awaitingInput: {
      type: Boolean,
      required: true,
    },
    // True when the "Sell patents" standard project is offered right now
    // (own seat + the action is in waitingFor + the player has cards). Gates
    // entering sale mode and the final ПРОДАТЬ submit.
    sellPatentsAvailable: {
      type: Boolean,
      required: true,
    },
  },
  emits: ['play', 'close', 'sell', 'hand-select'],
  data(): DataModel {
    return {
      filter: {...DEFAULT_HAND_FILTER},
      zoomCard: undefined,
      reflowDelay: false,
      resizeObserver: undefined,
      fitScheduled: false,
      fitTimer: undefined,
      dissolving: [],
      saleTimer: undefined,
    };
  },
  computed: {
    entries(): ReadonlyArray<HandCardEntry> {
      return buildHandEntries(this.cards, this.playActionAvailable, this.playableCardNames, this.awaitingInput);
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
    zoomBlock(): HandCardBlock {
      return this.zoomEntry?.state.block ?? 'rules';
    },
    zoomReasons(): ReadonlyArray<UnplayableReason> {
      return this.zoomEntry?.state.reasons ?? [];
    },
    // The single calm one-liner for a soft-blocked card in the fullscreen view.
    zoomSoftText(): string {
      const r = this.zoomEntry?.state.softReason;
      return r === undefined ? '' : translateTextWithParams(r.message, [...(r.params ?? [])]);
    },
    // ── Sell-patents sale mode ──────────────────────────────────────────
    saleActive(): boolean {
      return sellPatentsState.active;
    },
    saleSelectedCount(): number {
      return sellPatentsState.selected.length;
    },
    salePayout(): number {
      return sellPatentsPayout(this.saleSelectedCount);
    },
    // Final submit is allowed only with ≥1 card AND while the action is still
    // offered (it's the player's turn). 0 cards / not-your-turn → disabled.
    canConfirmSale(): boolean {
      return this.saleSelectedCount > 0 && this.sellPatentsAvailable && !sellPatentsState.submitting;
    },
    // Info strip text (plain "… M€" — the coin lives only in the CTA button so
    // money isn't shown twice in the same strip).
    saleSummaryLabel(): string {
      return translateTextWithParams('Selected: ${0} · Gain: ${1} M€', [String(this.saleSelectedCount), String(this.salePayout)]);
    },
    saleHint(): string {
      return translateTextWithParams('Select cards to sell. You gain ${0} M€ per card.', [String(SELL_PATENTS_RATE)]);
    },
    zoomSelected(): boolean {
      if (this.zoomCard === undefined) {
        return false;
      }
      if (this.selectActive) {
        return isSelectedForHandSelect(this.zoomCard.name);
      }
      return isSelectedForSale(this.zoomCard.name);
    },
    // ── Mandatory "select cards from hand" mode ─────────────────────────
    selectActive(): boolean {
      return handSelectState.active;
    },
    selectSelectedCount(): number {
      return handSelectState.selected.length;
    },
    // Confirm is allowed once the selection is within [min, max]. min === 0
    // means the player may confirm with nothing picked (an optional reveal).
    canConfirmSelect(): boolean {
      const n = this.selectSelectedCount;
      return n >= handSelectState.min && n <= handSelectState.max;
    },
    selectTitleText(): string {
      const t = handSelectState.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    selectButtonLabel(): string {
      return handSelectState.buttonLabel !== '' ? translateText(handSelectState.buttonLabel) : translateText('Confirm selection');
    },
    selectCounterLabel(): string {
      return translateTextWithParams('Selected ${0} of ${1}', [String(this.selectSelectedCount), String(handSelectState.max)]);
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
        // Card set changed → re-fit the scale, but AFTER the exit→reflow→enter
        // animation settles, so the zoom never pops mid-transition.
        this.deferFit();
      },
    },
    // The sale response landed (WaitingFor preserved this instance, so `cards`
    // updated reactively rather than remounting). The sold cards have left the
    // hand — the transition-group is already dissolving them out + reflowing
    // the rest, and the M€ delta chip fired from the same update. Drop sale
    // mode so the surviving cards return to their normal play affordances.
    cards(): void {
      if (sellPatentsState.submitting) {
        this.dissolving = [];
        exitSellPatents();
      }
    },
  },
  methods: {
    setAvailability(value: AvailabilityFilter): void {
      this.filter.availability = value;
    },
    // Single-select within the group: picking a type clears any other type
    // (clicking the active one toggles it off). Keeps the filtering simple —
    // one type at a time, mirroring the availability segment.
    toggleType(key: HandTypeKey): void {
      this.filter.activeTypes = this.filter.activeTypes.includes(key) ? [] : [key];
    },
    // Single-select within the group: picking a tag clears any other tag
    // (clicking the active one toggles it off).
    toggleTag(tag: Tag): void {
      this.filter.activeTags = this.filter.activeTags.includes(tag) ? [] : [tag];
    },
    setSort(mode: HandSortMode): void {
      this.filter.sort = mode;
    },
    setSortDir(dir: HandSortDir): void {
      this.filter.sortDir = dir;
    },
    // ── Sell-patents sale mode ──────────────────────────────────────────
    isSelected(name: CardName): boolean {
      if (this.selectActive) {
        return isSelectedForHandSelect(name);
      }
      return isSelectedForSale(name);
    },
    // Header toggle: enter sale mode (only when the action is offered) or
    // cancel it. Toggling OFF is a cancel — nothing is submitted.
    toggleSaleMode(): void {
      if (this.saleActive) {
        this.cancelSale();
      } else if (this.sellPatentsAvailable) {
        enterSellPatents();
      }
    },
    cancelSale(): void {
      if (this.saleTimer !== undefined) {
        window.clearTimeout(this.saleTimer);
        this.saleTimer = undefined;
      }
      this.dissolving = [];
      exitSellPatents();
    },
    toggleSelect(name: CardName): void {
      if (this.selectActive) {
        toggleHandSelectSelection(name);
        return;
      }
      toggleSellSelection(name);
    },
    // Final ПОДТВЕРДИТЬ in mandatory hand-select mode. Emits the chosen names;
    // PlayerHome submits them through WaitingFor.onsave as a top-level
    // {type:'card', cards}. Nothing is sent until here.
    confirmSelect(): void {
      if (!this.canConfirmSelect) {
        return;
      }
      this.$emit('hand-select', [...handSelectState.selected]);
    },
    // Toggle this card's sale selection from the fullscreen view AND close the
    // fullscreen — same one-tap flow as playing a card from fullscreen
    // (`playZoom`), so the player doesn't need a second click to dismiss it.
    // The selection lives in module state, so it survives the modal closing.
    toggleSelectZoom(): void {
      const card = this.zoomCard;
      if (card === undefined) {
        return;
      }
      if (this.selectActive) {
        toggleHandSelectSelection(card.name);
      } else {
        toggleSellSelection(card.name);
      }
      (this.$refs as {zoomModal?: {close: () => void}}).zoomModal?.close();
      this.zoomCard = undefined;
    },
    // Final ПРОДАТЬ. Flags `submitting` (so WaitingFor PRESERVES this overlay
    // instance across the sale response instead of remounting it) and emits
    // the chosen names — PlayerHome submits them through the existing Sell
    // patents action. Nothing is sent until here. When the response lands the
    // sold cards leave `cards` reactively → the transition-group plays the
    // dissolve + reflow and the `cards` watcher drops sale mode.
    confirmSale(): void {
      if (!this.canConfirmSale) {
        return;
      }
      const cards = [...sellPatentsState.selected];
      // Arm preserve immediately (so any poll during the dissolve keeps this
      // instance alive), play the dissolve on the chosen cards, then submit
      // once it has been seen. The submit removes them + reflows the rest.
      sellPatentsState.submitting = true;
      this.dissolving = cards;
      // Reduced-motion users skip the deliberate dissolve delay — submit
      // almost immediately (the cards still vanish, just without the pause).
      const delay = prefersReducedMotion() ? 0 : SALE_DISSOLVE_MS;
      this.saleTimer = window.setTimeout(() => {
        this.saleTimer = undefined;
        this.$emit('sell', cards);
      }, delay);
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
      // In sale mode, Escape backs OUT of sale mode first (no submit), leaving
      // the overlay open in normal mode. A second Escape then closes it.
      if (this.saleActive) {
        this.cancelSale();
        return;
      }
      this.$emit('close');
    },
    // Coalesce fit() to one run per frame (resize bursts).
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        this.fit();
      });
    },
    // Re-fit AFTER the filter/sort animation has settled — fitting mid-reflow
    // would resize cards while they're still sliding/fading. One centralized
    // timer (reset on each change), not a per-change hack.
    deferFit(): void {
      if (this.fitTimer !== undefined) {
        window.clearTimeout(this.fitTimer);
      }
      this.fitTimer = window.setTimeout(() => {
        this.fitTimer = undefined;
        this.fit();
      }, 380);
    },
    // Adaptive scale: start large and scale the card zoom DOWN only as far as
    // needed to fit the available height. A few cards stay comfortable/large;
    // a big hand compacts to MIN; vertical scroll engages only if MIN still
    // overflows. Measures imperatively (sets the CSS var + reads scrollHeight)
    // because column count shifts with zoom — a sqrt step converges fast.
    fit(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      if (body === undefined) {
        return;
      }
      const grid = body.querySelector('.hand-board__grid') as HTMLElement | null;
      if (grid === null) {
        return; // empty / filtered state — nothing to size
      }
      const cs = window.getComputedStyle(body);
      const avail = body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (avail <= 0) {
        return;
      }
      const maxZoom = body.clientWidth < 1180 ? HAND_ZOOM_MAX_NARROW : HAND_ZOOM_MAX;
      let zoom = maxZoom;
      body.style.setProperty('--hand-card-zoom', zoom.toFixed(3));
      for (let i = 0; i < 14; i++) {
        const overflow = grid.scrollHeight;
        if (overflow <= avail || zoom <= HAND_ZOOM_MIN) {
          break;
        }
        // Shrink at least 3%/step so we always make progress near the edge.
        const ratio = Math.min(Math.sqrt(avail / overflow), 0.97);
        zoom = Math.max(HAND_ZOOM_MIN, zoom * ratio);
        body.style.setProperty('--hand-card-zoom', zoom.toFixed(3));
      }
    },
  },
  mounted(): void {
    window.addEventListener('keydown', this.onKeydown);
    // A remount carrying `submitting` is the post-sale server response — the
    // sold cards are gone, so drop sale mode back to the normal hand view.
    if (sellPatentsState.submitting === true) {
      exitSellPatents();
    }
    const body = this.$refs.body as HTMLElement | undefined;
    if (body !== undefined && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.scheduleFit());
      ro.observe(body);
      this.resizeObserver = markRaw(ro);
    }
    nextTick(() => this.fit());
  },
  beforeUnmount(): void {
    window.removeEventListener('keydown', this.onKeydown);
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    if (this.fitTimer !== undefined) {
      window.clearTimeout(this.fitTimer);
    }
    if (this.saleTimer !== undefined) {
      window.clearTimeout(this.saleTimer);
    }
  },
});
</script>
