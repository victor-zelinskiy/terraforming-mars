<template>
  <!--
    One activatable SOURCE (card / corporation) in the compact master grid. A SLIM
    header (name + type chip + stored-resource badge + group status) then one
    selectable CompactActionCard ROW per render node — so a card with TWO actions
    is exactly the slim header + two compact rows tall (no repeated big header,
    no per-row ВЫПОЛНИТЬ button). Selecting a row never executes — it focuses the
    action so the details panel + its CTA take over. The resource badge stays at
    the group header (visible without hover) so the player always sees the count.
  -->
  <div class="action-group"
       :class="[
         'action-group--' + state.status,
         {
           'action-group--corp': isCorporation,
           'action-group--disabled-card': isDisabled,
           'action-group--selected': selectedWithin,
         },
       ]"
       :data-test="'action-group-' + cardName">
    <div class="action-group__head">
      <span class="action-group__accent" aria-hidden="true"></span>
      <span class="action-group__name" v-i18n>{{ cardName }}</span>
      <span class="action-group__type" aria-hidden="true">
        <span v-if="isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
      <span v-if="resourceChip" class="action-group__res">
        <span class="action-group__res-icon" :class="resIconClass" aria-hidden="true"></span>
        <span class="action-group__res-count">{{ resourceCount }}</span>
      </span>
      <span v-if="headerBadge !== ''"
            class="action-group__status"
            :class="'action-group__status--' + state.status">
        <span class="action-group__status-dot" aria-hidden="true"></span>
        <span v-i18n>{{ headerBadge }}</span>
      </span>
    </div>

    <div class="action-group__rows">
      <template v-for="(node, i) in displayNodes" :key="node.key">
        <!-- A multi-row group is always an `or` action (a card has ONE action that
             branches): a slim deliberate "ИЛИ" divider conveys the alternation, so
             the per-row graphic stays clean (the leading OR is stripped, #4). -->
        <span v-if="i > 0" class="action-group__or" aria-hidden="true" v-i18n>OR</span>
        <CompactActionCard :node="node"
                           :status="state.status"
                           :selected="selectedKey === rowKey(i)"
                           :focusable="selectedKey === rowKey(i)"
                           :data-test="'action-row-' + cardName + '-' + i"
                           @select="select(i)" />
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {ActionState} from '@/client/components/actions/actionPlayability';
import {actionRowKey} from '@/client/components/actions/actionsOverlayState';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import CompactActionCard from '@/client/components/actions/CompactActionCard.vue';

export default defineComponent({
  name: 'ActionGroupCard',
  components: {CompactActionCard},
  props: {
    entry: {
      type: Object as PropType<ActionEntry>,
      required: true,
    },
    // The live tableau CardModel — for the stored-resource count chip.
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
    // The overlay's selected row key (`cardName#nodeIndex`).
    selectedKey: {
      type: String,
      default: undefined,
    },
  },
  emits: ['select'],
  computed: {
    group(): ActionGroup {
      return this.entry.group;
    },
    // Render nodes with any leading OR connector stripped, so each compact row
    // shows a CLEAN graphic — the alternation is conveyed by the "ИЛИ" divider.
    displayNodes(): ReadonlyArray<ActionGroup['nodes'][number]> {
      return this.group.nodes.map((n) => stripNodeOr(n));
    },
    cardName(): CardName {
      return this.entry.cardName;
    },
    isCorporation(): boolean {
      return this.entry.isCorporation;
    },
    isDisabled(): boolean {
      return this.entry.group.isDisabled;
    },
    state(): ActionState {
      return this.entry.state;
    },
    selectedWithin(): boolean {
      return this.selectedKey !== undefined && this.selectedKey.startsWith(this.cardName + '#');
    },
    resourceType(): string | undefined {
      const r = getCard(this.cardName)?.resourceType;
      return r !== undefined ? String(r).toLowerCase().replace(/\s+/g, '-') : undefined;
    },
    resourceCount(): number {
      return this.card?.resources ?? 0;
    },
    resourceChip(): boolean {
      return this.resourceType !== undefined;
    },
    resIconClass(): string {
      return this.resourceType !== undefined ? iconClassFor(this.resourceType) : '';
    },
    headerBadge(): string {
      switch (this.state.status) {
      case 'activated': return 'Activated';
      case 'rules': return 'Unavailable';
      case 'soft': return 'Not now';
      default: return '';
      }
    },
  },
  methods: {
    rowKey(i: number): string {
      return actionRowKey(this.cardName, i);
    },
    // Selecting a row only FOCUSES the action (node-based) — the details panel
    // resolves the matching preview branch from the node; nothing executes here.
    select(i: number): void {
      this.$emit('select', {cardName: this.cardName, nodeIndex: i});
    },
  },
});
</script>
