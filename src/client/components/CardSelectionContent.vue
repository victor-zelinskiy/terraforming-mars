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
  <div class="card-selection">

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
    <div class="card-selection__cards">
      <div v-for="card in playerinput.cards"
           :key="card.name"
           class="card-selection__card-slot"
           :class="{ 'card-selection__card-slot--selected': isSelected(card.name) }"
           :data-test="'card-selection-' + card.name">
        <div class="card-selection__card-clickable"
             @click.capture.stop="openFullscreen(card)">
          <Card :card="card" />
        </div>
        <button class="card-selection__card-action-btn"
                :class="{
                  'card-selection__card-action-btn--selected': isBuyMode && isSelected(card.name),
                }"
                :disabled="actionDisabled(card.name)"
                :title="actionTooltip(card.name)"
                @click="onActionClick(card.name)"
                data-test="card-selection-action">
          {{ actionLabel(card.name) }}
        </button>
      </div>
    </div>

    <!--
      Bottom confirm footer — ONLY in buy mode. Draft selection is
      committed by the per-card "ВЫБРАТЬ" button above; there's no
      second confirmation step. Buy mode keeps the footer because
      multi-card toggling needs an explicit final commit.
    -->
    <footer v-if="isBuyMode" class="card-selection__footer">
      <button class="card-selection__confirm"
              :disabled="!canConfirm"
              :title="confirmTooltip"
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
                   :selected="isSelected(zoomCard.name)"
                   @close="zoomCard = undefined">
      <template #actions>
        <button v-if="!isBuyMode"
                class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                @click="onFullscreenDraftSelect"
                data-test="card-selection-fullscreen-select">
          {{ translateLabel('Select') }}
        </button>
        <button v-else
                class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                :class="{ 'card-zoom-actions__btn--unselect': isSelected(zoomCard.name) }"
                :disabled="!isSelected(zoomCard.name) && isMaxedOut"
                :title="fullscreenToggleTooltip"
                @click="onFullscreenBuyToggle"
                data-test="card-selection-fullscreen-toggle">
          {{ isSelected(zoomCard.name) ? translateLabel('Unselect') : translateLabel('Select') }}
        </button>
      </template>
    </CardZoomModal>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {SelectCardResponse} from '@/common/inputs/InputResponse';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {setDraftWaitPending, clearDraftWaitPending} from '@/client/components/draftWaitState';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

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
};

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
      }
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
      if (this.selected.length < this.playerinput.min) return false;
      if (this.totalCost > this.playerMC) return false;
      return true;
    },
    titleText(): string {
      if (this.isBuyMode) {
        return translateText('Buy up to ${0} cards').replace('${0}', String(this.playerinput.max));
      }
      if (this.isSingleSelect) {
        return translateText('Choose a card');
      }
      /* Fallback for "select N cards" prompts that aren't buy and
       * aren't single-select — render server's localized title. */
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    counterText(): string {
      if (this.isSingleSelect) {
        return translateText('1 card out of ${0}').replace('${0}', String(this.playerinput.cards.length));
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
        return this.selected.length === 0
          ? translateText('Skip')
          : translateText('Buy');
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
      if (!this.isBuyMode || this.zoomCard === undefined) return '';
      if (this.isSelected(this.zoomCard.name)) return '';
      if (this.isMaxedOut) {
        return translateText('Already selected ${0} of ${1} — deselect a card first')
          .replace('${0}', String(this.selected.length))
          .replace('${1}', String(this.playerinput.max));
      }
      return '';
    },
  },
  methods: {
    isSelected(name: CardName): boolean {
      return this.selected.includes(name);
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
      if (this.isBuyMode) {
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
      if (!this.canConfirm) return;
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
      if (this.isBuyMode) {
        clearDraftWaitPending();
      } else {
        setDraftWaitPending();
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
      if (this.zoomCard === undefined) return;
      this.selected = [this.zoomCard.name];
      this.closeFullscreen();
      this.submitNow();
    },
    /*
     * Fullscreen primary action — BUY mode. Toggles the card's
     * selection AND closes the fullscreen, so the player sees the
     * updated grid state immediately without a second click. The
     * earlier "stay open after toggle" behavior added one extra
     * click for the common case ("pick / unpick and move on") and
     * the grid behind is the canonical place to review choices —
     * collapsing fullscreen on toggle gets the player there
     * faster. To inspect another card, the player single-clicks
     * it from the grid.
     */
    onFullscreenBuyToggle(): void {
      if (this.zoomCard === undefined) return;
      this.toggleSelected(this.zoomCard.name);
      this.closeFullscreen();
    },
    /*
     * Per-card action button label. Steam-like — draft cards always
     * read "ВЫБРАТЬ" (one click commits). Buy cards toggle between
     * "ВЫБРАТЬ" and "СНЯТЬ ВЫБОР" to telegraph the current state.
     */
    actionLabel(name: CardName): string {
      if (!this.isBuyMode) return translateText('Select');
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
      if (!this.isBuyMode) return false;
      return !this.isSelected(name) && this.isMaxedOut;
    },
    actionTooltip(name: CardName): string {
      if (!this.actionDisabled(name)) return '';
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
