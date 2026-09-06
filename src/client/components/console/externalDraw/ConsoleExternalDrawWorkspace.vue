<template>
  <!-- «ДОБОР КАРТЫ» — the mandatory take of an EXTERNAL draw. A workspace of
       its own (WORKSPACE_KINDS 'external-draw'), always standalone: the player
       walked in through the mandatory announce, and the take is the only way
       out — no minimize, no back, no close. -->
  <div class="con-extdraw con-ws"
       role="dialog"
       :aria-label="effectLine"
       :data-flow="phase"
       data-motion-surface="external-draw">
    <div class="con-extdraw__frame con-ws-stage-frame" data-motion-panel ref="frameEl">
      <ConsoleWsHead root="Card draw"
                     emblem="cards"
                     :subject="effectCardName"
                     :stage="stageKey"
                     :committed="true" />

      <!-- THE CAUSE — what happened, why, and who set it off. Two calm lines:
           the initiator's act (their chip + the trigger card) and the effect's
           own promise. Constant through the whole take. -->
      <div class="con-extdraw__cause" role="note">
        <div class="con-extdraw__cause-line">
          <span class="con-extdraw__actor" :class="'player_color_' + initiatorColor">
            <span class="con-extdraw__actor-dot" :class="'player_bg_color_' + initiatorColor" aria-hidden="true"></span>
            {{ initiatorName }}
          </span>
          <span class="con-extdraw__cause-text">{{ causeLine }}</span>
        </div>
        <div class="con-extdraw__cause-line con-extdraw__cause-line--effect">{{ effectLine }}</div>
      </div>

      <!-- THE SOURCE SEAT — the effect card, the SAME dock every decision
           surface parks its origin in. L3 lifts this very card fullscreen. -->
      <div class="con-extdraw__source" data-embed-source-slot>
        <console-source-dock :view="sourceView" compact />
      </div>

      <!-- THE CARDS — the shared card chassis. Slots are STABLE for the whole
           batch: a taken card leaves a quiet ghost seat, so the row never
           re-flows under a flight the player is watching. -->
      <div class="con-cards con-extdraw__cards">
        <div class="con-cards__strip con-ws-stage-row con-extdraw__row"
             :class="{'con-cards__strip--has-focus': remaining.length > 0}"
             ref="row">
          <div v-for="(entry, i) in entries" :key="entry.name"
               class="con-cards__slot con-extdraw__slot"
               :data-zoom-slot="entry.name"
               :data-extdraw-slot="entry.name"
               ref="slots"
               :class="{
                 'con-cards__slot--focused': focusIdx === i && interactive && !entry.taken,
                 'con-extdraw__slot--ghost': entry.taken,
                 'con-deal-hold': slotHeld(entry.name),
               }">
            <Card :card="{name: entry.name}" :key="entry.name" lightweight />
            <span v-if="entry.taken" class="con-extdraw__ghostband" aria-hidden="true">
              ✓ {{ $t('In hand') }}
            </span>
          </div>
        </div>

        <!-- STATUS, never a second command bar: the focused card's name, the
             take progress and the shared availability line. Always in layout. -->
        <div class="con-cards__verdictbar con-ws-stage-status con-extdraw__status"
             :class="{'con-cards__verdictbar--held': !interactive}" role="status">
          <div class="con-cards__verdict-inner">
            <span class="con-cards__verdict-name" :key="focusedName">{{ focusedName === '' ? '' : $t(focusedName) }}</span>
            <span class="con-cards__verdict con-cards__verdict--ok">{{ statusText }}</span>
            <ConsoleCardAvailabilityPanel v-if="focusedAvailability !== undefined"
                                          variant="line"
                                          class="con-extdraw__avail"
                                          :view="focusedAvailability"/>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ДОБОР КАРТЫ» — the mandatory take of cards an EXTERNAL effect drew for the
 * viewer (Solar Logistics on a foreign space event — human or MarsBot —
 * Sponsored Academies' «all opponents draw»). Routed off the server's
 * `externalDrawPrompt` marker, never a title.
 *
 * WHAT THE SURFACE OWES (the reason it is not the generic card browser and not
 * the fullscreen reveal): the player was interrupted by somebody else's action,
 * so the screen must answer WHAT they are getting, WHY, and WHO set it off —
 * and then let them take the cards through the ordinary physical grammar:
 *
 *   the deck answers   →  N cards leave `.con-deckstack__pile` into their slots
 *                         (the same shared arrival the deck pick plays)
 *   A takes ONE        →  submit [card] + the card flies into the hand dock
 *                         (`runHandIntake`); its seat stays as a quiet ghost,
 *                         so the row never re-flows mid-flight
 *   B takes ALL        →  submit the rest + the stack intake
 *   the LAST take      →  the prompt ends; the shell folds the workspace once
 *                         the flight lands (`externalDrawHolding`)
 *
 * NON-MINIMIZABLE BY CONSTRUCTION: no `defer` emit, `taskMinimizable` answers
 * false, and B is «Забрать все» (hidden for a single card) — never «назад».
 * Input during a take is absorbed BY PHASE (`sending`), so a held button or a
 * double press cannot take twice; each server response re-arms the submission
 * (the decision-surface-rearm contract).
 */
import {defineComponent, markRaw, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ExternalDrawTakeMeta} from '@/common/models/ExternalDrawPromptModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {sourceSeatReservePx, wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {stepHandGrid} from '@/client/components/console/consoleHandGrid';
import {nearestInDirection} from '@/client/console/consoleStartNav';
import {runBatchArrival, settleBatchProxiesOnto, BatchArrivalHandle} from '@/client/console/consoleBatchArrivalMotion';
import {runHandIntake, handDockReachable} from '@/client/console/handDock/handDeliveryDirector';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {availabilityContextFor, buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import {PromptSourceView, promptSourceView} from '@/client/console/promptSource';
import {cardsResponse} from '@/client/console/taskResponses';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {workspaceSourceZoomOrigin} from '@/client/console/consoleWorkspaceOutcome';
import {
  armDeckPickFlight, clearDeckPickFlight, deckPickProxyEls,
} from '@/client/console/deckPick/consoleDeckPick';
import {
  beginExternalDrawDeal, beginExternalDrawReady, beginExternalDrawSend,
  endExternalDrawSend, externalDrawIntakeKey, externalDrawState, externalDrawTakeOf,
  markIntakeDealt, rollbackExternalDrawSend, shouldDealIntake,
} from '@/client/console/externalDraw/consoleExternalDraw';
import {motionMs} from '@/client/components/motion/motionTokens';

/** Bounded retry while the row has no layout yet (JSDOM / mid-reload). */
const FIT_RETRIES = 20;

/** How long a slow server may take before an unchanged prompt reads as a
 *  refusal (the deck-pick constant, same reasoning). */
const REFUSAL_GRACE_MS = 1500;

type SlotEntry = {name: CardName, taken: boolean};

function asElements(ref: unknown): Array<HTMLElement> {
  return Array.isArray(ref) ? (ref as Array<HTMLElement>).filter((el) => el instanceof HTMLElement) : [];
}

export default defineComponent({
  name: 'ConsoleExternalDrawWorkspace',
  // `console-source-dock` is registered GLOBALLY (main.ts) — deliberately not a
  // local import: it renders the real premium card face, and that import chain
  // zeroes a mochapack spec.
  components: {Card, ConsoleCardAvailabilityPanel, ConsoleWsHead},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit'],
  data() {
    return {
      focusIdx: 0,
      /** The STABLE slot list for the whole batch (ghosts included). */
      slotsList: [] as Array<SlotEntry>,
      /** Names still owned by an arrival proxy (real slot held under it). */
      held: new Set<string>(),
      handle: undefined as BatchArrivalHandle | undefined,
      /** Blocks a duplicate submit between the press and the response. */
      submitting: false,
      fitRetries: 0,
      ro: undefined as ResizeObserver | undefined,
      /** Module reactive → data mirror (path watchers need it). */
      flow: externalDrawState,
    };
  },
  computed: {
    view(): PlayerViewModel {
      return this.playerView;
    },
    model(): SelectCardModel | undefined {
      const wf = this.view.waitingFor;
      return wf?.type === 'card' && wf.externalDrawPrompt !== undefined ? (wf as SelectCardModel) : undefined;
    },
    meta(): ExternalDrawTakeMeta | undefined {
      return externalDrawTakeOf(this.view.waitingFor);
    },
    intakeKey(): string {
      const m = this.meta;
      return m === undefined ? '' : externalDrawIntakeKey(m);
    },
    /** Cards still awaiting the take, as the SERVER states them. */
    remaining(): Array<CardName> {
      return (this.model?.cards ?? []).map((c) => c.name);
    },
    /** The rendered slots — the stable batch order, ghosts included. */
    entries(): Array<SlotEntry> {
      return this.slotsList;
    },
    phase(): string {
      return this.flow.phase;
    },
    interactive(): boolean {
      return this.phase === 'ready' && !this.submitting && this.meta !== undefined;
    },
    effectCardName(): string {
      return this.meta?.effectCard ?? '';
    },
    initiatorColor(): Color | '' {
      return this.meta?.initiator ?? '';
    },
    initiatorName(): string {
      return displayNameForColor(this.view.players, this.meta?.initiator);
    },
    /** The initiator's ACT — «разыграл(а) карту X». The trigger card is the
     *  card that ACTIVATED the effect; for an initiator-owned effect card the
     *  effect card itself is what they played. */
    causeLine(): string {
      const m = this.meta;
      if (m === undefined) {
        return '';
      }
      const played = m.triggerCard ?? (m.effectCardOwner === 'initiator' ? m.effectCard : undefined);
      return played !== undefined ?
        translateTextWithParams('played ${0}', [translateText(played)]) :
        translateText('took an action');
    },
    /** The effect's own promise — whose card grants, and how much. */
    effectLine(): string {
      const m = this.meta;
      if (m === undefined) {
        return '';
      }
      return m.effectCardOwner === 'you' ?
        translateTextWithParams('Your ${0} effect: take ${1} card(s)', [translateText(m.effectCard), String(m.count)]) :
        translateTextWithParams('${0}: you receive ${1} card(s)', [translateText(m.effectCard), String(m.count)]);
    },
    sourceView(): PromptSourceView {
      return promptSourceView(this.view.waitingFor) ??
        {card: this.meta?.effectCard, kindKey: 'Card', inspectable: this.meta !== undefined};
    },
    stageKey(): string {
      return this.phase === 'dealing' ? 'Drawing cards…' : 'Intake';
    },
    focusedName(): string {
      const entry = this.entries[this.focusIdx];
      return entry === undefined || entry.taken ? '' : entry.name;
    },
    liveModelFor(): (name: string) => CardModel | undefined {
      const cards = this.model?.cards;
      return (name) => cards?.find((c) => c.name === name);
    },
    /** The focused card's future value — the shared model in the take voice.
     *  Informational only; it never gates the take. */
    focusedAvailability(): CardAvailabilityView | undefined {
      if (!this.interactive || this.focusedName === '') {
        return undefined;
      }
      const context = availabilityContextFor('draw-take');
      if (context === undefined) {
        return undefined;
      }
      return buildCardAvailability({reasons: this.liveModelFor(this.focusedName)?.unplayableReasons}, context);
    },
    statusText(): string {
      const m = this.meta;
      if (this.phase === 'dealing') {
        return translateTextWithParams('Cards from the deck: ${0}', [String(this.entries.length)]);
      }
      if (this.phase === 'sending' || m === undefined) {
        return translateText('Taking the card…');
      }
      const total = m.count;
      const taken = total - this.remaining.length;
      return taken > 0 ?
        translateTextWithParams('Taken: ${0} of ${1}', [String(taken), String(total)]) :
        (total > 1 ?
          translateTextWithParams('Take ${0} cards', [String(total)]) :
          translateText('Take the card'));
    },
    footCommands(): Array<ConsoleCommand> {
      if (!this.interactive) {
        // A beat in flight absorbs the pad by construction — advertising a
        // verb the surface will swallow is worse than advertising none.
        return [];
      }
      const cmds: Array<ConsoleCommand> = [];
      if (this.remaining.length > 1) {
        cmds.push({control: 'dpad', label: 'Navigate'});
      }
      cmds.push({control: 'confirm', label: 'Collect the card', priority: 0});
      cmds.push({control: 'secondary', label: 'Inspect'});
      if (this.sourceView.inspectable) {
        cmds.push({control: 'stickL', label: 'Source', priority: 1});
      }
      // B = «Забрать все» — ONLY while more than one card is owed. For a
      // single take the button does nothing and, per the contract, promises
      // nothing (no false «close» affordance on a locked workspace).
      if (this.remaining.length > 1) {
        cmds.push({control: 'back', label: 'Collect all', priority: 1});
      }
      return cmds;
    },
    /** The prompt IDENTITY — a change is the server moving on (a re-issued
     *  remainder, the next intake, or the end). Structural, never the title. */
    promptKey(): string {
      return `${this.intakeKey}#${this.remaining.join('|')}`;
    },
  },
  watch: {
    promptKey: {
      immediate: true,
      handler(): void {
        // EVERY server answer re-arms the submission (the rearm contract) —
        // two takes ride one persistent instance, and a stuck `submitting`
        // is a visible button that swallows every A.
        this.submitting = false;
        if (this.flow.phase === 'sending') {
          endExternalDrawSend();
        }
        this.reconcileSlots();
      },
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: Array<ConsoleCommand>): void {
        setPanelCommands('externalDraw', cmds);
      },
    },
    'entries.length'(): void {
      this.scheduleFit();
    },
  },
  mounted(): void {
    this.scheduleFit();
    const box = (this.$el as HTMLElement | undefined)?.parentElement ??
      (this.$refs.frameEl as HTMLElement | undefined);
    if (box !== null && box !== undefined && typeof ResizeObserver === 'function') {
      const ro = markRaw(new ResizeObserver(() => this.scheduleFit()));
      ro.observe(box);
      this.ro = ro;
    }
  },
  beforeUnmount(): void {
    clearPanelCommands('externalDraw');
    this.handle?.kill();
    this.handle = undefined;
    clearDeckPickFlight();
    this.ro?.disconnect();
    this.ro = undefined;
  },
  methods: {
    slotHeld(name: CardName): boolean {
      return this.held.has(name);
    },

    // ── SLOTS: one stable layout for the whole batch ────────────────────
    /**
     * Reconcile the stable slot list against the server's remaining set. A
     * NEW intake rebuilds the list and plays the deal; a re-issued remainder
     * only marks the missing names as ghosts (their seats stay), so the row
     * the player aimed at is the row that stays.
     */
    reconcileSlots(): void {
      const m = this.meta;
      if (m === undefined) {
        return; // the prompt ended — the shell is folding us; keep the last frame.
      }
      const key = this.intakeKey;
      const remaining = new Set(this.remaining);
      const knownBatch = !shouldDealIntake(key) &&
        this.slotsList.length > 0 &&
        this.remaining.every((n) => this.slotsList.some((s) => s.name === n));
      if (knownBatch) {
        for (const slot of this.slotsList) {
          slot.taken = !remaining.has(slot.name);
        }
        this.focusNextRemaining();
        this.scheduleFit();
        return;
      }
      // A NEW batch (first open, a second intake, a reload re-entry): the
      // remaining cards ARE the batch — cards taken before a reload are in
      // the hand already and honestly leave no ghost.
      this.slotsList = this.remaining.map((name) => ({name, taken: false}));
      this.focusIdx = 0;
      this.startDeal(key);
    },
    focusNextRemaining(): void {
      const current = this.entries[this.focusIdx];
      if (current !== undefined && !current.taken) {
        return;
      }
      const next = this.entries.findIndex((e, i) => !e.taken && i >= this.focusIdx);
      this.focusIdx = next !== -1 ? next : Math.max(0, this.entries.findIndex((e) => !e.taken));
    },

    // ── THE DEAL (the deck answers) ─────────────────────────────────────
    startDeal(key: string): void {
      this.handle?.kill();
      this.handle = undefined;
      if (!shouldDealIntake(key)) {
        // Adopted (a raced re-render of the same intake): no re-deal.
        beginExternalDrawReady();
        this.scheduleFit();
        return;
      }
      markIntakeDealt(key);
      beginExternalDrawDeal();
      const names = this.slotsList.map((s) => s.name);
      this.held = new Set<string>(names);
      if (typeof window === 'undefined') {
        this.held.clear();
        beginExternalDrawReady();
        return;
      }
      // The bodies live in the app-level deck-pick flight layer — the same
      // physical event («cards leave the deck pile into a workspace stage»),
      // the same stage, deliberately shared.
      armDeckPickFlight(names);
      void this.$nextTick(() => {
        this.fitRow();
        void this.$nextTick(() => this.launchDeal());
      });
    },
    launchDeal(): void {
      if (this.handle !== undefined) {
        return;
      }
      const proxies = deckPickProxyEls();
      const slots = asElements(this.$refs.slots);
      const cards = proxies
        .map((proxy) => ({proxy, flip: proxy.querySelector<HTMLElement>('.con-deal-proxy__flip')}))
        .filter((c): c is {proxy: HTMLElement, flip: HTMLElement} => c.flip !== null);
      if (cards.length === 0 || slots.length === 0) {
        this.finishDeal();
        return;
      }
      // The faces are known (the prompt carries them) — the batch opens IN
      // FLIGHT, the classic draw reveal.
      this.handle = runBatchArrival({
        cards, slots,
        mode: 'in-flight-reveal',
        onSettled: () => {
          this.handle = undefined;
          this.handOffDeal();
        },
      });
    },
    handOffDeal(): void {
      const slots = asElements(this.$refs.slots);
      const proxies = deckPickProxyEls();
      if (proxies.length === 0) {
        this.finishDeal();
        return;
      }
      settleBatchProxiesOnto({
        pairs: proxies.map((proxy, i) => ({
          proxy,
          target: slots[i]?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slots[i],
        })),
        onDone: () => {
          this.held.clear();
          this.finishDeal();
        },
      });
    },
    finishDeal(): void {
      clearDeckPickFlight();
      this.held.clear();
      beginExternalDrawReady();
      this.scheduleFit();
    },

    // ── FIT (the shared stage geometry engine) ──────────────────────────
    scheduleFit(): void {
      this.fitRetries = 0;
      void this.$nextTick(() => this.fitRow());
    },
    fitRow(): void {
      const row = this.$refs.row as HTMLElement | null | undefined;
      if (row === null || row === undefined || this.entries.length === 0) {
        return;
      }
      row.style.setProperty('--con-cards-zoom', '1');
      row.style.setProperty('--con-ws-stage-rowmax', '100%');
      const probe = row.children[0] as HTMLElement | undefined;
      const slotW = probe?.offsetWidth ?? 0;
      const slotH = probe?.offsetHeight ?? 0;
      if (slotW <= 0 || slotH <= 0) {
        if (this.fitRetries < FIT_RETRIES) {
          this.fitRetries++;
          requestAnimationFrame(() => this.fitRow());
        }
        return;
      }
      this.fitRetries = 0;
      const cs = window.getComputedStyle(row);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const ui = conUiScale();
      const reserve = sourceSeatReservePx(ui);
      const layout = wsStageLayout({
        availW: row.clientWidth - padX - reserve * 2,
        availH: Math.max(200 * ui, this.rowBudgetPx() - padY),
        slotW, slotH, n: this.entries.length, ui,
        rowGapPx: parseFloat(cs.rowGap) || undefined,
        padXPx: padX,
      });
      const style = wsStageLayoutStyle(layout);
      Object.entries(style).forEach(([k, v]) => row.style.setProperty(k, v));
    },
    rowBudgetPx(): number {
      const frame = this.$refs.frameEl as HTMLElement | null | undefined;
      if (frame === null || frame === undefined) {
        return 0;
      }
      const fcs = window.getComputedStyle(frame);
      let budget = frame.clientHeight -
        (parseFloat(fcs.paddingTop) || 0) - (parseFloat(fcs.paddingBottom) || 0);
      const root = this.$el as HTMLElement | undefined;
      for (const sel of ['.con-wshead', '.con-extdraw__cause', '.con-extdraw__status']) {
        const el = root?.querySelector<HTMLElement>(sel) ?? null;
        if (el !== null) {
          const ecs = window.getComputedStyle(el);
          budget -= el.offsetHeight +
            (parseFloat(ecs.marginTop) || 0) + (parseFloat(ecs.marginBottom) || 0);
        }
      }
      const cards = root?.querySelector<HTMLElement>('.con-extdraw__cards') ?? null;
      budget -= parseFloat(fcs.rowGap) || 0;
      budget -= cards === null ? 0 : (parseFloat(window.getComputedStyle(cards).rowGap) || 0);
      return budget;
    },

    // ── INPUT ───────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      if (!this.interactive) {
        return; // a beat in flight absorbs the pad — no double take possible
      }
      if (intent.kind === 'nav') {
        this.move(intent.dir);
        return;
      }
      // L3 — the SOURCE card fullscreen (console-wide grammar).
      if (intent.kind === 'press' && intent.button === 'stickL') {
        this.inspectSource();
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary': // A — take the focused card
        this.takeFocused();
        return;
      case 'inspect': // X — the console-wide fullscreen inspect
        this.inspectFocused();
        return;
      case 'back': // B — take ALL (multi only; for a single card it is silent)
        if (this.remaining.length > 1) {
          this.takeAll();
        }
        return;
      default:
        return;
      }
    },
    move(dir: 'up' | 'down' | 'left' | 'right'): void {
      const els = asElements(this.$refs.slots);
      const rects = els
        .map((el) => el.getBoundingClientRect())
        .map((r) => ({left: r.left, top: r.top, width: r.width, height: r.height}));
      const step = (from: number): number => {
        if (rects.length === this.entries.length && rects.every((r) => r.width > 4)) {
          return nearestInDirection(rects, from, dir);
        }
        const row = this.$refs.row as HTMLElement | null | undefined;
        const perRow = Math.max(1, parseInt(
          row?.style.getPropertyValue('--con-ws-stage-per-row') || String(this.entries.length), 10) ||
          this.entries.length);
        return stepHandGrid(from, dir, this.entries.length, perRow);
      };
      // Ghost seats stay in layout but are NOT stops — walk past them,
      // bounded by the batch size so a fully-ghosted row cannot spin.
      let next = step(this.focusIdx);
      let guard = this.entries.length;
      while (guard-- > 0 && next >= 0 && next !== this.focusIdx && this.entries[next]?.taken) {
        next = step(next);
      }
      if (next >= 0 && !this.entries[next]?.taken) {
        this.focusIdx = next;
      }
    },

    // ── THE TAKE ────────────────────────────────────────────────────────
    /** A — take the focused card: submit + fly it into the dock. */
    takeFocused(): void {
      const name = this.focusedName as CardName;
      if (name === '' || !this.remaining.includes(name)) {
        return;
      }
      this.take([name]);
    },
    /** B — take everything still owed, in batch order. */
    takeAll(): void {
      const rest = this.entries.filter((e) => !e.taken).map((e) => e.name)
        .filter((n) => this.remaining.includes(n));
      if (rest.length === 0) {
        return;
      }
      this.take(rest);
    },
    take(names: ReadonlyArray<CardName>): void {
      if (this.submitting || !this.interactive) {
        return;
      }
      this.submitting = true;
      // Synchronous with the submit — no frame exists in which the prompt has
      // moved on and the hold is not yet up (the shell's close watcher reads
      // `externalDrawHolding` before folding the frame).
      beginExternalDrawSend(names);
      this.$emit('submit', cardsResponse([...names]));
      void this.runTakeBeats(names);
    },
    async runTakeBeats(names: ReadonlyArray<CardName>): Promise<void> {
      const key = this.promptKey;
      try {
        await this.flyToHand(names);
      } finally {
        await this.awaitPromptMoved(key);
        if (this.meta !== undefined && this.promptKey === key) {
          // The server is still asking the very same question: the take was
          // REFUSED. The cards come back into play — never a sealed beat.
          this.submitting = false;
          rollbackExternalDrawSend(names);
        } else {
          endExternalDrawSend();
        }
      }
    },
    awaitPromptMoved(key: string): Promise<void> {
      if (this.meta === undefined || this.promptKey !== key || typeof window === 'undefined') {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            stop();
            window.clearTimeout(timer);
            resolve();
          }
        };
        const stop = this.$watch(
          () => this.meta === undefined || this.promptKey !== key,
          (moved: boolean) => {
            if (moved) {
              finish();
            }
          });
        const timer = window.setTimeout(finish, motionMs(REFUSAL_GRACE_MS));
      });
    },
    async flyToHand(names: ReadonlyArray<CardName>): Promise<void> {
      if (!handDockReachable()) {
        return; // no dock on screen — never a ghost flight
      }
      const entries = names
        .map((name) => {
          const el = this.slotEl(name);
          return el === null ? undefined : {name, el};
        })
        .filter((e): e is {name: CardName, el: HTMLElement} => e !== undefined);
      if (entries.length === 0) {
        return;
      }
      await runHandIntake(entries, {mode: entries.length > 1 ? 'stack' : 'cascade'});
    },
    slotEl(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const key = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(name) : name.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-extdraw-slot="${key}"] :is(.card-container, .pcard)`) ??
        root.querySelector<HTMLElement>(`[data-extdraw-slot="${key}"]`);
    },

    // ── INSPECTION ──────────────────────────────────────────────────────
    /** X = the CURRENT card fullscreen — read-only (no select bridge: a take
     *  is a physical commitment, never something a zoom press does). */
    inspectFocused(): void {
      const live = this.entries.filter((e) => !e.taken);
      if (live.length === 0) {
        return;
      }
      const focusIn = Math.max(0, live.findIndex((e) => e.name === this.focusedName));
      const cards = live.map((e) => this.liveModelFor(e.name) ?? ({name: e.name} as CardModel));
      openConsoleCardZoom(cards, focusIn, undefined, undefined, {
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement | undefined,
          (i) => live[i]?.name ?? '',
          (i) => {
            const at = this.entries.findIndex((e) => e.name === live[i]?.name);
            if (at >= 0) {
              this.focusIdx = at;
            }
          }),
        availability: availabilityContextFor('draw-take'),
      });
    },
    /** L3 = the SOURCE — the effect card lifts out of its seat. */
    inspectSource(): void {
      const card = this.sourceView.inspectable ? this.sourceView.card : undefined;
      if (card === undefined) {
        return;
      }
      const model = this.view.thisPlayer.tableau.find((c) => c.name === card) ?? {name: card};
      openConsoleCardZoom([model as CardModel], 0, undefined, undefined, {
        contextLabel: 'Card draw',
        statusLabel: 'Source',
        origin: workspaceSourceZoomOrigin(String(card)),
      });
    },
  },
});
</script>
