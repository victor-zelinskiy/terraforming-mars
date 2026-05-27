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
      <div class="mandatory-input-modal__card">
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
        -->
        <button class="mandatory-input-modal__minimize-btn"
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
    <div :class="pillClass"
         role="button"
         tabindex="0"
         :title="$t('Click to expand the awaiting prompt')"
         @click="restore"
         @keydown.enter="restore"
         @keydown.space="restore"
         data-test="modal-pill">
      <span class="mandatory-input-modal-pill__dot"></span>
      <span class="mandatory-input-modal-pill__label" v-i18n>AWAITING DECISION</span>
      <span class="mandatory-input-modal-pill__sep">/</span>
      <span class="mandatory-input-modal-pill__title">{{ titleText }}</span>
      <span class="mandatory-input-modal-pill__restore" :title="$t('Restore')">⤢</span>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Message} from '@/common/logs/Message';
import {translateText, translateMessage} from '@/client/directives/i18n';

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
  minimized: boolean;
};

export default defineComponent({
  name: 'MandatoryInputModal',
  props: {
    // Prompt title — used in the minimized pill so the player knows
    // what's waiting even when the modal is collapsed. Accepts the same
    // `string | Message` shape every PlayerInput model uses.
    title: {
      type: [String, Object] as unknown as () => string | Message,
      required: false,
      default: '',
    },
  },
  data(): DataModel {
    return {
      pickerMode: false,
      minimized: false,
    };
  },
  computed: {
    rootClass(): string {
      const classes = ['mandatory-input-modal'];
      if (this.pickerMode) classes.push('mandatory-input-modal--picker-mode');
      if (this.minimized) classes.push('mandatory-input-modal--minimized');
      return classes.join(' ');
    },
    pillClass(): string {
      const classes = ['mandatory-input-modal-pill'];
      if (this.minimized) classes.push('mandatory-input-modal-pill--visible');
      return classes.join(' ');
    },
    titleText(): string {
      const t = this.title;
      if (t === undefined || t === '') return '';
      if (typeof t === 'string') return translateText(t);
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
  },
  provide() {
    return {
      [MANDATORY_MODAL_PICKER_SETTER]: (mode: boolean) => {
        this.pickerMode = mode;
        // Entering picker-mode (board tile selection) implicitly cancels
        // any minimize state — the modal is hidden via picker rules and
        // showing a pill on top would be redundant signaling.
        if (mode) this.minimized = false;
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
  },
  beforeUnmount() {
    document.documentElement.classList.remove('mandatory-input-modal-open');
    document.body.classList.remove('mandatory-input-modal-open');
  },
  methods: {
    minimize(): void {
      this.minimized = true;
    },
    restore(): void {
      this.minimized = false;
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
