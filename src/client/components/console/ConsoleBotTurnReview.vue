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
        <div class="con-bot-review__scroll">
          <BotTurnReviewBody :review="state.review" :players="players" large @peek="onPeek" />
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
 * ConsoleShell (B closes, X inspects the played card, L3 = show on map).
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import {botTurnReviewState, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import BotTurnReviewBody from '@/client/components/marsbot/BotTurnReviewBody.vue';
import ConsoleCommandBar, {ConsoleCommand} from '@/client/components/console/ConsoleCommandBar.vue';

export default defineComponent({
  name: 'ConsoleBotTurnReview',
  components: {BotTurnReviewBody, ConsoleCommandBar},
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
    /** The bar mirrors ConsoleShell's input contract for the review-open state. */
    commands(): Array<ConsoleCommand> {
      if (this.state.peek) {
        return [{control: 'confirm', label: 'Back to review'}];
      }
      const cmds: Array<ConsoleCommand> = [];
      if ((this.state.review?.cardNames.length ?? 0) > 0) {
        cmds.push({control: 'secondary', label: 'Inspect card'});
      }
      if (this.state.review?.primarySpaceId !== undefined) {
        cmds.push({control: 'stickL', label: 'Show on map'});
      }
      cmds.push({control: 'back', label: 'Close'});
      return cmds;
    },
  },
  methods: {
    onPeek(spaceId: SpaceId): void {
      setBotReviewPeek(true, spaceId);
    },
  },
});
</script>
