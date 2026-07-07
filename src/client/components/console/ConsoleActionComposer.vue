<template>
  <div class="con-composer" role="dialog" :aria-label="$t('Confirmation')">
    <div class="con-composer__backdrop" aria-hidden="true"></div>

    <div class="con-composer__panel">
      <!-- ── Header ────────────────────────────────────────────────── -->
      <div class="con-composer__kicker">
        <span class="con-composer__kicker-mark" aria-hidden="true">◈</span>
        <span>{{ $t(hasDecisions ? 'Action setup' : 'Confirmation') }}</span>
      </div>
      <div class="con-composer__name">{{ $t(entry.cardName) }}</div>
      <div v-if="selectedBranch !== undefined && branches.length > 1" class="con-composer__branch-title">
        {{ branchTitle(selectedBranch) }}
      </div>

      <!-- ── Hero: the LIVE cost → reward formula ─────────────────── -->
      <div v-if="heroCost.length > 0 || heroGain.length > 0 || heroChoice.length > 0" class="con-composer__hero">
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
        <!-- Direction-unknown amounts — their OWN labeled cluster (a bare
             SelectAmount structurally justifies neither spent nor received). -->
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
      <div v-else class="con-composer__hero con-composer__hero--plain">{{ $t('Confirm to perform this action.') }}</div>

      <!-- ── Review rows / sub-state ──────────────────────────────── -->
      <div class="con-composer__scroll" ref="scroll">
        <!-- SUB-STATE: a list pick (branch / card / player / or / repeat). -->
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
            <span v-if="item.meta !== ''" class="con-composer__opt-meta">{{ item.meta }}</span>
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
          <div class="con-composer__paytotal" :class="{'con-composer__paytotal--ok': paymentView.covers}">
            {{ $t('Total') }}: {{ paymentView.total }} / {{ paymentView.cost }} M€
          </div>
        </template>

        <!-- REVIEW: the decision rows. -->
        <template v-else>
          <div v-for="(row, i) in rows" :key="row.id"
               class="con-composer__row"
               :class="{
                 'con-composer__row--focused': focusIdx === i,
                 'con-composer__row--missing': rowMissing(row),
               }"
               :ref="focusIdx === i ? 'focusedEl' : undefined">
            <!-- Branch pick row. -->
            <template v-if="row.kind === 'branch'">
              <div class="con-composer__row-label">{{ $t('Action option') }}</div>
              <div class="con-composer__row-value">
                <span v-if="selectedBranch !== undefined">{{ branchTitle(selectedBranch) }}</span>
                <span v-else class="con-composer__row-empty">{{ $t('Choose an option') }}…</span>
              </div>
            </template>

            <!-- Amount stepper row (inline adjust). -->
            <template v-else-if="row.choice !== undefined && row.choice.kind === 'amount'">
              <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
              <div class="con-composer__stepper">
                <i v-if="amountIcon(row.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(row.choice))" aria-hidden="true"></i>
                <span class="con-composer__stepper-value">{{ amountFor(row.choice.id) }}</span>
                <span class="con-composer__stepper-range">{{ amountModel(row.choice).min }} – {{ amountModel(row.choice).max }}</span>
              </div>
              <div v-if="amountResultLine(row.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(row.choice) }}</div>
              <div v-else-if="amountStockLine(row.choice) !== ''" class="con-composer__row-note">{{ amountStockLine(row.choice) }}</div>
            </template>

            <!-- Spend-heat (Stormcraft) row. -->
            <template v-else-if="row.choice !== undefined && row.choice.kind === 'spendHeat'">
              <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
              <div class="con-composer__stepper">
                <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                <span class="con-composer__stepper-value">{{ floatersFor(row.choice.id) }}</span>
                <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
              </div>
              <div class="con-composer__row-note">
                {{ $t('Heat') }}: {{ heatStockFor(row.choice) }} · {{ $t('Floaters') }}: {{ floatersFor(row.choice.id) }}
              </div>
            </template>

            <!-- Payment summary row (A opens the lanes). -->
            <template v-else-if="row.choice !== undefined && row.choice.kind === 'payment'">
              <div class="con-composer__row-label">{{ $t('Payment') }}</div>
              <div class="con-composer__row-value">
                <span v-if="paymentSummary(row.choice) !== ''">{{ paymentSummary(row.choice) }}</span>
                <span v-else class="con-composer__row-empty">{{ $t('Configure payment') }}…</span>
              </div>
            </template>

            <!-- Pick rows (card / player / or / repeat) — A opens the list. -->
            <template v-else-if="row.choice !== undefined">
              <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
              <div class="con-composer__row-value">
                <span v-if="chosenLabel(row.choice) !== ''">{{ chosenLabel(row.choice) }}</span>
                <span v-else class="con-composer__row-empty">{{ pickPlaceholder(row.choice) }}…</span>
                <span v-if="chosenImpact(row.choice) !== ''" class="con-composer__row-impact">{{ chosenImpact(row.choice) }}</span>
              </div>
            </template>
          </div>

          <!-- Warnings (no-effect gains at cap). -->
          <div v-for="(w, i) in warnings" :key="'w' + i" class="con-composer__warn">
            <span aria-hidden="true">!</span><span>{{ $t(w) }}</span>
          </div>

          <!-- Honest "after confirming" (board placement / reveal / notes). -->
          <div v-for="(n, i) in afterNotes" :key="'n' + i" class="con-composer__next">
            <span aria-hidden="true">›</span><span>{{ n }}</span>
          </div>
        </template>
      </div>

      <!-- ── The ONE bottom command bar (composer context) ─────────── -->
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
</template>

<script lang="ts">
/**
 * ConsoleActionComposer — the console-native PRE-SUBMIT composer for a
 * blue-card / corporation action (iteration 2; replaces the bare confirm).
 * Desktop-parity contract with CardActionConfirmContent + submitCardActionBatch:
 * EVERY interactive choice is made HERE, before the one final submit —
 * the branch (only when the render node is ambiguous), the branch's direct
 * optionInput (SelectAmount / SelectCard), every input step (card / player /
 * amount / or / payment), and the Stormcraft spend-heat preSteps. Board
 * placements / notes / reveals stay post-submit — exactly like desktop.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` builders;
 * the parent assembles the byte-identical batch. A Viron repeat-action step
 * hands off via `repeat-pick` (mirrors the desktop `repeat-action` handoff —
 * the chosen action gets its OWN composer with the outer prefix).
 *
 * Control grammar (hints ONLY in the composer's own bottom bar):
 *   D-pad ↑↓ = rows · D-pad ←→ / LB/RB = adjust a focused amount · RT = MAX ·
 *   A = edit/pick the focused row (or confirm when nothing to decide) ·
 *   X = confirm · B = back / cancel.
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
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
import {variablePartsForBranch} from '@/client/console/consoleCardActions';
import {paymentLanes, megacreditsAvailable, paymentCovers, paymentTotal, paymentFromCounts, initialCounts, laneCap, PaymentLane} from '@/client/console/paymentPlan';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';

type Row = {id: string, kind: 'branch' | 'choice', choice?: ComposerChoice};
type SubState =
  | {kind: 'list', choiceId: string | 'branch', index: number}
  | {kind: 'payment', choiceId: string, index: number};

type ListItem = {
  key: string,
  label: string,
  meta: string,
  disabled: boolean,
  reason: string,
  chosen: boolean,
  color?: string,
  /** For card lists — the model behind the row (X = inspect). */
  card?: CardModel,
};

const STANDARD_STOCK: ReadonlyArray<string> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleActionComposer',
  components: {ActionEffectChip, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    entry: {type: Object as PropType<ActionEntry>, required: true},
    preview: {type: Object as PropType<ActionPreview | undefined>, default: undefined},
    /** The focused render node; -1 = no node context (repeat handoff) → branch pick. */
    nodeIndex: {type: Number, required: true},
  },
  emits: ['confirm', 'cancel', 'repeat-pick'],
  data() {
    return {
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      /** Chosen amounts / floaters / payment mixes, keyed by choice id. */
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      payCounts: {} as Record<string, Partial<Record<SpendableResource, number>>>,
      /** Chosen pick labels (card name / player color / option index), by choice id. */
      picks: {} as Record<string, string>,
      focusIdx: 0,
      sub: undefined as SubState | undefined,
      submitting: false,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    /** The branch positions this composer's node context maps to. */
    positions(): ReadonlyArray<number> {
      if (this.nodeIndex < 0) {
        return this.branches.map((_b, i) => i);
      }
      return branchPositionsForNode(this.entry.group, this.branches, this.nodeIndex);
    },
    /** Mirror of the desktop showBranchList — the pick row is a FALLBACK. */
    needBranchRow(): boolean {
      return this.positions.length !== 1 && this.positions.length > 1;
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
    rows(): ReadonlyArray<Row> {
      const out: Array<Row> = [];
      if (this.needBranchRow) {
        out.push({id: 'branch', kind: 'branch'});
      }
      for (const c of this.allChoices) {
        out.push({id: c.id, kind: 'choice', choice: c});
      }
      return out;
    },
    hasDecisions(): boolean {
      return this.rows.length > 0;
    },
    canConfirm(): boolean {
      if (this.rows.some((r) => r.kind === 'choice' && r.choice?.repeatAction === true)) {
        // A repeat-action branch confirms through the HANDOFF, never here
        // (desktop parity — the step is never captured).
        return false;
      }
      return canConfirmPure(this.preview, this.selectedBranch, {
        pre: this.capturedPre,
        option: this.capturedOption,
        steps: this.captured,
      });
    },
    /** LIVE hero chips: static (filtered) + synthetic from the chosen values. */
    heroCost(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) =>
        e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
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
      const out: Array<ActionEffect> = branch.effects.filter((e) =>
        e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticGain(c));
      }
      if (branch.reveal !== undefined) {
        out.push(branch.reveal.reward);
      }
      return out;
    },
    /** Bare amount choices with no structural spend/result hint — neutral chips. */
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
      const gains = this.heroGain;
      return gains.some((e) => e.current !== undefined && e.current === e.resulting) ?
        ['One of the gains has no effect — the value is already at maximum.'] : [];
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
        } else if (step.kind === 'note' && step.noteKind === 'warning' && step.text !== undefined) {
          out.push('⚠ ' + textOf(step.text));
        }
      }
      return out;
    },
    // ── sub-state derived views ─────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      if (this.sub === undefined || this.sub.choiceId === 'branch') {
        return undefined;
      }
      return this.allChoices.find((c) => c.id === this.sub?.choiceId);
    },
    subTitle(): string {
      if (this.sub === undefined) {
        return '';
      }
      if (this.sub.choiceId === 'branch') {
        return translateText('Choose an option');
      }
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    listItems(): ReadonlyArray<ListItem> {
      if (this.sub === undefined || this.sub.kind !== 'list') {
        return [];
      }
      if (this.sub.choiceId === 'branch') {
        return this.positions.map((pos): ListItem => {
          const b = this.branches[pos];
          return {
            key: 'b' + pos,
            label: this.branchTitle(b),
            meta: '',
            disabled: !b.available,
            reason: b.available ? '' : this.branchReason(b),
            chosen: this.selectedPos === pos,
          };
        });
      }
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
          items.push({
            key: 'd' + card.name,
            label: translateText(card.name),
            meta: '',
            disabled: true,
            reason: textOf(card.disabledReason),
            chosen: false,
            card,
          });
        }
        return items;
      }
      if (c.input.type === 'player') {
        const model = c.input as SelectPlayerModel;
        const chosen = this.picks[c.id];
        const items: Array<ListItem> = model.players.map((color): ListItem => ({
          key: color,
          label: this.playerName(color),
          meta: '',
          disabled: false,
          reason: '',
          chosen: chosen === color,
          color,
        }));
        for (const d of model.disabledPlayers ?? []) {
          items.push({
            key: 'd' + d.color,
            label: this.playerName(d.color),
            meta: '',
            disabled: true,
            reason: textOf(d.reason),
            chosen: false,
            color: d.color,
          });
        }
        return items;
      }
      if (c.input.type === 'or') {
        const model = c.input as OrOptionsModel;
        const chosen = this.picks[c.id];
        return model.options.map((opt, i): ListItem => ({
          key: 'o' + i,
          label: textOf(opt.title),
          meta: '',
          // Only leaf options are console-hostable here (no in-scope action
          // produces a nested-input or-step; honest-disable anything exotic).
          disabled: opt.type !== 'option',
          reason: opt.type !== 'option' ? translateText('Unavailable right now') : '',
          chosen: chosen === String(i),
        }));
      }
      return [];
    },
    paymentView(): {lanes: ReadonlyArray<PaymentLane>, counts: Partial<Record<SpendableResource, number>>, mc: number, total: number, cost: number, covers: boolean} | undefined {
      const c = this.subChoice;
      if (c === undefined || c.kind !== 'payment') {
        return undefined;
      }
      return this.paymentStateFor(c);
    },
    focusedRow(): Row | undefined {
      return this.rows[this.focusIdx];
    },
    footHints(): Array<{control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean}> {
      if (this.sub !== undefined) {
        if (this.sub.kind === 'payment') {
          return [
            {control: 'dpad', label: 'Navigate'},
            {control: 'bumperL', control2: 'bumperR', label: '−1 / +1'},
            {control: 'triggerR', label: 'MAX'},
            {control: 'confirm', label: 'Done', enabled: this.paymentView?.covers === true},
            {control: 'back', label: 'Back'},
          ];
        }
        const isCardList = this.subChoice?.input.type === 'card';
        const hints: Array<{control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean}> = [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select'},
        ];
        if (isCardList) {
          hints.push({control: 'secondary', label: 'Inspect'});
        }
        hints.push({control: 'back', label: 'Back'});
        return hints;
      }
      const hints: Array<{control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean}> = [];
      if (this.rows.length > 0) {
        hints.push({control: 'dpad', label: 'Navigate'});
        const focused = this.focusedRow;
        if (focused?.choice?.kind === 'amount' || focused?.choice?.kind === 'spendHeat') {
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
  },
  watch: {
    // A (re)loaded preview is a fresh snapshot — reset every capture and
    // re-derive the branch selection + defaults (also the REVALIDATION path:
    // the parent refetches previews when game state shifts).
    preview: {
      immediate: true,
      handler() {
        this.resetFromPreview();
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
    branchTitle(b: ActionPreviewBranch): string {
      const raw = branchTitleText(b);
      return raw !== '' ? translateText(raw) : '';
    },
    branchReason(b: ActionPreviewBranch): string {
      if (b.unavailableReason === undefined) {
        return translateText('Unavailable right now');
      }
      return textOf(b.unavailableReason);
    },
    playerName(color: string): string {
      const p = this.playerView.players.find((pl) => pl.color === color);
      return p?.name ?? color;
    },
    choiceTitle(c: ComposerChoice): string {
      const t = textOf(c.input.title);
      if (t !== '') {
        return t;
      }
      switch (c.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      case 'or': return translateText('Choose an option');
      case 'payment': return translateText('Payment');
      default: return '';
      }
    },
    pickPlaceholder(c: ComposerChoice): string {
      if (c.repeatAction === true) {
        return translateText('Choose an action to repeat');
      }
      switch (c.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      default: return translateText('Choose an option');
      }
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
      this.sub = undefined;
      this.focusIdx = 0;
      this.submitting = false;
      // Branch pre-selection (desktop mirror): exactly-one position → it;
      // else the lone AVAILABLE branch among this node's set; else none.
      const positions = this.positions;
      if (positions.length === 1) {
        this.selectedPos = positions[0];
      } else {
        const avail = positions.filter((p) => this.branches[p]?.available === true);
        this.selectedPos = avail.length === 1 ? avail[0] : undefined;
      }
      this.seedDefaults();
    },
    /** Seed default captures (controlled-input parity: valid defaults capture
     *  immediately — an amount stepper starts captured at its default). */
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
      } else if (c.kind === 'card' && c.repeatAction !== true) {
        // A LONE candidate auto-captures but stays VISIBLE as the chosen row
        // (desktop ActionTargetCard parity — auto-select, never hidden).
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
      } else {
        if (response === undefined) {
          delete this.captured[c.index];
        } else {
          this.captured[c.index] = response;
        }
      }
    },
    // ── LIVE synthetic hero chips (recompute as the player dials values) ─
    /**
     * The chosen-value COST chips a choice contributes: an `amountResult`/
     * `conversion` amount spends its `icon` (structural semantics); spend-heat
     * shows the heat + floater split; a captured payment shows its mix. A bare
     * amount contributes nothing here (direction unknown → `heroChoice`).
     */
    syntheticCost(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const chosen = this.amountFor(c.id);
        const icon = m.icon ?? m.conversion?.from;
        if ((m.amountResult !== undefined || m.conversion !== undefined) && icon !== undefined) {
          const stock = this.stockOf(icon);
          return [{
            direction: 'cost', icon, amount: chosen,
            current: stock, resulting: stock !== undefined ? stock - chosen : undefined,
          }];
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
        const out: Array<ActionEffect> = [{
          direction: 'cost', icon: 'heat', amount: stock,
          current: heat, resulting: heat !== undefined ? heat - stock : undefined,
        }];
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
          out.push({
            direction: 'cost', icon: 'megacredits', amount: state.mc,
            current: stock, resulting: stock !== undefined ? stock - state.mc : undefined,
          });
        }
        for (const lane of state.lanes) {
          const n = state.counts[lane.unit] ?? 0;
          if (n > 0) {
            const stock = this.stockOf(lane.unit);
            out.push({
              direction: 'cost', icon: lane.unit, amount: n,
              current: stock, resulting: stock !== undefined ? stock - n : undefined,
            });
          }
        }
        return out;
      }
      return [];
    },
    /** The chosen-value GAIN chips (the amountResult / conversion right side). */
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
        const ratio = m.conversion.ratio ?? 1;
        return `→ ${chosen * ratio}`;
      }
      return '';
    },
    amountStockLine(c: ComposerChoice): string {
      const icon = this.amountIcon(c);
      const stock = this.stockOf(icon);
      return stock !== undefined ? `${translateText('In stock')}: ${stock}` : '';
    },
    stockOf(icon: string | undefined): number | undefined {
      if (icon === undefined || !STANDARD_STOCK.includes(icon)) {
        return undefined;
      }
      const p = this.thisPlayer as unknown as Record<string, number>;
      return p[icon];
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
      const total = paymentTotal(model.amount, lanes, counts, mcAvail);
      const covers = paymentCovers(model.amount, lanes, counts, mcAvail);
      const payment = paymentFromCounts(model.amount, lanes, counts, mcAvail);
      return {lanes, counts, mc: payment.megacredits, total, cost: model.amount, covers};
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
      const cur = counts[lane.unit] ?? 0;
      counts[lane.unit] = toMax ? cap : Math.min(cap, Math.max(0, cur + step));
      this.payCounts[c.id] = counts;
      const mcAvail = megacreditsAvailable(this.thisPlayer);
      if (paymentCovers(model.amount, lanes, counts, mcAvail)) {
        this.captureFor(c, {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mcAvail)});
      } else {
        this.captureFor(c, undefined);
      }
    },
    laneLabel(unit: string): string {
      const labels: Record<string, string> = {
        megacredits: 'Megacredits', steel: 'Steel', titanium: 'Titanium',
        plants: 'Plants', energy: 'Energy', heat: 'Heat',
        microbes: 'Microbes', floaters: 'Floaters', seeds: 'Seeds',
        auroraiData: 'Data', graphene: 'Graphene', kuiperAsteroids: 'Asteroids',
        spireScience: 'Science',
      };
      return labels[unit] ?? unit;
    },
    // ── pick rows ───────────────────────────────────────────────────────
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
        const model = c.input as OrOptionsModel;
        const opt = model.options[Number(pick)];
        return opt !== undefined ? textOf(opt.title) : '';
      }
      return pick;
    },
    chosenImpact(c: ComposerChoice): string {
      if (c.input.type !== 'card' || c.amount === undefined) {
        return '';
      }
      const name = this.picks[c.id];
      const model = c.input as SelectCardModel;
      const card = model.cards.find((cd) => cd.name === name);
      if (card === undefined) {
        return '';
      }
      const from = card.resources ?? 0;
      return `${from} → ${Math.max(0, from + c.amount)}`;
    },
    rowMissing(row: Row): boolean {
      if (row.kind === 'branch') {
        return this.selectedBranch === undefined;
      }
      const c = row.choice;
      if (c === undefined) {
        return false;
      }
      if (c.repeatAction === true) {
        return true;
      }
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── input routing (the parent forwards every intent here) ──────────
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
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? (this.paymentView?.lanes.length ?? 0) : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          const step = dir === 'up' ? -1 : 1;
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + step));
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
        const step = dir === 'up' ? -1 : 1;
        this.focusIdx = Math.min(this.rows.length - 1, Math.max(0, this.focusIdx + step));
        this.scrollFocused();
        return;
      }
      // Left/right adjust a focused inline stepper.
      const c = this.focusedRow?.choice;
      if (c?.kind === 'amount') {
        this.setAmount(c, this.amountFor(c.id) + (dir === 'left' ? -1 : 1));
      } else if (c?.kind === 'spendHeat') {
        this.adjustFloaters(c, dir === 'left' ? -1 : 1);
      }
    },
    onReviewPress(button: string): void {
      const row = this.focusedRow;
      const c = row?.choice;
      switch (button) {
      case 'confirm':
        if (row === undefined) {
          this.submit();
        } else if (row.kind === 'branch') {
          this.sub = {kind: 'list', choiceId: 'branch', index: 0};
        } else if (c !== undefined) {
          if (c.kind === 'card' || c.kind === 'player' || c.kind === 'or') {
            this.sub = {kind: 'list', choiceId: c.id, index: 0};
          } else if (c.kind === 'payment') {
            this.sub = {kind: 'payment', choiceId: c.id, index: 0};
          }
          // amount / spendHeat rows adjust inline — A is a no-op on them.
        }
        return;
      case 'secondary':
        this.submit();
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'bumperL':
      case 'bumperR': {
        const step = button === 'bumperL' ? -1 : 1;
        if (c?.kind === 'amount') {
          this.setAmount(c, this.amountFor(c.id) + step);
        } else if (c?.kind === 'spendHeat') {
          this.adjustFloaters(c, step);
        }
        return;
      }
      case 'triggerR':
        if (c?.kind === 'amount') {
          this.setAmount(c, this.amountModel(c).max);
        }
        return;
      default:
        return;
      }
    },
    onSubPress(button: string): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      switch (button) {
      case 'confirm':
        if (sub.kind === 'payment') {
          if (this.paymentView?.covers === true) {
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
          const c = this.subChoice;
          if (c !== undefined) {
            this.adjustPayment(c, sub.index, button === 'bumperL' ? -1 : 1);
          }
        }
        return;
      case 'triggerR':
        if (sub.kind === 'payment') {
          const c = this.subChoice;
          if (c !== undefined) {
            this.adjustPayment(c, sub.index, 0, true);
          }
        }
        return;
      default:
        return;
      }
    },
    pickListItem(index: number): void {
      const sub = this.sub;
      if (sub === undefined || sub.kind !== 'list') {
        return;
      }
      const item = this.listItems[index];
      if (item === undefined || item.disabled) {
        return;
      }
      if (sub.choiceId === 'branch') {
        const pos = this.positions[index];
        if (pos !== undefined && this.selectedPos !== pos) {
          this.selectedPos = pos;
          // Branch-specific captures reset (desktop selectBranch parity);
          // preSteps stay captured.
          this.captured = {};
          this.capturedOption = undefined;
          this.picks = {};
          this.amounts = {};
          for (const c of this.branchChoiceList) {
            this.seedChoice(c);
          }
        }
        this.sub = undefined;
        return;
      }
      const c = this.subChoice;
      if (c === undefined) {
        return;
      }
      if (c.repeatAction === true && item.card !== undefined) {
        // Viron handoff — the chosen action gets its OWN composer (with the
        // outer prefix). Never captured here (desktop parity).
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
      openConsoleCardZoom(cards, Math.max(0, at), undefined, undefined, {contextLabel: 'Card actions'});
    },
    // ── submit ──────────────────────────────────────────────────────────
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
        node?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      });
    },
  },
});
</script>
