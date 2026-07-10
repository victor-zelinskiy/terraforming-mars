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

      <div class="con-task__main con-trade__main">
        <!-- ── SUB: the M€ payment lanes (heat / alt resources). ─────── -->
        <template v-if="sub === 'lanes' && paymentView !== undefined">
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

        <!-- ── REVIEW: payment methods → decisions → the trade outcome. ── -->
        <template v-else>
          <ConsoleScrollArea class="con-trade__columns" content-class="con-trade__columns-grid" ref="scroll">
            <!-- 1 · EVERY payment path, affordable AND not (never hidden). -->
            <section class="con-trade__paysec">
              <div class="con-trade__sec-title">{{ $t('Payment method') }}</div>
              <div v-for="(entry, i) in payEntries" :key="'p' + i"
                   class="con-trade__payrow"
                   :class="{
                     'con-trade__payrow--focused': isFocused('pay', i),
                     'con-trade__payrow--chosen': payIdx === i,
                   }"
                   :ref="isFocused('pay', i) ? 'focusedEl' : undefined">
                <span class="con-trade__payrow-pick" aria-hidden="true">
                  <span v-if="payIdx === i" class="con-trade__payrow-dot"></span>
                </span>
                <i v-if="entry.iconClass !== ''" class="con-trade__payrow-icon" :class="entry.iconClass" aria-hidden="true"></i>
                <span class="con-trade__payrow-title">{{ entry.title }}</span>
                <span v-if="entry.preview !== ''" class="con-trade__payrow-delta">{{ entry.preview }}</span>
              </div>
              <div v-for="(d, i) in disabledEntries" :key="'d' + i" class="con-trade__payrow con-trade__payrow--off">
                <span class="con-trade__payrow-pick" aria-hidden="true"></span>
                <i v-if="d.iconClass !== ''" class="con-trade__payrow-icon" :class="d.iconClass" aria-hidden="true"></i>
                <span class="con-trade__payrow-title">{{ d.title }}</span>
                <span class="con-trade__payrow-reason">{{ d.reason }}</span>
              </div>

              <!-- Follow-up decisions (M€ mix / track / card targets). -->
              <template v-if="stepRows.length > 0">
                <div class="con-trade__sec-title con-trade__sec-title--steps">{{ $t('Your choices') }}</div>
                <div v-for="(row, i) in stepRows" :key="row.key"
                     class="con-trade__steprow"
                     :class="{
                       'con-trade__steprow--focused': isFocused('step', i),
                       'con-trade__steprow--missing': rowMissing(row),
                     }"
                     :ref="isFocused('step', i) ? 'focusedEl' : undefined">
                  <div class="con-trade__steprow-label">{{ $t(row.label) }}</div>
                  <div class="con-trade__steprow-value">
                    <template v-if="row.kind === 'payment'">
                      <span v-if="paymentSummary !== ''">{{ paymentSummary }}</span>
                      <span v-else class="con-trade__steprow-empty">{{ $t('Configure payment') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'trackChoice'">
                      <span v-if="captures['track'] !== undefined">{{ trackSummary }}</span>
                      <span v-else class="con-trade__steprow-empty">{{ $t('Choose the track advance') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'cardTarget' && row.step !== undefined">
                      <i v-if="row.iconClass !== ''" class="con-trade__steprow-icon" :class="row.iconClass" aria-hidden="true"></i>
                      <span v-if="captures[row.key] !== undefined">{{ $t(String(captures[row.key])) }}</span>
                      <span v-else class="con-trade__steprow-empty">{{ $t('Choose a card') }}…</span>
                      <em v-if="captures[row.key] !== undefined">{{ targetImpact(row) }}</em>
                    </template>
                  </div>
                </div>
              </template>
            </section>

            <!-- 2 · The live trade outcome (Итог торговли). -->
            <section class="con-trade__outsec">
              <div class="con-trade__sec-title">{{ $t('Trade outcome') }}</div>
              <div class="con-trade__out-grid">
                <div v-if="outcome.cost.length > 0" class="con-trade__out-block">
                  <div class="con-trade__out-label">{{ $t('Payment') }}</div>
                  <div v-for="(chip, k) in outcome.cost" :key="'c' + k" class="con-trade__outrow con-trade__outrow--cost">
                    <i v-if="chip.icon" class="con-trade__outrow-icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
                    <b>−{{ chip.amount }}</b>
                    <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
                  </div>
                </div>
                <div class="con-trade__out-block">
                  <div class="con-trade__out-label">{{ $t('You will receive') }}</div>
                  <div v-for="(chip, k) in heroGains" :key="'g' + k" class="con-trade__outrow con-trade__outrow--gain" :class="{'con-trade__outrow--prod': chip.production}">
                    <i v-if="chip.icon && chip.icon !== 'cards' && chip.icon !== 'tr'" class="con-trade__outrow-icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
                    <span v-else-if="chip.icon === 'cards'" class="con-trade__outrow-badge">{{ $t('Cards') }}</span>
                    <span v-else-if="chip.icon === 'tr'" class="con-trade__outrow-badge con-trade__outrow-badge--tr">{{ $t('TR') }}</span>
                    <span v-if="chip.label" class="con-trade__outrow-text">{{ $t(chip.label) }}</span>
                    <b>+{{ chip.amount }}</b>
                    <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
                    <em v-else-if="chip.note" class="con-trade__outrow-note">{{ $t(chip.note) }}</em>
                  </div>
                  <!-- Captured card targets: the concrete on-card before → after. -->
                  <div v-for="line in targetOutcomeLines" :key="line.key" class="con-trade__outrow con-trade__outrow--gain">
                    <i v-if="line.iconClass !== ''" class="con-trade__outrow-icon" :class="line.iconClass" aria-hidden="true"></i>
                    <b>+{{ line.amount }}</b>
                    <span class="con-trade__outrow-text">{{ $t(line.card) }}</span>
                    <em>{{ line.before }} → {{ line.after }}</em>
                  </div>
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
            </section>
          </ConsoleScrollArea>
        </template>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE COLONY-TRADE COMPOSER (iteration 2). Three-part flow in ONE view:
 * (1) «Способ оплаты» — EVERY payment path, affordable AND unaffordable
 * (disabled with its reason; the full picture is never hidden), each with
 * required / current → resulting; d-pad walks the affordable rows, A picks.
 * (2) «Ваши решения» — the pre-collect follow-ups (M€ lanes mix / track
 * advance / card targets), each a row A opens. (3) «Итог торговли» — the
 * live outcome: payment → gains with before → after (incl. flat modifiers
 * like Venus Trade Hub and the captured on-card targets), honest notices,
 * and the other owners' fixed tile bonus. X = the one final confirm (gated
 * on every capture), B = back/cancel. Hints live ONLY in the shell's bottom
 * bar (mirrored via consoleColoniesUi). The parent builds the byte-identical
 * PlayerInputBatch via colonyTradePlan.buildTradeBatch.
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
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
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
  effectiveTradePosition,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  TradeOutcomeChip,
  tradeSteps,
} from '@/client/components/colonies/colonyTradePlan';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type PayEntry = {title: string, iconClass: string, preview: string};
type StepRow = {
  key: string,
  kind: 'payment' | 'trackChoice' | 'cardTarget',
  label: string,
  iconClass: string,
  step?: Extract<TradeStep, {kind: 'cardTarget'}>,
};
type Sub = undefined | 'lanes' | 'track' | 'targets';
type NoticeRow = {tone: 'warn' | 'info', iconClass: string, text: string};
type Focusable = {zone: 'pay' | 'step', index: number};

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
  components: {BenefitGlyph, ConsoleScrollArea},
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
        const rec = d as {title?: string | Message, label?: string | Message, reason?: string | Message, metadata?: {icon?: string, resource?: {current: number}}};
        const current = rec.metadata?.resource?.current;
        const title = textOf(rec.title ?? rec.label);
        return {
          title: current !== undefined ? `${title} · ${current}` : title,
          iconClass: rec.metadata?.icon !== undefined ? iconClassFor(rec.metadata.icon) + ' con-task__opt-res' : '',
          reason: textOf(rec.reason),
        };
      });
    },
    /** The chosen payment path uses M€ (its own prompt may need the lanes mix). */
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
    stepRows(): Array<StepRow> {
      return this.steps.map((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          return {key, kind: 'payment' as const, label: 'Payment', iconClass: ''};
        }
        if (step.kind === 'trackChoice') {
          return {key, kind: 'trackChoice' as const, label: 'Colony track', iconClass: ''};
        }
        return {
          key,
          kind: 'cardTarget' as const,
          label: step.role === 'tradeReward' ? 'Trade reward target' : 'Colony bonus target',
          iconClass: this.resourceIconClass(step.resource),
          step,
        };
      });
    },
    /** The d-pad walk: affordable payment rows first, then the step rows. */
    focusables(): Array<Focusable> {
      const out: Array<Focusable> = this.payEntries.map((_, i) => ({zone: 'pay' as const, index: i}));
      this.stepRows.forEach((_, i) => out.push({zone: 'step', index: i}));
      return out;
    },
    focused(): Focusable | undefined {
      return this.focusables[this.focusIdx];
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
      const focused = this.focused;
      if (focused?.zone !== 'step') {
        return undefined;
      }
      const row = this.stepRows[focused.index];
      return row?.kind === 'cardTarget' ? row.step : undefined;
    },
    activeTargetKey(): string {
      const focused = this.focused;
      return focused?.zone === 'step' ? (this.stepRows[focused.index]?.key ?? '') : '';
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
      // An explicit track-advance choice (a willAsk colony) always wins.
      if (typeof chosen === 'number') {
        const current = track?.current ?? this.colony?.trackPosition ?? 0;
        return Math.min(current + chosen, (this.metadata?.trade.quantity.length ?? 7) - 1);
      }
      // Auto-advance: the server preview is authoritative once loaded. Until it
      // arrives (it fetches in the background), compute the effective
      // (offset-advanced) position CLIENT-side — the SAME calc the inspect uses
      // — so the reward is correct IMMEDIATELY, never the un-advanced marker
      // (the +1 offset would otherwise be dropped, showing a lower reward).
      if (track !== undefined) {
        return track.effective;
      }
      if (this.colony !== undefined && this.metadata !== undefined) {
        return effectiveTradePosition(this.colony, this.metadata, this.thisPlayer?.colonyTradeOffset ?? 0);
      }
      return Math.min(this.colony?.trackPosition ?? 0, 6);
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
        flatBonuses: this.preview?.flatBonuses,
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
    /** Gains with the captured card targets resolved (the chip collapses —
     *  the concrete on-card line below carries the before → after). */
    heroGains(): Array<TradeOutcomeChip> {
      const capturedIcons = new Set(this.targetOutcomeLines.map((l) => l.resourceKey));
      return this.outcome.gains.filter((chip) =>
        !(chip.note === 'to a card' && chip.icon !== undefined && capturedIcons.has(chip.icon)));
    },
    /** Concrete captured targets: card + on-card before → after. */
    targetOutcomeLines(): Array<{key: string, card: string, amount: number, before: number, after: number, iconClass: string, resourceKey: string}> {
      const lines: Array<{key: string, card: string, amount: number, before: number, after: number, iconClass: string, resourceKey: string}> = [];
      let ordinal = -1;
      for (const row of this.stepRows) {
        if (row.kind !== 'cardTarget' || row.step === undefined) {
          continue;
        }
        ordinal++;
        const captured = this.captures[row.key];
        const name = typeof captured === 'string' ? captured : undefined;
        const card = row.step.pick.cards.find((c) => c.name === name);
        if (card === undefined) {
          continue;
        }
        const before = card.resources ?? 0;
        lines.push({
          key: `line:${ordinal}`,
          card: card.name,
          amount: row.step.amount,
          before,
          after: before + row.step.amount,
          iconClass: row.iconClass,
          resourceKey: this.resourceKey(row.step.resource) ?? '',
        });
      }
      return lines;
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
      const focused = this.focused;
      if (focused === undefined) {
        return false;
      }
      if (focused.zone === 'pay') {
        return true;
      }
      const row = this.stepRows[focused.index];
      if (row === undefined) {
        return false;
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
    isFocused(zone: 'pay' | 'step', index: number): boolean {
      return this.sub === undefined && this.focused?.zone === zone && this.focused.index === index;
    },
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
    targetImpact(row: StepRow): string {
      const step = row.step;
      if (step === undefined) {
        return '';
      }
      const captured = this.captures[row.key];
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
    /** The shell routes every intent here while the confirm is open.
     *  Foundation: presses resolve to SEMANTIC actions (no raw button names). */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
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
        this.focusIdx = Math.min(this.focusables.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        this.scrollFocusedIntoView();
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
      if (this.sub === 'track') {
        return this.trackOptions.length;
      }
      if (this.sub === 'targets') {
        return this.activeTargetStep?.pick.cards.length ?? 0;
      }
      return 0;
    },
    onPress(action: ConsoleAction): void {
      switch (action) {
      case 'primary':
        this.onConfirmPress();
        return;
      case 'inspect':
        // X = the one final confirm (only when every decision is captured).
        if (this.sub === undefined && this.canConfirm) {
          this.emitConfirm();
        } else if (this.sub !== undefined) {
          this.onConfirmPress();
        }
        return;
      case 'nextTab':
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
      // Review: A on a payment row PICKS it; A on a step row opens its editor.
      const focused = this.focused;
      if (focused === undefined) {
        return;
      }
      if (focused.zone === 'pay') {
        this.payIdx = focused.index;
        return;
      }
      const row = this.stepRows[focused.index];
      if (row === undefined) {
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
    rowMissing(row: StepRow): boolean {
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
    scrollFocusedIntoView(): void {
      void this.$nextTick(() => {
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
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
