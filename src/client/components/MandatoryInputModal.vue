<!--
@console-shared LIVE — console native stands on this file, so it is NOT covered
by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
Before changing it, check the console consumers in DESKTOP_DEPRECATION_AUDIT.md.
-->
<template>
  <!--
    Teleport to body so the modal escapes any ancestor's clip-path /
    overflow / transform contexts (`#player-home` and its descendants apply
    several of these). Without it the backdrop is clipped by sci-fi
    parallelogram chrome on bar buttons and similar.
  -->
  <!--
    Two separate teleports — independent stacking contexts so the pill
    can sit at a lower z-index than bar-overlays (Awards / Milestones /
    Standard Projects panels). When the player opens one of those
    overlays to inspect info before deciding, the overlay cleanly
    covers the pill instead of the pill floating on top of the
    overlay's content.
  -->
  <Teleport to="body">
    <div :class="rootClass">
      <!--
        Backdrop swallows pointer events to block interaction with
        everything behind. NO @click handler — the modal is mandatory by
        contract, so clicking outside must not dismiss it. Players exit by
        completing the prompt (or via the input's own Reset path).

        In picker-mode (set by a nested OrOptions whose selected option is
        a board-picker SelectSpace), the backdrop becomes transparent and
        click-through so the player can interact with the game board
        underneath. In minimized mode the backdrop also becomes
        click-through so the player can navigate / inspect freely while
        the prompt is waiting up top.
      -->
      <div class="mandatory-input-modal__backdrop" @click="onBackdropClick"></div>

      <!-- Sci-fi glass card centered on the viewport. Slot for any input
           component the host wants to host inside the modal. -->
      <div ref="card" class="mandatory-input-modal__card">
        <div class="mandatory-input-modal__corner mandatory-input-modal__corner--tl"></div>
        <div class="mandatory-input-modal__corner mandatory-input-modal__corner--tr"></div>
        <div class="mandatory-input-modal__corner mandatory-input-modal__corner--bl"></div>
        <div class="mandatory-input-modal__corner mandatory-input-modal__corner--br"></div>

        <!--
          Minimize button — sits in the top-right area of the card,
          outside any hosted content. Sci-fi parallelogram chrome matching
          the rest of the fork. Hides the modal into a pill at the top
          of the viewport so the player can inspect the rest of the UI
          (board, other players' resources, top-bar overlays) before
          committing to a decision. Click the pill to bring it back.

          Opt-out via `:minimizable="false"` — used by purely client-side
          confirmation modals (e.g. PassConfirm) where minimizing makes no
          sense because the prompt is a yes/no on data the player already
          has in hand. Letting them minimize a confirmation would just
          turn the pill into a dead-end nag with no information to gather.
        -->
        <button v-if="minimizable"
                class="mandatory-input-modal__minimize-btn"
                @click="minimize"
                :title="$t('Minimize — inspect the rest of the UI before deciding')"
                data-test="modal-minimize">
          <span class="mandatory-input-modal__minimize-btn-glyph">↗</span>
          <span class="mandatory-input-modal__minimize-btn-label" v-i18n>Minimize</span>
        </button>

        <slot />
      </div>
    </div>
  </Teleport>

  <!--
    Pill lives in its OWN teleport so the modal wrapper's z-index
    (12000) doesn't trap it. Sits at a low z-index (100) — above the
    board, below bar-overlays (110). When the player opens a
    bar-overlay (Awards / Milestones / Standard Projects), the overlay
    covers the pill; close the overlay and the pill is back.
  -->
  <Teleport to="body">
    <div ref="pill"
         :class="pillClass"
         role="button"
         tabindex="0"
         :title="$t('Click to expand the awaiting prompt')"
         @click="restore"
         @keydown.enter="restore"
         @keydown.space="restore"
         data-test="modal-pill">
      <!--
        Dedicated drag handle (v40-s). 6-dot sci-fi grip — two columns
        of three small cyan dots. Listens for pointerdown to start the
        drag. The pill body around it stays a click target (restores
        the modal). Splitting these means a no-drag click is
        unambiguous: clicking anywhere EXCEPT the handle restores;
        click + drag from the handle moves the pill. The 5-px
        threshold + post-drag click suppressor in `draggable.ts` is
        still in place as a belt-and-braces safety on the handle
        itself.

        `touch-action: none` (in CSS) prevents the browser's default
        touch gesture (panning the page) on the handle, so a
        touchscreen drag is honored as a drag, not a scroll.
        `aria-hidden` keeps the handle out of the AT label since it's
        a pure visual affordance — keyboard users restore via Enter/
        Space on the pill (the existing focus / keydown handlers).
      -->
      <span ref="pillHandle"
            class="mandatory-input-modal-pill__handle"
            :title="$t('Drag to reposition')"
            aria-hidden="true"
            data-test="modal-pill-handle">
        <span></span><span></span>
        <span></span><span></span>
        <span></span><span></span>
      </span>
      <span class="mandatory-input-modal-pill__dot"></span>
      <span class="mandatory-input-modal-pill__label" v-i18n>AWAITING DECISION</span>
      <span class="mandatory-input-modal-pill__sep">/</span>
      <span class="mandatory-input-modal-pill__title">{{ titleText }}</span>
      <span class="mandatory-input-modal-pill__restore" :title="$t('Restore')">⤢</span>
    </div>
  </Teleport>

  <!--
    Picker-mode placement banner. When the modal's nested OrOptions
    picks a SelectSpace option (currently the WGT "Add an ocean"
    prompt, but also any future nested SelectSpace hosted in a
    modal), we mount the same banner used for top-level mandatory
    placements. Banner is teleported to body (independent stacking
    context) so it sits at the top of the viewport while the modal
    card has faded + shifted under picker-mode CSS.

    `cancellable: false` — the nested picker IS cancellable in the
    sense that the player can pick a different option in the host
    OrOptions, but they do that by hovering the faded modal card
    (which rises back to full opacity) and clicking another radio.
    Exposing a Cancel button on the banner would duplicate that
    affordance and confuse the cancel semantics. Banner stays an
    info-only signal here.
  -->
  <PlacementBanner v-if="pickerMode"
                   :title="pickerTitle"
                   :cancellable="false" />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Message} from '@/common/logs/Message';
import {translateText, translateMessage} from '@/client/directives/i18n';
import PlacementBanner from '@/client/components/PlacementBanner.vue';
import {setModalPickerActive} from '@/client/components/placementLockState';
import {makeDraggable, DraggableController, DraggablePosition} from '@/client/components/draggable';
import {acquireForegroundLease} from '@/client/components/presentation/presentationFlow';
import {notificationBus} from '@/client/components/notifications/notificationBus';

// Injection key for the picker-mode setter exposed by the modal to its
// descendants. A nested OrOptions whose selected option is a board-picker
// (SelectSpace) calls this with `true` so the modal can step aside and
// let the player click the board. When the player picks a different
// (non-picker) option in the same OrOptions, OrOptions calls it again
// with `false` to restore the modal. The injected function is `undefined`
// when the input is not hosted in a modal (e.g. the legacy inline path),
// so OrOptions guards every call.
export const MANDATORY_MODAL_PICKER_SETTER = 'mandatoryModalSetPickerMode';

type DataModel = {
  pickerMode: boolean;
  /*
   * Title of the picker-mode prompt — the SelectSpace option's title
   * captured when OrOptions notified us. Used to seed the always-
   * visible PlacementBanner that announces "AWAITING PLACEMENT /
   * <option title>" so the player can't miss that the game is now
   * waiting for them to click the board.
   */
  pickerTitle: string | Message | undefined;
  minimized: boolean;
  /*
   * True once the modal's entrance animation has completed. Hosted card
   * grids (draft / research / initial-draft) gate their per-card "deal"
   * entrance on the `--entered` class this drives, so the cards don't
   * animate (and don't paint) while the modal itself is still sliding in
   * + the heavy initial card layout is settling — that overlap was the
   * source of the first-frame stutter. Subsequent draft rounds (modal
   * already entered) deal immediately. See card_selection.less.
   */
  entered: boolean;
  enterTimer: number | undefined;
  /*
   * Frozen-at-mount copy of `!dealContent`. When true, hosted card grids
   * skip their deal entrance (`--no-deal`). Frozen so the parent can mark
   * the step "dealt" right after the first show without retroactively
   * cutting the deal that just started.
   */
  noDealFrozen: boolean;
  /*
   * Pixel offset from the pill's default centred-top position. The
   * pill is draggable so the player can move it if it covers a
   * board cell they need to click. Persisted within the modal's
   * lifetime — resets when the modal unmounts.
   */
  pillDragOffset: DraggablePosition;
  pillDragController: DraggableController | null;
  /** Release fn of the held 'mandatory-choice' presentation lease. */
  releaseLease: (() => void) | undefined;
};

export default defineComponent({
  name: 'MandatoryInputModal',
  components: {
    PlacementBanner,
  },
  props: {
    // Prompt title — used in the minimized pill so the player knows
    // what's waiting even when the modal is collapsed. Accepts the same
    // `string | Message` shape every PlayerInput model uses.
    title: {
      type: [String, Object] as unknown as () => string | Message,
      required: false,
      default: '',
    },
    // Whether the player may collapse the modal into a pill to look around
    // the UI before deciding. ON by default (the common case — payment
    // selection, fund award, WGT — all benefit from letting the player
    // inspect tableaus / board state first). Turn OFF for pure yes/no
    // confirmation prompts where there's nothing left to inspect.
    minimizable: {
      type: Boolean,
      default: true,
    },
    /*
     * Whether hosted card grids should play their per-card "deal" entrance
     * when this modal opens. Default true (every fresh deal animates). Set
     * false when the SAME cards are being re-shown and were already dealt
     * once — e.g. returning to an already-visited initial-draft step via
     * the pill stack. Captured ONCE at mount into `noDealFrozen` so a later
     * reactive flip of this prop can't cut a deal that's already running.
     */
    dealContent: {
      type: Boolean,
      default: true,
    },
    /*
     * Temporarily HIDE the whole modal (backdrop + card) WITHOUT unmounting it,
     * so the hosted content keeps its state. Used when a client-driven sub-pick
     * hands off to a higher-z surface — the card-action confirm modal suppresses
     * itself while the КАРТЫ В РУКЕ overlay (z 110, below the modal's 12000) is
     * shown for a "pick a card from hand" step, then re-shows with the result.
     */
    suppressed: {
      type: Boolean,
      default: false,
    },
  },
  data(): DataModel {
    return {
      pickerMode: false,
      pickerTitle: undefined,
      minimized: false,
      entered: false,
      enterTimer: undefined,
      noDealFrozen: !this.dealContent,
      pillDragOffset: {x: 0, y: 0},
      pillDragController: null,
      releaseLease: undefined,
    };
  },
  computed: {
    /*
     * PRESENTATION FLOW occupancy: the modal blocks the presentation slot
     * only while it is EFFECTIVELY covering the screen. Minimized (pill),
     * suppressed (handed off to a higher surface) and picker-mode (board
     * interactive) states release the lease so queued notifications may
     * present.
     */
    effectivelyBlocking(): boolean {
      return !this.minimized && !this.suppressed && !this.pickerMode;
    },
    rootClass(): string {
      const classes = ['mandatory-input-modal'];
      if (this.pickerMode) {
        classes.push('mandatory-input-modal--picker-mode');
      }
      if (this.minimized) {
        classes.push('mandatory-input-modal--minimized');
      }
      if (this.entered) {
        classes.push('mandatory-input-modal--entered');
      }
      if (this.noDealFrozen) {
        classes.push('mandatory-input-modal--no-deal');
      }
      if (this.suppressed) {
        classes.push('mandatory-input-modal--suppressed');
      }
      return classes.join(' ');
    },
    pillClass(): string {
      const classes = ['mandatory-input-modal-pill'];
      if (this.minimized) {
        classes.push('mandatory-input-modal-pill--visible');
      }
      return classes.join(' ');
    },
    titleText(): string {
      const t = this.title;
      if (t === undefined || t === '') {
        return '';
      }
      if (typeof t === 'string') {
        return translateText(t);
      }
      return translateMessage(t);
    },
  },
  watch: {
    // If the host swaps the modal contents to a new prompt (e.g. one
    // SelectPayment resolves and the next one fires without unmounting),
    // reset the minimized state so the new prompt isn't silently buried
    // in the pill the player wasn't expecting.
    title() {
      this.minimized = false;
    },
    // Keep the 'mandatory-choice' presentation lease in lockstep with the
    // modal's effective visibility (see `effectivelyBlocking`).
    effectivelyBlocking: {
      immediate: true,
      handler(blocking: boolean): void {
        if (blocking && this.releaseLease === undefined) {
          this.releaseLease = acquireForegroundLease('mandatory-choice');
        } else if (!blocking && this.releaseLease !== undefined) {
          this.releaseLease();
          this.releaseLease = undefined;
        }
      },
    },
  },
  provide() {
    return {
      [MANDATORY_MODAL_PICKER_SETTER]: (mode: boolean, title?: string | Message) => {
        this.pickerMode = mode;
        this.pickerTitle = mode ? title : undefined;
        // Entering picker-mode (board tile selection) implicitly cancels
        // any minimize state — the modal is hidden via picker rules and
        // showing a pill on top would be redundant signaling.
        if (mode) {
          this.minimized = false;
        }
        /*
         * Raise the modal-picker source of placement-pending in the
         * shared coordinator. PlayerHome's `placementPending` computed
         * reads this and triggers the global placement lock (body
         * class + JS click guard + native title tooltips + Pass/End-
         * turn hide) — same UX as the convert-plants picker, just
         * driven by a different source. Title carries through to the
         * PlacementBanner mounted below.
         */
        setModalPickerActive(mode, title);
      },
    };
  },
  mounted() {
    // While the modal is up, lock both html AND body from scrolling so
    // the darkened backdrop doesn't reveal a scrollbar gutter and the
    // page can't be wheeled around the modal. Setting on both elements
    // is necessary because the page's main scroll container can be
    // either depending on which CSS reset / layout rules win.
    document.documentElement.classList.add('mandatory-input-modal-open');
    document.body.classList.add('mandatory-input-modal-open');
    /* Wire up drag on the minimized pill (ref="pill"). The dedicated
     * 6-dot handle (ref="pillHandle") is the pointer-listening
     * surface; the pill body itself is left for clicks → restore.
     * Drag controller lives until beforeUnmount; gestures only fire
     * when the pill is actually present on screen (it's hidden by
     * opacity: 0 until the --visible class is applied), so installing
     * the listener here regardless of minimized state is safe. */
    const pillEl = this.$refs.pill as HTMLElement | undefined;
    const pillHandleEl = this.$refs.pillHandle as HTMLElement | undefined;
    if (pillEl !== undefined) {
      this.pillDragController = makeDraggable(
        pillEl,
        this.pillDragOffset,
        {handle: pillHandleEl},
      );
    }
    /*
     * Mark the modal "entered" once its card-in animation finishes, so
     * hosted card grids only START their deal-in entrance after the modal
     * has settled (no overlap with the modal's own transform animation +
     * the heavy initial card mount → no first-frame stutter). The
     * animationend is the precise signal; a fallback timer guarantees the
     * flag flips even if the event is missed (reduced-motion, the card
     * never animating, etc.) so cards can never get stuck hidden.
     */
    const cardEl = this.$refs.card as HTMLElement | undefined;
    if (cardEl !== undefined) {
      cardEl.addEventListener('animationend', this.onCardAnimEnd);
    }
    this.enterTimer = window.setTimeout(() => this.markEntered(), 360);
    // The premium notification system's "Go to action" CTA fires this when a
    // mandatory prompt is pending but minimized — restore the modal so the
    // player can act. No-op when already expanded.
    (this as unknown as {__notifOff: () => void}).__notifOff = notificationBus.goToAction.on(this.onNotificationGoToAction);
  },
  beforeUnmount() {
    this.releaseLease?.();
    this.releaseLease = undefined;
    (this as unknown as {__notifOff?: () => void}).__notifOff?.();
    document.documentElement.classList.remove('mandatory-input-modal-open');
    document.body.classList.remove('mandatory-input-modal-open');
    if (this.enterTimer !== undefined) {
      window.clearTimeout(this.enterTimer);
      this.enterTimer = undefined;
    }
    const cardEl = this.$refs.card as HTMLElement | undefined;
    if (cardEl !== undefined) {
      cardEl.removeEventListener('animationend', this.onCardAnimEnd);
    }
    this.pillDragController?.destroy();
    this.pillDragController = null;
    /* Defensive: if the modal unmounts mid-picker (server resolved
     * the prompt, modal v-if flips to false), don't leave the
     * modal-picker source raised in the shared coordinator. Without
     * this the global lock would persist on whatever the next
     * playerView state is. */
    setModalPickerActive(false, undefined);
  },
  methods: {
    markEntered(): void {
      if (this.entered) {
        return;
      }
      this.entered = true;
      if (this.enterTimer !== undefined) {
        window.clearTimeout(this.enterTimer);
        this.enterTimer = undefined;
      }
    },
    onCardAnimEnd(e: AnimationEvent): void {
      // Only the modal's own entrance animation flips the flag — ignore
      // any other animations bubbling up from hosted content.
      if (e.animationName === 'mandatory-input-modal-card-in') {
        this.markEntered();
      }
    },
    minimize(): void {
      this.minimized = true;
    },
    restore(): void {
      this.minimized = false;
    },
    onNotificationGoToAction(): void {
      if (this.minimized) {
        this.restore();
      }
    },
    onBackdropClick(): void {
      // Backdrop never dismisses (modal is mandatory). When minimized
      // the backdrop is click-through anyway; in normal mode this
      // handler is a no-op — but kept as an explicit attach point in
      // case we add a confirmation flow later.
    },
  },
});
</script>
