<template>
  <!-- data-motion-*: the surface-motion contract — no own backdrop (the
       shared `.con-shade` is already up under the action center); the panel
       is the animated unit; the source card is the ANCHOR that FLIPs into
       the reveal result's «Источник» slot on the phase handoff. -->
  <div class="con-composer" role="dialog" :aria-label="$t('Confirmation')" data-motion-surface="action-composer">
    <div class="con-composer__panel con-composer__panel--act" data-motion-panel>
      <!-- ── Header ────────────────────────────────────────────────── -->
      <div class="con-composer__kicker">
        <span class="con-composer__kicker-mark" aria-hidden="true">◈</span>
        <span>{{ $t(hasDecisions ? 'Action setup' : 'Confirmation') }}</span>
      </div>
      <div class="con-composer__name">{{ $t(entry.cardName) }}</div>

      <!-- ── Two columns: the SOURCE CARD (inert printed face — the player
           must SEE what they are confirming) · the decision/summary column. -->
      <div class="con-composer__actmain">
      <div class="con-composer__actcard" aria-hidden="true" :data-motion-anchor="'card:' + entry.cardName">
        <ConsoleCardFaceLite :name="entry.cardName" />
      </div>
      <div class="con-composer__actright">

      <!-- ── Hero: the LIVE cost → reward formula of the ACTIVE branch.
           Shown once a branch is chosen (or a single-branch card); the
           multi-branch option cards below carry their own chips. ─────── -->
      <div v-if="showHero" class="con-composer__hero">
        <div v-if="heroCost.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('Will be spent') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroCost" :key="'c' + k" :effect="eff" />
          </div>
        </div>
        <span v-if="heroCost.length > 0 && heroGain.length > 0" class="con-composer__hero-arrow" aria-hidden="true">→</span>
        <div v-if="heroGain.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('You will receive') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroGain" :key="'g' + k" :effect="eff" />
          </div>
        </div>
        <div v-if="heroChoice.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('You choose') }}</div>
          <div class="con-composer__hero-chips">
            <span v-for="(vc, k) in heroChoice" :key="'v' + k" class="con-composer__varchip">
              <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
              <b>{{ amountFor(vc.id) }}</b>
              <em>{{ $t('your choice') }}</em>
            </span>
          </div>
        </div>
      </div>
      <div v-else-if="!hasDecisions" class="con-composer__hero con-composer__hero--plain">{{ $t('Confirm to perform this action.') }}</div>

      <!-- ── The decision surface ─────────────────────────────────────── -->
      <ConsoleScrollArea class="con-composer__scroll" content-class="con-composer__scroll-body" ref="scroll">
        <!-- SUB-STATE: a premium pick list (card / player / or). -->
        <template v-if="sub !== undefined && sub.kind === 'list'">
          <div class="con-composer__sub-title">{{ subTitle }}</div>
          <div v-for="(item, i) in listItems" :key="item.key"
               class="con-composer__opt"
               :class="{
                 'con-composer__opt--focused': sub.index === i,
                 'con-composer__opt--disabled': item.disabled,
                 'con-composer__opt--chosen': item.chosen,
               }"
               :ref="sub.index === i ? 'focusedEl' : undefined">
            <span v-if="item.color !== undefined" class="con-composer__opt-dot" :class="'player_bg_color_' + item.color" aria-hidden="true"></span>
            <span class="con-composer__opt-name">{{ item.label }}</span>
            <span v-if="item.resIcon !== ''" class="con-composer__opt-res">
              <i class="con-composer__opt-res-icon" :class="iconClass(item.resIcon)" aria-hidden="true"></i>
              <b>{{ item.resCount }}</b>
            </span>
            <span v-if="item.impact !== ''" class="con-composer__opt-impact">{{ item.impact }}</span>
            <span v-if="item.disabled && item.reason !== ''" class="con-composer__opt-reason">✕ {{ item.reason }}</span>
            <span v-else-if="item.chosen" class="con-composer__opt-check" aria-hidden="true">✓</span>
          </div>
        </template>

        <!-- SUB-STATE: payment lanes. -->
        <template v-else-if="sub !== undefined && sub.kind === 'payment' && paymentView !== undefined">
          <div class="con-composer__sub-title">{{ subTitle }}</div>
          <div v-for="(lane, i) in paymentView.lanes" :key="lane.unit"
               class="con-composer__lane"
               :class="{'con-composer__lane--focused': sub.index === i}"
               :ref="sub.index === i ? 'focusedEl' : undefined">
            <i class="con-composer__lane-icon" :class="iconClass(lane.unit)" aria-hidden="true"></i>
            <span class="con-composer__lane-name">{{ $t(laneLabel(lane.unit)) }}</span>
            <span class="con-composer__lane-rate" v-if="lane.rate > 1">×{{ lane.rate }}</span>
            <span class="con-composer__lane-value"><b>{{ paymentView.counts[lane.unit] ?? 0 }}</b><i>/ {{ lane.available }}</i></span>
          </div>
          <div class="con-composer__lane con-composer__lane--auto">
            <i class="con-composer__lane-icon" :class="iconClass('megacredits')" aria-hidden="true"></i>
            <span class="con-composer__lane-name">{{ $t('Megacredits') }}</span>
            <span class="con-composer__lane-value"><b>{{ paymentView.mc }}</b><i>{{ $t('auto') }}</i></span>
          </div>
          <div class="con-composer__paytotal"
               :class="{
                 'con-composer__paytotal--ok': paymentView.covers && paymentView.overpay === 0,
                 'con-composer__paytotal--over': paymentView.overpay > 0,
               }">
            <span class="con-composer__paytotal-main">{{ $t('Total') }}: {{ paymentView.total }} / {{ paymentView.cost }} M€</span>
            <span v-if="paymentView.overpay > 0" class="con-composer__payover">
              <span class="con-composer__payover-label">{{ $t('Overpaying') }}</span>
              <span class="con-composer__payover-amt">+{{ paymentView.overpay }}</span>
              <i class="resource_icon resource_icon--megacredits con-composer__payover-icon" aria-hidden="true"></i>
            </span>
          </div>
        </template>

        <!-- MAIN: preSteps + branch OPTION CARDS + the selected branch's inputs. -->
        <template v-else>
          <template v-for="(item, i) in items" :key="item.id">
            <!-- A branch OPTION CARD (premium chips, like the desktop radiogroup). -->
            <div v-if="item.kind === 'branch'"
                 class="con-composer__branch"
                 :class="{
                   'con-composer__branch--focused': focusIdx === i,
                   'con-composer__branch--selected': selectedPos === item.pos,
                   'con-composer__branch--disabled': !branchAt(item.pos).available,
                 }"
                 :ref="focusIdx === i ? 'focusedEl' : undefined">
              <span v-if="selectedPos === item.pos" class="con-composer__branch-check" aria-hidden="true">◉</span>
              <span v-else class="con-composer__branch-check con-composer__branch-check--off" aria-hidden="true">○</span>
              <div class="con-composer__branch-body">
                <div class="con-composer__branch-formula">
                  <template v-for="(eff, k) in branchView(item.pos).cost" :key="'c' + k">
                    <ActionEffectChip :effect="eff" />
                  </template>
                  <span v-for="(vc, k) in branchView(item.pos).variableCost" :key="'vc' + k" class="con-composer__varchip con-composer__varchip--spend">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b>
                  </span>
                  <span v-if="branchHasBothSides(item.pos)" class="con-composer__branch-arrow" aria-hidden="true">→</span>
                  <template v-for="(eff, k) in branchView(item.pos).gain" :key="'g' + k">
                    <ActionEffectChip :effect="eff" />
                  </template>
                  <span v-for="(vc, k) in branchView(item.pos).variableGain" :key="'vg' + k" class="con-composer__varchip con-composer__varchip--result">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b>
                  </span>
                  <span v-for="(vc, k) in branchView(item.pos).variableChoice" :key="'vx' + k" class="con-composer__varchip">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b><em>{{ $t('your choice') }}</em>
                  </span>
                  <span v-if="branchView(item.pos).empty" class="con-composer__branch-title">{{ branchTitle(branchAt(item.pos)) }}</span>
                </div>
                <div v-if="branchView(item.pos).needs !== ''" class="con-composer__branch-needs">◈ {{ branchView(item.pos).needs }}</div>
                <div v-if="!branchAt(item.pos).available" class="con-composer__branch-reason">✕ {{ branchReason(branchAt(item.pos)) }}</div>
              </div>
            </div>

            <!-- A choice input row (amount inline / picker / payment / spend-heat). -->
            <div v-else-if="item.choice !== undefined"
                 class="con-composer__row"
                 :class="{'con-composer__row--focused': focusIdx === i, 'con-composer__row--missing': choiceMissing(item.choice)}"
                 :ref="focusIdx === i ? 'focusedEl' : undefined">
              <template v-if="item.choice.kind === 'amount'">
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__stepper">
                  <i v-if="amountIcon(item.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(item.choice))" aria-hidden="true"></i>
                  <span class="con-composer__stepper-value">{{ amountFor(item.choice.id) }}</span>
                  <span class="con-composer__stepper-range">{{ amountModel(item.choice).min }} – {{ amountModel(item.choice).max }}</span>
                </div>
                <div v-if="amountResultLine(item.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(item.choice) }}</div>
                <div v-else-if="amountStockLine(item.choice) !== ''" class="con-composer__row-note">{{ amountStockLine(item.choice) }}</div>
              </template>

              <template v-else-if="item.choice.kind === 'spendHeat'">
                <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
                <div class="con-composer__stepper">
                  <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                  <span class="con-composer__stepper-value">{{ floatersFor(item.choice.id) }}</span>
                  <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
                </div>
                <div class="con-composer__row-note">{{ $t('Heat') }}: {{ heatStockFor(item.choice) }} · {{ $t('Floaters') }}: {{ floatersFor(item.choice.id) }}</div>
              </template>

              <template v-else-if="item.choice.kind === 'payment'">
                <div class="con-composer__row-label">{{ $t('Payment') }}</div>
                <div class="con-composer__row-value">
                  <span v-if="paymentSummary(item.choice) !== ''">{{ paymentSummary(item.choice) }}</span>
                  <span v-else class="con-composer__row-empty">{{ $t('Configure payment') }}…</span>
                  <span v-if="paymentOverpayOf(item.choice) > 0" class="con-composer__payover con-composer__payover--inline">
                    <span class="con-composer__payover-label">{{ $t('Overpaying') }}</span>
                    <span class="con-composer__payover-amt">+{{ paymentOverpayOf(item.choice) }}</span>
                    <i class="resource_icon resource_icon--megacredits con-composer__payover-icon" aria-hidden="true"></i>
                  </span>
                </div>
              </template>

              <template v-else>
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__row-value">
                  <span v-if="chosenLabel(item.choice) !== ''">{{ chosenLabel(item.choice) }}</span>
                  <span v-else class="con-composer__row-empty">{{ pickPlaceholder(item.choice) }}…</span>
                  <span v-if="chosenImpact(item.choice) !== ''" class="con-composer__row-impact">{{ chosenImpact(item.choice) }}</span>
                </div>
              </template>
            </div>
          </template>

          <!-- Warnings (no-effect gains at cap). -->
          <div v-for="(w, i) in warnings" :key="'w' + i" class="con-composer__warn">
            <span class="con-composer__warn-glyph" aria-hidden="true">!</span><span class="con-composer__warn-text">{{ $t(w) }}</span>
          </div>

          <!-- SKIPPED effects (no valid target) — NAME which effect is lost + the
               magnitude, then why. Was folded into the "after confirming" list as a
               bare "⚠ <reason>" line, which said nothing about WHICH effect. -->
          <div v-for="(w, i) in skippedWarnings" :key="'sw' + i" class="con-composer__warn">
            <span class="con-composer__warn-glyph" aria-hidden="true">⚠</span>
            <span class="con-composer__warn-body">
              <span class="con-composer__warn-head">
                <span v-if="w.title !== ''" class="con-composer__warn-title">{{ w.title }}</span>
                <ActionEffectChip v-if="w.effect !== undefined" :effect="w.effect" :skipped="true" />
                <i v-else-if="w.icon !== ''" class="con-composer__warn-res" :class="w.icon" aria-hidden="true"></i>
              </span>
              <span class="con-composer__warn-text">{{ w.reason }}</span>
            </span>
          </div>

          <!-- Honest "after confirming" (board placement / reveal / notes). -->
          <div v-for="(n, i) in afterNotes" :key="'n' + i" class="con-composer__next">
            <span aria-hidden="true">›</span><span>{{ n }}</span>
          </div>

          <!-- The explicit CTA — a FOCUSABLE row drawing the Ⓐ glyph (mirrors
               the play composer): what A does is never ambiguous, and the
               confirm is a deliberate, visible press target. After the press
               the composer HOLDS the stage (awaiting the server's answer) —
               the CTA relabels to the in-flight state so the held beat reads
               as processing, never as an ignored press. -->
          <div class="con-composer__cta"
               :class="{
                 'con-composer__cta--off': !canConfirm && !submitting,
                 'con-composer__cta--ready': canConfirm && !submitting,
                 'con-composer__cta--focused': ctaFocused && !submitting,
                 'con-composer__cta--waiting': submitting,
               }"
               :ref="ctaFocused ? 'focusedEl' : undefined"
               @click="submit">
            <GamepadGlyph v-if="!submitting" control="confirm" class="con-composer__cta-glyph" />
            <span v-else class="con-composer__cta-wait" aria-hidden="true"></span>
            <span class="con-composer__cta-label">{{ $t(submitting ? 'Performing…' : 'Confirm action') }}</span>
          </div>
        </template>
      </ConsoleScrollArea>

      </div><!-- /__actright -->
      </div><!-- /__actmain -->

      <!-- The command contract (composer context) lives in the global
           command bar (CONSOLE_TV_PREMIUM_PLAN §3.2). -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleActionComposer — the console-native PRE-SUBMIT composer for a
 * blue-card / corporation action (iteration 2b). Desktop-parity with
 * CardActionConfirmContent + submitCardActionBatch: EVERY interactive choice
 * is made HERE, before the one final submit, AND rendered in the SAME premium
 * language — a multi-branch action shows its branches as OPTION CARDS with
 * per-branch cost→reward chips (`current → resulting`), exactly like the
 * desktop radiogroup (never a bare text list). The selected branch's inputs
 * (amount stepper / card / player / payment / or) are hosted inline; card &
 * player picks open a premium sub-list with resource icons + impact lines.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` builders;
 * the parent assembles the byte-identical batch. A Viron repeat-action step
 * hands off via `repeat-pick`.
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {setConsoleActionComposerCommands, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {SelectAmountModel, SelectCardModel, SelectPaymentModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {branchPositionsForNode, branchTitleText} from '@/client/components/actions/actionBranchView';
import {
  ComposerChoice,
  branchChoices,
  preChoices,
  canConfirm as canConfirmPure,
  spendHeatPlan,
  spendHeatStock,
  spendHeatResponse,
  spendHeatValid,
  orderedPreResponses,
  orderedStepResponses,
} from '@/client/console/consoleActionComposer';
import {variablePartsForBranch, ConsoleVariableChip} from '@/client/console/consoleCardActions';
import {paymentLanes, megacreditsAvailable, paymentCovers, paymentTotal, paymentFromCounts, initialCounts, laneCap, PaymentLane} from '@/client/console/paymentPlan';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {translateMessage, translateText, translateCardName} from '@/client/directives/i18n';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {isSurfaceAwaitingHandoff} from '@/client/console/surfaceMotion/surfaceMotionState';
import {enterConsoleHandPick, isHandCardSelection, isCardSelectionWithin} from '@/client/console/consoleHandPick';
import {enterPlayedTableauPick} from '@/client/console/played/playedCategoryView';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardType} from '@/common/cards/CardType';

type Item = {id: string, kind: 'branch', pos: number} | {id: string, kind: 'choice', choice: ComposerChoice};
type SubState =
  | {kind: 'list', choiceId: string, index: number}
  | {kind: 'payment', choiceId: string, index: number};

type ListItem = {
  key: string,
  label: string,
  resIcon: string,
  resCount: number,
  impact: string,
  disabled: boolean,
  reason: string,
  chosen: boolean,
  color?: string,
  card?: CardModel,
};

/** A branch's premium formula view (static chips + variable ranges). */
type BranchView = {
  cost: ReadonlyArray<ActionEffect>,
  gain: ReadonlyArray<ActionEffect>,
  variableCost: ReadonlyArray<ConsoleVariableChip>,
  variableGain: ReadonlyArray<ConsoleVariableChip>,
  variableChoice: ReadonlyArray<ConsoleVariableChip>,
  /** True when the branch has no chips at all (show its title). */
  empty: boolean,
  /** A named non-chip requirement (card / player pick) — never a mute variant. */
  needs: string,
};

const STANDARD_STOCK: ReadonlyArray<string> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];
const CHOICE_KIND_LABEL: Record<string, string> = {
  card: 'Choose a card', player: 'Choose a player', or: 'Choose an option', payment: 'Payment',
};

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleActionComposer',
  components: {ActionEffectChip, ConsoleScrollArea, ConsoleCardFaceLite, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    entry: {type: Object as PropType<ActionEntry>, required: true},
    preview: {type: Object as PropType<ActionPreview | undefined>, default: undefined},
    nodeIndex: {type: Number, required: true},
  },
  emits: ['confirm', 'cancel', 'repeat-pick'],
  data() {
    return {
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      payCounts: {} as Record<string, Partial<Record<SpendableResource, number>>>,
      picks: {} as Record<string, string>,
      /** Multi-select hand picks by choice id (display; the capture is the truth). */
      multiPicks: {} as Record<string, ReadonlyArray<string>>,
      focusIdx: 0,
      sub: undefined as SubState | undefined,
      submitting: false,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    /** Card names in the player's hand — a pick whose every candidate is a
     *  hand card routes to the hand section's pick mode. */
    handNamesSet(): ReadonlySet<string> {
      return new Set(this.playerView.cardsInHand.map((c) => c.name));
    },
    /** Card names on the viewer's TABLE — those picks (incl. Viron's
     *  repeat-action pick over played action cards) route to the «Разыграно»
     *  view's pick mode: the real table cards physically lift. */
    tableauNamesSet(): ReadonlySet<string> {
      return new Set(this.thisPlayer.tableau.map((c) => c.name));
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    positions(): ReadonlyArray<number> {
      if (this.nodeIndex < 0) {
        return this.branches.map((_b, i) => i);
      }
      return branchPositionsForNode(this.entry.group, this.branches, this.nodeIndex);
    },
    /** Show the branch radiogroup (a combined node maps to >1 branch). */
    needBranchRow(): boolean {
      return this.positions.length > 1;
    },
    selectedBranch(): ActionPreviewBranch | undefined {
      return this.selectedPos !== undefined ? this.branches[this.selectedPos] : undefined;
    },
    preChoiceList(): ReadonlyArray<ComposerChoice> {
      return preChoices(this.preview);
    },
    branchChoiceList(): ReadonlyArray<ComposerChoice> {
      return branchChoices(this.selectedBranch);
    },
    allChoices(): ReadonlyArray<ComposerChoice> {
      return [...this.preChoiceList, ...this.branchChoiceList];
    },
    /** The flat focus list: preSteps · branch option cards · branch inputs. */
    items(): ReadonlyArray<Item> {
      const out: Array<Item> = [];
      for (const c of this.preChoiceList) {
        out.push({id: c.id, kind: 'choice', choice: c});
      }
      if (this.needBranchRow) {
        for (const pos of this.positions) {
          out.push({id: 'branch#' + pos, kind: 'branch', pos});
        }
      }
      for (const c of this.branchChoiceList) {
        out.push({id: c.id, kind: 'choice', choice: c});
      }
      return out;
    },
    hasDecisions(): boolean {
      return this.items.length > 0;
    },
    /** The hero is the selected/single branch's live formula (multi-branch
     *  option cards carry their own chips → no hero until one is chosen). */
    showHero(): boolean {
      return this.selectedBranch !== undefined &&
        (this.heroCost.length + this.heroGain.length + this.heroChoice.length > 0);
    },
    canConfirm(): boolean {
      if (this.branchChoiceList.some((c) => c.repeatAction === true)) {
        return false; // a repeat-action confirms via the handoff, never here
      }
      return canConfirmPure(this.preview, this.selectedBranch, {
        pre: this.capturedPre, option: this.capturedOption, steps: this.captured,
      });
    },
    /** The composer's live command contract, published to the ONE shell bar
     *  (consolePanelUi 'actionComposer' — plan §3.2; the old in-panel footer
     *  is gone). Sub-state (payment lanes / a pick list) re-labels the run. */
    footCommands(): Array<ConsoleCommand> {
      if (this.sub !== undefined) {
        if (this.sub.kind === 'payment') {
          return [
            {control: 'bumperL', control2: 'bumperR', label: '−1 / +1'},
            {control: 'triggerR', label: 'MAX'},
            {control: 'confirm', label: 'Done', enabled: this.paymentView?.covers === true},
            {control: 'back', label: 'Back'},
          ];
        }
        const hints: Array<ConsoleCommand> = [{control: 'confirm', label: 'Select'}];
        if (this.subChoice?.input.type === 'card') {
          hints.push({control: 'secondary', label: 'Inspect'});
        }
        hints.push({control: 'back', label: 'Back'});
        return hints;
      }
      const hints: Array<ConsoleCommand> = [];
      if (this.items.length > 0 && !this.ctaFocused) {
        const focused = this.focusedItem;
        if (focused?.kind === 'choice' && (focused.choice.kind === 'amount' || focused.choice.kind === 'spendHeat')) {
          hints.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1'});
          if (focused.choice.kind === 'amount') {
            hints.push({control: 'triggerR', label: 'MAX'});
          }
        } else {
          hints.push({control: 'confirm', label: 'Select'});
        }
        hints.push({control: 'secondary', label: 'Confirm', enabled: this.canConfirm});
      } else {
        hints.push({control: 'confirm', label: 'Confirm', enabled: this.canConfirm});
      }
      hints.push({control: 'back', label: 'Cancel'});
      return hints;
    },
    heroCost(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticCost(c));
      }
      return out;
    },
    heroGain(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticGain(c));
      }
      if (branch.reveal !== undefined) {
        out.push(branch.reveal.reward);
      }
      return out;
    },
    heroChoice(): ReadonlyArray<{id: string, icon?: string}> {
      const out: Array<{id: string, icon?: string}> = [];
      for (const c of this.allChoices) {
        if (c.kind !== 'amount') {
          continue;
        }
        const m = this.amountModel(c);
        if (m.amountResult === undefined && m.conversion === undefined) {
          out.push({id: c.id, icon: m.icon});
        }
      }
      return out;
    },
    warnings(): Array<string> {
      return this.heroGain.some((e) => e.current !== undefined && e.current === e.resulting) ?
        ['One of the gains has no effect — the value is already at maximum.'] : [];
    },
    // Skipped-effect warnings for the selected branch, via the SAME shared
    // derivation the desktop modal + the play composer use.
    skippedWarnings(): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> {
      return skippedEffectViews(this.selectedBranch?.steps).map((w) => ({
        title: w.title !== '' ? translateText(w.title) : '',
        reason: translateText(w.reason),
        effect: w.effect,
        // Only a chip-less warning needs the bare fallback sprite.
        icon: w.effect === undefined && w.icon !== '' ? iconClassFor(w.icon) : '',
      }));
    },
    afterNotes(): Array<string> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const out: Array<string> = [];
      if (branch.reveal !== undefined) {
        out.push(translateText('Next: reveal a card'));
      }
      for (const step of branch.steps) {
        if (step.kind === 'boardPlacement') {
          out.push(translateText('Next: place on the board'));
        } else if (step.kind === 'note' && step.noteKind !== 'warning') {
          out.push(step.text !== undefined ? textOf(step.text) : translateText('Next: an additional choice'));
        }
        // A `warning` is NOT an "after confirming" step (nothing happens) — it has
        // its own block above (`skippedWarnings`), which names the lost effect.
      }
      return out;
    },
    // ── sub-state ────────────────────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      return this.sub === undefined ? undefined : this.allChoices.find((c) => c.id === this.sub?.choiceId);
    },
    subTitle(): string {
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    listItems(): ReadonlyArray<ListItem> {
      const c = this.subChoice;
      if (this.sub === undefined || this.sub.kind !== 'list' || c === undefined) {
        return [];
      }
      if (c.input.type === 'card') {
        const model = c.input as SelectCardModel;
        const chosenName = this.picks[c.id];
        const items: Array<ListItem> = model.cards.map((card): ListItem => this.cardListItem(c, card, chosenName === card.name, false));
        for (const card of model.disabledCards ?? []) {
          items.push(this.cardListItem(c, card, false, true));
        }
        return items;
      }
      if (c.input.type === 'player') {
        const model = c.input as SelectPlayerModel;
        const chosen = this.picks[c.id];
        const items: Array<ListItem> = model.players.map((color): ListItem => this.playerListItem(model, color, chosen === color, false, undefined));
        for (const d of model.disabledPlayers ?? []) {
          items.push(this.playerListItem(model, d.color, false, true, d.reason));
        }
        return items;
      }
      if (c.input.type === 'or') {
        const model = c.input as OrOptionsModel;
        const chosen = this.picks[c.id];
        return model.options.map((opt, i): ListItem => ({
          key: 'o' + i,
          label: textOf(opt.title),
          resIcon: '', resCount: 0, impact: '',
          disabled: opt.type !== 'option',
          reason: opt.type !== 'option' ? translateText('Unavailable right now') : '',
          chosen: chosen === String(i),
        }));
      }
      return [];
    },
    paymentView(): {lanes: ReadonlyArray<PaymentLane>, counts: Partial<Record<SpendableResource, number>>, mc: number, total: number, cost: number, covers: boolean, overpay: number} | undefined {
      const c = this.subChoice;
      return c === undefined || c.kind !== 'payment' ? undefined : this.paymentStateFor(c);
    },
    focusedItem(): Item | undefined {
      return this.items[this.focusIdx];
    },
    /** The CTA row's virtual focus index — one past the decision items. */
    ctaIndex(): number {
      return this.items.length;
    },
    ctaFocused(): boolean {
      return this.sub === undefined && this.focusIdx >= this.ctaIndex;
    },
  },
  watch: {
    preview: {immediate: true, handler() {
      this.resetFromPreview();
    }},
    playerView() {
      // Keep the in-flight CTA while the COMMITTED submit is still awaiting
      // its answer (a poll can deliver an unchanged view mid-flight; the
      // shell's resolve closes the composer when the answer lands). Any
      // other fresh view means the prompt moved on — re-arm the CTA.
      if (!isSurfaceAwaitingHandoff()) {
        this.submitting = false;
      }
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setConsoleActionComposerCommands(cmds);
      },
    },
  },
  beforeUnmount() {
    resetConsoleActionComposerUi();
  },
  methods: {
    iconClass(icon: string | undefined): string {
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    branchAt(pos: number): ActionPreviewBranch {
      return this.branches[pos];
    },
    branchTitle(b: ActionPreviewBranch): string {
      const raw = branchTitleText(b);
      return raw !== '' ? translateText(raw) : '';
    },
    branchReason(b: ActionPreviewBranch): string {
      return b.unavailableReason === undefined ? translateText('Unavailable right now') : textOf(b.unavailableReason);
    },
    rangeText(vc: ConsoleVariableChip): string {
      const unit = vc.unit ?? '';
      return vc.min === vc.max ? `${vc.min}${unit}` : `${vc.min}–${vc.max}${unit}`;
    },
    /** The premium view of ONE branch (chips + variable ranges + a named
     *  non-chip requirement) — never a mute variant. */
    branchView(pos: number): BranchView {
      const b = this.branches[pos];
      const variable = variablePartsForBranch(b);
      const cost = b.effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
      const gain = b.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      const hasChips = cost.length + gain.length + variable.cost.length + variable.gain.length + variable.choice.length > 0;
      // A branch with no chips still names its non-chip requirement (card/player
      // pick / reveal), so it's never a bare title.
      let needs = '';
      if (!hasChips) {
        if (b.reveal !== undefined) {
          needs = translateText('Next: reveal a card');
        } else if (b.optionInput?.type === 'card' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'card')) {
          needs = translateText('Choose a card');
        } else if (b.optionInput?.type === 'player' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'player')) {
          needs = translateText('Choose a player');
        }
      }
      return {cost, gain, variableCost: variable.cost, variableGain: variable.gain, variableChoice: variable.choice, empty: !hasChips && needs === '', needs};
    },
    branchHasBothSides(pos: number): boolean {
      const v = this.branchView(pos);
      const c = v.cost.length + v.variableCost.length > 0;
      const g = v.gain.length + v.variableGain.length > 0;
      return c && g;
    },
    playerName(color: string): string {
      // The Automa seat localizes to «Бот»; never leak the raw «MarsBot» name.
      return displayNameForColor(this.playerView.players, color as Color);
    },
    choiceTitle(c: ComposerChoice): string {
      const t = textOf(c.input.title);
      return t !== '' ? t : translateText(CHOICE_KIND_LABEL[c.kind] ?? 'Choose an option');
    },
    pickPlaceholder(c: ComposerChoice): string {
      if (c.repeatAction === true) {
        return translateText('Choose an action to repeat');
      }
      if (c.kind === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
        return translateText('Pick cards from hand');
      }
      return translateText(c.kind === 'card' ? 'Choose a card' : c.kind === 'player' ? 'Choose a player' : 'Choose an option');
    },
    choiceMissing(c: ComposerChoice): boolean {
      if (c.repeatAction === true) {
        return true;
      }
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── premium sub-list items ──────────────────────────────────────────
    cardListItem(c: ComposerChoice, card: CardModel, chosen: boolean, disabled: boolean): ListItem {
      const from = card.resources ?? 0;
      const impact = (!disabled && c.amount !== undefined && c.cardResource !== undefined) ?
        `${from} → ${Math.max(0, from + c.amount)}` : '';
      return {
        key: (disabled ? 'd' : '') + card.name,
        label: translateCardName(card.name),
        resIcon: c.cardResource ?? '',
        resCount: from,
        impact,
        disabled: disabled || card.isDisabled === true,
        reason: (disabled || card.isDisabled === true) ? textOf(card.disabledReason) : '',
        chosen,
        card,
      };
    },
    playerListItem(model: SelectPlayerModel, color: string, chosen: boolean, disabled: boolean, reason: string | Message | undefined): ListItem {
      let impact = '';
      if (model.icon !== undefined && model.amount !== undefined) {
        const pm = this.playerView.players.find((pl) => pl.color === color) as unknown as Record<string, number> | undefined;
        const field = model.scope === 'production' ? model.icon + 'Production' : model.icon;
        const cur = pm?.[field];
        if (cur !== undefined) {
          impact = `${cur} → ${Math.max(0, cur - model.amount)}`;
        }
      }
      return {
        key: (disabled ? 'd' : '') + color,
        label: this.playerName(color),
        resIcon: disabled ? '' : (model.icon ?? ''),
        resCount: 0,
        impact,
        disabled,
        reason: textOf(reason),
        chosen,
        color,
      };
    },
    // ── reset / defaults ────────────────────────────────────────────────
    resetFromPreview(): void {
      this.capturedPre = {};
      this.captured = {};
      this.capturedOption = undefined;
      this.amounts = {};
      this.floaters = {};
      this.payCounts = {};
      this.picks = {};
      this.multiPicks = {};
      this.sub = undefined;
      this.focusIdx = 0;
      this.submitting = false;
      const positions = this.positions;
      if (positions.length === 1) {
        this.selectedPos = positions[0];
      } else {
        const avail = positions.filter((p) => this.branches[p]?.available === true);
        this.selectedPos = avail.length === 1 ? avail[0] : undefined;
      }
      // Focus the first AVAILABLE branch (or the first item) so the player
      // starts on a meaningful choice, not the top of a list.
      if (this.needBranchRow) {
        const firstAvail = this.items.findIndex((it) => it.kind === 'branch' && this.branches[it.pos]?.available === true);
        this.focusIdx = firstAvail >= 0 ? firstAvail : 0;
      }
      this.seedDefaults();
    },
    seedDefaults(): void {
      for (const c of this.allChoices) {
        this.seedChoice(c);
      }
    },
    seedChoice(c: ComposerChoice): void {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const def = m.maxByDefault ? m.max : m.min;
        this.amounts[c.id] = def;
        this.captureFor(c, {type: 'amount', amount: def});
      } else if (c.kind === 'spendHeat') {
        const plan = spendHeatPlan(c.input);
        if (plan !== undefined) {
          this.floaters[c.id] = plan.minFloaters;
          this.captureFor(c, spendHeatResponse(plan, plan.minFloaters));
        }
      } else if (c.kind === 'payment') {
        const model = c.input as SelectPaymentModel;
        const lanes = paymentLanes(model, this.thisPlayer);
        const mc = megacreditsAvailable(this.thisPlayer);
        const counts = initialCounts(model.amount, lanes, mc);
        this.payCounts[c.id] = counts;
        if (paymentCovers(model.amount, lanes, counts, mc)) {
          this.captureFor(c, {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mc)});
        }
      }
      // A card/player/or TARGET is NEVER auto-selected — not even a lone
      // candidate (the fork's non-negotiable no-auto-select rule): the player
      // must consciously pick the target, so a single-target choice is never
      // silently skipped. Only amount/heat/payment get a visible, editable default.
    },
    captureFor(c: ComposerChoice, response: unknown | undefined): void {
      if (c.scope === 'pre') {
        if (response === undefined) {
          delete this.capturedPre[c.index];
        } else {
          this.capturedPre[c.index] = response;
        }
      } else if (c.scope === 'option') {
        this.capturedOption = response;
      } else if (response === undefined) {
        delete this.captured[c.index];
      } else {
        this.captured[c.index] = response;
      }
    },
    // ── live synthetic hero chips ───────────────────────────────────────
    syntheticCost(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const chosen = this.amountFor(c.id);
        const icon = m.icon ?? m.conversion?.from;
        if ((m.amountResult !== undefined || m.conversion !== undefined) && icon !== undefined) {
          const stock = this.stockOf(icon);
          return [{direction: 'cost', icon, amount: chosen, current: stock, resulting: stock !== undefined ? stock - chosen : undefined}];
        }
        return [];
      }
      if (c.kind === 'spendHeat') {
        const plan = spendHeatPlan(c.input);
        if (plan === undefined) {
          return [];
        }
        const floaters = this.floatersFor(c.id);
        const stock = spendHeatStock(plan, floaters);
        const heat = this.stockOf('heat');
        const out: Array<ActionEffect> = [{direction: 'cost', icon: 'heat', amount: stock, current: heat, resulting: heat !== undefined ? heat - stock : undefined}];
        if (floaters > 0) {
          out.push({direction: 'cost', icon: 'floater', amount: floaters});
        }
        return out;
      }
      if (c.kind === 'payment' && this.paymentCaptureOf(c) !== undefined) {
        const state = this.paymentStateFor(c);
        const out: Array<ActionEffect> = [];
        if (state.mc > 0) {
          const stock = this.stockOf('megacredits');
          out.push({direction: 'cost', icon: 'megacredits', amount: state.mc, current: stock, resulting: stock !== undefined ? stock - state.mc : undefined});
        }
        for (const lane of state.lanes) {
          const n = state.counts[lane.unit] ?? 0;
          if (n > 0) {
            const stock = this.stockOf(lane.unit);
            out.push({direction: 'cost', icon: lane.unit, amount: n, current: stock, resulting: stock !== undefined ? stock - n : undefined});
          }
        }
        return out;
      }
      return [];
    },
    syntheticGain(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind !== 'amount') {
        return [];
      }
      const m = this.amountModel(c);
      const chosen = this.amountFor(c.id);
      if (m.amountResult !== undefined) {
        const per = m.amountResult.perUnit ?? 1;
        return [{direction: 'gain', icon: m.amountResult.icon, amount: chosen * per}];
      }
      if (m.conversion !== undefined) {
        const ratio = m.conversion.ratio ?? 1;
        return [{direction: 'gain', icon: m.conversion.to, amount: chosen * ratio}];
      }
      return [];
    },
    // ── amount helpers ──────────────────────────────────────────────────
    amountModel(c: ComposerChoice): SelectAmountModel {
      return c.input as SelectAmountModel;
    },
    amountFor(id: string): number {
      return this.amounts[id] ?? 0;
    },
    amountIcon(c: ComposerChoice): string | undefined {
      const m = this.amountModel(c);
      return m.icon ?? m.conversion?.from;
    },
    setAmount(c: ComposerChoice, value: number): void {
      const m = this.amountModel(c);
      const clamped = Math.min(m.max, Math.max(m.min, value));
      this.amounts[c.id] = clamped;
      this.captureFor(c, {type: 'amount', amount: clamped});
    },
    amountResultLine(c: ComposerChoice): string {
      const m = this.amountModel(c);
      const chosen = this.amountFor(c.id);
      if (m.amountResult !== undefined) {
        const per = m.amountResult.perUnit ?? 1;
        const label = m.amountResult.label !== undefined ? translateText(m.amountResult.label) : '';
        return `→ ${label !== '' ? label + ': ' : ''}${chosen * per}`;
      }
      if (m.conversion !== undefined) {
        return `→ ${chosen * (m.conversion.ratio ?? 1)}`;
      }
      return '';
    },
    amountStockLine(c: ComposerChoice): string {
      const stock = this.stockOf(this.amountIcon(c));
      return stock !== undefined ? `${translateText('In stock')}: ${stock}` : '';
    },
    stockOf(icon: string | undefined): number | undefined {
      if (icon === undefined || !STANDARD_STOCK.includes(icon)) {
        return undefined;
      }
      return (this.thisPlayer as unknown as Record<string, number>)[icon];
    },
    // ── spend-heat helpers ──────────────────────────────────────────────
    heatStockFor(c: ComposerChoice): number {
      const plan = spendHeatPlan(c.input);
      return plan !== undefined ? spendHeatStock(plan, this.floatersFor(c.id)) : 0;
    },
    floatersFor(id: string): number {
      return this.floaters[id] ?? 0;
    },
    adjustFloaters(c: ComposerChoice, step: number): void {
      const plan = spendHeatPlan(c.input);
      if (plan === undefined) {
        return;
      }
      const next = Math.min(plan.floaterMax, Math.max(plan.minFloaters, this.floatersFor(c.id) + step));
      if (!spendHeatValid(plan, next)) {
        return;
      }
      this.floaters[c.id] = next;
      this.captureFor(c, spendHeatResponse(plan, next));
    },
    // ── payment helpers ─────────────────────────────────────────────────
    paymentStateFor(c: ComposerChoice) {
      const model = c.input as SelectPaymentModel;
      const lanes = paymentLanes(model, this.thisPlayer);
      const counts = this.payCounts[c.id] ?? {};
      const mcAvail = megacreditsAvailable(this.thisPlayer);
      const payment = paymentFromCounts(model.amount, lanes, counts, mcAvail);
      const total = paymentTotal(model.amount, lanes, counts, mcAvail);
      return {lanes, counts, mc: payment.megacredits, total, cost: model.amount, covers: paymentCovers(model.amount, lanes, counts, mcAvail), overpay: Math.max(0, total - model.amount)};
    },
    paymentSummary(c: ComposerChoice): string {
      if (this.paymentCaptureOf(c) === undefined) {
        return '';
      }
      const state = this.paymentStateFor(c);
      const parts: Array<string> = [];
      if (state.mc > 0) {
        parts.push(`${state.mc} M€`);
      }
      for (const lane of state.lanes) {
        const n = state.counts[lane.unit] ?? 0;
        if (n > 0) {
          parts.push(`${n} ${translateText(this.laneLabel(lane.unit))}`);
        }
      }
      return parts.join(' + ');
    },
    /** M€-value overpaid by the captured mix (unavoidable rate remainder), 0 when
     *  exact / not yet captured — drives the orange overpay badge on the row. */
    paymentOverpayOf(c: ComposerChoice): number {
      return this.paymentCaptureOf(c) === undefined ? 0 : this.paymentStateFor(c).overpay;
    },
    paymentCaptureOf(c: ComposerChoice): unknown {
      if (c.scope === 'option') {
        return this.capturedOption;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] : this.captured[c.index];
    },
    adjustPayment(c: ComposerChoice, laneIdx: number, step: number, toMax = false): void {
      const model = c.input as SelectPaymentModel;
      const lanes = paymentLanes(model, this.thisPlayer);
      const lane = lanes[laneIdx];
      if (lane === undefined) {
        return;
      }
      const counts = {...(this.payCounts[c.id] ?? {})};
      const cap = laneCap(model.amount, lane);
      counts[lane.unit] = toMax ? cap : Math.min(cap, Math.max(0, (counts[lane.unit] ?? 0) + step));
      this.payCounts[c.id] = counts;
      const mcAvail = megacreditsAvailable(this.thisPlayer);
      this.captureFor(c, paymentCovers(model.amount, lanes, counts, mcAvail) ?
        {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mcAvail)} : undefined);
    },
    laneLabel(unit: string): string {
      const labels: Record<string, string> = {
        megacredits: 'Megacredits', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy',
        heat: 'Heat', microbes: 'Microbes', floaters: 'Floaters', seeds: 'Seeds', auroraiData: 'Data',
        graphene: 'Graphene', kuiperAsteroids: 'Asteroids', spireScience: 'Science',
      };
      return labels[unit] ?? unit;
    },
    // ── pick rows ───────────────────────────────────────────────────────
    chosenLabel(c: ComposerChoice): string {
      // A resolved MULTI-select hand pick shows the picked cards (first two
      // names + «+N»; an explicit empty answer reads «Выбрано: 0»).
      const multi = this.multiPicks[c.id];
      if (multi !== undefined && c.input.type === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
        if (multi.length === 0) {
          return `${translateText('Selected')}: 0`;
        }
        const names = multi.slice(0, 2).map((n) => translateCardName(n as CardName)).join(', ');
        return multi.length > 2 ? `${names} +${multi.length - 2}` : names;
      }
      const pick = this.picks[c.id];
      if (pick === undefined) {
        return '';
      }
      if (c.input.type === 'card') {
        return translateText(pick);
      }
      if (c.input.type === 'player') {
        return this.playerName(pick);
      }
      if (c.input.type === 'or') {
        const opt = (c.input as OrOptionsModel).options[Number(pick)];
        return opt !== undefined ? textOf(opt.title) : '';
      }
      return pick;
    },
    chosenImpact(c: ComposerChoice): string {
      // Multi-select payout (generic revealGain metadata).
      const multi = this.multiPicks[c.id];
      const gain = c.multiSelect?.revealGain;
      if (multi !== undefined && gain !== undefined) {
        return `+${multi.length * gain.amount}`;
      }
      if (c.input.type !== 'card' || c.amount === undefined) {
        return '';
      }
      const card = (c.input as SelectCardModel).cards.find((cd) => cd.name === this.picks[c.id]);
      if (card === undefined) {
        return '';
      }
      const from = card.resources ?? 0;
      return `${from} → ${Math.max(0, from + c.amount)}`;
    },
    // ── input routing (foundation: SEMANTIC actions, no raw button names) ──
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        (this.$refs.scroll as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(Math.sign(intent.dy) * 40);
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action === undefined) {
        return;
      }
      if (this.sub !== undefined) {
        this.onSubPress(action);
        return;
      }
      this.onMainPress(action);
    },
    onNav(dir: NavDirection): void {
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? (this.paymentView?.lanes.length ?? 0) : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + (dir === 'up' ? -1 : 1)));
          this.scrollFocused();
        } else if (this.sub.kind === 'payment') {
          const c = this.subChoice;
          if (c !== undefined) {
            this.adjustPayment(c, this.sub.index, dir === 'left' ? -1 : 1);
          }
        }
        return;
      }
      if (dir === 'up' || dir === 'down') {
        // The focus walk includes the CTA row (index items.length).
        this.focusIdx = Math.min(this.ctaIndex, Math.max(0, this.focusIdx + (dir === 'up' ? -1 : 1)));
        this.scrollFocused();
        return;
      }
      const item = this.focusedItem;
      if (item?.kind === 'choice' && item.choice.kind === 'amount') {
        this.setAmount(item.choice, this.amountFor(item.choice.id) + (dir === 'left' ? -1 : 1));
      } else if (item?.kind === 'choice' && item.choice.kind === 'spendHeat') {
        this.adjustFloaters(item.choice, dir === 'left' ? -1 : 1);
      }
    },
    // MAIN state: A(primary) select/open, X(inspect) submits the action, B back,
    // LB/RB(prev/nextSection) step amount/floaters, RT(nextTab) = max.
    onMainPress(action: ConsoleAction): void {
      const item = this.focusedItem;
      switch (action) {
      case 'primary':
        if (this.ctaFocused || item === undefined) {
          this.submit();
        } else if (item.kind === 'branch') {
          this.selectBranch(item.pos);
        } else {
          this.openChoice(item.choice);
        }
        return;
      case 'inspect':
        this.submit();
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'prevSection':
      case 'nextSection': {
        const step = action === 'prevSection' ? -1 : 1;
        if (item?.kind === 'choice' && item.choice.kind === 'amount') {
          this.setAmount(item.choice, this.amountFor(item.choice.id) + step);
        } else if (item?.kind === 'choice' && item.choice.kind === 'spendHeat') {
          this.adjustFloaters(item.choice, step);
        }
        return;
      }
      case 'nextTab':
        if (item?.kind === 'choice' && item.choice.kind === 'amount') {
          this.setAmount(item.choice, this.amountModel(item.choice).max);
        }
        return;
      default:
        return;
      }
    },
    openChoice(c: ComposerChoice): void {
      // A hand-card pick (Self-Replicating Robots' link branch: every candidate
      // — eligible AND greyed-with-reason — is a card in hand) routes to the
      // HAND SECTION's premium pick mode; a TABLEAU pick (a resource target on
      // an own played card, AND Viron's repeat-action pick over played action
      // cards) routes to the «Разыграно» view's pick mode — never a flat name
      // list. Only the hosted-cards pick (SRR targetCards — in neither zone)
      // keeps the inline sub-list.
      if (c.kind === 'card' && c.repeatAction !== true &&
          isHandCardSelection(c.input as SelectCardModel, this.handNamesSet)) {
        this.openHandPick(c);
        return;
      }
      if (c.kind === 'card' &&
          isCardSelectionWithin(c.input as SelectCardModel, this.tableauNamesSet)) {
        this.openTableauPick(c);
        return;
      }
      if (c.kind === 'card' || c.kind === 'player' || c.kind === 'or') {
        this.sub = {kind: 'list', choiceId: c.id, index: 0};
      } else if (c.kind === 'payment') {
        this.sub = {kind: 'payment', choiceId: c.id, index: 0};
      }
      // amount / spendHeat adjust inline (A is a no-op on them).
    },
    /**
     * Hand a TABLEAU card pick to the «Разыграно» view's pick mode: the
     * candidates physically lift off their real table slots (face-down events
     * off the pile, flipping open), the player picks on the real card, the
     * cards fly home and the capture lands back here. A Viron repeat-action
     * pick resolves through the SAME surface — the chosen action card hands
     * off via `repeat-pick` (the composer then re-opens FOR that action).
     */
    openTableauPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const selectable = model.cards.map((cd) => cd.name);
      const disabledNames = (model.disabledCards ?? []).map((d) => d.name);
      const faceDown = [...selectable, ...disabledNames]
        .filter((n) => getCard(n)?.type === CardType.EVENT);
      const repeat = c.repeatAction === true;
      enterPlayedTableauPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Select',
        selectable,
        disabled: disabledNames,
        reasons,
        min: 1,
        max: 1,
        selected: !repeat && this.picks[c.id] !== undefined ? [this.picks[c.id] as CardName] : [],
        faceDown,
      }, (cards) => {
        if (cards.length === 0) {
          return;
        }
        if (repeat) {
          this.$emit('repeat-pick', {chosenCard: cards[0]});
          return;
        }
        // Re-locate by id — the preview may have refreshed under the pick.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        this.picks[cur.id] = cards[0];
        this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        this.scrollFocused();
      });
    },
    /** Hand a hand-card pick to the HAND SECTION (consoleHandPick bridge): the
     *  shell hides the Action Center (v-show — every capture survives), the
     *  player picks on the real cards, the result captures back here. A re-open
     *  (A = «Изменить») pre-seeds the previous selection. */
    openHandPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const multi = (model.max ?? 1) > 1;
      const prior = multi ?
        [...(this.multiPicks[c.id] ?? [])] as Array<CardName> :
        (this.picks[c.id] !== undefined ? [this.picks[c.id] as CardName] : []);
      const gain = c.multiSelect?.revealGain;
      enterConsoleHandPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Select',
        selectable: model.cards.map((cd) => cd.name),
        reasons,
        min: model.min ?? 1,
        max: model.max ?? 1,
        selected: prior,
        gainPerCard: gain !== undefined ? {icon: gain.resource, amount: gain.amount} : undefined,
      }, (cards) => {
        // Re-locate by id — the preview may have refreshed under the pick.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        if (multi) {
          this.multiPicks[cur.id] = [...cards];
          this.picks[cur.id] = String(cards.length);
          this.captureFor(cur, {type: 'card', cards: [...cards]});
        } else if (cards.length > 0) {
          this.picks[cur.id] = cards[0];
          this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        }
        this.scrollFocused();
      });
    },
    selectBranch(pos: number): void {
      if (this.selectedPos === pos || !this.branches[pos]?.available) {
        return;
      }
      this.selectedPos = pos;
      // Branch-specific captures reset (desktop selectBranch parity); the
      // preSteps stay captured (branch-independent).
      this.captured = {};
      this.capturedOption = undefined;
      this.picks = {};
      this.multiPicks = {};
      this.amounts = {};
      for (const c of this.branchChoiceList) {
        this.seedChoice(c);
      }
    },
    // SUB state (a pick list / payment): A(primary) pick/close, X(inspect) zoom
    // the list card, B back, LB/RB(prev/nextSection) adjust payment, RT max.
    onSubPress(action: ConsoleAction): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      switch (action) {
      case 'primary':
        if (sub.kind === 'payment') {
          if (this.paymentView?.covers === true) {
            this.sub = undefined;
          }
          return;
        }
        this.pickListItem(sub.index);
        return;
      case 'inspect':
        if (sub.kind === 'list') {
          this.inspectListItem(sub.index);
        }
        return;
      case 'back':
        this.sub = undefined;
        return;
      case 'prevSection':
      case 'nextSection':
        if (sub.kind === 'payment' && this.subChoice !== undefined) {
          this.adjustPayment(this.subChoice, sub.index, action === 'prevSection' ? -1 : 1);
        }
        return;
      case 'nextTab':
        if (sub.kind === 'payment' && this.subChoice !== undefined) {
          this.adjustPayment(this.subChoice, sub.index, 0, true);
        }
        return;
      default:
        return;
      }
    },
    pickListItem(index: number): void {
      const sub = this.sub;
      const c = this.subChoice;
      if (sub === undefined || sub.kind !== 'list' || c === undefined) {
        return;
      }
      const item = this.listItems[index];
      if (item === undefined || item.disabled) {
        return;
      }
      if (c.repeatAction === true && item.card !== undefined) {
        this.$emit('repeat-pick', {chosenCard: item.card.name});
        return;
      }
      if (c.input.type === 'card' && item.card !== undefined) {
        this.picks[c.id] = item.card.name;
        this.captureFor(c, {type: 'card', cards: [item.card.name]});
      } else if (c.input.type === 'player' && item.color !== undefined) {
        this.picks[c.id] = item.color;
        this.captureFor(c, {type: 'player', player: item.color});
      } else if (c.input.type === 'or') {
        const optIdx = Number(item.key.slice(1));
        this.picks[c.id] = String(optIdx);
        this.captureFor(c, {type: 'or', index: optIdx, response: {type: 'option'}});
      }
      this.sub = undefined;
    },
    inspectListItem(index: number): void {
      const item = this.listItems[index];
      if (item?.card === undefined) {
        return;
      }
      const cards = this.listItems.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
      const at = cards.findIndex((cd) => cd.name === item.card?.name);
      // Target options are TEXT rows, not card tiles → TEXTUAL inspector.
      openConsoleCardZoom(cards, Math.max(0, at), undefined, undefined, {contextLabel: 'Card actions', origin: {kind: 'textual'}});
    },
    submit(): void {
      const branch = this.selectedBranch;
      if (branch === undefined || !this.canConfirm || this.submitting || this.preview === undefined) {
        return;
      }
      this.submitting = true;
      this.$emit('confirm', {
        branchIndex: branch.index,
        preResponses: orderedPreResponses(this.preview, this.capturedPre),
        optionResponse: this.capturedOption,
        stepResponses: orderedStepResponses(branch, this.captured),
      });
    },
    scrollFocused(): void {
      void this.$nextTick(() => {
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        // Foundation: keep the focused row visible via the ConsoleScrollArea's
        // own viewport math (never scrollIntoView — it can walk outer scroll
        // ancestors).
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
  },
});
</script>
