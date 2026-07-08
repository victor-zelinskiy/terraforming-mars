<template>
  <Teleport to="body">
    <div
      v-if="state.open && state.id !== undefined"
      class="bcz"
      :key="state.nonce"
      role="dialog"
      :aria-label="$t('Bonus card')"
      @click.self="close"
    >
      <div class="bcz__frame">
        <span class="bcz__tick bcz__tick--tl" aria-hidden="true"></span>
        <span class="bcz__tick bcz__tick--br" aria-hidden="true"></span>
        <header class="bcz__head">
          <span class="bcz__kicker" v-i18n>Automa bonus card</span>
          <button v-if="!console" type="button" class="bcz__close" :aria-label="$t('Close')" @click="close">
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div class="bcz__card">
          <BonusCardFace :id="state.id" :ctx="state.ctx" large />
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
