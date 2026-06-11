<template>
  <!--
    Premium ACTION PLANNING gate before an activatable action is submitted. Hosted
    inside MandatoryInputModal. On open it fetches a READ-ONLY preview
    (/api/action-preview) of the action's branches, each with its COSTS and GAINS
    as icon chips (current → resulting) + the interactive choices it needs. The
    player makes EVERY choice HERE; the final ВЫПОЛНИТЬ submits everything in ONE
    batch request (no follow-up modal spam). Client-side only until ВЫПОЛНИТЬ;
    Cancel restores the overlay with no round-trip.
  -->
  <div class="action-confirm" :class="[{'action-confirm--corp': isCorporation}, widthClass]">
    <div class="action-confirm__frame">
      <div class="action-confirm__corner action-confirm__corner--tl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--tr" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--bl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--br" aria-hidden="true"></div>

      <header class="action-confirm__header">
        <span class="action-confirm__kicker">
          <span class="action-confirm__kicker-dot" aria-hidden="true"></span>
          <span class="action-confirm__kicker-text" v-i18n>Action confirmation</span>
        </span>
        <h3 class="action-confirm__title" v-i18n>{{ headerTitle }}</h3>
      </header>

      <!-- TOP ROW: compact source preview (left) + the effect / result hero
           panel (right). Fixed height — never grows with the choice count, so the
           choices block below owns all the flexible vertical space. -->
      <div class="action-confirm__top">
        <aside class="action-confirm__source">
          <span class="action-confirm__source-label" v-i18n>Source</span>
          <button type="button"
                  class="action-confirm__card"
                  :aria-label="$t('Open fullscreen')"
                  @click.capture.stop="openFullscreen"
                  @keydown.enter="openFullscreen">
            <Card :card="cardModel" />
            <span class="action-confirm__zoom" aria-hidden="true">⤢</span>
          </button>
          <!-- REVEAL / deck-check: the slot sits UNDER the source (this column has
               the vertical room), so the revealed card later appears EXACTLY here
               (the App-level result overlay mirrors this layout). -->
          <ActionRevealSlot v-if="!loading && selected !== undefined && selected.reveal !== undefined"
                            state="empty"
                            :reveal="selected.reveal" />
        </aside>

        <section class="action-confirm__action">
          <!-- Preview loading skeleton. -->
          <div v-if="loading" class="action-confirm__loading">
            <span class="action-confirm__loading-dot" aria-hidden="true"></span>
            <span class="action-confirm__loading-dot" aria-hidden="true"></span>
            <span class="action-confirm__loading-dot" aria-hidden="true"></span>
          </div>

          <template v-else-if="preview !== undefined">
            <!-- SELECTED BRANCH: clear labelled sections — the rule (ДЕЙСТВИЕ), the
                 impact (РЕЗУЛЬТАТ), and the scoring context (ПРОГРЕСС ПО). Works for
                 a single-action card AND a branch chosen from the overlay. -->
            <div v-if="selected !== undefined" class="action-confirm__summary">
              <span class="action-confirm__summary-label" v-i18n>You are about to</span>

              <div class="action-confirm__section" v-if="summaryNodes.length > 0">
                <span class="action-confirm__section-label" v-i18n>Action</span>
                <div class="action-confirm__graphic">
                  <div v-for="node in summaryNodes" :key="node.key" class="action-confirm__render-wrap">
                    <div v-if="node.actionNode !== undefined" class="action-confirm__render card-container" v-i18n v-strip-action-prefix>
                      <CardRenderEffectBoxComponent :effectData="node.actionNode" />
                    </div>
                    <div v-else-if="node.renderRoot !== undefined" class="action-confirm__render card-container" v-i18n v-strip-action-prefix>
                      <CardRenderData :renderData="node.renderRoot" />
                      <div v-if="node.text" class="action-confirm__render-desc"><span v-i18n>{{ node.text }}</span></div>
                    </div>
                    <div v-else class="action-confirm__render-text" v-i18n v-strip-action-prefix>{{ node.text }}</div>
                  </div>
                </div>
              </div>
              <!-- No clean per-branch graphic (a combined-node card like
                   Self-Replicating Robots): show the chosen branch's own title so
                   the player reads exactly which option they're taking, not the
                   whole combined action. -->
              <div class="action-confirm__section" v-else-if="selectedTitle !== ''">
                <span class="action-confirm__section-label" v-i18n>Action</span>
                <div class="action-confirm__action-text" v-i18n>{{ selectedTitle }}</div>
              </div>

              <div class="action-confirm__section" v-if="selected.effects.length > 0">
                <span class="action-confirm__section-label" v-i18n>Result</span>
                <div class="action-confirm__chips action-confirm__chips--summary">
                  <ActionEffectChip v-for="(e, i) in selected.effects" :key="i" :effect="e" />
                </div>
              </div>

              <!-- "What happens next" context notes (tile placement / colony / a
                   special board move). Shown HERE in the always-visible summary so
                   they're never buried below a tall payment widget in the choices
                   block — the player always sees what confirming will require. -->
              <div class="action-confirm__section" v-if="noteSteps.length > 0">
                <span class="action-confirm__section-label" v-i18n>Next</span>
                <div v-for="(note, i) in noteSteps" :key="i" class="action-confirm__step action-confirm__step--placement">
                  <span class="action-confirm__step-glyph" aria-hidden="true">◎</span>
                  <span class="action-confirm__step-text" v-i18n>{{ noteText(note) }}</span>
                </div>
              </div>

              <div class="action-confirm__section" v-if="vpProgress !== undefined">
                <ActionVpProgress :cardName="cardName"
                                  :resourceIcon="vpProgress.icon"
                                  :before="vpProgress.before"
                                  :after="vpProgress.after" />
              </div>

              <div v-if="!selected.available && selected.unavailableReason !== undefined" class="action-confirm__none" v-i18n>{{ text(selected.unavailableReason) }}</div>
            </div>

            <!-- Picking among several branches: a short intro here; the branch
                 picker itself lives in the wide choices block below. -->
            <div v-else-if="showBranchList" class="action-confirm__summary action-confirm__summary--intro">
              <span class="action-confirm__summary-label" v-i18n>You are about to</span>
              <p class="action-confirm__intro-hint" v-i18n>Choose one of the options below.</p>
            </div>

            <!-- Preview loaded but nothing actionable. -->
            <div v-else class="action-confirm__none" v-i18n>This action can't be taken right now.</div>
          </template>

          <!-- Preview failed to load (network) — never leave the panel blank. -->
          <div v-else class="action-confirm__none" v-i18n>This action can't be taken right now.</div>
        </section>
      </div>

      <!-- CHOICES: the large, adaptive, full-width decision area. It owns the
           flexible vertical space and is the ONLY part that scrolls (last resort),
           so the footer CTA always stays anchored. The modal widens (widthClass)
           so candidates spread horizontally before this block ever scrolls. -->
      <div v-if="!loading && preview !== undefined && hasChoices" class="action-confirm__choices">
        <!-- FALLBACK branch picker — only when the modal was NOT opened for a
             specific branch (the overlay normally splits branches into their own
             buttons and passes the chosen one). Shows EVERY branch with its reason
             + context chips. -->
        <div v-if="showBranchList" class="action-confirm__branches">
          <span class="action-confirm__branches-label" v-i18n>Choose an option</span>
          <div class="action-confirm__branches-grid">
            <button v-for="(bv, p) in branchViews"
                    :key="branchKey(bv.branch) + '#' + p"
                    type="button"
                    class="action-confirm__branch"
                    :class="{
                      'action-confirm__branch--selected': selected === bv.branch,
                      'action-confirm__branch--disabled': !bv.branch.available,
                    }"
                    :disabled="!bv.branch.available"
                    :data-test="'action-branch-' + p"
                    @click="selectBranch(bv.branch)">
              <span v-if="bv.branch.available" class="action-confirm__branch-tick" aria-hidden="true"></span>
              <span class="action-confirm__branch-main">
                <div v-if="bv.node !== undefined" class="action-confirm__render action-confirm__render--branch card-container" v-i18n v-strip-action-prefix>
                  <CardRenderEffectBoxComponent v-if="bv.node.actionNode !== undefined" :effectData="bv.node.actionNode" />
                  <CardRenderData v-else-if="bv.node.renderRoot !== undefined" :renderData="bv.node.renderRoot" />
                  <span v-else-if="bv.node.text">{{ bv.node.text }}</span>
                </div>
                <span v-else-if="text(bv.branch.title)" class="action-confirm__branch-title" v-i18n>{{ text(bv.branch.title) }}</span>
                <span v-if="bv.branch.effects.length > 0" class="action-confirm__chips">
                  <ActionEffectChip v-for="(e, i) in bv.branch.effects" :key="i" :effect="e" />
                </span>
                <span v-if="!bv.branch.available && bv.branch.unavailableReason !== undefined" class="action-confirm__branch-reason" v-i18n>{{ text(bv.branch.unavailableReason) }}</span>
              </span>
            </button>
          </div>
        </div>

        <!-- The branch's OWN input (its OrOptions option is a SelectAmount /
             SelectCard directly) — its response nests into the branch pick. -->
        <div v-if="selected !== undefined && selected.optionInput !== undefined" class="action-confirm__steps">
          <div class="action-confirm__step action-confirm__step--input"
               :class="{
                 'action-confirm__step--answered': capturedOption !== undefined,
                 'action-confirm__step--bare': isHandCardInput(selected.optionInput),
               }">
            <ModernPlayerPicker v-if="selected.optionInput.type === 'player'"
                                :controlled="true"
                                :playerView="playerView"
                                :playerinput="selected.optionInput"
                                :onsave="noop"
                                @select="captureOption" />
            <!-- A pick FROM HAND goes to the КАРТЫ В РУКЕ overlay (roomy
                 premium surface), NOT the cramped in-modal tile grid. Show
                 the chosen card here once picked + a "ВЫБРАТЬ КАРТУ" CTA. -->
            <div v-else-if="isHandCardInput(selected.optionInput)" class="action-confirm__handpick">
              <div v-if="optionChosenCard !== undefined" class="action-confirm__handpick-chosen">
                <button type="button"
                        class="action-confirm__handpick-card"
                        :aria-label="$t('Open fullscreen')"
                        @click.capture.stop="openChosenFullscreen">
                  <Card :card="optionChosenCard" />
                </button>
                <button type="button" class="action-confirm__handpick-change" @click="requestOptionPick" data-test="action-pick-change">
                  <span class="action-confirm__handpick-change-glyph" aria-hidden="true">⟲</span>
                  <span v-i18n>Choose another card</span>
                </button>
              </div>
              <button v-else type="button" class="action-confirm__handpick-btn" @click="requestOptionPick" data-test="action-pick-card">
                <span class="action-confirm__handpick-btn-glyph" aria-hidden="true">▤</span>
                <span class="action-confirm__handpick-btn-label" v-i18n>Pick a card from hand</span>
              </button>
            </div>
            <ActionTargetCard v-else-if="selected.optionInput.type === 'card'"
                              :playerView="playerView"
                              :input="selected.optionInput"
                              :selectedName="capturedOptionCardName"
                              @change="captureOption" />
            <ModalInputHost v-else :playerView="playerView" :playerinput="selected.optionInput" :onsave="captureOption" />
          </div>
        </div>

        <!-- Interactive choices for the selected branch (the context "what happens
             next" notes live in the always-visible summary panel above — they must
             NOT be buried below a tall payment widget here). -->
        <div v-if="selected !== undefined && hasInputSteps" class="action-confirm__steps">
          <template v-for="(step, i) in selected.steps" :key="i">
            <div v-if="step.kind === 'input'" class="action-confirm__step action-confirm__step--input"
                 :class="{
                   'action-confirm__step--answered': captured[i] !== undefined,
                   'action-confirm__step--bare': step.input.type === 'payment',
                 }">
              <!-- Premium, OWNER-AWARE target pickers in controlled mode: the
                   pick is captured here and committed by the single ВЫПОЛНИТЬ
                   (no per-step submit). Other input types fall back to the
                   capturing ModalInputHost. -->
              <ModernPlayerPicker v-if="step.input.type === 'player'"
                                  :controlled="true"
                                  :playerView="playerView"
                                  :playerinput="step.input"
                                  :onsave="noop"
                                  @select="captureStep(i)($event)" />
              <ActionTargetCard v-else-if="step.input.type === 'card'"
                                :playerView="playerView"
                                :input="step.input"
                                :amount="step.amount"
                                :selectedName="capturedCardName(i)"
                                @change="captureStep(i)($event)" />
              <!-- Payment (e.g. "pay 12 M€, titanium usable") dialed IN the
                   modal via the controlled payment widget — captured live,
                   committed by the single ВЫПОЛНИТЬ. No separate SelectPayment
                   follow-up modal. -->
              <SelectPaymentV2 v-else-if="step.input.type === 'payment'"
                               :controlled="true"
                               :playerView="playerView"
                               :playerinput="step.input"
                               :onsave="noop"
                               :showsave="false"
                               :showtitle="false"
                               @change="captureStep(i)($event)" />
              <ModalInputHost v-else :playerView="playerView" :playerinput="step.input" :onsave="captureStep(i)" />
            </div>
          </template>
        </div>
      </div>

      <footer class="action-confirm__footer">
        <div class="action-confirm__actions">
          <button class="action-confirm__cancel cab-action-confirm-cancel"
                  @click="$emit('cancel')"
                  data-test="action-confirm-cancel">
            <span class="cab-action-confirm-cancel__label" v-i18n>Cancel</span>
          </button>
          <button class="action-confirm__confirm cab-action-confirm-go"
                  :disabled="!canConfirm"
                  @click="confirm"
                  data-test="action-confirm-confirm">
            <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
            <span class="cab-action-confirm-go__icon" aria-hidden="true">▶</span>
            <span class="cab-action-confirm-go__label" v-i18n>Perform action</span>
          </button>
        </div>
      </footer>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoomModal"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionPreview, ActionPreviewBranch, ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ActionGroup, playerActionGroups, actionNodeDescription, branchActionNode} from '@/client/components/actions/actionExtraction';
import {assignBranchNodes} from '@/client/components/actions/actionBranchNodes';
import Card from '@/client/components/card/Card.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import ModernPlayerPicker from '@/client/components/modalInputs/ModernPlayerPicker.vue';
import SelectPaymentV2 from '@/client/components/SelectPaymentV2.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';
import ActionVpProgress from '@/client/components/actions/ActionVpProgress.vue';
import ActionRevealSlot from '@/client/components/actions/ActionRevealSlot.vue';
import {resourceScoring} from '@/client/components/additionalResources/additionalResources';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {handActionPickResult} from '@/client/components/handCards/handActionPick';
import {translateText, translateMessage} from '@/client/directives/i18n';

// The request the confirm modal emits to PlayerHome to host the КАРТЫ В РУКЕ
// overlay for a "pick a card from hand" step (Self-Replicating Robots link).
export type HandPickRequest = {
  title: string | Message;
  buttonLabel: string;
  selectable: ReadonlyArray<CardName>;
  reasons: Record<string, string>;
};

type ConfirmPayload = {branchIndex: number, optionResponse: InputResponse | undefined, stepResponses: ReadonlyArray<InputResponse>, reveal?: ActionRevealDescriptor};
type GroupNode = ActionGroup['nodes'][number];

export default defineComponent({
  name: 'CardActionConfirmContent',
  components: {Card, CardRenderEffectBoxComponent, CardRenderData, CardZoomModal, ModalInputHost, ModernPlayerPicker, SelectPaymentV2, ActionEffectChip, ActionTargetCard, ActionVpProgress, ActionRevealSlot},
  directives: {stripActionPrefix},
  props: {
    cardName: {
      type: String as PropType<CardName>,
      required: true,
    },
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
    // The viewer's player model — needed to fetch the preview (id) and to host
    // the embedded input steps (ModalInputHost requires it).
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    // When the overlay split a multi-branch action into per-branch buttons, the
    // chosen branch's POSITION (ordinal in the preview) is passed here so the
    // modal opens straight on that branch (no in-modal picker). Position — NOT
    // the runtime index — because the runtime index is ambiguous (an unavailable
    // branch and an auto-resolved lone branch both have index -1). `undefined` →
    // the modal falls back to its own picker (dynamic cards / pre-load click).
    branchPosition: {
      type: Number,
      default: undefined,
    },
  },
  emits: ['confirm', 'cancel', 'pick-card'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
      // True between emitting `pick-card` and the result arriving via the bridge,
      // so a stale epoch bump can't capture into the wrong slot.
      awaitingPick: false,
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selected: undefined as ActionPreviewBranch | undefined,
      captured: {} as Record<number, InputResponse>,
      // The response to the branch's own OrOptions input (optionInput), if any.
      capturedOption: undefined as InputResponse | undefined,
    };
  },
  computed: {
    cardModel(): CardModel {
      return this.card ?? ({name: this.cardName} as CardModel);
    },
    isCorporation(): boolean {
      return getCard(this.cardName)?.type === CardType.CORPORATION;
    },
    headerTitle(): string {
      return this.isCorporation ? 'Activate corporation action' : 'Activate card action';
    },
    // The card's printed action graphic (the ACTION IDENTITY / rule) — always
    // shown so the player sees the rule, not just the impact numbers.
    group(): ActionGroup | undefined {
      return playerActionGroups([{name: this.cardName} as CardModel])[0];
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    // Show the in-modal picker ONLY as a fallback: the modal wasn't opened for a
    // specific branch AND nothing is selected yet AND there's a real choice.
    showBranchList(): boolean {
      return this.branchPosition === undefined && this.selected === undefined && this.branches.length > 1;
    },
    // Whether the wide choices block has anything to host (a branch picker, the
    // branch's own input, or any steps). When false the modal is just the top row
    // (source + summary) + footer — a compact confirm with no decision area.
    hasChoices(): boolean {
      if (this.showBranchList) {
        return true;
      }
      const b = this.selected;
      if (b === undefined) {
        return false;
      }
      // Only INTERACTIVE inputs make a choices block — a reveal slot lives under the
      // source, and context notes live in the summary, so neither leaves an empty
      // choices area (e.g. MarsNomads, whose only "step" is a board-move note).
      return b.optionInput !== undefined || this.hasInputSteps;
    },
    // The branch's interactive input steps (payment / target pickers) — what the
    // choices block hosts. Excludes context notes (boardPlacement / note), which
    // are surfaced in the always-visible summary panel instead.
    hasInputSteps(): boolean {
      return this.selected?.steps.some((s) => s.kind === 'input') ?? false;
    },
    // The branch's "what happens next" context notes (board placement / colony / a
    // special move) — rendered in the summary so they're never scrolled away.
    noteSteps(): ReadonlyArray<{kind: string, placementType?: string, noteKind?: string, text?: string | Message}> {
      return (this.selected?.steps ?? []).filter((s) => s.kind === 'boardPlacement' || s.kind === 'note') as ReadonlyArray<{kind: string}>;
    },
    // The number of selectable CARD tiles the choices block will render. Drives the
    // width bucket (widthClass) so the modal expands horizontally — spreading the
    // candidates across more columns — BEFORE the choices block has to scroll.
    // (Player / payment / amount inputs are compact and never need extra width.)
    choiceTileCount(): number {
      const countCards = (input: {type: string, cards?: ReadonlyArray<unknown>, disabledCards?: ReadonlyArray<unknown>} | undefined): number => {
        if (input === undefined || input.type !== 'card') {
          return 0;
        }
        return (input.cards?.length ?? 0) + (input.disabledCards?.length ?? 0);
      };
      let n = 0;
      const b = this.selected;
      if (b !== undefined) {
        // The branch's own optionInput counts ONLY when it renders as inline tiles
        // (ActionTargetCard). A pick FROM HAND routes to the КАРТЫ В РУКЕ overlay
        // behind a single "Pick a card from hand" CTA — it shows NO tiles here, so
        // it must NOT widen the modal (the Self-Replicating Robots case).
        if (b.optionInput !== undefined && !this.isHandCardInput(b.optionInput)) {
          n += countCards(b.optionInput as {type: string});
        }
        // Steps with a 'card' input always render inline tiles.
        for (const step of b.steps) {
          if (step.kind === 'input') {
            n += countCards(step.input as {type: string});
          }
        }
      }
      // The branch picker also benefits from a little extra room when there are
      // several branches to lay side by side.
      if (this.showBranchList) {
        n = Math.max(n, this.branches.length);
      }
      return n;
    },
    // Discrete width buckets (CSS sets the matching `--ac-width`). Expanding the
    // modal sideways uses free screen space first; vertical scroll is the last
    // resort. Capped in CSS at the viewport width.
    widthClass(): string {
      // Thresholds match how many ~165px tiles fit one row: up to 3 fit the
      // compact 600px default; 4–5 → ~900px; 6–7 → ~1180px; 8+ → ~1380px (then
      // the choices block wraps to a second row within that width, scrolling only
      // when even that overflows the viewport height).
      const n = this.choiceTileCount;
      if (n >= 8) {
        return 'action-confirm--wide-xl';
      }
      if (n >= 6) {
        return 'action-confirm--wide-l';
      }
      if (n >= 4) {
        return 'action-confirm--wide-m';
      }
      return '';
    },
    // The render node(s) shown in the SELECTED-branch summary: the branch's own
    // matched node (single-action card, or a cleanly-split multi-branch). When
    // there's no clean match (a combined-node card like Self-Replicating Robots)
    // there's NO graphic — the branch title is shown instead (selectedTitle), so
    // we never paint the whole combined action on a single branch.
    summaryNodes(): ReadonlyArray<GroupNode> {
      const node = this.selectedNode;
      return node !== undefined ? [node] : [];
    },
    // The selected branch's own title text — shown in the summary when there's no
    // per-branch graphic (combined-node cards), so the player still reads exactly
    // which option they're taking. Empty for a single-action card (no title).
    selectedTitle(): string {
      return this.selected !== undefined ? this.text(this.selected.title) : '';
    },
    selectedNode(): GroupNode | undefined {
      const branch = this.selected;
      if (branch === undefined) {
        return undefined;
      }
      const view = this.branchViews.find((bv) => bv.branch === branch);
      return view?.node;
    },
    // VP-progress context for the SELECTED branch: present when the action
    // changes THIS card's resource AND that resource scores VP — both thresholds
    // (Tardigrades: 1 VP / 4 microbes) and per-resource multipliers (Physics
    // Complex: 2 VP / science). Derived entirely client-side from the manifest —
    // the effect already carries before→after; ActionVpProgress adapts the
    // display (bar for thresholds, plain VP delta for multipliers).
    vpProgress(): {icon: string, before: number, after: number} | undefined {
      const branch = this.selected;
      if (branch === undefined) {
        return undefined;
      }
      // Any card that scores VP from this resource (threshold OR per-resource
      // multiplier like Physics Complex's 2 VP each) shows the VP context; the
      // ActionVpProgress component adapts the display (bar only for thresholds).
      const scoring = resourceScoring(this.cardName);
      if (scoring === undefined) {
        return undefined;
      }
      const eff = branch.effects.find((e) => e.note === 'on this card' && e.current !== undefined && e.resulting !== undefined);
      if (eff === undefined || eff.current === undefined || eff.resulting === undefined) {
        return undefined;
      }
      return {icon: eff.icon, before: eff.current, after: eff.resulting};
    },
    availableBranches(): ReadonlyArray<ActionPreviewBranch> {
      return this.branches.filter((b) => b.available);
    },
    hasAnyAvailable(): boolean {
      return this.availableBranches.length > 0;
    },
    // Each branch paired with the printed render node that draws it (matched by
    // title so the graphic is right even when render order ≠ behavior order).
    branchViews(): ReadonlyArray<{branch: ActionPreviewBranch, node: GroupNode | undefined}> {
      const nodes = this.group?.nodes ?? [];
      // Per-branch graphics only when the render SPLITS CLEANLY (≥ one node per
      // branch). When a card draws ALL its branches in ONE combined node — e.g.
      // Self-Replicating Robots' "→ link · OR · → ×2" graphic — handing that node
      // to a single branch would paint the WHOLE action on it (the other branch's
      // part included), which misleads. In that case fall back to each branch's
      // own title text (no graphic), so the two choices read distinctly.
      if (nodes.length < this.branches.length) {
        return this.branches.map((branch) => ({branch, node: undefined}));
      }
      const indices = assignBranchNodes(
        this.branches.map((b) => this.text(b.title)),
        nodes.map((n) => actionNodeDescription(n)),
      );
      return this.branches.map((branch, p) => ({branch, node: this.branchNode(indices[p])}));
    },
    canConfirm(): boolean {
      const branch = this.selected;
      if (this.loading || branch === undefined || !branch.available) {
        return false;
      }
      // The branch's own OrOptions input (optionInput) must be answered too.
      if (branch.optionInput !== undefined && this.capturedOption === undefined) {
        return false;
      }
      return branch.steps.every((step, i) => step.kind !== 'input' || this.captured[i] !== undefined);
    },
    capturedOptionCardName(): CardName | undefined {
      const r = this.capturedOption;
      return (r !== undefined && r.type === 'card') ? r.cards[0] : undefined;
    },
    // Bridged result epoch from the КАРТЫ В РУКЕ overlay pick (see the watcher).
    pickEpoch(): number {
      return handActionPickResult.epoch;
    },
    // The chosen card's full model (for rendering it in the modal after the pick).
    optionChosenCard(): CardModel | undefined {
      const input = this.selected?.optionInput;
      const name = this.capturedOptionCardName;
      if (input === undefined || input.type !== 'card' || name === undefined) {
        return undefined;
      }
      return (input as SelectCardModel).cards.find((c) => c.name === name);
    },
  },
  watch: {
    // A card picked in the КАРТЫ В РУКЕ overlay was delivered back via the bridge.
    // Capture it as this branch's optionInput response (only while we're the one
    // who requested it — `awaitingPick` guards against a stale bump).
    pickEpoch(): void {
      if (!this.awaitingPick) {
        return;
      }
      this.awaitingPick = false;
      const card = handActionPickResult.card;
      if (card !== undefined) {
        this.captureOption({type: 'card', cards: [card]});
      }
    },
  },
  mounted(): void {
    this.fetchPreview();
  },
  methods: {
    text(m: string | Message): string {
      return typeof m === 'string' ? m : m.message;
    },
    // True when a 'card' input is a pick FROM HAND (every candidate — selectable
    // or disabled — is in the player's hand). Those route to the КАРТЫ В РУКЕ
    // overlay (a roomy premium surface), NOT the cramped in-modal tile picker.
    isHandCardInput(input: {type: string, cards?: ReadonlyArray<CardModel>, disabledCards?: ReadonlyArray<CardModel>} | undefined): boolean {
      if (input === undefined || input.type !== 'card') {
        return false;
      }
      const hand = new Set((this.playerView.cardsInHand ?? []).map((c) => c.name));
      const all = [...(input.cards ?? []), ...(input.disabledCards ?? [])];
      return all.length > 0 && all.every((c) => hand.has(c.name));
    },
    // Emit the request to host the hand overlay for the selected branch's card
    // pick. PlayerHome opens the overlay in client-pick mode and suppresses this
    // modal; the picked card returns through the bridge (the `pickEpoch` watcher).
    requestOptionPick(): void {
      const input = this.selected?.optionInput as SelectCardModel | undefined;
      if (input === undefined || input.type !== 'card') {
        return;
      }
      const reasons: Record<string, string> = {};
      for (const c of input.disabledCards ?? []) {
        const r = c.disabledReason;
        reasons[c.name] = r === undefined ? '' : (typeof r === 'string' ? translateText(r) : translateMessage(r));
      }
      this.awaitingPick = true;
      const request: HandPickRequest = {
        title: input.title,
        buttonLabel: input.buttonLabel,
        selectable: input.cards.map((c) => c.name),
        reasons,
      };
      this.$emit('pick-card', request);
    },
    // A specific, premium "what happens next" line for a context note — either a
    // board-tile placement (keyed by tile type) or a generic `note` step (colony /
    // special board move / generic), so the player knows EXACTLY what confirming
    // will require. A `note` with an explicit `text` overrides the canned copy.
    // Returned as an English i18n key — the `v-i18n` on the host span translates it.
    noteText(step: {kind: string, placementType?: string, noteKind?: string, text?: string | Message}): string {
      if (step.kind === 'note') {
        if (step.text !== undefined) {
          return this.text(step.text);
        }
        switch (step.noteKind) {
        case 'colony': return 'After confirming, choose a colony.';
        case 'board': return 'After confirming, choose a location on the board.';
        default: return 'After confirming, you will make one more choice.';
        }
      }
      switch (step.placementType) {
      case 'ocean': return 'After confirming, choose where to place the ocean tile on the board.';
      case 'city': return 'After confirming, choose where to place the city tile on the board.';
      case 'greenery': return 'After confirming, choose where to place the greenery tile on the board.';
      default: return 'You will place a tile on the board after confirming.';
      }
    },
    branchKey(b: ActionPreviewBranch): string {
      return this.text(b.title);
    },
    nodeAt(idx: number | undefined): GroupNode | undefined {
      if (idx === undefined || idx < 0) {
        return undefined;
      }
      return this.group?.nodes[idx];
    },
    // The branch's render node, shown on its OWN in the branch picker / summary —
    // strip a leading OR connector so the alternatives' "ИЛИ" join doesn't orphan.
    branchNode(idx: number | undefined): GroupNode | undefined {
      const node = this.nodeAt(idx);
      if (node === undefined || node.actionNode === undefined) {
        return node;
      }
      return {...node, actionNode: branchActionNode(node.actionNode)};
    },
    async fetchPreview(): Promise<void> {
      this.loading = true;
      try {
        const url = paths.API_ACTION_PREVIEW +
          '?id=' + encodeURIComponent(this.playerView.id) +
          '&card=' + encodeURIComponent(this.cardName);
        const response = await fetch(url);
        if (response.ok) {
          this.preview = await response.json() as ActionPreview;
          // Pre-select the branch the overlay chose (by POSITION) — unambiguous
          // even when several branches share runtime index -1.
          if (this.branchPosition !== undefined) {
            this.selected = this.preview.branches[this.branchPosition];
          }
          // Else auto-select when there's exactly ONE executable branch (a single-
          // action card, or a multi-branch card where only one branch is
          // affordable). When 2+ are executable the fallback picker shows; when
          // none, nothing is selected.
          if (this.selected === undefined && this.availableBranches.length === 1) {
            this.selected = this.availableBranches[0];
          }
        }
      } catch (err) {
        console.warn('Failed to fetch action preview', err);
      } finally {
        this.loading = false;
      }
    },
    selectBranch(b: ActionPreviewBranch): void {
      this.selected = b;
      this.captured = {}; // steps are branch-specific — reset captured responses.
      this.capturedOption = undefined;
    },
    captureStep(i: number): (out: InputResponse) => void {
      return (out: InputResponse) => {
        this.captured[i] = out;
      };
    },
    captureOption(out: InputResponse): void {
      this.capturedOption = out;
    },
    noop(): void {
      // ModernPlayerPicker requires an onsave prop; in controlled mode it never
      // calls it (the pick is emitted via @select instead).
    },
    // The card name captured for a card-target step, for the picker's highlight.
    capturedCardName(i: number): CardName | undefined {
      const r = this.captured[i];
      if (r !== undefined && r.type === 'card') {
        return r.cards[0];
      }
      return undefined;
    },
    confirm(): void {
      const branch = this.selected;
      if (branch === undefined || !this.canConfirm) {
        return;
      }
      const stepResponses: Array<InputResponse> = [];
      branch.steps.forEach((step, i) => {
        if (step.kind === 'input' && this.captured[i] !== undefined) {
          stepResponses.push(this.captured[i]);
        }
      });
      const payload: ConfirmPayload = {branchIndex: branch.index, optionResponse: this.capturedOption, stepResponses, reveal: branch.reveal};
      this.$emit('confirm', payload);
    },
    openFullscreen(): void {
      this.zoomCard = this.cardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    // Fullscreen the card the player picked from hand (for a closer look before
    // the final confirm).
    openChosenFullscreen(): void {
      const card = this.optionChosenCard;
      if (card === undefined) {
        return;
      }
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>

<style scoped lang="less">
.action-confirm__loading {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 28px 0;
  .action-confirm__loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(120, 220, 255, 0.85);
    animation: action-confirm-pulse 1s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
  }
}
@keyframes action-confirm-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

// NOTE: the summary / section LABEL styles (`__summary`, `__summary-label`,
// `__section`, `__section-label`) live in the GLOBAL actions_overlay.less, NOT
// here — the App-level RevealResultOverlay reuses the same markup, and scoped
// styles wouldn't reach it (its labels rendered unstyled/huge otherwise).

/* Branch title shown when a combined-node card has no per-branch graphic. */
.action-confirm__action-text {
  font-size: 14px;
  line-height: 1.4;
  color: #dceaf6;
}

/* Intro line in the hero panel while the player is still choosing among branches
 * (the picker lives in the wide choices block below). */
.action-confirm__intro-hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: #acc4dc;
}

.action-confirm__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  &--summary { margin-top: 2px; }
}

.action-confirm__branches {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.action-confirm__branch {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  /* Flex within the wrap-grid: comfortable min, sit side by side when the modal
   * is wide, wrap when there are many. */
  flex: 1 1 300px;
  max-width: 460px;
  padding: 12px 14px;
  text-align: left;
  border-radius: 10px;
  border: 1px solid rgba(120, 200, 255, 0.22);
  background: rgba(20, 40, 60, 0.5);
  color: #d8ecf7;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  &:hover { border-color: rgba(120, 220, 255, 0.6); background: rgba(28, 56, 80, 0.65); }
  &--selected {
    border-color: rgba(120, 230, 255, 0.95);
    background: rgba(30, 70, 100, 0.7);
    box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.5), 0 0 18px rgba(80, 200, 255, 0.22);
  }
  &--disabled {
    cursor: default;
    opacity: 0.5;
    filter: saturate(0.5);
    border-style: dashed;
    &:hover { border-color: rgba(120, 200, 255, 0.22); background: rgba(20, 40, 60, 0.5); }
  }
}
.action-confirm__branch-tick {
  flex: 0 0 auto;
  margin-top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(120, 200, 255, 0.5);
  transition: border-color 0.15s ease, background 0.15s ease;
  .action-confirm__branch--selected & {
    border-color: rgba(120, 230, 255, 1);
    background: radial-gradient(circle, rgba(120, 230, 255, 1) 38%, transparent 42%);
  }
}
.action-confirm__branch-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.action-confirm__branch-title { font-size: 13px; line-height: 1.3; color: #e3f2fb; }
.action-confirm__branch-reason { font-size: 11.5px; color: rgba(255, 184, 130, 0.9); }

.action-confirm__steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* No margin-top: steps live inside the `.action-confirm__choices` flex column,
   * which spaces its children with its own gap. */
}
.action-confirm__step {
  border-radius: 9px;
  border: 1px solid rgba(120, 200, 255, 0.18);
  background: rgba(16, 32, 48, 0.5);
  padding: 11px 13px;
  &--placement {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: #cfe6f3;
  }
  &--answered { border-color: rgba(120, 230, 180, 0.5); }
  /* The payment widget carries its OWN premium frame (border + L-corners), so
   * the hosting step sheds its chrome to avoid a heavy double border. */
  &--bare {
    border: none;
    background: none;
    padding: 0;
  }
}
.action-confirm__step-glyph { color: rgba(255, 200, 120, 0.9); }

/* Hand-card pick affordance — a "choose a card" CTA that opens the КАРТЫ В РУКЕ
   overlay, then the chosen card rendered + a "change" link. */
.action-confirm__handpick {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.action-confirm__handpick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 14px 18px;
  border-radius: 9px;
  border: 1px solid rgba(120, 220, 255, 0.5);
  background: linear-gradient(180deg, rgba(30, 60, 88, 0.7), rgba(20, 40, 62, 0.7));
  color: #dcf0ff;
  font-family: Prototype, Ubuntu, sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  &:hover {
    border-color: #7fd4ff;
    box-shadow: 0 0 16px rgba(80, 200, 255, 0.25);
    transform: translateY(-1px);
  }
}
.action-confirm__handpick-btn-glyph { font-size: 17px; line-height: 1; }
.action-confirm__handpick-chosen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 11px;
}
.action-confirm__handpick-card {
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
  // Zero the legacy asymmetric card margin so the card reads centred.
  > :deep(.card-container) { margin: 0; }
}
.action-confirm__handpick-change {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 15px;
  border-radius: 7px;
  border: 1px solid rgba(120, 200, 255, 0.32);
  background: rgba(18, 34, 50, 0.6);
  color: #bcd6ee;
  font-family: Prototype, Ubuntu, sans-serif;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
  &:hover { border-color: #7fd4ff; color: #eaf6ff; }
}
.action-confirm__handpick-change-glyph { font-size: 13px; }

.action-confirm__none {
  margin: 8px 0;
  padding: 14px;
  text-align: center;
  border-radius: 9px;
  border: 1px dashed rgba(255, 160, 120, 0.4);
  color: rgba(255, 184, 140, 0.9);
  font-size: 13px;
}
</style>
