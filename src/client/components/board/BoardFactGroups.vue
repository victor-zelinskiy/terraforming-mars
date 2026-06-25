<template>
  <div class="board-fact-groups">
    <div v-for="group in groups" :key="group.key" class="board-fact-group" :class="'board-fact-group--' + group.recipient.kind">
      <div class="board-fact-group__header">
        <span v-if="dotColor(group) !== undefined" class="board-fact-group__dot" :class="'player_bg_color_' + dotColor(group)"></span>
        <span class="board-fact-group__label" v-i18n>{{ groupLabel(group) }}</span>
      </div>
      <board-fact-row v-for="fact in group.facts" :key="fact.id" :fact="fact" />
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardFact, BoardFactGroup, groupFactsByRecipient} from '@/common/boards/BoardInformationFacts';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import BoardFactRow from '@/client/components/board/BoardFactRow.vue';

export default defineComponent({
  name: 'BoardFactGroups',
  components: {BoardFactRow},
  props: {
    facts: {
      type: Array as PropType<ReadonlyArray<BoardFact>>,
      required: true,
    },
    viewerColor: {
      type: String as PropType<Color | undefined>,
      default: undefined,
    },
    players: {
      type: Array as PropType<ReadonlyArray<PublicPlayerModel>>,
      default: () => [],
    },
  },
  computed: {
    groups(): ReadonlyArray<BoardFactGroup> {
      return groupFactsByRecipient(this.facts, this.viewerColor);
    },
  },
  methods: {
    dotColor(group: BoardFactGroup): Color | undefined {
      const r = group.recipient;
      if (r.kind === 'current-player') {
        return this.viewerColor;
      }
      if (r.kind === 'player' || r.kind === 'tile-owner') {
        return r.color;
      }
      return undefined;
    },
    playerName(color: Color): string {
      return this.players.find((p) => p.color === color)?.name ?? color;
    },
    groupLabel(group: BoardFactGroup): string {
      const r = group.recipient;
      switch (r.kind) {
      case 'current-player': return 'You';
      case 'player':
      case 'tile-owner': return this.playerName(r.color);
      case 'neutral': return 'Field rule';
      case 'nobody': return 'Reserved';
      }
    },
  },
});
</script>

<style scoped lang="less">
.board-fact-group {
  & + & {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(120, 200, 255, 0.14);
  }
}
.board-fact-group__header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}
.board-fact-group__dot {
  flex: 0 0 auto;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
}
.board-fact-group__label {
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-weight: 600;
  color: rgba(160, 200, 230, 0.78);
}
// The opponent groups read as "warmer" so they're clearly NOT the player's gains.
.board-fact-group--tile-owner .board-fact-group__label,
.board-fact-group--player .board-fact-group__label {
  color: rgba(255, 206, 146, 0.85);
}
</style>
