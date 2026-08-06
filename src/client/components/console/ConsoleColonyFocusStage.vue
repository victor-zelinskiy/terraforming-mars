<template>
  <!--
    COLONY FOCUS STAGE — the workspace's DEEPER state for ONE colony. Opened
    by A (trade) and X (inspect) alike: ONE stage, ONE source of truth. The
    crumb above (the section's ConsoleWsHead) already says
    «КОЛОНИИ › <colony> › <stage>», so the stage never titles itself.

    Layout: the HERO column (the colony itself — planet, live 7-position
    track, build slots + owners, fleet line, verdict) beside the WORK column
    (payment paths → your decisions → the live trade outcome — the exact
    rows the old trade-confirm modal carried, over the same pure modules).
    A non-tradeable colony keeps the SAME anatomy: the work column simply
    has no live payment pick and the verdict carries the honest reason.

    Controls live ONLY in the shell's bottom command bar (consoleColoniesUi
    mirror). B = one level back to the browse grid.
  -->
  <div class="con-colfocus" :class="{'con-colfocus--launching': launching}">
    <div class="con-colfocus__surface" data-unfold-surface>
      <!-- ── HERO — the colony as a physical object ─────────────────── -->
      <section class="con-colfocus__hero">
        <div class="con-colfocus__hero-top" data-unfold-item>
          <div class="con-colfocus__planetwrap">
            <div class="con-colfocus__planet" :class="planetClass" data-colony-focus-planet aria-hidden="true">
              <!-- The parked trade fleet rides the planet, same as the tile. -->
              <span v-if="colony.visitor !== undefined" class="con-colfocus__visitor" :class="'fleet-hue--' + colony.visitor">
                <ColonyFleetIcon :color="colony.visitor" />
              </span>
            </div>
            <span class="con-colfocus__state" :class="colony.isActive ? 'con-colfocus__state--on' : 'con-colfocus__state--off'">
              {{ $t(colony.isActive ? 'Active' : 'Not active yet') }}
            </span>
          </div>
          <div class="con-colfocus__desc" v-i18n>{{ metadata.trade.description }}</div>
        </div>

        <!-- The full 7-position trade track — the dossier's strongest asset,
             kept verbatim: [position | quantity | reward | tag]. -->
        <div class="con-colfocus__track" data-unfold-item>
          <div class="con-colfocus__sec-title">{{ $t('Trade track') }}</div>
          <div class="con-colfocus__track-table">
            <div v-for="cell in trackRows" :key="cell.index"
                 class="con-colfocus__track-row"
                 :class="{
                   'con-colfocus__track-row--marker': cell.marker,
                   'con-colfocus__track-row--effective': cell.effective,
                 }">
              <span class="con-colfocus__track-num">{{ cell.index + 1 }}</span>
              <span class="con-colfocus__track-qty">{{ cell.quantity > 0 ? cell.quantity : '—' }}</span>
              <span class="con-colfocus__track-glyph">
                <BenefitGlyph :benefit="tradeBenefitAt(cell.index)" :idx="cell.index" :cardResource="metadata.cardResource" />
              </span>
              <span v-if="cell.effective" class="con-colfocus__track-tag">{{ $t('Trade reads here') }}</span>
              <span v-else class="con-colfocus__track-tag con-colfocus__track-tag--void" aria-hidden="true"></span>
            </div>
          </div>
          <div v-if="offsetSteps > 0" class="con-colfocus__note">
            {{ $t('Your trade advances the track first') }} (+{{ offsetSteps }})
          </div>
        </div>

        <!-- Build slots + owners + the per-trade colony bonus recipients. -->
        <div class="con-colfocus__owners" data-unfold-item>
          <div class="con-colfocus__ownrow">
            <span class="con-colfocus__sec-title">{{ $t('Build a colony') }}</span>
            <span class="con-colfocus__slots">
              <span v-for="idx in [0, 1, 2]" :key="idx"
                    class="con-colfocus__slot"
                    :class="{'con-colfocus__slot--taken': colony.colonies[idx] !== undefined}">
                <PlayerCube v-if="colony.colonies[idx] !== undefined" :color="colony.colonies[idx]" :size="17" />
                <BenefitGlyph v-else :benefit="buildBenefit" :idx="idx" :cardResource="metadata.cardResource" />
              </span>
            </span>
          </div>
          <div class="con-colfocus__ownrow">
            <span class="con-colfocus__sec-title">{{ $t('Colony bonus (each trade)') }}</span>
            <span class="con-colfocus__bonusline">
              <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
              <template v-if="owners.length > 0">
                <span v-for="owner in owners" :key="owner.color" class="con-colfocus__owner">
                  <span :class="'con-status__dot player_bg_color_' + owner.color"></span>
                  <span>{{ owner.name }}</span>
                  <span v-if="owner.count > 1" class="con-colfocus__owner-mult">×{{ owner.count }}</span>
                </span>
              </template>
              <span v-else class="con-colfocus__muted">{{ $t('No colonies built here yet') }}</span>
            </span>
          </div>
          <div v-if="visitorLine !== ''" class="con-colfocus__fleetline">
            <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
            <span>{{ visitorLine }}</span>
          </div>
        </div>

        <!-- The honest verdict — tied to the colony it judges. -->
        <div class="con-colfocus__verdict" data-unfold-item
             :class="tradeable ? 'con-colfocus__verdict--ok' : 'con-colfocus__verdict--no'">
          <template v-if="tradeable">
            <span class="con-coltile__status-dot" aria-hidden="true"></span>
            <span>{{ $t('Trade available') }}</span>
          </template>
          <template v-else>
            <span aria-hidden="true">✕</span>
            <span>{{ blockReason !== '' ? $t(blockReason) : $t('Trade unavailable') }}</span>
          </template>
        </div>
      </section>

      <!-- ── WORK — payment · decisions · outcome (the trade composer) ── -->
      <section class="con-colfocus__work">
        <!-- SUB: the M€ lanes mix — the SHARED payment panel, expanded. -->
        <template v-if="sub === 'lanes' && paymentView !== undefined">
          <div class="con-colfocus__sub" data-unfold-item>
            <ConsolePaymentPanel :view="paymentView"
                                 mode="expanded"
                                 hint-mode="none"
                                 :focus-unit="payFocusUnit"
                                 :flash-nonce="payFlashNonce" />
          </div>
        </template>

        <!-- SUB: track advance choice (IncreaseColonyTrack). -->
        <template v-else-if="sub === 'track' && trackStep !== undefined">
          <div class="con-colfocus__sub" data-unfold-item>
            <div class="con-colfocus__sub-title">{{ $t('Increase colony track before trade') }}</div>
            <div v-for="(opt, i) in trackOptions" :key="'tr' + i"
                 class="con-task__option"
                 :class="{
                   'con-task__option--focused': subIdx === i,
                   'con-colfocus__option--chosen': captures['track'] === opt.steps,
                 }"
                 :ref="subIdx === i ? 'focusedEl' : undefined">
              <div class="con-task__option-main">
                <span class="con-task__opt-title">{{ opt.title }}</span>
                <span class="con-colfocus__track-reward">
                  <span v-if="opt.quantity > 1" class="con-colfocus__track-rewardqty">{{ opt.quantity }}</span>
                  <BenefitGlyph :benefit="tradeBenefitAt(opt.position)" :idx="opt.position" :cardResource="metadata.cardResource" />
                </span>
                <span v-if="captures['track'] === opt.steps" class="con-colfocus__opt-check" aria-hidden="true">✓</span>
              </div>
            </div>
          </div>
        </template>

        <!-- SUB: card-target picker (where the reward resources land). -->
        <template v-else-if="sub === 'targets' && activeTargetStep !== undefined">
          <div class="con-colfocus__sub" data-unfold-item>
            <div class="con-colfocus__sub-title">{{ targetSubTitle }}</div>
            <div v-for="(card, i) in activeTargetStep.pick.cards" :key="card.name"
                 class="con-task__option"
                 :class="{
                   'con-task__option--focused': subIdx === i,
                   'con-colfocus__option--chosen': captures[activeTargetKey] === card.name,
                 }"
                 :ref="subIdx === i ? 'focusedEl' : undefined">
              <div class="con-task__option-main">
                <i v-if="targetIconClass !== ''" class="con-task__opt-icon" :class="targetIconClass" aria-hidden="true"></i>
                <span class="con-task__opt-title">{{ cardLabel(card.name) }}</span>
                <span class="con-task__opt-preview">{{ card.resources ?? 0 }} → {{ (card.resources ?? 0) + activeTargetStep.amount }}</span>
                <span v-if="captures[activeTargetKey] === card.name" class="con-colfocus__opt-check" aria-hidden="true">✓</span>
              </div>
            </div>
          </div>
        </template>

        <!-- REVIEW: payment methods → decisions → the trade outcome. -->
        <template v-else>
          <ConsoleScrollArea class="con-colfocus__columns" content-class="con-colfocus__columns-grid" ref="scroll">
            <!-- 1 · EVERY payment path, affordable AND not (never hidden). -->
            <section class="con-colfocus__paysec" data-unfold-item>
              <div class="con-colfocus__sec-title">{{ $t('Payment method') }}</div>
              <template v-if="tradeable">
                <div v-for="(entry, i) in payEntries" :key="'p' + i"
                     class="con-colfocus__payrow"
                     :class="{
                       'con-colfocus__payrow--focused': isFocused('pay', i),
                       'con-colfocus__payrow--chosen': payIdx === i,
                     }"
                     :ref="isFocused('pay', i) ? 'focusedEl' : undefined">
                  <span class="con-colfocus__payrow-pick" aria-hidden="true">
                    <span v-if="payIdx === i" class="con-colfocus__payrow-dot"></span>
                  </span>
                  <i v-if="entry.iconClass !== ''" class="con-colfocus__payrow-icon" :class="entry.iconClass" aria-hidden="true"></i>
                  <span class="con-colfocus__payrow-title">{{ entry.title }}</span>
                  <span v-if="entry.preview !== ''" class="con-colfocus__payrow-delta">{{ entry.preview }}</span>
                </div>
              </template>
              <!-- Not tradeable: the same table, read-only — the full picture
                   stays visible (what a trade HERE would cost when possible). -->
              <template v-else>
                <div v-for="(entry, i) in payEntries" :key="'r' + i" class="con-colfocus__payrow con-colfocus__payrow--readonly">
                  <span class="con-colfocus__payrow-pick" aria-hidden="true"></span>
                  <i v-if="entry.iconClass !== ''" class="con-colfocus__payrow-icon" :class="entry.iconClass" aria-hidden="true"></i>
                  <span class="con-colfocus__payrow-title">{{ entry.title }}</span>
                  <span v-if="entry.preview !== ''" class="con-colfocus__payrow-delta">{{ entry.preview }}</span>
                </div>
              </template>
              <div v-for="(d, i) in disabledEntries" :key="'d' + i" class="con-colfocus__payrow con-colfocus__payrow--off">
                <span class="con-colfocus__payrow-pick" aria-hidden="true"></span>
                <i v-if="d.iconClass !== ''" class="con-colfocus__payrow-icon" :class="d.iconClass" aria-hidden="true"></i>
                <span class="con-colfocus__payrow-title">{{ d.title }}</span>
                <span class="con-colfocus__payrow-reason">{{ d.reason }}</span>
              </div>

              <!-- Follow-up decisions (M€ mix / track / card targets). -->
              <template v-if="tradeable && stepRows.length > 0">
                <div class="con-colfocus__sec-title con-colfocus__sec-title--steps">{{ $t('Your choices') }}</div>
                <div v-for="(row, i) in stepRows" :key="row.key"
                     class="con-colfocus__steprow"
                     :class="{
                       'con-colfocus__steprow--focused': isFocused('step', i),
                       'con-colfocus__steprow--missing': rowMissing(row),
                     }"
                     :ref="isFocused('step', i) ? 'focusedEl' : undefined">
                  <div class="con-colfocus__steprow-label">{{ $t(row.label) }}</div>
                  <div class="con-colfocus__steprow-value">
                    <template v-if="row.kind === 'payment'">
                      <span v-if="paymentSummary !== ''">{{ paymentSummary }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Configure payment') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'trackChoice'">
                      <span v-if="captures['track'] !== undefined">{{ trackSummary }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose the track advance') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'cardTarget' && row.step !== undefined">
                      <i v-if="row.iconClass !== ''" class="con-colfocus__steprow-icon" :class="row.iconClass" aria-hidden="true"></i>
                      <span v-if="captures[row.key] !== undefined">{{ $t(String(captures[row.key])) }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose a card') }}…</span>
                      <em v-if="captures[row.key] !== undefined">{{ targetImpact(row) }}</em>
                    </template>
                  </div>
                </div>
              </template>
            </section>

            <!-- 2 · The live trade outcome. -->
            <section class="con-colfocus__outsec" data-unfold-item>
              <div class="con-colfocus__sec-title">{{ $t('Trade outcome') }}</div>
              <div class="con-colfocus__out-grid">
                <div v-if="tradeable && outcome.cost.length > 0" class="con-colfocus__out-block">
                  <div class="con-colfocus__out-label">{{ $t('Payment') }}</div>
                  <div v-for="(chip, k) in outcome.cost" :key="'c' + k" class="con-colfocus__outrow con-colfocus__outrow--cost">
                    <i v-if="chip.icon" class="con-colfocus__outrow-icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
                    <b>−{{ chip.amount }}</b>
                    <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
                  </div>
                </div>
                <div class="con-colfocus__out-block">
                  <div class="con-colfocus__out-label">{{ $t('You will receive') }}</div>
                  <div v-for="(chip, k) in heroGains" :key="'g' + k" class="con-colfocus__outrow con-colfocus__outrow--gain" :class="{'con-colfocus__outrow--prod': chip.production}">
                    <i v-if="chip.icon && chip.icon !== 'cards' && chip.icon !== 'tr'" class="con-colfocus__outrow-icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
                    <span v-else-if="chip.icon === 'cards'" class="con-colfocus__outrow-badge">{{ $t('Cards') }}</span>
                    <span v-else-if="chip.icon === 'tr'" class="con-colfocus__outrow-badge con-colfocus__outrow-badge--tr">{{ $t('TR') }}</span>
                    <span v-if="chip.label" class="con-colfocus__outrow-text">{{ $t(chip.label) }}</span>
                    <b>+{{ chip.amount }}</b>
                    <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
                    <em v-else-if="chip.note" class="con-colfocus__outrow-note">{{ $t(chip.note) }}</em>
                  </div>
                  <div v-for="line in targetOutcomeLines" :key="line.key" class="con-colfocus__outrow con-colfocus__outrow--gain">
                    <i v-if="line.iconClass !== ''" class="con-colfocus__outrow-icon" :class="line.iconClass" aria-hidden="true"></i>
                    <b>+{{ line.amount }}</b>
                    <span class="con-colfocus__outrow-text">{{ $t(line.card) }}</span>
                    <em>{{ line.before }} → {{ line.after }}</em>
                  </div>
                </div>
              </div>

              <!-- Card-resource reward with no card to hold it ⇒ LOST. -->
              <div v-if="resourceLost" class="con-colfocus__notice con-colfocus__notice--warn con-colfocus__notice--lost">
                <span aria-hidden="true">⚠</span>
                <i v-if="metadata !== undefined" class="con-colfocus__notice-icon" :class="resourceIconClass(metadata.cardResource)" aria-hidden="true"></i>
                <span>{{ $t('Resource will be lost — no card') }}</span>
              </div>

              <!-- Auto target / lost resource / what follows the confirm. -->
              <div v-for="(notice, i) in noticeRows" :key="'n' + i"
                   class="con-colfocus__notice"
                   :class="'con-colfocus__notice--' + notice.tone">
                <span aria-hidden="true">{{ notice.tone === 'warn' ? '!' : '›' }}</span>
                <i v-if="notice.iconClass !== ''" class="con-colfocus__notice-icon" :class="notice.iconClass" aria-hidden="true"></i>
                <span>{{ notice.text }}</span>
              </div>

              <!-- The fixed tile bonus to OTHER colony owners (transparency). -->
              <div v-if="otherOwners.length > 0" class="con-colfocus__bonus">
                <span class="con-colfocus__bonus-label">{{ $t('Trade bonus to colonies here') }}:</span>
                <span class="con-colfocus__bonus-glyph">
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
      </section>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The COLONY FOCUS STAGE — the trade-confirm composer and the colony dossier
 * merged into ONE workspace stage (the two modals are gone). All numbers come
 * from the same pure modules both modals already read (`colonyTradePlan`,
 * `paymentPlan`, the server `ColonyTradePreviewModel`), so there is exactly
 * one source of truth for «what does trading here do».
 *
 * Input arrives via `handleIntent` (the shell routes the pad here while the
 * stage is open): d-pad walks payment rows + decision rows, A picks/opens,
 * X = the ONE final confirm (gated on every capture), RT = max the focused
 * lane, B = close a sub-editor / fold back to the browse grid (the shell owns
 * the fold). The bar mirrors через consoleColoniesUi.
 */
import {defineComponent, PropType} from 'vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {getCard} from '@/client/cards/ClientCardManifest';
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
import {translateMessage, translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {consoleColoniesUi, setColonyFocusStage} from '@/client/console/consoleColoniesModel';
import {
  paymentLanes,
  megacreditsAvailable,
  paymentFromCounts,
  initialCounts,
  laneCap,
  buildPaymentView,
  editableRows,
  PaymentLane,
  PaymentView,
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
import {presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';

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
type TrackRow = {index: number, quantity: number, marker: boolean, effective: boolean};

export default defineComponent({
  name: 'ConsoleColonyFocusStage',
  components: {BenefitGlyph, ColonyFleetIcon, PlayerCube, ConsoleScrollArea, ConsolePaymentPanel},
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    /** The trade window is open AND this colony is in its SelectColony set. */
    tradeable: {type: Boolean, default: false},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    blockReason: {type: String, default: ''},
    /** The inner "Pay trade fee" OrOptions options (server-affordable). */
    options: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    /** Unaffordable paths — shown disabled with the server reason. */
    disabledOptions: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    /** The shared server trade preview (undefined while loading — degrades). */
    preview: {type: Object as PropType<ColonyTradePreviewModel | undefined>, default: undefined},
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
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
      /** Re-keyed on each adjust so the dialed row's one-shot pulse replays. */
      payFlashNonce: 0,
      tradeFleetState,
    };
  },
  computed: {
    colonyName(): ColonyName {
      return this.colony.name as ColonyName;
    },
    /** The launch cinematic is running for THIS colony (the stage is folding
     *  under the lifting ship — keep the chrome inert). */
    launching(): boolean {
      return this.tradeFleetState.active && this.tradeFleetState.colonyName === this.colony.name;
    },
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    planetClass(): string {
      return this.colony.name.replace(' ', '-') + '-background';
    },
    /** The colony as PRESENTED (mid-trade the committed track reset stays
     *  frozen — the same shared helper the tile reads). */
    presented(): ColonyModel {
      return presentedColonyModel(this.colony);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    effectivePosition(): number {
      const offset = this.colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.presented, this.metadata, offset);
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - Math.min(this.presented.trackPosition, this.trackMax));
    },
    trackRows(): Array<TrackRow> {
      const marker = Math.min(this.presented.trackPosition, this.trackMax);
      const rows: Array<TrackRow> = [];
      for (let i = 0; i <= this.trackMax; i++) {
        rows.push({
          index: i,
          quantity: this.metadata.trade.quantity[i] ?? 0,
          marker: i === marker,
          effective: i === this.effectivePosition && this.effectivePosition !== marker,
        });
      }
      return rows;
    },
    buildBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    colonyBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    owners(): Array<{color: Color, count: number, name: string}> {
      return colonyOwnerCounts(this.colony).map((owner) => {
        const player = this.players.find((p) => p.color === owner.color);
        return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
      });
    },
    visitorLine(): string {
      const visitor = this.colony.visitor;
      if (visitor === undefined) {
        return '';
      }
      if (visitor === this.viewerColor) {
        return translateText('Your trade fleet is currently here');
      }
      const player = this.players.find((p) => p.color === visitor);
      if (player !== undefined) {
        return translateTextWithParams('Trade fleet of ${0} is currently here', [participantDisplayName(player)]);
      }
      return translateText('Trade fleet currently here');
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
    isMcSelected(): boolean {
      return this.options[this.payIdx]?.metadata?.icon === 'megacredits';
    },
    steps(): Array<TradeStep> {
      return this.tradeable ? tradeSteps(this.preview, this.isMcSelected) : [];
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
    focusables(): Array<Focusable> {
      if (!this.tradeable) {
        return [];
      }
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
      if (step === undefined) {
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
    paymentStep(): Extract<TradeStep, {kind: 'payment'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'payment');
      return step?.kind === 'payment' ? step : undefined;
    },
    payLanes(): ReadonlyArray<PaymentLane> {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      return step === undefined || player === undefined ? [] : paymentLanes(step.model, player);
    },
    paymentView(): PaymentView | undefined {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        return undefined;
      }
      return buildPaymentView({
        cost: step.model.amount,
        lanes: this.payLanes,
        counts: this.paymentCounts,
        mcAvailable: megacreditsAvailable(player),
      });
    },
    payFocusUnit(): string | undefined {
      const v = this.paymentView;
      return v === undefined || this.sub !== 'lanes' ? undefined : editableRows(v)[this.subIdx]?.unit;
    },
    paymentSummary(): string {
      const view = this.paymentView;
      if (view === undefined) {
        return '';
      }
      const parts: Array<string> = [];
      for (const row of view.rows) {
        if (row.auto) {
          continue;
        }
        if (row.used > 0) {
          parts.push(`${row.used} ${translateText(row.labelKey)}`);
        }
      }
      const mc = view.rows.find((r) => r.auto)?.used ?? 0;
      if (mc > 0 || parts.length === 0) {
        parts.push(`${mc} M€`);
      }
      return parts.join(' + ');
    },
    rewardPosition(): number {
      const track = this.preview?.track;
      const chosen = this.captures['track'];
      if (typeof chosen === 'number') {
        const current = track?.current ?? this.colony.trackPosition;
        return Math.min(current + chosen, this.metadata.trade.quantity.length - 1);
      }
      if (track !== undefined) {
        return track.effective;
      }
      return this.effectivePosition;
    },
    ownColonyCount(): number {
      if (this.viewerColor === undefined) {
        return 0;
      }
      return this.colony.colonies.filter((c) => c === this.viewerColor).length;
    },
    outcome(): {cost: Array<TradeOutcomeChip>, gains: Array<TradeOutcomeChip>} {
      const player = this.thisPlayer;
      const meta = this.tradeable ? this.options[this.payIdx]?.metadata : undefined;
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
    heroGains(): Array<TradeOutcomeChip> {
      const capturedIcons = new Set(this.targetOutcomeLines.map((l) => l.resourceKey));
      return this.outcome.gains.filter((chip) =>
        !(chip.note === 'to a card' && chip.icon !== undefined && capturedIcons.has(chip.icon)));
    },
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
    resourceLost(): boolean {
      const meta = this.metadata;
      if (meta.cardResource === undefined) {
        return false;
      }
      const t = meta.trade.type;
      if (t !== ColonyBenefit.ADD_RESOURCES_TO_CARD && t !== ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD) {
        return false;
      }
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const tableau = viewer?.tableau ?? [];
      return !tableau.some((card) => getCard(card.name)?.resourceType === meta.cardResource);
    },
    otherOwners(): Array<{color: Color, count: number, name: string}> {
      return colonyOwnerCounts(this.colony)
        .filter((owner) => owner.color !== this.viewerColor)
        .map((owner) => {
          const player = this.players.find((p) => p.color === owner.color);
          return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
        });
    },
    noticeRows(): Array<NoticeRow> {
      if (!this.tradeable) {
        return [];
      }
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
      if (!this.tradeable) {
        return false;
      }
      if (this.paymentView !== undefined && !this.paymentView.status.ok) {
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
        return this.payLanes.length > 0;
      }
      return true;
    },
  },
  watch: {
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
    // Paging to another colony (LB/RB) re-bases every decision: captures are
    // per-colony truths and must never leak across.
    'colony.name'() {
      this.captures = {};
      this.sub = undefined;
      this.subIdx = 0;
      this.payIdx = 0;
      this.focusIdx = 0;
      this.seedPaymentDefault();
      this.publishStageName();
      this.syncUiMirror();
    },
    tradeable() {
      this.publishStageName();
      this.syncUiMirror();
    },
  },
  methods: {
    cardLabel(name: string): string {
      return translateCardName(name);
    },
    isFocused(zone: 'pay' | 'step', index: number): boolean {
      return this.sub === undefined && this.focused?.zone === zone && this.focused.index === index;
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
      const t = this.metadata.trade;
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
    /** The stage names its crumb tail (rule 5 — never a header of its own). */
    publishStageName(): void {
      setColonyFocusStage(this.tradeable ? 'Trading' : 'Inspection');
    },
    syncUiMirror(): void {
      consoleColoniesUi.composerSub = this.sub === undefined ? '' : (this.sub === 'lanes' ? 'lanes' : 'list');
      consoleColoniesUi.composerReady = this.canConfirm;
      consoleColoniesUi.composerEditable = this.focusedRowEditable;
    },
    /** The shell routes every intent here while the stage is open. */
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
        this.subIdx = Math.min(this.payLanes.length - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        return;
      }
      this.adjustPayLane(this.subIdx, dir === 'right' ? 1 : -1);
    },
    adjustPayLane(idx: number, step: number, toMax = false): void {
      const view = this.paymentView;
      const lane = this.payLanes[idx];
      if (view === undefined || lane === undefined) {
        return;
      }
      const cap = laneCap(view.cost, lane);
      const before = this.paymentCounts[lane.unit] ?? 0;
      const next = toMax ? cap : Math.min(cap, Math.max(0, before + step));
      if (next === before) {
        return;
      }
      this.paymentCounts = {...this.paymentCounts, [lane.unit]: next};
      this.payFlashNonce += 1;
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
        if (this.sub === 'lanes') {
          this.adjustPayLane(this.subIdx, 0, true);
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
        if (this.paymentView?.status.ok === true) {
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
        return this.paymentView !== undefined && !this.paymentView.status.ok;
      }
      return false;
    },
    scrollFocusedIntoView(): void {
      void this.$nextTick(() => {
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
    emitConfirm(): void {
      const capturesByIndex: Record<number, unknown> = {};
      this.steps.forEach((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          const view = this.paymentView;
          const player = this.thisPlayer;
          if (view !== undefined && player !== undefined) {
            capturesByIndex[i] = paymentFromCounts(view.cost, this.payLanes, this.paymentCounts, megacreditsAvailable(player));
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
    this.publishStageName();
    this.syncUiMirror();
  },
  beforeUnmount() {
    consoleColoniesUi.composerSub = '';
    consoleColoniesUi.composerReady = false;
    consoleColoniesUi.composerEditable = false;
  },
});
</script>
