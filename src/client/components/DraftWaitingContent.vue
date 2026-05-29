<template>
  <!--
    Draft "in-between" waiting content. Mounted inside MandatoryInputModal
    by WaitingFor.vue whenever the game phase is DRAFTING or
    INITIALDRAFTING AND the player has no active prompt — i.e. they've
    already made this round's pick and are waiting on the next set to
    rotate around to them. Without this, the modal would unmount the
    moment the pick was submitted and then re-mount when the next prompt
    arrived, giving the player a jarring "modal flashes open / closed"
    sequence across every draft round. Holding the modal open with a
    waiting body presents draft as a single continuous flow.

    Pure presentation — no inputs, no buttons. Player can still minimize
    via the MandatoryInputModal `↗` button to inspect the board / their
    tableau while waiting; pill reads "AWAITING DECISION / Waiting for
    draft cards" so they know what they're waiting on.
  -->
  <div class="draft-waiting">
    <h2 class="draft-waiting__title" v-i18n>WAITING FOR DRAFT CARDS</h2>

    <!-- Sci-fi bouncing-dots loader. Three cyan dots pulse in a
         staggered sequence for a calm "in progress" rhythm. -->
    <div class="draft-waiting__dots" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>

    <p class="draft-waiting__body">{{ bodyText }}</p>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'DraftWaitingContent',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    /*
     * Colors of the players the server is still waiting on this round.
     * Comes from WaitingFor.vue's polled `playersWaitingFor` list (the
     * `/api/waitingFor` endpoint returns the live wait list every poll
     * tick). When present we name them so the player can see WHO is
     * holding up the round. When empty (poll hasn't returned yet or
     * server reports no specific list), we fall back to a generic
     * "waiting for the next set" line.
     */
    waitingOnPlayers: {
      type: Array as PropType<ReadonlyArray<Color>>,
      default: () => [],
    },
  },
  computed: {
    namesList(): string {
      /*
       * Map color -> player name. Filter out the viewer themselves
       * (they shouldn't appear in "we're waiting on …" — that would
       * read as the modal blaming the player for waiting on
       * themselves). Comma-join is intentionally minimal — the source
       * line wraps naturally when the list is long.
       */
      const me = this.playerView.thisPlayer.color;
      const names = this.waitingOnPlayers
        .filter((color: Color) => color !== me)
        .map((color: Color) => this.playerView.players.find((p) => p.color === color)?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      return names.join(', ');
    },
    bodyText(): string {
      if (this.namesList === '') {
        return translateText('You have already made your pick. Waiting for the next set of cards.');
      }
      return translateText('You have already made your pick. Waiting for ${0} to finish and pass you the next set of cards.')
        .replace('${0}', this.namesList);
    },
  },
});
</script>
