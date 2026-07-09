<template>
  <!--
    Premium trade confirmation + payment picker. Mounted by PlayerHome the
    moment the player presses ТОРГОВАТЬ on a colony — ALWAYS, even when only one
    pay path exists, so the trade is never submitted without an explicit confirm.

    Shows: a colony summary (planet + name + what you receive at the current
    track position), every payment option as a rich card (resource icon + cost +
    your stock + current→resulting), and the UNAFFORDABLE options DISABLED with a
    reason (never hidden). Select → confirm; nothing reaches the server until the
    primary CTA is pressed.
  -->
  <div class="colony-trade-pay">
    <header class="colony-trade-pay__header">
      <div class="colony-trade-pay__header-tab"></div>
      <div class="colony-trade-pay__header-text">
        <h3 class="colony-trade-pay__title" v-i18n>Trade</h3>
        <p class="colony-trade-pay__subtitle">
          <span v-i18n>Pick how to pay for trading with</span>
          <span class="colony-trade-pay__colony-name" v-i18n>{{ colonyName }}</span>
        </p>
      </div>
    </header>

    <!-- Colony summary: which colony + what you receive. -->
    <div v-if="colony !== undefined" class="colony-trade-pay__colony">
      <span class="colony-trade-pay__colony-planet" :class="planetClass" aria-hidden="true"></span>
      <div class="colony-trade-pay__colony-info">
        <span class="colony-trade-pay__colony-title">{{ translatedColonyName }}</span>
        <span v-if="tradeReward !== undefined" class="colony-trade-pay__colony-reward">
          <span class="colony-trade-pay__colony-reward-label" v-i18n>You receive</span>
          <BenefitGlyph :benefit="tradeReward" :idx="0" :cardResource="cardResource" />
        </span>
        <!--
          Trade-offset (Trade Agent / Trading Colony / Trade Envoys): the colony
          track ADVANCES first, so the reward above is read at the higher position.
          Make this explicit — by how much the track moves, and what the reward
          would have been WITHOUT the advance — so the bigger reward isn't a surprise.
        -->
        <div v-if="trackMoveSteps > 0" class="colony-trade-pay__track-offset" data-test="colony-trade-track-offset">
          <span class="colony-trade-pay__track-offset-note">
            <span class="colony-trade-pay__track-offset-arrow" aria-hidden="true">⬆</span>
            <span v-i18n>The colony track advances first</span>
            <span class="colony-trade-pay__track-offset-steps">+{{ trackMoveSteps }}</span>
          </span>
          <span v-if="showBaseReward && baseTradeReward !== undefined" class="colony-trade-pay__track-offset-base">
            <span class="colony-trade-pay__track-offset-base-label" v-i18n>Without the advance</span>
            <BenefitGlyph :benefit="baseTradeReward" :idx="0" :cardResource="cardResource" />
          </span>
        </div>
      </div>
    </div>

    <!-- Итог торговли: the standard money/resource lines with an honest
         current → resulting (payment applied first — paying 3 energy into a
         4-energy reward reads 3 → 0, then 0 → 4). -->
    <div v-if="outcomeChips.length > 0" class="colony-trade-pay__outcome" data-test="colony-trade-outcome">
      <span class="colony-trade-pay__outcome-label" v-i18n>Trade outcome</span>
      <span v-for="(chip, i) in outcomeChips" :key="'oc' + i"
            class="colony-trade-pay__outcome-chip"
            :class="'colony-trade-pay__outcome-chip--' + chip.direction">
        <span v-if="chip.icon !== undefined && chip.icon !== 'cards' && chip.icon !== 'tr'"
              class="colony-trade-pay__outcome-icon modal-input__option-icon"
              :class="chipIcon(chip)"
              :aria-hidden="true"></span>
        <span v-else-if="chip.icon === 'cards'" class="colony-trade-pay__outcome-badge" v-i18n>Cards</span>
        <span v-else-if="chip.icon === 'tr'" class="colony-trade-pay__outcome-badge" v-i18n>TR</span>
        <span v-if="chip.label !== undefined" class="colony-trade-pay__outcome-text" v-i18n>{{ chip.label }}</span>
        <b>{{ chip.direction === 'cost' ? '−' : '+' }}{{ chip.amount }}</b>
        <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
        <em v-else-if="chip.note !== undefined" v-i18n>{{ chip.note }}</em>
      </span>
    </div>

    <!-- Track-advance choice (an `ask` colony + a trade offset): the server
         would prompt AFTER the trade — decide it HERE instead. -->
    <div v-if="trackStep !== undefined" class="colony-trade-pay__track-choice" data-test="colony-trade-track-choice">
      <span class="colony-trade-pay__step-label" v-i18n>Increase colony track before trade</span>
      <div class="colony-trade-pay__track-options">
        <button v-for="opt in trackOptions"
                :key="'tc' + opt.steps"
                type="button"
                class="colony-trade-pay__track-btn"
                :class="{'colony-trade-pay__track-btn--on': trackChosen === opt.steps}"
                @click="chooseTrack(opt.steps)">
          <span>{{ opt.label }}</span>
          <span class="colony-trade-pay__track-btn-reward">
            <span v-if="opt.quantity > 1" class="colony-trade-pay__track-btn-qty">{{ opt.quantity }}</span>
            <BenefitGlyph :benefit="rewardBenefitAt(opt.position)" :idx="opt.position" :cardResource="cardResource" />
          </span>
        </button>
      </div>
    </div>

    <!-- PRE-SELECT: where a card-resource reward lands — decided BEFORE the
         confirm (never behind the board). One picker per card-target step. -->
    <template v-if="!paymentPromptBlocks">
      <div v-for="(step, i) in cardTargetSteps" :key="'ct' + i" class="colony-trade-pay__targets" data-test="colony-trade-targets">
        <span class="colony-trade-pay__step-label">
          {{ $t(step.role === 'tradeReward' ? 'Trade reward target' : 'Colony bonus target') }}
        </span>
        <!-- Globally-registered async component (main.ts) — a static Card.vue
             import would break the mochapack client-test bundle. -->
        <action-target-card v-if="playerView !== undefined"
                            :input="step.pick"
                            :playerView="playerView"
                            :selectedName="targetName(i)"
                            :amount="step.amount"
                            @change="captureTarget(i, $event)" />
      </div>
    </template>
    <div v-else-if="cardTargetSteps.length > 0" class="colony-trade-pay__notice colony-trade-pay__notice--info">
      <span aria-hidden="true">›</span>
      <span v-i18n>After confirming: choose how to pay, then pick the target card</span>
    </div>

    <!-- Display-only notices: the explicit single-candidate auto target, the
         honest lost-resource warning, and what still follows after confirming. -->
    <div v-for="(notice, i) in noticeRows" :key="'nt' + i"
         class="colony-trade-pay__notice"
         :class="'colony-trade-pay__notice--' + notice.tone">
      <span aria-hidden="true">{{ notice.tone === 'warn' ? '!' : '›' }}</span>
      <span>{{ notice.text }}</span>
    </div>

    <!--
      SECONDARY transparency block: who ELSE gains the (fixed) colony bonus when
      you trade here. Shown ONLY when colonies are already built on this tile, so
      it never appears for an empty colony and never steals focus from the payment
      decision. A player with several colonies here shows an explicit ×N.
    -->
    <div v-if="beneficiaries.length > 0" class="colony-trade-pay__bonus">
      <div class="colony-trade-pay__bonus-head">
        <span class="colony-trade-pay__bonus-label" v-i18n>Trade bonus to colonies here</span>
        <span v-if="colonyBonus !== undefined" class="colony-trade-pay__bonus-reward">
          <BenefitGlyph :benefit="colonyBonus" :idx="0" :cardResource="cardResource" />
        </span>
      </div>
      <div class="colony-trade-pay__bonus-list">
        <span v-for="b in beneficiaries"
              :key="'ben-' + b.color"
              class="colony-trade-pay__bonus-chip"
              :data-test="'colony-trade-bonus-' + b.color">
          <span class="colony-trade-pay__bonus-cube" :class="'player_bg_color_' + b.color" aria-hidden="true"></span>
          <span class="colony-trade-pay__bonus-name">{{ b.name }}</span>
          <span v-if="b.count > 1" class="colony-trade-pay__bonus-count">×{{ b.count }}</span>
        </span>
      </div>
    </div>

    <div class="colony-trade-pay__options">
      <button v-for="(opt, idx) in options"
              :key="'pay-' + idx"
              type="button"
              class="colony-trade-pay__option"
              :class="{'colony-trade-pay__option--selected': selectedIdx === idx}"
              @click="selectedIdx = idx"
              :data-test="'colony-trade-pay-opt-' + idx">
        <span v-if="iconClass(opt.metadata) !== ''"
              class="colony-trade-pay__option-icon modal-input__option-icon"
              :class="iconClass(opt.metadata)"
              aria-hidden="true"></span>
        <span class="colony-trade-pay__option-body">
          <span class="colony-trade-pay__option-label">{{ optionLabel(opt) }}</span>
          <span v-if="hasStock(opt.metadata)" class="colony-trade-pay__option-stock">
            <span v-i18n>In stock</span>: {{ current(opt.metadata) }} → {{ resulting(opt.metadata) }}
          </span>
        </span>
        <span v-if="selectedIdx === idx" class="colony-trade-pay__option-check" aria-hidden="true">✓</span>
      </button>

      <!-- Unaffordable payment paths — visible but disabled, with a reason. -->
      <div v-for="(opt, idx) in disabledOptions"
           :key="'pay-disabled-' + idx"
           class="colony-trade-pay__option colony-trade-pay__option--disabled"
           :data-hint="reasonText(opt)"
           :data-test="'colony-trade-pay-disabled-' + idx">
        <span v-if="iconClass(opt.metadata) !== ''"
              class="colony-trade-pay__option-icon modal-input__option-icon"
              :class="iconClass(opt.metadata)"
              aria-hidden="true"></span>
        <span class="colony-trade-pay__option-body">
          <span class="colony-trade-pay__option-label">{{ optionLabel(opt) }}</span>
          <span v-if="hasStock(opt.metadata)" class="colony-trade-pay__option-stock">
            <span v-i18n>In stock</span>: {{ current(opt.metadata) }}
          </span>
        </span>
        <span class="colony-trade-pay__option-reason">{{ reasonText(opt) }}</span>
      </div>
    </div>

    <div class="colony-trade-pay__actions">
      <div class="colony-trade-pay__confirm-wrap" :data-hint="confirmDisabledReason">
        <button type="button"
                class="colony-trade-pay__confirm"
                :disabled="!canConfirm"
                @click="confirm"
                data-test="colony-trade-pay-confirm">
          <span v-i18n>Confirm trade</span>
        </button>
      </div>
      <button type="button"
              class="colony-trade-pay__cancel"
              @click="$emit('cancel')"
              data-test="colony-trade-pay-cancel">
        <span v-i18n>Cancel</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {CardResource} from '@/common/CardResource';
import {Color} from '@/common/Color';
import {PublicPlayerModel, PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, DisabledOptionModel, OptionMetadata} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {SelectCardResponse} from '@/common/inputs/InputResponse';
import {translateText, translateMessage, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {
  TradeOutcomeChip,
  TradeStep,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  tradeSteps,
} from '@/client/components/colonies/colonyTradePlan';
import BenefitGlyph from './BenefitGlyph.vue';

type DataModel = {
  selectedIdx: number;
  /** Captured pre-select answers by STABLE step key ('track' / 'target:N') —
   *  key-based so switching the payment path (which inserts/removes the
   *  payment step) can't shift them. */
  captures: Record<string, unknown>;
};

export default defineComponent({
  name: 'ColonyTradePaymentModal',
  components: {BenefitGlyph},
  props: {
    colony: {
      type: Object as () => ColonyModel | undefined,
      default: undefined,
    },
    colonyName: {
      type: String as () => ColonyName,
      required: true,
    },
    // Affordable payment options (the inner "Pay trade fee" OrOptions options).
    options: {
      type: Array as () => ReadonlyArray<SelectOptionModel>,
      required: true,
    },
    // Unaffordable standard-resource paths, shown disabled with a reason.
    disabledOptions: {
      type: Array as () => ReadonlyArray<DisabledOptionModel>,
      default: () => [],
    },
    // Public player models — used to name the colony-bonus beneficiaries.
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      default: () => [],
    },
    // The trading player's standing colony-track trade OFFSET (Trade Agent /
    // Trading Colony / Trade Envoys). When > 0 the track FIRST advances by this
    // much, so the reward is read at the HIGHER position — the modal must show
    // that (the track moves +N) and the actual vs. without-advance reward.
    tradeOffset: {
      type: Number,
      default: 0,
    },
    // The shared server trade preview (`/api/game/colony-trade-preview`) —
    // track advance / pre-selectable card targets / the M€ payment prompt.
    // Undefined while loading; the modal degrades to manifest-only rendering.
    preview: {
      type: Object as PropType<ColonyTradePreviewModel | undefined>,
      default: undefined,
    },
    // The full player view — the card-target picker (ActionTargetCard) needs
    // it to attribute candidate owners.
    playerView: {
      type: Object as PropType<PlayerViewModel | undefined>,
      default: undefined,
    },
    viewerColor: {
      type: String as PropType<Color | undefined>,
      default: undefined,
    },
  },
  emits: ['select', 'cancel'],
  data(): DataModel {
    return {selectedIdx: -1, captures: {}};
  },
  computed: {
    translatedColonyName(): string {
      return translateText(this.colonyName);
    },
    planetClass(): string {
      return this.colonyName.replace(' ', '-') + '-background';
    },
    cardResource(): CardResource | undefined {
      return getColony(this.colonyName)?.cardResource;
    },
    // The track position the trade actually reads its reward at: the current
    // position PLUS the player's standing offset (Trade Agent etc.), capped at the
    // track max (6). Mirrors the server's `Colony.trade` math.
    rewardTrackPosition(): number {
      if (this.colony === undefined) {
        return 0;
      }
      return Math.min(this.colony.trackPosition + Math.max(0, this.tradeOffset), 6);
    },
    // How many steps the track WILL advance before this trade (0 when the player
    // has no offset, or the track is already maxed).
    trackMoveSteps(): number {
      if (this.colony === undefined) {
        return 0;
      }
      return this.rewardTrackPosition - Math.min(this.colony.trackPosition, 6);
    },
    // The ACTUAL trade reward — read at the post-offset position, so a player with
    // a trade-offset effect sees what they'll really get, not the lower base.
    tradeReward(): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} | undefined {
      return this.rewardAtPosition(this.rewardTrackPosition);
    },
    // The reward the player WOULD get at the current position (no offset) — shown
    // as a "without the advance" comparison only when the track actually moves.
    baseTradeReward(): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} | undefined {
      if (this.colony === undefined) {
        return undefined;
      }
      return this.rewardAtPosition(Math.min(this.colony.trackPosition, 6));
    },
    // Whether to show the without-advance comparison: the track moved AND the
    // reward quantity actually differs (a track plateau yields the same reward, so
    // the comparison would be noise — the "+N" note alone suffices then).
    showBaseReward(): boolean {
      if (this.trackMoveSteps <= 0 || this.baseTradeReward === undefined || this.tradeReward === undefined) {
        return false;
      }
      return (this.baseTradeReward.quantity[0] ?? 0) !== (this.tradeReward.quantity[0] ?? 0);
    },
    // The FIXED colony bonus EVERY player with a colony on this tile receives
    // when a trade happens here — a SEPARATE, track-independent reward (e.g. Luna
    // 2 M€, Ceres 2 steel), not the trade reward. Built for BenefitGlyph like
    // tradeReward, from the same client metadata manifest.
    colonyBonus(): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} | undefined {
      const meta = getColony(this.colonyName);
      if (meta === undefined) {
        return undefined;
      }
      const c = meta.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    // ── Pre-select steps (the shared colonyTradePlan brain) ─────────────
    /** The chosen payment path uses M€ (its own prompt may follow). */
    isMcSelected(): boolean {
      return this.options[this.selectedIdx]?.metadata?.icon === 'megacredits';
    },
    steps(): Array<TradeStep> {
      return tradeSteps(this.preview, this.isMcSelected);
    },
    /**
     * Desktop keeps its dedicated payment modal for the M€ prompt (heat /
     * alt-resource payers): when that prompt WILL follow, later card picks
     * can't ride the same batch (they'd land on the payment prompt) — the
     * modal says so honestly instead of collecting picks it would drop.
     */
    paymentPromptBlocks(): boolean {
      return this.steps.some((s) => s.kind === 'payment');
    },
    trackStep(): Extract<TradeStep, {kind: 'trackChoice'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'trackChoice');
      return step?.kind === 'trackChoice' ? step : undefined;
    },
    trackChosen(): number | undefined {
      const captured = this.captures['track'];
      return typeof captured === 'number' ? captured : undefined;
    },
    trackOptions(): Array<{steps: number, position: number, quantity: number, label: string}> {
      const step = this.trackStep;
      const meta = getColony(this.colonyName);
      const current = this.preview?.track.current ?? 0;
      if (step === undefined || meta === undefined) {
        return [];
      }
      const options: Array<{steps: number, position: number, quantity: number, label: string}> = [];
      for (let n = step.steps; n >= 0; n--) {
        const position = Math.min(current + n, meta.trade.quantity.length - 1);
        options.push({
          steps: n,
          position,
          quantity: rewardAtPosition(meta, position).quantity,
          label: n > 0 ?
            translateTextWithParams('Advance ${0} step(s)', [String(n)]) :
            translateText('Don\'t increase colony track'),
        });
      }
      return options;
    },
    cardTargetSteps(): Array<Extract<TradeStep, {kind: 'cardTarget'}>> {
      return this.steps.filter((s): s is Extract<TradeStep, {kind: 'cardTarget'}> => s.kind === 'cardTarget');
    },
    // ── Итог торговли (before → after chips) ────────────────────────────
    outcomeChips(): Array<TradeOutcomeChip> {
      const meta = getColony(this.colonyName);
      const player = this.playerView?.thisPlayer;
      if (meta === undefined || this.colony === undefined) {
        return [];
      }
      const optionMeta = this.options[this.selectedIdx]?.metadata;
      const payment = optionMeta?.icon !== undefined && optionMeta.amount !== undefined ?
        {icon: optionMeta.icon, amount: optionMeta.amount} :
        undefined;
      const rewardPosition = this.trackChosen !== undefined ?
        Math.min((this.preview?.track.current ?? 0) + this.trackChosen, meta.trade.quantity.length - 1) :
        (this.preview?.track.effective ?? this.rewardTrackPosition);
      const ownColonyCount = this.viewerColor !== undefined ?
        this.colony.colonies.filter((c) => c === this.viewerColor).length :
        0;
      const outcome = tradeOutcome({
        metadata: meta,
        rewardPosition,
        payment,
        ownColonyCount,
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
      return [...outcome.cost, ...outcome.gains];
    },
    noticeRows(): Array<{tone: 'warn' | 'info', text: string}> {
      const rows: Array<{tone: 'warn' | 'info', text: string}> = [];
      for (const notice of tradeNotices(this.preview)) {
        if (notice.kind === 'autoTarget') {
          rows.push({
            tone: 'info',
            text: translateTextWithParams('+${0} to ${1} (the only eligible card)', [String(notice.amount), translateText(notice.card)]),
          });
        } else if (notice.kind === 'lostResource') {
          rows.push({tone: 'warn', text: translateText('No eligible card — this resource is not added.')});
        } else {
          rows.push({tone: 'info', text: translateText(notice.note)});
        }
      }
      return rows;
    },
    /** Stable per-step keys (parallel to `steps`). */
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
    canConfirm(): boolean {
      if (this.selectedIdx === -1) {
        return false;
      }
      return this.steps.every((step, i) => {
        if (step.kind === 'payment') {
          return true; // the M€ prompt follows as the dedicated payment modal
        }
        if (step.kind === 'cardTarget' && this.paymentPromptBlocks) {
          return true; // picks can't ride this batch — they arrive live after payment
        }
        return this.captures[this.stepKeys[i]] !== undefined;
      });
    },
    confirmDisabledReason(): string {
      if (this.canConfirm) {
        return '';
      }
      if (this.selectedIdx === -1) {
        return translateText('Pick how to pay first');
      }
      const missing = this.steps.findIndex((step, i) =>
        step.kind !== 'payment' && !(step.kind === 'cardTarget' && this.paymentPromptBlocks) && this.captures[this.stepKeys[i]] === undefined);
      const step = this.steps[missing];
      if (step?.kind === 'trackChoice') {
        return translateText('Choose the track advance');
      }
      return translateText('Choose a card');
    },
    // Everyone who already has a colony built on this tile — they ALL gain the
    // colony bonus when this trade resolves (INCLUDING the trading player). Grouped
    // by colour with a count, since a player can hold multiple colonies here and
    // thus receive the bonus several times.
    beneficiaries(): Array<{color: Color, name: string, count: number}> {
      if (this.colony === undefined) {
        return [];
      }
      const counts = new Map<Color, number>();
      for (const color of this.colony.colonies) {
        counts.set(color, (counts.get(color) ?? 0) + 1);
      }
      const out: Array<{color: Color, name: string, count: number}> = [];
      counts.forEach((count, color) => {
        const p = this.players.find((pp) => pp.color === color);
        out.push({color, name: p !== undefined ? participantDisplayName(p) : String(color), count});
      });
      return out;
    },
  },
  methods: {
    // The trade reward at a specific track position — same construction
    // ColonyDetailView feeds to BenefitGlyph.
    rewardAtPosition(idx: number): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} | undefined {
      const meta = getColony(this.colonyName);
      if (meta === undefined || this.colony === undefined) {
        return undefined;
      }
      const t = meta.trade;
      const resource = Array.isArray(t.resource) ? t.resource[idx] : t.resource;
      return {type: t.type, quantity: [t.quantity[idx] ?? 0], resource};
    },
    optionLabel(opt: SelectOptionModel | DisabledOptionModel): string {
      return typeof opt.title === 'string' ? translateText(opt.title) : translateMessage(opt.title);
    },
    iconClass(meta: OptionMetadata | undefined): string {
      return iconClassFor(meta?.icon);
    },
    hasStock(meta: OptionMetadata | undefined): boolean {
      return meta?.resource !== undefined;
    },
    current(meta: OptionMetadata | undefined): number {
      return meta?.resource?.current ?? 0;
    },
    resulting(meta: OptionMetadata | undefined): number {
      return meta?.resource?.resulting ?? 0;
    },
    reasonText(opt: DisabledOptionModel): string {
      if (opt.reason === undefined) {
        return translateText('Unavailable');
      }
      return typeof opt.reason === 'string' ? translateText(opt.reason) : translateMessage(opt.reason);
    },
    chipIcon(chip: TradeOutcomeChip): string {
      return chip.icon !== undefined ? iconClassFor(chip.icon) : '';
    },
    rewardBenefitAt(position: number): {type: ColonyBenefit, quantity: Array<number>, resource?: unknown} {
      const meta = getColony(this.colonyName);
      if (meta === undefined) {
        return {type: ColonyBenefit.GAIN_RESOURCES, quantity: [0]};
      }
      const resource = Array.isArray(meta.trade.resource) ? meta.trade.resource[position] : meta.trade.resource;
      return {type: meta.trade.type, quantity: meta.trade.quantity as Array<number>, resource};
    },
    chooseTrack(steps: number): void {
      this.captures = {...this.captures, track: steps};
    },
    targetName(cardStepOrdinal: number): CardName | undefined {
      const captured = this.captures[`target:${cardStepOrdinal}`];
      return typeof captured === 'string' ? captured as CardName : undefined;
    },
    captureTarget(cardStepOrdinal: number, response: SelectCardResponse): void {
      if (response.cards.length > 0) {
        this.captures = {...this.captures, [`target:${cardStepOrdinal}`]: response.cards[0]};
      }
    },
    confirm(): void {
      if (!this.canConfirm) {
        return;
      }
      // Re-key the stable captures into the by-index map the batch builder
      // consumes (payment stays uncaptured — its dedicated modal follows).
      const capturesByIndex: Record<number, unknown> = {};
      this.stepKeys.forEach((key, i) => {
        const captured = this.captures[key];
        if (captured !== undefined) {
          capturesByIndex[i] = captured;
        }
      });
      this.$emit('select', {paymentIndex: this.selectedIdx, steps: this.steps, captures: capturesByIndex});
    },
  },
});
</script>
