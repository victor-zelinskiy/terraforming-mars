<template>
  <!--
    One activatable ACTION source (a card / corporation). The header names the
    source + shows its stored-resource count. A MULTI-BRANCH action (e.g. Regolith
    Eaters: add a microbe / spend 2 to raise oxygen) is SPLIT into separate branch
    buttons — each with its own graphic, cost/gain chips and availability — so the
    player never picks a generic action that later asks "what did you mean". A
    single-action card keeps one block. Hover a graphic → the source card floats
    in (emitted up); click → fullscreen. ВЫПОЛНИТЬ emits {cardName, branchIndex}.
  -->
  <div class="action-block"
       :class="[
         'action-block--' + state.status,
         {
           'action-block--corp': isCorporation,
           'action-block--disabled-card': isDisabled,
           'action-block--multi': isMultiBranch,
         },
       ]"
       :data-test="'action-block-' + cardName">
    <div class="action-block__head">
      <span class="action-block__accent" aria-hidden="true"></span>
      <span class="action-block__source" v-i18n>{{ cardName }}</span>
      <span class="action-block__type" aria-hidden="true">
        <span v-if="isCorporation" v-i18n>Corporation</span>
        <span v-else v-i18n>Card</span>
      </span>
      <span v-if="resourceChip" class="action-block__res-chip">
        <span class="action-block__res-icon" :class="resIconClass" aria-hidden="true"></span>
        <span class="action-block__res-count">{{ resourceCount }}</span>
      </span>
      <span v-if="headerBadge !== ''"
            class="action-block__status"
            :class="'action-block__status--' + state.status">
        <span class="action-block__status-dot" aria-hidden="true"></span>
        <span v-i18n>{{ headerBadge }}</span>
      </span>
    </div>

    <!-- MULTI-BRANCH: one sub-block per branch (available + unavailable). -->
    <div v-if="isMultiBranch" class="action-block__branches">
      <div v-for="(bv, p) in branchViews"
           :key="bv.key"
           class="action-block__branch"
           :class="{'action-block__branch--off': !branchState(bv.branch).activatable}">
        <!-- ONLY the printed action graphic — no impact chips (those belong to
             the confirmation popup, not the overlay). -->
        <div class="action-block__branch-body"
             tabindex="0"
             role="button"
             @mouseenter="onPreviewEnter"
             @mouseleave="onPreviewLeave"
             @focus="onPreviewEnter"
             @blur="onPreviewLeave"
             @click="$emit('open', cardName)"
             @keydown.enter="$emit('open', cardName)">
          <div v-if="bv.node !== undefined" class="action-block__render card-container" v-i18n v-strip-action-prefix>
            <CardRenderEffectBoxComponent v-if="bv.node.actionNode !== undefined" :effectData="bv.node.actionNode" />
            <CardRenderData v-else-if="bv.node.renderRoot !== undefined" :renderData="bv.node.renderRoot" />
            <span v-else-if="bv.node.text" class="action-block__render-text">{{ bv.node.text }}</span>
          </div>
          <span v-else-if="branchTitle(bv.branch) !== ''" class="action-block__branch-title" v-i18n>{{ branchTitle(bv.branch) }}</span>
        </div>
        <div class="action-block__branch-foot">
          <button v-if="branchState(bv.branch).activatable"
                  type="button"
                  class="action-activate-btn action-activate-btn--ready"
                  :data-test="'action-activate-' + cardName + '-' + p"
                  @click.stop="$emit('activate', {cardName, branchPosition: p})">
            <span class="action-activate-btn__glow" aria-hidden="true"></span>
            <span class="action-activate-btn__icon" aria-hidden="true">▶</span>
            <span class="action-activate-btn__label" v-i18n>Activate</span>
          </button>
          <template v-else>
            <button type="button"
                    class="action-activate-btn"
                    :class="'action-activate-btn--' + branchState(bv.branch).status"
                    disabled>
              <span class="action-activate-btn__label" v-i18n>{{ branchFooterLabel(bv.branch) }}</span>
            </button>
            <div v-if="branchState(bv.branch).reasonText !== ''" class="action-block__branch-reason">
              <span class="action-block__branch-reason-dot" aria-hidden="true"></span>
              <span class="action-block__branch-reason-text">{{ branchState(bv.branch).reasonText }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- SINGLE-ACTION (or preview not yet loaded): one block + one button. -->
    <template v-else>
      <div class="action-block__body"
           tabindex="0"
           role="button"
           @mouseenter="onPreviewEnter"
           @mouseleave="onPreviewLeave"
           @focus="onPreviewEnter"
           @blur="onPreviewLeave"
           @click="$emit('open', cardName)"
           @keydown.enter="$emit('open', cardName)">
        <div v-for="node in group.nodes"
             :key="node.key"
             class="action-block__render-wrap">
          <div v-if="node.actionNode !== undefined" class="action-block__render card-container" v-i18n v-strip-action-prefix>
            <CardRenderEffectBoxComponent :effectData="node.actionNode" />
          </div>
          <div v-else-if="node.renderRoot !== undefined" class="action-block__render card-container" v-i18n v-strip-action-prefix>
            <CardRenderData :renderData="node.renderRoot" />
            <div v-if="node.text" class="action-block__render-desc"><span v-i18n>{{ node.text }}</span></div>
          </div>
          <div v-else class="action-block__render-text" v-i18n v-strip-action-prefix>{{ node.text }}</div>
        </div>
      </div>

      <div class="action-block__footer">
        <button v-if="state.activatable"
                type="button"
                class="action-activate-btn action-activate-btn--ready"
                :data-test="'action-activate-' + cardName"
                @click.stop="$emit('activate', {cardName, branchPosition: singleBranchPosition})">
          <span class="action-activate-btn__glow" aria-hidden="true"></span>
          <span class="action-activate-btn__icon" aria-hidden="true">▶</span>
          <span class="action-activate-btn__label" v-i18n>Activate</span>
        </button>

        <div v-else
             class="action-block__disabled-wrap"
             tabindex="0"
             @mouseenter="onReasonEnter"
             @mouseleave="onReasonLeave"
             @focus="onReasonEnter"
             @blur="onReasonLeave">
          <button type="button"
                  class="action-activate-btn"
                  :class="'action-activate-btn--' + state.status"
                  disabled>
            <span class="action-activate-btn__label" v-i18n>{{ footerLabel }}</span>
          </button>

          <transition name="action-reason-fade">
            <HandCardReasonPopover
              v-if="showReason && state.status === 'rules' && state.reasons.length > 0"
              :reasons="state.reasons"
              heading="Cannot activate"
              :class="{'hand-reason--below': reasonBelow}"
              :style="reasonStyle" />
            <div v-else-if="showReason && softText !== ''"
                 class="hand-soft-reason"
                 :class="{'hand-soft-reason--below': reasonBelow}"
                 :style="reasonStyle"
                 role="tooltip">
              <span class="hand-soft-reason__dot" aria-hidden="true"></span>
              <span class="hand-soft-reason__text">{{ softText }}</span>
            </div>
          </transition>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Message} from '@/common/logs/Message';
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionGroup, actionNodeDescription} from '@/client/components/actions/actionExtraction';
import {ActionState} from '@/client/components/actions/actionPlayability';
import {assignBranchNodes} from '@/client/components/actions/actionBranchNodes';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import HandCardReasonPopover from '@/client/components/handCards/HandCardReasonPopover.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {translateText, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {ActionStatus} from '@/client/components/actions/actionPlayability';

type GroupNode = ActionGroup['nodes'][number];
type BranchView = {key: string, node: GroupNode | undefined, branch: ActionPreviewBranch};
type BranchUiState = {activatable: boolean, reasonText: string, status: ActionStatus};

export default defineComponent({
  name: 'ActionBlock',
  components: {CardRenderEffectBoxComponent, CardRenderData, HandCardReasonPopover},
  directives: {stripActionPrefix},
  props: {
    entry: {
      type: Object as PropType<ActionEntry>,
      required: true,
    },
    // The read-only action preview (branches + per-branch availability + effects),
    // fetched by the overlay. Undefined until it loads / for opponent views.
    preview: {
      type: Object as PropType<ActionPreview>,
      default: undefined,
    },
    // The live tableau CardModel — for the stored-resource count chip.
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
  },
  emits: ['namehover', 'open', 'activate'],
  data() {
    return {
      showReason: false,
      reasonBelow: false,
      reasonShift: 0,
    };
  },
  computed: {
    group(): ActionGroup {
      return this.entry.group;
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
    isMultiBranch(): boolean {
      return this.preview !== undefined && this.preview.branches.length > 1;
    },
    // The branch POSITION (ordinal in the preview) to open for a single block.
    // The modal selects the branch by POSITION (not the runtime index, which is
    // ambiguous: an unavailable branch and an auto-resolved lone branch BOTH have
    // index -1). Undefined before the preview loads → the modal's own picker.
    singleBranchPosition(): number | undefined {
      return (this.preview !== undefined && this.preview.branches.length >= 1) ? 0 : undefined;
    },
    branchViews(): ReadonlyArray<BranchView> {
      const branches = this.preview?.branches ?? [];
      if (branches.length <= 1) {
        return [];
      }
      const nodes = this.group.nodes;
      // Per-branch graphics only when the render SPLITS CLEANLY (≥ one node per
      // branch). When a card draws ALL branches in ONE combined node (Self-
      // Replicating Robots: "→ link · OR · → ×2"), handing that node to a single
      // branch paints the WHOLE action on it (misleading) — fall back to each
      // branch's own title text instead. Mirrors CardActionConfirmContent.
      if (nodes.length < branches.length) {
        return branches.map((branch, i): BranchView => ({
          key: this.cardName + '#br' + i,
          node: undefined,
          branch,
        }));
      }
      const indices = assignBranchNodes(
        branches.map((b) => this.branchTitle(b)),
        nodes.map((n) => actionNodeDescription(n)),
      );
      return branches.map((branch, i): BranchView => ({
        key: this.cardName + '#br' + i,
        node: this.nodeAt(indices[i]),
        branch,
      }));
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
    footerLabel(): string {
      switch (this.state.status) {
      case 'activated': return 'Activated';
      case 'rules': return 'Unavailable';
      default: return 'Activate'; // soft — disabled, calm
      }
    },
    softText(): string {
      const r = this.state.softReason;
      return r === undefined ? '' : translateTextWithParams(r.message, [...(r.params ?? [])]);
    },
    // The card-level disabled text reused for every branch when the WHOLE action
    // can't be taken (not your turn / activated / blocked by rules).
    cardDisabledText(): string {
      if (this.state.status === 'rules' && this.state.reasons.length > 0) {
        const r = this.state.reasons[0];
        return translateTextWithParams(r.message, [...(r.params ?? [])]);
      }
      return this.softText;
    },
    reasonStyle(): Record<string, string> {
      return {
        'marginLeft': `${this.reasonShift}px`,
        '--reason-caret': `${-this.reasonShift}px`,
      };
    },
  },
  methods: {
    nodeAt(idx: number | undefined): GroupNode | undefined {
      if (idx === undefined || idx < 0) {
        return undefined;
      }
      return this.group.nodes[idx];
    },
    branchTitle(b: ActionPreviewBranch): string {
      return typeof b.title === 'string' ? b.title : (b.title as Message).message;
    },
    // Per-branch availability: the card-level state takes precedence (not your
    // turn / activated / rules), then the branch's own affordability.
    branchState(branch: ActionPreviewBranch): BranchUiState {
      if (this.state.status === 'available') {
        if (branch.available) {
          return {activatable: true, reasonText: '', status: 'available'};
        }
        const reason = branch.unavailableReason;
        const reasonText = reason === undefined ?
          translateText('Cannot activate') :
          (typeof reason === 'string' ? translateText(reason) : translateMessage(reason));
        return {activatable: false, reasonText, status: 'rules'};
      }
      return {activatable: false, reasonText: this.cardDisabledText, status: this.state.status};
    },
    // The disabled button label for a non-activatable branch (mirrors footerLabel).
    branchFooterLabel(branch: ActionPreviewBranch): string {
      switch (this.branchState(branch).status) {
      case 'activated': return 'Activated';
      case 'rules': return 'Unavailable';
      default: return 'Activate'; // soft — disabled, calm
      }
    },
    onPreviewEnter(e: MouseEvent | FocusEvent): void {
      const el = e.currentTarget as HTMLElement | null;
      if (el === null) {
        return;
      }
      this.$emit('namehover', {name: this.cardName, rect: el.getBoundingClientRect()});
    },
    onPreviewLeave(): void {
      this.$emit('namehover', null);
    },
    onReasonEnter(): void {
      this.showReason = true;
      this.$nextTick(() => this.placeReason());
    },
    onReasonLeave(): void {
      this.showReason = false;
      this.reasonBelow = false;
      this.reasonShift = 0;
    },
    placeReason(): void {
      const root = this.$el as HTMLElement;
      const wrapper = root.querySelector('.action-block__disabled-wrap') as HTMLElement | null;
      const pop = root.querySelector('.hand-reason, .hand-soft-reason') as HTMLElement | null;
      if (wrapper === null || pop === null) {
        return;
      }
      const scroller = root.closest('.actions-board__body') as HTMLElement | null;
      const wrapRect = wrapper.getBoundingClientRect();
      const scRect = scroller?.getBoundingClientRect();
      const pad = 8;
      const limitTop = scRect ? scRect.top : 0;
      this.reasonBelow = (wrapRect.top - pop.offsetHeight - 12) < limitTop;
      if (scRect !== undefined) {
        const popW = pop.offsetWidth;
        const centerX = wrapRect.left + wrapRect.width / 2;
        const leftEdge = centerX - popW / 2;
        const rightEdge = centerX + popW / 2;
        let shift = 0;
        if (leftEdge < scRect.left + pad) {
          shift = (scRect.left + pad) - leftEdge;
        } else if (rightEdge > scRect.right - pad) {
          shift = (scRect.right - pad) - rightEdge;
        }
        this.reasonShift = Math.round(shift);
      }
    },
  },
});
</script>
