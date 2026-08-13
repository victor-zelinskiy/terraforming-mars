<template>
  <!-- THE DRAW & SELECT SURFACE. Standalone it is an ordinary workspace-band
       member (`con-ws` + `.con-ws-band()`); EMBEDDED it is the same instance
       teleported into its host's zone with the chrome stripped — one `embedded`
       prop, nothing else differs (the six-rule embed contract). -->
  <div class="con-deckpick"
       :class="{
         'con-ws': !embedded,
         'con-deckpick--embedded': embedded,
         'con-deckpick--sending': phase === 'sending',
         'con-deckpick--clearing': phase === 'clearing',
       }"
       :role="embedded ? 'group' : 'dialog'"
       :aria-label="askText"
       :data-flow="phase"
       :data-motion-surface="embedded ? undefined : 'deck-pick'">
    <div class="con-deckpick__frame con-ws-stage-frame" data-motion-panel ref="frameEl">
      <!-- STANDALONE ONLY. Embedded, the stage name is handed UP to the host's
           breadcrumb (`setWorkspaceOutcomePhase`) — a surface that titles
           itself inside somebody else's frame reads as a modal that arrived. -->
      <ConsoleWsHead v-if="!embedded"
                     root="Card draw"
                     emblem="cards"
                     :subject="sourceName"
                     :stage="stageKey"
                     :committed="committed" />

      <!-- The stage's own sentence + its live state, on ONE reserved row —
           the shared chassis every card result in a workspace wears. -->
      <ConsoleWsStageHead class="con-deckpick__head" :title="headTitle">
        <template #badges>
          <span class="con-ws-stage-badge" :class="{'con-ws-stage-badge--ready': ready}">
            <span class="con-ws-stage-badge__icon resource_icon resource_icon--cards" aria-hidden="true"></span>
            <span class="con-ws-stage-badge__label">{{ $t('Selected') }}</span>
            <b class="con-ws-stage-badge__num">{{ picks.length }}/{{ bounds.max }}</b>
          </span>
        </template>
      </ConsoleWsStageHead>

      <!-- The cards themselves ride the SHARED card chassis (`.con-cards`),
           so slot sizing, the focus ring, the pick band and the status rail
           are the same objects the hand and the buy stage use. What this
           surface adds is only what is genuinely its own: the deck they come
           out of, and the fate of the ones not taken. -->
      <div class="con-cards con-deckpick__cards">
        <div class="con-cards__strip con-ws-stage-row con-deckpick__row"
             :class="{'con-cards__strip--has-focus': entries.length > 0}"
             ref="row">
          <div v-for="(entry, i) in entries" :key="entry.name"
               class="con-cards__slot con-deckpick__slot"
               :data-zoom-slot="entry.name"
               :data-deckpick-slot="entry.name"
               ref="slots"
               :class="{
                 'con-cards__slot--focused': focusIdx === i && interactive,
                 'con-cards__slot--picked': isPicked(entry.name),
                 'con-cards__slot--dim': dimUnpicked && !isPicked(entry.name),
                 'con-deal-hold': slotHeld(entry.name),
               }">
            <Card :card="{name: entry.name}" :key="entry.name" lightweight />
            <span v-if="isPicked(entry.name)" class="con-cards__pickband con-cards__pickband--select" aria-hidden="true">
              ✓ {{ $t('Card selected') }}
            </span>
          </div>
        </div>

        <!-- STATUS, never a second command bar (the bottom bar is the ONE
             source of gamepad verbs). Always in layout so the fit engine
             measures a stable chrome and the row can never reflow. -->
        <!-- Held only while the cards are ARRIVING — a name and a verb there
             would point at a slot that is still empty. Past the commit the line
             is the opposite of a promise: it is what explains where the cards
             the player did NOT take are going, so it stays. -->
        <div class="con-cards__verdictbar con-ws-stage-status con-deckpick__status"
             :class="{'con-cards__verdictbar--held': !interactive && !committed}" role="status">
          <div class="con-cards__verdict-inner">
            <span v-if="!committed" class="con-cards__verdict-name" :key="focusedName">{{ focusedName === '' ? '' : $t(focusedName) }}</span>
            <span class="con-cards__verdict" :class="statusToneClass">{{ statusText }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- (THE DEAL's bodies live in the APP-LEVEL `ConsoleDeckPickLayer` — a
         `position: fixed` proxy inside a TELEPORTED surface resolves against
         whatever ancestor happens to be animating, which is how the cards
         ended up flying in from the right edge instead of off the deck.) -->
  </div>
</template>

<script lang="ts">
/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПОСМОТРИ N КАРТ КОЛОДЫ, ОСТАВЬ K» — the ONE surface for the whole family
 * (Корпоративные архивы 7→2, Деловые контакты 4→2, Конкурс изобретений 3→1,
 * Nanotech Industries 3→2, Leavitt, the Delta science stage, the discard-pile
 * diggers). Routed off the server's `deckPickPrompt` marker, never a title.
 *
 * WHY IT IS NOT THE GENERIC CARD BROWSER. The browser's job is "point at a
 * card"; every card it offers already belongs to somebody, sits somewhere, and
 * stays there. These cards belong to nobody. They came off the deck a moment
 * ago FOR this decision, the picks become the player's hand and the rest are
 * discarded — three physical facts the browser has no way to state, so it
 * stated none of them: seven cards simply appeared, the deck never moved, and
 * the two kept cards teleported into the dock.
 *
 * So the surface owes a CAUSAL CHAIN, and that is all it adds over the shared
 * chassis it otherwise reuses wholesale:
 *
 *   the deck answers  →  N cards physically leave `.con-deckstack__pile`, each
 *                        on its own trajectory, into its own prepared slot
 *   the player picks  →  the ordinary console pick grammar (focus ring, band,
 *                        A toggles, the bar's confirm goes live at the bound)
 *   the picks LEAVE   →  they fly into the hand dock (`runHandIntake`), which
 *                        comes out of its compact pose to receive them
 *   only THEN         →  the cards left behind tumble away
 *
 * The last two are the reason `consoleDeckPick.ts` exists: the prompt ends at
 * the submit, and both beats live after it.
 *
 * HOST-AGNOSTIC. `embedded` strips exactly three things — the `con-ws` rail
 * marker, `ConsoleWsHead`, and the band geometry. Content, input, state and
 * the flight are untouched, which is what lets the same instance be teleported
 * into the start workspace's zone for a prelude and stand in its own band for a
 * card played from hand.
 *
 */
import {defineComponent, markRaw, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Message} from '@/common/logs/Message';
import {DeckPickPromptMeta, SelectCardModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {stepHandGrid} from '@/client/components/console/consoleHandGrid';
import {nearestInDirection} from '@/client/console/consoleStartNav';
import {handSelectPicksValid} from '@/client/components/console/consoleHandSelectModel';
import {runBatchArrival, settleBatchProxiesOnto, BatchArrivalHandle} from '@/client/console/consoleBatchArrivalMotion';
import {holdDeckDisplay, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {runHandIntake, handDockReachable} from '@/client/console/handDock/handDeliveryDirector';
import {applyDiscardExit} from '@/client/console/cardDeal/cardExitDirector';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {cardsResponse} from '@/client/console/taskResponses';
import {markWorkspaceOutcomeArrivalDone, setWorkspaceOutcomePhase, workspaceSourceZoomOrigin} from '@/client/console/consoleWorkspaceOutcome';
import {
  armDeckPickFlight, beginDeckPickChoosing, beginDeckPickClearing, beginDeckPickDeal,
  beginDeckPickSend, clearDeckPickFlight, deckPickProxyEls, deckPickState,
  endDeckPickCommit, rollbackDeckPickCommit,
} from '@/client/console/deckPick/consoleDeckPick';
import {motionMs} from '@/client/components/motion/motionTokens';

/** How long the cards left behind take to tumble away — a short CLEAN-UP beat,
 *  never a phase of its own. `applyDiscardExit` owns the motion; this is only
 *  the budget after which the surface may go. */
const CLEAR_MS = 380;

/** Bounded retry while the row has no layout yet (JSDOM / mid-reload). */
const FIT_RETRIES = 20;

/** How long a slow server is given to answer before an unchanged prompt is
 *  read as a refusal. Generous next to the ~1.6 s of beats it follows, and
 *  short enough that a genuine refusal gives the screen back promptly. */
const REFUSAL_GRACE_MS = 1500;

function asElements(ref: unknown): Array<HTMLElement> {
  return Array.isArray(ref) ? (ref as Array<HTMLElement>).filter((el) => el instanceof HTMLElement) : [];
}

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleDeckPick',
  // `console-source-dock` is registered GLOBALLY (main.ts) — deliberately not a
  // local import: it renders the real premium card face, and that import chain
  // zeroes this file's mochapack spec.
  components: {Card, ConsoleWsHead, ConsoleWsStageHead},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** Teleported into a host workspace's zone → no shell of its own. */
    embedded: {type: Boolean, default: false},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      focusIdx: 0,
      picks: [] as Array<CardName>,
      /** The deal is on screen — the app-level layer holds the bodies. */
      flyOn: false,
      /** Names still owned by a proxy (the real slot stays held under it). */
      held: new Set<string>(),
      handle: undefined as BatchArrivalHandle | undefined,
      /** Blocks a duplicate submit between the press and the response. */
      submitting: false,
      fitRetries: 0,
      /**
       * THE SNAPSHOT TAKEN AT THE COMMIT.
       *
       * The prompt dies at the submit — `waitingFor` names the next one (or
       * nothing) before the picks have moved a pixel — so a row rendered
       * straight off the model would delete all seven cards on the very frame
       * the flight was supposed to start from them. The surface holds itself
       * mounted for those beats (`consoleDeckPick.committing`); this is what it
       * holds itself mounted AROUND.
       */
      frozen: undefined as {
        entries: Array<{name: CardName}>,
        bounds: {min: number, max: number},
        source: PromptSourceView | undefined,
      } | undefined,
      rowStyle: {} as Record<string, string>,
      /** Re-fit when the HOST's box changes, not merely when the window does.
       *  The zone this surface lives in is a host's zone: the start
       *  workspace's queue recedes and its column grows AFTER the mount, and a
       *  fit that only ever ran on that first tick left the row solved against
       *  a box that no longer existed — seven cards laid out for a band that
       *  had since changed size, half of them off screen. */
      ro: undefined as ResizeObserver | undefined,
      /** Mirrored so a path watcher fires (module reactive → data mirror). */
      flow: deckPickState,
    };
  },
  computed: {
    model(): SelectCardModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'card' && wf.deckPickPrompt !== undefined ? (wf as SelectCardModel) : undefined;
    },
    meta(): DeckPickPromptMeta | undefined {
      return this.model?.deckPickPrompt;
    },
    /** The candidates as the SERVER currently states them. */
    liveEntries(): Array<{name: CardName}> {
      return (this.model?.cards ?? []).map((c) => ({name: c.name}));
    },
    /** What the row actually renders: the frozen set past the commit, the live
     *  one before it. One computed, so nothing downstream has to know. */
    entries(): Array<{name: CardName}> {
      return this.frozen?.entries ?? this.liveEntries;
    },
    bounds(): {min: number, max: number} {
      if (this.frozen !== undefined) {
        return this.frozen.bounds;
      }
      const m = this.meta;
      return {min: m?.min ?? 1, max: Math.max(1, m?.max ?? 1)};
    },
    /** The whole prompt is answered by taking EXACTLY this many. */
    exact(): boolean {
      return this.bounds.min === this.bounds.max;
    },
    ready(): boolean {
      return handSelectPicksValid(this.bounds, this.picks.length);
    },
    /** The flow's phase, as the module sees it — one source for the class, the
     *  input gate and the command bar. */
    phase(): string {
      return this.flow.phase;
    },
    /** May the player act? Not while cards are still arriving, and never past
     *  the commit — `sending` / `clearing` are beats, not destinations. */
    interactive(): boolean {
      return this.phase === 'choosing' && !this.submitting;
    },
    /** Past the commit boundary — the header dresses the stage calmly. */
    committed(): boolean {
      return this.phase === 'sending' || this.phase === 'clearing';
    },
    /** At the pick ceiling the unpicked cards calm down: the decision is made,
     *  and the remaining candidates are no longer offers. */
    dimUnpicked(): boolean {
      return this.picks.length >= this.bounds.max && this.bounds.max > 1;
    },
    focusedName(): string {
      return this.entries[this.focusIdx]?.name ?? '';
    },
    sourceView(): PromptSourceView | undefined {
      return this.frozen !== undefined ? this.frozen.source : promptSourceView(this.model);
    },
    /** The crumb's subject when this surface stands on its own — the card that
     *  turned the deck over. Embedded, the HOST names it (its own source card
     *  is already on screen beside the row). */
    sourceName(): string {
      return this.sourceView?.card ?? '';
    },
    /** The stage segment, handed UP while embedded. One word: the root already
     *  says «ДОБОР КАРТ», so the tail must not echo its noun. */
    stageKey(): string {
      switch (this.phase) {
      case 'dealing': return 'Drawing cards…';
      case 'sending': return 'Received';
      case 'clearing': return 'Received';
      default: return 'Selection';
      }
    },
    /** The stage's own sentence. The SERVER title wins («Оставьте себе 2
     *  карт(ы)») — it is the precise ask, phrased by the rule that asked. */
    askText(): string {
      const server = textOf(this.model?.title);
      if (server !== '') {
        return server;
      }
      return this.exact ?
        translateTextWithParams('Keep ${0} of the drawn cards', [String(this.bounds.max)]) :
        translateTextWithParams('Keep up to ${0} of the drawn cards', [String(this.bounds.max)]);
    },
    headTitle(): string {
      if (this.phase === 'dealing') {
        return translateText(this.meta?.origin === 'discard' ? 'From the discard pile' : 'Drawing cards…');
      }
      if (this.committed) {
        return translateTextWithParams('Taken into hand: ${0}', [String(this.flow.kept)]);
      }
      return this.askText;
    },
    /** What the status rail says — one line, always in layout. */
    statusText(): string {
      if (this.phase === 'dealing') {
        return translateTextWithParams('Cards from the deck: ${0}', [String(this.entries.length)]);
      }
      if (this.committed) {
        return translateText('The rest is discarded');
      }
      const left = this.bounds.max - this.picks.length;
      if (left > 0) {
        return this.exact ?
          translateTextWithParams('Choose ${0} more', [String(left)]) :
          translateTextWithParams('You may take ${0} more', [String(left)]);
      }
      return translateText('Selection complete');
    },
    statusToneClass(): Record<string, boolean> {
      return {
        'con-cards__verdict--ok': !this.ready && !this.committed,
        'con-cards__verdict--picked': this.ready || this.committed,
      };
    },
    /** The prompt IDENTITY — a change is a genuinely new server ask. Built
     *  structurally (never the translated title, which i18n rewrites in place). */
    promptKey(): string {
      const m = this.meta;
      // Deliberately off the LIVE model, never the frozen snapshot: this key's
      // whole job is to notice the server moving on, and a frozen one never
      // would.
      return `${this.liveEntries.map((e) => e.name).join('|')}#${m?.min ?? 0}-${m?.max ?? 0}`;
    },
    footCommands(): Array<ConsoleCommand> {
      if (!this.interactive) {
        // A beat in flight absorbs the pad by construction — advertising a
        // verb the surface will swallow is worse than advertising none.
        return [];
      }
      // The SAME grammar the card browser uses, so the family reads as one
      // screen: A toggles a pick, X inspects the focused card, RT commits the
      // set, L3 opens the source, B minimizes. A single-keep prompt answers on
      // the A press itself (there is no set to commit), so RT is not offered.
      const picked = this.isPicked(this.focusedName as CardName);
      const single = this.exact && this.bounds.max === 1;
      const cmds: Array<ConsoleCommand> = [
        {control: 'dpad', label: 'Navigate'},
        {
          control: 'confirm',
          label: single ? 'Select' : (picked ? 'Deselect' : 'Select'),
          enabled: picked || this.picks.length < this.bounds.max,
        },
        {control: 'secondary', label: 'Inspect'},
      ];
      // Console-wide grammar: L3 opens the SOURCE that produced what is on
      // screen. Offered EMBEDDED too — the host shows the card, but showing is
      // not reading: the whole point of the seat is that this draw came from
      // that card, and the player must be able to open it without leaving.
      // (It was suppressed here while the reveal beside it offered it, so the
      // same verb existed on one step of the flow and not the next.)
      if (this.sourceView?.inspectable === true) {
        cmds.push({control: 'stickL', label: 'Source', priority: 1});
      }
      if (!single) {
        // The COMMIT verb is discoverable nowhere else, so it is the last
        // droppable standing when the bar has to shed hints for fit.
        cmds.push({control: 'triggerR', label: 'Confirm', enabled: this.ready, priority: 0});
      }
      // B = MINIMIZE, always. Embedded it minimizes THE HOSTING WORKSPACE —
      // the documented verb for a nested step, and the very same thing the
      // start scene's own B does one level up, so the button never changes
      // meaning as the player descends. (It was withheld here on the theory
      // that a full-bleed host has nowhere to go; but the host itself offers
      // «B СВЕРНУТЬ», so all withholding it achieved was a step where B
      // silently did nothing.)
      cmds.push({control: 'back', label: 'Minimize'});
      return cmds;
    },
  },
  watch: {
    promptKey: {
      immediate: true,
      handler(): void {
        if (this.frozen !== undefined) {
          // The server moved on WHILE our own outgoing beats are still playing
          // (the normal case). The snapshot owns the screen until they finish;
          // re-dealing here would yank the cards out mid-flight.
          return;
        }
        this.picks = [];
        this.focusIdx = 0;
        this.submitting = false;
        if (this.entries.length > 0) {
          this.startDeal();
        }
      },
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: Array<ConsoleCommand>): void {
        setPanelCommands('deckPick', cmds);
      },
    },
    /** The stage name goes UP to the host's breadcrumb, never onto a kicker
     *  of our own. Retracted the moment we stop being embedded. */
    stageKey: {
      immediate: true,
      handler(key: string): void {
        if (this.embedded) {
          setWorkspaceOutcomePhase(key);
        }
      },
    },
    embedded(on: boolean): void {
      setWorkspaceOutcomePhase(on ? this.stageKey : '');
    },
    'entries.length'(): void {
      this.scheduleFit();
    },
  },
  mounted(): void {
    this.scheduleFit();
    // The HOST'S ZONE, never anything this surface can grow — observing our own
    // box would re-arm the fit from its own result.
    const box = (this.$el as HTMLElement | undefined)?.parentElement ??
      (this.$refs.frameEl as HTMLElement | undefined);
    if (box !== null && box !== undefined && typeof ResizeObserver === 'function') {
      const ro = markRaw(new ResizeObserver(() => this.scheduleFit()));
      ro.observe(box);
      this.ro = ro;
    }
  },
  beforeUnmount(): void {
    clearPanelCommands('deckPick');
    if (this.embedded) {
      setWorkspaceOutcomePhase('');
    }
    this.handle?.kill();
    this.handle = undefined;
    clearDeckPickFlight();
    releaseDeckDisplay();
    this.ro?.disconnect();
    this.ro = undefined;
  },
  methods: {
    isPicked(name: CardName | string): boolean {
      return this.picks.includes(name as CardName);
    },
    /** A real card is HELD while a proxy stands over it (Vue-managed, so a
     *  patch can never resurrect it under the flying copy). */
    slotHeld(name: CardName): boolean {
      return this.held.has(name);
    },

    // ── THE DEAL ────────────────────────────────────────────────────────
    /**
     * N cards come off the deck. The row is FIT FIRST (a batch that launched
     * against a pre-fit geometry would land off its own targets), then the
     * proxies are measured and handed to the shared director.
     */
    startDeal(): void {
      this.handle?.kill();
      this.handle = undefined;
      beginDeckPickDeal();
      const names = this.entries.map((e) => e.name);
      this.held = new Set<string>(names);
      if (typeof window === 'undefined') {
        this.flyOn = false;
        this.held.clear();
        beginDeckPickChoosing();
        return;
      }
      this.flyOn = true;
      // The bodies are the APP-LEVEL layer's; we only name the faces.
      armDeckPickFlight(names);
      // FREEZE the HUD deck counter at its pre-draw value: the server's answer
      // has already decremented it, so without this the number changes before
      // anything has physically left the pile — the opposite of the causal
      // story the beat exists to tell. Released as the first card separates.
      //
      // ONLY for a deck-sourced reveal. A discard-pile digger never touched the
      // deck, and inflating the counter for it would invent a draw that did not
      // happen — a worse lie than the one this is fixing.
      if (this.meta?.origin !== 'discard') {
        holdDeckDisplay(this.playerView.game.deckSize + names.length);
      }
      void this.$nextTick(() => {
        this.fitRow();
        void this.$nextTick(() => this.launchDeal());
      });
    },
    launchDeal(): void {
      if (!this.flyOn || this.handle !== undefined) {
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
      // The faces exist from the first frame (the prompt carries them), so the
      // batch opens IN FLIGHT — a post-landing flip here would be a bug.
      this.handle = runBatchArrival({
        cards, slots,
        mode: 'in-flight-reveal',
        onDeparted: () => releaseDeckDisplay(),
        onSettled: () => {
          this.handle = undefined;
          this.handOffDeal();
        },
      });
    },
    /** HANDOFF: reveal the real cards UNDER the proxies, remove the proxies on
     *  the next frame. Never a cross-fade (the copies are identical, so a fade
     *  can only expose what differs) and never hide-then-reveal (a blank frame). */
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
      this.flyOn = false;
      clearDeckPickFlight();
      this.held.clear();
      releaseDeckDisplay();
      // The claim's ARRIVAL gate is ours to open: this surface flew the batch,
      // so nothing else is going to say the cards have landed. Left closed it
      // would sit on the 5 s backstop while a fully interactive stage waited
      // for permission it had already earned.
      markWorkspaceOutcomeArrivalDone();
      beginDeckPickChoosing();
      // One last verify: the host's own return choreography (a queue receding,
      // a shelf settling) can finish AFTER the batch has landed, and the row
      // must end up solved against the box it actually got.
      this.scheduleFit();
    },

    // ── FIT ─────────────────────────────────────────────────────────────
    scheduleFit(): void {
      this.fitRetries = 0;
      void this.$nextTick(() => this.fitRow());
    },
    /**
     * ONE geometry engine, shared with every other card stage in a workspace
     * (`consoleWsStageLayout`): the gap is an OUTPUT solved together with the
     * zoom, so a focused card's ring can never grow over its neighbour, and a
     * batch of seven wraps into a deliberate two-row composition instead of
     * only shrinking.
     */
    fitRow(): void {
      const row = this.$refs.row as HTMLElement | null | undefined;
      if (row === null || row === undefined || this.entries.length === 0) {
        return;
      }
      // ⚠️ RESET THE ENGINE'S OWN OUTPUTS BEFORE MEASURING. The wrap cap is a
      // `max-width` on this very row, so a second fit would measure the width
      // the FIRST fit chose — narrower room, more rows, a narrower cap, and so
      // on. Same rule as the zoom reset beside it: an engine never reads its
      // own output.
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
      // THE SOURCE SEAT'S SAFE ZONE. The host parks a compact source card at
      // the left of its zone, and the card group is CENTRED — so reserving the
      // seat's width on BOTH sides is what guarantees the margin can never be
      // smaller than the seat. No z-index, no overlap: the two simply never
      // occupy the same space, in any phase, at any focus scale.
      //
      // Read here rather than expressed as row padding on purpose: the profile
      // ladders re-declare the row's `padding` shorthand, so an inset that rode
      // it silently vanished on the TV profile — and the source card then sat
      // on top of the first revealed card.
      //
      // MEASURED off the real seat, never read from the custom property that
      // declares it: `getPropertyValue('--x')` returns the token UNRESOLVED,
      // and this one is a `calc(...)` — `parseFloat` gives NaN, the fallback
      // gives 0, and the reserve silently disappears. (`cssLengthPx` covers
      // plain `rem`/`px`, which is why the trap survives it.) The seat is on
      // screen; asking it is both simpler and honest at any profile.
      const reserve = this.sourceReservePx();
      const layout = wsStageLayout({
        availW: row.clientWidth - padX - reserve * 2,
        // ⚠️ NEVER `row.clientHeight`. The row is `flex: 1` inside a frame that
        // the HOST sizes, so in a host whose zone lets its content grow, the
        // row's height is partly its OWN content — feeding it back in makes the
        // engine solve against its own output: a bigger zoom grows the row,
        // which buys a bigger zoom, until seven cards are laid out for a band
        // twice the size of the one on screen and half of them hang off it.
        // (Adding a ResizeObserver is what turned that latent circularity into
        // a reliable overflow, which is the honest way it should have failed.)
        //
        // The FRAME is the bounded box — the host's zone caps it — so the
        // budget is the frame's inner height minus this stage's own chrome,
        // measured, never enumerated.
        availH: Math.max(200 * ui, this.rowBudgetPx() - padY),
        slotW, slotH, n: this.entries.length, ui,
        rowGapPx: parseFloat(cs.rowGap) || undefined,
        // The WRAP CAP is a `max-width` on the ROW, so it may only carry the
        // row's OWN padding. The seat reserve is a virtual margin, not padding:
        // folding it in here made the cap wider than the shape it caps, and a
        // seven-card group planned as 4 + 3 broke as 5 + 2.
        padXPx: padX,
      });
      const style = wsStageLayoutStyle(layout);
      Object.entries(style).forEach(([k, v]) => row.style.setProperty(k, v));
      this.rowStyle = style;
    },

    /**
     * THE SOURCE SEAT'S WIDTH PLUS BREATHING ROOM, or 0 when no seat is shown.
     *
     * The host parks a compact source card at the left of its zone; the card
     * group is centred, so reserving this on BOTH sides is what guarantees the
     * group's margin can never be narrower than the seat. Spatial separation
     * by construction — not a z-index, not an overlap the eye forgives.
     */
    sourceReservePx(): number {
      if (typeof document === 'undefined') {
        return 0;
      }
      const seat = document.querySelector<HTMLElement>('[data-embed-source-slot]');
      const w = seat?.getBoundingClientRect().width ?? 0;
      return w > 4 ? w + 18 * conUiScale() : 0;
    },
    /**
     * The height the ROW may actually spend — the frame's inner box minus the
     * chrome that shares the column with it (the stage head, the status line
     * and the frame's own padding + gaps). Every term is MEASURED off the real
     * elements, so a profile that re-tunes any of them needs no change here.
     */
    rowBudgetPx(): number {
      const frame = this.$refs.frameEl as HTMLElement | null | undefined;
      if (frame === null || frame === undefined) {
        return 0;
      }
      const fcs = window.getComputedStyle(frame);
      let budget = frame.clientHeight -
        (parseFloat(fcs.paddingTop) || 0) - (parseFloat(fcs.paddingBottom) || 0);
      const root = this.$el as HTMLElement | undefined;
      for (const sel of ['.con-wshead', '.con-deckpick__head', '.con-deckpick__status']) {
        const el = root?.querySelector<HTMLElement>(sel) ?? null;
        if (el !== null) {
          const ecs = window.getComputedStyle(el);
          budget -= el.offsetHeight +
            (parseFloat(ecs.marginTop) || 0) + (parseFloat(ecs.marginBottom) || 0);
        }
      }
      // The column gaps between those siblings (frame gap + `.con-cards` gap).
      const cards = root?.querySelector<HTMLElement>('.con-deckpick__cards') ?? null;
      budget -= parseFloat(fcs.rowGap) || 0;
      budget -= cards === null ? 0 : (parseFloat(window.getComputedStyle(cards).rowGap) || 0);
      return budget;
    },

    // ── INPUT ───────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      if (!this.interactive) {
        return; // a beat in flight absorbs the pad — no double submit possible
      }
      if (intent.kind === 'nav') {
        this.move(intent.dir);
        return;
      }
      // L3 — the SOURCE card fullscreen. A raw button read: the stick presses
      // carry no default semantic action by design.
      if (intent.kind === 'press' && intent.button === 'stickL') {
        this.inspectSource();
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary': // A — toggle the focused card's pick
        this.toggleFocused();
        return;
      case 'inspect': // X — the console-wide fullscreen inspect
        this.inspectFocused();
        return;
      case 'nextTab': // RT — commit the set
        this.confirm();
        return;
      case 'back': // B — minimize (embedded: the HOSTING workspace folds)
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /**
     * PHYSICAL navigation — measured off the real slots, never an index.
     *
     * The last row of a wrapped group is CENTRED (4 + 3 puts the three under
     * the middle of the four), so a column-preserving index stepper sends the
     * cursor to a card that is visibly not the one below it.
     * `nearestInDirection` is the fork's shared answer to exactly that
     * question — the start wizard's own grid already navigates by it.
     *
     * The index stepper stays as the fallback for the frames before layout
     * (and for JSDOM), never as the normal path.
     */
    move(dir: 'up' | 'down' | 'left' | 'right'): void {
      const rects = asElements(this.$refs.slots)
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 4)
        .map((r) => ({left: r.left, top: r.top, width: r.width, height: r.height}));
      if (rects.length === this.entries.length) {
        const next = nearestInDirection(rects, this.focusIdx, dir);
        if (next >= 0) {
          this.focusIdx = next;
        }
        return;
      }
      const row = this.$refs.row as HTMLElement | null | undefined;
      const perRow = Math.max(1, parseInt(
        row?.style.getPropertyValue('--con-ws-stage-per-row') || String(this.entries.length), 10) ||
        this.entries.length);
      this.focusIdx = stepHandGrid(this.focusIdx, dir, this.entries.length, perRow);
    },
    toggleFocused(): void {
      const name = this.focusedName as CardName;
      if (name === '') {
        return;
      }
      const at = this.picks.indexOf(name);
      if (at >= 0) {
        this.picks.splice(at, 1);
        return;
      }
      if (this.picks.length >= this.bounds.max) {
        // At the ceiling A does nothing rather than silently swapping a pick
        // the player cannot see leaving — the status rail already says how
        // many are owed, and deselect is on the same button.
        return;
      }
      this.picks.push(name);
      // A prompt that takes EXACTLY ONE card is answered by the press itself:
      // asking for a second confirmation of a decision with no second step is
      // the ceremony the console removes everywhere else.
      if (this.exact && this.bounds.max === 1) {
        this.confirm();
      }
    },
    /** X = the CURRENT object (console-wide grammar). The card is a visible
     *  tile, so it lifts physically out of its slot and dives back into it —
     *  the stage is never unmounted, so the picks and the focus survive. */
    /** The fullscreen viewer's pick bridge — same rule as the strip's A. */
    toggleByName(name: CardName): void {
      const at = this.entries.findIndex((e) => e.name === name);
      if (at >= 0) {
        this.focusIdx = at;
        this.toggleFocused();
      }
    },
    inspectFocused(): void {
      const cards = this.entries.map((e) => ({name: e.name} as CardModel));
      if (cards.length === 0) {
        return;
      }
      openConsoleCardZoom(cards, this.focusIdx, {
        isSelected: (name) => this.isPicked(name),
        toggle: (name) => this.toggleByName(name),
      }, undefined, {
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement | undefined,
          (i) => this.entries[i]?.name ?? '',
          (i) => {
            this.focusIdx = i;
          }),
      });
    },
    /**
     * L3 = the SOURCE that produced what is on screen — read-only (no select
     * bridge, so it can never answer the prompt).
     *
     * The card is a REAL object on screen while embedded (the host's source
     * seat), so the viewer LIFTS THAT ONE rather than opening a second copy
     * beside it — the console's physicality rule. Standalone there is no seat
     * and the viewer degrades to its textual entrance by itself.
     */
    inspectSource(): void {
      const card = this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
      if (card === undefined) {
        return;
      }
      const model = this.playerView.thisPlayer.tableau.find((c) => c.name === card) ?? {name: card};
      openConsoleCardZoom([model as CardModel], 0, undefined, undefined, {
        contextLabel: 'Card draw',
        statusLabel: 'Source',
        // ONE resolver for every host that offers L3 Источник — the same one
        // the reveal uses, so the card lifts out of whichever seat is holding
        // it and its slot is held empty for the trip.
        origin: workspaceSourceZoomOrigin(String(card)),
      });
    },

    // ── THE COMMIT ──────────────────────────────────────────────────────
    /**
     * CONFIRM — and then the whole point of the surface.
     *
     * The submit goes out FIRST (the server works while the cards travel, so
     * the latency hides inside a beat the player wanted to watch), but the
     * surface holds itself down across the round trip: `waitingFor` names the
     * next prompt long before anything has reached the dock, and unmounting
     * there is exactly what made the old flow read as a teleport.
     *
     * Order is the causality the player is owed:
     *   picks LEAVE and land in the dock  →  the rest is no longer needed.
     */
    confirm(): void {
      if (!this.ready || this.submitting || !this.interactive) {
        return;
      }
      this.submitting = true;
      const kept = [...this.picks];
      // FREEZE FIRST, submit second. The order is the whole point: the response
      // can land in the same tick, and the row must already be reading from a
      // snapshot when it does.
      this.frozen = {
        entries: [...this.entries],
        bounds: {...this.bounds},
        source: this.sourceView,
      };
      // Synchronous with the submit — no frame exists in which the prompt is
      // gone and the hold is not yet up.
      beginDeckPickSend(kept.length);
      this.$emit('submit', cardsResponse(kept));
      void this.runOutgoing(kept);
    },
    async runOutgoing(kept: ReadonlyArray<CardName>): Promise<void> {
      const key = this.promptKey;
      try {
        await this.sendToHand(kept);
        beginDeckPickClearing();
        await this.clearRest(kept);
      } finally {
        // A REFUSED submit must not leave the player inside a beat that will
        // never finish. The honest signal is the prompt itself: if the server
        // is still asking the very same question after the beats AND after a
        // bounded grace for a slow answer, the move did not happen — roll the
        // flow back to `choosing` (the surface is still mounted by the ordinary
        // gate) instead of unmounting a screen that is still owed an answer.
        await this.awaitPromptMoved(key);
        this.frozen = undefined;
        if (this.model !== undefined && this.promptKey === key) {
          this.picks = [];
          this.focusIdx = 0;
          this.submitting = false;
          rollbackDeckPickCommit();
        } else {
          endDeckPickCommit();
        }
      }
    },
    /** Wait (bounded) for the server to move off `key`. Resolves at once when
     *  it already has — the common case, since the answer normally lands long
     *  before the cards reach the dock. */
    awaitPromptMoved(key: string): Promise<void> {
      if (this.model === undefined || this.promptKey !== key || typeof window === 'undefined') {
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
          () => this.model === undefined || this.promptKey !== key,
          (moved: boolean) => {
            if (moved) {
              finish();
            }
          });
        const timer = window.setTimeout(finish, motionMs(REFUSAL_GRACE_MS));
      });
    },
    /**
     * The picks physically become the player's hand. `runHandIntake` owns the
     * whole ownership handoff — it holds each name in the dock's own held
     * multiset from the moment it leaves, so the card is never in two places,
     * and it takes a dock-accent lease that brings the dock out of its compact
     * pose to receive them.
     */
    async sendToHand(kept: ReadonlyArray<CardName>): Promise<void> {
      if (!handDockReachable()) {
        return; // no dock on screen (a cinematic covers it) — never a ghost flight
      }
      const entries = kept
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
    /**
     * The CLEAN-UP beat: the cards nobody took drift away and fade — the
     * project's own «rejected cards» motion, on the REAL slots (a proxy for a
     * card that is simply being thrown away would be ceremony). Short on
     * purpose; it exists so the row is not deleted out from under the player.
     */
    async clearRest(kept: ReadonlyArray<CardName>): Promise<void> {
      const rest = this.entries
        .filter((e) => !kept.includes(e.name))
        .map((e) => this.slotEl(e.name))
        .filter((el): el is HTMLElement => el !== null);
      if (rest.length === 0) {
        return;
      }
      applyDiscardExit(rest, {stepMs: 28});
      if (consoleReducedMotionActive()) {
        return;
      }
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, motionMs(CLEAR_MS));
      });
    },
    slotEl(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const key = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(name) : name.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-deckpick-slot="${key}"]`);
    },
    /** The shell's rollback on a refused submit — the prompt is still live, so
     *  the screen comes back rather than stranding the player inside a beat. */
    rollback(): void {
      this.submitting = false;
      rollbackDeckPickCommit();
    },
  },
});
</script>
