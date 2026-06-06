<template>
  <!--
    Modern sci-fi modal content for top-level SelectCard prompts.
    Hosted INSIDE MandatoryInputModal so it inherits all the existing
    chrome (L-corner ticks, picker-mode setter, minimize-to-pill, scroll
    lock, mounting/unmounting choreography). This component only owns
    the header + card grid + confirm footer + fullscreen choreography.

    Two modes share the same template, distinguished by `isBuyMode`:
      - DRAFT (and other "must pick N out of M") — `min > 0`, no cost,
        button reads "ВЫБРАТЬ". Single-select when `min === max === 1`,
        multi-select otherwise.
      - BUY (research / "buy up to 4 cards") — `min === 0`, cost per
        card baked into `card.calculatedCost`. Button reads "КУПИТЬ"
        with a cost badge showing the running total in M€. Confirm
        disables when total > player's M€ with a tooltip explaining why.

    Server-side cost charging happens via a SEPARATE `SelectPayment`
    deferred action that fires AFTER we submit the card list — see
    `src/server/deferredActions/ChooseCards.ts`. The existing
    MandatoryInputModal payment route handles it; this component does
    NOT submit a payment, just `{type:'card', cards:[...]}`.
  -->
  <div class="card-selection" ref="root">

    <!--
      Header layout: title-group centred (title + counter pill as a
      subtitle directly below), per-card cost info pinned to the
      right when in buy mode. Counter pill anchors the count visually
      to the title rather than floating as detached text on the
      right — the player flagged the previous layout's right-aligned
      counter as feeling disconnected.
    -->
    <header class="card-selection__header">
      <div class="card-selection__title-group">
        <h2 class="card-selection__title">{{ titleText }}</h2>
        <span v-if="counterText !== ''"
              class="card-selection__counter">{{ counterText }}</span>
      </div>
      <div v-if="isBuyMode && costPerCard > 0"
           class="card-selection__cost-info">
        <!--
          Single megacredit coin with the value centred inside, Steam-
          style. The icon image comes from the same asset PlayerResource
          uses (`./assets/resources/megacredit.png`) so the visual
          language matches the rest of the UI.
        -->
        <span class="card-selection__cost-coin">{{ costPerCard }}</span>
        <span class="card-selection__cost-label" v-i18n>per card</span>
      </div>
    </header>

    <!--
      Availability filter — shown ONLY when the server flagged some cards as
      DISABLED candidates (relevant but unpickable). Default 'available' so the
      grid isn't cluttered; the player can switch to inspect the unavailable
      ones + their reason. No disabled cards → no filter row at all.
    -->
    <div v-if="hasDisabledCards" class="card-selection__filter" role="group">
      <button v-for="mode in filterModes"
              :key="mode.key"
              type="button"
              class="card-selection__filter-btn"
              :class="{'card-selection__filter-btn--active': filterMode === mode.key}"
              @click="filterMode = mode.key"
              :data-test="'card-selection-filter-' + mode.key">
        {{ mode.label }}<span class="card-selection__filter-count">{{ mode.count }}</span>
      </button>
    </div>

    <!--
      Card grid. Steam-like interaction model (v40-m):
        - SINGLE click on the card → opens fullscreen preview (was:
          toggled selection). Card click is now a safe inspection
          action and never commits anything.
        - Per-card action button BELOW the card is the only way to
          select / toggle. In draft mode the button submits directly
          to the server (no bottom confirm). In buy mode the button
          just toggles local state — final submission lives on the
          bottom "КУПИТЬ" / "ПРОПУСТИТЬ" button.
        - `@click.capture.stop` on the clickable wrapper grabs the
          click in the capture phase BEFORE it reaches Card.vue's own
          @click → fullscreen handler. Without `.stop`, the player
          would see two zoom modals: ours (with actions slot) and
          Card.vue's slot-less default. Our wrapper invokes the
          shared openFullscreen so the actions slot is wired up.
    -->
    <div class="card-selection__cards"
         :class="{'card-selection__cards--single-row': singleRowLayout}"
         ref="grid">
      <div v-for="card in visibleCards"
           :key="card.name"
           class="card-selection__card-slot"
           :class="{
             'card-selection__card-slot--selected': isSelected(card.name),
             'card-selection__card-slot--disabled': isCardDisabled(card.name),
           }"
           :data-test="'card-selection-' + card.name">
        <div class="card-selection__card-clickable"
             @click.capture.stop="openFullscreen(card)">
          <Card :card="card" />
        </div>
        <!-- Disabled candidate: a muted reason chip replaces the action button. -->
        <span v-if="isCardDisabled(card.name)"
              class="card-selection__card-reason"
              :data-hint="cardDisabledReason(card.name)"
              :data-test="'card-selection-reason-' + card.name">
          {{ cardDisabledReason(card.name) }}
        </span>
        <span v-else
              class="card-selection__action-wrap"
              :data-hint="actionDisabled(card.name) ? actionTooltip(card.name) : ''">
          <button class="card-selection__card-action-btn"
                  :class="{
                    'card-selection__card-action-btn--selected': isBuyMode && isSelected(card.name),
                  }"
                  :disabled="actionDisabled(card.name)"
                  @click="onActionClick(card.name)"
                  data-test="card-selection-action">
            {{ actionLabel(card.name) }}
          </button>
        </span>
      </div>
    </div>

    <!--
      Bottom confirm footer — ONLY in buy mode. Draft selection is
      committed by the per-card "ВЫБРАТЬ" button above; there's no
      second confirmation step. Buy mode keeps the footer because
      multi-card toggling needs an explicit final commit.
    -->
    <footer v-if="isMultiSelect"
            class="card-selection__footer"
            :class="{'card-selection__footer--blocked': !canConfirm && confirmTooltip !== ''}"
            :data-hint="!canConfirm ? confirmTooltip : ''">
      <button class="card-selection__confirm"
              :disabled="!canConfirm"
              @click="onBottomConfirm"
              data-test="card-selection-confirm">
        <span class="card-selection__confirm-label">{{ confirmLabel }}</span>
        <span v-if="isBuyMode && totalCost > 0"
              class="card-selection__cost-coin">{{ totalCost }}</span>
      </button>
    </footer>

    <!--
      Fullscreen card view. Opened by single click on a card.

      The `actions` slot supplies the PRIMARY action. CardZoomModal
      itself renders the secondary "ЗАКРЫТЬ" button to the LEFT of
      this slot (see CardZoomModal template — close-first, slot-
      second so it lands on the right in flex row order).

      DRAFT mode: primary = "ВЫБРАТЬ", click submits to the server and
      closes the fullscreen. There is no second-step confirm — the
      bottom "КУПИТЬ" / "ПРОПУСТИТЬ" footer is buy-mode only.

      BUY mode: primary is a TOGGLE. Click does NOT close the
      fullscreen; it flips the card's selected state so the player
      can keep inspecting (and continue opening other cards from the
      grid behind via close + re-click). Label switches to "СНЯТЬ
      ВЫБОР" with amber chrome when the card is already selected,
      explicitly telling the player "this click DESELECTS". The card
      itself simultaneously shows the "ВЫБРАНО" ribbon + cyan halo
      from `.card-selection__card-slot--selected`, so the player has
      a dual signal: STATE on the card, ACTION on the button.
    -->
    <CardZoomModal v-if="zoomCard !== undefined"
                   ref="zoomModal"
                   :card="zoomCard"
                   :cards="visibleCards"
                   :selected="isSelected(zoomCard.name)"
                   @navigate="zoomCard = $event"
                   @close="zoomCard = undefined">
      <template #actions>
        <span v-if="!isMultiSelect"
              class="card-zoom-actions__tip"
              :data-hint="isCardDisabled(zoomCard.name) ? cardDisabledReason(zoomCard.name) : ''">
          <button class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                  :disabled="isCardDisabled(zoomCard.name)"
                  @click="onFullscreenDraftSelect"
                  data-test="card-selection-fullscreen-select">
            {{ translateLabel('Select') }}
          </button>
        </span>
        <span v-else
              class="card-zoom-actions__tip"
              :data-hint="isCardDisabled(zoomCard.name) ? cardDisabledReason(zoomCard.name) : fullscreenToggleTooltip">
          <button class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                  :class="{ 'card-zoom-actions__btn--unselect': isSelected(zoomCard.name) }"
                  :disabled="isCardDisabled(zoomCard.name) || (!isSelected(zoomCard.name) && isMaxedOut)"
                  @click="onFullscreenBuyToggle"
                  data-test="card-selection-fullscreen-toggle">
            {{ isSelected(zoomCard.name) ? translateLabel('Unselect') : translateLabel('Select') }}
          </button>
        </span>
      </template>
    </CardZoomModal>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick, markRaw} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Phase} from '@/common/Phase';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {SelectCardResponse} from '@/common/inputs/InputResponse';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {setDraftWaitPending, clearDraftWaitPending} from '@/client/components/draftWaitState';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {baseZoom, cardSelectionRowPlan, FIT_MAX_CONTENT_W, FIT_MIN_ZOOM, FIT_SINGLE_ROW_MAX} from '@/client/components/cardSelectionFit';

type DataModel = {
  /*
   * Local selection state — card names in pick order. NOT auto-submitted;
   * the only path to the server is `onConfirm()` -> `onsave({type:'card',
   * cards: this.selected})`. When the modal minimizes to a pill, this
   * state stays here (no unmount happens during minimize — the modal
   * card just hides via CSS), so the player returns to the same picks.
   */
  selected: Array<CardName>;
  /*
   * Currently-zoomed card, or undefined when fullscreen is not open.
   * Reactive to the v-if on <CardZoomModal>; mounted-side `show()`
   * call is fired in the nextTick after assignment so the dialog
   * element exists before we ask it to open.
   */
  zoomCard: CardModel | undefined;
  /*
   * Availability filter. 'available' (default) hides server-flagged DISABLED
   * candidates; 'unavailable' shows only them (+ reason); 'all' shows both.
   * Only surfaced when the prompt actually has disabled cards.
   */
  filterMode: 'available' | 'all' | 'unavailable';
  /*
   * Adaptive-fit engine plumbing (mirrors HandCardsOverlay). The grid scales a
   * continuous `--cs-zoom` + sets a count-aware `--cs-content-width` so the modal
   * adapts to card count + viewport: few cards big & centred, many cards a wider
   * balanced grid, vertical scroll only as a last resort.
   */
  resizeObserver: ResizeObserver | undefined;
  fitTimer: number | undefined;
  fitScheduled: boolean;
  // Counts consecutive fit() runs that found no laid-out card (probeW <= 0),
  // so the retry loop is bounded. Reset to 0 on the first successful measure.
  fitRetries: number;
};

// Height/probe-side constants. The row/column/zoom math (FIT_MIN_ZOOM,
// FIT_MAX_CONTENT_W, FIT_SLOT_MIN_W, FIT_SINGLE_ROW_MAX, baseZoom, the row plan)
// lives in cardSelectionFit.ts so it can be unit-tested without a DOM.
const FIT_MAX_ITER = 12;
const FIT_VIEWPORT_W_MARGIN = 80; // viewport side margins + modal frame padding
const FIT_VIEWPORT_H_RATIO = 0.92;
const FIT_MODAL_FRAME_V = 64;     // approx modal frame + outer margins (vertical)
// Bounded retries when the first fit() runs before the cards have real
// dimensions (CSS / fonts still loading right after a page reload). ~30 frames
// ≈ 0.5s; the CSS `max-content` fallback already shows a correct one-row layout
// meanwhile, so this only refines zoom / centring once layout settles.
const FIT_MAX_RETRIES = 30;

export default defineComponent({
  name: 'CardSelectionContent',
  components: {Card, CardZoomModal},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    playerinput: {
      type: Object as PropType<SelectCardModel>,
      required: true,
    },
    onsave: {
      type: Function as PropType<(response: SelectCardResponse) => void>,
      required: true,
    },
  },
  data(): DataModel {
    return {
      selected: [],
      zoomCard: undefined,
      filterMode: 'available',
      resizeObserver: undefined,
      fitTimer: undefined,
      fitScheduled: false,
      fitRetries: 0,
    };
  },
  watch: {
    /*
     * Reset local selection state when the server pushes a new
     * SelectCard prompt at us. With the App-level skip-remount
     * fix (see draftWaitState.shouldPreserveCardPickModal), this
     * component INSTANCE is reused between draft rounds — its
     * `data()` runs only on first mount, so `selected` would
     * otherwise keep card names from the previous round (which
     * aren't in the new card list and would silently break
     * `canConfirm` count / submission shape).
     *
     * Cheap reference compare via the playerinput object identity
     * — the server creates a fresh SelectCardModel for each round,
     * so a new object identity means a new prompt arrived.
     */
    playerinput(newInput, oldInput) {
      if (newInput !== oldInput) {
        this.selected = [];
        this.zoomCard = undefined;
        this.filterMode = 'available';
        // Drop the previous round's pinned width/zoom IMMEDIATELY so the
        // intermediate frame (before deferFit re-measures) falls back to the
        // CSS `max-content` one-row layout instead of squeezing the new cards
        // into the OLD (e.g. 1-card draft round) narrow width — which flashed a
        // wrong wrap until the 320ms deferFit kicked in.
        this.resetFitVars();
        this.deferFit();
      }
    },
    // Re-fit whenever the number of shown cards changes (filter toggle, new
    // prompt) so the layout re-balances for the new count.
    visibleCardCount() {
      this.deferFit();
    },
  },
  computed: {
    /*
     * "Buy mode" heuristic. The cleanest signal is the server's
     * prompt text — `Draft.ts` builds "Select [a card | two cards] to
     * keep and pass the rest to ${player}" for the draft phase, and
     * `ChooseCards.ts` builds "Select [up to ${0} ]card(s) to buy"
     * for research. Anything containing "buy" is research; the
     * remaining `min: 0, max > 1` cases (rare — discard prompts etc.)
     * fall back to draft-style UI without a cost badge.
     */
    isBuyMode(): boolean {
      const t = this.playerinput.title;
      const text = typeof t === 'string' ? t : (t?.message ?? '');
      return text.toLowerCase().includes('buy');
    },
    isSingleSelect(): boolean {
      return this.playerinput.min === 1 && this.playerinput.max === 1;
    },
    // Server-flagged DISABLED candidates (relevant but unpickable) ride their
    // OWN `disabledCards` channel; they drive the availability filter + the
    // muted reason chips. `cards` stays the selectable set.
    disabledCardsList(): ReadonlyArray<CardModel> {
      return this.playerinput.disabledCards ?? [];
    },
    hasDisabledCards(): boolean {
      return this.disabledCardsList.length > 0;
    },
    selectableCount(): number {
      return this.playerinput.cards.length;
    },
    // Cards shown under the current filter. With no disabled cards the filter is
    // hidden and only the selectable `cards` show.
    visibleCards(): ReadonlyArray<CardModel> {
      if (!this.hasDisabledCards || this.filterMode === 'available') {
        return this.playerinput.cards;
      }
      if (this.filterMode === 'unavailable') {
        return this.disabledCardsList;
      }
      return [...this.playerinput.cards, ...this.disabledCardsList];
    },
    // Drives the re-fit watcher — the number of cards currently in the grid.
    visibleCardCount(): number {
      return this.visibleCards.length;
    },
    /*
     * Small picks (the between-generation draft is 4→3→2→1, and the 4-card buy
     * after it) get a HARD one-row guarantee via `flex-wrap: nowrap` on the grid
     * — a CSS invariant, so the row can never wrap regardless of fit() timing or
     * sub-pixel rounding. The fit engine still runs to size zoom/width nicely;
     * it just can no longer (mis)compute a wrap. Mirrors FIT_SINGLE_ROW_MAX in
     * the row-plan math so the JS sizing and the CSS guarantee agree.
     */
    singleRowLayout(): boolean {
      return this.visibleCardCount > 0 && this.visibleCardCount <= FIT_SINGLE_ROW_MAX;
    },
    filterModes(): ReadonlyArray<{key: 'all' | 'available' | 'unavailable', label: string, count: number}> {
      const available = this.selectableCount;
      const unavailable = this.disabledCardsList.length;
      return [
        {key: 'available', label: translateText('Available cards'), count: available},
        {key: 'all', label: translateText('All'), count: available + unavailable},
        {key: 'unavailable', label: translateText('Unavailable cards'), count: unavailable},
      ];
    },
    /*
     * Multi-select mode: the per-card buttons TOGGLE local selection and the
     * commit happens via the bottom confirm footer. Buy is always multi (cost
     * + confirm), and any non-single generic prompt (discard N, reveal 0-N,
     * "select up to N cards") is multi too. Only a single forced pick
     * (min === max === 1) commits on one click without a footer.
     *
     * This is what fixes generic top-level SelectCard prompts: previously every
     * non-buy prompt single-committed the first clicked card, silently breaking
     * "discard 2 cards" / "reveal any number of cards".
     */
    isMultiSelect(): boolean {
      return this.isBuyMode || !this.isSingleSelect;
    },
    /*
     * Whether the current SelectCard is an actual draft pick (card-pick
     * phases), as opposed to a research buy (RESEARCH) or a generic card
     * selection during a normal turn (ACTION — discard / reveal / target a
     * card). Only a real draft pick should arm the "waiting for the rest of
     * the table" view after submit.
     */
    isDraftPhase(): boolean {
      const phase = this.playerView.game.phase;
      return phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING;
    },
    isMaxedOut(): boolean {
      return this.selected.length >= this.playerinput.max;
    },
    /*
     * Cost per card for the BUY (research) flow. The server's
     * `ChooseCards.execute()` charges `selected.length *
     * player.cardCost` (see `src/server/deferredActions/
     * ChooseCards.ts`). `player.cardCost` is the live per-card buy
     * price — 3 by default, can drop via cards / effects (Mining
     * Guild's discount, etc.) — and is exposed on the public
     * player model. Reading it directly here matches what the
     * server will actually charge, regardless of any per-card
     * play-time discounts.
     *
     * IMPORTANT: do NOT use `card.calculatedCost`. That field is the
     * computed PLAY cost of the card (initial cost minus card-
     * specific play discounts), which the server includes in every
     * cardModel produced with `played: false`. For draft / buy
     * flows it's informational only — the server never charges
     * `calculatedCost` for a research pick; it always charges
     * `player.cardCost` per selected card. Using calculatedCost
     * here was the source of the bug the player flagged: cards
     * that read "17" in the draft preview were getting BUY-priced
     * at 17, which is wrong.
     */
    costPerCard(): number {
      return this.playerView.thisPlayer.cardCost;
    },
    totalCost(): number {
      return this.isBuyMode ? this.selected.length * this.costPerCard : 0;
    },
    playerMC(): number {
      return this.playerView.thisPlayer.megacredits;
    },
    canConfirm(): boolean {
      if (this.selected.length < this.playerinput.min) {
        return false;
      }
      if (this.totalCost > this.playerMC) {
        return false;
      }
      return true;
    },
    titleText(): string {
      if (this.isBuyMode) {
        return translateText('Buy up to ${0} cards').replace('${0}', String(this.playerinput.max));
      }
      /*
       * A REAL draft pick keeps the curated generic "Choose a card" label (the
       * server title there is "Select a card to keep and pass the rest to X").
       * Every OTHER prompt — including a single-select card-driven prompt like
       * "Select builder card to copy" (Robotic Workforce), "Select card to add
       * resources", etc. — renders the SERVER's descriptive title so the player
       * knows exactly what the card is making them do. (Previously every
       * single-select showed "Choose a card", hiding the card context — the
       * minimize pill showed the real title, the modal header didn't.)
       */
      if (this.isSingleSelect && this.isDraftPhase) {
        return translateText('Choose a card');
      }
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    counterText(): string {
      if (this.isSingleSelect) {
        return translateText('1 card out of ${0}').replace('${0}', String(this.selectableCount));
      }
      if (this.playerinput.max > 1) {
        return translateText('Selected ${0} of ${1}')
          .replace('${0}', String(this.selected.length))
          .replace('${1}', String(this.playerinput.max));
      }
      return '';
    },
    confirmLabel(): string {
      if (this.isBuyMode) {
        /*
         * Buy mode with nothing selected isn't a "buy" — it's the
         * player opting to SKIP the research round for this gen
         * (server lets `min === 0` go through with an empty pick).
         * Labelling the button "КУПИТЬ" here misleads: there's no
         * purchase happening, no cost to pay. Switch to "ПРОПУСТИТЬ"
         * the moment the selected list is empty so the player's
         * intent reads accurately on the button.
         */
        return this.selected.length === 0 ?
          translateText('Skip') :
          translateText('Buy');
      }
      return translateText('Confirm selection');
    },
    confirmTooltip(): string {
      if (this.selected.length < this.playerinput.min) {
        return translateText('Select at least ${0} card(s)').replace('${0}', String(this.playerinput.min));
      }
      if (this.totalCost > this.playerMC) {
        return translateText('Not enough M€: need ${0}, have ${1}')
          .replace('${0}', String(this.totalCost))
          .replace('${1}', String(this.playerMC));
      }
      return '';
    },
    fullscreenToggleTooltip(): string {
      // Only relevant in buy mode when the player is at max — the
      // button is disabled and we want to explain why on hover.
      if (!this.isBuyMode || this.zoomCard === undefined) {
        return '';
      }
      if (this.isSelected(this.zoomCard.name)) {
        return '';
      }
      if (this.isMaxedOut) {
        return translateText('Already selected ${0} of ${1} — deselect a card first')
          .replace('${0}', String(this.selected.length))
          .replace('${1}', String(this.playerinput.max));
      }
      return '';
    },
  },
  mounted(): void {
    nextTick(() => this.fit());
    // Re-fit once after card art / web fonts settle (they shift card heights).
    this.fitTimer = window.setTimeout(() => {
      this.fitTimer = undefined;
      this.fit();
    }, 240);
    // On a hard reload the web fonts may still be loading when we first fit;
    // re-run once they're ready so the measure isn't taken mid-layout.
    const fonts = (document as unknown as {fonts?: {ready?: Promise<unknown>}}).fonts;
    fonts?.ready?.then(() => this.scheduleFit());
    const root = this.$refs.root as HTMLElement | undefined;
    if (root !== undefined && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => this.scheduleFit());
      ro.observe(root);
      this.resizeObserver = markRaw(ro);
    }
    // The content width is JS-driven, so a viewport resize won't resize `root`
    // on its own — listen for it explicitly to recompute the budget.
    window.addEventListener('resize', this.scheduleFit);
  },
  beforeUnmount(): void {
    if (this.fitTimer !== undefined) {
      window.clearTimeout(this.fitTimer);
    }
    this.resizeObserver?.disconnect();
    window.removeEventListener('resize', this.scheduleFit);
  },
  methods: {
    // ─── Adaptive-fit engine ────────────────────────────────────────────
    applyZoom(z: number): void {
      (this.$refs.root as HTMLElement | undefined)?.style.setProperty('--cs-zoom', z.toFixed(3));
    },
    applyWidth(w: number): void {
      (this.$refs.root as HTMLElement | undefined)?.style.setProperty('--cs-content-width', Math.round(w) + 'px');
    },
    // Clear the engine's inline overrides so the grid falls back to the CSS
    // `max-content` (one-row) width + `--cs-zoom: 1`. Used when a new prompt
    // arrives so a stale narrow width from the previous round can't flash a
    // wrong wrap before the next fit() runs.
    resetFitVars(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      root?.style.removeProperty('--cs-content-width');
      root?.style.removeProperty('--cs-zoom');
    },
    /*
     * Size the grid to the card count + viewport. Probes one card's natural
     * width, then delegates the column / zoom / content-width math to the pure
     * `cardSelectionRowPlan` (so it's unit-testable without a DOM), and finally
     * shrinks zoom only if the rows would overflow the viewport HEIGHT (vertical
     * scroll is the genuine last resort). Mirrors HandCards/PlayedCards. No-op
     * under JSDOM (rects are 0).
     *
     * SMALL PICKS (n <= FIT_SINGLE_ROW_MAX, i.e. the 4→3→2→1 between-generation
     * draft) are pinned to ONE row by the plan: `cols = n`, zoom width-capped
     * + slack so the browser's flex-wrap never bumps the last card to a 2nd row
     * (the 2+1 / 3+1 bug the player flagged).
     */
    fit(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      const grid = this.$refs.grid as HTMLElement | undefined;
      if (root === undefined || grid === undefined) {
        return;
      }
      const n = grid.children.length;
      if (n === 0) {
        return;
      }

      // Cap to the modal's content box: never wider than the 1640 modal max-width
      // minus its frame padding, and never wider than the viewport.
      const availW = Math.max(320, Math.min(FIT_MAX_CONTENT_W, window.innerWidth - FIT_VIEWPORT_W_MARGIN));
      const availH = window.innerHeight * FIT_VIEWPORT_H_RATIO;
      const gridCS = window.getComputedStyle(grid);
      const gap = parseFloat(gridCS.columnGap) || 18;
      const rootCS = window.getComputedStyle(root);
      // Total horizontal inset between the content width (set on root) and the
      // space actually available to the slots: root padding + the grid's OWN
      // left/right padding (`.card-selection__cards` has 4px each side). Missing
      // the grid padding made the row overflow by ~8px → flex-wrap dropped the
      // last card to a 2nd row (the 2+1 / 3+1 bug). Count both.
      const padX =
        (parseFloat(rootCS.paddingLeft) || 0) + (parseFloat(rootCS.paddingRight) || 0) +
        (parseFloat(gridCS.paddingLeft) || 0) + (parseFloat(gridCS.paddingRight) || 0);

      // Probe one slot's natural width (at the base zoom) so the plan can scale
      // it. Apply the full available width first so the probe row doesn't wrap.
      this.applyWidth(availW);
      this.applyZoom(baseZoom(n));
      void grid.offsetHeight;
      const probeW = (grid.children[0] as HTMLElement).getBoundingClientRect().width;
      if (probeW <= 0) {
        // Cards not laid out yet — JSDOM (rects always 0) or a page reload where
        // CSS / fonts are still loading. Retry on the next frame (bounded) so
        // the engine refines as soon as the cards have real dimensions; the CSS
        // `max-content` fallback shows a correct one-row layout meanwhile.
        if (this.fitRetries < FIT_MAX_RETRIES) {
          this.fitRetries++;
          this.scheduleFit();
        }
        return;
      }
      this.fitRetries = 0;
      const naturalW = probeW / baseZoom(n);

      // Width-fit plan (one-row guarantee for small picks).
      let plan = cardSelectionRowPlan({n, naturalW, availW, gap, padX});
      this.applyZoom(plan.zoom);
      this.applyWidth(plan.contentW);
      void grid.offsetHeight;

      // Height-fit: shrink zoom (and re-plan at the smaller scale) only while
      // the rows overflow the available height. cols stays pinned for small
      // picks because the re-plan keeps singleRow → cols = n.
      let zoom = plan.zoom;
      for (let i = 0; i < FIT_MAX_ITER; i++) {
        const gridH = grid.getBoundingClientRect().height;
        const chromeH = Math.max(0, root.getBoundingClientRect().height - gridH);
        const availGridH = availH - chromeH - FIT_MODAL_FRAME_V;
        if (gridH <= availGridH || zoom <= FIT_MIN_ZOOM) {
          break;
        }
        const ratio = Math.min(0.96, Math.sqrt(availGridH / gridH));
        zoom = Math.max(FIT_MIN_ZOOM, zoom * ratio);
        plan = cardSelectionRowPlan({n, naturalW, availW, gap, padX, zoom});
        this.applyZoom(plan.zoom);
        this.applyWidth(plan.contentW);
        void grid.offsetHeight;
      }
    },
    // rAF-coalesced fit for resize bursts.
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
    // Post-animation fit (filter toggle / new prompt) — wait for the row to
    // settle before re-measuring so the zoom doesn't pop mid-transition.
    deferFit(): void {
      if (this.fitTimer !== undefined) {
        window.clearTimeout(this.fitTimer);
      }
      this.fitTimer = window.setTimeout(() => {
        this.fitTimer = undefined;
        this.fit();
      }, 320);
    },
    isSelected(name: CardName): boolean {
      return this.selected.includes(name);
    },
    cardModel(name: CardName): CardModel | undefined {
      return this.playerinput.cards.find((c) => c.name === name) ??
        this.disabledCardsList.find((c) => c.name === name);
    },
    isCardDisabled(name: CardName): boolean {
      return this.disabledCardsList.some((c) => c.name === name);
    },
    cardDisabledReason(name: CardName): string {
      const reason = this.cardModel(name)?.disabledReason;
      if (reason === undefined) {
        return translateText('Unavailable');
      }
      return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
    },
    /*
     * Per-card action button. The behaviour fans out by mode:
     *
     *   DRAFT — pressing the per-card button IS the commit. The
     *           selection is replaced with this card and the result
     *           is sent to the server immediately. There's no
     *           separate bottom confirm step in draft mode.
     *
     *   BUY   — pressing the button only toggles the card in/out of
     *           the local selection. Submission waits for the
     *           bottom "КУПИТЬ" / "ПРОПУСТИТЬ" button.
     */
    onActionClick(name: CardName): void {
      if (this.isMultiSelect) {
        this.toggleSelected(name);
        return;
      }
      this.selected = [name];
      this.submitNow();
    },
    /*
     * Multi-select toggle for buy mode. Same semantics as before:
     * deselect when already in, add when not in AND we're under
     * `max`. Reaching max disables the per-card "ВЫБРАТЬ" buttons
     * for other cards (see `actionDisabled`) so the toggle here
     * just adds when it can.
     */
    toggleSelected(name: CardName): void {
      if (this.isCardDisabled(name)) {
        return;
      }
      const idx = this.selected.indexOf(name);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
      } else if (this.selected.length < this.playerinput.max) {
        this.selected.push(name);
      }
    },
    /*
     * Bottom-button confirm in buy mode. Wires the same submit-time
     * `clear/setDraftWaitPending` flag logic the previous
     * `onConfirm` had.
     */
    onBottomConfirm(): void {
      if (!this.canConfirm) {
        return;
      }
      this.submitNow();
    },
    /*
     * Shared submit path. Tags the draft-wait state correctly for
     * the active mode and POSTs the selection to the server.
     *
     *   DRAFT submit — set draft-wait so the DraftFlowOverlay swaps
     *                  into "Ожидаем карты для драфта" view on the
     *                  response landing.
     *   BUY submit   — explicitly clear the flag because the buy is
     *                  THIS player's last input for the round; we
     *                  don't want the waiting view lingering once
     *                  payment / commit completes.
     */
    submitNow(): void {
      if (this.isDraftPhase) {
        setDraftWaitPending();
      } else {
        clearDraftWaitPending();
      }
      this.onsave({type: 'card', cards: [...this.selected]});
    },
    openFullscreen(card: CardModel): void {
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs.zoomModal as InstanceType<typeof CardZoomModal> | undefined)?.show();
      });
    },
    closeFullscreen(): void {
      (this.$refs.zoomModal as InstanceType<typeof CardZoomModal> | undefined)?.close();
    },
    /*
     * Fullscreen primary action — DRAFT mode. Equivalent to pressing
     * the per-card "ВЫБРАТЬ" in the grid: replaces the selection,
     * closes the fullscreen, and submits. One click commits.
     */
    onFullscreenDraftSelect(): void {
      if (this.zoomCard === undefined || this.isCardDisabled(this.zoomCard.name)) {
        return;
      }
      this.selected = [this.zoomCard.name];
      this.closeFullscreen();
      this.submitNow();
    },
    /*
     * Fullscreen primary action — BUY (multi-select) mode. Toggles the
     * card's selection but KEEPS the fullscreen open: with in-viewer
     * navigation (the `cards` list), the player browses + picks several
     * cards without leaving fullscreen, and the card's own halo/ribbon
     * (`:selected`) plus the button label flip in place to confirm the
     * toggle. They exit via ЗАКРЫТЬ / Esc / backdrop when done. A toggle
     * never removes the card from the list, so we stay on it (spec: a
     * non-removing action keeps the current card).
     */
    onFullscreenBuyToggle(): void {
      if (this.zoomCard === undefined || this.isCardDisabled(this.zoomCard.name)) {
        return;
      }
      this.toggleSelected(this.zoomCard.name);
    },
    /*
     * Per-card action button label. Steam-like — draft cards always
     * read "ВЫБРАТЬ" (one click commits). Buy cards toggle between
     * "ВЫБРАТЬ" and "СНЯТЬ ВЫБОР" to telegraph the current state.
     */
    actionLabel(name: CardName): string {
      if (!this.isMultiSelect) {
        // An "add resource to a card" pick (AddResourcesToCard) reads as a
        // confirmation to add HERE — surface the add verb the server sent
        // ("Добавить ресурс(ы)") instead of a generic "ВЫБРАТЬ", so a forced
        // single-target add doesn't look like an arbitrary selection.
        const bl = typeof this.playerinput.buttonLabel === 'string' ? this.playerinput.buttonLabel : '';
        if (bl === 'Add resource' || bl === 'Add resources') {
          return translateText(bl);
        }
        return translateText('Select');
      }
      return this.isSelected(name) ? translateText('Unselect') : translateText('Select');
    },
    /*
     * Disable the per-card "ВЫБРАТЬ" button in buy mode when the
     * player is already at `max` selections AND this card isn't one
     * of the already-selected. They'd need to deselect another
     * first. Draft buttons are never disabled here — all four
     * cards are valid commits.
     */
    actionDisabled(name: CardName): boolean {
      if (!this.isMultiSelect) {
        return false;
      }
      return !this.isSelected(name) && this.isMaxedOut;
    },
    actionTooltip(name: CardName): string {
      if (!this.actionDisabled(name)) {
        return '';
      }
      return translateText('Already selected ${0} of ${1} — deselect a card first')
        .replace('${0}', String(this.selected.length))
        .replace('${1}', String(this.playerinput.max));
    },
    translateLabel(key: string): string {
      return translateText(key);
    },
  },
});
</script>
