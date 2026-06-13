<template>
  <!--
    INLINE premium picker for "choose an ACTION to repeat" (ProjectInspection /
    Viron) with FEWER THAN 4 candidates. Each candidate is rendered as a premium
    ACTION card — the SAME action graphic the ДЕЙСТВИЯ overlay shows (via
    CompactActionCard), NOT a generic resource-target tile. Single-select: clicking
    a tile emits `change` with the card name; the host then opens that action's
    premium confirmation popup. (For 4+ candidates the host routes to the Actions
    overlay's pick-mode instead.)
  -->
  <div class="repeat-action-picker">
    <span v-if="promptText !== ''" class="repeat-action-picker__prompt" v-i18n>{{ promptText }}</span>
    <div class="repeat-action-picker__tiles" role="radiogroup">
      <button v-for="tile in tiles"
              :key="tile.name"
              type="button"
              role="radio"
              :aria-checked="selectedName === tile.name"
              class="repeat-action-picker__tile"
              :class="{'repeat-action-picker__tile--selected': selectedName === tile.name}"
              :data-test="'repeat-action-' + tile.name"
              @click="select(tile.name)">
        <span class="repeat-action-picker__head">
          <span class="repeat-action-picker__name" v-i18n>{{ tile.name }}</span>
          <span class="repeat-action-picker__mark" aria-hidden="true">
            <span v-if="selectedName === tile.name" class="repeat-action-picker__check">✓</span>
          </span>
        </span>
        <span class="repeat-action-picker__rows">
          <template v-for="(node, i) in tile.nodes" :key="node.key">
            <!-- A multi-node action is an `or` — a slim "ИЛИ" divider conveys the
                 alternation, exactly like the overlay's ActionGroupCard. -->
            <span v-if="i > 0" class="repeat-action-picker__or" aria-hidden="true" v-i18n>OR</span>
            <CompactActionCard :node="node" status="available" :interactive="false" />
          </template>
        </span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import CompactActionCard from '@/client/components/actions/CompactActionCard.vue';

type Tile = {
  name: CardName;
  nodes: ReadonlyArray<ActionGroup['nodes'][number]>;
};

export default defineComponent({
  name: 'RepeatActionPicker',
  components: {CompactActionCard},
  props: {
    // The candidate action source-card names (actions already used this generation).
    candidates: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      required: true,
    },
    // The currently-chosen action (for the highlight), owned by the host.
    selectedName: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
    // The prompt label (e.g. "Perform an action from a played card again").
    prompt: {
      type: String,
      default: '',
    },
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  emits: ['change'],
  computed: {
    promptText(): string {
      return this.prompt;
    },
    // Each candidate's action graphic, derived CLIENT-SIDE from the static manifest
    // (no network) — the same `playerActionGroups` the overlay uses. A candidate
    // with no extractable action node falls back to an empty node list (the
    // CompactActionCard text fallback still renders the card name in the header).
    tiles(): ReadonlyArray<Tile> {
      return this.candidates.map((name) => {
        const group = playerActionGroups([{name} as CardModel])[0];
        const nodes = (group?.nodes ?? []).map((n) => stripNodeOr(n));
        return {name, nodes};
      });
    },
  },
  methods: {
    select(name: CardName): void {
      this.$emit('change', name);
    },
  },
});
</script>

<style scoped lang="less">
@rap-cyan: #6ab0e6;
@rap-cyan-bright: #7fd4ff;

.repeat-action-picker {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
.repeat-action-picker__prompt {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(200, 224, 240, 0.85);
}
.repeat-action-picker__tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

// Each candidate reads as a distinct SELECTABLE action card: a framed tile with
// the source name + its action graphic. Calm at rest, a clear lift on hover, an
// unmistakable cyan ring + ✓ when chosen — mirroring the action-confirm branch.
.repeat-action-picker__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 220px;
  max-width: 320px;
  padding: 11px 13px 13px;
  text-align: left;
  border-radius: 11px;
  border: 1px solid rgba(120, 200, 255, 0.22);
  background: linear-gradient(180deg, rgba(22, 44, 64, 0.5), rgba(16, 32, 48, 0.5));
  color: #dbe6f4;
  font-family: Prototype, Ubuntu, sans-serif;
  cursor: pointer;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease, background 0.16s ease;

  &:hover {
    border-color: rgba(120, 220, 255, 0.65);
    background: linear-gradient(180deg, rgba(28, 56, 80, 0.62), rgba(20, 40, 60, 0.62));
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }
  &:active { transform: translateY(0); }
  &:focus-visible { box-shadow: 0 0 0 2px fade(@rap-cyan, 70%); }

  &--selected {
    border-color: @rap-cyan-bright;
    background: linear-gradient(180deg, rgba(28, 64, 92, 0.72), rgba(20, 46, 68, 0.72));
    box-shadow: inset 0 0 0 1px fade(@rap-cyan-bright, 55%), 0 0 0 1px fade(@rap-cyan-bright, 45%), 0 0 20px fade(@rap-cyan, 30%);
    &:hover { transform: none; }
  }
}

.repeat-action-picker__head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.repeat-action-picker__name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e8f1fb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
// Fixed slot so the ✓ never shifts the name (mirrors the option-card mark slot).
.repeat-action-picker__mark {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.repeat-action-picker__check {
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(180deg, #8fe3ff, #4fb8e6);
  box-shadow: 0 0 10px rgba(127, 212, 255, 0.6), inset 0 0 0 1px rgba(255, 255, 255, 0.4);
  color: #07263a;
  font-size: 12px;
  font-weight: 700;
}

.repeat-action-picker__rows {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.repeat-action-picker__or {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(150, 200, 230, 0.7);
}
</style>
