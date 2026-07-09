<template>
  <div class="con-composer con-composer--play" role="dialog" :aria-label="titleText">
    <div class="con-composer__backdrop" aria-hidden="true"></div>

    <div class="con-composer__panel con-composer__panel--play">
      <!-- ── Header ────────────────────────────────────────────────── -->
      <div class="con-composer__kicker">
        <span class="con-composer__kicker-mark" aria-hidden="true">◈</span>
        <span>{{ $t('Play project card') }}</span>
      </div>
      <div class="con-composer__name">{{ titleText }}</div>
      <div class="con-composer__playhead">
        <span class="con-composer__paycost">
          {{ $t('Cost') }}: <b>{{ cost }}</b> <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
        </span>
        <span class="con-composer__paytag" :class="statusClass">{{ $t(statusLabel) }}</span>
      </div>

      <!-- ── Two columns: card · composer ──────────────────────────── -->
      <div class="con-composer__playmain">
        <div class="con-composer__playcard">
          <Card v-if="card !== undefined" :card="card" :key="card.name" />
        </div>

        <div class="con-composer__playright">
          <div class="con-composer__scroll" ref="scroll">
            <div v-if="loading" class="con-composer__loading">{{ $t('Loading') }}…</div>

            <!-- ── SUB-STATE: a list pick (card / player / or). ──────── -->
            <template v-else-if="sub !== undefined && sub.kind === 'list'">
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
                <span v-if="item.meta !== ''" class="con-composer__opt-meta">{{ item.meta }}</span>
                <span v-if="item.disabled && item.reason !== ''" class="con-composer__opt-reason">✕ {{ item.reason }}</span>
                <span v-else-if="item.chosen" class="con-composer__opt-check" aria-hidden="true">✓</span>
              </div>
            </template>

            <!-- ── SUB-STATE: payment lanes. ─────────────────────────── -->
            <template v-else-if="sub !== undefined && sub.kind === 'payment'">
              <div class="con-composer__sub-title">{{ $t('Payment') }}</div>
              <div v-for="(lane, i) in payLanes" :key="lane.unit"
                   class="con-composer__lane"
                   :class="{'con-composer__lane--focused': sub.index === i}"
                   :ref="sub.index === i ? 'focusedEl' : undefined">
                <i class="con-composer__lane-icon" :class="iconClass(lane.unit)" aria-hidden="true"></i>
                <span class="con-composer__lane-name">{{ $t(laneLabel(lane.unit)) }}</span>
                <span class="con-composer__lane-rate" v-if="lane.rate > 1">×{{ lane.rate }}</span>
                <span class="con-composer__lane-value"><b>{{ payCount(lane.unit) }}</b><i>/ {{ lane.available }}</i></span>
              </div>
              <div class="con-composer__lane con-composer__lane--auto">
                <i class="con-composer__lane-icon" :class="iconClass('megacredits')" aria-hidden="true"></i>
                <span class="con-composer__lane-name">{{ $t('Megacredits') }}</span>
                <span class="con-composer__lane-value"><b>{{ payAutoMc }}</b><i>{{ $t('auto') }}</i></span>
              </div>
              <div class="con-composer__paytotal" :class="{'con-composer__paytotal--ok': paymentReady}">
                {{ $t('Total') }}: {{ payTotal }} / {{ cost }} M€
              </div>
            </template>

            <!-- ── REVIEW: result + decisions. ───────────────────────── -->
            <template v-else>
              <!-- RESULT: variants (selectable) or the single immediate effect. -->
              <div class="con-composer__sub-title">{{ $t('Result') }}</div>
              <template v-if="hasVariants">
                <div v-for="row in variantRows" :key="row.id"
                     class="con-composer__variant"
                     :class="{
                       'con-composer__variant--focused': focusIdx === row.i,
                       'con-composer__variant--selected': selectedPos === row.pos,
                       'con-composer__variant--off': !branches[row.pos].available,
                     }"
                     :ref="focusIdx === row.i ? 'focusedEl' : undefined">
                  <div class="con-composer__variant-head">
                    <span class="con-composer__variant-title">{{ branchTitle(branches[row.pos]) }}</span>
                    <span v-if="selectedPos === row.pos" class="con-composer__variant-check" aria-hidden="true">✓</span>
                  </div>
                  <div class="con-composer__variant-chips">
                    <ActionEffectChip v-for="(eff, k) in branches[row.pos].effects" :key="k" :effect="eff" />
                  </div>
                  <div v-if="!branches[row.pos].available" class="con-composer__variant-reason">
                    ✕ {{ branchReasonText(branches[row.pos]) }}
                  </div>
                </div>
              </template>
              <div v-else-if="immediateEffects.length > 0" class="con-composer__hero-chips con-composer__result-chips">
                <ActionEffectChip v-for="(eff, k) in immediateEffects" :key="k" :effect="eff" />
              </div>

              <!-- Derived result categories — the block is NEVER empty. A tag
                   row is "label: [inline chips]"; a VP row is "label: +N". -->
              <div v-for="(sec, i) in resultSections" :key="'r' + i" class="con-composer__rescat" :class="'con-composer__rescat--' + sec.kind">
                <span class="con-composer__rescat-glyph" aria-hidden="true">{{ rescatGlyph(sec.kind) }}</span>
                <span class="con-composer__rescat-text"
                >{{ $t(sec.text) }}<template v-if="sec.kind === 'vp'">: <b>{{ vpDetail(sec) }}</b></template
                ><template v-else-if="sec.kind === 'tags'">:</template></span>
                <span v-if="sec.kind === 'tags' && sec.tags !== undefined" class="con-composer__rescat-tags">
                  <span v-for="(tag, t) in sec.tags" :key="t" class="resource-tag con-composer__rescat-tag" :class="'tag-' + tag" aria-hidden="true"></span>
                </span>
              </div>

              <!-- SILENT-LOSS warnings (verbatim desktop parity). -->
              <div v-for="(w, i) in warningSteps" :key="'w' + i" class="con-composer__warn">
                <span aria-hidden="true">⚠</span>
                <i v-if="w.icon !== ''" class="con-composer__rescat-glyph" :class="w.icon" aria-hidden="true"></i>
                <span>{{ w.text }}</span>
              </div>

              <!-- Honest post-confirm follow-up (board placement / notes). -->
              <div v-for="(n, i) in followUpNotes" :key="'n' + i" class="con-composer__next">
                <span aria-hidden="true">›</span><span>{{ n }}</span>
              </div>

              <!-- DECISIONS: the pre-collected step rows. -->
              <div v-if="stepRows.length > 0" class="con-composer__sub-title con-composer__sub-title--spaced">{{ $t('Choose before playing') }}</div>
              <div v-for="row in stepRows" :key="row.id"
                   class="con-composer__row"
                   :class="{'con-composer__row--focused': focusIdx === row.i, 'con-composer__row--missing': stepMissing(row.choice)}"
                   :ref="focusIdx === row.i ? 'focusedEl' : undefined">
                <template v-if="row.choice.kind === 'amount'">
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__stepper">
                    <i v-if="amountIcon(row.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(row.choice))" aria-hidden="true"></i>
                    <span class="con-composer__stepper-value">{{ amountFor(row.choice.id) }}</span>
                    <span class="con-composer__stepper-range">{{ amountModel(row.choice).min }} – {{ amountModel(row.choice).max }}</span>
                  </div>
                  <div v-if="amountResultLine(row.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(row.choice) }}</div>
                </template>
                <template v-else-if="row.choice.kind === 'spendHeat'">
                  <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
                  <div class="con-composer__stepper">
                    <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                    <span class="con-composer__stepper-value">{{ floatersFor(row.choice.id) }}</span>
                    <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
                  </div>
                  <div class="con-composer__row-note">{{ $t('Heat') }}: {{ heatStockFor(row.choice) }}</div>
                </template>
                <template v-else>
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__row-value">
                    <span v-if="chosenLabel(row.choice) !== ''">{{ chosenLabel(row.choice) }}</span>
                    <span v-else class="con-composer__row-empty">{{ pickPlaceholder(row.choice) }}…</span>
                    <span v-if="chosenImpact(row.choice) !== ''" class="con-composer__row-impact">{{ chosenImpact(row.choice) }}</span>
                  </div>
                </template>
              </div>

              <!-- PAYMENT — an INFO panel (resource chips + было → стало), NOT a
                   button. One unified layout for auto / quick-adjust / complex:
                   the SINGLE-alt case gets inline LB/RB pills on its chip; M€ is
                   badged «авто»; LT opens the full editor when configurable. -->
              <div class="con-composer__pay">
                <div class="con-composer__pay-head">
                  <span class="con-composer__pay-title">{{ $t('Payment') }}</span>
                  <span class="con-composer__pay-cost">{{ $t('Cost') }}: <b>{{ cost }}</b></span>
                  <span v-if="paymentView.configurable" class="con-composer__pay-lt">
                    <GamepadGlyph control="triggerL" /><span>{{ $t('Configure payment') }}</span>
                  </span>
                </div>
                <div class="con-composer__pay-rows">
                  <div v-for="(chip, k) in paymentView.chips" :key="k"
                       class="con-composer__pay-row" :class="{'con-composer__pay-row--adjustable': chip.isAdjustable}">
                    <ActionEffectChip :effect="chip.effect" />
                    <span v-if="chip.isAutoBalanced" class="con-composer__pay-badge">{{ $t('auto') }}</span>
                    <span v-if="chip.isAdjustable" class="con-composer__pay-pills">
                      <span class="con-composer__pay-pill" :class="{'con-composer__pay-pill--off': !chip.canDecrease}"><GamepadGlyph control="bumperL" /><span>−1</span></span>
                      <span class="con-composer__pay-pill" :class="{'con-composer__pay-pill--off': !chip.canIncrease}"><GamepadGlyph control="bumperR" /><span>+1</span></span>
                    </span>
                    <span v-if="chip.isAdjustable" :key="'flash' + payFlashNonce" class="con-composer__pay-flash" aria-hidden="true"></span>
                  </div>
                  <span v-if="paymentView.chips.length === 0" class="con-composer__pay-free">{{ cost === 0 ? $t('Free') : (cost + ' M€') }}</span>
                </div>
                <div v-if="!paymentReady" class="con-composer__pay-short">
                  <span aria-hidden="true">⚠</span> {{ $t('Not enough resources') }}<template v-if="paymentView.deficit > 0">:
                    <i class="resource_icon resource_icon--megacredits con-composer__pay-short-icon" aria-hidden="true"></i> {{ paymentView.deficit }}</template>
                </div>
              </div>

              <!-- The single big CTA — a STATUS strip driven by the primary action
                   (A plays / leads to the choice / shows the blocker). Not focusable. -->
              <div class="con-composer__cta" :class="{'con-composer__cta--off': !ctaReady}">
                <span class="con-composer__cta-label">{{ $t(ctaLabel) }}</span>
              </div>
            </template>
          </div>

          <!-- ── The ONE bottom command bar ──────────────────────────── -->
          <footer class="con-composer__foot" aria-hidden="true">
            <span v-for="(hint, i) in footHints" :key="i"
                  class="con-composer__foot-item"
                  :class="{'con-composer__foot-item--off': hint.enabled === false}">
              <GamepadGlyph :control="hint.control" />
              <GamepadGlyph v-if="hint.control2 !== undefined" :control="hint.control2" />
              <span>{{ $t(hint.label) }}</span>
            </span>
          </footer>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAY-CARD CONFIRM — the console-native PRE-SUBMIT composer for
 * playing a project card from hand. Desktop-parity contract with
 * HandCardPaymentContent + PlayerHome.submitPlayCardBatch: EVERY interactive
 * choice is made HERE, before the one final submit — the card's PAYMENT, the
 * on-play BRANCH variant (a `behavior.or` like Artificial Photosynthesis), the
 * branch's direct optionInput, and every simple input step (card / player /
 * amount / or). Board placements / multi-card overlay picks / notes stay a
 * post-submit native follow-up — the documented exception, shown honestly.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` /
 * `consolePlayCardComposer.ts` builders; the parent assembles the byte-
 * identical batch (`buildPlayCardBatch`). The «РЕЗУЛЬТАТ» block is guaranteed
 * non-empty by `consolePlayCardResult.ts` (immediate effects → new action →
 * permanent effect → VP → tags → honest fallback).
 *
 * Control grammar (hints ONLY in the bottom bar): ↑↓ = navigate variants +
 * step picks (moving onto a variant SELECTS it) · ←→ = adjust a focused amount ·
 * LB/RB = a focused amount stepper, ELSE the inline payment quick-adjust (the
 * simple one-alt-resource case — M€ auto-rebalances) · RT = MAX · A = the ONE
 * smart primary action (plays when ready, else leads to the first unresolved
 * choice) · LT = open the full payment editor · X = inspect the card fullscreen ·
 * B = cancel. Primary action = `computePrimaryAction`; payment = `buildPaymentView`
 * (all rules there — the component never re-derives payment math).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {SelectProjectCardToPlayModel, SelectAmountModel, SelectCardModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {Tag} from '@/common/cards/Tag';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Payment} from '@/common/inputs/Payment';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardHasAction} from '@/client/components/actions/actionExtraction';
import {cardHasPassiveEffect} from '@/client/components/effects/effectExtraction';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {
  ComposerChoice, preChoices, branchChoices,
  spendHeatPlan, spendHeatStock, spendHeatResponse, spendHeatValid,
  orderedPreResponses, orderedStepResponses,
} from '@/client/console/consoleActionComposer';
import {
  playComposerFootHints, FootHint, PlayFocusKind,
  computePrimaryAction, PrimaryActionState, buildPaymentView, PlayPaymentView,
} from '@/client/console/consolePlayCardComposer';
import {
  autoMegacredits, initialCounts, laneCap, megacreditsAvailable,
  paymentCovers, paymentFromCounts, PaymentLane, paymentLanes, paymentTotal, projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {derivePlayResultSections, isFallbackOnlyResult, PlayResultSection} from '@/client/console/consolePlayCardResult';

/**
 * The NAVIGABLE pre-select rows — variants + collectable step picks ONLY. Payment
 * and the play CTA are NOT rows: A is a smart global primary action (it plays /
 * advances / opens payment from anywhere) and LT opens the payment lanes, so
 * neither needs to be a focus target competing with the CTA.
 */
type PlayRow =
  | {i: number, id: string, kind: 'variant', pos: number}
  | {i: number, id: string, kind: 'step', choice: ComposerChoice};

type SubState = {kind: 'list', choiceId: string, index: number} | {kind: 'payment', index: number};

type ListItem = {key: string, label: string, meta: string, disabled: boolean, reason: string, chosen: boolean, color?: string, card?: CardModel};

/**
 * The implicit "just play it" branch used when the preview has NO branches (a
 * card with no on-play choice, or a preview fetch that failed) — so the card is
 * always playable with a bare `{type:'projectCard'}` submit, exactly the old
 * graceful fallback. Any real on-play choice arrives as a native follow-up.
 */
const IMPLICIT_BRANCH: ActionPreviewBranch = {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []};

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

/** A step the composer PRE-COLLECTS as a row (single card / player / or / amount /
 *  spendHeat). Multi-select + repeat-action stay a post-submit follow-up. */
function isPreCollectable(c: ComposerChoice): boolean {
  if (c.repeatAction === true) {
    return false;
  }
  if (c.input.type === 'card') {
    // A multi-select card (max > 1 — e.g. Public Plans "reveal any number") is a
    // documented post-submit follow-up, not an inline row.
    return (c.input as SelectCardModel).max <= 1;
  }
  return c.kind === 'amount' || c.kind === 'player' || c.kind === 'or' || c.kind === 'spendHeat';
}

export default defineComponent({
  name: 'ConsolePlayCardConfirm',
  components: {Card, GamepadGlyph, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    cardName: {type: String as PropType<CardName>, required: true},
    input: {type: Object as PropType<SelectProjectCardToPlayModel>, required: true},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      picks: {} as Record<string, string>,
      payCounts: {} as Partial<Record<SpendableResource, number>>,
      focusIdx: 0,
      sub: undefined as SubState | undefined,
      submitting: false,
      /** Bumped on each quick-adjust to re-trigger the one-shot chip pulse. */
      payFlashNonce: 0,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    card(): CardModel | undefined {
      return this.input.cards.find((c) => c.name === this.cardName);
    },
    titleText(): string {
      return translateText(this.cardName);
    },
    cost(): number {
      return this.card?.calculatedCost ?? 0;
    },
    // ── payment (the desktop project-card rules, via paymentPlan) ────────
    paymentPrompt() {
      let tags: ReadonlyArray<Tag> = [];
      try {
        tags = getCard(this.cardName)?.tags ?? [];
      } catch (err) {
        tags = [];
      }
      return projectCardPaymentPrompt(this.cost, tags, this.input.paymentOptions ?? {}, this.thisPlayer.lastCardPlayed, this.card?.reserveUnits);
    },
    payLanes(): Array<PaymentLane> {
      return paymentLanes(this.paymentPrompt, this.thisPlayer);
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.thisPlayer);
    },
    payAutoMc(): number {
      return autoMegacredits(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    payTotal(): number {
      return paymentTotal(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    paymentReady(): boolean {
      return paymentCovers(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    /** The full payment view-model — chips + inline quick-adjust eligibility.
     *  The UI renders + calls actions; ALL rules stay in `buildPaymentView`. */
    paymentView(): PlayPaymentView {
      const p = this.thisPlayer as unknown as Record<string, number>;
      return buildPaymentView({
        cost: this.cost,
        lanes: this.payLanes,
        counts: this.payCounts,
        mcAvailable: this.megacreditsOnHand,
        stock: {megacredits: p.megacredits, steel: p.steel, titanium: p.titanium, plants: p.plants, energy: p.energy, heat: p.heat},
      });
    },
    /** The single adjustable chip (quick-adjust), when eligible. */
    quickAdjustChip() {
      return this.paymentView.chips.find((c) => c.isAdjustable);
    },
    // ── branches / choices ──────────────────────────────────────────────
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    hasVariants(): boolean {
      return this.branches.length > 1;
    },
    selectedBranch(): ActionPreviewBranch | undefined {
      if (this.selectedPos !== undefined) {
        return this.branches[this.selectedPos];
      }
      if (this.branches.length === 1) {
        // A single-branch card has no variant pick — the lone branch is it.
        return this.branches[0];
      }
      // No branches (no on-play choice, or a failed/absent preview) → the card
      // still plays; the implicit branch carries the bare submit.
      return this.branches.length === 0 ? IMPLICIT_BRANCH : undefined;
    },
    immediateEffects(): ReadonlyArray<ActionEffect> {
      const b = this.selectedBranch;
      if (b === undefined) {
        return [];
      }
      const out: Array<ActionEffect> = [...b.effects];
      if (b.reveal !== undefined) {
        out.push(b.reveal.reward);
      }
      return out;
    },
    allChoices(): ReadonlyArray<ComposerChoice> {
      return [...preChoices(this.preview), ...branchChoices(this.selectedBranch)];
    },
    stepChoices(): ReadonlyArray<ComposerChoice> {
      return this.allChoices.filter(isPreCollectable);
    },
    followUpChoices(): ReadonlyArray<ComposerChoice> {
      return this.allChoices.filter((c) => !isPreCollectable(c));
    },
    rows(): ReadonlyArray<PlayRow> {
      const out: Array<PlayRow> = [];
      if (this.hasVariants) {
        this.branches.forEach((_b, pos) => out.push({i: 0, id: 'variant#' + pos, kind: 'variant', pos}));
      }
      for (const c of this.stepChoices) {
        out.push({i: 0, id: 'step#' + c.id, kind: 'step', choice: c});
      }
      return out.map((r, i) => ({...r, i}));
    },
    variantRows(): ReadonlyArray<PlayRow & {kind: 'variant'}> {
      return this.rows.filter((r): r is PlayRow & {kind: 'variant'} => r.kind === 'variant');
    },
    stepRows(): ReadonlyArray<PlayRow & {kind: 'step'}> {
      return this.rows.filter((r): r is PlayRow & {kind: 'step'} => r.kind === 'step');
    },
    focusedRow(): PlayRow | undefined {
      return this.focusIdx >= 0 ? this.rows[this.focusIdx] : undefined;
    },
    /** The ONE smart primary action — see computePrimaryAction. Focus-independent. */
    primaryActionState(): PrimaryActionState {
      const b = this.selectedBranch;
      const branchSelectable = b !== undefined && b.available;
      const firstMissing = this.rows.findIndex((r) => r.kind === 'step' && this.stepMissing(r.choice));
      return computePrimaryAction({
        branchSelectable,
        paymentReady: this.paymentReady,
        firstUnresolvedStepRowIndex: firstMissing >= 0 ? firstMissing : undefined,
      });
    },
    // ── result sections (never empty) ───────────────────────────────────
    resultSections(): ReadonlyArray<PlayResultSection> {
      const meta = getCard(this.cardName);
      return derivePlayResultSections(
        {
          tags: meta?.tags ?? [],
          hasAction: cardHasAction(this.cardName),
          hasEffect: cardHasPassiveEffect(this.cardName),
          victoryPoints: meta?.victoryPoints,
        },
        {hasImmediate: this.hasImmediateResult, hasFollowUp: this.followUpNotes.length > 0},
      );
    },
    hasImmediateResult(): boolean {
      return this.branches.some((b) => b.effects.length > 0 || b.reveal !== undefined);
    },
    warningSteps(): Array<{text: string, icon: string}> {
      const out: Array<{text: string, icon: string}> = [];
      for (const b of this.branches) {
        if (!b.available && b !== this.selectedBranch) {
          continue;
        }
        for (const s of b.steps) {
          if (s.kind === 'note' && s.noteKind === 'warning') {
            out.push({
              text: s.text !== undefined ? textOf(s.text) : translateText('No eligible card — this resource is not added.'),
              icon: s.resource !== undefined ? iconClassFor(s.resource) : '',
            });
          }
        }
      }
      return out;
    },
    followUpNotes(): Array<string> {
      const b = this.selectedBranch;
      if (b === undefined) {
        return [];
      }
      const out: Array<string> = [];
      if (b.reveal !== undefined) {
        out.push(translateText('Next: reveal a card'));
      }
      for (const s of b.steps) {
        if (s.kind === 'boardPlacement') {
          out.push(translateText('Choose a location on the board'));
        } else if (s.kind === 'tabbedTargets') {
          out.push(translateText('Choose a target'));
        } else if (s.kind === 'note' && s.noteKind !== 'warning') {
          out.push(s.text !== undefined ? textOf(s.text) : translateText('Choose a target'));
        }
      }
      for (const c of this.followUpChoices) {
        const t = textOf(c.input.title);
        out.push(t !== '' ? t : translateText('Choose a target'));
      }
      return out;
    },
    // ── confirm gating ──────────────────────────────────────────────────
    canConfirm(): boolean {
      if (this.loading) {
        return false;
      }
      const b = this.selectedBranch;
      if (b === undefined || !b.available || !this.paymentReady) {
        return false;
      }
      if (this.preview !== undefined && !preChoices(this.preview).every((c) => this.capturedPre[c.index] !== undefined)) {
        return false;
      }
      if (b.optionInput !== undefined && this.capturedOption === undefined) {
        return false;
      }
      return b.steps.every((step, i) => {
        if (step.kind !== 'input') {
          return true;
        }
        // A multi-select card / repeat-action step is a post-submit follow-up —
        // not captured here (mirrors isPreCollectable).
        if (step.repeatAction === true || (step.input.type === 'card' && (step.input as SelectCardModel).max > 1)) {
          return true;
        }
        return this.captured[i] !== undefined;
      });
    },
    ctaReady(): boolean {
      return this.primaryActionState.kind === 'ready';
    },
    /** The big CTA strip label — the primary action in words. */
    ctaLabel(): string {
      const st = this.primaryActionState;
      switch (st.kind) {
      case 'ready': return 'Play card';
      case 'need-preselect': return 'Choose an option';
      case 'blocked-payment': return 'Not enough resources';
      case 'blocked-requirement': return st.reason;
      }
    },
    statusLabel(): string {
      const st = this.primaryActionState;
      switch (st.kind) {
      case 'ready': return 'Ready to play';
      case 'blocked-payment': return 'Not enough resources';
      case 'need-preselect': return 'Choice required';
      default: return 'Choice required';
      }
    },
    statusClass(): string {
      return this.ctaReady ? 'con-composer__paytag--ready' : 'con-composer__paytag--wait';
    },
    focusedKind(): PlayFocusKind {
      const row = this.focusedRow;
      if (row === undefined || row.kind !== 'step') {
        return row?.kind === 'variant' ? 'variant' : 'none';
      }
      if (row.choice.kind === 'amount') {
        return 'amount';
      }
      if (row.choice.kind === 'spendHeat') {
        return 'spendHeat';
      }
      return 'pick';
    },
    /** The A-button verb, from the primary state: "Play now" when ready, "Select"
     *  while it leads the player to an unresolved choice, disabled when blocked. */
    primaryFooter(): {label: string, enabled: boolean} {
      const st = this.primaryActionState;
      if (st.kind === 'ready') {
        return {label: 'Play now', enabled: true};
      }
      if (st.kind === 'need-preselect') {
        return {label: 'Select', enabled: true};
      }
      return {label: 'Play now', enabled: false};
    },
    footHints(): Array<FootHint> {
      // A focused amount/spend-heat stepper OWNS LB/RB; otherwise the inline
      // payment quick-adjust does (when eligible).
      const focusedStepper = this.focusedKind === 'amount' || this.focusedKind === 'spendHeat';
      const chip = this.quickAdjustChip;
      const quickAdjust = (!focusedStepper && this.paymentView.quickAdjustEligible && chip !== undefined) ?
        {canDecrease: chip.canDecrease, canIncrease: chip.canIncrease} : undefined;
      return playComposerFootHints({
        sub: this.sub === undefined ? 'none' : this.sub.kind,
        subIsCardList: this.subChoice?.input.type === 'card',
        hasRows: this.rows.length > 0,
        focusedKind: this.focusedKind,
        configurablePayment: this.paymentView.configurable,
        paymentReady: this.paymentReady,
        primaryLabel: this.primaryFooter.label,
        primaryEnabled: this.primaryFooter.enabled,
        quickAdjust,
      });
    },
    // ── sub-state derived views ─────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      if (this.sub === undefined || this.sub.kind !== 'list') {
        return undefined;
      }
      return this.stepChoices.find((c) => c.id === (this.sub as {choiceId: string}).choiceId);
    },
    subTitle(): string {
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    listItems(): ReadonlyArray<ListItem> {
      const c = this.subChoice;
      if (c === undefined) {
        return [];
      }
      if (c.input.type === 'card') {
        const model = c.input as SelectCardModel;
        const chosenName = this.picks[c.id];
        const items: Array<ListItem> = model.cards.map((card): ListItem => ({
          key: card.name,
          label: translateText(card.name),
          meta: card.resources !== undefined && card.resources > 0 ? `${card.resources}` : '',
          disabled: card.isDisabled === true,
          reason: card.isDisabled === true ? textOf(card.disabledReason) : '',
          chosen: chosenName === card.name,
          card,
        }));
        for (const card of model.disabledCards ?? []) {
          items.push({key: 'd' + card.name, label: translateText(card.name), meta: '', disabled: true, reason: textOf(card.disabledReason), chosen: false, card});
        }
        return items;
      }
      if (c.input.type === 'player') {
        const model = c.input as SelectPlayerModel;
        const chosen = this.picks[c.id];
        const items: Array<ListItem> = model.players.map((color): ListItem => ({
          key: color, label: this.playerName(color), meta: '', disabled: false, reason: '', chosen: chosen === color, color,
        }));
        for (const d of model.disabledPlayers ?? []) {
          items.push({key: 'd' + d.color, label: this.playerName(d.color), meta: '', disabled: true, reason: textOf(d.reason), chosen: false, color: d.color});
        }
        return items;
      }
      if (c.input.type === 'or') {
        const model = c.input as OrOptionsModel;
        const chosen = this.picks[c.id];
        return model.options.map((opt, i): ListItem => ({
          key: 'o' + i, label: textOf(opt.title), meta: '',
          disabled: opt.type !== 'option', reason: opt.type !== 'option' ? translateText('Unavailable right now') : '', chosen: chosen === String(i),
        }));
      }
      return [];
    },
  },
  watch: {
    cardName: {
      immediate: true,
      handler() {
        this.preview = undefined;
        this.loading = true;
        this.resetCaptures();
        this.payCounts = initialCounts(this.cost, this.payLanes, this.megacreditsOnHand);
        this.focusIdx = 0;
        this.fetchPreview();
      },
    },
    playerView() {
      this.submitting = false;
    },
  },
  methods: {
    iconClass(icon: string | undefined): string {
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    rescatGlyph(kind: string): string {
      switch (kind) {
      case 'action': return '⟳';
      case 'effect': return '✦';
      case 'vp': return '★';
      case 'tags': return '#';
      default: return '›';
      }
    },
    vpDetail(sec: PlayResultSection): string {
      return sec.variable === true ? translateText('depends on conditions') : (sec.detail ?? '');
    },
    fetchPreview(): void {
      const cardName = this.cardName;
      const url = apiUrl(paths.API_CARD_PLAY_PREVIEW) + '?id=' + encodeURIComponent(this.playerView.id) + '&card=' + encodeURIComponent(cardName);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (this.cardName === cardName) {
            this.preview = p as ActionPreview | undefined;
            this.loading = false;
            this.applyPreview();
          }
        })
        .catch(() => {
          if (this.cardName === cardName) {
            this.loading = false;
            this.applyPreview();
          }
        });
    },
    resetCaptures(): void {
      this.selectedPos = undefined;
      this.capturedPre = {};
      this.capturedOption = undefined;
      this.captured = {};
      this.amounts = {};
      this.floaters = {};
      this.picks = {};
      this.sub = undefined;
      this.submitting = false;
    },
    applyPreview(): void {
      // AUTO-SELECT the first available variant (desktop mirror + the "short
      // path" contract): a variant is ALWAYS visibly selected, so the card is
      // immediately playable and A plays it; the player changes it with ↑↓.
      const branches = this.branches;
      if (branches.length === 1) {
        this.selectedPos = 0;
      } else if (branches.length > 1) {
        const firstAvail = branches.findIndex((b) => b.available);
        this.selectedPos = firstAvail >= 0 ? firstAvail : undefined;
      }
      this.seedChoiceDefaults();
      this.focusIdx = this.firstActionableIndex();
      // Dev audit: a genuine preview gap (no immediate result, no follow-up) —
      // surface it once per load so it can be found and closed (audit contract).
      if (isFallbackOnlyResult(this.resultSections, {hasImmediate: this.hasImmediateResult, hasFollowUp: this.followUpNotes.length > 0})) {
        console.warn(`[console play] no computable preview for ${this.cardName} — showing fallback result`);
      }
    },
    /** The row to focus on open: the first UNRESOLVED step, else the first row
     *  (a variant), else none (a no-choice card — A just plays). */
    firstActionableIndex(): number {
      const rows = this.rows;
      if (rows.length === 0) {
        return -1;
      }
      const missing = rows.findIndex((r) => r.kind === 'step' && this.stepMissing(r.choice));
      return missing >= 0 ? missing : 0;
    },
    seedChoiceDefaults(): void {
      for (const c of this.stepChoices) {
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
      } else if (c.kind === 'card') {
        // A lone candidate auto-captures but stays VISIBLE as the chosen row.
        const model = c.input as SelectCardModel;
        const enabled = model.cards.filter((card) => card.isDisabled !== true);
        if (enabled.length === 1) {
          this.picks[c.id] = enabled[0].name;
          this.captureFor(c, {type: 'card', cards: [enabled[0].name]});
        }
      }
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
    stepMissing(c: ComposerChoice): boolean {
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── amount / spendHeat helpers ──────────────────────────────────────
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
    // ── pick rows ───────────────────────────────────────────────────────
    choiceTitle(c: ComposerChoice): string {
      const t = textOf(c.input.title);
      if (t !== '') {
        return t;
      }
      switch (c.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      case 'or': return translateText('Choose an option');
      default: return '';
      }
    },
    pickPlaceholder(c: ComposerChoice): string {
      switch (c.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      default: return translateText('Choose an option');
      }
    },
    chosenLabel(c: ComposerChoice): string {
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
    playerName(color: string): string {
      return this.playerView.players.find((pl) => pl.color === color)?.name ?? color;
    },
    branchTitle(b: ActionPreviewBranch): string {
      const t = textOf(b.title);
      return t !== '' ? t : translateText('Play card');
    },
    branchReasonText(b: ActionPreviewBranch): string {
      return b.unavailableReason !== undefined ? textOf(b.unavailableReason) : translateText('Unavailable right now');
    },
    laneLabel(unit: string): string {
      const labels: Record<string, string> = {
        megacredits: 'Megacredits', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy', heat: 'Heat',
        microbes: 'Microbes', floaters: 'Floaters', seeds: 'Seeds', auroraiData: 'Data', graphene: 'Graphene', kuiperAsteroids: 'Asteroids', spireScience: 'Science',
      };
      return labels[unit] ?? unit;
    },
    payCount(unit: SpendableResource): number {
      return this.payCounts[unit] ?? 0;
    },
    // ── input routing (the shell forwards every intent here) ────────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        const el = this.$refs.scroll as HTMLElement | undefined;
        if (el !== undefined) {
          el.scrollTop += Math.sign(intent.dy) * 40;
        }
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      if (this.sub !== undefined) {
        this.onSubPress(intent.button);
        return;
      }
      this.onReviewPress(intent.button);
    },
    onNav(dir: NavDirection): void {
      if (this.loading) {
        return;
      }
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? this.payLanes.length : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + (dir === 'down' ? 1 : -1)));
          this.scrollFocused();
        } else if (this.sub.kind === 'payment') {
          this.adjustLane(this.sub.index, dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.rows.length === 0) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = Math.min(this.rows.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        // Moving onto an available variant SELECTS it (focus = selection for the
        // radio-group of variants; the result recomputes live).
        const row = this.focusedRow;
        if (row?.kind === 'variant' && this.branches[row.pos].available) {
          this.setSelectedVariant(row.pos);
        }
        this.scrollFocused();
        return;
      }
      // Left/right adjust a focused inline stepper.
      const row = this.focusedRow;
      if (row?.kind === 'step' && row.choice.kind === 'amount') {
        this.setAmount(row.choice, this.amountFor(row.choice.id) + (dir === 'left' ? -1 : 1));
      } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
        this.adjustFloaters(row.choice, dir === 'left' ? -1 : 1);
      }
    },
    onReviewPress(button: string): void {
      if (this.loading) {
        // Only Cancel is honoured while the preview is still loading.
        if (button === 'back') {
          this.$emit('cancel');
        }
        return;
      }
      const row = this.focusedRow;
      switch (button) {
      case 'confirm':
        this.primaryAction();
        return;
      case 'triggerL':
        // LT = enter the payment lanes (secondary — never A). Only when there's
        // a non-M€ mix to dial; a pure-AUTO M€ payment has nothing to configure.
        if (this.payLanes.length > 0) {
          this.sub = {kind: 'payment', index: 0};
        }
        return;
      case 'secondary':
        if (this.card !== undefined) {
          openConsoleCardZoom([this.card], 0);
        }
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'bumperL':
      case 'bumperR': {
        const step = button === 'bumperL' ? -1 : 1;
        // A focused amount/spend-heat stepper takes priority; otherwise LB/RB do
        // the global inline payment quick-adjust (no focus on payment needed).
        if (row?.kind === 'step' && row.choice.kind === 'amount') {
          this.setAmount(row.choice, this.amountFor(row.choice.id) + step);
        } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
          this.adjustFloaters(row.choice, step);
        } else {
          this.adjustQuickPayment(step);
        }
        return;
      }
      case 'triggerR':
        if (row?.kind === 'step' && row.choice.kind === 'amount') {
          this.setAmount(row.choice, this.amountModel(row.choice).max);
        }
        return;
      default:
        return;
      }
    },
    /**
     * The A button — the ONE smart primary action, derived from
     * `primaryActionState`, NOT raw DOM focus. When READY, A PLAYS regardless of
     * where focus is (so a no-choice / all-resolved card plays with one press).
     * When a choice is still needed, A LEADS the player to it: it opens the
     * focused unresolved pick, else jumps to the first unresolved one.
     */
    primaryAction(): void {
      const st = this.primaryActionState;
      if (st.kind === 'ready') {
        this.submit();
        return;
      }
      if (st.kind === 'need-preselect') {
        const row = this.focusedRow;
        // Focused ON an unresolved pick → open it right here; else jump to the
        // first unresolved one and open it.
        const target = (row?.kind === 'step' && this.stepMissing(row.choice)) ? row : this.rows[st.rowIndex];
        if (target !== undefined && target.kind === 'step') {
          this.focusIdx = target.i;
          if (target.choice.kind === 'card' || target.choice.kind === 'player' || target.choice.kind === 'or') {
            this.sub = {kind: 'list', choiceId: target.choice.id, index: 0};
          }
          this.scrollFocused();
        }
        return;
      }
      if (st.kind === 'blocked-payment' && this.payLanes.length > 0) {
        this.sub = {kind: 'payment', index: 0};
      }
      // blocked-requirement: nothing to do — the CTA + status show the reason.
    },
    onSubPress(button: string): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      switch (button) {
      case 'confirm':
        if (sub.kind === 'payment') {
          if (this.paymentReady) {
            this.sub = undefined;
          }
          return;
        }
        this.pickListItem(sub.index);
        return;
      case 'secondary':
        if (sub.kind === 'list') {
          this.inspectListItem(sub.index);
        }
        return;
      case 'back':
        this.sub = undefined;
        return;
      case 'bumperL':
      case 'bumperR':
        if (sub.kind === 'payment') {
          this.adjustLane(sub.index, button === 'bumperL' ? -1 : 1);
        }
        return;
      case 'triggerR':
        if (sub.kind === 'payment') {
          this.adjustLane(sub.index, 0, true);
        }
        return;
      default:
        return;
      }
    },
    /** Select a variant (from navigation) — resets the branch-specific captures
     *  and re-seeds defaults. Focus is owned by the caller (nav), not changed here. */
    setSelectedVariant(pos: number): void {
      const branch = this.branches[pos];
      if (branch === undefined || !branch.available || this.selectedPos === pos) {
        return;
      }
      this.selectedPos = pos;
      // Branch-specific captures reset (desktop selectBranch parity).
      this.captured = {};
      this.capturedOption = undefined;
      this.picks = {};
      this.amounts = {};
      this.floaters = {};
      this.seedChoiceDefaults();
    },
    pickListItem(index: number): void {
      const c = this.subChoice;
      const item = this.listItems[index];
      if (c === undefined || item === undefined || item.disabled) {
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
      this.focusIdx = this.firstActionableIndex();
    },
    inspectListItem(index: number): void {
      const item = this.listItems[index];
      if (item?.card === undefined) {
        return;
      }
      const cards = this.listItems.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
      openConsoleCardZoom(cards, Math.max(0, cards.findIndex((cd) => cd.name === item.card?.name)));
    },
    adjustLane(idx: number, step: number, toMax = false): void {
      const lane = this.payLanes[idx];
      if (lane === undefined) {
        return;
      }
      const cap = laneCap(this.cost, lane);
      const cur = this.payCount(lane.unit);
      this.payCounts = {...this.payCounts, [lane.unit]: toMax ? cap : Math.min(cap, Math.max(0, cur + step))};
    },
    /** The inline quick-adjust (main screen, no payment sub): LB (-1) / RB (+1)
     *  on the SINGLE alt resource; M€ auto-rebalances. Guarded by the view-model's
     *  canDecrease/canIncrease so a dead press is a no-op (never an invalid mix). */
    adjustQuickPayment(step: number): void {
      const view = this.paymentView;
      const chip = view.chips.find((c) => c.isAdjustable);
      if (!view.quickAdjustEligible || chip === undefined) {
        return;
      }
      if ((step > 0 && !chip.canIncrease) || (step < 0 && !chip.canDecrease)) {
        return;
      }
      this.adjustLane(0, step);
      this.payFlashNonce += 1;
    },
    submit(): void {
      const b = this.selectedBranch;
      if (b === undefined || !this.canConfirm || this.submitting) {
        return;
      }
      this.submitting = true;
      const payment: Payment = paymentFromCounts(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
      this.$emit('confirm', {
        branchIndex: b.index,
        preResponses: this.preview !== undefined ? orderedPreResponses(this.preview, this.capturedPre) : [],
        optionResponse: this.capturedOption,
        stepResponses: orderedStepResponses(b, this.captured),
        payment,
      });
    },
    scrollFocused(): void {
      void this.$nextTick(() => {
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        node?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      });
    },
  },
});
</script>
