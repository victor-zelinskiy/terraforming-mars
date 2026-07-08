<template>
  <!-- Teleported: a `position: fixed` card inside a transformed/filtered
       ancestor is positioned against THAT ancestor; the body is the only safe
       containing block. -->
  <Teleport to="body">
    <div
      v-if="state.open && state.review !== undefined"
      class="mbr-overlay"
      :class="{'mbr-overlay--peek': state.peek}"
      :key="state.nonce"
      role="dialog"
      :aria-label="$t('MarsBot turn review')"
    >
      <div class="mbr-overlay__backdrop" @click="close"></div>
      <div class="mbr-overlay__card">
        <span class="mbr-overlay__tick mbr-overlay__tick--tl" aria-hidden="true"></span>
        <span class="mbr-overlay__tick mbr-overlay__tick--br" aria-hidden="true"></span>
        <header class="mbr-overlay__head">
          <span class="mbr-overlay__title" v-i18n>Turn review</span>
          <button type="button" class="mbr-overlay__close" :aria-label="$t('Close')" @click="close">
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <div class="mbr-overlay__scroll">
          <BotTurnReviewBody :review="state.review" :players="players" @peek="onPeek" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * Desktop «Разбор хода» — a centred glass modal that shows the STATIC,
 * structured summary of a bot turn (opened from the compact turn card's
 * «Осмотреть», the journal's «Осмотреть ход», or auto-opened in 'theater'
 * mode). Read-only over an archived script — there is no playback. Suppressed
 * in console mode (`ConsoleBotTurnReview` renders the SAME state there).
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from './botTurnReviewState';
import BotTurnReviewBody from './BotTurnReviewBody.vue';

export default defineComponent({
  name: 'BotTurnReviewOverlay',
  components: {BotTurnReviewBody},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {
      state: botTurnReviewState,
      onKey: (e: KeyboardEvent) => {
        if (e.code === 'Escape' && botTurnReviewState.open) {
          if (botTurnReviewState.peek) {
            setBotReviewPeek(false);
          } else {
            closeBotTurnReview();
          }
        }
      },
      // One-shot restore: while peeking, the very next pointer/key input brings
      // the review back (per "возврат в разбор любой кнопкой").
      onPeekInput: (_e: Event) => {
        if (botTurnReviewState.peek) {
          setBotReviewPeek(false);
        }
      },
    };
  },
  watch: {
    'state.peek'(active: boolean) {
      if (active) {
        // Capture phase + `once` per event so the restoring click doesn't also
        // hit whatever is under the (now click-through) overlay.
        window.addEventListener('pointerdown', this.onPeekInput, {capture: true, once: true});
        window.addEventListener('keydown', this.onPeekInput, {capture: true, once: true});
      } else {
        window.removeEventListener('pointerdown', this.onPeekInput, true);
        window.removeEventListener('keydown', this.onPeekInput, true);
      }
    },
  },
  methods: {
    close(): void {
      closeBotTurnReview();
    },
    onPeek(spaceId: SpaceId): void {
      setBotReviewPeek(true, spaceId);
    },
  },
  mounted() {
    document.addEventListener('keydown', this.onKey);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKey);
  },
});
</script>
