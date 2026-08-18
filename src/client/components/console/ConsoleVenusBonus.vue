<template>
  <!--
    THE VENUS TRACK BONUS — the reward for crossing a bonus step on the
    Alternative Venus Board, console-native.

    It is a GIFT, and it is presented as one: what you earned is stated as a
    figure, and the whole surface is about placing it. Two shapes, ONE FLOW —
    the 30 % final step first asks where its WILD resource goes, and only then
    opens the same lanes; the frame, the kicker and the meter never move, so the
    stage advances rather than a second screen arriving.

    …and the INSTRUMENT follows the budget. Most bonuses are a single resource,
    where a stepper is the wrong tool for a decision that is really «which one»:
    `budgetSingleStep` turns the lanes into a RADIO — A places it / takes it
    back, no −1 / +1 / MAX, no meter — which is the same language the wild
    question one stage up already speaks. A real budget (2, 3, the final step's
    wild folded in) keeps the dials.

    data-motion-*: rides the shared `.con-shade` dim + the surface-motion
    director — no own backdrop.
  -->
  <div class="con-lanes con-venus con-ws" role="dialog" :aria-label="$t(headlineKey)" data-motion-surface="venus-bonus">
    <div class="con-lanes__panel" :class="{'con-lanes__panel--wide': stage === 'wildCard'}" data-motion-panel>
      <header class="con-lanes__head">
        <div class="con-lanes__kicker">
          <span class="con-lanes__kicker-mark con-venus__mark" aria-hidden="true">◈</span>
          <span>{{ $t('Venus bonus') }}</span>
          <!-- The stage tail. Stable context BEFORE the mutable stage, and only
               the tail advances — the console's breadcrumb grammar. -->
          <template v-if="isFinal">
            <span class="con-lanes__crumb-sep" aria-hidden="true">›</span>
            <span class="con-lanes__crumb-stage" :class="{'con-lanes__crumb-stage--past': stage === 'place'}">
              {{ $t(stageKey) }}
            </span>
          </template>
        </div>
        <div class="con-lanes__title">{{ $t(headlineKey) }}</div>

        <!-- The meter belongs to the PLACEMENT stage only: during the wild
             question nothing is placed yet and the budget is not even decided
             (the wild can still fold into it), so a «0 / 2» there states a
             number that is about to change.
             …and it is a BUDGET readout, so it goes away entirely when there is
             no budget to spread: «РАЗМЕЩЕНО 0 / 1» over six radio rows is the
             same sentence a third time (title, meter, blocker). The chosen row
             says it — the mark, and the green «500 → 501» beside it. -->
        <div v-if="stage === 'place' && !singleStep" class="con-lanes__meter" :class="{'con-lanes__meter--ready': ready}">
          <span class="con-lanes__meter-label">{{ $t('Placed') }}</span>
          <b class="con-lanes__meter-now">{{ placed }}</b>
          <span class="con-lanes__meter-slash" aria-hidden="true">/</span>
          <span class="con-lanes__meter-target">{{ target }}</span>
        </div>
        <div v-if="stage === 'place' && blockedText !== ''" class="con-lanes__blocked">⚠ {{ blockedText }}</div>
      </header>

      <!-- ── STAGE 1 (final step only): where does the WILD go? ──────────── -->
      <div v-if="stage === 'wild'" class="con-venus__wild">
        <p class="con-venus__wild-lead">{{ $t('The final step adds one wild resource.') }}</p>
        <div v-for="(opt, i) in wildOptions" :key="opt.value"
             class="con-venus__opt"
             :class="{
               'con-venus__opt--focused': wildIdx === i,
               'con-venus__opt--disabled': opt.disabled,
             }">
          <div class="con-venus__opt-head">
            <i class="con-venus__opt-icon" :class="opt.iconClass" aria-hidden="true"></i>
            <span class="con-venus__opt-title">{{ $t(opt.titleKey) }}</span>
            <GamepadGlyph v-if="wildIdx === i && !opt.disabled" control="confirm" class="con-venus__opt-a" />
          </div>
          <div class="con-venus__opt-desc">{{ $t(opt.descKey) }}</div>
          <!-- A blocked branch is SHOWN with its reason, never dropped: losing
               the wild silently because you own no resource card would be a
               reward vanishing without a trace. -->
          <div v-if="opt.disabled" class="con-venus__opt-reason">✕ {{ $t(opt.reasonKey) }}</div>
        </div>
      </div>

      <!-- ── STAGE 1b: which card hosts the wild ────────────────────────────
           THE SHARED PLAYED-TARGET SELECTOR — the same component the card-play
           composer, the blue-action composer, the colony payout, the hydro
           stage and the bot attack all point their targets with. Venus owns no
           picker of its own: the candidates are the server's own `SelectCard`,
           the reading is `было → стало` plus the authoritative ПО move, and the
           fit, the scroll and the navigation are the selector's — which is what
           makes the tenth candidate as reachable as the first. The strip this
           replaced was an `overflow-x` row with an index cursor: past four
           cards the rest were simply off the panel.
           `hostStatesAsk`: the panel header above already IS the ask, and an
           embedded surface must not title itself. -->
      <div v-else-if="stage === 'wildCard'" class="con-venus__pick" data-ws-band ref="wildZone">
        <ConsolePlayedTargetStep v-if="wildModel !== undefined && wildFocus !== undefined"
                                 ref="wildStep"
                                 :model="wildModel"
                                 :layout="wildLayout"
                                 :focus="wildFocus"
                                 :bandHeight="wildZoneH"
                                 :lockedCard="wildCard ?? ''"
                                 hostStatesAsk />
      </div>

      <!-- ── STAGE 2: place the standard resources ──────────────────────── -->
      <div v-else class="con-lanes__main">
        <div class="con-lanes__rows">
          <div v-for="(lane, i) in lanes" :key="lane.key"
               class="con-lanes__row"
               :class="{
                 'con-lanes__row--focused': focusIdx === i,
                 'con-lanes__row--active': valueOf(lane) > 0,
               }">
            <div class="con-lanes__line">
              <span class="con-lanes__id">
                <span class="con-lanes__frame">
                  <i class="con-lanes__icon" :class="lane.iconClass" aria-hidden="true"></i>
                </span>
                <span class="con-lanes__name">{{ $t(lane.label) }}</span>
              </span>

              <!-- current → resulting on the player's OWN stock: the point of
                   choosing where a bonus lands is seeing what it becomes. -->
              <span class="con-lanes__stock">
                <span class="con-lanes__cur" :class="{'con-lanes__cur--faded': valueOf(lane) > 0}">{{ lane.available }}</span>
                <template v-if="valueOf(lane) > 0">
                  <span class="con-lanes__arrow" aria-hidden="true">→</span>
                  <span class="con-lanes__next">{{ (lane.available ?? 0) + valueOf(lane) }}</span>
                </template>
              </span>

              <!-- The «+N» counter belongs to a BUDGET being spread. With one
                   unit to place it repeats what the arrow above already says,
                   so the single-step mode spends that cell on the gesture
                   instead (see the keys cell below). -->
              <span v-if="!singleStep" class="con-lanes__delta" :class="{'con-lanes__delta--empty': valueOf(lane) === 0}">
                <template v-if="valueOf(lane) > 0">+{{ valueOf(lane) }}</template>
              </span>

              <span class="con-lanes__keys" aria-hidden="true">
                <template v-if="singleStep">
                  <!-- The same language the wild question one stage up speaks:
                       A on the row under the cursor, a mark on the chosen one.
                       BOTH when they coincide — the cursor is not the answer, so
                       standing on the chosen row must not erase that it IS the
                       answer (the console's focus / selection / commit rule). -->
                  <span v-if="valueOf(lane) > 0" class="con-lanes__tick">✓</span>
                  <GamepadGlyph v-if="focusIdx === i" control="confirm" />
                </template>
                <template v-else-if="focusIdx === i">
                  <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                </template>
              </span>
            </div>
          </div>
        </div>
      </div>
      <!-- What the wild is doing, kept visible through the placement so the
           decision the player already made never disappears. BELOW the lanes,
           not beside them: `.con-lanes__main` is a flex ROW, and a sibling
           there halves the lanes' width — which squeezed every resource name
           out of its own row. -->
      <div v-if="stage === 'place' && isFinal" class="con-venus__wild-recap">
        <span class="con-venus__wild-recap-label">{{ $t('Wild resource') }}</span>
        <span class="con-venus__wild-recap-value">{{ wildRecapText }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation + the pad contract. The lane arithmetic is the shared
 * `budgetLanes` engine (the same one the spend-heat surface uses) and every
 * server-shape decision — which `and` holds the amounts for the chosen branch,
 * what the response looks like — lives in the pure `compositePrompts` adapter.
 */
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt, reseatPlayedTargetFocus,
  stepPlayedTargetFocus, stepPlayedTargetFocusAt,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {buildVenusWildTargetModel, venusWildCandidates} from '@/client/console/venusBonus/venusWildTargetStep';
import {
  VenusWildChoice, venusBaseCount, venusBonusLanes, venusBonusResponse, venusWildTargets,
} from '@/client/console/compositePrompts';
import {
  BudgetLane, BudgetRule, BudgetState, budgetBlockedKey, budgetSingleStep, budgetTotal, budgetValid,
  laneValue, maxOntoLane, stepFocus, stepLane, toggleSoleStep,
} from '@/client/console/budgetLanes';

type Stage = 'wild' | 'wildCard' | 'place';

interface WildOption {
  value: VenusWildChoice;
  iconClass: string;
  titleKey: string;
  descKey: string;
  disabled: boolean;
  reasonKey: string;
}

export default defineComponent({
  name: 'ConsoleVenusBonus',
  components: {ConsolePlayedTargetStep, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      focusIdx: 0,
      wildIdx: 0,
      picks: {} as BudgetState,
      wild: undefined as VenusWildChoice | undefined,
      /** The card the player CHOSE to host the wild. It survives B (the picker
       *  re-opens with it locked and focused), so nothing is re-decided. */
      wildCard: undefined as CardName | undefined,
      /** The picker is the current stage. Separate from `wildCard` on purpose:
       *  «the choice is made» and «the player is looking at the choice» are two
       *  facts, and collapsing them is what made B throw the pick away. */
      wildCardOpen: false,
      /** The selector's cursor — a real spatial focus, not a strip index.
       *  RAW: the rendered one is the reseated `wildFocus` computed, so a model
       *  that moved under the player can never leave the cursor pointing at a
       *  candidate that is no longer there. */
      wildFocusRaw: undefined as PlayedTargetFocus | undefined,
      wildZoneW: 0,
      wildZoneH: 0,
      stopWildObs: undefined as (() => void) | undefined,
      submitting: false,
    };
  },
  computed: {
    meta(): VenusBonusPromptMeta | undefined {
      return this.playerView.waitingFor?.venusBonusPrompt;
    },
    isFinal(): boolean {
      return this.meta?.kind === 'final';
    },
    wildTargets(): ReadonlyArray<CardName> {
      return this.meta === undefined ? [] : venusWildTargets(this.meta);
    },
    /**
     * THE STAGE. Derived, never a set of booleans: the base bonus goes straight
     * to the lanes, the final one asks about its wild first and only descends
     * into the card pick when that branch is chosen.
     */
    stage(): Stage {
      if (!this.isFinal || this.wild === 'asStandard') {
        return 'place';
      }
      if (this.wild === undefined) {
        return 'wild';
      }
      // Undecided OR re-opened — the two enter the picker the same way, and
      // only the second one arrives with a lock already on a card.
      return (this.wildCard === undefined || this.wildCardOpen) ? 'wildCard' : 'place';
    },
    /**
     * THE AUTHORITATIVE CANDIDATES — the server's own `SelectCard`, read off
     * the prompt by SHAPE. Its models carry the live per-card resource count,
     * which is what the `было → стало` reading is built from.
     */
    wildCandidates(): ReadonlyArray<CardModel> {
      return venusWildCandidates(this.playerView.waitingFor);
    },
    wildModel(): PlayedTargetModel | undefined {
      if (this.wildCandidates.length === 0) {
        return undefined;
      }
      return buildVenusWildTargetModel({
        candidates: this.wildCandidates,
        players: this.playerView.players.map((p) => ({name: p.name, color: p.color, tableau: p.tableau})),
        viewerColor: this.playerView.thisPlayer.color,
        // The panel header states the ask in full; the step must not restate it
        // (and `hostStatesAsk` hides the line that would).
        ask: '',
        typeOf: (name) => getCard(name)?.type,
        // The wild becomes the card's OWN resource — a per-candidate fact.
        resourceOf: (name) => getCard(name)?.resourceType,
        // The server's own per-candidate ПО reading. Nothing is re-derived here.
        vpBox: this.meta?.wildCardVp,
      });
    },
    wildLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.wildModel?.owners ?? [],
        availW: this.wildZoneW,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The focus the child renders — reseated whenever the model moves. */
    wildFocus(): PlayedTargetFocus | undefined {
      return reseatPlayedTargetFocus(this.wildFocusRaw, this.wildModel?.owners ?? []);
    },
    focusedWildCard(): CardName | undefined {
      return playedTargetAt(this.wildFocus, this.wildModel?.owners ?? [])?.cardName;
    },
    /**
     * THE CRUMB'S TAIL — one name per stage, and the tail only ever moves
     * FORWARD: «ДОПОЛНИТЕЛЬНЫЙ РЕСУРС» → «ЦЕЛЬ» → «РАЗМЕЩЕНИЕ». The picker
     * used to inherit the placement's name, so the line said «РАЗМЕЩЕНИЕ»
     * over a title asking which card should receive the resource — a tail one
     * stage ahead of the screen under it.
     */
    stageKey(): string {
      switch (this.stage) {
      case 'wild': return 'Wild resource';
      case 'wildCard': return 'Target';
      default: return 'Placement';
      }
    },
    target(): number {
      return this.meta === undefined ? 0 : venusBaseCount(this.meta, this.wild);
    },
    rule(): BudgetRule {
      return {kind: 'exact', target: this.target};
    },
    lanes(): Array<BudgetLane> {
      const stock = this.playerView.thisPlayer as unknown as Partial<Record<keyof Units, number>>;
      return venusBonusLanes(this.target, stock);
    },
    /**
     * THE COMMON CASE: one resource to place, so the decision is «which one» and
     * the surface becomes a RADIO — A puts it here / takes it back, and the
     * stepper verbs are not offered. Asked of the pure engine (a property of the
     * budget, never `target === 1`), so the spend-heat surface reads the same
     * question and the two can't drift.
     */
    singleStep(): boolean {
      return budgetSingleStep(this.lanes, this.rule);
    },
    /** The lane under the cursor already holds the unit — A takes it back. */
    focusedPicked(): boolean {
      const lane = this.lanes[this.focusIdx];
      return lane !== undefined && laneValue(this.picks, lane.key) > 0;
    },
    placed(): number {
      return budgetTotal(this.lanes, this.picks);
    },
    ready(): boolean {
      return budgetValid(this.lanes, this.picks, this.rule);
    },
    blockedText(): string {
      const key = budgetBlockedKey(this.lanes, this.picks, this.rule);
      return key === undefined ? '' : translateText(key);
    },
    headlineKey(): string {
      switch (this.stage) {
      case 'wild': return 'Where does the wild resource go?';
      case 'wildCard': return 'Choose the card to receive it';
      default: return 'Place your Venus track bonus';
      }
    },
    wildOptions(): ReadonlyArray<WildOption> {
      const noCards = this.wildTargets.length === 0;
      return [
        {
          value: 'onCard',
          iconClass: 'resource_icon resource_icon--cards',
          titleKey: 'Put it on a card',
          descKey: 'One resource of that card\'s own type.',
          disabled: noCards,
          reasonKey: 'You have no card that can hold a resource',
        },
        {
          value: 'asStandard',
          iconClass: 'resource_icon resource_icon--megacredits',
          titleKey: 'Take one more standard resource',
          descKey: 'The wild joins the bonus you are placing.',
          disabled: false,
          reasonKey: '',
        },
      ];
    },
    wildRecapText(): string {
      if (this.wild === 'onCard' && this.wildCard !== undefined) {
        return translateText(this.wildCard);
      }
      return translateText('Taken as a standard resource');
    },
    promptKey(): string {
      return `${this.meta?.kind ?? ''}|${this.meta?.baseCount ?? 0}|${this.wildTargets.join(',')}`;
    },
    /**
     * WHAT B DOES HERE — one function, so the label can never disagree with the
     * press. There is somewhere to go back TO exactly while the final step's
     * wild question has been answered: from the picker back to the question,
     * and from the placement back into the picker. Everywhere else B minimizes
     * (the board-home card is then the one door back).
     */
    backVerb(): 'back' | 'minimize' {
      if (this.stage === 'wildCard') {
        return 'back';
      }
      return this.stage === 'place' && this.isFinal ? 'back' : 'minimize';
    },
    footCommands(): Array<ConsoleCommand> {
      const back: ConsoleCommand = {control: 'back', label: this.backVerb === 'back' ? 'Back' : 'Minimize'};
      if (this.stage === 'wild') {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select', enabled: !this.wildOptions[this.wildIdx]?.disabled},
          back,
        ];
      }
      if (this.stage === 'wildCard') {
        // The selector's own grammar (D-pad move · A choose · X inspect · B
        // back), stated by the ONE command bar — the same four verbs every
        // other host of this step publishes. `dpad`, not `dpadH`: the grid the
        // selector plans is two-dimensional the moment there are more
        // candidates than one row holds.
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: 'Select', enabled: this.focusedWildCard !== undefined},
          {control: 'secondary', label: 'Inspect'},
          back,
        ];
      }
      // ONE resource to place → one verb. Offering −1 / +1 / MAX for a dial that
      // can only read 0 or 1 is four ways to say the same thing, and it hides
      // the confirm behind them.
      if (this.singleStep) {
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: this.focusedPicked ? 'Remove here' : 'Add here'},
          {control: 'secondary', label: 'Collect', enabled: this.ready},
          back,
        ];
      }
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'bumperL', label: '−1'},
        {control: 'bumperR', label: '+1'},
        {control: 'triggerR', label: 'MAX'},
        {control: 'secondary', label: 'Collect', enabled: this.ready},
        back,
      ];
    },
  },
  watch: {
    promptKey: {
      immediate: true,
      handler() {
        this.reset();
      },
    },
    /** A changed budget (the wild folded in) invalidates the placement. */
    target() {
      this.picks = {};
      this.focusIdx = 0;
    },
    playerView() {
      this.submitting = false;
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('venusBonus', cmds);
      },
    },
    /**
     * The picker's zone only exists while its stage does, so its cursor is
     * seated — and its band measured — the moment the stage opens, never at
     * mount. `bandHeight` is measured on the STRETCHED zone before the step's
     * first painted frame, which is what lets the step solve a card size
     * instead of inheriting one from its own content.
     */
    stage: {
      immediate: true,
      handler(stage: Stage) {
        if (stage !== 'wildCard') {
          return;
        }
        this.seatWildFocus();
        void this.$nextTick(() => this.measureWildZone());
      },
    },
  },
  beforeUnmount() {
    clearPanelCommands('venusBonus');
    this.stopWildObs?.();
    this.stopWildObs = undefined;
  },
  methods: {
    valueOf(lane: BudgetLane): number {
      return laneValue(this.picks, lane.key);
    },
    reset(): void {
      this.submitting = false;
      this.focusIdx = 0;
      this.wildIdx = 0;
      this.picks = {};
      this.wild = undefined;
      this.wildCard = undefined;
      this.wildCardOpen = false;
      this.wildFocusRaw = undefined;
    },
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary': // A
        this.onConfirmPress();
        return;
      case 'prevSection':
        if (this.stage === 'place') {
          this.step(-1);
        }
        return;
      case 'nextSection':
        if (this.stage === 'place') {
          this.step(1);
        }
        return;
      case 'nextTab': // RT
        if (this.stage === 'place') {
          this.maxOnto();
        }
        return;
      case 'inspect': // X
        if (this.stage === 'wildCard') {
          this.zoomFocusedCard();
        } else if (this.stage === 'place') {
          this.collect();
        }
        return;
      case 'back':
        this.onBack();
        return;
      default:
        return;
      }
    },
    onNav(dir: string): void {
      if (this.stage === 'wild') {
        if (dir === 'up' || dir === 'down') {
          this.wildIdx = Math.min(this.wildOptions.length - 1, Math.max(0, this.wildIdx + (dir === 'down' ? 1 : -1)));
        }
        return;
      }
      if (this.stage === 'wildCard') {
        this.wildNav(dir as PlayedTargetNavDir);
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = stepFocus(this.lanes, this.focusIdx, dir === 'down' ? 1 : -1);
      }
    },
    /** A — advances the flow one level, or (single-step placement) puts the one
     *  resource down / takes it back. It never submits; X does. */
    onConfirmPress(): void {
      if (this.stage === 'wild') {
        const opt = this.wildOptions[this.wildIdx];
        if (opt !== undefined && !opt.disabled) {
          this.wild = opt.value;
          // Descending into the picker is what «on a card» MEANS; the pick
          // itself may already exist from an earlier pass through this stage.
          this.wildCardOpen = opt.value === 'onCard';
        }
        return;
      }
      if (this.stage === 'wildCard') {
        const card = this.focusedWildCard;
        if (card !== undefined) {
          this.wildCard = card;
          this.wildCardOpen = false;
        }
        return;
      }
      // In the multi-lane layout A stays free (the budget is spread with LB/RB),
      // so claiming it here costs the flow nothing.
      if (this.singleStep) {
        this.toggleFocused();
      }
    },
    /** The single-step gesture: place the unit here, or take it back. */
    toggleFocused(): void {
      const lane = this.lanes[this.focusIdx];
      if (lane !== undefined) {
        this.picks = toggleSoleStep(this.lanes, this.picks, this.rule, lane.key);
      }
    },
    /**
     * B — ONE logical level, and the earned bonus survives it.
     *
     * From the PLACEMENT of a wild that went on a card, that one level is the
     * PICKER, not the wild question two levels up: the player is undoing where
     * the resource went, and the card they chose stays chosen (it re-opens
     * locked and focused, exactly as this step's «Изменить выбор» does in
     * both composers). It used to reset the whole wild decision, which threw
     * away a pick the player had not asked to take back.
     */
    onBack(): void {
      if (this.stage === 'wildCard') {
        this.wildCardOpen = false;
        this.wild = undefined;
        return;
      }
      if (this.stage === 'place' && this.isFinal) {
        if (this.wild === 'onCard') {
          this.wildCardOpen = true;
          return;
        }
        this.wild = undefined;
        return;
      }
      this.$emit('defer');
    },
    step(delta: number): void {
      const lane = this.lanes[this.focusIdx];
      if (lane === undefined) {
        return;
      }
      // SINGLE-STEP mode doesn't advertise the stepper verbs, but they still
      // land on its one gesture: muscle memory from the multi-lane layout must
      // never meet a dead button. LB takes the unit off this lane, RB puts it
      // here (moving it — a plain `+1` under a full budget is refused).
      if (this.singleStep) {
        this.picks = delta < 0 ?
          (this.focusedPicked ? {} : this.picks) :
          stepLane(this.lanes, {}, this.rule, lane.key, 1);
        return;
      }
      this.picks = stepLane(this.lanes, this.picks, this.rule, lane.key, delta);
    },
    maxOnto(): void {
      const lane = this.lanes[this.focusIdx];
      if (lane === undefined) {
        return;
      }
      this.picks = this.singleStep ?
        stepLane(this.lanes, {}, this.rule, lane.key, 1) :
        maxOntoLane(this.lanes, this.picks, this.rule, lane.key);
    },
    collect(): void {
      if (!this.ready || this.submitting || this.meta === undefined) {
        return;
      }
      this.submitting = true;
      this.$emit('submit', venusBonusResponse(this.meta, this.picks, this.wild, this.wildCard));
    },
    /**
     * THE SELECTOR'S NAVIGATION — resolved against the cards' REAL boxes, so a
     * grid that wrapped to a second row is walked as a grid. The index cursor
     * this replaced could only ever move along one line.
     */
    wildNav(dir: PlayedTargetNavDir): void {
      const owners = this.wildModel?.owners ?? [];
      const focus = this.wildFocus;
      if (focus === undefined || owners.length === 0) {
        return;
      }
      const step = this.$refs.wildStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const next = cells.length > 0 ?
        stepPlayedTargetFocusAt(focus, dir, cells) :
        stepPlayedTargetFocus(focus, dir, owners, this.wildLayout);
      if (next === undefined) {
        return; // an edge HOLDS — never a wrap, never a silent jump
      }
      this.wildFocusRaw = next;
      (this.$refs.wildStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    /** Seat the cursor: on the already-chosen card when there is one (a re-entry
     *  must not lose the player's place), otherwise on the first candidate. */
    seatWildFocus(): void {
      const owners = this.wildModel?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      this.wildFocusRaw = findPlayedTargetFocus(this.wildCard ?? '', owners) ??
        reseatPlayedTargetFocus(this.wildFocusRaw, owners);
      void this.$nextTick(() => this.measureWildZone());
    },
    measureWildZone(): void {
      const zone = this.$refs.wildZone as HTMLElement | undefined;
      if (zone === undefined || zone === null) {
        return;
      }
      this.wildZoneW = Math.max(0, zone.clientWidth);
      this.wildZoneH = Math.max(0, zone.clientHeight);
      if (this.stopWildObs === undefined) {
        this.stopWildObs = useResizeObserver(zone, () => {
          const el = this.$refs.wildZone as HTMLElement | undefined;
          if (el !== undefined && el !== null) {
            this.wildZoneW = Math.max(0, el.clientWidth);
            this.wildZoneH = Math.max(0, el.clientHeight);
          }
        }).stop;
      }
    },
    /** X on the card stage — the ordinary fullscreen viewer, read-only, rising
     *  out of the candidate's own slot (the step's shared zoom origin). */
    zoomFocusedCard(): void {
      const owners = this.wildModel?.owners ?? [];
      const focused = this.focusedWildCard;
      if (focused === undefined) {
        return;
      }
      const cards = owners.flatMap((o) => o.candidates.map((c) => c.model));
      const at = Math.max(0, cards.findIndex((c) => c.name === focused));
      openConsoleCardZoom(cards, at, undefined, undefined, {
        // The picker's ZONE is the root the origin resolves inside — an element
        // ref, so the physical entrance survives a build that leaves `$el` a
        // fragment anchor. No source card here: the bonus is paid by the VENUS
        // TRACK, so every candidate is an ordinary slot.
        origin: playedTargetZoomOrigin(
          () => this.$refs.wildZone as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          ''),
      });
    },
  },
});
</script>
