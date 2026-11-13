<template>
  <Teleport to="body">
    <!-- The shell's generic layer fade — this full-bleed surface used to be
         the one overlay that hard-cut in and out with no entry at all. -->
    <transition name="con-layer" appear>
    <div
      v-if="state.open && state.review !== undefined"
      class="con-bot-review"
      :class="{'con-bot-review--peek': state.peek}"
      :key="state.nonce"
      role="dialog"
      :aria-label="$t('MarsBot turn review')"
    >
      <div class="con-bot-review__panel">
        <header class="con-bot-review__head">
          <span class="con-bot-review__title" v-i18n>Turn review</span>
        </header>
        <!-- LB/RB turn-navigation boundary toast (no earlier / next-not-made). -->
        <BotReviewEdgeNotice large />
        <div class="con-bot-review__scroll">
          <BotTurnReviewBody :review="state.review" :players="players" large @peek="onPeek" @zoom-bonus="onZoomBonus" />
        </div>
        <!-- The review is a COMPLETE surface: its own bottom command bar (like
             the main screen) — no board sliver, hints never hunted. -->
        <div class="con-bot-review__bar">
          <ConsoleCommandBar :context="context" :commands="commands" />
        </div>
      </div>
    </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
/*
 * Teleported: a `position: fixed` overlay inside a transformed/filtered
 * ancestor is positioned against THAT ancestor; the body is the safe
 * containing block.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * Console-native «Разбор хода» — a TV/Steam-Deck-readable FULLSCREEN summary
 * of a bot turn, replaying the SAME `botTurnReviewState` as the desktop overlay
 * (which is suppressed in console mode). It COVERS the whole screen (no board
 * gap) and carries its OWN bottom command bar. Input routing stays in
 * ConsoleShell (B closes, X inspects the card — bonus AND project turns now open
 * the SAME union CardZoomModal browser there, L3 = show on map).
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {botTurnReviewState, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import BotTurnReviewBody from '@/client/components/marsbot/BotTurnReviewBody.vue';
import BotReviewEdgeNotice from '@/client/components/marsbot/BotReviewEdgeNotice.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';

defineOptions({name: 'ConsoleBotTurnReview'});
defineProps({
  players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
});

const state = botTurnReviewState;
const context = computed((): string => {
  return 'Turn review';
});
/** The bar mirrors ConsoleShell's input contract for the review-open state.
 *  (While the union CardZoomModal is open it renders its OWN hints in the
 *  fullscreen dialog above this bar, so this contract covers only the
 *  review-visible state.) */
const commands = computed((): Array<ConsoleCommand> => {
  if (state.peek) {
    return [{control: 'back', label: 'Back'}];
  }
  const cmds: Array<ConsoleCommand> = [];
  // A bonus turn → X opens the full-rules card; a project turn → the played cards.
  const inspectable = state.review?.card?.kind === 'bonus' || (state.review?.cardNames.length ?? 0) > 0;
  if (inspectable) {
    cmds.push({control: 'secondary', label: 'Inspect card'});
  }
  // LB / RB step between the bot's archived turns (edge toast at a boundary).
  // Always hinted while the review is up — the standard turn-nav controls,
  // the console analog of the desktop's always-visible ◀/▶ buttons.
  cmds.push({control: 'bumperL', label: 'Previous turn'});
  cmds.push({control: 'bumperR', label: 'Next turn'});
  if ((state.review?.tiles.length ?? 0) > 0) {
    cmds.push({control: 'stickL', label: 'Show on map'});
  }
  cmds.push({control: 'back', label: 'Close'});
  return cmds;
});
function onPeek(spaceId: SpaceId): void {
  setBotReviewPeek(true, [spaceId]);
}
// A touch on a bonus chip opens the SAME union CardZoomModal the gamepad X
// uses (ConsoleShell mounts it, driven by consoleCardZoom) — so console has
// ONE fullscreen card surface. Single entry: this specific bonus card.
function onZoomBonus(id: BonusCardId): void {
  if (state.review !== undefined) {
    // Opened from a bonus chip in the turn review (no card tile) → TEXTUAL.
    openConsoleCardZoom([bonusZoomEntry(id, state.review.ctx)], 0, undefined, undefined, {contextLabel: 'MarsBot turn', origin: {kind: 'textual'}});
  }
}
</script>
