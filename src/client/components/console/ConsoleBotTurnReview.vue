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
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * Console-native «Разбор хода» — a TV/Steam-Deck-readable FULLSCREEN summary
 * of a bot turn, replaying the SAME `botTurnReviewState` as the desktop overlay
 * (which is suppressed in console mode). Input routing stays in ConsoleShell
 * (B closes, X inspects the played card, L3 = show on map). The button hints
 * live only in the command bar — never duplicated in the body.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SpaceId} from '@/common/Types';
import {botTurnReviewState, setBotReviewPeek} from '@/client/components/marsbot/botTurnReviewState';
import BotTurnReviewBody from '@/client/components/marsbot/BotTurnReviewBody.vue';

export default defineComponent({
  name: 'ConsoleBotTurnReview',
  components: {BotTurnReviewBody},
  props: {
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  data() {
    return {state: botTurnReviewState};
  },
  methods: {
    onPeek(spaceId: SpaceId): void {
      setBotReviewPeek(true, spaceId);
    },
  },
});
</script>
