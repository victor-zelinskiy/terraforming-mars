<template>
        <div class="players-overview" v-if="hasPlayers()">
            <other-player
              v-if="displayedPlayer !== undefined"
              :player="displayedPlayer"
              :playerIndex="displayedPlayerIndex"/>
            <player-info
              v-if="displayedPlayer !== undefined"
              :player="displayedPlayer"
              :key="displayedPlayer.color"
              :playerView="playerView"
              :firstForGen="getIsFirstForGen(displayedPlayer)"
              :actionLabel="getActionLabel(displayedPlayer)"
              :playerIndex="displayedPlayerIndex"/>
        </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import PlayerInfo from '@/client/components/overview/PlayerInfo.vue';
import OtherPlayer from '@/client/components/OtherPlayer.vue';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {ActionLabel} from '@/client/components/overview/ActionLabel';
import {Color} from '@/common/Color';
import {actionLabelForPlayer, playerIndexInList} from '@/client/components/overview/playerLabels';

export const playerIndex = playerIndexInList;

export default defineComponent({
  name: 'PlayersOverview',
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    selectedColor: {
      type: String as () => Color | undefined,
      default: undefined,
    },
  },
  computed: {
    players(): Array<PublicPlayerModel> {
      return this.playerView.players;
    },
    thisPlayer(): PublicPlayerModel | undefined {
      return this.playerView.thisPlayer;
    },
    displayedPlayer(): PublicPlayerModel | undefined {
      if (this.selectedColor !== undefined) {
        return this.players.find((p) => p.color === this.selectedColor);
      }
      return this.thisPlayer;
    },
    displayedPlayerIndex(): number {
      if (this.displayedPlayer === undefined) {
        return -1;
      }
      if (this.displayedPlayer.color === this.thisPlayer?.color) {
        return -1;
      }
      return playerIndex(this.displayedPlayer.color, this.players);
    },
  },
  components: {
    'player-info': PlayerInfo,
    'other-player': OtherPlayer,
  },
  data() {
    return {};
  },
  methods: {
    hasPlayers(): boolean {
      return this.players.length > 0;
    },
    getIsFirstForGen(player: PublicPlayerModel): boolean {
      return playerIndex(player.color, this.players) === 0;
    },
    getPlayersInOrder(): Array<PublicPlayerModel> {
      const players = this.players;
      if (this.thisPlayer === undefined) {
        return players;
      }

      let result = [];
      let currentPlayerOffset = 0;
      const currentPlayerIndex = playerIndex(
        this.thisPlayer.color,
        this.players,
      );

      // shift the array by putting the player on focus at the tail
      currentPlayerOffset = currentPlayerIndex + 1;
      result = players
        .slice(currentPlayerOffset)
        .concat(players.slice(0, currentPlayerOffset));
      // return all but the focused user
      return result.slice(0, -1);
    },
    getActionLabel(player: PublicPlayerModel): ActionLabel {
      return actionLabelForPlayer(this.playerView, player);
    },
  },
});
</script>
