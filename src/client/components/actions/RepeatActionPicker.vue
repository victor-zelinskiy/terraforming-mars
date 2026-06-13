<template>
  <!--
    INLINE premium picker for "choose an ACTION to repeat" (ProjectInspection /
    Viron) with FEWER THAN 4 candidate cards. Mirrors the ДЕЙСТВИЯ overlay: each
    candidate card is a slim group (name header) and EACH branch of a split (`or`)
    action is a SEPARATELY selectable premium row (e.g. Regolith Eaters' "add a
    microbe" vs "spend 2 microbes → oxygen"). Clicking a row emits `change` with
    the card AND the chosen branch node ordinal; the host opens that action's
    premium confirm pre-selected on that branch. (For 4+ candidate cards the host
    routes to the Actions overlay's pick-mode instead.)
  -->
  <div class="repeat-action-picker">
    <span v-if="promptText !== ''" class="repeat-action-picker__prompt" v-i18n>{{ promptText }}</span>
    <div class="repeat-action-picker__groups">
      <div v-for="group in groups"
           :key="group.name"
           class="repeat-action-picker__group"
           :data-test="'repeat-action-' + group.name">
        <span class="repeat-action-picker__name" v-i18n>{{ group.name }}</span>
        <div class="repeat-action-picker__rows">
          <template v-for="(node, i) in group.nodes" :key="node.key">
            <!-- A multi-node action is an `or` — a slim "ИЛИ" divider conveys the
                 alternation, exactly like the overlay's ActionGroupCard. -->
            <span v-if="i > 0" class="repeat-action-picker__or" aria-hidden="true" v-i18n>OR</span>
            <button type="button"
                    class="repeat-action-picker__row"
                    :data-test="'repeat-action-' + group.name + '-' + i"
                    @click="select(group.name, i)">
              <CompactActionCard :node="node" status="available" :interactive="false" />
            </button>
          </template>
        </div>
      </div>
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

type Group = {
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
    // (no network) — the same `playerActionGroups` the overlay uses. A split (`or`)
    // action has SEVERAL nodes (one per branch); each becomes its own selectable row.
    groups(): ReadonlyArray<Group> {
      return this.candidates.map((name) => {
        const group = playerActionGroups([{name} as CardModel])[0];
        const nodes = (group?.nodes ?? []).map((n) => stripNodeOr(n));
        return {name, nodes};
      });
    },
  },
  methods: {
    // Pick a specific (card, branch-node) — hands off to that action's confirm,
    // opened on the matching branch.
    select(name: CardName, nodeIndex: number): void {
      this.$emit('change', {cardName: name, nodeIndex});
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
.repeat-action-picker__groups {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
}

// One candidate card = a slim group: name header + its branch rows. Mirrors the
// ДЕЙСТВИЯ overlay's ActionGroupCard.
.repeat-action-picker__group {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 220px;
  max-width: 320px;
  padding: 10px 11px 11px;
  border-radius: 11px;
  border: 1px solid rgba(106, 176, 230, 0.2);
  background:
    radial-gradient(120% 60% at 50% -8%, rgba(127, 212, 255, 0.045), transparent 60%),
    linear-gradient(180deg, rgba(20, 30, 44, 0.9), rgba(12, 20, 32, 0.93));
}
.repeat-action-picker__name {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #e8f1fb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

// Each BRANCH is its own selectable row — a clear "act now" cyan-mint frame +
// hover lift; clicking hands off to that branch's confirm.
.repeat-action-picker__row {
  display: block;
  width: 100%;
  padding: 4px;
  border-radius: 9px;
  border: 1px solid rgba(88, 214, 166, 0.4);
  background: rgba(14, 28, 42, 0.4);
  cursor: pointer;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease, background 0.16s ease;

  &:hover {
    border-color: rgba(127, 230, 200, 0.85);
    background: rgba(20, 40, 58, 0.6);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4), 0 0 18px rgba(88, 214, 166, 0.2);
  }
  &:active { transform: translateY(0); }
  &:focus-visible { box-shadow: 0 0 0 2px fade(@rap-cyan-bright, 75%); }
}
</style>
