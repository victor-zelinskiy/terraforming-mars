<template>
  <!--
    The static RIGHT panel of the actions overlay — the "understand" step between
    scanning the compact grid and confirming. Always shows the SELECTED action: the
    source, its FULL action text (not a 1:1 redraw of the compact icon formula), the
    cost/result breakdown, constraints, current resources on the card, and what
    happens next — then a context-aware CTA that OPENS the confirmation modal (it
    never executes the action). Manifest content (text + graphic) renders instantly;
    the cost/result/next refine when the lazy preview arrives.
  -->
  <aside class="action-detail" :class="{'action-detail--empty': entry === undefined}">
    <div v-if="entry === undefined" class="action-detail__placeholder">
      <span class="action-detail__placeholder-glyph" aria-hidden="true">⌁</span>
      <span class="action-detail__placeholder-text" v-i18n>Select an action to see details</span>
    </div>

    <template v-else>
      <header class="action-detail__head">
        <span class="action-detail__type" v-i18n>{{ isCorporation ? 'Corporation' : 'Card' }}</span>
        <h3 class="action-detail__name" v-i18n>{{ cardName }}</h3>
        <button type="button"
                class="action-detail__zoom"
                :aria-label="$t('Open fullscreen')"
                @click="$emit('open', cardName)">⤢</button>
        <span v-if="resourceChip" class="action-detail__res">
          <span class="action-detail__res-icon" :class="resIconClass" aria-hidden="true"></span>
          <span class="action-detail__res-count">{{ resourceCount }}</span>
          <span class="action-detail__res-label" v-i18n>on this card</span>
        </span>
      </header>

      <!-- Status / constraints when the action can't be taken right now. -->
      <div v-if="isUnavailable" class="action-detail__status" :class="statusClass">
        <span class="action-detail__status-dot" aria-hidden="true"></span>
        <span class="action-detail__status-text">{{ statusText }}</span>
      </div>

      <!-- Full ACTION text (translated + "Action:"-prefix stripped). -->
      <div v-if="descriptionText !== ''" class="action-detail__section">
        <span class="action-detail__label" v-i18n>Description</span>
        <p class="action-detail__desc" v-i18n v-strip-action-prefix>{{ descriptionText }}</p>
      </div>

      <!-- Cost / Result breakdown (once the preview is in). -->
      <div v-if="branchEffects.length > 0" class="action-detail__section">
        <ActionResultsPreview :effects="branchEffects" />
      </div>
      <div v-else-if="loadingPreview" class="action-detail__skeleton">
        <span class="action-detail__skeleton-bar"></span>
        <span class="action-detail__skeleton-bar action-detail__skeleton-bar--short"></span>
      </div>

      <!-- What happens next (board placement / colony / target / payment …). -->
      <ActionNextStepNotice v-if="selectedBranch !== undefined" :steps="selectedBranch.steps" variant="next" />

      <!-- Source card — a compact reference of WHERE this action comes from (the ⤢
           in the header opens it fullscreen). Lives here, in the panel, so it can
           never cover the action rows the way the old grid hover popover did. -->
      <div v-if="cardName !== undefined" class="action-detail__section action-detail__source">
        <span class="action-detail__label" v-i18n>Source</span>
        <button type="button"
                class="action-detail__source-card"
                :aria-label="$t('Open fullscreen')"
                @click="$emit('open', cardName)">
          <Card :card="cardModel" />
        </button>
      </div>

      <div class="action-detail__cta-row">
        <button type="button"
                class="action-detail__cta cab-action-confirm-go"
                :disabled="!ctaEnabled"
                @click="activate"
                data-test="action-detail-cta">
          <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
          <span class="cab-action-confirm-go__icon" aria-hidden="true">▶</span>
          <span class="cab-action-confirm-go__label" v-i18n>{{ ctaLabel }}</span>
        </button>
      </div>
    </template>
  </aside>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionGroup, actionNodeDescription} from '@/client/components/actions/actionExtraction';
import {branchPositionForNode} from '@/client/components/actions/actionBranchView';
import {ActionState} from '@/client/components/actions/actionPlayability';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import Card from '@/client/components/card/Card.vue';
import ActionResultsPreview from '@/client/components/actions/ActionResultsPreview.vue';
import ActionNextStepNotice from '@/client/components/actions/ActionNextStepNotice.vue';

type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'ActionDetailsPanel',
  components: {Card, ActionResultsPreview, ActionNextStepNotice},
  directives: {stripActionPrefix},
  props: {
    entry: {
      type: Object as PropType<ActionEntry>,
      default: undefined,
    },
    // The selected node ordinal (the row within the group) — the canonical
    // selection. The matching preview branch is resolved from this + the preview.
    nodeIndex: {
      type: Number,
      default: 0,
    },
    // The lazily-fetched action preview (branches + effects + steps).
    preview: {
      type: Object as PropType<ActionPreview>,
      default: undefined,
    },
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
    loadingPreview: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['activate', 'open'],
  computed: {
    cardName(): CardName | undefined {
      return this.entry?.cardName;
    },
    // Live tableau model when available (carries the resource count), else a bare
    // {name} so the embedded source-card preview still renders.
    cardModel(): CardModel {
      return this.card ?? ({name: this.cardName} as CardModel);
    },
    isCorporation(): boolean {
      return this.entry?.isCorporation ?? false;
    },
    group(): ActionGroup | undefined {
      return this.entry?.group;
    },
    state(): ActionState | undefined {
      return this.entry?.state;
    },
    // The action can't be taken right now (drives the constraints block).
    isUnavailable(): boolean {
      return this.state !== undefined && this.state.status !== 'available';
    },
    statusClass(): string {
      return this.state !== undefined ? 'action-detail__status--' + this.state.status : '';
    },
    node(): GroupNode | undefined {
      return this.group?.nodes[this.nodeIndex];
    },
    // The action's full text — from the selected render node (the "Action: " prefix
    // is stripped client-side by the directive), else the selected branch's title.
    descriptionText(): string {
      if (this.node !== undefined) {
        const d = actionNodeDescription(this.node);
        if (d !== '') {
          return d;
        }
      }
      const b = this.selectedBranch;
      if (b !== undefined) {
        return typeof b.title === 'string' ? b.title : b.title.message;
      }
      return '';
    },
    // The preview branch the SELECTED render node maps to — resolved via the SAME
    // token-overlap matching the confirm modal uses (NOT a positional index), so a
    // card's two actions never show each other's cost/result. Falls back to the
    // lone available / first branch for a single or combined-node action.
    selectedBranch(): ActionPreviewBranch | undefined {
      const branches = this.preview?.branches;
      const group = this.group;
      if (branches === undefined || branches.length === 0 || group === undefined) {
        return undefined;
      }
      const p = branchPositionForNode(group, branches, this.nodeIndex);
      if (p !== undefined && branches[p] !== undefined) {
        return branches[p];
      }
      return branches.find((b) => b.available) ?? branches[0];
    },
    branchEffects(): ReadonlyArray<ActionEffect> {
      return this.selectedBranch?.effects ?? [];
    },
    resourceType(): string | undefined {
      if (this.cardName === undefined) {
        return undefined;
      }
      const r = getCard(this.cardName)?.resourceType;
      return r !== undefined ? String(r).toLowerCase().replace(/\s+/g, '-') : undefined;
    },
    resourceCount(): number {
      return this.card?.resources ?? this.preview?.cardResource?.count ?? 0;
    },
    resourceChip(): boolean {
      return this.resourceType !== undefined;
    },
    resIconClass(): string {
      return this.resourceType !== undefined ? iconClassFor(this.resourceType) : '';
    },
    // The "why can't I act" line for a non-available action.
    statusText(): string {
      const s = this.state;
      if (s === undefined) {
        return '';
      }
      if (s.status === 'rules' && s.reasons.length > 0) {
        const r = s.reasons[0];
        return translateTextWithParams(r.message, [...(r.params ?? [])]);
      }
      if (s.softReason !== undefined) {
        return translateTextWithParams(s.softReason.message, [...(s.softReason.params ?? [])]);
      }
      switch (s.status) {
      case 'activated': return translateText('Already used this generation');
      case 'rules': return translateText('Cannot activate');
      default: return translateText('Not your turn right now');
      }
    },
    // Context-aware CTA — names the NEXT step so the player knows the modal isn't a
    // second identical confirm. Falls back to a generic "go to confirmation".
    ctaLabel(): string {
      const b = this.selectedBranch;
      if (b === undefined) {
        return 'Go to confirmation';
      }
      const steps = b.steps ?? [];
      const optType = b.optionInput?.type;
      const hasPayment = optType === 'payment' || steps.some((s) => s.kind === 'input' && s.input.type === 'payment');
      if (hasPayment) {
        return 'Configure payment';
      }
      const hasBoard = steps.some((s) => s.kind === 'boardPlacement' || (s.kind === 'note' && (s.noteKind === 'board' || s.noteKind === 'colony')));
      if (hasBoard) {
        return 'Go to placement';
      }
      const hasTarget = optType === 'card' || optType === 'player' ||
        steps.some((s) => s.kind === 'input' && (s.input.type === 'card' || s.input.type === 'player'));
      if (hasTarget) {
        return 'Go to selection';
      }
      return 'Go to confirmation';
    },
    ctaEnabled(): boolean {
      if (this.state?.status !== 'available') {
        return false;
      }
      // Once the preview is in, also require the chosen branch to be available;
      // before it loads, trust the card-level state (the modal re-checks anyway).
      return this.selectedBranch === undefined || this.selectedBranch.available || this.preview === undefined;
    },
  },
  methods: {
    activate(): void {
      if (this.cardName === undefined || !this.ctaEnabled) {
        return;
      }
      this.$emit('activate', {cardName: this.cardName, nodeIndex: this.nodeIndex});
    },
  },
});
</script>
