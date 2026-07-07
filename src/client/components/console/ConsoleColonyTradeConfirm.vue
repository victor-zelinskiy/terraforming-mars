<template>
  <div class="con-task-host con-trade" role="dialog" :aria-label="$t('Trade')">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>
    <div class="con-task con-trade__frame">
      <!-- ── Header ────────────────────────────────────────────────── -->
      <header class="con-task__head con-trade__head">
        <div class="con-trade__head-text">
          <div class="con-task__kicker">
            <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Trade') }}</span>
          </div>
          <div class="con-task__title">{{ $t(colonyName) }}</div>
        </div>
        <div class="con-trade__planet" :class="planetClass" aria-hidden="true"></div>
      </header>

      <!-- ── Hero: the LIVE trade outcome (Итог торговли). ─────────── -->
      <div class="con-trade__hero">
        <div v-if="outcome.cost.length > 0" class="con-trade__hero-side">
          <div class="con-trade__hero-label">{{ $t('Payment') }}</div>
          <div class="con-trade__hero-chips">
            <span v-for="(chip, k) in outcome.cost" :key="'c' + k" class="con-trade__chip con-trade__chip--cost">
              <i v-if="chip.icon" class="con-trade__chip-icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
              <b>−{{ chip.amount }}</b>
              <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
            </span>
          </div>
        </div>
        <span v-if="outcome.cost.length > 0 && heroGains.length > 0" class="con-trade__hero-arrow" aria-hidden="true">→</span>
        <div v-if="heroGains.length > 0" class="con-trade__hero-side">
          <div class="con-trade__hero-label">{{ $t('You will receive') }}</div>
          <div class="con-trade__hero-chips">
            <span v-for="(chip, k) in heroGains" :key="'g' + k" class="con-trade__chip con-trade__chip--gain" :class="{'con-trade__chip--prod': chip.production}">
              <i v-if="chip.icon && chip.icon !== 'cards' && chip.icon !== 'tr'" class="con-trade__chip-icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
              <span v-else-if="chip.icon === 'cards'" class="con-trade__chip-badge">{{ $t('Cards') }}</span>
              <span v-else-if="chip.icon === 'tr'" class="con-trade__chip-badge con-trade__chip-badge--tr">{{ $t('TR') }}</span>
              <span v-if="chip.label" class="con-trade__chip-label">{{ $t(chip.label) }}</span>
              <b>+{{ chip.amount }}</b>
              <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
              <em v-else-if="chip.note" class="con-trade__chip-note">{{ $t(chip.note) }}</em>
            </span>
          </div>
        </div>
      </div>

      <div class="con-task__main con-trade__main">
        <!-- ── SUB: pick the payment path. ───────────────────────────── -->
        <template v-if="sub === 'paylist'">
          <div class="con-trade__sub-title">{{ $t('Pay trade fee') }}</div>
          <div v-for="(entry, i) in payEntries" :key="'p' + i"
               class="con-task__option"
               :class="{
                 'con-task__option--focused': subIdx === i,
                 'con-trade__option--chosen': payIdx === i,
               }"
               :ref="subIdx === i ? 'focusedEl' : undefined">
            <div class="con-task__option-main">
              <i v-if="entry.iconClass !== ''" class="con-task__opt-icon" :class="entry.iconClass" aria-hidden="true"></i>
              <span class="con-task__opt-title">{{ entry.title }}</span>
              <span v-if="entry.preview !== ''" class="con-task__opt-preview">{{ entry.preview }}</span>
              <span v-if="payIdx === i" class="con-trade__opt-check" aria-hidden="true">✓</span>
            </div>
          </div>
          <div v-if="disabledEntries.length > 0" class="con-task__disabled">
            <div class="con-task__disabled-title">{{ $t('Unavailable payment options') }}</div>
            <div v-for="(d, i) in disabledEntries" :key="'d' + i" class="con-task__option con-task__option--disabled">
              <div class="con-task__option-main">
                <i v-if="d.iconClass !== ''" class="con-task__opt-icon" :class="d.iconClass" aria-hidden="true"></i>
                <span class="con-task__opt-title">{{ d.title }}</span>
                <span class="con-task__opt-reason">{{ d.reason }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- ── SUB: the M€ payment lanes (heat / alt resources). ─────── -->
        <template v-else-if="sub === 'lanes' && paymentView !== undefined">
          <div class="con-trade__sub-title">{{ $t('Payment') }}</div>
          <div v-for="(lane, i) in paymentView.lanes" :key="lane.unit"
               class="con-composer__lane"
               :class="{'con-composer__lane--focused': subIdx === i}"
               :ref="subIdx === i ? 'focusedEl' : undefined">
            <i class="con-composer__lane-icon" :class="iconClass(lane.unit)" aria-hidden="true"></i>
            <span class="con-composer__lane-name">{{ $t(laneLabel(lane.unit)) }}</span>
            <span v-if="lane.rate > 1" class="con-composer__lane-rate">×{{ lane.rate }}</span>
            <span class="con-composer__lane-value"><b>{{ paymentCounts[lane.unit] ?? 0 }}</b><i>/ {{ lane.available }}</i></span>
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

        <!-- ── SUB: track advance choice (IncreaseColonyTrack). ──────── -->
        <template v-else-if="sub === 'track' && trackStep !== undefined">
          <div class="con-trade__sub-title">{{ $t('Increase colony track before trade') }}</div>
          <div v-for="(opt, i) in trackOptions" :key="'tr' + i"
               class="con-task__option"
               :class="{
                 'con-task__option--focused': subIdx === i,
                 'con-trade__option--chosen': captures['track'] === opt.steps,
               }"
               :ref="subIdx === i ? 'focusedEl' : undefined">
            <div class="con-task__option-main">
              <span class="con-task__opt-title">{{ opt.title }}</span>
              <span class="con-trade__track-reward">
                <span v-if="opt.quantity > 1" class="con-trade__track-qty">{{ opt.quantity }}</span>
                <BenefitGlyph :benefit="tradeBenefitAt(opt.position)" :idx="opt.position" :cardResource="metadata?.cardResource" />
              </span>
              <span v-if="captures['track'] === opt.steps" class="con-trade__opt-check" aria-hidden="true">✓</span>
            </div>
          </div>
        </template>

        <!-- ── SUB: card-target picker (where the resources land). ───── -->
        <template v-else-if="sub === 'targets' && activeTargetStep !== undefined">
          <div class="con-trade__sub-title">{{ targetSubTitle }}</div>
          <div v-for="(card, i) in activeTargetStep.pick.cards" :key="card.name"
               class="con-task__option"
               :class="{
                 'con-task__option--focused': subIdx === i,
                 'con-trade__option--chosen': captures[activeTargetKey] === card.name,
               }"
               :ref="subIdx === i ? 'focusedEl' : undefined">
            <div class="con-task__option-main">
              <i v-if="targetIconClass !== ''" class="con-task__opt-icon" :class="targetIconClass" aria-hidden="true"></i>
              <span class="con-task__opt-title">{{ $t(card.name) }}</span>
              <span class="con-task__opt-preview">{{ card.resources ?? 0 }} → {{ (card.resources ?? 0) + activeTargetStep.amount }}</span>
              <span v-if="captures[activeTargetKey] === card.name" class="con-trade__opt-check" aria-hidden="true">✓</span>
            </div>
          </div>
        </template>

        <!-- ── REVIEW: the decision rows. ─────────────────────────────── -->
        <template v-else>
          <div class="con-task__body con-trade__body">
            <div v-for="(row, i) in rows" :key="row.key"
                 class="con-trade__row"
                 :class="{
                   'con-trade__row--focused': focusIdx === i,
                   'con-trade__row--missing': rowMissing(row),
                 }"
                 :ref="focusIdx === i ? 'focusedEl' : undefined">
              <div class="con-trade__row-label">{{ $t(row.label) }}</div>
              <div class="con-trade__row-value">
                <template v-if="row.kind === 'pay'">
                  <i v-if="chosenPayEntry !== undefined && chosenPayEntry.iconClass !== ''" class="con-trade__row-icon" :class="chosenPayEntry.iconClass" aria-hidden="true"></i>
                  <span>{{ chosenPayEntry !== undefined ? chosenPayEntry.title : '' }}</span>
                  <em v-if="chosenPayEntry !== undefined && chosenPayEntry.preview !== ''">{{ chosenPayEntry.preview }}</em>
                </template>
                <template v-else-if="row.kind === 'payment'">
                  <span v-if="paymentSummary !== ''">{{ paymentSummary }}</span>
                  <span v-else class="con-trade__row-empty">{{ $t('Configure payment') }}…</span>
                </template>
                <template v-else-if="row.kind === 'trackChoice'">
                  <span v-if="captures['track'] !== undefined">{{ trackSummary }}</span>
                  <span v-else class="con-trade__row-empty">{{ $t('Choose the track advance') }}…</span>
                </template>
                <template v-else-if="row.kind === 'cardTarget' && row.step !== undefined">
                  <i v-if="row.iconClass !== ''" class="con-trade__row-icon" :class="row.iconClass" aria-hidden="true"></i>
                  <span v-if="captures[row.key] !== undefined">{{ $t(String(captures[row.key])) }}</span>
                  <span v-else class="con-trade__row-empty">{{ $t('Choose a card') }}…</span>
                  <em v-if="captures[row.key] !== undefined">{{ targetImpact(row.step) }}</em>
                </template>
              </div>
            </div>

            <!-- Display-only notices: explicit auto target / lost resource /
                 what still follows after confirming. -->
            <div v-for="(notice, i) in noticeRows" :key="'n' + i"
                 class="con-trade__notice"
                 :class="'con-trade__notice--' + notice.tone">
              <span aria-hidden="true">{{ notice.tone === 'warn' ? '!' : '›' }}</span>
              <i v-if="notice.iconClass !== ''" class="con-trade__notice-icon" :class="notice.iconClass" aria-hidden="true"></i>
              <span>{{ notice.text }}</span>
            </div>

            <!-- The fixed tile bonus to OTHER colony owners (transparency). -->
            <div v-if="otherOwners.length > 0" class="con-trade__bonus">
              <span class="con-trade__bonus-label">{{ $t('Trade bonus to colonies here') }}:</span>
              <span v-if="metadata !== undefined" class="con-trade__bonus-glyph">
                <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
              </span>
              <span v-for="owner in otherOwners" :key="owner.color" class="con-task__opt-player">
                <span :class="'con-status__dot player_bg_color_' + owner.color"></span>
                <span>{{ owner.name }}</span><span v-if="owner.count > 1"> ×{{ owner.count }}</span>
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE COLONY-TRADE COMPOSER — the pre-select confirm for a colony trade
 * (the console twin of the blue-card ConsoleActionComposer, sharing the
 * pre-select philosophy: EVERY decision is made HERE, before ONE batched
 * submit). Sources of truth: the live "Pay trade fee" OrOptions (payment
 * paths + honest disabled reasons) and the shared server trade preview
 * (`/api/game/colony-trade-preview` → track advance, card-target picks, the
 * M€ payment prompt, after-confirm notes).
 *
 * Review rows: payment path (A → the path list, «Недоступные варианты
 * оплаты» included), the M€ payment mix (A → lanes, only when the M€ path
 * would prompt), the track-advance choice (ask colonies), and one row per
 * card-target pick (Enceladus microbes / Titan floaters / own colony
 * bonuses) with the per-card before → after. The hero band is the live
 * «Итог торговли»: payment → gains with current → resulting, plus the other
 * owners' fixed tile bonus. A = edit the focused row · X = confirm (gated on
 * every decision captured) · B = back / cancel. Hints live ONLY in the
 * shell's bottom bar (mirrored via consoleColoniesUi).
 *
 * The parent (shell) builds the byte-identical batch via
 * `colonyTradePlan.buildTradeBatch` and POSTs it through PlayerInputBatch —
 * identical to answering the live prompts one at a time; a diverged later
 * step gracefully arrives as a live prompt.
 */
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {Message} from '@/common/logs/Message';
import {SpendableResource} from '@/common/inputs/Spendable';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {consoleColoniesUi} from '@/client/console/consoleColoniesModel';
import {
  paymentLanes,
  megacreditsAvailable,
  paymentCovers,
  paymentTotal,
  paymentFromCounts,
  initialCounts,
  autoMegacredits,
  laneCap,
  PaymentLane,
} from '@/client/console/paymentPlan';
import {
  TradeStep,
  colonyOwnerCounts,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  TradeOutcomeChip,
  tradeSteps,
} from '@/client/components/colonies/colonyTradePlan';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type PayEntry = {title: string, iconClass: string, preview: string};
type Row = {
  key: string,
  kind: 'pay' | 'payment' | 'trackChoice' | 'cardTarget',
  label: string,
  iconClass: string,
  step?: Extract<TradeStep, {kind: 'cardTarget'}>,
};
type Sub = undefined | 'paylist' | 'lanes' | 'track' | 'targets';
type NoticeRow = {tone: 'warn' | 'info', iconClass: string, text: string};

const LANE_LABEL: Partial<Record<SpendableResource, string>> = {
  heat: 'Heat',
  steel: 'Steel',
  titanium: 'Titanium',
  plants: 'Plants',
  microbes: 'Microbes',
  floaters: 'Floaters',
  seeds: 'Seeds',
  auroraiData: 'Data',
  graphene: 'Graphene',
  kuiperAsteroids: 'Asteroids',
  spireScience: 'Science',
  lunaArchivesScience: 'Science',
};

export default defineComponent({
  name: 'ConsoleColonyTradeConfirm',
  components: {BenefitGlyph},
  props: {
    colony: {type: Object as PropType<ColonyModel | undefined>, default: undefined},
    colonyName: {type: String as PropType<ColonyName>, required: true},
    /** The inner "Pay trade fee" OrOptions options (server-affordable). */
    options: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, required: true},
    /** Unaffordable paths — shown disabled with the server reason. */
    disabledOptions: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    /** The shared server trade preview (undefined while loading — degrades). */
    preview: {type: Object as PropType<ColonyTradePreviewModel | undefined>, default: undefined},
    /** The viewer (stocks / production for the outcome's before → after). */
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      payIdx: 0,
      focusIdx: 0,
      subIdx: 0,
      sub: undefined as Sub,
      /** Captured decisions by step key ('payment' / 'track' / 'target:<i>'). */
      captures: {} as Record<string, unknown>,
      /** The M€ lanes mix (auto-seeded with the optimal default). */
      paymentCounts: {} as Partial<Record<SpendableResource, number>>,
    };
  },
  computed: {
    metadata(): ColonyMetadata | undefined {
      try {
        return getColony(this.colonyName);
      } catch (err) {
        return undefined;
      }
    },
    planetClass(): string {
      return this.colonyName.replace(' ', '-') + '-background';
    },
    payEntries(): Array<PayEntry> {
      return this.options.map((o) => {
        const meta = o.metadata;
        const res = meta?.resource;
        return {
          title: textOf(o.title),
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-task__opt-res' : '',
          preview: res !== undefined ? `${res.current} → ${res.resulting}` : '',
        };
      });
    },
    disabledEntries(): Array<{title: string, iconClass: string, reason: string}> {
      return this.disabledOptions.map((d) => {
        const rec = d as {title?: string | Message, label?: string | Message, reason?: string | Message, metadata?: {icon?: string}};
        return {
          title: textOf(rec.title ?? rec.label),
          iconClass: rec.metadata?.icon !== undefined ? iconClassFor(rec.metadata.icon) + ' con-task__opt-res' : '',
          reason: textOf(rec.reason),
        };
      });
    },
    chosenPayEntry(): PayEntry | undefined {
      return this.payEntries[this.payIdx];
    },
    /** The chosen payment path uses M€ (its prompt may need the lanes mix). */
    isMcSelected(): boolean {
      return this.options[this.payIdx]?.metadata?.icon === 'megacredits';
    },
    steps(): Array<TradeStep> {
      return tradeSteps(this.preview, this.isMcSelected);
    },
    stepKeys(): Array<string> {
      let target = 0;
      return this.steps.map((step) => {
        if (step.kind === 'payment') {
          return 'payment';
        }
        if (step.kind === 'trackChoice') {
          return 'track';
        }
        return `target:${target++}`;
      });
    },
    rows(): Array<Row> {
      const rows: Array<Row> = [{key: 'pay', kind: 'pay', label: 'Pay trade fee', iconClass: ''}];
      this.steps.forEach((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          rows.push({key, kind: 'payment', label: 'Payment', iconClass: ''});
        } else if (step.kind === 'trackChoice') {
          rows.push({key, kind: 'trackChoice', label: 'Colony track', iconClass: ''});
        } else {
          rows.push({
            key,
            kind: 'cardTarget',
            label: step.role === 'tradeReward' ? 'Trade reward target' : 'Colony bonus target',
            iconClass: this.resourceIconClass(step.resource),
            step,
          });
        }
      });
      return rows;
    },
    trackStep(): Extract<TradeStep, {kind: 'trackChoice'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'trackChoice');
      return step?.kind === 'trackChoice' ? step : undefined;
    },
    trackOptions(): Array<{steps: number, position: number, quantity: number, title: string}> {
      const step = this.trackStep;
      const current = this.preview?.track.current ?? 0;
      if (step === undefined || this.metadata === undefined) {
        return [];
      }
      const options: Array<{steps: number, position: number, quantity: number, title: string}> = [];
      for (let n = step.steps; n >= 0; n--) {
        const position = Math.min(current + n, this.metadata.trade.quantity.length - 1);
        options.push({
          steps: n,
          position,
          quantity: rewardAtPosition(this.metadata, position).quantity,
          title: n > 0 ?
            translateTextWithParams('Increase colony track ${0} step(s)', [String(n)]) :
            translateText('Don\'t increase colony track'),
        });
      }
      return options;
    },
    trackSummary(): string {
      const chosen = this.captures['track'];
      if (typeof chosen !== 'number') {
        return '';
      }
      return chosen > 0 ?
        translateTextWithParams('Advance ${0} step(s)', [String(chosen)]) :
        translateText('Don\'t increase colony track');
    },
    targetStepsList(): Array<Extract<TradeStep, {kind: 'cardTarget'}>> {
      return this.steps.filter((s): s is Extract<TradeStep, {kind: 'cardTarget'}> => s.kind === 'cardTarget');
    },
    /** The card-target step the open 'targets' sub edits (by focused row). */
    activeTargetStep(): Extract<TradeStep, {kind: 'cardTarget'}> | undefined {
      const row = this.rows[this.focusIdx];
      return row?.kind === 'cardTarget' ? row.step : undefined;
    },
    activeTargetKey(): string {
      return this.rows[this.focusIdx]?.key ?? '';
    },
    targetIconClass(): string {
      return this.resourceIconClass(this.activeTargetStep?.resource);
    },
    targetSubTitle(): string {
      const step = this.activeTargetStep;
      if (step === undefined) {
        return '';
      }
      return textOf(step.pick.title) || translateText('Choose a card');
    },
    // ── payment lanes (the M€ prompt pre-collected in place) ────────────
    paymentStep(): Extract<TradeStep, {kind: 'payment'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'payment');
      return step?.kind === 'payment' ? step : undefined;
    },
    paymentView(): {lanes: Array<PaymentLane>, mc: number, total: number, cost: number, covers: boolean} | undefined {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        return undefined;
      }
      const lanes = paymentLanes(step.model, player);
      const mcAvailable = megacreditsAvailable(player);
      return {
        lanes,
        mc: autoMegacredits(step.model.amount, lanes, this.paymentCounts, mcAvailable),
        total: paymentTotal(step.model.amount, lanes, this.paymentCounts, mcAvailable),
        cost: step.model.amount,
        covers: paymentCovers(step.model.amount, lanes, this.paymentCounts, mcAvailable),
      };
    },
    paymentSummary(): string {
      const view = this.paymentView;
      if (view === undefined) {
        return '';
      }
      const parts: Array<string> = [];
      for (const lane of view.lanes) {
        const count = this.paymentCounts[lane.unit] ?? 0;
        if (count > 0) {
          parts.push(`${count} ${translateText(this.laneLabel(lane.unit))}`);
        }
      }
      if (view.mc > 0 || parts.length === 0) {
        parts.push(`${view.mc} M€`);
      }
      return parts.join(' + ');
    },
    // ── outcome (Итог торговли) ──────────────────────────────────────────
    rewardPosition(): number {
      const track = this.preview?.track;
      const chosen = this.captures['track'];
      if (track === undefined) {
        return Math.min(this.colony?.trackPosition ?? 0, 6);
      }
      if (typeof chosen === 'number') {
        return Math.min(track.current + chosen, (this.metadata?.trade.quantity.length ?? 7) - 1);
      }
      return track.effective;
    },
    ownColonyCount(): number {
      if (this.colony === undefined || this.viewerColor === undefined) {
        return 0;
      }
      return this.colony.colonies.filter((c) => c === this.viewerColor).length;
    },
    outcome(): {cost: Array<TradeOutcomeChip>, gains: Array<TradeOutcomeChip>} {
      if (this.metadata === undefined) {
        return {cost: [], gains: []};
      }
      const player = this.thisPlayer;
      const meta = this.options[this.payIdx]?.metadata;
      const payment = meta?.icon !== undefined && meta.amount !== undefined ?
        {icon: meta.icon, amount: meta.amount} :
        undefined;
      return tradeOutcome({
        metadata: this.metadata,
        rewardPosition: this.rewardPosition,
        payment,
        ownColonyCount: this.ownColonyCount,
        stocks: player !== undefined ? {
          megacredits: player.megacredits,
          steel: player.steel,
          titanium: player.titanium,
          plants: player.plants,
          energy: player.energy,
          heat: player.heat,
        } : {},
        production: player !== undefined ? {
          megacredits: player.megacreditProduction,
          steel: player.steelProduction,
          titanium: player.titaniumProduction,
          plants: player.plantProduction,
          energy: player.energyProduction,
          heat: player.heatProduction,
        } : {},
      });
    },
    /** Gains with the captured card targets resolved (chip → the chosen card). */
    heroGains(): Array<TradeOutcomeChip> {
      return this.outcome.gains.map((chip) => {
        if (chip.note !== 'to a card') {
          return chip;
        }
        // Resolve against the matching captured target (trade reward first).
        const stepIdx = this.targetStepsList.findIndex((s) => this.resourceKey(s.resource) === chip.icon);
        if (stepIdx === -1) {
          return chip;
        }
        const rowKey = `target:${stepIdx}`;
        const captured = this.captures[rowKey];
        if (captured === undefined) {
          return chip;
        }
        return {...chip, note: undefined, label: undefined};
      });
    },
    colonyBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata?.colony;
      if (c === undefined) {
        return {type: ColonyBenefit.GAIN_RESOURCES, quantity: [1]};
      }
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    otherOwners(): Array<{color: Color, count: number, name: string}> {
      if (this.colony === undefined) {
        return [];
      }
      return colonyOwnerCounts(this.colony)
        .filter((owner) => owner.color !== this.viewerColor)
        .map((owner) => {
          const player = this.players.find((p) => p.color === owner.color);
          return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
        });
    },
    noticeRows(): Array<NoticeRow> {
      const rows: Array<NoticeRow> = [];
      for (const notice of tradeNotices(this.preview)) {
        if (notice.kind === 'autoTarget') {
          rows.push({
            tone: 'info',
            iconClass: this.resourceIconClass(notice.resource),
            text: translateTextWithParams('+${0} to ${1} (the only eligible card)', [String(notice.amount), translateText(notice.card)]),
          });
        } else if (notice.kind === 'lostResource') {
          rows.push({
            tone: 'warn',
            iconClass: this.resourceIconClass(notice.resource),
            text: translateText('No eligible card — this resource is not added.'),
          });
        } else {
          rows.push({tone: 'info', iconClass: '', text: translateText(notice.note)});
        }
      }
      return rows;
    },
    canConfirm(): boolean {
      if (this.paymentView !== undefined && !this.paymentView.covers) {
        return false;
      }
      return this.steps.every((step, i) => {
        if (step.kind === 'payment') {
          return true; // auto-seeded with the optimal default mix
        }
        return this.captures[this.stepKeys[i]] !== undefined;
      });
    },
    focusedRowEditable(): boolean {
      const row = this.rows[this.focusIdx];
      if (row === undefined) {
        return false;
      }
      if (row.kind === 'pay') {
        return true;
      }
      if (row.kind === 'payment') {
        return (this.paymentView?.lanes.length ?? 0) > 0;
      }
      return true;
    },
  },
  watch: {
    // A different payment path re-derives the steps; captured targets keep
    // their keys (payment lanes reseed for the M€ prompt).
    isMcSelected() {
      this.seedPaymentDefault();
    },
    preview() {
      this.seedPaymentDefault();
      this.syncUiMirror();
    },
    sub() {
      this.syncUiMirror();
    },
    canConfirm() {
      this.syncUiMirror();
    },
    focusedRowEditable() {
      this.syncUiMirror();
    },
  },
  methods: {
    iconClass(unit: string): string {
      return iconClassFor(unit);
    },
    laneLabel(unit: SpendableResource): string {
      return LANE_LABEL[unit] ?? unit;
    },
    chipIconClass(chip: TradeOutcomeChip): string {
      return chip.icon !== undefined ? iconClassFor(chip.icon) : '';
    },
    resourceKey(resource: string | undefined): string | undefined {
      return resource?.toString().toLowerCase().replace(/ /g, '-');
    },
    resourceIconClass(resource: string | undefined): string {
      const key = this.resourceKey(resource);
      return key !== undefined ? iconClassFor(key) + ' con-task__opt-res' : '';
    },
    tradeBenefitAt(position: number): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = this.metadata?.trade;
      if (t === undefined) {
        return {type: ColonyBenefit.GAIN_RESOURCES, quantity: [0]};
      }
      const resource = Array.isArray(t.resource) ? t.resource[position] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    targetImpact(step: Extract<TradeStep, {kind: 'cardTarget'}>): string {
      const rowKey = this.rows[this.focusIdx]?.key;
      const captured = rowKey !== undefined ? this.captures[rowKey] : undefined;
      const name = typeof captured === 'string' ? captured : undefined;
      const card = step.pick.cards.find((c) => c.name === name);
      if (card === undefined) {
        return '';
      }
      const before = card.resources ?? 0;
      return `${before} → ${before + step.amount}`;
    },
    seedPaymentDefault(): void {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        this.paymentCounts = {};
        return;
      }
      const lanes = paymentLanes(step.model, player);
      this.paymentCounts = initialCounts(step.model.amount, lanes, megacreditsAvailable(player));
    },
    syncUiMirror(): void {
      consoleColoniesUi.composerSub = this.sub === undefined ? '' : (this.sub === 'lanes' ? 'lanes' : 'list');
      consoleColoniesUi.composerReady = this.canConfirm;
      consoleColoniesUi.composerEditable = this.focusedRowEditable;
    },
    /** The shell routes every intent here while the confirm is open. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    onNav(dir: NavDirection): void {
      if (this.sub === 'lanes') {
        this.onLanesNav(dir);
        return;
      }
      if (this.sub !== undefined) {
        if (dir === 'up' || dir === 'down') {
          const n = this.subListLength();
          this.subIdx = Math.min(n - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        }
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = Math.min(this.rows.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
      }
    },
    onLanesNav(dir: NavDirection): void {
      const view = this.paymentView;
      if (view === undefined) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.subIdx = Math.min(view.lanes.length - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        return;
      }
      const lane = view.lanes[this.subIdx];
      if (lane === undefined) {
        return;
      }
      const delta = dir === 'right' ? 1 : -1;
      const cap = laneCap(view.cost, lane);
      const next = Math.min(cap, Math.max(0, (this.paymentCounts[lane.unit] ?? 0) + delta));
      this.paymentCounts = {...this.paymentCounts, [lane.unit]: next};
    },
    subListLength(): number {
      if (this.sub === 'paylist') {
        return this.payEntries.length;
      }
      if (this.sub === 'track') {
        return this.trackOptions.length;
      }
      if (this.sub === 'targets') {
        return this.activeTargetStep?.pick.cards.length ?? 0;
      }
      return 0;
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'confirm':
        this.onConfirmPress();
        return;
      case 'secondary':
        // X = the one final confirm (only when every decision is captured).
        if (this.sub === undefined && this.canConfirm) {
          this.emitConfirm();
        } else if (this.sub !== undefined) {
          this.onConfirmPress();
        }
        return;
      case 'triggerR':
        // RT in the lanes = MAX the focused lane (mirrors the action composer).
        if (this.sub === 'lanes') {
          const view = this.paymentView;
          const lane = view?.lanes[this.subIdx];
          if (view !== undefined && lane !== undefined) {
            this.paymentCounts = {...this.paymentCounts, [lane.unit]: laneCap(view.cost, lane)};
          }
        }
        return;
      case 'back':
        if (this.sub !== undefined) {
          this.sub = undefined;
          return;
        }
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    onConfirmPress(): void {
      if (this.sub === 'paylist') {
        this.payIdx = this.subIdx;
        this.sub = undefined;
        return;
      }
      if (this.sub === 'lanes') {
        if (this.paymentView?.covers === true) {
          this.sub = undefined;
        }
        return;
      }
      if (this.sub === 'track') {
        const option = this.trackOptions[this.subIdx];
        if (option !== undefined) {
          this.captures = {...this.captures, track: option.steps};
          this.sub = undefined;
        }
        return;
      }
      if (this.sub === 'targets') {
        const step = this.activeTargetStep;
        const card = step?.pick.cards[this.subIdx];
        if (step !== undefined && card !== undefined) {
          this.captures = {...this.captures, [this.activeTargetKey]: card.name};
          this.sub = undefined;
        }
        return;
      }
      // Review: A edits the focused row; when nothing is editable and all is
      // captured, A confirms (single-decision trades stay two presses total).
      const row = this.rows[this.focusIdx];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'pay') {
        this.sub = 'paylist';
        this.subIdx = this.payIdx;
        return;
      }
      if (row.kind === 'payment') {
        this.sub = 'lanes';
        this.subIdx = 0;
        return;
      }
      if (row.kind === 'trackChoice') {
        this.sub = 'track';
        this.subIdx = 0;
        return;
      }
      if (row.kind === 'cardTarget') {
        this.sub = 'targets';
        const captured = this.captures[row.key];
        const idx = row.step?.pick.cards.findIndex((c) => c.name === captured) ?? -1;
        this.subIdx = idx !== -1 ? idx : 0;
        return;
      }
    },
    rowMissing(row: Row): boolean {
      if (row.kind === 'trackChoice') {
        return this.captures['track'] === undefined;
      }
      if (row.kind === 'cardTarget') {
        return this.captures[row.key] === undefined;
      }
      if (row.kind === 'payment') {
        return this.paymentView !== undefined && !this.paymentView.covers;
      }
      return false;
    },
    emitConfirm(): void {
      // Build the by-index captures the pure batch builder consumes.
      const capturesByIndex: Record<number, unknown> = {};
      this.steps.forEach((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          const view = this.paymentView;
          const player = this.thisPlayer;
          if (view !== undefined && player !== undefined) {
            capturesByIndex[i] = paymentFromCounts(view.cost, view.lanes, this.paymentCounts, megacreditsAvailable(player));
          }
        } else if (this.captures[key] !== undefined) {
          capturesByIndex[i] = this.captures[key];
        }
      });
      this.$emit('confirm', {paymentIndex: this.payIdx, steps: this.steps, captures: capturesByIndex});
    },
  },
  mounted() {
    this.seedPaymentDefault();
    this.syncUiMirror();
  },
  beforeUnmount() {
    consoleColoniesUi.composerSub = '';
    consoleColoniesUi.composerReady = false;
    consoleColoniesUi.composerEditable = false;
  },
});
</script>
