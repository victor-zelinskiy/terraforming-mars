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

      <div class="play-confirm__body">
        <aside class="play-confirm__source">
          <span class="play-confirm__source-label" v-i18n>Card</span>
          <button type="button"
                  class="play-confirm__card"
                  :aria-label="$t('Open fullscreen')"
                  @click.capture.stop="openFullscreen"
                  @keydown.enter="openFullscreen">
            <Card :card="cardModel" />
            <span class="play-confirm__zoom" aria-hidden="true">⤢</span>
          </button>
        </aside>

        <section class="play-confirm__main">
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

            <!-- RESULT — the on-play effect chips (what changes + resulting value). -->
            <div v-if="selected !== undefined && selected.effects.length > 0" class="play-confirm__section">
              <span class="play-confirm__section-label" v-i18n>Result</span>
              <div class="play-confirm__chips play-confirm__chips--summary">
                <ActionEffectChip v-for="(e, i) in selected.effects" :key="i" :effect="e" />
              </div>
            </div>

            <!-- VP-progress context (e.g. a card whose resource scores VP). -->
            <div v-if="vpProgress !== undefined" class="play-confirm__section">
              <ActionVpProgress :cardName="cardName"
                                :resourceIcon="vpProgress.icon"
                                :before="vpProgress.before"
                                :after="vpProgress.after" />
            </div>

            <!-- CHOICES — the interactive target/parameter pickers for the play. -->
            <div v-if="selected !== undefined && selected.steps.length > 0" class="play-confirm__steps">
              <span class="play-confirm__section-label" v-i18n>Choose targets</span>
              <template v-for="(step, i) in selected.steps" :key="i">
                <div v-if="step.kind === 'boardPlacement'" class="play-confirm__step play-confirm__step--placement">
                  <span class="play-confirm__step-glyph" aria-hidden="true">◎</span>
                  <span class="play-confirm__step-text" v-i18n>{{ placementHint(step) }}</span>
                </div>
                <div v-else class="play-confirm__step play-confirm__step--input"
                     :class="{'play-confirm__step--answered': captured[i] !== undefined}">
                  <ModernPlayerPicker v-if="step.input.type === 'player'"
                                      :controlled="true"
                                      :playerView="playerView"
                                      :playerinput="step.input"
                                      :onsave="noop"
                                      @select="captureStep(i)($event)" />
                  <ActionTargetCard v-else-if="step.input.type === 'card'"
                                    :playerView="playerView"
                                    :input="step.input"
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
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Message} from '@/common/logs/Message';
import {InputResponse, SelectProjectCardToPlayResponse} from '@/common/inputs/InputResponse';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {paths} from '@/common/app/paths';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import SelectProjectCardToPlay from '@/client/components/SelectProjectCardToPlay.vue';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import ModernPlayerPicker from '@/client/components/modalInputs/ModernPlayerPicker.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';
import ActionVpProgress from '@/client/components/actions/ActionVpProgress.vue';
import {resourceScoring} from '@/client/components/additionalResources/additionalResources';

// The batch payload emitted on confirm: the play pick (projectCard + payment) +
// the optional on-play `behavior.or` branch + the pre-collected step responses.
export type PlayCardPayload = {
  playResponse: SelectProjectCardToPlayResponse;
  branchIndex: number;
  optionResponse: InputResponse | undefined;
  stepResponses: ReadonlyArray<InputResponse>;
};

/**
 * Payment + on-play-preview modal content for playing a hand card. Hosted inside
 * `MandatoryInputModal` by PlayerHome (`pendingPlayCard`). It never POSTs
 * directly — it emits `confirm` with a `PlayCardPayload` so the host assembles
 * the batch (`[play, ...steps]`) and submits via WaitingFor.onsaveBatch. `cancel`
 * closes with no round-trip.
 */
export default defineComponent({
  name: 'HandCardPaymentContent',
  components: {Card, CardZoomModal, SelectProjectCardToPlay, ModalInputHost, ModernPlayerPicker, ActionEffectChip, ActionTargetCard, ActionVpProgress},
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
  emits: ['confirm', 'cancel'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selected: undefined as ActionPreviewBranch | undefined,
      captured: {} as Record<number, InputResponse>,
      // The play response captured from the embedded widget on confirm.
      capturedPlay: undefined as SelectProjectCardToPlayResponse | undefined,
      // Whether the dialed payment currently covers the cost (from the widget).
      paymentValid: false,
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
      return branch.steps.every((step, i) => step.kind !== 'input' || this.captured[i] !== undefined);
    },
  },
  mounted(): void {
    this.fetchPreview();
  },
  methods: {
    text(m: string | Message): string {
      return typeof m === 'string' ? m : m.message;
    },
    placementHint(step: {kind: string, placementType?: string}): string {
      switch (step.placementType) {
      case 'ocean': return 'After confirming, choose where to place the ocean tile on the board.';
      case 'city': return 'After confirming, choose where to place the city tile on the board.';
      case 'greenery': return 'After confirming, choose where to place the greenery tile on the board.';
      case 'colony': return 'After confirming, choose a colony to build on.';
      default: return 'You will place a tile on the board after confirming.';
      }
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
      };
    },
    noop(): void {
      // ModernPlayerPicker requires an onsave prop; controlled mode never calls it.
    },
    capturedCardName(i: number): CardName | undefined {
      const r = this.captured[i];
      return (r !== undefined && r.type === 'card') ? r.cards[0] : undefined;
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
      // Pull the play response out of the embedded widget (validates internally;
      // only sets capturedPlay when the payment covers the cost).
      this.capturedPlay = undefined;
      (this.$refs.payWidget as {saveData?: () => void} | undefined)?.saveData?.();
      if (this.capturedPlay === undefined) {
        return;
      }
      const stepResponses: Array<InputResponse> = [];
      branch.steps.forEach((step, i) => {
        if (step.kind === 'input' && this.captured[i] !== undefined) {
          stepResponses.push(this.captured[i]);
        }
      });
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
  gap: 18px;
  align-items: flex-start;
}
.play-confirm__source {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 0 0 auto;
}
.play-confirm__source-label,
.play-confirm__section-label {
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(150, 200, 230, 0.58);
}
.play-confirm__card {
  position: relative;
  border: none;
  background: none;
  padding: 0;
  cursor: zoom-in;
  // Zero the legacy asymmetric card margin so the card reads centred.
  > :deep(.card-container) { margin: 0; }
}
.play-confirm__zoom {
  position: absolute;
  top: 6px;
  right: 36px;
  font-size: 15px;
  color: rgba(220, 240, 255, 0.85);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.play-confirm__card:hover .play-confirm__zoom { opacity: 1; }

.play-confirm__main {
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
  &--summary { margin-top: 2px; }
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
  justify-content: flex-end;
}
.play-confirm__actions {
  display: flex;
  gap: 12px;
}
</style>
