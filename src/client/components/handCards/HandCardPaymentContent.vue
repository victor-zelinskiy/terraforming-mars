<template>
  <!--
    Premium PLAY-CARD planning gate, hosted inside MandatoryInputModal. On open
    it fetches a READ-ONLY preview (/api/card-play-preview) of the card's ON-PLAY
    effects + the interactive choices it needs. The player sees the impact (chips:
    resources / production / parameters / TR / draw), makes EVERY target choice
    HERE, and dials the payment IN this modal. The single РАЗЫГРАТЬ submits the
    play + every choice in ONE batch request (no follow-up modal spam). Cancel
    closes with no server round-trip (nothing was submitted yet). Mirrors
    CardActionConfirmContent's structure; the payment is the new section.
  -->
  <div class="play-confirm">
    <div class="play-confirm__frame">
      <div class="play-confirm__corner play-confirm__corner--tl" aria-hidden="true"></div>
      <div class="play-confirm__corner play-confirm__corner--tr" aria-hidden="true"></div>
      <div class="play-confirm__corner play-confirm__corner--bl" aria-hidden="true"></div>
      <div class="play-confirm__corner play-confirm__corner--br" aria-hidden="true"></div>

      <header class="play-confirm__header">
        <span class="play-confirm__kicker">
          <span class="play-confirm__kicker-dot" aria-hidden="true"></span>
          <span class="play-confirm__kicker-text" v-i18n>Play card</span>
        </span>
        <h3 class="play-confirm__title" v-i18n>{{ cardTitle }}</h3>
      </header>

      <!-- RESULT — a SHORT premium summary AT THE TOP of WHAT playing this card
           does (the on-play effect chips, current → resulting). The detailed,
           target-dependent impact reads on each target option below. -->
      <div v-if="!loading && selected !== undefined && resultEffects.length > 0" class="play-confirm__result">
        <span class="play-confirm__section-label" v-i18n>Result</span>
        <div class="play-confirm__chips play-confirm__chips--summary">
          <ActionEffectChip v-for="(e, i) in resultEffects" :key="i" :effect="e" />
        </div>
        <ActionVpProgress v-if="vpProgress !== undefined"
                          class="play-confirm__vp"
                          :cardName="cardName"
                          :resourceIcon="vpProgress.icon"
                          :before="vpProgress.before"
                          :after="vpProgress.after" />
      </div>

      <div class="play-confirm__body">
        <!-- LEFT: the card we're about to play (the source anchor), compact so it
             reads as part of the layout, with a separate fullscreen control. -->
        <aside class="play-confirm__left">
          <div class="play-confirm__source">
            <span class="play-confirm__section-label" v-i18n>Card</span>
            <button type="button"
                    class="play-confirm__card"
                    :aria-label="$t('Open fullscreen')"
                    @click.capture.stop="openFullscreen"
                    @keydown.enter="openFullscreen">
              <Card :card="cardModel" />
              <span class="play-confirm__zoom" aria-hidden="true">⤢</span>
            </button>
          </div>
        </aside>

        <!-- RIGHT: the PLANNING area — every decision the player makes before the
             single submit (the on-play `or` branch, target pickers, payment). -->
        <section class="play-confirm__right">
          <!-- Preview loading skeleton. -->
          <div v-if="loading" class="play-confirm__loading">
            <span class="play-confirm__loading-dot" aria-hidden="true"></span>
            <span class="play-confirm__loading-dot" aria-hidden="true"></span>
            <span class="play-confirm__loading-dot" aria-hidden="true"></span>
          </div>

          <template v-else>
            <!-- Branch picker — only for the rare on-play `behavior.or` card with
                 more than one option. Each branch shows its title + chips. -->
            <div v-if="showBranchList" class="play-confirm__branches">
              <span class="play-confirm__section-label" v-i18n>Choose an option</span>
              <button v-for="(b, p) in branches"
                      :key="p"
                      type="button"
                      class="play-confirm__branch"
                      :class="{
                        'play-confirm__branch--selected': selected === b,
                        'play-confirm__branch--disabled': !b.available,
                      }"
                      :disabled="!b.available"
                      @click="selectBranch(b)">
                <span v-if="b.available" class="play-confirm__branch-tick" aria-hidden="true"></span>
                <span class="play-confirm__branch-main">
                  <span v-if="text(b.title)" class="play-confirm__branch-title" v-i18n>{{ text(b.title) }}</span>
                  <span v-if="b.effects.length > 0" class="play-confirm__chips">
                    <ActionEffectChip v-for="(e, i) in b.effects" :key="i" :effect="e" />
                  </span>
                  <span v-if="!b.available && b.unavailableReason !== undefined" class="play-confirm__branch-reason" v-i18n>{{ text(b.unavailableReason) }}</span>
                </span>
              </button>
            </div>

            <!-- CHOICES — the interactive target/parameter pickers for the play.
                 A multi-card pick (Cyberia) lays its card zones side by side. -->
            <div v-if="selected !== undefined && selected.steps.length > 0"
                 class="play-confirm__steps"
                 :class="{'play-confirm__steps--cards-row': multiCardPick}">
              <span v-if="hasInteractiveStep" class="play-confirm__section-label" v-i18n>Choose targets</span>
              <!-- Merged slots (Astra): the slots are SLOTS of one "up to N" pick, so
                   the later ones are optional — say so (the "all N" warning below is
                   suppressed for this case). -->
              <span v-if="mergeOptionalHint !== ''" class="play-confirm__steps-note" v-i18n>{{ mergeOptionalHint }}</span>
              <!-- Multi-card pick not yet complete → an explicit reminder (the confirm
                   is also gated) so the player doesn't think one card is enough. -->
              <div v-if="showCardPickWarning" class="play-confirm__warn play-confirm__warn--cards">
                <span class="play-confirm__warn-glyph" aria-hidden="true">⚠</span>
                <span class="play-confirm__warn-text">
                  <span v-i18n>Choose all the cards</span>
                  <span class="play-confirm__warn-count">{{ cardPicksDone }} / {{ cardPicksTotal }}</span>
                </span>
              </div>
              <template v-for="(step, i) in selected.steps" :key="i">
                <!-- WARNING — an effect with no valid target is SKIPPED; say so up
                     front (orange) so the player is never surprised by a lost effect. -->
                <div v-if="step.kind === 'note' && step.noteKind === 'warning'" class="play-confirm__warn">
                  <span class="play-confirm__warn-glyph" aria-hidden="true">⚠</span>
                  <span v-if="warnResourceClass(step) !== ''" class="play-confirm__warn-res" :class="warnResourceClass(step)" aria-hidden="true"></span>
                  <span class="play-confirm__warn-text" v-i18n>{{ placementHint(step) }}</span>
                </div>
                <div v-else-if="step.kind === 'boardPlacement' || step.kind === 'note'" class="play-confirm__step play-confirm__step--placement">
                  <span class="play-confirm__step-glyph" aria-hidden="true">◎</span>
                  <span class="play-confirm__step-text" v-i18n>{{ placementHint(step) }}</span>
                </div>
                <!-- A TWO-TAB removal choice (Virus): animals OR plants, each tab
                     listing its valid targets with a current→resulting impact. -->
                <div v-else-if="step.kind === 'tabbedTargets'" class="play-confirm__step play-confirm__step--input"
                     :class="{'play-confirm__step--answered': captured[i] !== undefined}">
                  <TabbedRemovalPicker :model="step"
                                       :playerView="playerView"
                                       :selected="captured[i]"
                                       @select="captureStep(i)($event)" />
                </div>
                <div v-else class="play-confirm__step play-confirm__step--input"
                     :class="{'play-confirm__step--answered': captured[i] !== undefined}">
                  <!-- A MULTI-select card pick (Public Plans "reveal any number"):
                       host the КАРТЫ В РУКЕ overlay's multi-select mode and show a
                       COUNT summary (the pick can be large), NOT the card list. -->
                  <div v-if="isMultiSelectStep(step)" class="play-confirm__multipick">
                    <span v-if="stepResourceIcon(step) !== ''" class="play-confirm__handpick-prompt play-confirm__handpick-prompt--res">
                      <span class="play-confirm__handpick-res-icon" :class="stepResourceIcon(step)" aria-hidden="true"></span>
                      <span class="play-confirm__handpick-res-amt">×{{ stepResourceAmount(step) }}</span>
                      <span class="play-confirm__handpick-res-to" v-i18n>to a card</span>
                    </span>
                    <span v-else-if="stepPromptText(step) !== ''" class="play-confirm__handpick-prompt">{{ stepPromptText(step) }}</span>
                    <div v-if="captured[i] !== undefined" class="play-confirm__multipick-summary">
                      <span class="play-confirm__multipick-label" v-i18n>{{ multiSelectLabel(step) }}</span>
                      <span class="play-confirm__multipick-count">{{ multiSelectCount(i) }}</span>
                    </div>
                    <button type="button" class="play-confirm__handpick-btn" @click="requestMultiHandPick(i, step)">
                      <span class="play-confirm__handpick-glyph" aria-hidden="true">▤</span>
                      <span v-if="captured[i] === undefined" v-i18n>Pick cards from hand</span>
                      <span v-else v-i18n>Change selection</span>
                    </button>
                  </div>
                  <ModernPlayerPicker v-else-if="step.input.type === 'player'"
                                      :controlled="true"
                                      :playerView="playerView"
                                      :playerinput="step.input"
                                      :onsave="noop"
                                      @select="captureStep(i)($event)" />
                  <!-- A target pick whose candidates are HAND cards routes to the
                       КАРТЫ В РУКЕ overlay (the hand twin of the board branch) — so a
                       play card whose on-play target is a hand card is supported too. -->
                  <div v-else-if="step.input.type === 'card' && isHandCardStep(step)" class="play-confirm__handpick">
                    <span v-if="stepResourceIcon(step) !== ''" class="play-confirm__handpick-prompt play-confirm__handpick-prompt--res">
                      <span class="play-confirm__handpick-res-icon" :class="stepResourceIcon(step)" aria-hidden="true"></span>
                      <span class="play-confirm__handpick-res-amt">×{{ stepResourceAmount(step) }}</span>
                      <span class="play-confirm__handpick-res-to" v-i18n>to a card</span>
                    </span>
                    <span v-else-if="stepPromptText(step) !== ''" class="play-confirm__handpick-prompt">{{ stepPromptText(step) }}</span>
                    <div v-if="chosenStepCard(step, i) !== undefined" class="play-confirm__handpick-chosen">
                      <span class="play-confirm__handpick-badge" aria-hidden="true">
                        <span class="play-confirm__handpick-badge-tick">✓</span>
                        <span v-i18n>Selected</span>
                      </span>
                      <button type="button"
                              class="play-confirm__handpick-card"
                              :aria-label="$t('Open fullscreen')"
                              @click.capture.stop="openStepFullscreen(step, i)">
                        <Card :key="capturedCardName(i)" :card="chosenStepCard(step, i)!" />
                      </button>
                      <!-- The per-card resource impact ON THIS card (current → after),
                           mirroring the inline ActionTargetCard line — so a board/hand
                           pick shows "сколько было → сколько станет", not just the card. -->
                      <span v-if="chosenImpact(step, i) !== undefined" class="play-confirm__handpick-impact">
                        <span class="play-confirm__handpick-impact-icon" :class="chosenImpact(step, i)!.icon" aria-hidden="true"></span>
                        <span class="play-confirm__handpick-impact-from">{{ chosenImpact(step, i)!.from }}</span>
                        <span class="play-confirm__handpick-impact-arrow" aria-hidden="true">→</span>
                        <span class="play-confirm__handpick-impact-to">{{ chosenImpact(step, i)!.to }}</span>
                      </span>
                      <button type="button" class="play-confirm__handpick-change" @click="requestHandPick(i, step)">
                        <span class="play-confirm__handpick-glyph" aria-hidden="true">⟲</span>
                        <span v-i18n>Choose another card</span>
                      </button>
                    </div>
                    <button v-else type="button" class="play-confirm__handpick-btn" @click="requestHandPick(i, step)">
                      <span class="play-confirm__handpick-glyph" aria-hidden="true">▤</span>
                      <span v-i18n>Pick a card from hand</span>
                    </button>
                  </div>
                  <!-- A target pick from your OWN board with MORE THAN 3 candidates
                       routes to the РАЗЫГРАНО board (pick the real card) instead of
                       the cramped tile grid. ≤3 stays inline below. -->
                  <div v-else-if="step.input.type === 'card' && isPlayedOverlayStep(step)" class="play-confirm__handpick">
                    <span v-if="stepResourceIcon(step) !== ''" class="play-confirm__handpick-prompt play-confirm__handpick-prompt--res">
                      <span class="play-confirm__handpick-res-icon" :class="stepResourceIcon(step)" aria-hidden="true"></span>
                      <span class="play-confirm__handpick-res-amt">×{{ stepResourceAmount(step) }}</span>
                      <span class="play-confirm__handpick-res-to" v-i18n>to a card</span>
                    </span>
                    <span v-else-if="stepPromptText(step) !== ''" class="play-confirm__handpick-prompt">{{ stepPromptText(step) }}</span>
                    <div v-if="chosenStepCard(step, i) !== undefined" class="play-confirm__handpick-chosen">
                      <span class="play-confirm__handpick-badge" aria-hidden="true">
                        <span class="play-confirm__handpick-badge-tick">✓</span>
                        <span v-i18n>Selected</span>
                      </span>
                      <button type="button"
                              class="play-confirm__handpick-card"
                              :aria-label="$t('Open fullscreen')"
                              @click.capture.stop="openStepFullscreen(step, i)">
                        <!-- :key — a keyless reused <Card> shows the stale first
                             card after a re-pick (Card.vue resolves render once). -->
                        <Card :key="capturedCardName(i)" :card="chosenStepCard(step, i)!" />
                      </button>
                      <span v-if="chosenImpact(step, i) !== undefined" class="play-confirm__handpick-impact">
                        <span class="play-confirm__handpick-impact-icon" :class="chosenImpact(step, i)!.icon" aria-hidden="true"></span>
                        <span class="play-confirm__handpick-impact-from">{{ chosenImpact(step, i)!.from }}</span>
                        <span class="play-confirm__handpick-impact-arrow" aria-hidden="true">→</span>
                        <span class="play-confirm__handpick-impact-to">{{ chosenImpact(step, i)!.to }}</span>
                      </span>
                      <button type="button" class="play-confirm__handpick-change" @click="requestPlayedPick(i, step)">
                        <span class="play-confirm__handpick-glyph" aria-hidden="true">⟲</span>
                        <span v-i18n>Choose another card</span>
                      </button>
                    </div>
                    <button v-else type="button" class="play-confirm__handpick-btn" @click="requestPlayedPick(i, step)">
                      <span class="play-confirm__handpick-glyph" aria-hidden="true">▦</span>
                      <span v-i18n>Choose a card on your board</span>
                    </button>
                  </div>
                  <ActionTargetCard v-else-if="step.input.type === 'card'"
                                    :playerView="playerView"
                                    :input="stepCardInput(step)"
                                    :amount="step.amount"
                                    :selectedName="capturedCardName(i)"
                                    @change="captureStep(i)($event)" />
                  <ModalInputHost v-else :playerView="playerView" :playerinput="step.input" :onsave="captureStep(i)" />
                </div>
              </template>
            </div>

            <!-- PAYMENT — the embedded project-card payment widget (all tag /
                 reserve / Reds-tax / discount rules reused). The source card is
                 hidden (shown in the aside); the host owns the submit via the
                 single CTA. `@change` re-emits payment validity to gate it. -->
            <div class="play-confirm__section play-confirm__payment-section">
              <span class="play-confirm__section-label" v-i18n>Payment</span>
              <SelectProjectCardToPlay
                ref="payWidget"
                :playerView="playerView"
                :playerinput="input"
                :onsave="capturePlay"
                :hideCards="true"
                :showsave="false"
                :showtitle="false"
                @change="paymentValid = $event" />
            </div>
          </template>
        </section>
      </div>

      <footer class="play-confirm__footer">
        <!-- Readiness — a clear "is everything chosen + paid?" line so the player
             reads the gate before committing. Mint + tick when ready to submit. -->
        <span v-if="!loading" class="play-confirm__readiness"
              :class="{'play-confirm__readiness--ready': readiness.ready}">
          <span class="play-confirm__readiness-dot" aria-hidden="true"></span>
          <span v-i18n>{{ readiness.label }}</span>
        </span>
        <div class="play-confirm__actions">
          <button class="play-confirm__cancel cab-action-confirm-cancel"
                  @click="$emit('cancel')"
                  data-test="play-confirm-cancel">
            <span class="cab-action-confirm-cancel__label" v-i18n>Cancel</span>
          </button>
          <button class="play-confirm__confirm cab-action-confirm-go"
                  :disabled="!canConfirm"
                  @click="confirm"
                  data-test="play-confirm-confirm">
            <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
            <span class="cab-action-confirm-go__icon" aria-hidden="true">▶</span>
            <span class="cab-action-confirm-go__label" v-i18n>Play card</span>
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

    <!-- Empty-pick confirm: the player submitted a "return up to N" pick (Astra)
         with NOTHING selected. Valid by the rules, but confirm it's intentional. -->
    <Teleport to="body">
      <div v-if="showEmptyWarning" class="play-empty-warn" @click.self="cancelEmpty">
        <div class="play-empty-warn__card" role="alertdialog" aria-modal="true">
          <span class="play-empty-warn__glyph" aria-hidden="true">⚠</span>
          <h4 class="play-empty-warn__title" v-i18n>Nothing selected</h4>
          <p class="play-empty-warn__text" v-i18n>{{ emptyWarningText }}</p>
          <div class="play-empty-warn__actions">
            <button type="button"
                    class="play-empty-warn__cancel cab-action-confirm-cancel"
                    @click="cancelEmpty"
                    data-test="play-empty-warn-cancel">
              <span class="cab-action-confirm-cancel__label" v-i18n>Cancel</span>
            </button>
            <button type="button"
                    class="play-empty-warn__go cab-action-confirm-go"
                    @click="confirmEmpty"
                    data-test="play-empty-warn-go">
              <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
              <span class="cab-action-confirm-go__label" v-i18n>Play anyway</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';
import {InputResponse, SelectProjectCardToPlayResponse} from '@/common/inputs/InputResponse';
import {SelectProjectCardToPlayModel, SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep, ActionEffect} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {playedCardActionPickResult} from '@/client/components/playedCards/playedCardActionPick';
import {handActionPickResult} from '@/client/components/handCards/handActionPick';
import {cardPickSurface, CardPickSurface} from '@/client/components/cardPickRouting';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import SelectProjectCardToPlay from '@/client/components/SelectProjectCardToPlay.vue';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import ModernPlayerPicker from '@/client/components/modalInputs/ModernPlayerPicker.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';
import ActionVpProgress from '@/client/components/actions/ActionVpProgress.vue';
import TabbedRemovalPicker from '@/client/components/handCards/TabbedRemovalPicker.vue';
import {resourceScoring} from '@/client/components/additionalResources/additionalResources';

// The batch payload emitted on confirm: the play pick (projectCard + payment) +
// the optional on-play `behavior.or` branch + the pre-collected step responses.
export type PlayCardPayload = {
  playResponse: SelectProjectCardToPlayResponse;
  branchIndex: number;
  optionResponse: InputResponse | undefined;
  stepResponses: ReadonlyArray<InputResponse>;
};

// The six standard production resources, used to fold a copied card's production
// box into the displayed RESULT (the Cyberia / Robotic Workforce mechanic).
const STANDARD_RESOURCES = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'] as const;
const STANDARD_RESOURCE_SET = new Set<string>(STANDARD_RESOURCES);

// A step that requires a captured response before the play can be confirmed (an
// interactive input or the tabbed-targets removal choice). boardPlacement / note
// steps are informational and don't need a response.
function stepNeedsResponse(step: ActionPreviewStep): boolean {
  return step.kind === 'input' || step.kind === 'tabbedTargets';
}

/**
 * Payment + on-play-preview modal content for playing a hand card. Hosted inside
 * `MandatoryInputModal` by PlayerHome (`pendingPlayCard`). It never POSTs
 * directly — it emits `confirm` with a `PlayCardPayload` so the host assembles
 * the batch (`[play, ...steps]`) and submits via WaitingFor.onsaveBatch. `cancel`
 * closes with no round-trip.
 */
export default defineComponent({
  name: 'HandCardPaymentContent',
  components: {Card, CardZoomModal, SelectProjectCardToPlay, ModalInputHost, ModernPlayerPicker, ActionEffectChip, ActionTargetCard, ActionVpProgress, TabbedRemovalPicker},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    input: {
      type: Object as PropType<SelectProjectCardToPlayModel>,
      required: true,
    },
    cardName: {
      type: String as PropType<CardName>,
      required: true,
    },
  },
  emits: ['confirm', 'cancel', 'pick-played-card', 'pick-card'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selected: undefined as ActionPreviewBranch | undefined,
      captured: {} as Record<number, InputResponse>,
      // The step index awaiting a РАЗЫГРАНО-board pick (multi-step modal), so the
      // delivered card captures into the RIGHT slot. undefined = not awaiting.
      awaitingPlayedPickStep: undefined as number | undefined,
      // Same, for a КАРТЫ В РУКЕ overlay pick of a HAND-card step (the hand twin) —
      // so a play card whose target is a hand card routes there, not the board.
      awaitingHandPickStep: undefined as number | undefined,
      // The play response captured from the embedded widget on confirm.
      capturedPlay: undefined as SelectProjectCardToPlayResponse | undefined,
      // Whether the dialed payment currently covers the cost (from the widget).
      paymentValid: false,
      // A confirm popup shown when the player submits a merged "up to N" pick (Astra)
      // with NOTHING selected — valid by the rules, but worth a conscious confirm.
      showEmptyWarning: false,
    };
  },
  computed: {
    cardModel(): CardModel {
      // Prefer the constrained input's card model (carries calculatedCost,
      // reserveUnits, warnings) so the source render matches the payment.
      return this.input.cards.find((c) => c.name === this.cardName) ?? ({name: this.cardName} as CardModel);
    },
    cardTitle(): string {
      return this.cardName;
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    // The RESULT chips shown at the top — the branch's base effects, PLUS the
    // production COPIED from any answered "copy production box" step (Cyberia
    // Systems / Robotic Workforce). So the result reflects EXACTLY what the chosen
    // cards copy and UPDATES LIVE as the player picks (the clarity rule). When no
    // copy step is answered it's just the base effects (no behaviour change).
    resultEffects(): ReadonlyArray<ActionEffect> {
      const branch = this.selected;
      if (branch === undefined) {
        return [];
      }
      // Sum the production the chosen copy-targets copy — read from the
      // server-computed per-candidate map on the step (authoritative for ALL
      // copyable cards, not just full-Units declarative ones).
      const copied: Record<string, number> = {};
      let hasCopy = false;
      branch.steps.forEach((step, i) => {
        if (step.kind !== 'input') {
          return;
        }
        const boxes = (step as {copyProductionBox?: Record<string, Record<string, number>>}).copyProductionBox;
        if (boxes === undefined) {
          return;
        }
        const name = this.capturedCardName(i);
        if (name === undefined) {
          return;
        }
        const box = boxes[name];
        if (box === undefined) {
          return;
        }
        hasCopy = true;
        for (const res of STANDARD_RESOURCES) {
          const v = box[res] ?? 0;
          if (v !== 0) {
            copied[res] = (copied[res] ?? 0) + v;
          }
        }
      });
      if (!hasCopy) {
        return [...this.resolveCardTargetChips(branch.effects, branch), ...this.synthResultChips(branch)];
      }
      // Fold base production effects + the copied deltas into ONE chip per resource
      // (current → resulting); non-production base effects pass through unchanged.
      const totals: Record<string, number> = {...copied};
      const currentByRes: Record<string, number> = {};
      const passthrough: Array<ActionEffect> = [];
      for (const e of branch.effects) {
        if (e.note === 'production' && STANDARD_RESOURCE_SET.has(e.icon)) {
          totals[e.icon] = (totals[e.icon] ?? 0) + (e.direction === 'gain' ? e.amount : -e.amount);
          if (e.current !== undefined) {
            currentByRes[e.icon] = e.current;
          }
        } else {
          passthrough.push(e);
        }
      }
      const prodChips: Array<ActionEffect> = [];
      for (const res of STANDARD_RESOURCES) {
        const delta = totals[res] ?? 0;
        if (delta === 0) {
          continue;
        }
        const current = currentByRes[res] ?? this.playerProduction(res);
        prodChips.push({
          direction: delta >= 0 ? 'gain' : 'cost',
          icon: res,
          amount: Math.abs(delta),
          current,
          resulting: current + delta,
          note: 'production',
        });
      }
      return [...prodChips, ...this.resolveCardTargetChips(passthrough, branch), ...this.synthResultChips(branch)];
    },
    // A real choice only when the on-play behavior is an `or` with 2+ branches.
    showBranchList(): boolean {
      return this.selected === undefined && this.branches.length > 1;
    },
    // VP-progress context for the SELECTED branch (a card whose resource scores
    // VP and the on-play effect changes it). Derived client-side from the manifest.
    vpProgress(): {icon: string, before: number, after: number} | undefined {
      const branch = this.selected;
      if (branch === undefined || resourceScoring(this.cardName) === undefined) {
        return undefined;
      }
      const eff = branch.effects.find((e) => e.note === 'on this card' && e.current !== undefined && e.resulting !== undefined);
      if (eff === undefined || eff.current === undefined || eff.resulting === undefined) {
        return undefined;
      }
      return {icon: eff.icon, before: eff.current, after: eff.resulting};
    },
    canConfirm(): boolean {
      const branch = this.selected;
      if (this.loading || branch === undefined || !branch.available || !this.paymentValid) {
        return false;
      }
      return this.stepsSatisfied(branch);
    },
    // Whether any step is an interactive picker (drives the "Choose targets" label;
    // a warning-only step set shows no label).
    hasInteractiveStep(): boolean {
      return this.selected?.steps.some((s) => stepNeedsResponse(s)) ?? false;
    },
    // A short, honest "what's left before I can play this" line for the footer
    // readiness zone: name the FIRST missing decision (a target, then payment),
    // else confirm everything's set. English keys translated by the `v-i18n` host.
    readiness(): {ready: boolean, label: string} {
      const branch = this.selected;
      if (branch === undefined) {
        return {ready: false, label: 'Choose an option'};
      }
      if (!this.stepsSatisfied(branch)) {
        return {ready: false, label: 'Choose a target'};
      }
      if (!this.paymentValid) {
        return {ready: false, label: 'Complete the payment'};
      }
      return {ready: true, label: 'Ready to play'};
    },
    // The selected branch's CARD-target step indexes (a multi-card pick like
    // Cyberia has 2+ — they all route to the board, laid out horizontally).
    cardTargetStepIndexes(): ReadonlyArray<number> {
      const out: Array<number> = [];
      (this.selected?.steps ?? []).forEach((s, i) => {
        if (s.kind === 'input' && s.input.type === 'card') {
          out.push(i);
        }
      });
      return out;
    },
    multiCardPick(): boolean {
      return this.cardTargetStepIndexes.length >= 2;
    },
    // The viewer's HAND / TABLEAU card-name sets — the OWNERSHIP `cardPickSurface`
    // uses to route a card pick to the КАРТЫ В РУКЕ overlay vs the РАЗЫГРАНО board.
    handSet(): ReadonlySet<CardName> {
      return new Set((this.playerView.cardsInHand ?? []).map((c) => c.name));
    },
    tableauSet(): ReadonlySet<CardName> {
      return new Set((this.playerView.thisPlayer.tableau ?? []).map((c) => c.name));
    },
    cardPicksTotal(): number {
      return this.cardTargetStepIndexes.length;
    },
    cardPicksDone(): number {
      return this.cardTargetStepIndexes.filter((i) => this.captured[i] !== undefined).length;
    },
    // A multi-card pick with not-yet-all chosen → an explicit warning so the player
    // doesn't think one card is enough (the confirm is also gated). For a MERGED-slot
    // branch (Astra "up to N") the later slots are optional, so the warning fires
    // only below the `min` (0 for Astra → never).
    showCardPickWarning(): boolean {
      if (!this.multiCardPick) {
        return false;
      }
      // A MERGED-slot pick (Astra) is "up to N", not "all N" — the optional-slot
      // hint + the gated CTA communicate it; the "Choose all the cards" warning
      // would be misleading, so suppress it here.
      if (this.mergeCardSteps !== undefined) {
        return false;
      }
      return this.cardPicksDone < this.cardPicksTotal;
    },
    // The selected branch's merge-slots descriptor (Astra) — when set, the card
    // steps are SLOTS of one "up to N" SelectCard, merged into one response.
    mergeCardSteps(): {min: number, emptyWarning?: string | Message} | undefined {
      return this.selected?.mergeCardSteps;
    },
    // Hint that a merged pick is OPTIONAL (Astra "up to N", min 0 → the player may
    // return one, two, or none). '' = no hint.
    mergeOptionalHint(): string {
      if (this.mergeCardSteps === undefined) {
        return '';
      }
      return 'Returning events is optional.';
    },
    // The confirm-popup body for an empty merged submit (card-supplied text, or a
    // generic fallback).
    emptyWarningText(): string {
      const w = this.mergeCardSteps?.emptyWarning;
      return w !== undefined ? this.text(w) : 'Nothing is selected.';
    },
    // Bridged result epoch from the РАЗЫГРАНО board pick (see the watcher).
    playedPickEpoch(): number {
      return playedCardActionPickResult.epoch;
    },
    // Bridged result epoch from the КАРТЫ В РУКЕ overlay pick (the hand twin).
    handPickEpoch(): number {
      return handActionPickResult.epoch;
    },
  },
  watch: {
    // A card picked in the КАРТЫ В РУКЕ overlay was delivered back via the bridge —
    // capture it into the awaiting hand-step slot (only while we requested it).
    handPickEpoch(): void {
      const i = this.awaitingHandPickStep;
      if (i === undefined) {
        return;
      }
      this.awaitingHandPickStep = undefined;
      const step = this.selected?.steps[i];
      // A MULTI-select step (Public Plans) captures the WHOLE picked set — even
      // empty (= "reveal 0 cards", which is valid for an "up to N" pick).
      if (step?.kind === 'input' && step.multiSelect !== undefined) {
        this.captureStep(i)({type: 'card', cards: [...handActionPickResult.cards]});
        return;
      }
      const card = handActionPickResult.card;
      if (card !== undefined) {
        this.captureStep(i)({type: 'card', cards: [card]});
      }
    },
    // A card picked on the РАЗЫГРАНО board was delivered back via the bridge —
    // capture it into the awaiting step's slot (only while we requested it).
    playedPickEpoch(): void {
      const i = this.awaitingPlayedPickStep;
      if (i === undefined) {
        return;
      }
      this.awaitingPlayedPickStep = undefined;
      const card = playedCardActionPickResult.card;
      if (card !== undefined) {
        this.captureStep(i)({type: 'card', cards: [card]});
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
    // The viewer's CURRENT production for a standard resource — the `current` base
    // for a copied-production chip on a resource the base effects don't already
    // cover (e.g. the copied card raises M€ production but Cyberia's own box is steel).
    playerProduction(res: string): number {
      const p = this.playerView.thisPlayer;
      switch (res) {
      case 'megacredits': return p.megacreditProduction;
      case 'steel': return p.steelProduction;
      case 'titanium': return p.titaniumProduction;
      case 'plants': return p.plantProduction;
      case 'energy': return p.energyProduction;
      case 'heat': return p.heatProduction;
      default: return 0;
      }
    },
    // The viewer's current STOCK of a standard resource — the `current` base for a
    // synthesized gain chip (Public Plans +N M€). Stock fields are unprefixed.
    playerStock(res: string): number {
      const p = this.playerView.thisPlayer;
      switch (res) {
      case 'megacredits': return p.megacredits;
      case 'steel': return p.steel;
      case 'titanium': return p.titanium;
      case 'plants': return p.plants;
      case 'energy': return p.energy;
      case 'heat': return p.heat;
      default: return 0;
      }
    },
    // Whether every required step is answered for THIS branch. For a MERGED-slot
    // branch (Astra "up to N") the card slots are optional down to `min`; every
    // OTHER input step is still mandatory.
    stepsSatisfied(branch: ActionPreviewBranch): boolean {
      const merge = branch.mergeCardSteps;
      if (merge !== undefined) {
        const cardOk = this.cardPicksDone >= merge.min;
        const othersOk = branch.steps.every((step, i) =>
          !stepNeedsResponse(step) || (step.kind === 'input' && step.input.type === 'card') || this.captured[i] !== undefined);
        return cardOk && othersOk;
      }
      return branch.steps.every((step, i) => !stepNeedsResponse(step) || this.captured[i] !== undefined);
    },
    // Extra RESULT chips computed CLIENT-side from the answered choices (so the
    // player sees the outcome update LIVE before the single submit):
    //   - a MERGED-slot pick (Astra) → "+N ▭ to hand" (cards returned to hand);
    //   - a MULTI-select reveal (Public Plans) → "+N M€" (revealGain per card).
    synthResultChips(branch: ActionPreviewBranch): ReadonlyArray<ActionEffect> {
      const chips: Array<ActionEffect> = [];
      if (branch.mergeCardSteps !== undefined && this.cardPicksDone > 0) {
        chips.push({direction: 'gain', icon: 'cards', amount: this.cardPicksDone, note: 'to hand'});
      }
      branch.steps.forEach((step, i) => {
        if (step.kind !== 'input' || step.multiSelect?.revealGain === undefined) {
          return;
        }
        const count = this.multiSelectCount(i);
        if (count <= 0) {
          return;
        }
        const rg = step.multiSelect.revealGain;
        const gain = count * rg.amount;
        const cur = this.playerStock(rg.resource);
        chips.push({direction: 'gain', icon: rg.resource, amount: gain, current: cur, resulting: cur + gain});
      });
      return chips;
    },
    // Resolve the "+N to a card" RESULT chips (addResourcesToAnyCard) against the
    // player's CHOICES, so the РЕЗУЛЬТАТ reads honestly:
    //   • a "to a card" effect whose picker step is ANSWERED → REPLACE the indefinite
    //     "+N на карту" with the CONCRETE `current → resulting` on the chosen card
    //     (a definite outcome, like a plant/TR gain — and live as the player re-picks);
    //   • a "to a card" effect whose picker step is NOT YET answered → OMIT it (the
    //     picker below already states "+N на карту"; a green gain chip up top before
    //     any card is chosen reads as already-applied — the premature-result the
    //     player flagged);
    //   • a "to a card" effect with NO picker step (rides the dynamic follow-up) →
    //     KEEP the generic "+N на карту" (no picker exists to convey it).
    // Steps are claimed in order so two additions of the SAME resource map to
    // distinct picks. General — every addResourcesToAnyCard card benefits.
    resolveCardTargetChips(effects: ReadonlyArray<ActionEffect>, branch: ActionPreviewBranch): Array<ActionEffect> {
      const steps = branch.steps;
      const claimed = new Set<number>();
      const out: Array<ActionEffect> = [];
      for (const e of effects) {
        if (e.note !== 'to a card') {
          out.push(e);
          continue;
        }
        let matched = -1;
        for (let i = 0; i < steps.length; i++) {
          if (claimed.has(i)) {
            continue;
          }
          const step = steps[i];
          if (step.kind !== 'input' || step.input.type !== 'card') {
            continue;
          }
          if ((step as {cardResource?: string}).cardResource !== e.icon) {
            continue;
          }
          matched = i;
          break;
        }
        if (matched === -1) {
          out.push(e); // no picker → keep the generic chip.
          continue;
        }
        claimed.add(matched);
        const card = this.chosenStepCard(steps[matched], matched);
        if (card === undefined) {
          continue; // picker exists but not chosen yet → omit (no premature result).
        }
        const from = card.resources ?? 0;
        out.push({...e, current: from, resulting: from + e.amount});
      }
      return out;
    },
    placementHint(step: {kind: string, placementType?: string, text?: string | Message}): string {
      // A note with explicit text (the warning, or a card-specific note) overrides
      // the canned placement copy.
      if (step.text !== undefined) {
        return this.text(step.text);
      }
      switch (step.placementType) {
      case 'ocean': return 'After confirming, choose where to place the ocean tile on the board.';
      case 'city': return 'After confirming, choose where to place the city tile on the board.';
      case 'greenery': return 'After confirming, choose where to place the greenery tile on the board.';
      case 'colony': return 'After confirming, choose a colony to build on.';
      default: return 'You will place a tile on the board after confirming.';
      }
    },
    // The card-resource icon class for a no-target warning, so the player sees
    // WHICH resource is lost (not an ambiguous "this resource"). '' = no icon.
    warnResourceClass(step: ActionPreviewStep): string {
      const res = (step as {resource?: string}).resource;
      return res !== undefined && res !== '' ? iconClassFor(res) : '';
    },
    async fetchPreview(): Promise<void> {
      this.loading = true;
      try {
        const url = paths.API_CARD_PLAY_PREVIEW +
          '?id=' + encodeURIComponent(this.playerView.id) +
          '&card=' + encodeURIComponent(this.cardName);
        const response = await fetch(url);
        if (response.ok) {
          this.preview = await response.json() as ActionPreview;
          // Single branch (the common case) → auto-select. A multi-branch
          // (on-play behavior.or) shows the picker.
          if (this.branches.length === 1) {
            this.selected = this.branches[0];
          }
        }
      } catch (err) {
        console.warn('Failed to fetch card play preview', err);
      } finally {
        this.loading = false;
        // A failed/empty preview must NOT block the play — fall back to a single
        // synthetic branch so the payment + CTA still render (plain card play).
        if (this.selected === undefined && this.branches.length === 0) {
          this.preview = {card: this.cardName, isCorporation: false, kind: 'dynamic',
            branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}]};
          this.selected = this.preview.branches[0];
        }
      }
    },
    selectBranch(b: ActionPreviewBranch): void {
      this.selected = b;
      this.captured = {}; // steps are branch-specific — reset.
    },
    captureStep(i: number): (out: InputResponse) => void {
      return (out: InputResponse) => {
        this.captured[i] = out;
        // Keep cross-step NO-DUPLICATE picks consistent: if a LATER card step
        // de-dupes against THIS one and had already picked the same card, clear it
        // (it's no longer a valid candidate). The player re-picks a different card.
        const name = (out.type === 'card') ? out.cards[0] : undefined;
        if (name !== undefined && this.selected !== undefined) {
          this.selected.steps.forEach((step, k) => {
            const dedupe = (step as {dedupeFromSteps?: ReadonlyArray<number>}).dedupeFromSteps;
            if (k > i && dedupe?.includes(i) && this.capturedCardName(k) === name) {
              delete this.captured[k];
            }
          });
        }
      };
    },
    noop(): void {
      // ModernPlayerPicker requires an onsave prop; controlled mode never calls it.
    },
    capturedCardName(i: number): CardName | undefined {
      const r = this.captured[i];
      return (r !== undefined && r.type === 'card') ? r.cards[0] : undefined;
    },
    // A card step's candidate list with any cards chosen in its `dedupeFromSteps`
    // removed — so the same card can't be picked twice across linked target slots
    // (e.g. Cyberia Systems copies TWO DIFFERENT building cards).
    stepCardInput(step: ActionPreviewStep): SelectCardModel {
      const input = (step as {input: SelectCardModel}).input;
      const dedupe = (step as {dedupeFromSteps?: ReadonlyArray<number>}).dedupeFromSteps;
      if (dedupe === undefined || dedupe.length === 0) {
        return input;
      }
      const excluded = new Set<CardName>();
      for (const j of dedupe) {
        const name = this.capturedCardName(j);
        if (name !== undefined) {
          excluded.add(name);
        }
      }
      return excluded.size === 0 ? input : {...input, cards: input.cards.filter((c) => !excluded.has(c.name))};
    },
    // The hosting SURFACE for a card step, via the shared `cardPickSurface` (by
    // candidate ownership + count + multiCard). A MULTI-card pick (`multiCardPick` —
    // Cyberia copies TWO cards) is ALWAYS routed to the roomy surface: two inline tile
    // grids don't fit the modal. A SINGLE-card pick uses the bare >3 threshold (≤3
    // stays inline as a centred ROW). `board` = own tableau, `hand` = hand cards.
    surfaceOfStep(step: ActionPreviewStep): CardPickSurface {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return 'inline';
      }
      const input = this.stepCardInput(step);
      const candidates = [...(input.cards ?? []), ...(input.disabledCards ?? [])];
      return cardPickSurface(candidates, this.handSet, this.tableauSet, this.multiCardPick);
    },
    isPlayedOverlayStep(step: ActionPreviewStep): boolean {
      return this.surfaceOfStep(step) === 'board';
    },
    isHandCardStep(step: ActionPreviewStep): boolean {
      return this.surfaceOfStep(step) === 'hand';
    },
    // The chosen card model for a played-overlay step (for the in-modal chip).
    chosenStepCard(step: ActionPreviewStep, i: number): CardModel | undefined {
      const name = this.capturedCardName(i);
      if (name === undefined) {
        return undefined;
      }
      return this.stepCardInput(step).cards.find((c) => c.name === name);
    },
    // The per-card resource impact for a CHOSEN board/hand-pick card step: the
    // chosen card's current resource count → the count AFTER this step's add
    // (current + the step's signed amount), mirroring the inline ActionTargetCard
    // impact line. undefined when the step carries no resource icon / amount (a
    // copy-production or non-resource pick — no per-card resource delta to preview).
    chosenImpact(step: ActionPreviewStep, i: number): {icon: string, from: number, to: number} | undefined {
      const icon = this.stepResourceIcon(step);
      const amount = (step as {amount?: number}).amount;
      if (icon === '' || amount === undefined) {
        return undefined;
      }
      const card = this.chosenStepCard(step, i);
      if (card === undefined) {
        return undefined;
      }
      const from = card.resources ?? 0;
      return {icon, from, to: Math.max(0, from + amount)};
    },
    // The card-target step's prompt (e.g. "Select first builder card to copy") —
    // shown above the board-pick affordance so each zone is clearly labelled.
    // TRANSLATE + SUBSTITUTE the title's data tokens (a Message like "Select card to
    // add ${0} ${1}" must render "…3 microbes", not the raw "${0} ${1}" placeholders).
    stepPromptText(step: ActionPreviewStep): string {
      const title = this.stepCardInput(step).title;
      return typeof title === 'string' ? translateText(title) : translateMessage(title);
    },
    // For an "add a card resource" step: the resource ICON class (so the picker
    // names WHICH resource — microbe / animal / floater — language- and grammar-safe,
    // unlike a text resource name). '' when the step isn't a resource-add.
    stepResourceIcon(step: ActionPreviewStep): string {
      const res = (step as {cardResource?: string}).cardResource;
      return res !== undefined && res !== '' ? iconClassFor(res) : '';
    },
    stepResourceAmount(step: ActionPreviewStep): number {
      return Math.abs((step as {amount?: number}).amount ?? 0);
    },
    // Hand off step `i`'s target pick to the РАЗЫГРАНО board (PlayerHome opens it
    // in pick mode + suppresses this modal; the picked card returns via the
    // `playedPickEpoch` watcher, captured into THIS step's slot). `reasonMode`
    // 'generic' for a non-resource pick (no `amount` → copy production), so the
    // board doesn't show a misleading resource reason; `alreadyPicked` are the
    // cards chosen in this step's linked earlier picks (labelled "already chosen").
    requestPlayedPick(i: number, step: ActionPreviewStep): void {
      const input = this.stepCardInput(step);
      const dedupe = (step as {dedupeFromSteps?: ReadonlyArray<number>}).dedupeFromSteps ?? [];
      const alreadyPicked = dedupe
        .map((j) => this.capturedCardName(j))
        .filter((n): n is CardName => n !== undefined);
      this.awaitingPlayedPickStep = i;
      this.$emit('pick-played-card', {
        title: input.title,
        selectable: input.cards.map((c) => c.name),
        reasonMode: (step as {amount?: number}).amount !== undefined ? 'resource' : 'generic',
        alreadyPicked,
      });
    },
    // Hand off a card step's pick to the КАРТЫ В РУКЕ overlay (the hand twin of
    // requestPlayedPick — for a step whose candidates are HAND cards). PlayerHome
    // opens the overlay in client-pick mode + suppresses this modal; the picked card
    // returns via the `handPickEpoch` watcher, captured into THIS step's slot.
    requestHandPick(i: number, step: ActionPreviewStep): void {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return;
      }
      const input = this.stepCardInput(step);
      const reasons: Record<string, string> = {};
      for (const c of input.disabledCards ?? []) {
        const r = c.disabledReason;
        reasons[c.name] = r === undefined ? '' : (typeof r === 'string' ? translateText(r) : translateMessage(r));
      }
      this.awaitingHandPickStep = i;
      this.$emit('pick-card', {
        title: input.title,
        buttonLabel: input.buttonLabel,
        selectable: input.cards.map((c) => c.name),
        reasons,
      });
    },
    // A MULTI-select card pick (Public Plans): rendered as a count summary, hosted
    // by the КАРТЫ В РУКЕ overlay's multi-select mode. `step.multiSelect !== undefined`.
    isMultiSelectStep(step: ActionPreviewStep): boolean {
      return step.kind === 'input' && step.multiSelect !== undefined;
    },
    // How many cards the player has chosen so far for a multi-select step.
    multiSelectCount(i: number): number {
      const r = this.captured[i];
      return (r !== undefined && r.type === 'card') ? r.cards.length : 0;
    },
    // The i18n label for the count chip (e.g. "Cards to reveal").
    multiSelectLabel(step: ActionPreviewStep): string {
      if (step.kind !== 'input' || step.multiSelect === undefined) {
        return '';
      }
      return this.text(step.multiSelect.countLabel);
    },
    // Hand off a MULTI-select card step to the КАРТЫ В РУКЕ overlay's multi-select
    // mode (PlayerHome opens it + suppresses this modal; the whole picked set returns
    // via the `handPickEpoch` watcher). Re-opening keeps the prior picks (Change
    // selection). `min`/`max` bound the selection; the response is one card array.
    requestMultiHandPick(i: number, step: ActionPreviewStep): void {
      if (step.kind !== 'input' || step.input.type !== 'card') {
        return;
      }
      const input = step.input as SelectCardModel;
      const prior = this.captured[i];
      const selected = (prior !== undefined && prior.type === 'card') ? prior.cards : [];
      this.awaitingHandPickStep = i;
      this.$emit('pick-card', {
        title: input.title,
        buttonLabel: input.buttonLabel,
        selectable: input.cards.map((c) => c.name),
        reasons: {},
        // `multi` (not max > 1) marks the multi-select path so an "up to 1" pick
        // over a single-card hand still delivers the WHOLE set (incl. empty).
        multi: true,
        min: input.min,
        max: input.max,
        selected,
      });
    },
    openStepFullscreen(step: ActionPreviewStep, i: number): void {
      const card = this.chosenStepCard(step, i);
      if (card === undefined) {
        return;
      }
      this.zoomCard = card;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    // SelectProjectCardToPlay's onsave — fired by saveData() when the payment is
    // valid. Captures the {type:'projectCard', card, payment} response.
    capturePlay(out: SelectProjectCardToPlayResponse): void {
      this.capturedPlay = out;
    },
    confirm(): void {
      const branch = this.selected;
      if (branch === undefined || !this.canConfirm) {
        return;
      }
      // A merged "up to N" pick (Astra) submitted with NOTHING selected → confirm
      // the player really wants to play without returning anything (rules allow it).
      if (this.needsEmptyWarning(branch)) {
        this.showEmptyWarning = true;
        return;
      }
      this.emitConfirm(branch);
    },
    // The empty-pick warning applies only to a mergeable pick whose min is 0 (so 0
    // is reachable at confirm) and the player picked nothing.
    needsEmptyWarning(branch: ActionPreviewBranch): boolean {
      return branch.mergeCardSteps !== undefined &&
        branch.mergeCardSteps.min === 0 &&
        this.cardPicksDone === 0;
    },
    // The popup's "play anyway" — proceed with the (empty) submit.
    confirmEmpty(): void {
      this.showEmptyWarning = false;
      const branch = this.selected;
      if (branch !== undefined && this.canConfirm) {
        this.emitConfirm(branch);
      }
    },
    cancelEmpty(): void {
      this.showEmptyWarning = false;
    },
    emitConfirm(branch: ActionPreviewBranch): void {
      // Pull the play response out of the embedded widget (validates internally;
      // only sets capturedPlay when the payment covers the cost).
      this.capturedPlay = undefined;
      (this.$refs.payWidget as {saveData?: () => void} | undefined)?.saveData?.();
      if (this.capturedPlay === undefined) {
        return;
      }
      const stepResponses: Array<InputResponse> = [];
      if (branch.mergeCardSteps !== undefined) {
        // MERGED SLOTS (Astra): the live play is ONE SelectCard (min..max), so the
        // slot picks collapse into ONE {type:'card', cards:[...]} response (in slot
        // order, empty slots skipped). The cross-step de-dup guarantees no card is
        // listed twice. By contract a merge branch contains ONLY card steps.
        const cards: Array<CardName> = [];
        branch.steps.forEach((step, i) => {
          if (step.kind === 'input' && step.input.type === 'card') {
            const name = this.capturedCardName(i);
            if (name !== undefined) {
              cards.push(name);
            }
          }
        });
        stepResponses.push({type: 'card', cards});
      } else {
        branch.steps.forEach((step, i) => {
          if (stepNeedsResponse(step) && this.captured[i] !== undefined) {
            stepResponses.push(this.captured[i]);
          }
        });
      }
      const payload: PlayCardPayload = {
        playResponse: this.capturedPlay,
        branchIndex: branch.index,
        optionResponse: undefined,
        stepResponses,
      };
      this.$emit('confirm', payload);
    },
    openFullscreen(): void {
      this.zoomCard = this.cardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>

<style scoped lang="less">
.play-confirm__frame {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.play-confirm__corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 1px solid rgba(120, 200, 255, 0.55);
  pointer-events: none;
  &--tl { top: -6px; left: -6px; border-right: none; border-bottom: none; }
  &--tr { top: -6px; right: -6px; border-left: none; border-bottom: none; }
  &--bl { bottom: -6px; left: -6px; border-right: none; border-top: none; }
  &--br { bottom: -6px; right: -6px; border-left: none; border-top: none; }
}

.play-confirm__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.play-confirm__kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(150, 200, 230, 0.75);
}
.play-confirm__kicker-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #6ab0e6;
  box-shadow: 0 0 8px rgba(106, 176, 230, 0.8);
}
.play-confirm__title {
  margin: 0;
  font-family: Prototype, Orbitron, Ubuntu, sans-serif;
  font-size: 19px;
  letter-spacing: 0.04em;
  color: #eaf6ff;
}

.play-confirm__body {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  // A comfortable working width so the two-column layout (card + outcome |
  // planning) never feels cramped; the modal still hugs (its max-width caps it).
  width: 660px;
  max-width: 100%;
}
// LEFT — the card we're playing + WHAT IT DOES (a compact "spec" panel).
.play-confirm__left {
  flex: 0 0 196px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.play-confirm__source {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.play-confirm__section-label {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(150, 200, 230, 0.58);
}
.play-confirm__card {
  position: relative;
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
  // Compact the card so it reads as PART of the layout, not an oversized object
  // bursting the modal. Zero the legacy asymmetric margin (centred render).
  > :deep(.card-container) { margin: 0; zoom: 0.62; }
}
// Fullscreen affordance — a glass chip in the card corner (separate from any
// other click), revealed on hover.
.play-confirm__zoom {
  position: absolute;
  top: 5px;
  right: 6px;
  width: 22px;
  height: 22px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid rgba(120, 200, 255, 0.4);
  background: rgba(8, 18, 28, 0.82);
  font-size: 13px;
  color: rgba(220, 240, 255, 0.9);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.play-confirm__card:hover .play-confirm__zoom { opacity: 1; }

// The on-play result as a vertical spec sheet under the card — each chip spans
// the column so the player reads exactly what the card does at a glance.
.play-confirm__result {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.play-confirm__vp { margin-top: 2px; }

// RIGHT — the planning area (the decisions): branch / targets / payment.
.play-confirm__right {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.play-confirm__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.play-confirm__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  &--summary { margin-top: 1px; }
}

// Narrow viewports: stack the two columns so nothing is cramped.
@media (max-width: 580px) {
  .play-confirm__body { flex-direction: column; width: auto; }
  .play-confirm__left { flex: 0 0 auto; }
}

.play-confirm__branches {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.play-confirm__branch {
  display: flex;
  align-items: flex-start;
  gap: 11px;
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
  }
}
.play-confirm__branch-tick {
  flex: 0 0 auto;
  margin-top: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(120, 200, 255, 0.5);
  .play-confirm__branch--selected & {
    border-color: rgba(120, 230, 255, 1);
    background: radial-gradient(circle, rgba(120, 230, 255, 1) 38%, transparent 42%);
  }
}
.play-confirm__branch-main { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.play-confirm__branch-title { font-size: 13px; line-height: 1.3; color: #e3f2fb; }
.play-confirm__branch-reason { font-size: 11.5px; color: rgba(255, 184, 130, 0.9); }

.play-confirm__steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.play-confirm__step {
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
}
.play-confirm__step-glyph { color: rgba(255, 200, 120, 0.9); }

// WARNING — an effect that will be SKIPPED for lack of a valid target. Orange, so
// the player is never surprised by a silently-lost effect.
/* A multi-card pick (Cyberia) lays its card zones SIDE BY SIDE instead of
   stacked — two inline grids didn't fit vertically. */
.play-confirm__steps--cards-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 14px;
}
.play-confirm__steps--cards-row > .play-confirm__section-label,
.play-confirm__steps--cards-row > .play-confirm__steps-note,
.play-confirm__steps--cards-row > .play-confirm__warn,
.play-confirm__steps--cards-row > .play-confirm__step--placement {
  flex: 0 0 100%;
}
.play-confirm__steps--cards-row > .play-confirm__step--input {
  flex: 1 1 0;
  min-width: 0;
}

/* >3-candidate own-card target → "pick on the РАЗЫГРАНО board" affordance
   (the inline tile grid is too cramped). Mirrors the action-confirm handpick. */
.play-confirm__handpick {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.play-confirm__handpick-prompt {
  font-size: 11.5px;
  line-height: 1.35;
  color: rgba(150, 226, 245, 0.9);
  text-align: center;
}
// Resource-add prompt: the resource ICON + count, so the picker unambiguously
// names WHICH resource it adds (grammar-safe, no text resource name).
.play-confirm__handpick-prompt--res {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.play-confirm__handpick-res-icon {
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex: 0 0 auto;
}
.play-confirm__handpick-res-amt {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #bff0ff;
}
.play-confirm__handpick-res-to {
  font-size: 11.5px;
  color: rgba(150, 226, 245, 0.8);
}
.play-confirm__warn--cards {
  align-items: center;
}
.play-confirm__warn-count {
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(224, 150, 70, 0.22);
  color: #f0b86a;
  font-weight: 700;
  font-size: 11.5px;
}
.play-confirm__handpick-btn,
.play-confirm__handpick-change {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid rgba(64, 224, 255, 0.4);
  background: linear-gradient(180deg, rgba(26, 48, 58, 0.7), rgba(16, 30, 38, 0.7));
  color: #d7eef5;
  font-size: 13px;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease, transform 140ms ease;
}
.play-confirm__handpick-btn:hover,
.play-confirm__handpick-change:hover {
  background: linear-gradient(180deg, rgba(34, 62, 74, 0.82), rgba(20, 38, 48, 0.82));
  border-color: rgba(70, 230, 255, 0.65);
  transform: translateY(-1px);
}
.play-confirm__handpick-glyph {
  font-size: 14px;
  color: #6fe6ff;
}
// Premium compact "chosen card" chip (mirrors the action-confirm modal): framed,
// cyan-accented, with a ВЫБРАНА badge + a scaled-down card so it stays compact in
// the multi-card side-by-side layout.
.play-confirm__handpick-chosen {
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  padding: 11px 14px 13px;
  border-radius: 12px;
  border: 1px solid rgba(120, 220, 255, 0.4);
  background:
    radial-gradient(120% 60% at 50% 0%, rgba(120, 220, 255, 0.1), transparent 65%),
    linear-gradient(180deg, rgba(20, 40, 58, 0.6), rgba(14, 28, 42, 0.6));
  box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.18), 0 10px 24px rgba(0, 0, 0, 0.4);
}
.play-confirm__handpick-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(70, 230, 255, 0.22), rgba(40, 190, 220, 0.16));
  box-shadow: inset 0 0 0 1px rgba(120, 230, 255, 0.5);
  color: #bff0ff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.play-confirm__handpick-badge-tick { font-size: 11px; line-height: 1; color: #7af2ff; }
.play-confirm__handpick-card {
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
  border-radius: 8px;
  transition: filter 0.15s ease, transform 0.15s ease;
  &:hover { filter: brightness(1.06); transform: translateY(-1px); }
  > .card-container { margin: 0; zoom: 0.5; }
}
.play-confirm__handpick-change {
  padding: 6px 14px;
  font-size: 12px;
}
// The per-card resource impact under a chosen board/hand pick (microbe 4 → 7) —
// the same "current → resulting" readout the inline ActionTargetCard shows, so the
// player sees exactly how much THIS card gains before confirming.
.play-confirm__handpick-impact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 12px;
  border-radius: 999px;
  background: rgba(8, 20, 30, 0.6);
  border: 1px solid rgba(120, 220, 255, 0.32);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 13.5px;
}
.play-confirm__handpick-impact-icon {
  width: 18px;
  height: 18px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  flex: 0 0 auto;
}
.play-confirm__handpick-impact-from { color: rgba(206, 228, 244, 0.72); }
.play-confirm__handpick-impact-arrow { color: rgba(150, 220, 255, 0.7); font-weight: 400; }
.play-confirm__handpick-impact-to { color: #8ff0c4; }

// MULTI-select card pick (Public Plans): a centred count summary + a pick button.
// No card list — the pick can be large; the count + the РЕЗУЛЬТАТ chip say enough.
.play-confirm__multipick {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9px;
}
.play-confirm__multipick-summary {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 7px 14px;
  border-radius: 10px;
  border: 1px solid rgba(120, 220, 255, 0.4);
  background:
    radial-gradient(120% 70% at 50% 0%, rgba(120, 220, 255, 0.12), transparent 70%),
    linear-gradient(180deg, rgba(20, 40, 58, 0.6), rgba(14, 28, 42, 0.6));
}
.play-confirm__multipick-label {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(170, 214, 235, 0.85);
}
.play-confirm__multipick-count {
  min-width: 26px;
  padding: 1px 10px;
  border-radius: 999px;
  background: rgba(70, 230, 255, 0.18);
  box-shadow: inset 0 0 0 1px rgba(120, 230, 255, 0.5);
  color: #bff0ff;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  text-align: center;
}

// A calm "the later slot is optional" note for a merged pick (Astra).
.play-confirm__steps-note {
  font-size: 11.5px;
  line-height: 1.35;
  color: rgba(150, 200, 230, 0.7);
}

.play-confirm__warn {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 10px 13px;
  border-radius: 9px;
  background: rgba(224, 150, 70, 0.12);
  box-shadow: inset 0 0 0 1px rgba(224, 150, 70, 0.4);
}
.play-confirm__warn-glyph {
  flex-shrink: 0;
  font-size: 14px;
  color: #f0b86a;
  line-height: 1.3;
}
/* The lost card-resource's icon (global `.card-resource-<key>` sprite), so the
   player sees WHICH resource won't be added. */
.play-confirm__warn-res {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.play-confirm__warn-text {
  font-size: 12.5px;
  line-height: 1.4;
  color: #f4d3a6;
}

// The payment widget carries its own rows + summary; give the section a calm
// surface so it reads as a distinct "dial your cost" zone.
.play-confirm__payment-section :deep(.payments_cont) {
  display: flex;
  flex-direction: column;
}

.play-confirm__loading {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 28px 0;
  .play-confirm__loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(120, 220, 255, 0.85);
    animation: play-confirm-pulse 1s ease-in-out infinite;
    &:nth-child(2) { animation-delay: 0.15s; }
    &:nth-child(3) { animation-delay: 0.3s; }
  }
}
@keyframes play-confirm-pulse {
  0%, 100% { opacity: 0.25; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1); }
}

.play-confirm__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.play-confirm__readiness {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  letter-spacing: 0.03em;
  color: rgba(190, 214, 234, 0.78);
  transition: color 0.2s ease;
}
.play-confirm__readiness-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(150, 180, 205, 0.5);
  transition: background 0.2s ease, box-shadow 0.2s ease;
}
.play-confirm__readiness--ready {
  color: #8ff0c4;
  .play-confirm__readiness-dot {
    background: #58d6a6;
    box-shadow: 0 0 9px rgba(88, 214, 166, 0.7);
  }
}
.play-confirm__actions {
  display: flex;
  gap: 12px;
}

// Empty-pick confirm popup — over the play modal (wrapper z-index 12000).
.play-empty-warn {
  position: fixed;
  inset: 0;
  z-index: 12100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(4, 10, 16, 0.62);
  backdrop-filter: blur(2px);
}
.play-empty-warn__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: min(440px, calc(100vw - 48px));
  padding: 24px 26px 22px;
  text-align: center;
  border-radius: 14px;
  border: 1px solid rgba(224, 170, 90, 0.45);
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(224, 170, 90, 0.14), transparent 70%),
    linear-gradient(180deg, rgba(20, 30, 42, 0.96), rgba(12, 20, 30, 0.96));
  box-shadow: 0 0 0 1px rgba(224, 170, 90, 0.25), 0 22px 60px rgba(0, 0, 0, 0.6);
}
.play-empty-warn__glyph {
  font-size: 28px;
  color: #f0b86a;
  line-height: 1;
}
.play-empty-warn__title {
  margin: 0;
  font-family: Prototype, Orbitron, Ubuntu, sans-serif;
  font-size: 17px;
  letter-spacing: 0.03em;
  color: #f6e6cf;
}
.play-empty-warn__text {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(228, 224, 214, 0.85);
}
.play-empty-warn__actions {
  display: flex;
  gap: 12px;
  margin-top: 6px;
}
</style>
