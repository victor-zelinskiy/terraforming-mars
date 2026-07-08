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
          <!-- Turn navigation (desktop solution): ◀ previous / next ▶ across the
               bot's archived turns. Disabled at a boundary, with a premium
               tooltip on the (non-disabled) wrapper naming why — the desktop
               analog of the console LB/RB edge toast. -->
          <div class="mbr-overlay__nav">
            <span class="mbr-overlay__nav-slot" :data-hint="hasPrev ? '' : $t('Previous turn unavailable')">
              <button type="button" class="mbr-overlay__navbtn" :disabled="!hasPrev"
                      :aria-label="$t('Previous turn')" @click="stepPrev">
                <span aria-hidden="true">⟨</span>
              </button>
            </span>
            <span class="mbr-overlay__nav-slot" :data-hint="hasNext ? '' : $t('The next turn has not been played yet')">
              <button type="button" class="mbr-overlay__navbtn" :disabled="!hasNext"
                      :aria-label="$t('Next turn')" @click="stepNext">
                <span aria-hidden="true">⟩</span>
              </button>
            </span>
          </div>
          <button type="button" class="mbr-overlay__close" :aria-label="$t('Close')" @click="close">
            <span aria-hidden="true">✕</span>
          </button>
        </header>
        <BotReviewEdgeNotice />
        <div class="mbr-overlay__scroll">
          <BotTurnReviewBody :review="state.review" :players="players" @peek="onPeek" @zoom-bonus="onZoomBonus" />
        </div>
      </div>
      <!-- Full-rules inspect for an Automa bonus card (X / click a bonus chip). -->
      <BonusCardZoomOverlay />
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
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {botTurnReviewState, closeBotTurnReview, setBotReviewPeek} from './botTurnReviewState';
import {botReviewHasAdjacentTurn, stepBotTurnReview} from './marsBotPresentation';
import {openBonusCardZoom} from './bonusCardZoomState';
import BotTurnReviewBody from './BotTurnReviewBody.vue';
import BonusCardZoomOverlay from './BonusCardZoomOverlay.vue';
import BotReviewEdgeNotice from './BotReviewEdgeNotice.vue';

export default defineComponent({
  name: 'BotTurnReviewOverlay',
  components: {BotTurnReviewBody, BonusCardZoomOverlay, BotReviewEdgeNotice},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {
      state: botTurnReviewState,
      onKey: (e: KeyboardEvent) => {
        if (!botTurnReviewState.open) {
          return;
        }
        if (e.code === 'Escape') {
          if (botTurnReviewState.peek) {
            setBotReviewPeek(false);
          } else {
            closeBotTurnReview();
          }
          return;
        }
        // Desktop turn navigation: `[` previous / `]` next (the keyboard analog
        // of the console LB/RB). A boundary flashes the edge notice via
        // stepBotTurnReview. Never hijack typing in an input.
        const t = e.target as HTMLElement | null;
        if (t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
          return;
        }
        if (e.key === '[') {
          e.preventDefault();
          stepBotTurnReview(-1);
        } else if (e.key === ']') {
          e.preventDefault();
          stepBotTurnReview(1);
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
  computed: {
    hasPrev(): boolean {
      return botReviewHasAdjacentTurn(-1);
    },
    hasNext(): boolean {
      return botReviewHasAdjacentTurn(1);
    },
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
    stepPrev(): void {
      stepBotTurnReview(-1);
    },
    stepNext(): void {
      stepBotTurnReview(1);
    },
    onPeek(spaceId: SpaceId): void {
      setBotReviewPeek(true, [spaceId]);
    },
    // Desktop opens a bonus card's full rules in the dedicated (already
    // card-zoom-styled) BonusCardZoomOverlay — a single-card inspect, matching
    // the per-chip click model of the desktop review (project chips are
    // JournalCardChip). The union CardZoomModal browser is the CONSOLE path.
    onZoomBonus(id: BonusCardId): void {
      if (this.state.review !== undefined) {
        openBonusCardZoom(id, this.state.review.ctx);
      }
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
