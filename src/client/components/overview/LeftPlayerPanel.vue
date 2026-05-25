<template>
  <div class="left-panel">
    <!-- One card per player. Each card combines cube + name + corporation + VP
         + TR + action status. Click selects that player. The viewer's own
         player is always first in the list, then the rest in seating order. -->
    <div class="left-panel-cards">
      <LeftPlayerCard
        v-for="p in orderedPlayers"
        :key="p.color"
        :player="p"
        :selected="isSelected(p)"
        :hideVp="hideVpFor(p)"
        :actionLabel="actionLabelFor(p)"
        @select="$emit('selectPlayer', $event)" />
    </div>

    <div class="left-panel-section">
      <PlayerResources :player="displayedPlayer" v-trim-whitespace />
    </div>

    <!-- `:conciseTagsViewDefaultValue="false"` shows every tag in the game
         (Building, Space, …) even when the displayed player's count is 0 —
         zero-count tags get a muted style. This keeps every tag at the same
         grid position regardless of who's selected, so switching players
         doesn't make icons "jump" to new cells. -->
    <div class="left-panel-tags-secondary left-panel-section">
      <PlayerTags
        section="cardTags"
        :player="displayedPlayer"
        :playerView="playerView"
        :conciseTagsViewDefaultValue="false" />
    </div>

    <div class="left-panel-tags-secondary left-panel-tags-extras left-panel-section">
      <PlayerTags
        section="extras"
        :player="displayedPlayer"
        :playerView="playerView"
        :conciseTagsViewDefaultValue="false" />
    </div>

    <PlayerAlliedParty :player="displayedPlayer"/>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import PlayerResources from '@/client/components/overview/PlayerResources.vue';
import PlayerAlliedParty from '@/client/components/overview/PlayerAlliedParty.vue';
import PlayerTags from '@/client/components/overview/PlayerTags.vue';
import LeftPlayerCard from '@/client/components/overview/LeftPlayerCard.vue';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {ActionLabel} from './ActionLabel';

export default defineComponent({
  name: 'LeftPlayerPanel',
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    displayedPlayer: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    selectedColor: {
      type: String,
      default: undefined,
    },
  },
  emits: ['selectPlayer'],
  components: {
    PlayerResources,
    PlayerAlliedParty,
    PlayerTags,
    LeftPlayerCard,
  },
  computed: {
    // The viewer's own player (if any) is pulled to the top of the list so it
    // always appears first in the panel — players intuitively expect "their"
    // card to be the first one.
    orderedPlayers(): Array<PublicPlayerModel> {
      const me = this.playerView.thisPlayer;
      const players = this.playerView.players;
      if (me === undefined) {
        return players;
      }
      const others = players.filter((p) => p.color !== me.color);
      return [me, ...others];
    },
  },
  methods: {
    isSelected(p: PublicPlayerModel): boolean {
      const selected = this.selectedColor ?? this.playerView.thisPlayer?.color;
      return p.color === selected;
    },
    hideVpFor(p: PublicPlayerModel): boolean {
      const isThisPlayer = p.color === this.playerView.thisPlayer?.color;
      return !this.playerView.game.gameOptions.showOtherPlayersVP && !isThisPlayer;
    },
    actionLabelFor(p: PublicPlayerModel): ActionLabel {
      return actionLabelForPlayer(this.playerView, p);
    },
  },
});
</script>
