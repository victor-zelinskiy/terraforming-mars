<template>
  <!--
    SPEND HEAT — Stormcraft Incorporated's «pay N heat» prompt, console-native.

    It is a PAYMENT, and it is presented as one: a coverage meter that reads
    like the payment panel's status line, two source lanes, and a confirm that
    is only live when the bill is covered EXACTLY (the rules reject an
    overpayment, so the surface must never offer one). The desktop modal this
    replaces was a pair of bare number steppers with no idea what they added up
    to — on a TV it was unreadable and unplayable with a pad.

    data-motion-*: rides the shared `.con-shade` dim + the surface-motion
    director — no own backdrop.
  -->
  <div class="con-lanes con-heat con-ws" role="dialog" :aria-label="titleText" data-motion-surface="spend-heat">
    <div class="con-lanes__panel" data-motion-panel>
      <header class="con-lanes__head">
        <div class="con-lanes__kicker">
          <span class="con-lanes__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Spend heat') }}</span>
        </div>
        <div class="con-lanes__title">{{ titleText }}</div>

        <!-- THE BILL. One number the player is working against, and its live
             coverage — the same "what does it cost / what is covered" pair the
             payment panel states, so the two read as one idea. -->
        <div class="con-lanes__meter" :class="{
               'con-lanes__meter--ready': ready,
               'con-lanes__meter--over': overpaying,
             }">
          <span class="con-lanes__meter-label">{{ $t('Covered') }}</span>
          <b class="con-lanes__meter-now">{{ covered }}</b>
          <span class="con-lanes__meter-slash" aria-hidden="true">/</span>
          <span class="con-lanes__meter-target">{{ target }}</span>
          <i class="resource_icon resource_icon--heat con-lanes__meter-icon" aria-hidden="true"></i>
        </div>
        <!-- The honest blocker, never a dead confirm with no explanation. -->
        <div v-if="blockedText !== ''" class="con-lanes__blocked">⚠ {{ blockedText }}</div>
      </header>

      <div class="con-lanes__main">
        <console-source-dock v-if="sourceView !== undefined" :view="sourceView" compact ref="sourceDock" />

        <div class="con-lanes__rows">
          <div v-for="(lane, i) in lanes" :key="lane.key"
               class="con-lanes__row"
               :class="{
                 'con-lanes__row--focused': focusIdx === i,
                 'con-lanes__row--active': valueOf(lane) > 0,
                 'con-lanes__row--spent': lane.max === 0,
               }">
            <div class="con-lanes__line">
              <span class="con-lanes__id">
                <span class="con-lanes__frame">
                  <i class="con-lanes__icon" :class="lane.iconClass" aria-hidden="true"></i>
                </span>
                <span class="con-lanes__name">{{ $t(lane.label) }}</span>
              </span>

              <!-- The dial, and what it BUYS. A floater is worth 2 heat and the
                   player must never have to do that arithmetic themselves. -->
              <span class="con-lanes__dial">
                <b class="con-lanes__value">{{ valueOf(lane) }}</b>
                <span class="con-lanes__of">/ {{ lane.max }}</span>
              </span>
              <span class="con-lanes__pays" :class="{'con-lanes__pays--empty': valueOf(lane) === 0}">
                <template v-if="valueOf(lane) > 0">
                  {{ paysOf(lane) }}<i class="resource_icon resource_icon--heat con-lanes__pays-icon" aria-hidden="true"></i>
                </template>
              </span>

              <span class="con-lanes__keys" aria-hidden="true">
                <template v-if="focusIdx === i">
                  <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                </template>
              </span>
            </div>
            <div v-if="lane.noteKey !== undefined" class="con-lanes__note">{{ $t(lane.noteKey) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation + the pad contract. Every rule (what a step may do, when the
 * bill is covered, when it overpays, what the blocker is) lives in the pure
 * `budgetLanes` engine, shared with the Venus bonus surface — so the two
 * distribution screens can never drift, and the rules are unit-tested without
 * mounting anything.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {AndOptionsModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';
import {CardName} from '@/common/cards/CardName';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {spendHeatLanes, spendHeatResponse} from '@/client/console/compositePrompts';
import {
  BudgetLane, BudgetRule, BudgetState, budgetBlockedKey, budgetTotal, budgetValid,
  forcedAllocation, laneValue, maxOntoLane, stepFocus, stepLane,
} from '@/client/console/budgetLanes';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleSpendHeat',
  // `console-source-dock` is GLOBAL (main.ts) — see the note there.
  components: {GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      focusIdx: 0,
      picks: {} as BudgetState,
      submitting: false,
    };
  },
  computed: {
    model(): AndOptionsModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.spendHeatPrompt !== undefined && wf.type === 'and' ? (wf as AndOptionsModel) : undefined;
    },
    target(): number {
      return this.model?.spendHeatPrompt?.amount ?? 0;
    },
    rule(): BudgetRule {
      return {kind: 'cover', target: this.target};
    },
    lanes(): Array<BudgetLane> {
      return this.model === undefined ? [] : spendHeatLanes(this.model);
    },
    covered(): number {
      return budgetTotal(this.lanes, this.picks);
    },
    ready(): boolean {
      return budgetValid(this.lanes, this.picks, this.rule);
    },
    /** Covered, but with a step that could be taken back — the server would
     *  refuse it, so it is called out BEFORE the player presses confirm. */
    overpaying(): boolean {
      return !this.ready && this.covered >= this.target;
    },
    blockedText(): string {
      const key = budgetBlockedKey(this.lanes, this.picks, this.rule);
      return key === undefined ? '' : translateText(key);
    },
    titleText(): string {
      return textOf(this.model?.title);
    },
    sourceView(): PromptSourceView | undefined {
      return promptSourceView(this.model);
    },
    sourceCard(): CardName | undefined {
      return this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
    },
    /** A genuinely new bill resets the dials. */
    promptKey(): string {
      return `${this.target}|${this.lanes.map((l) => l.max).join(',')}`;
    },
    footCommands(): Array<ConsoleCommand> {
      const cmds: Array<ConsoleCommand> = [
        {control: 'dpad', label: 'Navigate'},
        {control: 'bumperL', label: '−1'},
        {control: 'bumperR', label: '+1'},
        {control: 'triggerR', label: 'MAX'},
        {control: 'secondary', label: 'Pay', enabled: this.ready},
      ];
      if (this.sourceCard !== undefined) {
        cmds.push({control: 'stickL', label: 'Source', priority: 1});
      }
      cmds.push({control: 'back', label: 'Minimize'});
      return cmds;
    },
  },
  watch: {
    promptKey: {
      immediate: true,
      handler() {
        this.reset();
      },
    },
    playerView() {
      this.submitting = false;
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('spendHeat', cmds);
      },
    },
  },
  beforeUnmount() {
    clearPanelCommands('spendHeat');
  },
  methods: {
    valueOf(lane: BudgetLane): number {
      return laneValue(this.picks, lane.key);
    },
    /** What this lane contributes to the bill, in heat. */
    paysOf(lane: BudgetLane): number {
      return this.valueOf(lane) * lane.weight;
    },
    reset(): void {
      this.submitting = false;
      this.focusIdx = 0;
      // Only ONE way to pay → it is a confirmation, not a puzzle. Same rule the
      // production-loss surface applies to a lone reducible row.
      this.picks = forcedAllocation(this.lanes, this.rule) ?? {};
    },
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.focusIdx = stepFocus(this.lanes, this.focusIdx, intent.dir === 'down' ? 1 : -1);
        }
        return;
      }
      if (intent.kind === 'press' && intent.button === 'stickL' && this.sourceCard !== undefined) {
        this.zoomSource();
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection': // LB
        this.step(-1);
        return;
      case 'nextSection': // RB
        this.step(1);
        return;
      case 'nextTab': // RT — pour the rest onto the focused lane
        this.maxOnto();
        return;
      case 'inspect': // X — pay
        this.confirm();
        return;
      case 'back':
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    step(delta: number): void {
      const lane = this.lanes[this.focusIdx];
      if (lane !== undefined) {
        this.picks = stepLane(this.lanes, this.picks, this.rule, lane.key, delta);
      }
    },
    maxOnto(): void {
      const lane = this.lanes[this.focusIdx];
      if (lane !== undefined) {
        this.picks = maxOntoLane(this.lanes, this.picks, this.rule, lane.key);
      }
    },
    confirm(): void {
      if (!this.ready || this.submitting) {
        return;
      }
      this.submitting = true;
      this.$emit('submit', spendHeatResponse(this.lanes, this.picks));
    },
    /** L3 — the source card fullscreen; the dials survive the round trip. */
    zoomSource(): void {
      const name = this.sourceCard;
      if (name === undefined) {
        return;
      }
      openConsoleCardZoom([{name}], 0, undefined, undefined, {
        statusLabel: 'Source',
        origin: {
          kind: 'physical',
          resolve: () => {
            const dock = this.$refs.sourceDock as {$el?: HTMLElement} | undefined;
            return dock?.$el?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
          },
        },
      });
    },
  },
});
</script>
