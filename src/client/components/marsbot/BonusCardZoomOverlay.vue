<template>
  <Teleport to="body">
    <div
      v-if="state.open && state.id !== undefined"
      class="bcz"
      :key="state.nonce"
      role="dialog"
      :aria-label="$t('Automa bonus card')"
      @click.self="close"
    >
      <span class="bcz__kicker" v-i18n>Automa bonus card</span>
      <div class="bcz__card">
        <BonusCardFace :id="state.id" :ctx="state.ctx" large />
      </div>
      <!-- Same Close footer as a normal fullscreen card. -->
      <div class="card-zoom-actions">
        <div class="card-zoom-actions__panel">
          <span class="card-zoom-actions__corner card-zoom-actions__corner--tl" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--tr" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--bl" aria-hidden="true"></span>
          <span class="card-zoom-actions__corner card-zoom-actions__corner--br" aria-hidden="true"></span>
          <button class="card-zoom-actions__btn card-zoom-actions__btn--secondary" @click="close">
            <span v-i18n>Close</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * The FULLSCREEN inspect of an Automa bonus card — a premium framed
 * `BonusCardFace` (its own Automa visual identity, NOT a fake project card)
 * showing the card's FULL rule text + fate. Opened by X from the review; the
 * review itself never duplicates this full text. Desktop closes on
 * backdrop/Esc; console closes with B (handled in ConsoleShell), so the close
 * button is hidden there.
 */
import {defineComponent} from 'vue';
import {bonusCardZoomState, closeBonusCardZoom} from './bonusCardZoomState';
import BonusCardFace from './BonusCardFace.vue';

export default defineComponent({
  name: 'BonusCardZoomOverlay',
  components: {BonusCardFace},
  props: {
    /** Console hides the close button (B closes via the command bar). */
    console: {type: Boolean, default: false},
  },
  data() {
    return {
      state: bonusCardZoomState,
      onKey: (e: KeyboardEvent) => {
        if (e.code === 'Escape' && bonusCardZoomState.open) {
          e.stopPropagation();
          closeBonusCardZoom();
        }
      },
    };
  },
  methods: {
    close(): void {
      closeBonusCardZoom();
    },
  },
  mounted() {
    document.addEventListener('keydown', this.onKey, true);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey, true);
  },
});
</script>
