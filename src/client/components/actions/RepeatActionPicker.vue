<template>
  <!--
    INLINE premium picker for "choose an ACTION to repeat" (ProjectInspection /
    Viron) with FEWER THAN 4 candidate cards. Mirrors the ДЕЙСТВИЯ overlay: each
    candidate card is a slim group (name header) and EACH branch of a split (`or`)
    action is a SEPARATELY selectable premium row. Per the fork's "always ask,
    never auto-select" rule we ALWAYS show EVERY branch — an unavailable branch is
    rendered DISABLED (red) with its reason VISIBLE, so the player understands why
    it can't be taken (never hidden / auto-selected). Per-branch availability +
    reasons come from the card's READ-ONLY action preview. Clicking an AVAILABLE
    row emits `change` {card, branch node ordinal}; the host opens that action's
    premium confirm on that branch. (For 4+ candidate cards the host routes to the
    Actions overlay's pick-mode instead.)
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
          <template v-for="(row, i) in group.rows" :key="row.key">
            <!-- A multi-node action is an `or` — a slim "ИЛИ" divider conveys the
                 alternation, exactly like the overlay's ActionGroupCard. -->
            <span v-if="i > 0" class="repeat-action-picker__or" aria-hidden="true" v-i18n>OR</span>
            <button type="button"
                    class="repeat-action-picker__row"
                    :class="{'repeat-action-picker__row--disabled': !row.available}"
                    :disabled="!row.available"
                    :data-test="'repeat-action-' + group.name + '-' + row.nodeIndex"
                    @click="select(group.name, row.nodeIndex, row.available)">
              <CompactActionCard :node="row.node"
                                 :status="row.available ? 'available' : 'rules'"
                                 :interactive="false" />
              <!-- The unavailable branch shows WHY, visibly (not just a tooltip). -->
              <span v-if="!row.available && row.reason !== ''" class="repeat-action-picker__reason">
                <span class="repeat-action-picker__reason-glyph" aria-hidden="true">✕</span>
                <span class="repeat-action-picker__reason-text">{{ row.reason }}</span>
              </span>
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
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripNodeOr, branchPositionsForNode} from '@/client/components/actions/actionBranchView';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import CompactActionCard from '@/client/components/actions/CompactActionCard.vue';

type Row = {
  key: string;
  node: ActionGroup['nodes'][number];
  nodeIndex: number;
  available: boolean;
  reason: string;
};
type Group = {
  name: CardName;
  rows: ReadonlyArray<Row>;
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
  data() {
    return {
      // READ-ONLY action previews per candidate (per-branch availability + reasons).
      // Empty until fetched — meanwhile branches render as available (the host's
      // confirm still gates an unavailable pick), then refine when the preview lands.
      previews: {} as Record<string, ActionPreview>,
    };
  },
  mounted(): void {
    this.candidates.forEach((name) => this.fetchPreview(name));
  },
  computed: {
    promptText(): string {
      return this.prompt;
    },
    // Each candidate's action graphic (static manifest) + per-branch availability
    // (from the fetched preview). A split (`or`) action has SEVERAL nodes (one per
    // branch); each becomes its own row, available or disabled-with-reason.
    groups(): ReadonlyArray<Group> {
      return this.candidates.map((name) => {
        const group = playerActionGroups([{name} as CardModel])[0];
        const nodes = (group?.nodes ?? []).map((n) => stripNodeOr(n));
        const rows = nodes.map((node, nodeIndex): Row => ({
          key: node.key,
          node,
          nodeIndex,
          available: this.nodeAvailable(name, group, nodeIndex),
          reason: this.nodeReason(name, group, nodeIndex),
        }));
        return {name, rows};
      });
    },
  },
  methods: {
    fetchPreview(name: CardName): void {
      // No fetch (JSDOM tests / unsupported env) → branches stay available; the
      // host's confirm still gates an unavailable pick. Guard the SYNC ReferenceError.
      if (typeof fetch !== 'function') {
        return;
      }
      const url = paths.API_ACTION_PREVIEW +
        '?id=' + encodeURIComponent(this.playerView.id) +
        '&card=' + encodeURIComponent(name);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (p !== undefined) {
            this.previews[name] = p as ActionPreview;
          }
        })
        .catch(() => { /* best-effort: branches stay available; the confirm gates a bad pick */ });
    },
    // The preview branch(es) a given render-NODE maps to (only for a multi-node
    // card with a loaded preview) — the source of PER-BRANCH availability.
    nodeBranches(name: CardName, group: ActionGroup | undefined, nodeIndex: number): ReadonlyArray<ActionPreviewBranch> {
      const preview = this.previews[name];
      if (preview === undefined || group === undefined || group.nodes.length <= 1) {
        return [];
      }
      return branchPositionsForNode(group, preview.branches, nodeIndex)
        .map((p) => preview.branches[p])
        .filter((b): b is ActionPreviewBranch => b !== undefined);
    },
    nodeAvailable(name: CardName, group: ActionGroup | undefined, nodeIndex: number): boolean {
      const preview = this.previews[name];
      if (preview === undefined) {
        return true; // not loaded yet — assume available (the confirm gates a bad pick)
      }
      if (group === undefined || group.nodes.length <= 1) {
        // Single-action card: its lone branch's availability (a candidate canAct,
        // so normally available).
        return preview.branches[0]?.available ?? true;
      }
      const branches = this.nodeBranches(name, group, nodeIndex);
      return branches.length === 0 ? true : branches.some((b) => b.available);
    },
    nodeReason(name: CardName, group: ActionGroup | undefined, nodeIndex: number): string {
      const branches = this.nodeBranches(name, group, nodeIndex).filter((b) => !b.available);
      if (branches.length === 0) {
        return '';
      }
      const reasons = branches.map((b) => {
        const r = b.unavailableReason;
        if (r === undefined) {
          return translateText('Cannot activate');
        }
        const msg = typeof r === 'string' ? r : r.message;
        return translateTextWithParams(msg, [...(b.unavailableReasonParams ?? [])]);
      });
      return [...new Set(reasons)].join(' / ');
    },
    // Pick a specific (card, branch-node) — only an AVAILABLE branch hands off; a
    // disabled one is inert (the button is also `:disabled`, this is belt-and-braces).
    select(name: CardName, nodeIndex: number, available: boolean): void {
      if (!available) {
        return;
      }
      this.$emit('change', {cardName: name, nodeIndex});
    },
  },
});
</script>

<style scoped lang="less">
@rap-cyan: #6ab0e6;
@rap-cyan-bright: #7fd4ff;
@rap-red: #c6685c;

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
  align-items: stretch;
  gap: 4px;
}
.repeat-action-picker__or {
  align-self: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: rgba(150, 200, 230, 0.7);
}

// An AVAILABLE branch — its own selectable row (cyan-mint "act now" frame + hover
// lift); clicking hands off to that branch's confirm.
.repeat-action-picker__row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
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

  // An UNAVAILABLE branch — disabled, RED, with its reason visible (never hidden).
  &--disabled {
    cursor: not-allowed;
    border-color: rgba(198, 104, 92, 0.5);
    background: rgba(34, 20, 18, 0.4);
    filter: grayscale(0.45) saturate(0.7);
    &:hover { transform: none; box-shadow: none; border-color: rgba(198, 104, 92, 0.5); background: rgba(34, 20, 18, 0.4); }
  }
}
.repeat-action-picker__reason {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 2px 8px 3px;
  border-radius: 6px;
  background: rgba(150, 60, 45, 0.26);
  box-shadow: inset 0 0 0 1px rgba(@rap-red, 0.42);
  color: #ffb59c;
  font-size: 10.5px;
  line-height: 1.25;
}
.repeat-action-picker__reason-glyph {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
}
.repeat-action-picker__reason-text {
  min-width: 0;
}
</style>
