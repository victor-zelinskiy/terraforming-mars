<template>
  <!-- data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director — no own backdrop. -->
  <div class="con-prodloss con-ws" role="dialog" :aria-label="titleText" data-motion-surface="production-loss">
    <div class="con-prodloss__panel" data-motion-panel>
      <!-- ── Header ──────────────────────────────────────────────────── -->
      <header class="con-prodloss__head">
        <div class="con-prodloss__kicker">
          <span class="con-prodloss__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Production loss') }}</span>
        </div>
        <div class="con-prodloss__title">{{ titleText }}</div>

        <!-- The distribution indicator (Выбрано: N / M). -->
        <div class="con-prodloss__counter" :class="{'con-prodloss__counter--ready': ready}">
          <span>{{ $t('Selected') }}:</span>
          <b>{{ sum }}</b>
          <span class="con-prodloss__counter-slash">/</span>
          <span>{{ cost }}</span>
        </div>
      </header>

      <div class="con-prodloss__main">
        <!-- WHY the reduction is forced — the SHARED source dock, the same one
             every other decision surface uses. A card attack renders the real
             premium card (L3 opens it fullscreen); an Ares hazard renders the
             plate + its rule, in the board's own hazard accent. The old ◈-and-
             a-name chip named the card but gave no way to read it. -->
        <console-source-dock v-if="sourceView !== undefined" :view="sourceView" compact ref="sourceDock" />

        <!-- ── The six production rows ───────────────────────────────── -->
        <div class="con-prodloss__rows">
          <div v-for="(row, i) in rows" :key="row.unit"
               class="con-prodloss__row"
               :class="{
                 'con-prodloss__row--focused': focusIdx === i,
                 'con-prodloss__row--active': lossFor(row.unit) > 0,
                 'con-prodloss__row--disabled': row.disabled,
               }">
            <div class="con-prodloss__line">
              <span class="con-prodloss__row-id">
                <span class="con-prodloss__frame">
                  <i class="con-prodloss__icon" :class="iconClass(row.unit)" aria-hidden="true"></i>
                </span>
                <span class="con-prodloss__name">{{ resourceName(row.unit) }}</span>
              </span>

              <!-- current → resulting (было → станет), shown as signed
                   production so the "income" reads (and negative M€ works). -->
              <span class="con-prodloss__values">
                <span class="con-prodloss__cur" :class="{'con-prodloss__cur--faded': lossFor(row.unit) > 0}">{{ fmt(row.current) }}</span>
                <template v-if="lossFor(row.unit) > 0">
                  <span class="con-prodloss__arrow" aria-hidden="true">→</span>
                  <span class="con-prodloss__next">{{ fmt(resultingFor(row)) }}</span>
                </template>
              </span>

              <!-- The chosen loss (−1 / −2). -->
              <span class="con-prodloss__delta" :class="{'con-prodloss__delta--empty': lossFor(row.unit) <= 0}">
                <template v-if="lossFor(row.unit) > 0">−{{ lossFor(row.unit) }}</template>
              </span>

              <span class="con-prodloss__a" aria-hidden="true">
                <GamepadGlyph v-if="focusIdx === i && !row.disabled" control="confirm" />
              </span>
            </div>

            <!-- Disabled / limited reason — visible, never hidden. -->
            <div v-if="noteFor(row) !== ''" class="con-prodloss__note">✕ {{ noteFor(row) }}</div>
          </div>
        </div>
      </div>

      <!-- The command contract publishes to the shell's ONE bottom command
           bar via consolePanelUi (CONSOLE_TV_PREMIUM_PLAN §3.2). -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleProductionLoss — the console-native premium surface for "reduce your
 * production" (`SelectProductionToLose`). It replaces the generic
 * ConsoleTaskHost distribute lanes for the ONE narrow case an Ares
 * hazard-adjacency penalty (or a card attack) forces the player to shed 1–2
 * steps of production.
 *
 * It changes NO game logic: the pure model (consoleProductionLoss.ts) derives
 * the six rows from the SAME model, and confirming emits the byte-identical
 * `{type:'productionToLose', units}` the desktop ModernProductionToLose POSTs
 * (`@submit` → shell.onTaskSubmit). B defers to the amber chip (`@defer`).
 *
 * Control grammar (user-mandated — a small value surface, no RT actions):
 *   D-pad / L-stick = navigate the six rows
 *   A / RB          = assign a −1 to the focused production
 *   LB              = take a −1 back
 *   X               = confirm · B = minimize (inspect the board)
 * For a cost-1 loss the whole thing is single-pick: A on another row simply
 * MOVES the single −1 there.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectProductionToLoseModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {productionToLoseResponse} from '@/client/console/taskResponses';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {buildProductionLossRows, firstSelectableIndex, ProductionLossRow} from '@/client/console/consoleProductionLoss';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleProductionLoss',
  // `console-source-dock` is registered GLOBALLY (main.ts) — deliberately not a
  // local import: the dock renders the real card face, and that import chain
  // zeroes this file's mochapack spec (the known baseline class, same reason
  // `action-target-card` is global).
  components: {GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      focusIdx: 0,
      /** The chosen loss per resource (fills up to `cost`). */
      units: {} as Partial<Record<keyof Units, number>>,
      /** Blocks a duplicate submit between the emit and the next response. */
      submitting: false,
    };
  },
  computed: {
    model(): SelectProductionToLoseModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'productionToLose' ? (wf as SelectProductionToLoseModel) : undefined;
    },
    cost(): number {
      return this.model?.payProduction.cost ?? 0;
    },
    rows(): Array<ProductionLossRow> {
      const model = this.model;
      return model !== undefined ? buildProductionLossRows(model.payProduction.units, this.cost) : [];
    },
    /** WHY the reduction is forced — normalized by the shared model, so a card
     *  attack and an Ares hazard are described in ONE vocabulary. */
    sourceView(): PromptSourceView | undefined {
      return promptSourceView(this.model);
    },
    /** The card behind the loss, when it IS a card — what L3 opens. */
    sourceCard(): CardName | undefined {
      return this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
    },
    /** Diegetic + translated title (bypasses the server's baked
     *  "Choose N unit(s)…" string), mirroring the desktop premium surface. */
    titleText(): string {
      return this.cost === 1 ?
        translateText('Reduce a production') :
        translateTextWithParams('Reduce production by ${0}', [String(this.cost)]);
    },
    sum(): number {
      return this.rows.reduce((acc, row) => acc + this.lossFor(row.unit), 0);
    },
    ready(): boolean {
      return this.sum === this.cost && this.cost > 0;
    },
    /** Prompt identity — a change is a genuinely new server ask (reset). */
    promptKey(): string {
      return `${textOf(this.model?.title)}|${this.cost}`;
    },
    /** The live command contract — published to the shell's ONE bottom
     *  command bar through consolePanelUi (the footCommands watch below). */
    footCommands(): Array<ConsoleCommand> {
      const cmds: Array<ConsoleCommand> = [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: '−1'},
        {control: 'bumperL', label: '+1'},
        {control: 'secondary', label: 'Confirm', enabled: this.ready},
      ];
      // L3 = the SOURCE, the console-wide grammar («X = the current object,
      // L3 = the source that produced it»). The subject here is the production
      // rows; the card only caused them. Discoverable nowhere else, so it
      // outlives the self-evident hints when the bar drops for fit.
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
        this.resetSelection();
      },
    },
    /** Every server response re-arms submission (root identity always changes). */
    playerView() {
      this.submitting = false;
    },
    /** Publish the CONTEXTUAL command contract to the shell's ONE bottom
     *  command bar (consolePanelUi) — hints live only there, never in a
     *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('productionLoss', cmds);
      },
    },
  },
  beforeUnmount() {
    clearPanelCommands('productionLoss');
  },
  methods: {
    lossFor(unit: keyof Units): number {
      return this.units[unit] ?? 0;
    },
    resultingFor(row: ProductionLossRow): number {
      return row.current - this.lossFor(row.unit);
    },
    /** Signed production readout (+3 / +0 / -2) — these are income rates. */
    fmt(n: number): string {
      return n >= 0 ? `+${n}` : String(n);
    },
    iconClass(unit: keyof Units): string {
      return 'resource_icon resource_icon--' + unit;
    },
    resourceName(unit: keyof Units): string {
      return translateText(unit);
    },
    /** The honest blocker note (never hidden): at-minimum, or a partial cap. */
    noteFor(row: ProductionLossRow): string {
      if (row.disabled) {
        return translateText('Production already at minimum');
      }
      if (row.limitedTo !== undefined) {
        return translateTextWithParams('Can only reduce by ${0}', [String(row.limitedTo)]);
      }
      return '';
    },
    resetSelection(): void {
      this.units = {};
      this.focusIdx = firstSelectableIndex(this.rows);
      this.submitting = false;
      // A lone forced option (one reducible production, lose 1) reads as a
      // confirmation — pre-select it so the player just presses X.
      if (this.cost === 1) {
        const selectable = this.rows.filter((r) => !r.disabled);
        if (selectable.length === 1) {
          this.units = {[selectable[0].unit]: 1};
        }
      }
    },
    /** The shell routes every intent here while the panel is active. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      // L3 — the source card fullscreen. Raw button (the stick presses carry no
      // default semantic action by design); the panel is never unmounted, so
      // the chosen distribution survives the round trip.
      if (intent.kind === 'press' && intent.button === 'stickL' && this.sourceCard !== undefined) {
        this.zoomSource();
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary': // A
      case 'nextSection': // RB — both assign a −1 (user-mandated)
        this.assignLoss();
        return;
      case 'prevSection': // LB — take a −1 back
        this.removeLoss();
        return;
      case 'inspect': // X — confirm
        this.confirm();
        return;
      case 'back': // B — minimize
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    onNav(dir: NavDirection): void {
      const n = this.rows.length;
      if (n === 0) {
        return;
      }
      const step = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
      if (step === 0) {
        return;
      }
      this.focusIdx = Math.min(n - 1, Math.max(0, this.focusIdx + step));
    },
    /** A / RB: assign a −1 to the focused production. */
    assignLoss(): void {
      const row = this.rows[this.focusIdx];
      if (row === undefined || row.disabled) {
        return; // a maxed row is readable, never selectable
      }
      // Cost 1 is single-pick: MOVE the lone −1 onto the focused row.
      if (this.cost === 1) {
        this.units = {[row.unit]: 1};
        return;
      }
      // Cost 2: accumulate, capped by the row's own max AND the remaining loss.
      if (this.sum >= this.cost || this.lossFor(row.unit) >= row.max) {
        return;
      }
      this.units = {...this.units, [row.unit]: this.lossFor(row.unit) + 1};
    },
    /** LB: take a −1 back from the focused production. */
    removeLoss(): void {
      const row = this.rows[this.focusIdx];
      if (row === undefined) {
        return;
      }
      const current = this.lossFor(row.unit);
      if (current <= 0) {
        return;
      }
      const next = {...this.units};
      if (current - 1 <= 0) {
        delete next[row.unit];
      } else {
        next[row.unit] = current - 1;
      }
      this.units = next;
    },
    /** L3: the source card fullscreen, read-only (no select / action bridge,
     *  so it can never submit). It lifts physically out of the dock. */
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
    /** X: confirm the distribution (byte-identical to the desktop submit). */
    confirm(): void {
      if (!this.ready || this.submitting) {
        return;
      }
      this.submitting = true;
      this.$emit('submit', productionToLoseResponse(this.units));
    },
  },
});
</script>
