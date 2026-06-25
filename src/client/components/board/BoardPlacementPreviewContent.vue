<template>
  <div class="board-preview">
    <div v-if="preview.costFacts.length > 0" class="board-preview__section board-preview__section--cost">
      <div class="board-preview__heading" v-i18n>Cost</div>
      <board-fact-row v-for="fact in preview.costFacts" :key="fact.id" :fact="fact" />
    </div>

    <div v-if="preview.immediateFacts.length > 0" class="board-preview__section board-preview__section--gain">
      <div class="board-preview__heading" v-i18n>You receive</div>
      <board-fact-row v-for="fact in preview.immediateFacts" :key="fact.id" :fact="fact" />
    </div>

    <div v-if="preview.recipientFacts.length > 0" class="board-preview__section board-preview__section--others">
      <div class="board-preview__heading" v-i18n>Other players receive</div>
      <board-fact-groups :facts="preview.recipientFacts" :viewerColor="viewerColor" :players="players" />
    </div>

    <div v-if="preview.futureScoringFacts.length > 0" class="board-preview__section board-preview__section--endgame">
      <div class="board-preview__heading" v-i18n>At game end</div>
      <board-fact-row v-for="fact in preview.futureScoringFacts" :key="fact.id" :fact="fact" />
    </div>

    <div v-if="preview.warningFacts.length > 0" class="board-preview__section board-preview__section--risk">
      <div class="board-preview__heading" v-i18n>Risk</div>
      <board-fact-row v-for="fact in preview.warningFacts" :key="fact.id" :fact="fact" />
    </div>

    <div v-if="preview.ruleFacts.length > 0" class="board-preview__section board-preview__section--rule">
      <div class="board-preview__heading" v-i18n>Field rules</div>
      <board-fact-row v-for="fact in preview.ruleFacts" :key="fact.id" :fact="fact" />
    </div>

    <div v-if="isEmpty" class="board-preview__empty" v-i18n>Nothing happens beyond placing the tile.</div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {BoardPlacementPreview} from '@/common/boards/BoardInformationFacts';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import BoardFactRow from '@/client/components/board/BoardFactRow.vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';

/**
 * Compact render of a {@link BoardPlacementPreview} — the SAME facts the player
 * saw on hover, grouped by intent: Cost / You receive / Other players receive /
 * At game end / Risk / Field rules. Reused by the active-placement hover popover
 * AND the confirm modal so the two never diverge.
 */
export default defineComponent({
  name: 'BoardPlacementPreviewContent',
  components: {BoardFactRow, BoardFactGroups},
  props: {
    preview: {
      type: Object as PropType<BoardPlacementPreview>,
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
    isEmpty(): boolean {
      const p = this.preview;
      return p.costFacts.length === 0 && p.immediateFacts.length === 0 &&
        p.recipientFacts.length === 0 && p.futureScoringFacts.length === 0 &&
        p.warningFacts.length === 0 && p.ruleFacts.length === 0;
    },
  },
});
</script>

<style scoped lang="less">
.board-preview {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.board-preview__section {
  display: flex;
  flex-direction: column;
}
.board-preview__heading {
  font-family: 'Prototype', sans-serif;
  font-size: 10px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(150, 192, 224, 0.72);
  margin-bottom: 2px;
  padding-bottom: 3px;
  border-bottom: 1px solid rgba(120, 200, 255, 0.14);
}
.board-preview__section--cost .board-preview__heading { color: rgba(255, 206, 146, 0.78); }
.board-preview__section--gain .board-preview__heading { color: rgba(143, 240, 196, 0.8); }
.board-preview__section--others .board-preview__heading { color: rgba(255, 206, 146, 0.85); }
.board-preview__section--endgame .board-preview__heading { color: rgba(255, 220, 138, 0.82); }
.board-preview__section--risk .board-preview__heading { color: rgba(255, 159, 150, 0.85); }
.board-preview__empty {
  font-size: 11px;
  color: rgba(190, 214, 232, 0.55);
  font-style: italic;
}
</style>
