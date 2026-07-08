<template>
  <!-- Teleported: a `position: fixed` overlay inside a transformed/filtered
       ancestor is positioned against THAT ancestor; the body is the safe
       containing block. -->
  <Teleport to="body">
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
  </Teleport>
</template>

<script lang="ts">
/**
 * Console-native «Разбор хода» — a TV/Steam-Deck-readable FULLSCREEN summary
 * of a bot turn, replaying the SAME `botTurnReviewState` as the desktop overlay
 * (which is suppressed in console mode). It COVERS the whole screen (no board
 * gap) and carries its OWN bottom command bar. Input routing stays in
 * ConsoleShell (B closes, X inspects the card — bonus AND project turns now open
 * the SAME union CardZoomModal browser there, L3 = show on map).
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {botTurnReviewState, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import {bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import BotTurnReviewBody from '@/client/components/marsbot/BotTurnReviewBody.vue';
import BotReviewEdgeNotice from '@/client/components/marsbot/BotReviewEdgeNotice.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';

export default defineComponent({
  name: 'ConsoleBotTurnReview',
  components: {BotTurnReviewBody, BotReviewEdgeNotice, ConsoleCommandBar},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {state: botTurnReviewState};
  },
  computed: {
    context(): string {
      return 'Turn review';
    },
    /** The bar mirrors ConsoleShell's input contract for the review-open state.
     *  (While the union CardZoomModal is open it renders its OWN hints in the
     *  fullscreen dialog above this bar, so this contract covers only the
     *  review-visible state.) */
    commands(): Array<ConsoleCommand> {
      if (this.state.peek) {
        return [{control: 'back', label: 'Back'}];
      }
      const cmds: Array<ConsoleCommand> = [];
      // A bonus turn → X opens the full-rules card; a project turn → the played cards.
      const inspectable = this.state.review?.card?.kind === 'bonus' || (this.state.review?.cardNames.length ?? 0) > 0;
      if (inspectable) {
        cmds.push({control: 'secondary', label: 'Inspect card'});
      }
      // LB / RB step between the bot's archived turns (edge toast at a boundary).
      // Always hinted while the review is up — the standard turn-nav controls,
      // the console analog of the desktop's always-visible ◀/▶ buttons.
      cmds.push({control: 'bumperL', label: 'Previous turn'});
      cmds.push({control: 'bumperR', label: 'Next turn'});
      if ((this.state.review?.tiles.length ?? 0) > 0) {
        cmds.push({control: 'stickL', label: 'Show on map'});
      }
      cmds.push({control: 'back', label: 'Close'});
      return cmds;
    },
  },
  methods: {
    onPeek(spaceId: SpaceId): void {
      setBotReviewPeek(true, [spaceId]);
    },
    // A touch on a bonus chip opens the SAME union CardZoomModal the gamepad X
    // uses (ConsoleShell mounts it, driven by consoleCardZoom) — so console has
    // ONE fullscreen card surface. Single entry: this specific bonus card.
    onZoomBonus(id: BonusCardId): void {
      if (this.state.review !== undefined) {
        openConsoleCardZoom([bonusZoomEntry(id, this.state.review.ctx)], 0, undefined, undefined, {contextLabel: 'MarsBot turn'});
      }
    },
  },
});
</script>
